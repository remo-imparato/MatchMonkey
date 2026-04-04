/**
 * MatchMonkey API Response Cache
 * 
 * Persistent cache for Last.fm and ReccoBeats API responses.
 * Survives MediaMonkey restarts via app.setValue / app.getValue.
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
 *   use the user-configurable CacheTTLHours (default 24h).
 * - reccobeats.lookups uses CacheTTLHours * 7 because IDs rarely change
 *   and lookups are expensive (many paginated API calls).
 * 
 * Only essential fields are stored in each cache entry to minimize memory.
 * API responses are trimmed to the fields actually consumed downstream.
 * 
 * @author Remo Imparato
 */

'use strict';

const CACHE_STORAGE_KEY = 'MatchMonkeyCache';

// Get logger reference
const _getCacheLogger = () => window.matchMonkeyLogger;

/**
 * In-memory cache store. Each leaf value is a Map whose entries are
 * { data: <value>, ts: <epoch ms> }.
 * Null when the cache has not been initialised yet.
 */
let cacheStore = null;

/**
 * Map category names that receive a longer TTL.
 * Everything else uses the standard TTL.
 */
const LONG_TTL_MAPS = new Set(['lookups']);

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
		const configured = window.matchMonkeyStorage.getSetting('CacheTTLHours', 24);
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
	const base = getStandardTTL();
	if (groupName === 'reccobeats' && LONG_TTL_MAPS.has(mapName)) {
		return base * 7; // lookups survive 7x longer
	}
	return base;
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
	lastfm: ['similarArtists', 'topTracks', 'similarTracks', 'artistInfo'],
	reccobeats: ['lookups', 'audioFeatures', 'recommendations'],
};

/**
 * Create an empty cache store with fresh Maps.
 * @returns {object} Empty cache store.
 */
function createEmptyStore() {
	const store = {};
	for (const [group, maps] of Object.entries(CACHE_STRUCTURE)) {
		store[group] = {};
		for (const name of maps) {
			store[group][name] = new Map();
		}
	}
	return store;
}

/**
 * Serialise the in-memory cache to a plain object suitable for
 * app.setValue.  Maps are converted to arrays of [key, entry] pairs.
 * @returns {object|null}
 */
function serialiseStore() {
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

/**
 * Deserialise a plain object (from app.getValue) into Maps,
 * evicting any entries whose timestamp has expired.
 * @param {object} raw  Plain object previously written by serialiseStore.
 * @returns {object} Cache store with Maps.
 */
function deserialiseStore(raw) {
	const store = createEmptyStore();
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

/**
 * Save the in-memory cache to the persistent store.
 */
function saveToPersistentStore() {
	if (typeof app === 'undefined' || !app.setValue) return;
	try {
		const data = serialiseStore();
		app.setValue(CACHE_STORAGE_KEY, data);
		_getCacheLogger()?.debug('Cache', 'Saved cache to persistent store');
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to save cache: ${e}`);
	}
}

/**
 * Load the cache from the persistent store into memory.
 * Evicts expired entries during load.
 */
function loadFromPersistentStore() {
	if (typeof app === 'undefined' || !app.getValue) {
		cacheStore = createEmptyStore();
		return;
	}
	try {
		const raw = app.getValue(CACHE_STORAGE_KEY, null);
		cacheStore = deserialiseStore(raw);
	} catch (e) {
		_getCacheLogger()?.warn('Cache', `Failed to load cache: ${e}`);
		cacheStore = createEmptyStore();
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
function initCache() {
	if (cacheStore) return; // already active
	loadFromPersistentStore();
}

/**
 * Save the current cache to the persistent store.
 * Called at the end of a discovery run so new entries survive restarts.
 */
function saveCache() {
	saveToPersistentStore();
}

/**
 * Wipe all caches from memory AND the persistent store.
 * Used by the "Clear Cache" button in options.
 */
function clearCache() {
	if (cacheStore) {
		for (const group of Object.values(cacheStore)) {
			for (const map of Object.values(group)) {
				map?.clear?.();
			}
		}
	}
	cacheStore = null;
	// Also wipe persistent copy
	if (typeof app !== 'undefined' && app.setValue) {
		try {
			app.setValue(CACHE_STORAGE_KEY, null);
		} catch (e) {
			_getCacheLogger()?.warn('Cache', `Failed to clear persistent cache: ${e}`);
		}
	}
}

/**
 * Check if caching is currently active.
 * @returns {boolean} True if cache is initialized.
 */
function isCacheActive() {
	return cacheStore !== null;
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
function getEntry(groupName, mapName, key) {
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
function setEntry(groupName, mapName, key, data) {
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
function removeEntry(groupName, mapName, key) {
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
	return _createMapWrapper('lastfm', mapName);
}

/**
 * Get cached similar artists list, or null if not cached.
 * @param {string} artistName Artist name.
 * @returns {object[]|null} Cached artists array [{name, match}], or null.
 */
function getCachedSimilarArtists(artistName) {
	if (!cacheStore?.lastfm?.similarArtists) return null;
	const key = cacheKeyArtist(artistName);
	const cached = getEntry('lastfm', 'similarArtists', key);
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
	setEntry('lastfm', 'similarArtists', key, artists || []);
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
	const cached = getEntry('lastfm', 'topTracks', key);
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
	setEntry('lastfm', 'topTracks', key, tracks || []);
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
	return _createMapWrapper('reccobeats', mapName);
}

// =========================================================================
// MAP WRAPPER
// =========================================================================

/**
 * Create a Map-like wrapper that transparently handles { data, ts } entries.
 * Callers can use has(key), get(key), set(key, value), delete(key).
 * @param {string} groupName 'lastfm' or 'reccobeats'
 * @param {string} mapName   Map name within the group.
 * @returns {object} Wrapper with has, get, set, delete methods.
 */
function _createMapWrapper(groupName, mapName) {
	return {
		has(key) {
			return getEntry(groupName, mapName, key) !== undefined;
		},
		get(key) {
			return getEntry(groupName, mapName, key);
		},
		set(key, value) {
			setEntry(groupName, mapName, key, value);
		},
		delete(key) {
			removeEntry(groupName, mapName, key);
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
		},
		reccobeats: {
			lookups: cacheStore.reccobeats.lookups?.size || 0,
			audioFeatures: cacheStore.reccobeats.audioFeatures?.size || 0,
			recommendations: cacheStore.reccobeats.recommendations?.size || 0,
		}
	};
}

// Export to window namespace
window.matchMonkeyCache = {
	init: initCache,
	save: saveCache,
	clear: clearCache,
	isActive: isCacheActive,
	getStats: getCacheStats,
	getCachedSimilarArtists,
	cacheSimilarArtists,
	getCachedTopTracks,
	cacheTopTracks,
	getLastfmMap,
	getReccobeatsMap,
	removeEntry,
};

// Export cache key functions globally for other modules
window.cacheKeyArtist = cacheKeyArtist;
window.cacheKeyTopTracks = cacheKeyTopTracks;
