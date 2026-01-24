/**
 * SimilarArtists Add-on for MediaMonkey 5
 * 
 * Complete refactored implementation using modular architecture.
 * Supports three discovery modes:
 * - Artist-based: Find similar artists (artist.getSimilar API)
 * - Track-based: Find similar tracks (track.getSimilar API)
 * - Genre-based: Find artists in same genre (tag.getTopArtists API)
 * 
 * @author Remo Imparato
 * @version 2.1.0
 * @description Generates playlists or queues tracks from similar artists/tracks/genres using Last.fm API.
 *              Supports automatic mode to queue similar tracks when approaching end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 */

(function(globalArg) {
	'use strict';	
	
	// Wait for all modules to load, then initialize
	requestAnimationFrame(function() {
		requestAnimationFrame(function() {
			// Get modules from window namespace
			const modules = {
				config: globalArg.similarArtistsConfig,
				utils: {
					normalization: {
						normalizeName: globalArg.normalizeName,
						splitArtists: globalArg.splitArtists,
						stripName: globalArg.stripName,
						cacheKeyArtist: globalArg.cacheKeyArtist,
						cacheKeyTopTracks: globalArg.cacheKeyTopTracks,
					},
					helpers: globalArg.similarArtistsHelpers,
					sql: globalArg.similarArtistsSQL,
				},
				settings: {
					storage: globalArg.similarArtistsStorage,
					prefixes: globalArg.similarArtistsPrefixes,
					lastfm: globalArg.similarArtistsLastfm,
				},
				ui: {
					notifications: globalArg.similarArtistsNotifications,
				},
				api: {
					cache: globalArg.lastfmCache,
					lastfmApi: globalArg.similarArtistsLastfmAPI,
				},
				db: globalArg.similarArtistsDB,
				core: {
					orchestration: globalArg.similarArtistsOrchestration,
					autoMode: globalArg.similarArtistsAutoMode,
					mm5Integration: globalArg.similarArtistsMM5Integration,
				},
			};
			
			if (!modules.config) {
				console.error('SimilarArtists: Failed to load modules - config not found');
				return;
			}
			
			if (!modules.db || !modules.db.findLibraryTracksBatch) {
				console.error('SimilarArtists: Failed to load modules - db.findLibraryTracksBatch not found');
				return;
			}
			
			console.log('SimilarArtists: Modules loaded successfully');
			initializeSimilarArtists(modules);
		});
	});
	
	function initializeSimilarArtists(modules) {
		const { config, settings: { storage }, core: { orchestration, autoMode, mm5Integration } } = modules;

		// Create runtime state
		const appState = {
			mm5Integration: null,
			autoModeState: null,
			settingsUnsubscribe: null,
			started: false,
		};

		// ============================================================================
		// DISCOVERY MODES
		// ============================================================================
		
		/**
		 * Discovery mode types
		 * - 'artist': Use artist.getSimilar to find similar artists
		 * - 'track': Use track.getSimilar to find musically similar tracks
		 * - 'genre': Use tag.getTopArtists to find artists in same genre
		 */
		const DISCOVERY_MODES = {
			ARTIST: 'artist',
			TRACK: 'track',
			GENRE: 'genre'
		};

		// ============================================================================
		// MAIN ENTRY POINTS
		// ============================================================================

		/**
		 * Run similar discovery workflow.
		 * 
		 * Main entry point for all action handlers.
		 * 
		 * @param {boolean} [autoModeFlag=false] - Whether running in auto-mode
		 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', or 'genre'
		 * @returns {Promise<object>} Result from orchestration
		 */
		async function runSimilarArtists(autoModeFlag = false, discoveryMode = DISCOVERY_MODES.ARTIST) {
			try {
				// Validate discovery mode
				const validModes = Object.values(DISCOVERY_MODES);
				if (!validModes.includes(discoveryMode)) {
					console.warn(`SimilarArtists: Invalid discovery mode "${discoveryMode}", defaulting to "artist"`);
					discoveryMode = DISCOVERY_MODES.ARTIST;
				}
				
				console.log(`SimilarArtists: Running (autoMode=${autoModeFlag}, discoveryMode=${discoveryMode})`);
				
				const result = await orchestration.generateSimilarPlaylist(modules, autoModeFlag, discoveryMode);
				
				if (result.success) {
					console.log(`SimilarArtists: Success - added ${result.tracksAdded} tracks`);
				} else {
					console.log(`SimilarArtists: Completed with message - ${result.error}`);
				}
				
				return result;

			} catch (e) {
				console.error(`SimilarArtists: Error in runSimilarArtists: ${e.toString()}`);
				// Don't throw - return error result instead
				return {
					success: false,
					error: e.message || String(e),
					tracksAdded: 0,
				};
			}
		}

		/**
		 * Toggle auto-mode on/off.
		 */
		function toggleAuto() {
			try {
				console.log('SimilarArtists: Toggling auto-mode');

				const { getSetting, setSetting } = storage;
				
				const currentState = autoMode.isAutoModeEnabled(getSetting);
				const newState = !currentState;
				
				setSetting('OnPlay', newState);
				console.log(`SimilarArtists: Auto-mode setting changed from ${currentState} to ${newState}`);
				
				if (!appState.autoModeState) {
					initializeAutoMode();
				}
				
				if (appState.autoModeState) {
					const handler = createAutoTriggerHandler();
					autoMode.syncAutoModeListener(
						appState.autoModeState,
						getSetting,
						handler,
						console.log
					);
				}
				
				updateAutoModeUI(newState);
				
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}
				
				console.log(`SimilarArtists: Auto-mode is now ${newState ? 'enabled' : 'disabled'}`);

			} catch (e) {
				console.error(`SimilarArtists: Error in toggleAuto: ${e.toString()}`);
			}
		}

		/**
		 * Check if auto-mode is enabled.
		 */
		function isAutoEnabled() {
			try {
				const { getSetting } = storage;
				return autoMode.isAutoModeEnabled(getSetting);
			} catch (e) {
				return false;
			}
		}

		// ============================================================================
		// AUTO-MODE SETUP
		// ============================================================================

		let cachedAutoTriggerHandler = null;

		function createAutoTriggerHandler() {
			if (cachedAutoTriggerHandler) return cachedAutoTriggerHandler;

			const { getSetting } = storage;
			const { showToast } = modules.ui.notifications;

			cachedAutoTriggerHandler = autoMode.createAutoTriggerHandler({
				getSetting,
				// AUTO-MODE USES TRACK-BASED DISCOVERY for seamless playlist continuation
				// This finds tracks similar to the currently playing track, maintaining the mood
				generateSimilarPlaylist: (autoModeFlag) => {
					console.log('SimilarArtists Auto-Mode: Using Similar Tracks discovery for seamless continuation');
					return orchestration.generateSimilarPlaylist(modules, autoModeFlag, DISCOVERY_MODES.TRACK);
				},
				showToast,
				isAutoModeEnabled: () => autoMode.isAutoModeEnabled(getSetting),
				threshold: 2,
				logger: console.log,
			});

			return cachedAutoTriggerHandler;
		}

		function initializeAutoMode() {
			try {
				console.log('SimilarArtists: Initializing auto-mode (using Similar Tracks discovery)');

				const { getSetting } = storage;
				const handler = createAutoTriggerHandler();

				appState.autoModeState = autoMode.initializeAutoMode(
					getSetting,
					handler,
					console.log
				);

				console.log('SimilarArtists: Auto-mode initialized');

			} catch (e) {
				console.error(`SimilarArtists: Error initializing auto-mode: ${e.toString()}`);
			}
		}

		function shutdownAutoMode() {
			try {
				if (appState.autoModeState) {
					autoMode.shutdownAutoMode(appState.autoModeState, console.log);
					appState.autoModeState = null;
				}
			} catch (e) {
				console.error(`SimilarArtists: Error shutting down auto-mode: ${e.toString()}`);
			}
		}

		// ============================================================================
		// MM5 UI INTEGRATION
		// ============================================================================

		function updateAutoModeUI(enabled) {
			try {
				const { mm5Integration: integration } = appState;
				if (!integration) return;

				const toolbarId = config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle';
				mm5Integration.updateToolbarIcon(toolbarId, enabled, console.log);
				mm5Integration.updateActionState('SimilarArtistsToggleAuto', console.log);
				
				try {
					const event = new CustomEvent('similarartists:automodechanged', {
						detail: { enabled: enabled }
					});
					window.dispatchEvent(event);
				} catch (e) { /* ignore */ }

			} catch (e) {
				console.error(`SimilarArtists: Error updating UI: ${e.toString()}`);
			}
		}

		function onSettingsChanged() {
			try {
				const { getSetting } = storage;

				if (!appState.autoModeState) {
					initializeAutoMode();
				}

				if (appState.autoModeState) {
					const handler = createAutoTriggerHandler();
					autoMode.syncAutoModeListener(
						appState.autoModeState,
						getSetting,
						handler,
						console.log
					);
				}

				const enabled = isAutoEnabled();
				updateAutoModeUI(enabled);
				
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}

			} catch (e) {
				console.error(`SimilarArtists: Error in onSettingsChanged: ${e.toString()}`);
			}
		}

		// ============================================================================
		// ADD-ON LIFECYCLE
		// ============================================================================

		function start() {
			if (appState.started) {
				console.log('SimilarArtists: Already started');
				return;
			}

			appState.started = true;

			try {
				console.log('SimilarArtists: Starting add-on...');

				const mmStatus = mm5Integration.checkMM5Availability();
				if (!mmStatus.available) {
					console.error(`SimilarArtists: MM5 API not available. Missing: ${mmStatus.missing.join(', ')}`);
					return;
				}

				appState.mm5Integration = mm5Integration.initializeIntegration({
					onSettingChanged: onSettingsChanged,
					isAutoEnabled: isAutoEnabled,
					toolbarButtonId: config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle',
					logger: console.log,
				});

				initializeAutoMode();

				console.log('SimilarArtists: Add-on started successfully');

			} catch (e) {
				console.error(`SimilarArtists: Error during startup: ${e.toString()}`);
				appState.started = false;
			}
		}

		function shutdown() {
			try {
				console.log('SimilarArtists: Shutting down...');

				if (appState.mm5Integration) {
					mm5Integration.shutdownIntegration(appState.mm5Integration, console.log);
					appState.mm5Integration = null;
				}

				shutdownAutoMode();

				if (appState.settingsUnsubscribe) {
					appState.settingsUnsubscribe();
					appState.settingsUnsubscribe = null;
				}

				appState.started = false;
				console.log('SimilarArtists: Shutdown complete');

			} catch (e) {
				console.error(`SimilarArtists: Error during shutdown: ${e.toString()}`);
			}
		}

		// ============================================================================
		// EXPORT TO GLOBAL
		// ============================================================================

		globalArg.SimilarArtists = {
			// Core entry points
			start,
			shutdown,
			runSimilarArtists,
			toggleAuto,
			isAutoEnabled,

			// Discovery modes (for external use)
			DISCOVERY_MODES,

			// Lifecycle
			isStarted: () => appState.started,

			// Status and info
			getState: () => ({
				started: appState.started,
				autoModeEnabled: isAutoEnabled(),
			}),

			// Module access
			modules,
			config,
			
			// Flag to indicate modules are loaded
			_modulesLoaded: true,
		};

		console.log('SimilarArtists: Modules loaded and ready');
	}

})(typeof window !== 'undefined' ? window : global);
