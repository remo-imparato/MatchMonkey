/**````````javascript
/**
 * ReccoBeats API Integration Module
 * 
 * Fetches music recommendations using the ReccoBeats API.
 * 
 * Two main workflows:
 * 1. Seed-based (Similar Recco): Select tracks -> Find on ReccoBeats -> Get audio features -> Get recommendations
 * 2. Mood/Activity-based: Use predefined audio targets -> Get recommendations
 * 
 * API Workflow:
 * - Album Search: /v1/album/search -> Find albums by name
 * - Track Lookup: /v1/album/:id/track -> Get tracks from album  
 * - Audio Features: /v1/track/:id/audio-features -> Get audio characteristics
 * - Recommendations: /v1/track/recommendation -> Get similar tracks
 * 
 * Caching Strategy:
 * - Per-session cache stored in matchMonkeyCache.reccobeats Maps
 * - Cache keys include all query parameters to avoid stale results
 * - Cache is cleared when matchMonkeyCache.clear() is called at end of each run
 * 
 * Rate Limiting:
 * - Respects 429 Too Many Requests responses with exponential backoff
 * - Default delay between requests to avoid hitting rate limits
 * 
 * 
 * 
 * @author Remo Imparato
 * 
 */

'use strict';

// Get logger reference
const _getReccoLogger = () => window.matchMonkeyLogger;

// =============================================================================
// CONFIGURATION
// =============================================================================

/** ReccoBeats API base endpoint */
const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

/** Default timeout for API requests (milliseconds) */
const API_TIMEOUT_MS = 30000;

/** Default delay between requests (ms) */
const RATE_LIMIT_DELAY_MS = 200;

/** Initial backoff on 429 (ms) */
const RATE_LIMIT_BACKOFF_MS = 2000;

/** Max retries on rate limit */
const RATE_LIMIT_MAX_RETRIES = 3;

/** ReccoBeats API key */
const RECCOBEATS_API_KEY = 'c0bb1370-6d44-4e9d-8c25-64c3b09cc0b1';

/** Track last request time for rate limiting */
let lastRequestTime = 0;
/** Next available time slot – ensures 200ms spacing even with concurrent callers */
let nextAllowedTime = 0;

// =============================================================================
// AUDIO FEATURE DEFINITIONS
// =============================================================================

/**
 * Audio feature names supported by ReccoBeats recommendation API.
 * Values are typically 0.0-1.0 scale (except tempo which is BPM, loudness is dB).
 */
const AUDIO_FEATURE_NAMES = [
	'acousticness', 'danceability', 'energy', 'instrumentalness',
	'liveness', 'loudness', 'mode', 'speechiness', 'tempo', 'valence'
];


// =============================================================================
// HELPER FUNCTIONS - Rate Limiting & HTTP
// =============================================================================

/**
 * Normalize a string for comparison (lowercase, remove special chars).
 * @param {string} s - String to normalize
 * @returns {string} Normalized string
 */
