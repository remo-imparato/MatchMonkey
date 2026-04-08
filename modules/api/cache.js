/**
 * MatchMonkey API Response Cache
 * 
 * Persistent cache for Last.fm and ReccoBeats API responses.
 * Survives MediaMonkey restarts via SQLite table `MatchMonkeyData`.
 * Each entry is timestamped; expired entries are evicted on load.
 * 
 * Cache Structure:
 * 
 * Last.fm (separated by API method):
 * - lastfm.similarArtists: artist.getSimilar results
 * - lastfm.topTracks: artist.getTopTracks results
 * - lastfm.similarTracks: track.getSimilar results
 * - lastfm.artistInfo: artist.getInfo results
 * 
 * ReccoBeats (separated by data type):
 * - reccobeats.lookups: artist, album, and track ID lookups
 * - reccobeats.audioFeatures: track audio feature data
 * - reccobeats.recommendations: recommendation results
 * 
 * TTL behaviour:
 * - Last.fm maps and reccobeats.audioFeatures / reccobeats.recommendations
 *   use the user-configurable CacheTTLHours (default 72h).
 * - reccobeats.lookups uses a fixed 1-year TTL because artist/album/track IDs
 *   are permanent and lookups are expensive (many paginated API calls).
 * 
 * Only essential fields are stored in each cache entry to minimize memory.
 * API responses are trimmed to the fields actually consumed downstream.
 * 
 * @author Remo Imparato
 */

'use strict';

const CACHE_STORAGE_KEY = 'MatchMonkeyCache'; // legacy app.setValue fallback/migration key
const CACHE_META_STORAGE_KEY = 'MatchMonkeyCacheMeta';
const CACHE_DB_TABLE = 'MatchMonkeyData';
const CACHE_DB_KEY = 'cache';

// Get logger reference
const _getCacheLogger = () => window.matchMonkeyLogger;

/**
 * In-memory cache store. Each leaf value is a Map whose entries are
 * { data: <value>, ts: <epoch ms> }.
 * Null when the cache has not been initialised yet.
 */
let cacheStore = null;
let cacheDbTableReady = false;
let cachePersistentMeta = null;

/**
 * Map category names that use a fixed 1-year TTL.
 * ReccoBeats IDs are permanent, so lookup results never need to expire.
 */
const LONG_TTL_MAPS = new Set(['lookups']);

const LOOKUP_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — IDs don't change

// =========================================================================
// CACHE KEY HELPERS
// =========================================================================

/**
 * Get a normalized cache key for artist names.
 * @param {string} name Artist name.
 * @returns {string} Normalized cache key (uppercase, trimmed).
 */
function cacheKeyArtist(name) {
	return String(name || '').trim().toUpperCase();
}

/**
 * Get a cache key for top tracks (includes artist, limit, and playcount flag).
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {string} Cache key.
 */
function cacheKeyTopTracks(artistName, limit, withPlaycount = false) {
	return `${cacheKeyArtist(artistName)}|${Number(limit) || ''}|pc:${withPlaycount ? 1 : 0}`;
}

// =========================================================================
// TTL HELPERS
// =========================================================================

/**
 * Get the standard TTL in milliseconds from user settings.
 * Defaults to 24 hours when not configured.
 * @returns {number} TTL in milliseconds.
 */
function getStandardTTL() {
	let hours = 24;
	if (window.matchMonkeyStorage?.getSetting) {
		const configured = window.matchMonkeyStorage.getSetting('CacheTTLHours', 72);
		const parsed = parseFloat(configured);
		if (Number.isFinite(parsed) && parsed > 0) hours = parsed;
	}
	return hours * 60 * 60 * 1000;
}

/**
 * Get the TTL in ms for a given map category.
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @returns {number} TTL in milliseconds.
 */
function getTTLForMap(groupName, mapName) {
	if (groupName === 'reccobeats' && LONG_TTL_MAPS.has(mapName)) {
		return LOOKUP_TTL_MS; // fixed 1-year — IDs are permanent
	}
	return getStandardTTL();
}

/**
 * Check whether a timestamped entry is still valid.
 * @param {number} ts    Entry creation timestamp (epoch ms).
 * @param {number} ttl   TTL in milliseconds.
 * @returns {boolean}
 */
function isEntryValid(ts, ttl) {
	return (Date.now() - ts) < ttl;
}

