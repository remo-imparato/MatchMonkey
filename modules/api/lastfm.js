/**
 * Last.fm API Query Functions
 * 
 * Fetches similar artists and top tracks from Last.fm API.
 * Works with per-run cache to avoid redundant API calls within a single operation.
 * 

 */

'use strict';

// Get logger reference
const _getLastfmLogger = () => window.matchMonkeyLogger;

// Last.fm API base endpoint
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

// MatchMonkey's dedicated Last.fm API key
// Each application should have its own key per Last.fm's terms of service
const MATCHMONKEY_API_KEY = '7fd988db0c4e9d8b12aed27d0a91a932';

/**
 * Get the API key for Last.fm requests.
 * Uses MatchMonkey's dedicated API key.
 * 
 * @returns {string} The Last.fm API key
 */
function getApiKey() {
	return MATCHMONKEY_API_KEY;
}

/**
 * Centralized HTTP fetch for all Last.fm API requests.
 * Logs every outgoing URL at debug level, mirroring reccobeats.js rateLimitedFetch.
 * 
 * @param {string} url - Full request URL
 * @returns {Promise<Response>} Fetch response
 */
async function lastfmFetch(url) {
	const logger = _getLastfmLogger();
	logger?.debug('Last.fm', `API GET ${url}`);
	return fetch(url);
}

/**
 * Fetch similar artists from Last.fm API.
 * Results are cached within the current run to avoid redundant API calls.
 * 
 * @param {string} artistName Main artist name to find similar artists for.
 * @param {number} limit Maximum number of similar artists to return (optional).
 * @returns {Promise<object[]>} Array of similar artist objects from Last.fm.
 *                              Returns empty array on error.
 */
