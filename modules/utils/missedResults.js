/**
 * MatchMonkey Missed Results Tracker
 * 
 * Tracks recommendations from Last.fm and ReccoBeats that were not found in the local library.
 * Results persist across runs via SQLite table `MatchMonkeyData` (key: 'missedResults')
 * and can be viewed, copied, or cleared by the user.
 * 
 * Popularity is normalized to 0-100 scale:
 * - ReccoBeats: Uses native popularity (0-100)
 * - Last.fm: Converts playcount using logarithmic scale
 * 
 * Meta system:
 * - Lightweight summary stored in `MatchMonkeyMissedMeta` via app.setValue()
 * - Allows the options panel to display storage usage without loading all results
 * 
 * @author Remo Imparato
 */

'use strict';

// Get logger reference
const _getMissedLogger = () => window.matchMonkeyLogger;

const MISSED_LEGACY_STORAGE_KEY = 'MatchMonkey_MissedResults';
const MISSED_META_STORAGE_KEY = 'MatchMonkeyMissedMeta';
const MISSED_DB_TABLE = 'MatchMonkeyData';
const MISSED_DB_KEY = 'missedResults';
const MISSED_MIN_POPULARITY = 30; // Minimum popularity threshold — below this is not relevant

/**
 * Missed result structure:
 * {
 *   artist: string,
 *   title: string,
 *   album: string,
 *   popularity: number (0-100, normalized from playcount or ReccoBeats),
 *   occurrences: number (how many times this result was encountered),
 *   additionalInfo: object {
 *     source: 'Last.fm' | 'ReccoBeats',
 *     discoveryMode: string,
 *     playcount: number (raw Last.fm playcount if applicable),
 *     rank: number (Last.fm rank if applicable)
 *   }
 * }
 */

/**
 * In-memory store. Null when not initialized.
 * Loaded from DB on init(), persisted to DB on save().
 */
let missedStore = null;
let missedDbTableReady = false;
let missedPersistentMeta = null;

// =========================================================================
// META HELPERS
// =========================================================================

function createEmptyMissedMeta() {
	return {
		storage: 'db',
		sizeBytes: 0,
		lastSavedTs: 0,
		total: 0,
		uniqueArtists: 0,
		totalOccurrences: 0,
		avgPopularity: 0,
	};
}

function computeMissedMeta(results, sizeBytes) {
	if (!Array.isArray(results) || results.length === 0) {
		return { ...createEmptyMissedMeta(), lastSavedTs: Date.now() };
	}
	const artists = new Set();
	let totalOcc = 0;
	let totalPop = 0;
	for (const r of results) {
		if (r.artist) artists.add(r.artist);
		totalOcc += (r.occurrences || 1);
		totalPop += (r.popularity || 0);
	}
	return {
		storage: 'db',
		sizeBytes: Math.max(0, Number(sizeBytes) || 0),
		lastSavedTs: Date.now(),
		total: results.length,
		uniqueArtists: artists.size,
		totalOccurrences: totalOcc,
		avgPopularity: results.length > 0 ? Math.round(totalPop / results.length) : 0,
	};
}

function saveMissedMeta(meta) {
	missedPersistentMeta = meta || createEmptyMissedMeta();
	if (typeof app === 'undefined' || !app.setValue) return;
	try {
		app.setValue(MISSED_META_STORAGE_KEY, missedPersistentMeta);
	} catch (_) {
		// non-fatal
	}
}

function loadMissedMeta() {
	if (missedPersistentMeta) return missedPersistentMeta;
	if (typeof app === 'undefined' || !app.getValue) {
		missedPersistentMeta = createEmptyMissedMeta();
		return missedPersistentMeta;
	}
	try {
		const raw = app.getValue(MISSED_META_STORAGE_KEY, {});
		missedPersistentMeta = (raw && typeof raw === 'object') ? raw : createEmptyMissedMeta();
	} catch (_) {
		missedPersistentMeta = createEmptyMissedMeta();
	}
	return missedPersistentMeta;
}

function updateMissedMetaFromStore(sizeBytes = 0) {
	saveMissedMeta(computeMissedMeta(missedStore, sizeBytes));
}

// =========================================================================
// DB HELPERS
// =========================================================================

function hasMissedDbAsyncApi() {
	return typeof app !== 'undefined'
		&& !!app.db
		&& typeof app.db.executeQueryAsync === 'function'
		&& typeof app.db.getQueryResultAsync === 'function';
}

