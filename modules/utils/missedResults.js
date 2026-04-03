/**
 * MatchMonkey Missed Results Tracker
 * 
 * Tracks recommendations from Last.fm and ReccoBeats that were not found in the local library.
 * Results persist across runs and can be viewed, copied, or cleared by the user.
 * 
 * Popularity is normalized to 0-100 scale:
 * - ReccoBeats: Uses native popularity (0-100)
 * - Last.fm: Converts playcount using logarithmic scale
 * 
 * @author Remo Imparato
 */

'use strict';

// Get logger reference
const _getMissedLogger = () => window.matchMonkeyLogger;

const STORAGE_KEY = 'MatchMonkey_MissedResults';
const MAX_RESULTS = 50000; // Maximum number of missed results to store

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
 * Initialize the missed results storage
 */
function init() {
	const logger = _getMissedLogger();
	try {
		// Get current value
		const current = app.getValue(STORAGE_KEY, []);

		// If null, undefined, or not an array, initialize with empty array
		if (!current || !Array.isArray(current)) {
			app.setValue(STORAGE_KEY, []);
			logger?.debug('MissedResults', 'Initialized with empty array');
		} else {
			logger?.debug('MissedResults', `Initialized with ${current.length} existing results`);
		}
	} catch (e) {
		logger?.error('MissedResults', 'Initialization error: ' + e.toString());
		// Try to set empty array as fallback
		try {
			app.setValue(STORAGE_KEY, []);
		} catch (e2) {
			logger?.error('MissedResults', 'Failed to initialize storage: ' + e2.toString());
		}
	}
}

/**
 * Get all missed results (always returns an array)
 * 
 * @returns {Array} Array of missed results
 */
function getAll() {
	const logger = _getMissedLogger();
	try {
		const results = app.getValue(STORAGE_KEY, []);

		// Ensure we always return an array
		if (!results) {
			return [];
		}

		if (!Array.isArray(results)) {
			logger?.warn('MissedResults', 'Storage contained non-array, returning empty array');
			return [];
		}

		return results;
	} catch (e) {
		logger?.error('MissedResults', 'Error getting results: ' + e.toString());
		return [];
	}
}

/**
 * Get statistics about missed results
 * 
 * @returns {object} Statistics {total, uniqueArtists, totalOccurrences, avgPopularity}
 */
function getStats() {
	const logger = _getMissedLogger();
	try {
		const results = getAll();

		const stats = {
			total: results.length,
			uniqueArtists: new Set(results.map(r => r.artist)).size,
			totalOccurrences: results.reduce((sum, r) => sum + (r.occurrences || 1), 0),
			avgPopularity: results.length > 0
				? Math.round(results.reduce((sum, r) => sum + (r.popularity || 0), 0) / results.length)
				: 0
		};

		return stats;
	} catch (e) {
		logger?.error('MissedResults', 'Error getting stats: ' + e.toString());
		return { total: 0, uniqueArtists: 0, totalOccurrences: 0, avgPopularity: 0 };
	}
}

/**
 * Add a missed result
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {string} album - Album name (optional)
 * @param {number} popularity - Popularity score 0-100 (normalized)
 * @param {object} additionalInfo - Optional additional information (source, playcount, etc.)
 */
