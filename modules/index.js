/**
 * SimilarArtists Modules Index
 * 
 * Central export point for all refactored modules.
 * Allows importing with: const { storage, normalization, db, ... } = localRequirejs('modules');
 */

'use strict';

// Configuration
localRequirejs('./config');

// Utilities
localRequirejs('utils/normalization');
localRequirejs('utils/helpers');
localRequirejs('utils/sql');

// Settings
localRequirejs('settings/storage');
localRequirejs('settings/prefixes');
localRequirejs('settings/lastfm');

// UI
localRequirejs('ui/notifications');

// API
localRequirejs('api/cache');
localRequirejs('api/lastfm');

// Database
localRequirejs('db/index');

// Core: Orchestration, Auto-Mode, and MM5 Integration
localRequirejs('core/orchestration');
localRequirejs('core/autoMode');
localRequirejs('core/mm5Integration');

// Export to window namespace
window.similarArtistsModules = {
	config: window.similarArtistsConfig,
	utils: {
		normalization: {
			normalizeArtistName: window.normalizeArtistName,
			normalizeTrackTitle: window.normalizeTrackTitle,
		},
		helpers: window.similarArtistsHelpers,
		sql: window.similarArtistsSQL,
	},
	settings: {
		storage: window.similarArtistsStorage,
		prefixes: window.similarArtistsPrefixes,
		lastfm: window.similarArtistsLastfm,
	},
	ui: {
		notifications: window.similarArtistsNotifications,
	},
	api: {
		cache: window.lastfmCache,
		lastfmApi: window.similarArtistsLastfmAPI,
	},
	db: window.similarArtistsDB,
	core: {
		orchestration: window.similarArtistsOrchestration,
		autoMode: window.similarArtistsAutoMode,
		mm5Integration: window.similarArtistsMM5Integration,
	},
};