// =========================================================================
// PERSISTENCE
// =========================================================================

/**
 * Internal: structure used for serialisation.
 * All Map names that belong to each group.
 */
const CACHE_STRUCTURE = {
	lastfm: ['similarArtists', 'topTracks', 'similarTracks', 'artistInfo', 'tagArtists'],
	reccobeats: ['lookups', 'audioFeatures', 'recommendations'],
};

function createEmptyCacheCounts() {
	return {
		similarArtists: 0,
		topTracks: 0,
		similarTracks: 0,
		artistInfo: 0,
		tagArtists: 0,
		artistLookups: 0,
		albumLookups: 0,
		trackLookups: 0,
		audioFeatures: 0,
		recommendations: 0,
	};
}

function createEmptyCacheMeta() {
	return {
		storage: 'db',
		sizeBytes: 0,
		lastSavedTs: 0,
		counts: createEmptyCacheCounts(),
	};
}

function computeCacheCountsFromStore(store) {
	const counts = createEmptyCacheCounts();
	if (!store) return counts;

	counts.similarArtists = store.lastfm?.similarArtists?.size || 0;
	counts.topTracks = store.lastfm?.topTracks?.size || 0;
	counts.similarTracks = store.lastfm?.similarTracks?.size || 0;
	counts.artistInfo = store.lastfm?.artistInfo?.size || 0;
	counts.tagArtists = store.lastfm?.tagArtists?.size || 0;
	counts.audioFeatures = store.reccobeats?.audioFeatures?.size || 0;
	counts.recommendations = store.reccobeats?.recommendations?.size || 0;

	const lookupsMap = store.reccobeats?.lookups;
	if (lookupsMap) {
		for (const key of lookupsMap.keys()) {
			const k = String(key).toUpperCase();
			if (k.startsWith('TRACKID:')) counts.trackLookups++;
			else if (k.startsWith('ALBUMID:') || k.startsWith('ALBUM:') || k.startsWith('ARTISTALBUMS:') || k.startsWith('ALBUMTRACKS:')) counts.albumLookups++;
			else if (k.startsWith('ARTISTALL:')) counts.artistLookups++;
		}
	}

	return counts;
}

function saveCacheMeta(meta) {
	cachePersistentMeta = meta || createEmptyCacheMeta();
	_getCacheLogger()?.debug('Cache', `Meta: sizeBytes=${cachePersistentMeta.sizeBytes || 0}, counts=${JSON.stringify(cachePersistentMeta.counts || {})}`);
	if (typeof app === 'undefined' || !app.setValue) return;
	try {
		app.setValue(CACHE_META_STORAGE_KEY, cachePersistentMeta);
	} catch (_) {
		// non-fatal
	}
}

function loadCacheMeta() {
	if (cachePersistentMeta) return cachePersistentMeta;
	if (typeof app === 'undefined' || !app.getValue) {
		cachePersistentMeta = createEmptyCacheMeta();
		return cachePersistentMeta;
	}
	try {
		const raw = app.getValue(CACHE_META_STORAGE_KEY, null);
		cachePersistentMeta = (raw && typeof raw === 'object') ? raw : createEmptyCacheMeta();
	} catch (_) {
		cachePersistentMeta = createEmptyCacheMeta();
	}
	return cachePersistentMeta;
}

function updateCacheMetaFromStore(sizeBytes = 0) {
	saveCacheMeta({
		storage: 'db',
		sizeBytes: Math.max(0, Number(sizeBytes) || 0),
		lastSavedTs: Date.now(),
		counts: computeCacheCountsFromStore(cacheStore),
	});
}

function hasCacheDbApi() {
	return typeof app !== 'undefined' && !!app.db;
}

function hasCacheDbAsyncApi() {
	return typeof app !== 'undefined'
		&& !!app.db
		&& typeof app.db.executeQueryAsync === 'function'
		&& typeof app.db.getQueryResultAsync === 'function';
}

function sqlCacheStringLiteral(value) {
	return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function extractCacheDbValue(rows) {
	if (!rows || rows.count === 0 || rows.eof) return null;
	return rows.fields.getValue(0);
}

async function ensureCacheDbTableAsync() {
	if (cacheDbTableReady) return true;
	if (!hasCacheDbAsyncApi()) return false;
	try {
		const sql = `CREATE TABLE IF NOT EXISTS ${CACHE_DB_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
		_getCacheLogger()?.debug('Cache', `SQL: ${sql}`);
		await app.db.executeQueryAsync(sql);
		cacheDbTableReady = true;
		return true;
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to ensure DB table: ${e}`);
		return false;
	}
}