function add(artist, title, album = '', popularity = 0, additionalInfo = {}) {
	const logger = _getMissedLogger();
	// Validate inputs
	if (!artist || !title) {
		logger?.warn('MissedResults', 'Cannot add result without artist and title');
		return;
	}

	// Sanitize inputs to prevent storage corruption
	try {
		artist = String(artist).trim();
		title = String(title).trim();
		album = album ? String(album).trim() : '';
		popularity = isNaN(popularity) ? 0 : Math.max(0, Math.min(100, Number(popularity)));
		additionalInfo = (typeof additionalInfo === 'object' && additionalInfo !== null) ? additionalInfo : {};
	} catch (e) {
		logger?.error('MissedResults', 'Error sanitizing inputs: ' + e.toString());
		return;
	}

	if (!artist || !title) {
		logger?.warn('MissedResults', 'Cannot add result - artist or title empty after sanitization');
		return;
	}

	try {
		const results = getAll(); // Use getAll() which always returns an array

		// Check for duplicates using canonical cleaners for robust matching
		// This prevents duplicates caused by punctuation/casing/prefix variants
		const cleanArtist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
			? matchMonkeyHelpers.cleanArtistName(artist).toUpperCase()
			: artist.toUpperCase();
		const cleanTitle = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
			? matchMonkeyHelpers.cleanTrackName(title).toUpperCase()
			: title.toUpperCase();

		// Pre-compute cleaned values for efficient comparison
		const cleanedResults = results.map(r => ({
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
			// Update existing entry - increment occurrences and update popularity if higher
			results[existingIndex].occurrences = (results[existingIndex].occurrences || 1) + 1;

			// Update popularity if the new value is higher
			if (popularity > (results[existingIndex].popularity || 0)) {
				results[existingIndex].popularity = popularity;
			}

			// Merge additional info
			results[existingIndex].additionalInfo = {
				...(results[existingIndex].additionalInfo || {}),
				...additionalInfo
			};

			//console.log(`MatchMonkey Missed Results: Updated existing - ${artist} - ${title} (occurrences: ${results[existingIndex].occurrences}, popularity: ${popularity}%)`);
		} else {
			// Create new result object
			const result = {
				artist,
				title,
				popularity: popularity || 0,
				occurrences: 1,
				additionalInfo: additionalInfo || {}
			};

			// Add to beginning of array (most recent first)
			results.unshift(result);

			//console.log(`MatchMonkey Missed Results: Added new - ${artist} - ${title} (popularity: ${popularity}%)`);
		}

		// Limit size
		if (results.length > MAX_RESULTS) {
			results.length = MAX_RESULTS;
		}

		// Save
		app.setValue(STORAGE_KEY, results);

		// Dispatch event for UI updates
		try {
			const event = new CustomEvent('matchmonkey:missedresultadded', {
				detail: { artist, title, album, popularity }
			});
			window.dispatchEvent(event);
		} catch (e) {
			// Event dispatch not critical
		}

	} catch (e) {
		logger?.error('MissedResults', 'Error adding result: ' + e.toString());
	}
}

/**
 * Add multiple missed results
 * 
 * @param {Array} results - Array of result objects with {artist, title, album, popularity, additionalInfo}
 */
function addBatch(results) {
	const logger = _getMissedLogger();
	if (!Array.isArray(results) || results.length === 0) {
		return;
	}

	logger?.debug('MissedResults', `Adding batch of ${results.length} results`);

	let successCount = 0;
	let errorCount = 0;

	results.forEach((result, index) => {
		try {
			// Validate result object
			if (!result || typeof result !== 'object') {
				logger?.warn('MissedResults', `Invalid result at index ${index} - not an object`);
				errorCount++;
				return;
			}

			if (!result.artist || !result.title) {
				logger?.warn('MissedResults', `Invalid result at index ${index} - missing artist or title`);
				errorCount++;
				return;
			}

			add(
				result.artist,
				result.title,
				result.album || '',
				result.popularity || 0,
				result.additionalInfo || {}
			);
			successCount++;
		} catch (e) {
			logger?.error('MissedResults', `Error adding result at index ${index}: ${e}`);
			errorCount++;
		}
	});

	if (errorCount > 0) {
		logger?.warn('MissedResults', `Batch complete - ${successCount} succeeded, ${errorCount} failed`);
	} else {
		logger?.info('MissedResults', `Batch complete - ${successCount} results added`);
	}

	// Log final storage size after batch
	try {
		const allResults = getAll();
		const jsonSize = JSON.stringify(allResults).length;
		const sizeKB = (jsonSize / 1024).toFixed(2);
		const sizeMB = (jsonSize / (1024 * 1024)).toFixed(2);
		if (jsonSize > 1024 * 1024) {
			logger?.debug('MissedResults', `Total storage size: ${sizeMB} MB (${allResults.length} results)`);
		} else {
			logger?.debug('MissedResults', `Total storage size: ${sizeKB} KB (${allResults.length} results)`);
		}
	} catch (e) {
		// Size monitoring not critical
	}
}

/**
 * Get missed results by artist
 * 
 * @param {string} artist - Artist name
 * @returns {Array} Filtered results
 */
function getByArtist(artist) {
	const logger = _getMissedLogger();
	try {
		const results = getAll();
		return results.filter(r => r.artist === artist);
	} catch (e) {
		logger?.error('MissedResults', 'Error filtering by artist: ' + e.toString());
		return [];
	}
}

/**
 * Clear all missed results
 */
function clear() {
	const logger = _getMissedLogger();
	try {
		logger?.info('MissedResults', 'Clearing all results');
		app.setValue(STORAGE_KEY, []);

		// Dispatch event
		try {
			const event = new CustomEvent('matchmonkey:missedresultscleared');
			window.dispatchEvent(event);
		} catch (e) {
			// Event dispatch not critical
		}
	} catch (e) {
		logger?.error('MissedResults', 'Error clearing: ' + e.toString());
	}
}

// Export to window namespace
window.matchMonkeyMissedResults = {
	init,
	getAll,
	getStats,
	add,
	addBatch,
	getByArtist,
	clear,
	STORAGE_KEY,
	MAX_RESULTS,
};
