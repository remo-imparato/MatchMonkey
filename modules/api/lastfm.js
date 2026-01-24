/**
 * Last.fm API Query Functions
 * 
 * Fetches similar artists and top tracks from Last.fm API.
 * Works with per-run cache to avoid redundant API calls within a single operation.
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

// Last.fm API base endpoint
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

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
		const getApiKey = window.similarArtistsLastfm?.getApiKey;
		const updateProgress = window.similarArtistsNotifications?.updateProgress || (() => {});
		const cacheKeyArtist = window.cacheKeyArtist || ((name) => String(name || '').trim().toUpperCase());

		// Check cache first
		if (cache?.getCachedSimilarArtists) {
			const cached = cache.getCachedSimilarArtists(artistName);
			if (cached !== null) {
				console.log(`fetchSimilarArtists: Using cached results for "${artistName}"`);
				return cached;
			}
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
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
		updateProgress(`Querying Last.fm API: getSimilar for "${artistName}"...`);
		console.log('fetchSimilarArtists: querying ' + url);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);

		if (!res || !res.ok) {
			console.log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('fetchSimilarArtists: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('fetchSimilarArtists: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Extract and normalize results
		const artists = data?.similarartists?.artist || [];
		let asArr = Array.isArray(artists) ? artists : (artists ? [artists] : []);
		
		console.log(`fetchSimilarArtists: Retrieved ${asArr.length} similar artists for "${artistName}"`);
		
		// Cache results for subsequent calls in this run
		cache?.cacheSimilarArtists?.(artistName, asArr);
		
		return asArr;

	} catch (e) {
		console.error('fetchSimilarArtists error: ' + e.toString());
		window.similarArtistsNotifications?.updateProgress?.(`Error fetching similar artists: ${e.toString()}`);
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
		const getApiKey = window.similarArtistsLastfm?.getApiKey;
		const updateProgress = window.similarArtistsNotifications?.updateProgress || (() => {});
		const cacheKeyTopTracks = window.cacheKeyTopTracks || ((name, lim, pc) => 
			`${String(name || '').trim().toUpperCase()}|${Number(lim) || ''}|pc:${pc ? 1 : 0}`);

		// Check cache first
		if (cache?.getCachedTopTracks) {
			const cached = cache.getCachedTopTracks(artistName, limit, includePlaycount);
			if (cached !== null) {
				console.log(`fetchTopTracks: Using cached results for "${artistName}" (limit: ${limit})`);
				return cached;
			}
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
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
		const purpose = (lim >= 100) ? 'for ranking' : 'for collection';
		updateProgress(`Querying Last.fm: getTopTracks ${purpose} for "${artistName}" (limit: ${lim || 'default'})...`);
		console.log(`fetchTopTracks: querying ${url} (${purpose})`);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch top tracks for "${artistName}" (HTTP ${res?.status})`);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('fetchTopTracks: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('fetchTopTracks: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
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

		console.log(`fetchTopTracks: Retrieved ${rows.length} top tracks for "${artistName}" (${purpose})`);
		
		// Slice to requested limit and cache
		const out = typeof lim === 'number' ? rows.slice(0, lim) : rows;
		cache?.cacheTopTracks?.(artistName, limit, includePlaycount, out);
		
		return out;

	} catch (e) {
		console.error('fetchTopTracks error: ' + e.toString());
		window.similarArtistsNotifications?.updateProgress?.(`Error fetching top tracks: ${e.toString()}`);
		window.lastfmCache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
		return [];
	}
}

// Export to window namespace for MM5
window.similarArtistsLastfmAPI = {
	fetchSimilarArtists,
	fetchTopTracks,
	API_BASE,
};