async function saveCacheJsonToDbAsync(json) {
	if (!(await ensureCacheDbTableAsync())) return false;
	try {
		_getCacheLogger()?.debug('Cache', `SQL: INSERT OR REPLACE INTO ${CACHE_DB_TABLE} (key='${CACHE_DB_KEY}', ${json.length} chars)`);
		await app.db.executeQueryAsync(
			`INSERT OR REPLACE INTO ${CACHE_DB_TABLE} (key, value) VALUES (${sqlCacheStringLiteral(CACHE_DB_KEY)}, ${sqlCacheStringLiteral(json)})`
		);
		return true;
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to save DB cache row: ${e}`);
		return false;
	}
}

async function loadCacheJsonFromDbAsync() {
	if (!(await ensureCacheDbTableAsync())) return null;
	try {
		_getCacheLogger()?.debug('Cache', `SQL: SELECT value FROM ${CACHE_DB_TABLE} WHERE key='${CACHE_DB_KEY}'`);
		const rows = await app.db.getQueryResultAsync(
			`SELECT value FROM ${CACHE_DB_TABLE} WHERE key = ${sqlCacheStringLiteral(CACHE_DB_KEY)}`
		);
		const value = extractCacheDbValue(rows);
		if (value === null || value === undefined || value === '') return {};
		if (typeof value === 'object') return value;
		if (typeof value === 'string') return JSON.parse(value);
		return JSON.parse(String(value));
	} catch (err) {
		_getCacheLogger()?.warn('Cache', `Failed to load DB cache row: ${err}`);
		return null;
	}
}

async function clearCacheDbAsync() {
	if (!(await ensureCacheDbTableAsync())) return false;
	try {
		_getCacheLogger()?.debug('Cache', `SQL: DELETE FROM ${CACHE_DB_TABLE} WHERE key='${CACHE_DB_KEY}'`);
		await app.db.executeQueryAsync(`DELETE FROM ${CACHE_DB_TABLE} WHERE key = ${sqlCacheStringLiteral(CACHE_DB_KEY)}`);
		return true;
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to clear DB cache row: ${e}`);
		return false;
	}
}

function createEmptyCacheStore() {
	const store = {};
	for (const [group, maps] of Object.entries(CACHE_STRUCTURE)) {
		store[group] = {};
		for (const name of maps) {
			store[group][name] = new Map();
		}
	}
	return store;
}

function serialiseCacheStore() {
	if (!cacheStore) return null;
	const out = {};
	for (const [group, maps] of Object.entries(CACHE_STRUCTURE)) {
		out[group] = {};
		for (const name of maps) {
			const map = cacheStore[group]?.[name];
			out[group][name] = map ? Array.from(map.entries()) : [];
		}
	}
	return out;
}

function deserialiseCacheStore(raw) {
	const store = createEmptyCacheStore();
	if (!raw || typeof raw !== 'object') return store;

	const logger = _getCacheLogger();
	let loaded = 0;
	let evicted = 0;

	for (const [group, maps] of Object.entries(CACHE_STRUCTURE)) {
		const rawGroup = raw[group];
		if (!rawGroup || typeof rawGroup !== 'object') continue;
		for (const name of maps) {
			const entries = rawGroup[name];
			if (!Array.isArray(entries)) continue;
			const ttl = getTTLForMap(group, name);
			const map = store[group][name];
			for (const pair of entries) {
				if (!Array.isArray(pair) || pair.length < 2) continue;
				const [key, entry] = pair;
				if (!entry || typeof entry !== 'object' || !entry.ts) continue;
				if (isEntryValid(entry.ts, ttl)) {
					map.set(key, entry);
					loaded++;
				} else {
					evicted++;
				}
			}
		}
	}

	logger?.debug('Cache', `Loaded ${loaded} cached entries from persistent store (${evicted} expired entries evicted)`);
	return store;
}

