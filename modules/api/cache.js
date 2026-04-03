/**
 * Last.fm API Response Caching
 * 
 * Per-run caches for Last.fm queries (cleared on each runMatchMonkey invocation).
 * Reduces redundant API calls within a single operation.
 * 

 */

'use strict';

// Get logger reference
const _getCacheLogger = () => window.matchMonkeyLogger;

/**
 * Per-run cache structure containing:
 * - similarArtists: Map<string, object[]>
 * - topTracks: Map<string, (string|object)[]>
 * - similarTracks: Map<string, object[]> (for track.getSimilar)
 * - artistInfo: Map<string, object> (for artist.getInfo)
 * - reccobeats: Map<string, object[]> (for ReccoBeats API)
 */
let lastfmRunCache = null;

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

/**
 * Initialize the Last.fm per-run cache.
 * Call at the start of each runMatchMonkey operation.
 */
function initLastfmRunCache() {
	lastfmRunCache = {
		similarArtists: new Map(),
		topTracks: new Map(),
		similarTracks: new Map(),
		artistInfo: new Map(),
		reccobeats: new Map(),
	};
}

/**
 * Clear the Last.fm per-run cache.
 * Call at the end of runMatchMonkey operation.
 */
function clearLastfmRunCache() {
	// Clear each Map before nullifying to free memory
	if (lastfmRunCache) {
		lastfmRunCache.similarArtists?.clear();
		lastfmRunCache.topTracks?.clear();
		lastfmRunCache.similarTracks?.clear();
		lastfmRunCache.artistInfo?.clear();
		lastfmRunCache.reccobeats?.clear();
	}
	lastfmRunCache = null;
}

/**
 * Get a cached similar artists list, or null if not cached.
 * @param {string} artistName Artist name.
 * @returns {object[]|null} Cached artists array, or null if not cached.
 */
function getCachedSimilarArtists(artistName) {
	if (!lastfmRunCache?.similarArtists) return null;
	const key = cacheKeyArtist(artistName);
	const cached = lastfmRunCache.similarArtists.has(key) 
		? lastfmRunCache.similarArtists.get(key) 
		: null;

	if (cached !== null) {
		const logger = _getCacheLogger();
		logger?.debug('Cache', `HIT: Similar artists for "${artistName}" (${cached.length} artists)`);
	}

	return cached;
}

/**
 * Cache a similar artists response.
 * @param {string} artistName Artist name.
 * @param {object[]} artists Array of similar artist objects.
 */
function cacheSimilarArtists(artistName, artists) {
	if (!lastfmRunCache?.similarArtists) return;
	const key = cacheKeyArtist(artistName);
	lastfmRunCache.similarArtists.set(key, artists || []);
	const logger = _getCacheLogger();
	logger?.debug('Cache', `STORE: Similar artists for "${artistName}" (${(artists || []).length} artists)`);
}

/**
 * Get a cached top tracks list, or null if not cached.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {(string|object)[]|null} Cached tracks array, or null if not cached.
 */
function getCachedTopTracks(artistName, limit, withPlaycount = false) {
	if (!lastfmRunCache?.topTracks) return null;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	const cached = lastfmRunCache.topTracks.has(key) 
		? lastfmRunCache.topTracks.get(key) 
		: null;

	if (cached !== null) {
		const logger = _getCacheLogger();
		logger?.debug('Cache', `HIT: Top tracks for "${artistName}" limit=${limit} withPlaycount=${withPlaycount} (${cached.length} tracks)`);
	}

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
	if (!lastfmRunCache?.topTracks) return;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	lastfmRunCache.topTracks.set(key, tracks || []);
	const logger = _getCacheLogger();
	logger?.debug('Cache', `STORE: Top tracks for "${artistName}" limit=${limit} withPlaycount=${withPlaycount} (${(tracks || []).length} tracks)`);
}

/**
 * Check if caching is currently active.
 * @returns {boolean} True if Last.fm run cache is initialized.
 */
function isCacheActive() {
	return lastfmRunCache !== null;
}

/**
 * Get cache statistics for debugging.
 * @returns {object} Cache statistics
 */
function getCacheStats() {
	if (!lastfmRunCache) return { active: false };
	return {
		active: true,
		similarArtists: lastfmRunCache.similarArtists?.size || 0,
		topTracks: lastfmRunCache.topTracks?.size || 0,
		similarTracks: lastfmRunCache.similarTracks?.size || 0,
		artistInfo: lastfmRunCache.artistInfo?.size || 0,
		reccobeats: lastfmRunCache.reccobeats?.size || 0,
	};
}

// Export to window namespace for MM5
window.lastfmCache = {
	init: initLastfmRunCache,
	clear: clearLastfmRunCache,
	getCachedSimilarArtists,
	cacheSimilarArtists,
	getCachedTopTracks,
	cacheTopTracks,
	isActive: isCacheActive,
	getStats: getCacheStats,
};

// Also export cache key functions globally for other modules
window.cacheKeyArtist = cacheKeyArtist;
window.cacheKeyTopTracks = cacheKeyTopTracks;