function normalize(s) {
	return String(s || '').normalize('NFC').toLowerCase().replace(/[\s\-\_\(\)\[\]\.\'\"]+/g, '').trim();
}

/**
 * Enforce rate limiting delay between requests.
 */
async function enforceRateLimit() {
	const now = Date.now();
	// Claim the next available slot atomically — safe for concurrent callers
	const slot = Math.max(now, nextAllowedTime);
	nextAllowedTime = slot + RATE_LIMIT_DELAY_MS;
	const delay = slot - now;
	if (delay > 0) {
		await new Promise(resolve => setTimeout(resolve, delay));
	}
	lastRequestTime = Date.now();
}

/**
 * Create standard headers for ReccoBeats API requests.
 * @returns {Headers} Configured headers object
 */
function createHeaders() {
	const headers = new Headers();
	headers.append('Accept', 'application/json');
	headers.append('x-api-key', RECCOBEATS_API_KEY);
	return headers;
}

/**
 * Make a rate-limited request with 429 retry handling.
 * 
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Response>} Fetch response
 */
async function rateLimitedFetch(url, options = {}, retryCount = 0) {
	const logger = _getReccoLogger();
	await enforceRateLimit();

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		logger?.debug('ReccoBeats', `API ${options.method || 'GET'} ${url}`);
		const res = await fetch(url, { ...options, signal: controller.signal });

		// Handle rate limiting (429)
		if (res.status === 429) {
			if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
				logger?.error('ReccoBeats', `Rate limit exceeded after ${RATE_LIMIT_MAX_RETRIES} retries`);
				return res;
			}

			const retryAfter = res.headers.get('Retry-After');
			const backoffMs = retryAfter
				? parseInt(retryAfter, 10) * 1000
				: RATE_LIMIT_BACKOFF_MS * Math.pow(2, retryCount);

			logger?.warn('ReccoBeats', `Rate limited (429), waiting ${backoffMs}ms before retry ${retryCount + 1}/${RATE_LIMIT_MAX_RETRIES}`);

			// Update progress to inform user
			const updateProgress = getUpdateProgress();
			updateProgress(`Rate limited, waiting ${Math.ceil(backoffMs / 1000)}s...`, undefined);

			await new Promise(resolve => setTimeout(resolve, backoffMs));

			return rateLimitedFetch(url, options, retryCount + 1);
		}

		if (!res.ok) {
			logger?.warn('ReccoBeats', `HTTP ${res.status} ${res.statusText} for ${url}`);
		}

		return res;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Get the per-session cache Map for a specific ReccoBeats data type.
 * @param {string} mapName - One of: 'lookups', 'audioFeatures', 'recommendations'
 * @returns {Map|null} Cache map or null if not active
 */
function getCache(mapName) {
	const cache = window.matchMonkeyCache;
	if (!cache?.isActive?.()) return null;
	return cache.getReccobeatsMap(mapName);
}

/**
 * Get progress update function.
 * @returns {Function} Update progress function
 */
function getUpdateProgress() {
	return window.matchMonkeyNotifications?.updateProgress || (() => { });
}

// =============================================================================
// ARTIST SEARCH API
// =============================================================================

/**
 * Search for an artist by name using ReccoBeats API.
 * Returns the first matching artist (for backward compatibility).
 * 
 * NOTE: If you need to handle multiple artists with the same name,
 * use searchArtistAll() instead.
 * 
 * @param {string} artistName - Artist name to search for
 * @returns {Promise<object|null>} Artist object with id, name or null if not found
 */
async function searchArtist(artistName) {
	const allMatches = await searchArtistAll(artistName);
	return allMatches.length > 0 ? allMatches[0] : null;
}

/**
 * Search for all artists matching the given name.
 * Returns ALL matching artists (handles cases like multiple "Blue October" bands).
 * 
 * @param {string} artistName - Artist name to search for
 * @returns {Promise<object[]>} Array of artist objects with id, name
 */
async function searchArtistAll(artistName) {
	const logger = _getReccoLogger();
	if (!artistName) {
		logger?.warn('ReccoBeats', 'searchArtistAll: No artist name provided');
		return [];
	}

	const cache = getCache('lookups');
	const cacheKey = `artistall:${artistName}`.toUpperCase();
	const updateProgress = getUpdateProgress();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		logger?.debug('ReccoBeats', `searchArtistAll: Cache hit for "${artistName}" (${cached?.length || 0} matches)`);
		return cached || [];
	}

	const normalizedSearch = normalize(artistName);
	logger?.debug('ReccoBeats', `searchArtistAll: Searching for all artists named "${artistName}", normalized="${normalizedSearch}"`);
	updateProgress(`ReccoBeats: Searching for artist "${artistName}"...`, undefined);

	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops
	const allMatches = [];

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/artist/search?searchText=${encodeURIComponent(artistName)}&page=${page}&size=50`;

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				logger?.warn('ReccoBeats', `searchArtistAll: HTTP ${res.status} for artist="${artistName}"`);
				updateProgress(`ReccoBeats: Artist "${artistName}" not found (HTTP ${res.status})`, undefined);
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;

			// Update maxPages from API response
			if (totalPages > maxPages) {
				maxPages = totalPages;
			}

			logger?.debug('ReccoBeats', `searchArtistAll: Page ${page + 1}/${totalPages}, ${content.length} results for artist="${artistName}"`);

			// Collect ALL matches (not just the first one)
			for (const artist of content) {
				if (normalize(artist.name || '') === normalizedSearch) {
					allMatches.push({ id: artist.id, name: artist.name });
				}
			}

			// Move to next page
			page++;
		} catch (e) {
			logger?.error('ReccoBeats', `searchArtistAll: Error for artist="${artistName}": ${e.message}`);
			updateProgress(`ReccoBeats: Error searching for artist "${artistName}"`, undefined);
			break;
		}
	}

	if (allMatches.length === 0) {
		logger?.debug('ReccoBeats', `searchArtistAll: No matches found after ${page} pages - artist="${artistName}"`);
		updateProgress(`ReccoBeats: Artist "${artistName}" not found - ensure artist name matches official spelling`, undefined);
	} else {
		logger?.debug('ReccoBeats', `searchArtistAll: Found ${allMatches.length} artist(s) named "${artistName}"`);
		if (allMatches.length > 1) {
			logger?.debug('ReccoBeats', `searchArtistAll: Multiple artists found with name "${artistName}": ${allMatches.map(a => a.id).join(', ')}`);
		}
		updateProgress(`ReccoBeats: Found ${allMatches.length} artist(s) named "${artistName}"`, undefined);
	}

	// Cache result
	cache?.set(cacheKey, allMatches);
	return allMatches;
}

// =============================================================================
// ALBUM SEARCH API
// =============================================================================

/**
 * Search for albums by name using ReccoBeats album search API.
 * Searches through paginated results to find exact match.
 * 
 * @param {string} albumName - Album name to search for
 * @returns {Promise<object|null>} Album object with id, name, artistName or null if not found
 */
async function searchAlbum(albumName) {
	const logger = _getReccoLogger();
	if (!albumName) {
		logger?.warn('ReccoBeats', 'searchAlbum: No album name provided');
		return null;
	}

	const cache = getCache('lookups');
	const cacheKey = `album:${albumName}`.toUpperCase();
	const updateProgress = getUpdateProgress();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		logger?.debug('ReccoBeats', `searchAlbum: Cache hit for album="${albumName}"`);
		return cached;
	}

	const normalizedSearch = normalize(albumName);
	logger?.debug('ReccoBeats', `searchAlbum: Searching for album="${albumName}"`);
	updateProgress(`ReccoBeats: Searching for album "${albumName}"...`, undefined);

	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/album/search?searchText=${encodeURIComponent(albumName)}&page=${page}&size=50`;

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				logger?.warn('ReccoBeats', `searchAlbum: HTTP ${res.status} for album="${albumName}"`);
				updateProgress(`ReccoBeats: Album "${albumName}" not found (HTTP ${res.status})`, undefined);
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;
			if (totalPages > maxPages)
				maxPages = totalPages;

			logger?.debug('ReccoBeats', `searchAlbum: Page ${page + 1}/${totalPages}, ${content.length} results for album="${albumName}"`);

			// Find exact match (case-insensitive, normalized)
			const match = content.find(a => normalize(a.name || '') === normalizedSearch);

			if (match) {
				const result = {
					id: match.id,
					name: match.name,
					artistName: match.artistName || match.artist?.name || ''
				};

				// Cache result
				cache?.set(cacheKey, result);
				logger?.debug('ReccoBeats', `searchAlbum: Found match "${albumName}" -> "${match.name}" by ${result.artistName} (ID: ${match.id})`);
				updateProgress(`ReccoBeats: Found album "${match.name}"`, undefined);
				return result;
			}

			// Check if we've exhausted all pages
			if (page >= totalPages - 1) {
				logger?.debug('ReccoBeats', `searchAlbum: No exact match after ${totalPages} pages - album="${albumName}"`);
				break;
			}
			if (page > 50) {
				logger?.debug('ReccoBeats', `searchAlbum: Search aborted at ${page} pages - album="${albumName}"`);
				break;
			}

			page++;
		} catch (e) {
			logger?.error('ReccoBeats', `searchAlbum: Error for album="${albumName}": ${e.message}`);
			updateProgress(`ReccoBeats: Error searching for album "${albumName}"`, undefined);
			break;
		}
	}

	// Cache null result to avoid repeated lookups
	logger?.debug('ReccoBeats', `searchAlbum: No match found - album="${albumName}"`);
	updateProgress(`ReccoBeats: Album "${albumName}" not found - ensure album name matches official release`, undefined);
	cache?.set(cacheKey, null);
	return null;
}

// =============================================================================
// ALBUM LOOKUP API
// =============================================================================

/**
 * Find a specific album in an artist by title.
 * 
 * @param {string} artistId - ReccoBeats artist ID
 * @param {string} albumName - Album title to find (optional - if not provided, returns all albums)
 * @returns {Promise<object|object[]|null>} Album object if searching, array if listing all, null if not found
 */