async function saveCacheToPersistentStore() {
	try {
		const data = serialiseCacheStore();
		if (data === null) {
			_getCacheLogger()?.warn('Cache', 'saveToPersistentStore: skipped (cacheStore is null)');
			return;
		}

		if (!hasCacheDbAsyncApi()) {
			_getCacheLogger()?.warn('Cache', 'DB async API not available; cache was not persisted');
			return;
		}

		const json = JSON.stringify(data);
		const savedToDb = await saveCacheJsonToDbAsync(json);
		if (savedToDb) {
			updateCacheMetaFromStore(json.length * 2);
			try {
				window.dispatchEvent(new CustomEvent('matchmonkey:cacheupdated', {
					detail: {
						sizeBytes: json.length * 2,
						lastSavedTs: Date.now(),
					}
				}));
			} catch (_) {
				// non-fatal
			}
			_getCacheLogger()?.debug('Cache', 'Saved cache to database');
		}
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to save cache: ${e}`);
	}
}

async function loadCacheFromPersistentStore() {
	try {
		if (!hasCacheDbAsyncApi()) {
			_getCacheLogger()?.warn('Cache', 'DB async API not available; starting with empty cache');
			cacheStore = createEmptyCacheStore();
			updateCacheMetaFromStore(0);
			return;
		}

		let raw = await loadCacheJsonFromDbAsync();
		let persistedJsonLength = 0;

		if (raw && typeof raw === 'object') {
			try {
				persistedJsonLength = JSON.stringify(raw).length;
			} catch (_) {
				persistedJsonLength = 0;
			}
		}

		cacheStore = deserialiseCacheStore(raw);
		updateCacheMetaFromStore(persistedJsonLength * 2);
		_getCacheLogger()?.debug('Cache', `Load completed (fromDb=${!!raw}, size=${persistedJsonLength})`);
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to load cache: ${e}`);
		cacheStore = createEmptyCacheStore();
		updateCacheMetaFromStore(0);
	}
}

// =========================================================================
// LIFECYCLE
// =========================================================================

/**
 * Initialise the cache for a discovery run.
 * Loads persisted data (evicting expired entries) if available,
 * otherwise creates an empty store.
 */
async function initCache() {
	if (cacheStore) return; // already active
	await loadCacheFromPersistentStore();
}

/**
 * Save the current cache to the persistent store.
 * Called at the end of a discovery run so new entries survive restarts.
 */
function saveCache() {
	return saveCacheToPersistentStore();
}

/**
 * Wipe all caches from memory AND the persistent store.
 * Used by the "Clear Cache" button in options.
 */
function clearCache() {
	console.trace('Match Monkey: clearCache() called — see stack trace for caller');
	if (cacheStore) {
		for (const group of Object.values(cacheStore)) {
			for (const map of Object.values(group)) {
				map?.clear?.();
			}
		}
	}
	// Keep an empty (non-null) store so initCache()'s "if (cacheStore) return" guard
	// prevents reloading stale DB data before the async delete completes.
	// This mirrors clearMissedResults() which sets missedStore = [] for the same reason.
	cacheStore = createEmptyCacheStore();

	if (hasCacheDbAsyncApi()) {
		clearCacheDbAsync().catch(e => {
			_getCacheLogger()?.warn('Cache', `Failed to clear DB cache row: ${e}`);
		});
	}

	saveCacheMeta(createEmptyCacheMeta());
	try {
		window.dispatchEvent(new CustomEvent('matchmonkey:cacheupdated', {
			detail: {
				sizeBytes: 0,
				lastSavedTs: Date.now(),
			}
		}));
	} catch (_) {
		// non-fatal
	}
	_getCacheLogger()?.debug('Cache', 'Persistent cache cleared');
}

/**
 * Check if caching is currently active.
 * @returns {boolean} True if cache is initialized.
 */
function isCacheActive() {
	return cacheStore !== null;
}

/**
 * Get lightweight metadata about persisted cache payload.
 * This avoids loading large cache JSON solely for UI summaries.
 * @returns {object}
 */
function getCachePersistentMeta() {
	const meta = loadCacheMeta();
	if (!meta || typeof meta !== 'object') return createEmptyCacheMeta();
	return {
		storage: String(meta.storage || 'db'),
		sizeBytes: Number(meta.sizeBytes) || 0,
		lastSavedTs: Number(meta.lastSavedTs) || 0,
		counts: {
			...createEmptyCacheCounts(),
			...(meta.counts || {}),
		},
	};
}

// =========================================================================
// GENERIC ENTRY HELPERS
// =========================================================================

