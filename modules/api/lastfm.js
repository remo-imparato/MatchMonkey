/**
 * Last.fm API Query Functions
 * 
 * Fetches similar artists and top tracks from Last.fm API.
 * Works with per-run cache to avoid redundant API calls within a single operation.
 * 

 */

'use strict';

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
				console.log(`fetchSimilarArtists: Cache hit for artist="${artistName}" (${cached.length} artists)`);
				return cached;
			}
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			console.error('fetchSimilarArtists: No API key available');
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
		console.log(`fetchSimilarArtists: Searching Last.fm for artist="${artistName}", limit=${lim || 'default'}`);
		console.log(`fetchSimilarArtists: GET ${url}`);
		updateProgress(`Last.fm: Finding artists similar to "${artistName}"...`, undefined);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);

		if (!res || !res.ok) {
			console.warn(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for artist="${artistName}"`);
			updateProgress(`Last.fm: Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`, undefined);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn(`fetchSimilarArtists: Invalid JSON response for artist="${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${artistName}"`, undefined);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn(`fetchSimilarArtists: API Error ${data.error} for artist="${artistName}" - ${data.message || 'Unknown error'}`);
			
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
		
		console.log(`fetchSimilarArtists: SUCCESS - Retrieved ${asArr.length} similar artists for artist="${artistName}"`);
		if (asArr.length > 0) {
			console.log(`fetchSimilarArtists: Top 5 results:`, asArr.slice(0, 5).map(a => a.name).join(', '));
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
		console.error(`fetchSimilarArtists: Exception for artist="${artistName}":`, e.toString());
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
	try {
		if (!artistName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Check cache first
		if (cache?.getCachedTopTracks) {
			const cached = cache.getCachedTopTracks(artistName, limit, includePlaycount);
			if (cached !== null) {
				console.log(`fetchTopTracks: Cache hit for artist="${artistName}" (${cached.length} tracks, limit=${limit}, includePlaycount=${includePlaycount})`);
				return cached;
			}
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			console.error('fetchTopTracks: No API key available');
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
		console.log(`fetchTopTracks: Fetching tracks ${purpose} for artist="${artistName}", limit=${lim || 'default'}, includePlaycount=${includePlaycount}`);
		console.log(`fetchTopTracks: GET ${url}`);
		updateProgress(`Last.fm: Fetching top tracks ${purpose} for "${artistName}"...`, undefined);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.warn(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for artist="${artistName}"`);
			updateProgress(`Last.fm: Failed to fetch tracks for "${artistName}" (HTTP ${res?.status})`, undefined);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn(`fetchTopTracks: Invalid JSON response for artist="${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${artistName}"`, undefined);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn(`fetchTopTracks: API Error ${data.error} for artist="${artistName}" - ${data.message || 'Unknown error'}`);
			
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

		console.log(`fetchTopTracks: SUCCESS - Retrieved ${rows.length} tracks for artist="${artistName}" (${purpose})`);
		if (rows.length > 0) {
			const topTracks = includePlaycount 
				? rows.slice(0, 5).map(t => `${t.title} (plays: ${t.playcount})`).join(', ')
				: rows.slice(0, 5).join(', ');
			console.log(`fetchTopTracks: Top 5 tracks: ${topTracks}`);
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
		console.error(`fetchTopTracks: Exception for artist="${artistName}":`, e.toString());
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
	try {
		if (!artistName || !trackName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Build cache key
		const cacheKey = `track:${artistName}|${trackName}|${limit}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._similarTracks?.has?.(cacheKey)) {
			const cached = cache._similarTracks.get(cacheKey) || [];
			console.log(`fetchSimilarTracks: Cache hit for artist="${artistName}", track="${trackName}" (${cached.length} tracks)`);
			return cached;
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			console.error('fetchSimilarTracks: No API key available');
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
		console.log(`fetchSimilarTracks: Searching for similar tracks - artist="${artistName}", track="${trackName}", limit=${lim || 'default'}`);
		console.log(`fetchSimilarTracks: GET ${url}`);
		updateProgress(`Last.fm: Finding tracks similar to "${artistName} - ${trackName}"...`, undefined);

		// Make HTTP request
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.warn(`fetchSimilarTracks: HTTP ${res?.status} for artist="${artistName}", track="${trackName}"`);
			updateProgress(`Last.fm: Failed to find similar tracks (HTTP ${res?.status})`, undefined);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn(`fetchSimilarTracks: Invalid JSON response for artist="${artistName}", track="${trackName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing response for "${trackName}"`, undefined);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn(`fetchSimilarTracks: API Error ${data.error} for artist="${artistName}", track="${trackName}" - ${data.message || 'Unknown error'}`);
			
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

		console.log(`fetchSimilarTracks: SUCCESS - Found ${results.length} similar tracks for artist="${artistName}", track="${trackName}"`);
		if (results.length > 0) {
			console.log(`fetchSimilarTracks: Top 5 results:`, results.slice(0, 5).map(t => `${t.artist} - ${t.title} (match: ${t.match.toFixed(3)})`).join(', '));
		}
		
		if (results.length === 0) {
			updateProgress(`Last.fm: No similar tracks found for "${trackName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${results.length} similar tracks for "${trackName}"`, undefined);
		}

		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._similarTracks) cache._similarTracks = new Map();
			cache._similarTracks.set(cacheKey, results);
		}

		return results;

	} catch (e) {
		console.error(`fetchSimilarTracks: Exception for artist="${artistName}", track="${trackName}":`, e.toString());
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
	try {
		if (!artistName) return null;

		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Build cache key
		const cacheKey = `artistinfo:${artistName}`.toUpperCase();

		// Check cache
		if (cache?.isActive?.() && cache._artistInfo?.has?.(cacheKey)) {
			const cached = cache._artistInfo.get(cacheKey);
			console.log(`fetchArtistInfo: Cache hit for artist="${artistName}"`);
			return cached;
		}

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			console.error('fetchArtistInfo: No API key available');
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
		console.log(`fetchArtistInfo: Getting genre tags for artist="${artistName}"`);
		console.log(`fetchArtistInfo: GET ${url}`);
		updateProgress(`Last.fm: Getting genre tags for "${artistName}"...`, undefined);

		const res = await fetch(url);
		if (!res || !res.ok) {
			console.warn(`fetchArtistInfo: HTTP ${res?.status} for artist="${artistName}"`);
			updateProgress(`Last.fm: Failed to get artist info (HTTP ${res?.status})`, undefined);
			return null;
		}

		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn(`fetchArtistInfo: Invalid JSON response for artist="${artistName}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing artist info for "${artistName}"`, undefined);
			return null;
		}

		if (data?.error) {
			console.warn(`fetchArtistInfo: API Error ${data.error} for artist="${artistName}" - ${data.message || 'Unknown error'}`);
			
			if (data.error === 6) {
				updateProgress(`Last.fm: Artist "${artistName}" not found - cannot retrieve genre tags`, undefined);
			} else {
				updateProgress(`Last.fm: Error getting artist info: ${data.message || 'Unknown error'}`, undefined);
			}
			
			return null;
		}

		const artist = data?.artist;
		if (!artist) {
			console.log(`fetchArtistInfo: No artist data in response for artist="${artistName}"`);
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

		console.log(`fetchArtistInfo: SUCCESS - Retrieved artist info for artist="${artistName}" (${result.tags.length} tags)`);
		if (result.tags.length > 0) {
			console.log(`fetchArtistInfo: Tags: ${result.tags.join(', ')}`);
		}
		
		if (result.tags.length === 0) {
			updateProgress(`Last.fm: No genre tags found for "${artistName}"`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${result.tags.length} genre tags for "${artistName}"`, undefined);
		}

		// Cache result
		if (cache?.isActive?.()) {
			if (!cache._artistInfo) cache._artistInfo = new Map();
			cache._artistInfo.set(cacheKey, result);
		}

		return result;

	} catch (e) {
		console.error(`fetchArtistInfo: Exception for artist="${artistName}":`, e.toString());
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
	try {
		if (!tag) return [];

		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Get API key
		const apiKey = getApiKey();
		if (!apiKey) {
			console.error('fetchArtistsByTag: No API key available');
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
		console.log(`fetchArtistsByTag: Searching for artists in tag="${tag}", limit=${limit}`);
		console.log(`fetchArtistsByTag: GET ${url}`);
		updateProgress(`Last.fm: Searching for artists in "${tag}" genre...`, undefined);

		const res = await fetch(url);
		if (!res || !res.ok) {
			console.warn(`fetchArtistsByTag: HTTP ${res?.status} for tag="${tag}"`);
			updateProgress(`Last.fm: Failed to search "${tag}" genre (HTTP ${res?.status})`, undefined);
			return [];
		}

		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn(`fetchArtistsByTag: Invalid JSON response for tag="${tag}": ${e.toString()}`);
			updateProgress(`Last.fm: Error parsing results for "${tag}" genre`, undefined);
			return [];
		}

		if (data?.error) {
			console.warn(`fetchArtistsByTag: API Error ${data.error} for tag="${tag}" - ${data.message || 'Unknown error'}`);
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

		console.log(`fetchArtistsByTag: SUCCESS - Found ${results.length} artists for tag="${tag}"`);
		if (results.length > 0) {
			console.log(`fetchArtistsByTag: Top 5 artists: ${results.slice(0, 5).map(a => `${a.name} (${a.listeners.toLocaleString()} listeners)`).join(', ')}`);
		}
		
		if (results.length === 0) {
			updateProgress(`Last.fm: No artists found in "${tag}" genre`, undefined);
		} else {
			updateProgress(`Last.fm: Found ${results.length} artists in "${tag}" genre`, undefined);
		}

		return results;

	} catch (e) {
		console.error(`fetchArtistsByTag: Exception for tag="${tag}":`, e.toString());
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