async function findAlbumInArtist(artistId, albumName) {
	const logger = _getReccoLogger();
	if (!artistId) {
		logger?.warn('ReccoBeats', 'findAlbumInArtist: No artist ID provided');
		return albumName ? null : [];
	}

	const cache = getCache('lookups');
	const cacheKey = `artistalbums:${artistId}`.toUpperCase();
	const updateProgress = getUpdateProgress();

	// If no albumName is provided, we can return cached full list
	if (!albumName && cache?.has(cacheKey)) {
		logger?.debug('ReccoBeats', `findAlbumInArtist: Cache hit for artist ID ${artistId}`);
		return cache.get(cacheKey) || [];
	}

	const normalizedSearch = albumName ? normalize(albumName) : null;
	if (albumName) {
		logger?.debug('ReccoBeats', `findAlbumInArtist: Searching artist ${artistId} for album="${albumName}"`);
		updateProgress(`ReccoBeats: Searching artist's albums for "${albumName}"...`, undefined);
	}

	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops
	const size = 50;

	let allAlbums = [];

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/artist/${artistId}/album?page=${page}&size=${size}`;

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				logger?.warn('ReccoBeats', `findAlbumInArtist: HTTP ${res.status} for artist ${artistId}`);
				if (albumName) {
					updateProgress(`ReccoBeats: Error retrieving albums for artist (HTTP ${res.status})`, undefined);
				}
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;

			// Update maxPages from API response
			if (totalPages > maxPages) {
				maxPages = totalPages;
			}

			logger?.debug('ReccoBeats', `findAlbumInArtist: Page ${page + 1}/${totalPages}, ${content.length} albums for artist ${artistId}`);

			// Accumulate albums trimmed to essential fields (for caching)
			for (const a of content) {
				allAlbums.push({ id: a.id, name: a.name });
			}

			// If searching for a specific album, try to match
			if (normalizedSearch) {
				const cleanedNormalized = matchMonkeyHelpers.cleanAlbumName(normalizedSearch);

				for (const a of content) {
					const albumNameRaw = a.name || '';
					const albumNormalized = normalize(albumNameRaw);
					const albumCleaned = matchMonkeyHelpers.cleanAlbumName(albumNormalized);

					if (albumCleaned === cleanedNormalized) {
						const result = { id: a.id, name: a.name };
						logger?.debug('ReccoBeats', `findAlbumInArtist: Found match "${albumName}" -> "${a.name}" (ID: ${a.id})`);
						updateProgress(`ReccoBeats: Found album "${a.name}"`, undefined);
						return result;
					}
				}
			}

			// Move to next page
			page++;
		} catch (e) {
			logger?.error('ReccoBeats', `findAlbumInArtist: Error for artist ${artistId}: ${e.message}`);
			if (albumName) {
				updateProgress(`ReccoBeats: Error searching for album "${albumName}"`, undefined);
			}
			break;
		}
	}

	// Cache full album list when we've retrieved everything
	cache?.set(cacheKey, allAlbums);

	if (normalizedSearch) {
		logger?.debug('ReccoBeats', `findAlbumInArtist: No match after ${page} pages - artist ${artistId}, album="${albumName}"`);
		updateProgress(`ReccoBeats: Album "${albumName}" not found in artist's discography`, undefined);
		return null;
	}

	logger?.debug('ReccoBeats', `findAlbumInArtist: Retrieved ${allAlbums.length} albums for artist ${artistId}`);
	return allAlbums;
}

/**
 * Find an album on ReccoBeats by searching for its artist first.
 * Workflow: Artist Search Ã¢â€ â€™ Get Artist Albums Ã¢â€ â€™ Match Album Title
 * 
 * @param {string} artist - Artist name
 * @param {string} album - Album title
 * @returns {Promise<string|null>} Album ID or null if not found
 */
async function findAlbumId(artist, album) {
	const logger = _getReccoLogger();
	if (!artist || !album) {
		logger?.debug('ReccoBeats', `findAlbumId: Missing artist or album for "${artist} - ${album}"`);
		return null;
	}

	const cache = getCache('lookups');
	const cacheKey = `albumid:${artist}:${album}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		if (cached !== undefined) {
			logger?.debug('ReccoBeats', `findAlbumId: Cache hit for "${artist} - ${album}" -> ${cached || 'null'}`);
			return cached;
		}
	}

	logger?.debug('ReccoBeats', `findAlbumId: Looking up album "${album}" for artist "${artist}"`);

	// Step 1: Search for ALL artists with this name (handles duplicates like "Blue October")
	const allArtists = await searchArtistAll(artist);
	if (allArtists.length === 0) {
		logger?.debug('ReccoBeats', `findAlbumId: Artist "${artist}" not found`);
		cache?.set(cacheKey, null);
		return null;
	}

	// Step 2: Try each matching artist until we find the album
	for (let i = 0; i < allArtists.length; i++) {
		const artistInfo = allArtists[i];
		logger?.debug('ReccoBeats', `findAlbumId: Trying artist ${i + 1}/${allArtists.length}: "${artistInfo.name}" (ID: ${artistInfo.id})`);

		const albumInfo = await findAlbumInArtist(artistInfo.id, album);
		if (albumInfo) {
			const albumId = albumInfo.id;
			cache?.set(cacheKey, albumId);
			logger?.debug('ReccoBeats', `findAlbumId: Found album ID ${albumId} for "${artist} - ${album}" (artist ID: ${artistInfo.id})`);
			return albumId;
		}

		logger?.debug('ReccoBeats', `findAlbumId: Album "${album}" not found in artist ${artistInfo.id}, trying next...`);
	}

	// Album not found in any matching artist
	logger?.debug('ReccoBeats', `findAlbumId: Album "${album}" not found in any of ${allArtists.length} artist(s) named "${artist}"`);
	cache?.set(cacheKey, null);
	return null;
}

// =============================================================================
// TRACK LOOKUP API
// =============================================================================

/**
 * Get all tracks from an album by album ID.
 * 
 * @param {string} albumId - ReccoBeats album ID
 * @returns {Promise<object[]>} Array of track objects with id, trackTitle, etc.
 */
async function getAlbumTracks(albumId) {
	const logger = _getReccoLogger();
	if (!albumId) {
		logger?.warn('ReccoBeats', 'getAlbumTracks: No album ID provided');
		return [];
	}

	const cache = getCache('lookups');
	const cacheKey = `albumtracks:${albumId}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		logger?.debug('ReccoBeats', `getAlbumTracks: Cache hit for album ID ${albumId}`);
		return cache.get(cacheKey) || [];
	}

	const headers = createHeaders();

	try {
		const url = `${RECCOBEATS_API_BASE}/album/${albumId}/track`;
		const res = await rateLimitedFetch(url, { method: 'GET', headers });

		if (!res.ok) {
			logger?.warn('ReccoBeats', `getAlbumTracks: HTTP ${res.status} for album ${albumId}`);
			return [];
		}

		const data = await res.json();
		const rawTracks = data?.content || [];

		// Trim to essential fields
		const tracks = rawTracks.map(t => ({
			id: t.id,
			trackTitle: t.trackTitle || t.name || t.title || '',
		}));

		logger?.debug('ReccoBeats', `getAlbumTracks: Found ${tracks.length} tracks in album ${albumId}`);

		// Cache result
		cache?.set(cacheKey, tracks);
		return tracks;
	} catch (e) {
		logger?.error('ReccoBeats', `getAlbumTracks: Error for album ${albumId}: ${e.message}`);
		return [];
	}
}