/**
 * Get data from a cache map, respecting TTL.
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @param {string} key       Cache key.
 * @returns {*|undefined}    Cached data, or undefined if missing/expired.
 */
function getCacheEntry(groupName, mapName, key) {
	const map = cacheStore?.[groupName]?.[mapName];
	if (!map || !map.has(key)) return undefined;
	const entry = map.get(key);
	if (!entry || !isEntryValid(entry.ts, getTTLForMap(groupName, mapName))) {
		map.delete(key);
		return undefined;
	}
	return entry.data;
}

/**
 * Store data in a cache map with a timestamp.
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @param {string} key       Cache key.
 * @param {*}      data      Data to cache.
 */
function setCacheEntry(groupName, mapName, key, data) {
	const map = cacheStore?.[groupName]?.[mapName];
	if (!map) return;
	map.set(key, { data, ts: Date.now() });
}

/**
 * Remove a specific entry from a cache map.
 * Use when an API call returns an error for a previously-cached item,
 * so the next attempt will re-fetch from the API.
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @param {string} key       Cache key to remove.
 */
function removeCacheEntry(groupName, mapName, key) {
	const map = cacheStore?.[groupName]?.[mapName];
	if (!map) return;
	if (map.delete(key)) {
		_getCacheLogger()?.debug('Cache', `INVALIDATE: ${groupName}.${mapName} key="${key}"`);
	}
}

// =========================================================================
// LAST.FM CACHE ACCESSORS
// =========================================================================

/**
 * Get a specific Last.fm cache Map by name.
 * Returns a wrapper that transparently handles timestamped entries,
 * so callers can use has()/get()/set() without knowing about { data, ts }.
 * @param {string} mapName - One of: 'similarArtists', 'topTracks', 'similarTracks', 'artistInfo'
 * @returns {object|null} Map-like wrapper, or null if cache is not active
 */
function getLastfmMap(mapName) {
	if (!cacheStore?.lastfm?.[mapName]) return null;
	return createCacheMapWrapper('lastfm', mapName);
}

/**
 * Get cached similar artists list, or null if not cached.
 * @param {string} artistName Artist name.
 * @returns {object[]|null} Cached artists array [{name, match}], or null.
 */
function getCachedSimilarArtists(artistName) {
	if (!cacheStore?.lastfm?.similarArtists) return null;
	const key = cacheKeyArtist(artistName);
	const cached = getCacheEntry('lastfm', 'similarArtists', key);
	if (cached === undefined) return null;
	_getCacheLogger()?.debug('Cache', `HIT: Similar artists for "${artistName}" (${cached.length} artists)`);
	return cached;
}

/**
 * Cache a similar artists response.
 * @param {string} artistName Artist name.
 * @param {object[]} artists Array of similar artist objects [{name, match}].
 */
function cacheSimilarArtists(artistName, artists) {
	if (!cacheStore?.lastfm?.similarArtists) return;
	const key = cacheKeyArtist(artistName);
	setCacheEntry('lastfm', 'similarArtists', key, artists || []);
	_getCacheLogger()?.debug('Cache', `STORE: Similar artists for "${artistName}" (${(artists || []).length} artists)`);
}

/**
 * Get cached top tracks list, or null if not cached.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {(string|object)[]|null} Cached tracks array, or null.
 */
function getCachedTopTracks(artistName, limit, withPlaycount = false) {
	if (!cacheStore?.lastfm?.topTracks) return null;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	const cached = getCacheEntry('lastfm', 'topTracks', key);
	if (cached === undefined) return null;
	_getCacheLogger()?.debug('Cache', `HIT: Top tracks for "${artistName}" limit=${limit} withPlaycount=${withPlaycount} (${cached.length} tracks)`);
	return cached;
}

/**
 * Cache a top tracks response.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @param {(string|object)[]} tracks Array of track titles or objects.
 */
function cacheTopTracks(artistName, limit, withPlaycount, tracks) {
	if (!cacheStore?.lastfm?.topTracks) return;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	setCacheEntry('lastfm', 'topTracks', key, tracks || []);
	_getCacheLogger()?.debug('Cache', `STORE: Top tracks for "${artistName}" limit=${limit} withPlaycount=${withPlaycount} (${(tracks || []).length} tracks)`);
}

