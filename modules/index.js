/**
 * SimilarArtists Modules Index
 * 
 * Exports the consolidated module namespace for organized access.
 * All modules are loaded by init.js using localRequirejs().
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

// Build and export the modules namespace
// This is called after all individual modules have been loaded
window.similarArtistsModules = {
	// Configuration
	config: window.similarArtistsConfig,
	
	// Utility modules
	utils: {
		normalization: window.similarArtistsNormalization || {
			normalizeName: window.normalizeName,
			splitArtists: window.splitArtists,
			stripName: window.stripName,
			cacheKeyArtist: window.cacheKeyArtist,
			cacheKeyTopTracks: window.cacheKeyTopTracks,
		},
		helpers: window.similarArtistsHelpers,
		sql: window.similarArtistsSQL,
	},
	
	// Settings modules
	settings: {
		storage: window.similarArtistsStorage,
		prefixes: window.similarArtistsPrefixes,
		lastfm: window.similarArtistsLastfm,
	},
	
	// UI modules
	ui: {
		notifications: window.similarArtistsNotifications,
	},
	
	// API modules
	api: {
		cache: window.lastfmCache,
		lastfmApi: window.similarArtistsLastfmAPI,
	},
	
	// Database modules
	db: window.similarArtistsDB,
	
	// Core modules
	core: {
		discoveryStrategies: window.similarArtistsDiscoveryStrategies,
		orchestration: window.similarArtistsOrchestration,
		autoMode: window.similarArtistsAutoMode,
		mm5Integration: window.similarArtistsMM5Integration,
	},
};
