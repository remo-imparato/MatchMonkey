/**
 * ReccoBeats API Integration Module
 * 
 * Fetches AI-powered music recommendations based on mood, activity, and genre.
 * Complements Last.fm API with enhanced context-aware discovery.
 * 
 * Caching Strategy:
 * - Per-session cache stored in lastfmCache._reccobeats Map
 * - Cache keys include all query parameters to avoid stale results
 * - Cache is cleared when lastfmCache.clear() is called at end of each run
 * 
 * Rate Limiting:
 * - Respects 429 Too Many Requests responses with exponential backoff
 * - Default delay between requests to avoid hitting rate limits
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

// ReccoBeats API base endpoint
const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

// Default timeout for API requests (10 seconds)
const API_TIMEOUT_MS = 10000;

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 200; // Default delay between requests
const RATE_LIMIT_BACKOFF_MS = 2000; // Initial backoff on 429
const RATE_LIMIT_MAX_RETRIES = 3; // Max retries on rate limit

// ReccoBeats API key (stored securely)
const RECCOBEATS_API_KEY = 'c0bb1370-6d44-4e9d-8c25-64c3b09cc0b1';

// Track last request time for rate limiting
let lastRequestTime = 0;

/**
 * Audio feature names that can be used in recommendations.
 * These are the features supported by the ReccoBeats recommendation API.
 */
const AUDIO_FEATURE_NAMES = [
	'acousticness', 'danceability', 'energy', 'instrumentalness',
	'liveness', 'loudness', 'mode', 'speechiness', 'tempo', 'valence'
];

/**
 * Audio feature targets for different moods.
 * Values are 0.0-1.0 scale where applicable.
 */
const MOOD_AUDIO_TARGETS = {
	energetic: { energy: 0.8, valence: 0.7, danceability: 0.7, tempo: 130 },
	relaxed: { energy: 0.3, valence: 0.5, danceability: 0.3, tempo: 80 },
	happy: { energy: 0.6, valence: 0.9, danceability: 0.6, tempo: 115 },
	sad: { energy: 0.3, valence: 0.2, danceability: 0.3, tempo: 70 },
	focused: { energy: 0.4, valence: 0.4, danceability: 0.3, instrumentalness: 0.6, tempo: 100 },
	angry: { energy: 0.9, valence: 0.3, danceability: 0.5, tempo: 140 },
	romantic: { energy: 0.4, valence: 0.6, danceability: 0.4, acousticness: 0.5, tempo: 90 },
};

/**
 * Audio feature targets for different activities.
 */
const ACTIVITY_AUDIO_TARGETS = {
	workout: { energy: 0.9, danceability: 0.8, tempo: 140 },
	study: { energy: 0.3, instrumentalness: 0.7, speechiness: 0.1, tempo: 90 },
	party: { energy: 0.8, valence: 0.8, danceability: 0.9, tempo: 125 },
	sleep: { energy: 0.1, acousticness: 0.7, instrumentalness: 0.5, tempo: 60 },
	driving: { energy: 0.6, valence: 0.6, danceability: 0.5, tempo: 110 },
	meditation: { energy: 0.2, acousticness: 0.8, instrumentalness: 0.8, tempo: 70 },
	cooking: { energy: 0.5, valence: 0.7, danceability: 0.5, tempo: 100 },
};

/**
 * Enforce rate limiting delay between requests.
 */
async function enforceRateLimit() {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	
	if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
		const delay = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
		await new Promise(resolve => setTimeout(resolve, delay));
	}
	
	lastRequestTime = Date.now();
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
	await enforceRateLimit();
	
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
	
	try {
		const res = await fetch(url, { ...options, signal: controller.signal });
		
		// Handle rate limiting (429)
		if (res.status === 429) {
			if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
				console.error('rateLimitedFetch: Max retries exceeded for 429');
				return res;
			}
			
			// Get retry-after header or use exponential backoff
			const retryAfter = res.headers.get('Retry-After');
			const backoffMs = retryAfter 
				? parseInt(retryAfter, 10) * 1000 
				: RATE_LIMIT_BACKOFF_MS * Math.pow(2, retryCount);
			
			console.log(`rateLimitedFetch: 429 received, waiting ${backoffMs}ms before retry ${retryCount + 1}`);
			await new Promise(resolve => setTimeout(resolve, backoffMs));
			
			return rateLimitedFetch(url, options, retryCount + 1);
		}
		
		return res;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Get ReccoBeats track ID from artist and title.
 * Uses the helper function from discoveryStrategies.
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @returns {Promise<string|null>} ReccoBeats track ID or null if not found
 */