// =========================================================================
// RECCOBEATS CACHE ACCESSORS
// =========================================================================

/**
 * Get a specific ReccoBeats cache Map by name.
 * Returns a wrapper that transparently handles timestamped entries.
 * @param {string} mapName - One of: 'lookups', 'audioFeatures', 'recommendations'
 * @returns {object|null} Map-like wrapper, or null if cache is not active
 */
function getReccobeatsMap(mapName) {
	if (!cacheStore?.reccobeats?.[mapName]) return null;
	return createCacheMapWrapper('reccobeats', mapName);
}

/**
 * Create a Map-like wrapper that transparently handles { data, ts } entries.
 * Callers can use has(key), get(key), set(key, value), delete(key).
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @returns {object} Wrapper with has, get, set, delete methods.
 */
function createCacheMapWrapper(groupName, mapName) {
	return {
		has(key) {
			return getCacheEntry(groupName, mapName, key) !== undefined;
		},
		get(key) {
			return getCacheEntry(groupName, mapName, key);
		},
		set(key, value) {
			setCacheEntry(groupName, mapName, key, value);
		},
		delete(key) {
			removeCacheEntry(groupName, mapName, key);
		},
	};
}

// =========================================================================
// STATISTICS
// =========================================================================

/**
 * Get cache statistics for debugging.
 * @returns {object} Cache statistics with entry counts per category
 */
function getCacheStats() {
	if (!cacheStore) return { active: false };
	return {
		active: true,
		lastfm: {
			similarArtists: cacheStore.lastfm.similarArtists?.size || 0,
			topTracks: cacheStore.lastfm.topTracks?.size || 0,
			similarTracks: cacheStore.lastfm.similarTracks?.size || 0,
			artistInfo: cacheStore.lastfm.artistInfo?.size || 0,
			tagArtists: cacheStore.lastfm.tagArtists?.size || 0,
		},
		reccobeats: {
			lookups: cacheStore.reccobeats.lookups?.size || 0,
			audioFeatures: cacheStore.reccobeats.audioFeatures?.size || 0,
			recommendations: cacheStore.reccobeats.recommendations?.size || 0,
		}
	};
}

/**
 * Get detailed cache statistics including ReccoBeats lookup breakdown by type.
 * Iterates the live lookups Map and classifies entries by key prefix.
 * @returns {object} Detailed cache statistics
 */
function getDetailedStats() {
	if (!cacheStore) return { active: false };
	const stats = {
		active: true,
		lastfm: {
			similarArtists: cacheStore.lastfm.similarArtists?.size || 0,
			topTracks: cacheStore.lastfm.topTracks?.size || 0,
			similarTracks: cacheStore.lastfm.similarTracks?.size || 0,
			artistInfo: cacheStore.lastfm.artistInfo?.size || 0,
			tagArtists: cacheStore.lastfm.tagArtists?.size || 0,
		},
		reccobeats: {
			artistLookups: 0,
			albumLookups: 0,
			trackLookups: 0,
			audioFeatures: cacheStore.reccobeats.audioFeatures?.size || 0,
			recommendations: cacheStore.reccobeats.recommendations?.size || 0,
		}
	};
	const lookupsMap = cacheStore.reccobeats.lookups;
	if (lookupsMap) {
		for (const key of lookupsMap.keys()) {
			const k = String(key).toUpperCase();
			if (k.startsWith('TRACKID:')) stats.reccobeats.trackLookups++;
			else if (k.startsWith('ALBUMID:') || k.startsWith('ALBUM:') || k.startsWith('ARTISTALBUMS:') || k.startsWith('ALBUMTRACKS:')) stats.reccobeats.albumLookups++;
			else if (k.startsWith('ARTISTALL:')) stats.reccobeats.artistLookups++;
		}
	}
	return stats;
}

// Export to window namespace
window.matchMonkeyCache = {
	initCache,
	saveCache,
	clearCache,
	isCacheActive,
	getCacheStats,
	getDetailedStats,
	getCachePersistentMeta,
	getCachedSimilarArtists,
	cacheSimilarArtists,
	getCachedTopTracks,
	cacheTopTracks,
	getLastfmMap,
	getReccobeatsMap,
	removeCacheEntry,
};

// Export cache key functions globally for other modules
window.cacheKeyArtist = cacheKeyArtist;
window.cacheKeyTopTracks = cacheKeyTopTracks;