/**
 * Find a specific track in an album by title.
 * 
 * @param {string} albumId - ReccoBeats album ID
 * @param {string} trackTitle - Track title to find
 * @returns {Promise<object|null>} Track object or null if not found
 */
async function findTrackInAlbum(albumId, trackTitle) {
	const logger = _getReccoLogger();
	const updateProgress = getUpdateProgress();

	const normalizedSearch = normalize(trackTitle);
	const cleanedSearch = matchMonkeyHelpers.cleanTrackName(normalizedSearch);

	logger?.debug('ReccoBeats', `findTrackInAlbum: Searching album ${albumId} for track="${trackTitle}" (normalized="${normalizedSearch}", cleaned="${cleanedSearch}")`);
	updateProgress(`ReccoBeats: Searching album for track "${trackTitle}"...`, undefined);

	const tracks = await getAlbumTracks(albumId);
	if (!tracks.length) {
		logger?.debug('ReccoBeats', `findTrackInAlbum: No tracks found in album ${albumId}`);
		updateProgress(`ReccoBeats: No tracks found in album`, undefined);
		return null;
	}

	// First pass: exact match after cleaning
	for (const t of tracks) {
		if (!t) continue;

		const trackRaw = t.trackTitle || t.name || t.title || '';
		const trackNormalized = normalize(trackRaw);
		const trackCleaned = matchMonkeyHelpers.cleanTrackName(trackNormalized);

		if (trackCleaned === cleanedSearch) {
			logger?.debug('ReccoBeats', `findTrackInAlbum: Found exact match "${trackTitle}" -> "${trackRaw}" (ID: ${t.id})`);
			updateProgress(`ReccoBeats: Found track "${trackTitle}"`, undefined);
			return t;
		}
	}

	// Second pass: substring/contains match (for box sets with "Disc X - Track" format)
	for (const t of tracks) {
		if (!t) continue;

		const trackRaw = t.trackTitle || t.name || t.title || '';
		const trackNormalized = normalize(trackRaw);
		const trackCleaned = matchMonkeyHelpers.cleanTrackName(trackNormalized);

		// Check if either contains the other (handles "T.N.T." matching "TNT" or "Live: T.N.T.")
		if (trackCleaned.includes(cleanedSearch) || cleanedSearch.includes(trackCleaned)) {
			// Only accept if both strings are substantial (at least 3 chars)
			if (cleanedSearch.length >= 3 && trackCleaned.length >= 3) {
				logger?.debug('ReccoBeats', `findTrackInAlbum: Found substring match "${trackTitle}" -> "${trackRaw}" (ID: ${t.id})`);
				updateProgress(`ReccoBeats: Found track "${trackTitle}"`, undefined);
				return t;
			}
		}
	}

	// Log available tracks for debugging
	const availableTracks = tracks.slice(0, 10).map(t => t.trackTitle || t.name || t.title || '(unnamed)');
	logger?.debug('ReccoBeats', `findTrackInAlbum: No match in ${tracks.length} tracks - searched for "${trackTitle}" (cleaned="${cleanedSearch}")`);
	logger?.debug('ReccoBeats', `findTrackInAlbum: First 10 tracks in album: ${availableTracks.join(', ')}`);
	updateProgress(`ReccoBeats: Track "${trackTitle}" not found in album - ensure track name matches official release`, undefined);
	return null;
}


/**
 * Enhanced normalization for track matching.
 * Removes remaster tags, live suffixes, feat. credits, punctuation, etc.
 * 
 * @param {string} s - String to normalize
 * @returns {string} Normalized string
 */
function normalizeForMatch(s) {
	return String(s || '')
		.normalize('NFC')						// consistent Unicode representation
		.toLowerCase()
		.replace(/\(.*?\)/g, '')				// remove parentheses and contents
		.replace(/\[.*?\]/g, '')				// remove brackets and contents
		.replace(/feat\.?|ft\.?/gi, '')			// remove feat/ft
		.replace(/remaster(ed)?/gi, '')			// remove remaster tags
		.replace(/\s*-\s*live\s+at\b.*/gi, '')	// remove "- Live at..." suffixes
		.replace(/\s*\(live\)/gi, '')			// remove (Live)
		.replace(/[^\p{L}\p{N}\s]/gu, '')		// remove punctuation, keep all Unicode letters & digits
		.replace(/\s+/g, ' ')					// collapse whitespace
		.trim();
}

/**
 * Find a track on ReccoBeats.
 * This is the main entry point for finding a track ID.
 * 
 * Optimized workflow:
 * 1. Search for ALL artists with the given name (handles duplicates like "Blue October")
 * 2. For each artist:
 *    a. If album provided: Try targeted album lookup first (FAST)
 *    b. Fallback to searching ALL tracks (SLOW)
 * 3. Return first successful match
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {string} album - Album name (optional - enables targeted search)
 * @returns {Promise<string|null>} Track ID or null if not found
 */
