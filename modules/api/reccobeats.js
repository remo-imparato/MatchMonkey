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
 * MediaMonkey 5 API Only
 */

'use strict';

// ReccoBeats API base endpoint
const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

// Default timeout for API requests (10 seconds)
const API_TIMEOUT_MS = 10000;

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
		
		// Make request with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
		
		let res;
		try {
			res = await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
		
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
		
		// Make request with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
		
		let res;
		try {
			res = await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
		
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
 * Hybrid discovery: Combine ReccoBeats mood/activity with Last.fm similarity.
 * 
 * This function:
 * 1. Fetches mood/activity-appropriate tracks from ReccoBeats
 * 2. Extracts unique artists from those tracks
 * 3. Uses Last.fm to find additional similar artists
 * 4. Returns combined artist candidates for library matching
 * 
 * @param {string} context - Context type: 'mood' or 'activity'
 * @param {string} value - Mood name or activity name
 * @param {object} options - Additional options
 * @param {string[]} options.genres - Genre preferences
 * @param {number} options.duration - Activity duration in minutes
 * @param {number} options.limit - Maximum recommendations
 * @returns {Promise<object[]>} Combined artist recommendations for library matching
 */
async function fetchHybridRecommendations(context, value, options = {}) {
	try {
		const { genres = [], duration = 60, limit = 30 } = options;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		// Step 1: Get ReccoBeats recommendations based on context
		updateProgress(`Fetching ${context}-based recommendations...`, 0.2);
		
		let reccoTracks = [];
		if (context === 'mood') {
			// Request extra tracks for better artist variety
			reccoTracks = await fetchMoodRecommendations(value, genres, limit * 2);
		} else if (context === 'activity') {
			reccoTracks = await fetchActivityRecommendations(value, duration, limit * 2);
		} else {
			console.warn(`fetchHybridRecommendations: Unknown context "${context}"`);
			return [];
		}
		
		if (reccoTracks.length === 0) {
			console.log('fetchHybridRecommendations: ReccoBeats returned no results');
			return [];
		}
		
		// Step 2: Extract unique artists from ReccoBeats results
		const artistSet = new Set();
		for (const track of reccoTracks) {
			if (track.artist) {
				artistSet.add(track.artist);
			}
		}
		
		// Take top 5 artists as seeds for Last.fm expansion
		const seedArtists = Array.from(artistSet).slice(0, 5);
		console.log(`fetchHybridRecommendations: Using ${seedArtists.length} seed artists from ReccoBeats`);
		
		// Step 3: Expand using Last.fm similar artists
		const lastfmApi = window.matchMonkeyLastfmAPI;
		if (!lastfmApi) {
			console.warn('fetchHybridRecommendations: Last.fm API not available, returning ReccoBeats results only');
			return reccoTracks.slice(0, limit).map(t => ({ artist: t.artist }));
		}
		
		updateProgress(`Expanding with Last.fm similar artists...`, 0.35);
		
		// Include seed artists in results
		const similarArtists = new Set(seedArtists);
		
		// Fetch similar artists for each seed (limited to avoid too many API calls)
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
		
		// Step 4: Return as artist candidates
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
	RECCOBEATS_API_BASE,
	API_TIMEOUT_MS,
};