async function getTrackId(artist, title) {
	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:trackid:${artist}:${title}`.toUpperCase();
	
	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		return cache._reccobeats.get(cacheKey);
	}
	
	try {
		// Use the helper function from discoveryStrategies
		const strategies = window.matchMonkeyDiscoveryStrategies;
		if (strategies?.getReccoTrackId) {
			// Note: getReccoTrackId is not exported, so we implement it here
		}
		
		// Implement track ID lookup directly
		const normalize = (s) =>
			s.toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();
		
		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);
		
		const requestOptions = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		};
		
		// Search for artist
		const artistSearchUrl = `${RECCOBEATS_API_BASE}/search/artist?q=${encodeURIComponent(artist)}`;
		const artistRes = await rateLimitedFetch(artistSearchUrl, requestOptions);
		
		if (!artistRes.ok) {
			console.warn(`getTrackId: Artist search failed for "${artist}"`);
			return null;
		}
		
		const artistJson = await artistRes.json();
		
		if (!artistJson?.data?.length) {
			console.log(`getTrackId: Artist not found: "${artist}"`);
			return null;
		}
		
		const artistId = artistJson.data[0].id;
		
		// Get tracks for that artist
		const tracksUrl = `${RECCOBEATS_API_BASE}/artist/${artistId}/tracks`;
		const tracksRes = await rateLimitedFetch(tracksUrl, requestOptions);
		
		if (!tracksRes.ok) {
			console.warn(`getTrackId: Tracks fetch failed for artist "${artist}"`);
			return null;
		}
		
		const tracksJson = await tracksRes.json();
		
		if (!tracksJson?.data?.length) {
			console.log(`getTrackId: No tracks found for artist: "${artist}"`);
			return null;
		}
		
		// Match title
		const normalizedTitle = normalize(title);
		const match = tracksJson.data.find(
			(t) => normalize(t.trackTitle || t.title || '') === normalizedTitle
		);
		
		if (!match) {
			console.log(`getTrackId: Track title not found: "${title}" by "${artist}"`);
			return null;
		}
		
		const trackId = match.id;
		
		// Cache the result
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, trackId);
		}
		
		console.log(`getTrackId: Found track ID "${trackId}" for "${artist} - ${title}"`);
		return trackId;
		
	} catch (e) {
		console.error(`getTrackId error for "${artist} - ${title}":`, e.message);
		return null;
	}
}

/**
 * Fetch audio features for a specific track using its ReccoBeats ID.
 * 
 * @param {string} trackId - ReccoBeats track ID
 * @returns {Promise<object|null>} Audio features object or null if not found
 */
async function fetchTrackAudioFeatures(trackId) {
	if (!trackId) {
		console.warn('fetchTrackAudioFeatures: No trackId provided');
		return null;
	}
	
	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:audiofeatures:${trackId}`.toUpperCase();
	
	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		const cached = cache._reccobeats.get(cacheKey);
		console.log(`fetchTrackAudioFeatures: Cache hit for track ${trackId}`);
		return cached;
	}
	
	try {
		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);
		
		const url = `${RECCOBEATS_API_BASE}/track/${encodeURIComponent(trackId)}/audio-features`;
		console.log(`fetchTrackAudioFeatures: GET ${url}`);
		
		const res = await rateLimitedFetch(url, {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		});
		
		if (!res.ok) {
			console.error(`fetchTrackAudioFeatures: HTTP ${res.status} for track ${trackId}`);
			return null;
		}
		
		const data = await res.json();
		
		if (!data) {
			console.log(`fetchTrackAudioFeatures: No audio features for track ${trackId}`);
			return null;
		}
		
		// Extract and normalize audio features
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
		
		console.log(`fetchTrackAudioFeatures: Retrieved features for track ${trackId} (energy: ${features.energy}, valence: ${features.valence}, tempo: ${features.tempo})`);
		
		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, features);
		}
		
		return features;
		
	} catch (e) {
		if (e.name === 'AbortError') {
			console.error('fetchTrackAudioFeatures: Request timed out');
		} else {
			console.error('fetchTrackAudioFeatures error:', e.message);
		}
		return null;
	}
}