async function fetchSimilarArtists(artistName, limit) {
	try {
		if (!artistName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Check cache first
		if (cache?.getCachedSimilarArtists) {
			const cached = cache.getCachedSimilarArtists(artistName);
			if (cached !== null) {
				const logger = _getLastfmLogger();
				logger?.debug('Last.fm', `Cache hit for artist="${artistName}" (${cached.length} artists)`);
				return cached;
			}
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			const logger = _getLastfmLogger();
			logger?.error('Last.fm', 'No API key available');
			updateProgress('Last.fm: API key not configured - contact developer', undefined);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Build API request
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getSimilar',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim) params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		const logger = _getLastfmLogger();
		logger?.debug('Last.fm', `Searching for artist="${artistName}", limit=${lim || 'default'}`);
		updateProgress(`Last.fm: Finding artists similar to "${artistName}"...`, undefined);

		// Make HTTP request using native fetch (MM5)
		const res = await lastfmFetch(url);

		if (!res || !res.ok) {
			logger?.warn('Last.fm', `HTTP ${res?.status} ${res?.statusText} for artist="${artistName}"`);
			updateProgress(`Last.fm: Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`, undefined);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			logger?.warn('Last.fm', `Invalid JSON response for artist="${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${artistName}"`, undefined);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			logger?.warn('Last.fm', `API Error ${data.error} for artist="${artistName}" - ${data.message || 'Unknown error'}`);

			// Provide helpful error messages
			if (data.error === 6) {
				updateProgress(`Last.fm: Artist "${artistName}" not found - try different spelling or check artist name`, undefined);
			} else {
				updateProgress(`Last.fm: Error for "${artistName}": ${data.message || 'Unknown error'}`, undefined);
			}

			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Extract and normalize results
		const artists = data?.similarartists?.artist || [];
		let asArr = Array.isArray(artists) ? artists : (artists ? [artists] : []);

		logger?.debug('Last.fm', `SUCCESS - Retrieved ${asArr.length} similar artists for artist="${artistName}"`);
		if (asArr.length > 0) {
			logger?.debug('Last.fm', `Top 5 results: ${asArr.slice(0, 5).map(a => a.name).join(', ')}`);
		}

		if (asArr.length === 0) {
			updateProgress(`Last.fm: No similar artists found for "${artistName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${asArr.length} similar artists for "${artistName}"`, undefined);
		}

		// Cache results for subsequent calls in this run
		cache?.cacheSimilarArtists?.(artistName, asArr);

		return asArr;

	} catch (e) {
		const logger = _getLastfmLogger();
		logger?.error('Last.fm', `Exception for artist="${artistName}": ${e.toString()}`);
		window.matchMonkeyNotifications?.updateProgress?.(`Last.fm: Error fetching similar artists for "${artistName}"`, undefined);
		window.lastfmCache?.cacheSimilarArtists?.(artistName, []);
		return [];
	}
}

/**
 * Fetch top tracks for an artist from Last.fm API.
 * Results are cached within the current run to avoid redundant API calls.
 * 
 * @param {string} artistName Artist name to fetch top tracks for.
 * @param {number} limit Maximum number of tracks to return (optional).
 * @param {boolean} includePlaycount Whether to include playcount data (default: false).
 * @returns {Promise<(string|object)[]>} Array of track titles or track objects with playcount.
 */
async function fetchTopTracks(artistName, limit, includePlaycount = false) {
	const logger = _getLastfmLogger();
	try {
		if (!artistName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Check cache first
		if (cache?.getCachedTopTracks) {
			const cached = cache.getCachedTopTracks(artistName, limit, includePlaycount);
			if (cached !== null) {
				logger?.debug('Last.fm', `Cache hit for top tracks: "${artistName}" (${cached.length} tracks)`);
				return cached;
			}
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			logger?.error('Last.fm', 'No API key available for fetchTopTracks');
			updateProgress('Last.fm: API key not configured - contact developer', undefined);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Build API request
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getTopTracks',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim) params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		const purpose = (lim >= 100) ? 'for ranking' : 'for discovery';
		logger?.debug('Last.fm', `Fetching top tracks ${purpose} for "${artistName}", limit=${lim || 'default'}`);
		updateProgress(`Last.fm: Fetching top tracks ${purpose} for "${artistName}"...`, undefined);

		// Make HTTP request using native fetch (MM5)
		const res = await lastfmFetch(url);
		if (!res || !res.ok) {
			logger?.warn('Last.fm', `HTTP ${res?.status} ${res?.statusText} for top tracks: "${artistName}"`);
			updateProgress(`Last.fm: Failed to fetch tracks for "${artistName}" (HTTP ${res?.status})`, undefined);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			logger?.warn('Last.fm', `Invalid JSON response for top tracks: "${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${artistName}"`, undefined);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			logger?.warn('Last.fm', `API Error ${data.error} for top tracks: "${artistName}" - ${data.message || 'Unknown error'}`);
			
			// Provide helpful error messages
			if (data.error === 6) {
				updateProgress(`Last.fm: Artist "${artistName}" not found - verify artist name spelling`, undefined);
			} else {
				updateProgress(`Last.fm: Error fetching tracks for "${artistName}": ${data.message || 'Unknown error'}`, undefined);
			}
			
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Extract and normalize results
		let tracks = data?.toptracks?.track || [];
		if (tracks && !Array.isArray(tracks)) tracks = [tracks];
		
		const rows = [];
		for (const t of tracks) {
			if (!t) continue;
			const title = t.name || t.title;
			if (!title) continue;
			
			if (includePlaycount) {
				const pc = Number(t.playcount) || 0;
				const rank = Number(t['@attr']?.rank) || 0;
				rows.push({ title, playcount: pc, rank });
			} else {
				rows.push(title);
			}
		}

		logger?.debug('Last.fm', `Retrieved ${rows.length} tracks for "${artistName}" (${purpose})`);
		if (rows.length > 0) {
			const topTracks = includePlaycount 
				? rows.slice(0, 5).map(t => `${t.title} (plays: ${t.playcount})`).join(', ')
				: rows.slice(0, 5).join(', ');
			logger?.debug('Last.fm', `Top 5 tracks: ${topTracks}`);
		}
		
		// Slice to requested limit and cache
		const out = typeof lim === 'number' ? rows.slice(0, lim) : rows;
		
		if (out.length === 0) {
			updateProgress(`Last.fm: No tracks found for "${artistName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Retrieved ${out.length} tracks for "${artistName}"`, undefined);
		}
		
		cache?.cacheTopTracks?.(artistName, limit, includePlaycount, out);
		
		return out;

	} catch (e) {
		logger?.error('Last.fm', `Exception fetching top tracks for "${artistName}": ${e.toString()}`);
		window.matchMonkeyNotifications?.updateProgress?.(`Last.fm: Error fetching tracks for "${artistName}"`, undefined);
		window.lastfmCache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
		return [];
	}
}

/**
 * Fetch similar tracks from Last.fm API using track.getSimilar.
 * This finds tracks that are musically similar to a given track,
 * which can discover tracks across different artists.
 * 
 * @param {string} artistName Artist name of the seed track.
 * @param {string} trackName Track title of the seed track.
 * @param {number} [limit=100] Maximum number of similar tracks to return (increased for better library matching).
 * @returns {Promise<object[]>} Array of similar track objects with artist and title.
 */
async function fetchSimilarTracks(artistName, trackName, limit = 100) {
	const logger = _getLastfmLogger();
	try {
		if (!artistName || !trackName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Build cache key
		const cacheKey = `track:${artistName}|${trackName}|${limit}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache.similarTracks?.has?.(cacheKey)) {
			const cached = cache.similarTracks.get(cacheKey) || [];
			logger?.debug('Last.fm', `Cache hit for similar tracks: "${artistName} - ${trackName}" (${cached.length} tracks)`);
			return cached;
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			logger?.error('Last.fm', 'No API key available for fetchSimilarTracks');
			updateProgress('Last.fm: API key not configured - contact developer', undefined);
			return [];
		}

		// Build API request
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'track.getSimilar',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			track: trackName,
			autocorrect: '1'
		});
		if (lim) params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		logger?.debug('Last.fm', `Searching for similar tracks: "${artistName} - ${trackName}", limit=${lim || 'default'}`);
		updateProgress(`Last.fm: Finding tracks similar to "${artistName} - ${trackName}"...`, undefined);

		// Make HTTP request
		const res = await lastfmFetch(url);
		if (!res || !res.ok) {
			logger?.warn('Last.fm', `HTTP ${res?.status} for similar tracks: "${artistName} - ${trackName}"`);
			updateProgress(`Last.fm: Failed to find similar tracks (HTTP ${res?.status})`, undefined);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			logger?.warn('Last.fm', `Invalid JSON for similar tracks: "${artistName} - ${trackName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${trackName}"`, undefined);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			logger?.warn('Last.fm', `API Error ${data.error} for similar tracks: "${artistName} - ${trackName}" - ${data.message || 'Unknown error'}`);
			
			// Provide helpful error messages
			if (data.error === 6) {
				updateProgress(`Last.fm: Track "${trackName}" by "${artistName}" not found - verify artist and track names`, undefined);
			} else {
				updateProgress(`Last.fm: Error finding similar tracks: ${data.message || 'Unknown error'}`, undefined);
			}
			
			return [];
		}

		// Extract results
		let tracks = data?.similartracks?.track || [];
		if (tracks && !Array.isArray(tracks)) tracks = [tracks];

		const results = [];
		for (const t of tracks) {
			if (!t) continue;
			const title = t.name || t.title;
			const artist = t.artist?.name || t.artist;
			if (!title || !artist) continue;

			results.push({
				title,
				artist,
				match: Number(t.match) || 0,
				playcount: Number(t.playcount) || 0,
				url: t.url || ''
			});
		}

		logger?.debug('Last.fm', `Found ${results.length} similar tracks for "${artistName} - ${trackName}"`);
		if (results.length > 0) {
			logger?.debug('Last.fm', `Top 5: ${results.slice(0, 5).map(t => `${t.artist} - ${t.title} (match: ${t.match.toFixed(3)})`).join(', ')}`);
		}
		
		if (results.length === 0) {
			updateProgress(`Last.fm: No similar tracks found for "${trackName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${results.length} similar tracks for "${trackName}"`, undefined);
		}

		// Cache results
		if (cache?.isActive?.()) {
			if (!cache.similarTracks) cache.similarTracks = new Map();
			cache.similarTracks.set(cacheKey, results);
		}

		return results;

	} catch (e) {
		logger?.error('Last.fm', `Exception for similar tracks "${artistName} - ${trackName}": ${e.toString()}`);
		window.matchMonkeyNotifications?.updateProgress?.(`Last.fm: Error finding similar tracks for "${trackName}"`, undefined);
		return [];
	}
}

/**
 * Fetch artist info including tags/genres from Last.fm.
 * Useful for genre-based discovery.
 * 
 * @param {string} artistName Artist name to get info for.
 * @returns {Promise<object|null>} Artist info object with tags, or null on error.
 */
async function fetchArtistInfo(artistName) {
	const logger = _getLastfmLogger();
	try {
		if (!artistName) return null;

		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Build cache key
		const cacheKey = `artistinfo:${artistName}`.toUpperCase();

		// Check cache
		if (cache?.isActive?.() && cache.artistInfo?.has?.(cacheKey)) {
			const cached = cache.artistInfo.get(cacheKey);
			logger?.debug('Last.fm', `Cache hit for artist info: "${artistName}"`);
			return cached;
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			logger?.error('Last.fm', 'No API key available for fetchArtistInfo');
			updateProgress('Last.fm: API key not configured - contact developer', undefined);
			return null;
		}

		// Build API request
		const params = new URLSearchParams({
			method: 'artist.getInfo',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});

		const url = API_BASE + '?' + params.toString();
		logger?.debug('Last.fm', `Getting artist info for "${artistName}"`);
		updateProgress(`Last.fm: Getting genre tags for "${artistName}"...`, undefined);

		const res = await lastfmFetch(url);
		if (!res || !res.ok) {
			logger?.warn('Last.fm', `HTTP ${res?.status} for artist info: "${artistName}"`);
			updateProgress(`Last.fm: Failed to get artist info (HTTP ${res?.status})`, undefined);
			return null;
		}

		let data;
		try {
			data = await res.json();
		} catch (e) {
			logger?.warn('Last.fm', `Invalid JSON for artist info: "${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing artist info for "${artistName}"`, undefined);
			return null;
		}

		if (data?.error) {
			logger?.warn('Last.fm', `API Error ${data.error} for artist info: "${artistName}" - ${data.message || 'Unknown error'}`);
			
			if (data.error === 6) {
				updateProgress(`Last.fm: Artist "${artistName}" not found - cannot retrieve genre tags`, undefined);
			} else {
				updateProgress(`Last.fm: Error getting artist info: ${data.message || 'Unknown error'}`, undefined);
			}
			
			return null;
		}

		const artist = data?.artist;
		if (!artist) {
			logger?.debug('Last.fm', `No artist data in response for "${artistName}"`);
			updateProgress(`Last.fm: No artist info available for "${artistName}"`, undefined);
			return null;
		}

		// Extract tags (genres)
		const tags = artist.tags?.tag || [];
		const tagList = Array.isArray(tags) ? tags : (tags ? [tags] : []);

		const result = {
			name: artist.name || artistName,
			tags: tagList.map(t => t.name || t).filter(Boolean),
			listeners: Number(artist.stats?.listeners) || 0,
			playcount: Number(artist.stats?.playcount) || 0,
			similar: (artist.similar?.artist || []).map(a => a.name || a).filter(Boolean),
			bio: artist.bio?.summary || ''
		};

		logger?.debug('Last.fm', `Retrieved artist info for "${artistName}" (${result.tags.length} tags)`);
		if (result.tags.length > 0) {
			logger?.debug('Last.fm', `Tags: ${result.tags.join(', ')}`);
		}
		
		if (result.tags.length === 0) {
			updateProgress(`Last.fm: No genre tags found for "${artistName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${result.tags.length} genre tags for "${artistName}"`, undefined);
		}

		// Cache result
		if (cache?.isActive?.()) {
			if (!cache.artistInfo) cache.artistInfo = new Map();
			cache.artistInfo.set(cacheKey, result);
		}

		return result;

	} catch (e) {
		logger?.error('Last.fm', `Exception for artist info "${artistName}": ${e.toString()}`);
		window.matchMonkeyNotifications?.updateProgress?.(`Last.fm: Error getting artist info`, undefined);
		return null;
	}
}

/**
 * Search for artists by tag/genre from Last.fm.
 * 
 * @param {string} tag Genre/tag to search for.
 * @param {number} [limit=30] Maximum artists to return.
 * @returns {Promise<object[]>} Array of artist objects.
 */
async function fetchArtistsByTag(tag, limit = 30) {
	const logger = _getLastfmLogger();
	try {
		if (!tag) return [];

		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			logger?.error('Last.fm', 'No API key available for fetchArtistsByTag');
			updateProgress('Last.fm: API key not configured - contact developer', undefined);
			return [];
		}

		const params = new URLSearchParams({
			method: 'tag.getTopArtists',
			api_key: apiKey,
			format: 'json',
			tag: tag,
			limit: String(limit)
		});

		const url = API_BASE + '?' + params.toString();
		logger?.debug('Last.fm', `Searching for artists in tag="${tag}", limit=${limit}`);
		updateProgress(`Last.fm: Searching for artists in "${tag}" genre...`, undefined);

		const res = await lastfmFetch(url);
		if (!res || !res.ok) {
			logger?.warn('Last.fm', `HTTP ${res?.status} for tag="${tag}"`);
			updateProgress(`Last.fm: Failed to search "${tag}" genre (HTTP ${res?.status})`, undefined);
			return [];
		}

		let data;
		try {
			data = await res.json();
		} catch (e) {
			logger?.warn('Last.fm', `Invalid JSON for tag="${tag}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing results for "${tag}" genre`, undefined);
			return [];
		}

		if (data?.error) {
			logger?.warn('Last.fm', `API Error ${data.error} for tag="${tag}" - ${data.message || 'Unknown error'}`);
			updateProgress(`Last.fm: Error searching "${tag}" genre: ${data.message || 'Unknown error'}`, undefined);
			return [];
		}

		let artists = data?.topartists?.artist || [];
		if (!Array.isArray(artists)) artists = artists ? [artists] : [];

		const results = artists.map(a => ({
			name: a.name,
			url: a.url || '',
			listeners: Number(a.listeners) || 0
		})).filter(a => a.name);

		logger?.debug('Last.fm', `Found ${results.length} artists for tag="${tag}"`);
		if (results.length > 0) {
			logger?.debug('Last.fm', `Top 5 artists: ${results.slice(0, 5).map(a => `${a.name} (${a.listeners.toLocaleString()} listeners)`).join(', ')}`);
		}
		
		if (results.length === 0) {
			updateProgress(`Last.fm: No artists found in "${tag}" genre`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${results.length} artists in "${tag}" genre`, undefined);
		}

		return results;

	} catch (e) {
		logger?.error('Last.fm', `Exception for tag="${tag}": ${e.toString()}`);
		window.matchMonkeyNotifications?.updateProgress?.(`Last.fm: Error searching genre`, undefined);
		return [];
	}
}

// Export to window namespace for MM5
window.matchMonkeyLastfmAPI = {
	fetchSimilarArtists,
	fetchTopTracks,
	fetchSimilarTracks,
	fetchArtistInfo,
	fetchArtistsByTag,
	getApiKey,
	API_BASE,
	MATCHMONKEY_API_KEY,
};