function sqlMissedStringLiteral(value) {
	return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function extractMissedDbValue(rows) {
	if (!rows || rows.count === 0 || rows.eof) return null;
	return rows.fields.getValue(0);
}

async function ensureMissedDbTableAsync() {
	if (missedDbTableReady) return true;
	if (!hasMissedDbAsyncApi()) return false;
	try {
		await app.db.executeQueryAsync(`CREATE TABLE IF NOT EXISTS ${MISSED_DB_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
		missedDbTableReady = true;
		return true;
	} catch (e) {
		_getMissedLogger()?.warn('MissedResults', `Failed to ensure DB table: ${e}`);
		return false;
	}
}

async function saveMissedToDbAsync(json) {
	if (!(await ensureMissedDbTableAsync())) return false;
	try {
		await app.db.executeQueryAsync(
			`INSERT OR REPLACE INTO ${MISSED_DB_TABLE} (key, value) VALUES (${sqlMissedStringLiteral(MISSED_DB_KEY)}, ${sqlMissedStringLiteral(json)})`
		);
		return true;
	} catch (e) {
		_getMissedLogger()?.warn('MissedResults', `Failed to save to DB: ${e}`);
		return false;
	}
}

async function loadMissedFromDbAsync() {
	if (!(await ensureMissedDbTableAsync())) return null;
	try {
		const rows = await app.db.getQueryResultAsync(
			`SELECT value FROM ${MISSED_DB_TABLE} WHERE key = ${sqlMissedStringLiteral(MISSED_DB_KEY)}`
		);
		const value = extractMissedDbValue(rows);
		if (value === null || value === undefined || value === '') return [];
		if (Array.isArray(value)) return value;
		if (typeof value === 'string') return JSON.parse(value);
		return JSON.parse(String(value));
	} catch (err) {
		_getMissedLogger()?.warn('MissedResults', `Failed to load from DB: ${err}`);
		return null;
	}
}

async function clearMissedFromDbAsync() {
	if (!(await ensureMissedDbTableAsync())) return false;
	try {
		await app.db.executeQueryAsync(`DELETE FROM ${MISSED_DB_TABLE} WHERE key = ${sqlMissedStringLiteral(MISSED_DB_KEY)}`);
		return true;
	} catch (e) {
		_getMissedLogger()?.warn('MissedResults', `Failed to clear DB: ${e}`);
		return false;
	}
}

// =========================================================================
// PERSISTENCE
// =========================================================================

async function saveMissedResultsToPersistentStore() {
	try {
		if (!missedStore) {
			_getMissedLogger()?.warn('MissedResults', 'saveToPersistentStore: skipped (store is null)');
			return;
		}

		if (!hasMissedDbAsyncApi()) {
			_getMissedLogger()?.warn('MissedResults', 'DB async API not available; results were not persisted');
			return;
		}

		const json = JSON.stringify(missedStore);
		const saved = await saveMissedToDbAsync(json);
		if (saved) {
			updateMissedMetaFromStore(json.length * 2);
			try {
				window.dispatchEvent(new CustomEvent('matchmonkey:missedresultssaved', {
					detail: {
						sizeBytes: json.length * 2,
						total: missedStore.length,
						lastSavedTs: Date.now(),
					}
				}));
			} catch (_) {
				// non-fatal
			}
			_getMissedLogger()?.debug('MissedResults', `Saved ${missedStore.length} results to database`);
		}
	} catch (e) {
		_getMissedLogger()?.warn('MissedResults', `Failed to save: ${e}`);
	}
}

async function loadMissedResultsFromPersistentStore() {
	try {
		if (!hasMissedDbAsyncApi()) {
			_getMissedLogger()?.warn('MissedResults', 'DB async API not available; starting with empty store');
			missedStore = [];
			updateMissedMetaFromStore(0);
			return;
		}

		let raw = await loadMissedFromDbAsync();
		if (raw === null) {
			_getMissedLogger()?.debug('MissedResults', 'No missed-results row in DB yet; continuing with empty/legacy initialization');
		}
		let persistedJsonLength = 0;

		// Migrate from legacy app.setValue storage if DB is empty
		if (!raw || !Array.isArray(raw)) {
			try {
				const legacy = app.getValue(MISSED_LEGACY_STORAGE_KEY, []);
				if (Array.isArray(legacy) && legacy.length > 0) {
					_getMissedLogger()?.debug('MissedResults', `Migrating ${legacy.length} results from legacy storage to DB`);
					raw = legacy;
					app.setValue(MISSED_LEGACY_STORAGE_KEY, []);
				}
			} catch (_) {
				// ignore migration errors
			}
		}

		if (Array.isArray(raw)) {
			missedStore = raw;
			try {
				persistedJsonLength = JSON.stringify(raw).length;
			} catch (_) {
				persistedJsonLength = 0;
			}
		} else {
			missedStore = [];
		}

		updateMissedMetaFromStore(persistedJsonLength * 2);
		_getMissedLogger()?.debug('MissedResults', `Loaded ${missedStore.length} results from persistent store`);
	} catch (e) {
		_getMissedLogger()?.warn('MissedResults', `Failed to load: ${e}`);
		missedStore = [];
		updateMissedMetaFromStore(0);
	}
}

// =========================================================================
// LIFECYCLE
// =========================================================================

/**
 * Initialize the missed results store.
 * Loads persisted data from the database (with legacy migration).
 */
async function initMissedResults() {
	if (missedStore !== null) return; // already initialized
	await loadMissedResultsFromPersistentStore();
}

/**
 * Save the current missed results to the database.
 * Called at the end of a discovery run so new entries survive restarts.
 */
function saveMissedResults() {
	return saveMissedResultsToPersistentStore();
}

// =========================================================================
// PUBLIC API
// =========================================================================

/**
 * Get all missed results (always returns an array).
 * Returns in-memory data; call init() first to load from DB.
 * @returns {Array} Array of missed results
 */
function getAllMissedResults() {
	return Array.isArray(missedStore) ? missedStore : [];
}

/**
 * Get statistics about missed results.
 * Returns live stats from in-memory store, or falls back to persisted meta.
 * @returns {object} Statistics {total, uniqueArtists, totalOccurrences, avgPopularity}
 */
function getMissedResultsStats() {
	const logger = _getMissedLogger();
	try {
		// Live in-memory data available
		if (missedStore !== null) {
			const results = missedStore;
			return {
				total: results.length,
				uniqueArtists: new Set(results.map(r => r.artist)).size,
				totalOccurrences: results.reduce((sum, r) => sum + (r.occurrences || 1), 0),
				avgPopularity: results.length > 0
					? Math.round(results.reduce((sum, r) => sum + (r.popularity || 0), 0) / results.length)
					: 0
			};
		}

		// Fall back to persisted meta
		const meta = loadMissedMeta();
		return {
			total: Number(meta.total) || 0,
			uniqueArtists: Number(meta.uniqueArtists) || 0,
			totalOccurrences: Number(meta.totalOccurrences) || 0,
			avgPopularity: Number(meta.avgPopularity) || 0,
		};
	} catch (e) {
		logger?.error('MissedResults', 'Error getting stats: ' + e.toString());
		return { total: 0, uniqueArtists: 0, totalOccurrences: 0, avgPopularity: 0 };
	}
}

/**
 * Get lightweight metadata about persisted missed results.
 * Reads from app.getValue without loading full data from DB.
 * @returns {object} Meta with sizeBytes, total, uniqueArtists, etc.
 */
function getMissedResultsPersistentMeta() {
	const meta = loadMissedMeta();
	if (!meta || typeof meta !== 'object') return createEmptyMissedMeta();
	return {
		storage: String(meta.storage || 'db'),
		sizeBytes: Number(meta.sizeBytes) || 0,
		lastSavedTs: Number(meta.lastSavedTs) || 0,
		total: Number(meta.total) || 0,
		uniqueArtists: Number(meta.uniqueArtists) || 0,
		totalOccurrences: Number(meta.totalOccurrences) || 0,
		avgPopularity: Number(meta.avgPopularity) || 0,
	};
}

/**
 * Add a missed result to the in-memory store.
 * Call save() after a run to persist to the database.
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {string} album - Album name (optional)
 * @param {number} popularity - Popularity score 0-100 (normalized)
 * @param {object} additionalInfo - Optional additional information (source, playcount, etc.)
 */
function addMissedResult(artist, title, album = '', popularity = 0, additionalInfo = {}) {
	const logger = _getMissedLogger();
	if (!artist || !title) {
		logger?.warn('MissedResults', 'Cannot add result without artist and title');
		return false;
	}

	try {
		artist = String(artist).trim();
		title = String(title).trim();
		album = album ? String(album).trim() : '';
		popularity = isNaN(popularity) ? 0 : Math.max(0, Math.min(100, Number(popularity)));
		additionalInfo = (typeof additionalInfo === 'object' && additionalInfo !== null) ? additionalInfo : {};
	} catch (e) {
		logger?.error('MissedResults', 'Error sanitizing inputs: ' + e.toString());
		return false;
	}

	if (!artist || !title) {
		logger?.warn('MissedResults', 'Cannot add result - artist or title empty after sanitization');
		return false;
	}

	if (popularity < MISSED_MIN_POPULARITY) {
		logger?.debug('MissedResults', `Skipping low-popularity missed result "${artist} - ${title}" (${popularity} < ${MISSED_MIN_POPULARITY})`);
		return false;
	}

	try {
		if (!Array.isArray(missedStore)) missedStore = [];

		const cleanArtist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
			? matchMonkeyHelpers.cleanArtistName(artist).toUpperCase()
			: artist.toUpperCase();
		const cleanTitle = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
			? matchMonkeyHelpers.cleanTrackName(title).toUpperCase()
			: title.toUpperCase();

		const cleanedResults = missedStore.map(r => ({
			cleanArtist: (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
				? matchMonkeyHelpers.cleanArtistName(r.artist).toUpperCase()
				: r.artist.toUpperCase(),
			cleanTitle: (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
				? matchMonkeyHelpers.cleanTrackName(r.title).toUpperCase()
				: r.title.toUpperCase()
		}));

		const existingIndex = cleanedResults.findIndex(r =>
			r.cleanArtist === cleanArtist && r.cleanTitle === cleanTitle
		);

		if (existingIndex >= 0) {
			missedStore[existingIndex].occurrences = (missedStore[existingIndex].occurrences || 1) + 1;
			if (popularity > (missedStore[existingIndex].popularity || 0)) {
				missedStore[existingIndex].popularity = popularity;
			}
			missedStore[existingIndex].additionalInfo = {
				...(missedStore[existingIndex].additionalInfo || {}),
				...additionalInfo
			};
		} else {
			missedStore.unshift({
				artist,
				title,
				popularity: popularity || 0,
				occurrences: 1,
				additionalInfo: additionalInfo || {}
			});
		}

		// Dispatch event for UI updates
		try {
			window.dispatchEvent(new CustomEvent('matchmonkey:missedresultadded', {
				detail: { artist, title, album, popularity }
			}));
		} catch (e) {
			// Event dispatch not critical
		}

		return true;

	} catch (e) {
		logger?.error('MissedResults', 'Error adding result: ' + e.toString());
		return false;
	}
}

/**
 * Add multiple missed results to the in-memory store.
 * Call save() after a run to persist to the database.
 * 
 * @param {Array} results - Array of result objects with {artist, title, album, popularity, additionalInfo}
 */
function addMissedResultsBatch(results) {
	const logger = _getMissedLogger();
	if (!Array.isArray(results) || results.length === 0) {
		return;
	}

	logger?.debug('MissedResults', `Adding batch of ${results.length} results`);

	let storedCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	results.forEach((result, index) => {
		try {
			if (!result || typeof result !== 'object') {
				skippedCount++;
				return;
			}
			if (!result.artist || !result.title) {
				skippedCount++;
				return;
			}
			if (addMissedResult(
				result.artist,
				result.title,
				result.album || '',
				result.popularity || 0,
				result.additionalInfo || {}
			)) storedCount++;
			else skippedCount++;
		} catch (e) {
			logger?.error('MissedResults', `Error adding result at index ${index}: ${e}`);
			errorCount++;
		}
	});

	if (errorCount > 0) {
		logger?.warn('MissedResults', `Batch complete - ${successCount} succeeded, ${errorCount} failed`);
		if (errorCount > 0 || skippedCount > 0) {
			logger?.warn('MissedResults', `Batch complete - ${storedCount} stored, ${skippedCount} skipped, ${errorCount} failed`);
		} else {
			logger?.debug('MissedResults', `Batch complete - ${successCount} results added`);
			logger?.debug('MissedResults', `Batch complete - ${storedCount} results stored`);
		}
	}
}
function getMissedResultsByArtist(artist) {
	try {
		return getAllMissedResults().filter(r => r.artist === artist);
	} catch (e) {
		_getMissedLogger()?.error('MissedResults', 'Error filtering by artist: ' + e.toString());
		return [];
	}
}

function clearMissedResults() {
	const logger = _getMissedLogger();
	try {
		logger?.debug('MissedResults', 'Clearing all results');
		missedStore = [];

		if (hasMissedDbAsyncApi()) {
			clearMissedFromDbAsync().catch(e => {
				logger?.warn('MissedResults', `Failed to clear DB: ${e}`);
			});
		}

		saveMissedMeta(createEmptyMissedMeta());

		try {
			window.dispatchEvent(new CustomEvent('matchmonkey:missedresultscleared'));
		} catch (e) {
			// Event dispatch not critical
		}
	} catch (e) {
		logger?.error('MissedResults', 'Error clearing: ' + e.toString());
	}
}

function getMissedResultsCount() {
	if (missedStore !== null) return missedStore.length;
	const meta = loadMissedMeta();
	return Number(meta.total) || 0;
}

// Export to window namespace
window.matchMonkeyMissedResults = {
	initMissedResults,
	saveMissedResults,
	getAllMissedResults,
	getMissedResultsStats,
	getMissedResultsCount,
	addMissedResult,
	addMissedResultsBatch,
	getMissedResultsByArtist,
	clearMissedResults,
	getMissedResultsPersistentMeta,
};