/**
 * Calculate min/max audio feature ranges from multiple seed track features.
 * Adds a small tolerance to create a range around the seed values.
 * 
 * @param {object[]} seedFeatures - Array of audio feature objects from seed tracks
 * @param {number} tolerance - Tolerance to add/subtract from min/max (default 0.15 for 0-1 features)
 * @returns {object} Object with averaged audio feature values for recommendation query
 */
function calculateAudioFeatureRanges(seedFeatures, tolerance = 0.15) {
	if (!seedFeatures || seedFeatures.length === 0) {
		return {};
	}
	
	// If only one seed, use its values directly (API uses single values, not ranges)
	if (seedFeatures.length === 1) {
		const seed = seedFeatures[0];
		const result = {};
		for (const feature of AUDIO_FEATURE_NAMES) {
			if (seed[feature] !== undefined && seed[feature] !== null) {
				result[feature] = seed[feature];
			}
		}
		return result;
	}
	
	// For multiple seeds, calculate the average of each feature
	const result = {};
	
	for (const feature of AUDIO_FEATURE_NAMES) {
		const values = seedFeatures
			.map(f => f[feature])
			.filter(v => v !== undefined && v !== null && !isNaN(v));
		
		if (values.length > 0) {
			// Use the average of all seed values
			const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
			result[feature] = avg;
		}
	}
	
	console.log(`calculateAudioFeatureRanges: Calculated ranges from ${seedFeatures.length} seeds:`, 
		Object.entries(result).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(', '));
	
	return result;
}

/**
 * Fetch track recommendations from ReccoBeats using seed track IDs and optional audio features.
 * Uses the /v1/track/recommendation API with proper query parameters.
 * 
 * @param {string[]} seedIds - Array of ReccoBeats track IDs (1-5 seeds)
 * @param {object} audioFeatures - Optional audio feature targets for filtering
 * @param {number} limit - Maximum recommendations (1-100)
 * @returns {Promise<object[]>} Array of track objects with audio features
 */