async function findTrackId(artist, title, album) {
	const logger = _getReccoLogger();
	if (!title || !artist) {
		logger?.debug('ReccoBeats', `findTrackId: Missing required params - artist="${artist}", title="${title}"`);
		return null;
	}

	const cache = getCache('lookups');
	const cacheKey = `trackid:${artist}:${title}:${album || ''}`.toUpperCase();
	const updateProgress = getUpdateProgress();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		if (cached !== undefined) {
			logger?.debug('ReccoBeats', `findTrackId: Cache hit for "${artist} - ${title}" -> ${cached || 'null'}`);
			return cached;
		}
	}

	logger?.debug('ReccoBeats', `findTrackId: Looking up "${artist} - ${title}" (Album: ${album || 'any'})`);
	updateProgress(`ReccoBeats: Looking up "${artist} - ${title}"...`, undefined);

	// Step 1: Search for ALL artists with this name (handles duplicates like "Blue October")
	const allArtists = await searchArtistAll(artist);
	if (allArtists.length === 0) {
		logger?.debug('ReccoBeats', `findTrackId: Artist "${artist}" not found`);
		updateProgress(`ReccoBeats: Artist "${artist}" not found`, undefined);
		cache?.set(cacheKey, null);
		return null;
	}

	logger?.debug('ReccoBeats', `findTrackId: Found ${allArtists.length} artist(s) named "${artist}"`);

	// Step 2: Try each matching artist until we find the track
	for (let artistIndex = 0; artistIndex < allArtists.length; artistIndex++) {
		const artistInfo = allArtists[artistIndex];
		logger?.debug('ReccoBeats', `findTrackId: Trying artist ${artistIndex + 1}/${allArtists.length}: "${artistInfo.name}" (ID: ${artistInfo.id})`);

		// Step 2a: If album provided, try targeted search first (OPTIMIZATION)
		if (album) {
			logger?.debug('ReccoBeats', `findTrackId: Attempting targeted album search for "${album}" in artist ${artistInfo.id}`);

			const albumInfo = await findAlbumInArtist(artistInfo.id, album);
			if (albumInfo) {
				logger?.debug('ReccoBeats', `findTrackId: Found album "${albumInfo.name}" (ID: ${albumInfo.id}), searching tracks...`);

				const track = await findTrackInAlbum(albumInfo.id, title);
				if (track) {
					const trackId = track.id;
					logger?.debug('ReccoBeats', `findTrackId: TARGETED SEARCH SUCCESS - Found "${track.trackTitle || track.name}" (ID: ${trackId}, artist ID: ${artistInfo.id})`);
					cache?.set(cacheKey, trackId);
					return trackId;
				}

				logger?.debug('ReccoBeats', `findTrackId: Track not found in album "${albumInfo.name}", trying full search for this artist`);
			} else {
				logger?.debug('ReccoBeats', `findTrackId: Album "${album}" not found in artist ${artistInfo.id}`);
			}
		}

		// Step 2b: Fallback - search album by album, stopping as soon as an exact match is found
		logger?.debug('ReccoBeats', `findTrackId: Starting album-by-album search for artist ${artistInfo.id}`);
		const allAlbums = await findAlbumInArtist(artistInfo.id, null);
		if (!allAlbums || allAlbums.length === 0) {
			logger?.debug('ReccoBeats', `findTrackId: No albums found for artist ${artistInfo.id}, trying next artist...`);
			continue;
		}

		const nTitle = normalizeForMatch(title);
		const nAlbum = album ? normalizeForMatch(album) : null;
		const containsMatches = [];

		logger?.debug('ReccoBeats', `findTrackId: Searching ${allAlbums.length} album(s) for "${title}" in artist ${artistInfo.id}`);

		for (const albumEntry of allAlbums) {
			const albumTracks = await getAlbumTracks(albumEntry.id);
			for (const t of albumTracks) {
				const trackRaw = t.trackTitle || t.name || t.title || '';
				const nTrack = normalizeForMatch(trackRaw);

				if (nTrack === nTitle) {
					// Exact match - stop immediately
					const trackId = t.id;
					logger?.debug('ReccoBeats', `findTrackId: FULL SEARCH SUCCESS (exact) - Found "${trackRaw}" in album "${albumEntry.name}" (ID: ${trackId}, artist ID: ${artistInfo.id})`);
					updateProgress(`ReccoBeats: Found "${trackRaw}"`, undefined);
					cache?.set(cacheKey, trackId);
					return trackId;
				}

				if (nTitle.length >= 3 && nTrack.length >= 3 && (nTrack.includes(nTitle) || nTitle.includes(nTrack))) {
					const score = Math.min(nTrack.length, nTitle.length) / Math.max(nTrack.length, nTitle.length) * 80;
					containsMatches.push({ track: { ...t, _albumName: albumEntry.name, _albumId: albumEntry.id }, matchType: 'contains', score });
				}
			}
		}

		if (containsMatches.length === 0) {
			logger?.debug('ReccoBeats', `findTrackId: No match for "${title}" in artist ${artistInfo.id}, trying next artist...`);
			continue;
		}

		// Use best contains match - prioritize by album if specified
		let matches = containsMatches;
		if (nAlbum && matches.length > 1) {
			const albumMatches = matches.filter(m => {
				const trackAlbum = normalizeForMatch(m.track._albumName || '');
				return trackAlbum === nAlbum || trackAlbum.includes(nAlbum) || nAlbum.includes(trackAlbum);
			});
			if (albumMatches.length > 0) {
				logger?.debug('ReccoBeats', `findTrackId: Prioritizing ${albumMatches.length} match(es) from album "${album}"`);
				matches = albumMatches;
			}
		}

		matches.sort((a, b) => b.score - a.score);
		const bestMatch = matches[0];
		const trackId = bestMatch.track.id;
		const foundTitle = bestMatch.track.trackTitle || bestMatch.track.name || '';
		const foundAlbum = bestMatch.track._albumName || '';

		logger?.debug('ReccoBeats', `findTrackId: FULL SEARCH SUCCESS (contains) - Best match "${foundTitle}" (Album: ${foundAlbum}, ID: ${trackId}, artist ID: ${artistInfo.id})`);
		updateProgress(`ReccoBeats: Found "${foundTitle}"`, undefined);

		cache?.set(cacheKey, trackId);
		return trackId;
	}

	// Track not found in any matching artist
	logger?.debug('ReccoBeats', `findTrackId: Track "${title}" not found in any of ${allArtists.length} artist(s) named "${artist}"`);
	updateProgress(`ReccoBeats: Track "${title}" not found`, undefined);
	cache?.set(cacheKey, null);
	return null;
}

/**
 * Find track IDs for multiple seed tracks (batch mode).
 * 
 * @param {object[]} seeds - Array of {artist, title, album} objects
 * @returns {Promise<Array<{seed: object, trackId: string|null}>>} Array with seed and trackId pairs
 */
async function findTrackIdsBatch(seeds) {
	const logger = _getReccoLogger();
	if (!seeds || seeds.length === 0) return [];

	const updateProgress = getUpdateProgress();
	const results = [];
	const totalSeeds = seeds.length;

	logger?.debug('ReccoBeats', `findTrackIdsBatch: Starting batch lookup for ${totalSeeds} seed track(s)`);

	updateProgress(`ReccoBeats: Looking up ${totalSeeds} seed track(s) - requires exact artist, album, and track names...`, 0.1);

	for (let i = 0; i < totalSeeds; i++) {
		const seed = seeds[i];

		// Update progress
		const progress = 0.1 + ((i + 1) / totalSeeds) * 0.2;
		logger?.debug('ReccoBeats', `findTrackIdsBatch: Processing ${i + 1}/${totalSeeds} - "${seed.artist} - ${seed.title}"`);
		updateProgress(`ReccoBeats: Looking up track ${i + 1}/${totalSeeds}: "${seed.artist} - ${seed.title}"...`, progress);

		const trackId = await findTrackId(seed.artist, seed.title, seed.album);
		results.push({ seed, trackId });

		if (!trackId) {
			logger?.debug('ReccoBeats', `findTrackIdsBatch: Track ${i + 1}/${totalSeeds} NOT FOUND`);
			updateProgress(`ReccoBeats: Track ${i + 1}/${totalSeeds} not found: "${seed.title}" (Album: ${seed.album})`, progress);
		} else {
			logger?.debug('ReccoBeats', `findTrackIdsBatch: Track ${i + 1}/${totalSeeds} FOUND - ID: ${trackId}`);
		}
	}

	const foundCount = results.filter(r => r.trackId).length;
	const notFoundCount = totalSeeds - foundCount;

	logger?.info('ReccoBeats', `findTrackIdsBatch: Found ${foundCount}/${totalSeeds} track IDs`);

	if (notFoundCount > 0) {
		updateProgress(`ReccoBeats: Found ${foundCount}/${totalSeeds} tracks (${notFoundCount} not found - check tags match official names)`, 0.3);
	} else {
		updateProgress(`ReccoBeats: Successfully found all ${foundCount} tracks`, 0.3);
	}

	return results;
}

