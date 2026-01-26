/**
 * ReccoBeats API Integration Module
 * 
 * Fetches AI-powered music recommendations based on mood, activity, and genre.
 * Complements Last.fm API with enhanced context-aware discovery.
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

/**
 * Fetch mood-based recommendations from ReccoBeats.
 * 
 * @param {string} mood - Target mood (e.g., 'energetic', 'relaxed', 'happy', 'sad')
 * @param {string[]} genres - Array of genre preferences
 * @param {number} limit - Maximum number of recommendations (default: 50)
 * @returns {Promise<object[]>} Array of track recommendations with artist and title
 */
async function fetchMoodRecommendations(mood, genres = [], limit = 50) {
	try {
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		// Build cache key
		const cacheKey = `reccobeats:mood:${mood}:${genres.join(',')}:${limit}`.toUpperCase();
		
		// Check cache
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			console.log(`fetchMoodRecommendations: Using cached results for mood "${mood}"`);
			return cache._reccobeats.get(cacheKey) || [];
		}
		
		updateProgress(`Fetching ${mood} mood recommendations...`, 0.3);
		
		const params = new URLSearchParams({
			mood: mood,
			limit: String(limit),
			format: 'json'
		});
		
		if (genres.length > 0) {
			params.set('genres', genres.join(','));
		}
		
		const url = `${RECCOBEATS_API_BASE}/recommendations/mood?${params.toString()}`;
		console.log(`fetchMoodRecommendations: querying ${url}`);
		
		const res = await fetch(url);
		
		if (!res || !res.ok) {
			console.error(`fetchMoodRecommendations: HTTP ${res?.status}`);
			return [];
		}
		
		const data = await res.json();
		
		if (data?.error) {
			console.error('fetchMoodRecommendations: API error:', data.error);
			return [];
		}
		
		// Extract recommendations (artist + title)
		const recommendations = (data?.tracks || []).map(track => ({
			artist: track.artist || '',
			title: track.title || track.name || '',
			mood: track.mood || mood,
			energy: Number(track.energy) || 0,
			valence: Number(track.valence) || 0,
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title);
		
		console.log(`fetchMoodRecommendations: Found ${recommendations.length} recommendations for mood "${mood}"`);
		
		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}
		
		return recommendations;
		
	} catch (e) {
		console.error('fetchMoodRecommendations error:', e.toString());
		return [];
	}
}

/**
 * Fetch activity-based recommendations from ReccoBeats.
 * 
 * @param {string} activity - Target activity (e.g., 'workout', 'study', 'party', 'sleep')
 * @param {number} duration - Activity duration in minutes (optional)
 * @param {number} limit - Maximum recommendations
 * @returns {Promise<object[]>} Track recommendations
 */
async function fetchActivityRecommendations(activity, duration = 60, limit = 50) {
	try {
		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});
		
		const cacheKey = `reccobeats:activity:${activity}:${duration}:${limit}`.toUpperCase();
		
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			console.log(`fetchActivityRecommendations: Using cached results for "${activity}"`);
			return cache._reccobeats.get(cacheKey) || [];
		}
		
		updateProgress(`Fetching "${activity}" activity playlist...`, 0.3);
		
		const params = new URLSearchParams({
			activity: activity,
			duration: String(duration),
			limit: String(limit),
			format: 'json'
		});
		
		const url = `${RECCOBEATS_API_BASE}/recommendations/activity?${params.toString()}`;
		console.log(`fetchActivityRecommendations: querying ${url}`);
		
		const res = await fetch(url);
		
		if (!res || !res.ok) {
			console.error(`fetchActivityRecommendations: HTTP ${res?.status}`);
			return [];
		}
		
		const data = await res.json();
		
		if (data?.error) {
			console.error('fetchActivityRecommendations: API error:', data.error);
			return [];
		}
		
		const recommendations = (data?.tracks || []).map(track => ({
			artist: track.artist || '',
			title: track.title || track.name || '',
			activity: track.activity || activity,
			energy: Number(track.energy) || 0,
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title);
		
		console.log(`fetchActivityRecommendations: Found ${recommendations.length} tracks for "${activity}"`);
		
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}
		
		return recommendations;
		
	} catch (e) {
		console.error('fetchActivityRecommendations error:', e.toString());
		return [];
	}
}

/**
 * Hybrid discovery: Combine ReccoBeats mood/activity with Last.fm similarity.
 * Uses ReccoBeats to find tracks matching mood/activity, then uses Last.fm
 * to find similar artists/tracks from your library.
 * 
 * @param {string} context - Context type: 'mood' or 'activity'
 * @param {string} value - Mood name or activity name
 * @param {object} options - Additional options (genres, duration, limit)
 * @returns {Promise<object[]>} Combined recommendations
 */
async function fetchHybridRecommendations(context, value, options = {}) {
	try {
		const { genres = [], duration = 60, limit = 30 } = options;
		
		// Step 1: Get ReccoBeats recommendations
		let reccoTracks = [];
		if (context === 'mood') {
			reccoTracks = await fetchMoodRecommendations(value, genres, limit * 2);
		} else if (context === 'activity') {
			reccoTracks = await fetchActivityRecommendations(value, duration, limit * 2);
		}
		
		if (reccoTracks.length === 0) {
			console.log('fetchHybridRecommendations: No ReccoBeats results');
			return [];
		}
		
		// Step 2: Extract unique artists from ReccoBeats results
		const artistSet = new Set();
		for (const track of reccoTracks) {
			if (track.artist) artistSet.add(track.artist);
		}
		
		const seedArtists = Array.from(artistSet).slice(0, 5); // Top 5 artists
		console.log(`fetchHybridRecommendations: Using ${seedArtists.length} seed artists from ReccoBeats`);
		
		// Step 3: Use Last.fm to find similar artists
		const lastfmApi = window.matchMonkeyLastfmAPI;
		if (!lastfmApi) {
			console.warn('fetchHybridRecommendations: Last.fm API not available');
			return reccoTracks.slice(0, limit);
		}
		
		const similarArtists = new Set(seedArtists); // Include seed artists
		
		for (const artist of seedArtists) {
			const similar = await lastfmApi.fetchSimilarArtists(artist, 10);
			for (const s of similar) {
				if (s?.name) similarArtists.add(s.name);
			}
		}
		
		console.log(`fetchHybridRecommendations: Expanded to ${similarArtists.size} artists using Last.fm`);
		
		// Step 4: Return combined artist list as candidates
		return Array.from(similarArtists).map(artist => ({ artist }));
		
	} catch (e) {
		console.error('fetchHybridRecommendations error:', e.toString());
		return [];
	}
}

// Export to window namespace
window.matchMonkeyReccoBeatsAPI = {
	fetchMoodRecommendations,
	fetchActivityRecommendations,
	fetchHybridRecommendations,
	RECCOBEATS_API_BASE,
};