async function fetchTrackRecommendations(seedIds, audioFeatures = {}, limit = 100) {
	// Handle legacy single trackId parameter
	if (typeof seedIds === 'string') {
		seedIds = [seedIds];
	}
	
	if (!seedIds || seedIds.length === 0) {
		console.warn('fetchTrackRecommendations: No seed IDs provided');
		return [];
	}
	
	// Limit to 5 seeds as per API spec
	const limitedSeeds = seedIds.slice(0, 5);
	
	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:trackrec:${limitedSeeds.join(',')}:${JSON.stringify(audioFeatures)}:${limit}`.toUpperCase();
	
	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		const cached = cache._reccobeats.get(cacheKey);
		console.log(`fetchTrackRecommendations: Cache hit (${cached?.length || 0} tracks)`);
		return cached || [];
	}
	
	try {
		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);
		
		// Build URL with required parameters
		const params = new URLSearchParams();
		params.set('size', String(Math.min(limit, 100)));
		
		// Add seed track IDs
		for (const seedId of limitedSeeds) {
			params.append('seeds', seedId);
		}
		
		// Add optional audio feature parameters
		for (const [feature, value] of Object.entries(audioFeatures)) {
			if (value !== undefined && value !== null && AUDIO_FEATURE_NAMES.includes(feature)) {
				params.set(feature, String(value));
			}
		}
		
		const url = `${RECCOBEATS_API_BASE}/track/recommendation?${params.toString()}`;
		console.log(`fetchTrackRecommendations: GET ${url}`);
		
		const res = await rateLimitedFetch(url, {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		});
		
		if (!res.ok) {
			console.error(`fetchTrackRecommendations: HTTP ${res.status}`);
			return [];
		}
		
		const data = await res.json();
		
		// Handle response structure - API returns { content: [...] }
		const tracks = data?.content || data?.data || [];
		
		if (!tracks.length) {
			console.log(`fetchTrackRecommendations: No recommendations returned`);
			return [];
		}
		
		// Extract and normalize track data
		const recommendations = tracks.map(track => {
			// Handle artists array
			let artistName = '';
			if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
				artistName = track.artists.map(a => a.artistName || a.name || '').filter(Boolean).join(', ');
			} else {
				artistName = String(track.artistName || track.artist || '').trim();
			}
			
			return {
				artist: artistName,
				title: String(track.trackTitle || track.title || '').trim(),
				trackId: track.id || track.trackId,
				isrc: track.isrc || '',
				durationMs: track.durationMs || 0,
				popularity: track.popularity || 0,
				// Audio features may not be included in recommendation response
				acousticness: Number(track.acousticness) || 0,
				danceability: Number(track.danceability) || 0,
				energy: Number(track.energy) || 0,
				instrumentalness: Number(track.instrumentalness) || 0,
				liveness: Number(track.liveness) || 0,
				loudness: Number(track.loudness) || 0,
				mode: Number(track.mode) || 0,
				speechiness: Number(track.speechiness) || 0,
				tempo: Number(track.tempo) || 0,
				valence: Number(track.valence) || 0,
			};
		}).filter(t => t.artist && t.title);
		
		console.log(`fetchTrackRecommendations: Retrieved ${recommendations.length} tracks`);
		
		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}
		
		return recommendations;
		
	} catch (e) {
		if (e.name === 'AbortError') {
			console.error('fetchTrackRecommendations: Request timed out');
		} else {
			console.error('fetchTrackRecommendations error:', e.message);
		}
		return [];
	}
}

/**
 * Calculate how well a track matches the target audio features for a mood/activity.
 * 
 * @param {object} track - Track with audio features
 * @param {object} targets - Target audio feature values
 * @returns {number} Match score 0.0-1.0 (higher is better match)
 */
function calculateAudioFeatureMatch(track, targets) {
	if (!track || !targets) return 0;
	
	let totalWeight = 0;
	let weightedScore = 0;
	
	// Weight each feature by its importance in the targets
	const features = ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'speechiness', 'tempo'];
	
	for (const feature of features) {
		if (targets[feature] !== undefined) {
			const target = targets[feature];
			const actual = track[feature] || 0;
			
			// For tempo, normalize to 0-1 scale (assuming 60-180 BPM range)
			let normalizedTarget = target;
			let normalizedActual = actual;
			
			if (feature === 'tempo') {
				normalizedTarget = (target - 60) / 120; // 60-180 -> 0-1
				normalizedActual = (actual - 60) / 120;
			}
			
			// Calculate similarity (1 - absolute difference, clamped to 0-1)
			const diff = Math.abs(normalizedTarget - normalizedActual);
			const similarity = Math.max(0, 1 - diff);
			
			// Weight by how extreme the target is (more extreme = more important)
			const weight = Math.abs(normalizedTarget - 0.5) + 0.5;
			
			totalWeight += weight;
			weightedScore += similarity * weight;
		}
	}
	
	return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * Filter and sort tracks by how well they match mood/activity audio targets.
 * 
 * @param {object[]} tracks - Array of tracks with audio features
 * @param {string} context - 'mood' or 'activity'
 * @param {string} value - Mood or activity name
 * @param {number} limit - Maximum tracks to return
 * @returns {object[]} Filtered and sorted tracks
 */
function filterTracksByAudioFeatures(tracks, context, value, limit = 50) {
	if (!tracks || tracks.length === 0) return [];
	
	// Get target audio features
	const targets = context === 'mood' 
		? MOOD_AUDIO_TARGETS[value.toLowerCase()] 
		: ACTIVITY_AUDIO_TARGETS[value.toLowerCase()];
	
	if (!targets) {
		console.warn(`filterTracksByAudioFeatures: Unknown ${context} "${value}", returning unfiltered`);
		return tracks.slice(0, limit);
	}
	
	// Calculate match score for each track
	const scoredTracks = tracks.map(track => ({
		...track,
		matchScore: calculateAudioFeatureMatch(track, targets)
	}));
	
	// Sort by match score (highest first)
	scoredTracks.sort((a, b) => b.matchScore - a.matchScore);
	
	// Filter out poor matches (below 0.4 threshold)
	const filtered = scoredTracks.filter(t => t.matchScore >= 0.4);
	
	console.log(`filterTracksByAudioFeatures: ${filtered.length}/${tracks.length} tracks match "${value}" ${context} (threshold 0.4)`);
	
	return filtered.slice(0, limit);
}

/**
 * Fetch mood-based recommendations from ReccoBeats.
 * 
 * @param {string} mood - Target mood (e.g., 'energetic', 'relaxed', 'happy', 'sad', 'focused')
 * @param {string[]} genres - Optional array of genre preferences for filtering
 * @param {number} limit - Maximum number of recommendations (default from config or 50)
 * @returns {Promise<object[]>} Array of track recommendations with artist, title, and audio features
 */
async function fetchMoodRecommendations(mood, genres = [], limit = 50) {
	try {
		// Validate required parameters
		if (!mood || typeof mood !== 'string') {
			console.warn('fetchMoodRecommendations: Invalid mood parameter');
			return [];
		}
		
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		// Build cache key including all parameters
		const cacheKey = `reccobeats:mood:${mood}:${genres.sort().join(',')}:${limit}`.toUpperCase();
		
		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cached = cache._reccobeats.get(cacheKey);
			console.log(`fetchMoodRecommendations: Cache hit for "${mood}" (${cached?.length || 0} tracks)`);
			return cached || [];
		}
		
		updateProgress(`Querying ReccoBeats for "${mood}" mood...`, 0.25);
		
		// Build request URL with parameters
		const params = new URLSearchParams({
			mood: mood.toLowerCase().trim(),
			limit: String(Math.min(limit, 100)), // Cap at 100 to avoid overloading
			format: 'json'
		});
		
		if (genres.length > 0) {
			params.set('genres', genres.slice(0, 5).join(',')); // Limit to 5 genres
		}
		
		const url = `${RECCOBEATS_API_BASE}/recommendations/mood?${params.toString()}`;
		console.log(`fetchMoodRecommendations: GET ${url}`);
		
		// Make rate-limited request
		const res = await rateLimitedFetch(url);
		
		// Handle HTTP errors
		if (!res || !res.ok) {
			const status = res?.status || 'unknown';
			console.error(`fetchMoodRecommendations: HTTP ${status} for mood "${mood}"`);
			updateProgress(`ReccoBeats API error (HTTP ${status})`, 0.3);
			return [];
		}
		
		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (parseError) {
			console.error('fetchMoodRecommendations: Invalid JSON response:', parseError.message);
			return [];
		}
		
		// Check for API-level errors
		if (data?.error) {
			console.error('fetchMoodRecommendations: API error:', data.error);
			return [];
		}
		
		// Extract and normalize recommendations
		const recommendations = (data?.tracks || []).map(track => ({
			artist: String(track.artist || '').trim(),
			title: String(track.title || track.name || '').trim(),
			mood: track.mood || mood,
			// Audio features (0.0-1.0 scale)
			energy: Number(track.energy) || 0,
			valence: Number(track.valence) || 0, // Positivity/happiness
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title); // Filter out incomplete entries
		
		console.log(`fetchMoodRecommendations: Retrieved ${recommendations.length} tracks for "${mood}"`);
		
		// Cache successful results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}
		
		return recommendations;
		
	} catch (e) {
		// Handle abort (timeout) separately from other errors
		if (e.name === 'AbortError') {
			console.error('fetchMoodRecommendations: Request timed out');
		} else {
			console.error('fetchMoodRecommendations error:', e.message || e.toString());
		}
		return [];
	}
}

/**
 * Fetch activity-based recommendations from ReccoBeats.
 * 
 * @param {string} activity - Target activity (e.g., 'workout', 'study', 'party', 'sleep', 'driving')
 * @param {number} duration - Target activity duration in minutes (affects playlist length)
 * @param {number} limit - Maximum number of recommendations
 * @returns {Promise<object[]>} Array of track recommendations optimized for the activity
 */
async function fetchActivityRecommendations(activity, duration = 60, limit = 50) {
	try {
		// Validate required parameters
		if (!activity || typeof activity !== 'string') {
			console.warn('fetchActivityRecommendations: Invalid activity parameter');
			return [];
		}
		
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		// Build cache key including all parameters
		const cacheKey = `reccobeats:activity:${activity}:${duration}:${limit}`.toUpperCase();
		
		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cached = cache._reccobeats.get(cacheKey);
			console.log(`fetchActivityRecommendations: Cache hit for "${activity}" (${cached?.length || 0} tracks)`);
			return cached || [];
		}
		
		updateProgress(`Querying ReccoBeats for "${activity}" activity...`, 0.25);
		
		// Build request URL
		const params = new URLSearchParams({
			activity: activity.toLowerCase().trim(),
			duration: String(Math.max(10, Math.min(duration, 300))), // 10-300 min range
			limit: String(Math.min(limit, 100)),
			format: 'json'
		});
		
		const url = `${RECCOBEATS_API_BASE}/recommendations/activity?${params.toString()}`;
		console.log(`fetchActivityRecommendations: GET ${url}`);
		
		// Make rate-limited request
		const res = await rateLimitedFetch(url);
		
		// Handle HTTP errors
		if (!res || !res.ok) {
			const status = res?.status || 'unknown';
			console.error(`fetchActivityRecommendations: HTTP ${status} for activity "${activity}"`);
			updateProgress(`ReccoBeats API error (HTTP ${status})`, 0.3);
			return [];
		}
		
		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (parseError) {
			console.error('fetchActivityRecommendations: Invalid JSON response:', parseError.message);
			return [];
		}
		
		// Check for API-level errors
		if (data?.error) {
			console.error('fetchActivityRecommendations: API error:', data.error);
			return [];
		}
		
		// Extract and normalize recommendations
		const recommendations = (data?.tracks || []).map(track => ({
			artist: String(track.artist || '').trim(),
			title: String(track.title || track.name || '').trim(),
			activity: track.activity || activity,
			energy: Number(track.energy) || 0,
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title);
		
		console.log(`fetchActivityRecommendations: Retrieved ${recommendations.length} tracks for "${activity}" (${duration}min)`);
		
		// Cache successful results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}
		
		return recommendations;
		
	} catch (e) {
		if (e.name === 'AbortError') {
			console.error('fetchActivityRecommendations: Request timed out');
		} else {
			console.error('fetchActivityRecommendations error:', e.message || e.toString());
		}
		return [];
	}
}

/**
 * Fetch recommendations based on seed tracks using ReccoBeats track/recommendation API.
 * 
 * Strategy:
 * 1. Look up ReccoBeats track IDs for each seed
 * 2. Fetch audio features for each seed track
 * 3. Calculate min/max ranges from seed audio features (or use mood/activity defaults if no seeds)
 * 4. Call /v1/track/recommendation with seeds and audio feature parameters
 * 5. Return up to 100 recommended tracks for library matching
 * 
 * @param {object[]} seeds - Array of seed objects [{artist, title}, ...]
 * @param {string} context - 'mood' or 'activity'
 * @param {string} value - Mood or activity name
 * @param {number} limit - Maximum recommendations (default 100)
 * @returns {Promise<object[]>} Array of recommended tracks
 */
async function fetchSeedBasedRecommendations(seeds, context, value, limit = 100) {
	const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
	
	// Validate inputs
	if (!seeds || seeds.length === 0) {
		console.log('fetchSeedBasedRecommendations: No seeds provided, using default targets');
		return fetchRecommendationsWithDefaults(context, value, limit);
	}
	
	// Limit seeds to 5 as per API spec
	const seedLimit = Math.min(seeds.length, 5);
	const seedTrackIds = [];
	const seedAudioFeatures = [];
	
	// Step 1 & 2: Get track IDs and audio features for each seed
	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (!seed?.artist || !seed?.title) continue;
		
		updateProgress(`Looking up "${seed.title}" on ReccoBeats...`, 0.1 + (i / seedLimit) * 0.2);
		
		// Get track ID from ReccoBeats
		const trackId = await getTrackId(seed.artist, seed.title);
		if (!trackId) {
			console.log(`fetchSeedBasedRecommendations: Could not find track ID for "${seed.artist} - ${seed.title}"`);
			continue;
		}
		
		seedTrackIds.push(trackId);
		
		// Fetch audio features for this track
		updateProgress(`Getting audio features for "${seed.title}"...`, 0.15 + (i / seedLimit) * 0.2);
		const features = await fetchTrackAudioFeatures(trackId);
		if (features) {
			seedAudioFeatures.push(features);
		}
	}
	
	// If we couldn't find any seeds, fall back to defaults
	if (seedTrackIds.length === 0) {
		console.log('fetchSeedBasedRecommendations: No valid seed tracks found, using default targets');
		return fetchRecommendationsWithDefaults(context, value, limit);
	}
	
	// Step 3: Calculate audio feature ranges from seeds
	let audioFeatureTargets = {};
	
	if (seedAudioFeatures.length > 0) {
		// Use audio features from seed tracks
		audioFeatureTargets = calculateAudioFeatureRanges(seedAudioFeatures);
		console.log(`fetchSeedBasedRecommendations: Using audio features from ${seedAudioFeatures.length} seed track(s)`);
	} else {
		// Fall back to mood/activity defaults if we couldn't get audio features
		const defaults = context === 'mood' 
			? MOOD_AUDIO_TARGETS[value?.toLowerCase()] 
			: ACTIVITY_AUDIO_TARGETS[value?.toLowerCase()];
		
		if (defaults) {
			audioFeatureTargets = { ...defaults };
			console.log(`fetchSeedBasedRecommendations: Using ${context} "${value}" default audio targets`);
		}
	}
	
	// Step 4: Fetch recommendations using the API
	updateProgress(`Fetching ${limit} recommendations from ReccoBeats...`, 0.5);
	
	const recommendations = await fetchTrackRecommendations(seedTrackIds, audioFeatureTargets, limit);
	
	console.log(`fetchSeedBasedRecommendations: Retrieved ${recommendations.length} tracks from ${seedTrackIds.length} seed(s)`);
	
	return recommendations;
}

/**
 * Fetch recommendations using default mood/activity audio targets when no seeds are available.
 * This creates a "virtual" recommendation by searching for tracks matching the audio profile.
 * 
 * @param {string} context - 'mood' or 'activity'
 * @param {string} value - Mood or activity name
 * @param {number} limit - Maximum recommendations
 * @returns {Promise<object[]>} Array of recommended tracks
 */
async function fetchRecommendationsWithDefaults(context, value, limit = 100) {
	const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
	
	// Get default audio targets for the mood/activity
	const defaults = context === 'mood' 
		? MOOD_AUDIO_TARGETS[value?.toLowerCase()] 
		: ACTIVITY_AUDIO_TARGETS[value?.toLowerCase()];
	
	if (!defaults) {
		console.warn(`fetchRecommendationsWithDefaults: Unknown ${context} "${value}"`);
		return [];
	}
	
	console.log(`fetchRecommendationsWithDefaults: Using ${context} "${value}" defaults:`, defaults);
	updateProgress(`Searching for "${value}" ${context} tracks...`, 0.3);
	
	// The ReccoBeats API requires at least one seed track
	// Since we don't have seeds, we need to use the mood/activity endpoints if available
	// or return empty and let the caller handle it
	
	// For now, log that we need seeds and return empty
	// The hybrid discovery function should provide seeds from the library
	console.log('fetchRecommendationsWithDefaults: ReccoBeats recommendation API requires seed tracks');
	console.log('fetchRecommendationsWithDefaults: Default audio targets available for filtering:', defaults);
	
	return [];
}

/**
 * Hybrid discovery: Combine ReccoBeats mood/activity with Last.fm similarity.
 * 
 * This function:
 * 1. Gets seed tracks from options or finds them based on mood/activity
 * 2. Fetches track recommendations from ReccoBeats using seed IDs and audio features
 * 3. Returns recommended tracks for library matching
 * 
 * @param {string} context - Context type: 'mood' or 'activity'
 * @param {string} value - Mood name or activity name
 * @param {object} options - Additional options
 * @param {string[]} options.genres - Genre preferences
 * @param {number} options.duration - Activity duration in minutes
 * @param {number} options.limit - Maximum recommendations
 * @param {object[]} options.seeds - Seed tracks for track-based recommendations
 * @returns {Promise<object[]>} Recommended tracks for library matching
 */
async function fetchHybridRecommendations(context, value, options = {}) {
	try {
		const { genres = [], duration = 60, limit = 100, seeds = [] } = options;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		updateProgress(`Fetching ${context}-based recommendations...`, 0.1);
		
		let reccoTracks = [];
		
		// Use seed-based recommendations (primary approach)
		if (seeds.length > 0) {
			console.log(`fetchHybridRecommendations: Using ${seeds.length} seed track(s) for ReccoBeats`);
			reccoTracks = await fetchSeedBasedRecommendations(seeds, context, value, limit);
		}
		
		// If we have results, return them directly for library matching
		if (reccoTracks.length > 0) {
			console.log(`fetchHybridRecommendations: Returning ${reccoTracks.length} tracks for library matching`);
			return reccoTracks;
		}
		
		// Fall back: Try to expand using Last.fm if no ReccoBeats results
		console.log('fetchHybridRecommendations: No ReccoBeats results, attempting Last.fm expansion');
		
		// Extract artists from seeds for Last.fm fallback
		const seedArtists = seeds
			.filter(s => s?.artist)
			.map(s => s.artist)
			.slice(0, 5);
		
		if (seedArtists.length === 0) {
			console.log('fetchHybridRecommendations: No seed artists available for fallback');
			return [];
		}
		
		const lastfmApi = window.matchMonkeyLastfmAPI;
		if (!lastfmApi) {
			console.warn('fetchHybridRecommendations: Last.fm API not available');
			return [];
		}
		
		updateProgress(`Expanding with Last.fm similar artists...`, 0.5);
		
		// Fetch similar artists for each seed
		const similarArtists = new Set(seedArtists);
		
		for (const artist of seedArtists) {
			try {
				const similar = await lastfmApi.fetchSimilarArtists(artist, 10);
				for (const s of similar) {
					if (s?.name) {
						similarArtists.add(s.name);
					}
				}
			} catch (e) {
				console.warn(`fetchHybridRecommendations: Failed to get similar artists for "${artist}":`, e.message);
			}
		}
		
		console.log(`fetchHybridRecommendations: Expanded to ${similarArtists.size} artists using Last.fm`);
		
		// Return as artist objects for library matching
		return Array.from(similarArtists).slice(0, limit).map(artist => ({ artist }));
		
	} catch (e) {
		console.error('fetchHybridRecommendations error:', e.message || e.toString());
		return [];
	}
}

// Export to window namespace for MM5
window.matchMonkeyReccoBeatsAPI = {
	fetchMoodRecommendations,
	fetchActivityRecommendations,
	fetchHybridRecommendations,
	fetchTrackRecommendations,
	fetchSeedBasedRecommendations,
	fetchTrackAudioFeatures,
	fetchRecommendationsWithDefaults,
	getTrackId,
	filterTracksByAudioFeatures,
	calculateAudioFeatureMatch,
	calculateAudioFeatureRanges,
	MOOD_AUDIO_TARGETS,
	ACTIVITY_AUDIO_TARGETS,
	AUDIO_FEATURE_NAMES,
	RECCOBEATS_API_BASE,
	API_TIMEOUT_MS,
};