// =============================================================================
// AUDIO FEATURES API
// =============================================================================

/**
 * Fetch audio features for a track by ID.
 * 
 * @param {string} trackId - ReccoBeats track ID
 * @returns {Promise<object|null>} Audio features object or null
 */
async function fetchTrackAudioFeatures(trackId) {
	const logger = _getReccoLogger();
	if (!trackId) {
		logger?.warn('ReccoBeats', 'fetchTrackAudioFeatures: No track ID provided');
		return null;
	}

	const cache = getCache('audioFeatures');
	const cacheKey = `audiofeatures:${trackId}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		logger?.debug('ReccoBeats', `fetchTrackAudioFeatures: Cache hit for track ${trackId}`);
		return cached;
	}

	const headers = createHeaders();

	try {
		// Use the single track audio-features endpoint
		const url = `${RECCOBEATS_API_BASE}/track/${trackId}/audio-features`;

		const res = await rateLimitedFetch(url, { method: 'GET', headers });

		if (!res.ok) {
			logger?.warn('ReccoBeats', `fetchTrackAudioFeatures: HTTP ${res.status} for track ${trackId}`);
			cache?.set(cacheKey, null);
			return null;
		}

		const data = await res.json();

		if (!data || typeof data !== 'object') {
			logger?.debug('ReccoBeats', `fetchTrackAudioFeatures: No audio features for track ${trackId}`);
			cache?.set(cacheKey, null);
			return null;
		}

		// Normalize features object
		const features = {
			id: data.id || trackId,
			acousticness: Number(data.acousticness) || 0,
			danceability: Number(data.danceability) || 0,
			energy: Number(data.energy) || 0,
			instrumentalness: Number(data.instrumentalness) || 0,
			key: Number(data.key) ?? -1,
			liveness: Number(data.liveness) || 0,
			loudness: Number(data.loudness) || 0,
			mode: Number(data.mode) || 0,
			speechiness: Number(data.speechiness) || 0,
			tempo: Number(data.tempo) || 0,
			valence: Number(data.valence) || 0,
		};

		logger?.debug('ReccoBeats', `fetchTrackAudioFeatures: Got features for ${trackId}`);

		cache?.set(cacheKey, features);
		return features;
	} catch (e) {
		logger?.error('ReccoBeats', `fetchTrackAudioFeatures: Error for track ${trackId}: ${e.message}`);
		return null;
	}
}

async function getAudioFeatures(foundTracks) {
	const logger = _getReccoLogger();
	const audioFeatures = [];

	for (const { seed, trackId } of foundTracks) {
		const features = await fetchTrackAudioFeatures(trackId);
		if (features) {
			audioFeatures.push(features);
		}
	}

	if (audioFeatures.length === 0) {
		logger?.debug('ReccoBeats', 'getAudioFeatures: No audio features available');
	}

	return audioFeatures;
}


function getLogAudioFeatures(audioFeatures) {
	const fmt = (v, digits = 2) => {
		if (v === undefined || v === null || Number.isNaN(Number(v))) return 'n/a';
		// For integer-like features (tempo, mode) prefer no decimals when values look integral
		if (Number.isInteger(v)) return String(v);
		return Number(v).toFixed(digits);
	};

	const parts = [
		`energy: ${fmt(audioFeatures.energy)}`,
		`valence: ${fmt(audioFeatures.valence)}`,
		`danceability: ${fmt(audioFeatures.danceability)}`,
		`acousticness: ${fmt(audioFeatures.acousticness)}`,
		`instrumentalness: ${fmt(audioFeatures.instrumentalness)}`,
		`speechiness: ${fmt(audioFeatures.speechiness)}`,
		`liveness: ${fmt(audioFeatures.liveness)}`,
		`loudness: ${audioFeatures.loudness !== undefined && audioFeatures.loudness !== null && !Number.isNaN(Number(audioFeatures.loudness)) ? Number(audioFeatures.loudness).toFixed(1) : 'n/a'}`,
		`mode: ${audioFeatures.mode !== undefined && audioFeatures.mode !== null && !Number.isNaN(Number(audioFeatures.mode)) ? String(audioFeatures.mode) : 'n/a'}`,
		`tempo: ${audioFeatures.tempo !== undefined && audioFeatures.tempo !== null && !Number.isNaN(Number(audioFeatures.tempo)) ? String(audioFeatures.tempo) : 'n/a'}`
	];

	return parts;
}

/**
 * Fetch track recommendations from ReccoBeats.
 * 
 * @param {string[]} seedIds - Array of seed track IDs (1-5)
 * @param {object} audioTargets - Audio feature targets for filtering
 * @param {number} limit - Maximum recommendations (1-100)
 * @param {string} contextKey - Optional context identifier (e.g., mood/activity name) to differentiate cache entries
 * @returns {Promise<object[]>} Array of recommended track objects
 */
async function fetchRecommendations(seedIds, audioTargets = {}, limit = 100, contextKey = '') {
	const logger = _getReccoLogger();
	// Normalize seedIds into an array if provided
	let seeds = null;

	if (typeof seedIds === 'string') {
		seeds = [seedIds];
	} else if (Array.isArray(seedIds) && seedIds.length > 0) {
		seeds = seedIds.slice(0, 5); // API max 5 seeds
	}

	const cache = getCache('recommendations');
	const seedKey = seeds ? seeds.join(',') : 'NO_SEEDS';
	const context = contextKey ? `:${contextKey}` : '';
	const cacheKey = `recommendations:${seedKey}${context}:${JSON.stringify(audioTargets)}:${limit}`.toUpperCase();

	logger?.debug('ReccoBeats', `fetchRecommendations: Cache key = ${cacheKey.substring(0, 100)}...`);

	// Cache hit?
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		logger?.debug('ReccoBeats', `fetchRecommendations: Cache HIT - returning ${cached?.length || 0} cached tracks${contextKey ? ` (context: ${contextKey})` : ''}`);
		return cached || [];
	}

	logger?.debug('ReccoBeats', `fetchRecommendations: Cache MISS - fetching from API${contextKey ? ` (context: ${contextKey})` : ''}`);

	const headers = createHeaders();

	try {
		// Build URL
		const url = new URL(`${RECCOBEATS_API_BASE}/track/recommendation`);
		// look for API limit of 100 so we have room to find matching tracks in our library
		url.searchParams.append('size', String(100));

		// Only add seeds if provided
		if (seeds) {
			url.searchParams.append('seeds', seeds.join(','));
		}

		// Add audio feature targets
		for (const [key, value] of Object.entries(audioTargets)) {
			if (AUDIO_FEATURE_NAMES.includes(key) && value != null) {
				// Round to 4 decimal places to avoid floating point precision issues
				// e.g., 0.5860000000000001 -> 0.5860
				const roundedValue = Math.round(value * 10000) / 10000;
				url.searchParams.append(key, String(roundedValue));
			}
		}

		const res = await rateLimitedFetch(url, { method: 'GET', headers });

		if (!res.ok) {
			logger?.warn('ReccoBeats', `fetchRecommendations: HTTP ${res.status} for "${seeds.join(', ')}"`);
			return [];
		}

		const data = await res.json();
		const rawContent = data?.content || [];

		// Trim to essential fields
		const content = rawContent.map(t => ({
			id: t.id,
			trackTitle: t.trackTitle || '',
			title: t.title || '',
			artist: t.artist || '',
			album: t.album || '',
			popularity: t.popularity || 0,
			artists: Array.isArray(t.artists) ? t.artists.map(a => ({ name: a.name })) : [],
		}));

		// Cache result
		cache?.set(cacheKey, content);
		logger?.debug('ReccoBeats', `fetchRecommendations: Found ${content.length} tracks`);
		return content;
	} catch (e) {
		logger?.error('ReccoBeats', `fetchRecommendations: Error fetching recommendations: ${e.message}`);
		return [];
	}
}
// =============================================================================
// HIGH-LEVEL DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Get ReccoBeats recommendations based on seed tracks.
 * 
 * This is the main entry point for "Similar Acoustics" discovery mode.
 * 
 * Workflow:
 * 1. Find track IDs for each seed (via album search) - tries more seeds until we find matches
 * 2. Fetch audio features for found tracks
 * 3. Calculate average audio features
 * 4. Get recommendations using seed IDs and audio features
 * 5. Return recommendations for library matching
 * 
 * @param {object[]} seeds - Seed tracks [{artist, title, album}, ...]
 * @param {number} limit - Maximum recommendations (default 100)
 * @returns {Promise<object>} Result with recommendations array and metadata
 */
async function getReccoRecommendations(seeds, limit = 100) {
	const logger = _getReccoLogger();
	const updateProgress = getUpdateProgress();

	if (!seeds || seeds.length === 0) {
		logger?.warn('ReccoBeats', 'getReccoRecommendations: No seed tracks provided');
		return { recommendations: [], seedCount: 0, foundCount: 0 };
	}

	logger?.debug('ReccoBeats', `getReccoRecommendations: Processing ${seeds.length} seed track(s)`);

	// ReccoBeats API allows max 5 seed IDs per recommendation request.
	// We still process ALL seeds by splitting found seed IDs into blocks of 5.
	const maxSeedsToTry = seeds.length;

	// Step 1: Find track IDs for all seeds (cache-first in findTrackId)
	updateProgress(`Looking up tracks on ReccoBeats (trying ${maxSeedsToTry} seeds)...`, 0.1);
	logger?.debug('ReccoBeats', `getReccoRecommendations: Step 1 - Looking up track IDs (trying ${maxSeedsToTry} seeds)`);

	const allResults = [];
	const foundTracks = [];

	for (let i = 0; i < maxSeedsToTry; i++) {
		const seed = seeds[i];
		const progress = 0.1 + ((i + 1) / maxSeedsToTry) * 0.2;

		logger?.debug('ReccoBeats', `getReccoRecommendations: Trying seed ${i + 1}/${maxSeedsToTry}: "${seed.artist} - ${seed.title}" (Album: ${seed.album})`);
		updateProgress(`ReccoBeats: Looking up "${seed.artist} - ${seed.title}" (${foundTracks.length} found)...`, progress);

		const trackId = await findTrackId(seed.artist, seed.title, seed.album);
		allResults.push({ seed, trackId });

		if (trackId) {
			foundTracks.push({ seed, trackId });
			logger?.debug('ReccoBeats', `getReccoRecommendations: FOUND track ID ${trackId} for "${seed.artist} - ${seed.title}" (${foundTracks.length} found)`);
		} else {
			logger?.debug('ReccoBeats', `getReccoRecommendations: NOT FOUND: "${seed.artist} - ${seed.title}" (Album: ${seed.album})`);
		}
	}

	if (foundTracks.length === 0) {
		logger?.debug('ReccoBeats', `getReccoRecommendations: No tracks found on ReccoBeats after trying ${allResults.length} seeds`);
		updateProgress(`ReccoBeats: None of ${allResults.length} tracks found - ensure Artist, Album, and Track tags match official release names exactly`, 0.5);
		return { recommendations: [], seedCount: allResults.length, foundCount: 0, triedCount: allResults.length };
	}

	logger?.debug('ReccoBeats', `getReccoRecommendations: Found ${foundTracks.length} track(s) on ReccoBeats after trying ${allResults.length} seeds`);
	updateProgress(`ReccoBeats: Found ${foundTracks.length}/${allResults.length} tracks on ReccoBeats`, 0.3);

	// Step 2: Fetch audio features
	updateProgress(`Analyzing audio features of ${foundTracks.length} tracks...`, 0.35);
	logger?.debug('ReccoBeats', 'getReccoRecommendations: Step 2 - Fetching audio features');

	const audioFeatures = await getAudioFeatures(foundTracks);

	if (audioFeatures.length === 0) {
		logger?.debug('ReccoBeats', 'getReccoRecommendations: No audio features available');
		updateProgress('No audio features available', 0.5);
		return { recommendations: [], seedCount: allResults.length, foundCount: foundTracks.length, triedCount: allResults.length };
	}

	logger?.debug('ReccoBeats', `getReccoRecommendations: Retrieved audio features for ${audioFeatures.length} track(s)`);

	// Step 3: Request recommendations in blocks of 5 seed IDs
	const seedBatchSize = 5;
	const totalBatches = Math.ceil(foundTracks.length / seedBatchSize);
	updateProgress(`Requesting recommendations for ${foundTracks.length} seeds in ${totalBatches} batch(es)...`, 0.5);
	logger?.debug('ReccoBeats', `getReccoRecommendations: Step 3 - Getting recommendations in ${totalBatches} batch(es) of up to ${seedBatchSize} seeds`);

	const allRecommendations = [];

	for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
		const start = batchIndex * seedBatchSize;
		const batch = foundTracks.slice(start, start + seedBatchSize);
		const seedIds = batch.map(x => x.trackId);

		const progressPercent = 0.5 + (0.3 * ((batchIndex + 1) / totalBatches));
		updateProgress(`Getting recommendations for seed batch ${batchIndex + 1}/${totalBatches} (${seedIds.length} seeds)...`, progressPercent);
		logger?.debug('ReccoBeats', `getReccoRecommendations: Processing batch ${batchIndex + 1}/${totalBatches} with ${seedIds.length} seed ID(s)`);

		// Pass empty audioTargets - seeds alone are sufficient for Similar Acoustics mode
		const batchRecommendations = await fetchRecommendations(seedIds, {}, limit);
		logger?.debug('ReccoBeats', `getReccoRecommendations: Received ${batchRecommendations.length} recommendations for batch ${batchIndex + 1}`);

		allRecommendations.push(...batchRecommendations);
	}

	// Step 4: Deduplicate recommendations by track ID (fallback to artist/album/title if no ID)
	logger?.debug('ReccoBeats', `getReccoRecommendations: Step 4 - Deduplicating ${allRecommendations.length} total recommendations`);
	const uniqueMap = new Map();

	for (const rec of allRecommendations) {
		const key = (rec.id != null
			? String(rec.id).toLowerCase()
			: `${rec.artist}|||${rec.album}|||${rec.title}`.toLowerCase());
		if (!uniqueMap.has(key)) {
			uniqueMap.set(key, rec);
		}
	}

	const recommendations = Array.from(uniqueMap.values());

	// Apply final limit
	const finalRecommendations = recommendations.slice(0, limit);

	logger?.debug('ReccoBeats', `getReccoRecommendations: After deduplication: ${recommendations.length} unique tracks (${finalRecommendations.length} after limit)`);
	updateProgress(`Received ${finalRecommendations.length} unique recommendations from ${foundTracks.length} seeds (tried ${allResults.length} tracks)`, 0.8);

	return {
		recommendations: finalRecommendations,
		seedCount: allResults.length,
		foundCount: foundTracks.length,
		triedCount: allResults.length,
		audioFeatures
	};
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Filter tracks by audio feature criteria.
 * 
 * @param {object[]} tracks - Array of track objects with audio features
 * @param {object} criteria - Filter criteria with min/max for each feature
 * @returns {object[]} Filtered tracks
 */
function filterTracksByAudioFeatures(tracks, criteria = {}) {
	if (!Array.isArray(tracks) || tracks.length === 0) return [];

	const {
		minEnergy, maxEnergy,
		minValence, maxValence,
		minTempo, maxTempo,
		minDanceability, maxDanceability,
		minAcousticness, maxAcousticness,
		minInstrumentalness, maxInstrumentalness
	} = criteria;

	return tracks.filter(track => {
		if (!track || typeof track !== 'object') return false;

		if (minEnergy !== undefined && (track.energy || 0) < minEnergy) return false;
		if (maxEnergy !== undefined && (track.energy || 0) > maxEnergy) return false;

		if (minValence !== undefined && (track.valence || 0) < minValence) return false;
		if (maxValence !== undefined && (track.valence || 0) > maxValence) return false;

		if (minTempo !== undefined && (track.tempo || 0) < minTempo) return false;
		if (maxTempo !== undefined && (track.tempo || 0) > maxTempo) return false;

		if (minDanceability !== undefined && (track.danceability || 0) < minDanceability) return false;
		if (maxDanceability !== undefined && (track.danceability || 0) > maxDanceability) return false;

		if (minAcousticness !== undefined && (track.acousticness || 0) < minAcousticness) return false;
		if (maxAcousticness !== undefined && (track.acousticness || 0) > maxAcousticness) return false;

		if (minInstrumentalness !== undefined && (track.instrumentalness || 0) < minInstrumentalness) return false;
		if (maxInstrumentalness !== undefined && (track.instrumentalness || 0) > maxInstrumentalness) return false;

		return true;
	});
}

/**
 * Calculate match score between a track and target audio features.
 * 
 * @param {object} track - Track with audio features
 * @param {object} target - Target audio features
 * @param {object} weights - Optional custom weights
 * @returns {number} Match score 0.0-1.0
 */
function calculateAudioFeatureMatch(track, target, weights = null) {
	if (!track || !target) return 0;

	const defaultWeights = {
		energy: 0.25,
		valence: 0.25,
		danceability: 0.15,
		tempo: 0.15,
		acousticness: 0.1,
		instrumentalness: 0.1
	};

	const w = weights || defaultWeights;
	let totalWeight = 0;
	let weightedScore = 0;

	// Energy match
	if (track.energy !== undefined && target.energy !== undefined) {
		const diff = Math.abs(track.energy - target.energy);
		weightedScore += (1.0 - diff) * (w.energy || 0);
		totalWeight += w.energy || 0;
	}

	// Valence match
	if (track.valence !== undefined && target.valence !== undefined) {
		const diff = Math.abs(track.valence - target.valence);
		weightedScore += (1.0 - diff) * (w.valence || 0);
		totalWeight += w.valence || 0;
	}

	// Danceability match
	if (track.danceability !== undefined && target.danceability !== undefined) {
		const diff = Math.abs(track.danceability - target.danceability);
		weightedScore += (1.0 - diff) * (w.danceability || 0);
		totalWeight += w.danceability || 0;
	}

	// Tempo match (normalized, assuming 60-180 BPM range)
	if (track.tempo !== undefined && target.tempo !== undefined) {
		const diff = Math.abs(track.tempo - target.tempo);
		const score = Math.max(0, 1.0 - (diff / 60));
		weightedScore += score * (w.tempo || 0);
		totalWeight += w.tempo || 0;
	}

	// Acousticness match
	if (track.acousticness !== undefined && target.acousticness !== undefined) {
		const diff = Math.abs(track.acousticness - target.acousticness);
		weightedScore += (1.0 - diff) * (w.acousticness || 0);
		totalWeight += w.acousticness || 0;
	}

	// Instrumentalness match
	if (track.instrumentalness !== undefined && target.instrumentalness !== undefined) {
		const diff = Math.abs(track.instrumentalness - target.instrumentalness);
		weightedScore += (1.0 - diff) * (w.instrumentalness || 0);
		totalWeight += w.instrumentalness || 0;
	}

	// Return normalized score
	return totalWeight > 0 ? (weightedScore / totalWeight) : 0;
}

// =============================================================================
// EXPORT TO WINDOW NAMESPACE
// =============================================================================

window.matchMonkeyReccoBeatsAPI = {
	// High-level discovery functions
	getReccoRecommendations,

	// Track/album lookup and audio features
	searchArtist,
	searchArtistAll,
	searchAlbum,
	findAlbumInArtist,
	findAlbumId,
	getAlbumTracks,
	findTrackInAlbum,
	findTrackId,
	findTrackIdsBatch,
	fetchTrackAudioFeatures,
	getAudioFeatures,

	// Recommendation and utility functions
	fetchRecommendations,
	filterTracksByAudioFeatures,
	calculateAudioFeatureMatch,
	getLogAudioFeatures,

	// Constants
	AUDIO_FEATURE_NAMES,
	RECCOBEATS_API_BASE,
	API_TIMEOUT_MS,
};
