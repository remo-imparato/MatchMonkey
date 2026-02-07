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

const STORAGE_KEY = 'MatchMonkey_MissedResults';
const MAX_RESULTS = 10000; // Maximum number of missed results to store

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
	try {
		// Get current value
		const current = app.getValue(STORAGE_KEY, []);

		// If null, undefined, or not an array, initialize with empty array
		if (!current || !Array.isArray(current)) {
			app.setValue(STORAGE_KEY, []);
			console.log('MatchMonkey Missed Results: Initialized with empty array');
		} else {
			console.log(`MatchMonkey Missed Results: Initialized with ${current.length} existing results`);
		}
	} catch (e) {
		console.error('MatchMonkey Missed Results: Initialization error:', e);
		// Try to set empty array as fallback
		try {
			app.setValue(STORAGE_KEY, []);
		} catch (e2) {
			console.error('MatchMonkey Missed Results: Failed to initialize storage:', e2);
		}
	}
}

/**
 * Get all missed results (always returns an array)
 * 
 * @returns {Array} Array of missed results
 */
function getAll() {
	try {
		const results = app.getValue(STORAGE_KEY, []);

		// Ensure we always return an array
		if (!results) {
			return [];
		}

		if (!Array.isArray(results)) {
			console.warn('MatchMonkey Missed Results: Storage contained non-array, returning empty array');
			return [];
		}

		return results;
	} catch (e) {
		console.error('MatchMonkey Missed Results: Error getting results:', e);
		return [];
	}
}

/**
 * Get statistics about missed results
 * 
 * @returns {object} Statistics {total, uniqueArtists, totalOccurrences, avgPopularity}
 */
function getStats() {
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
		console.error('MatchMonkey Missed Results: Error getting stats:', e);
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
	if (!artist || !title) {
		console.warn('MatchMonkey Missed Results: Cannot add result without artist and title');
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

		const existingIndex = results.findIndex(r => {
			const rCleanArtist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
				? matchMonkeyHelpers.cleanArtistName(r.artist).toUpperCase()
				: r.artist.toUpperCase();
			const rCleanTitle = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
				? matchMonkeyHelpers.cleanTrackName(r.title).toUpperCase()
				: r.title.toUpperCase();
			return rCleanArtist === cleanArtist && rCleanTitle === cleanTitle;
		});

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
			
			console.log(`MatchMonkey Missed Results: Updated existing - ${artist} - ${title} (occurrences: ${results[existingIndex].occurrences}, popularity: ${popularity}%)`);
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

			console.log(`MatchMonkey Missed Results: Added new - ${artist} - ${title} (popularity: ${popularity}%)`);
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
		console.error('MatchMonkey Missed Results: Error adding result:', e);
	}
}

/**
 * Add multiple missed results
 * 
 * @param {Array} results - Array of result objects with {artist, title, album, popularity, additionalInfo}
 */
function addBatch(results) {
	if (!Array.isArray(results) || results.length === 0) {
		return;
	}

	console.log(`MatchMonkey Missed Results: Adding batch of ${results.length} results`);

	results.forEach(result => {
		add(
			result.artist,
			result.title,
			result.album,
			result.popularity,
			result.additionalInfo
		);
	});
}

/**
 * Get missed results by artist
 * 
 * @param {string} artist - Artist name
 * @returns {Array} Filtered results
 */
function getByArtist(artist) {
	try {
		const results = getAll();
		return results.filter(r => r.artist === artist);
	} catch (e) {
		console.error('MatchMonkey Missed Results: Error filtering by artist:', e);
		return [];
	}
}

/**
 * Clear all missed results
 */
function clear() {
	try {
		console.log('MatchMonkey Missed Results: Clearing all results');
		app.setValue(STORAGE_KEY, []);
		
		// Dispatch event
		try {
			const event = new CustomEvent('matchmonkey:missedresultscleared');
			window.dispatchEvent(event);
		} catch (e) {
			// Event dispatch not critical
		}
	} catch (e) {
		console.error('MatchMonkey Missed Results: Error clearing:', e);
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
	getStats,
	clear,
	STORAGE_KEY,
	MAX_RESULTS,
};
