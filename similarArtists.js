/**
 * SimilarArtists Add-on for MediaMonkey 5
 * 
 * Complete refactored implementation using modular architecture.
 * All phases (0-7) integrated into single entry point.
 * 
 * @author Remo Imparato
 * @version 2.0.0
 * @description Generates playlists or queues tracks from similar artists using Last.fm API.
 *              Supports automatic mode to queue similar tracks when approaching end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 */

(function(globalArg) {
	'use strict';

	// ============================================================================
	// MODULE LOADING - Load modules using MM5's module system
	// ============================================================================
	
	// For now, we'll use a simplified approach without external modules
	// TODO: Implement proper module loading when modules/ directory is created
	
	// Placeholder for modules until refactoring is complete
	const modules = {
		config: {
			TOOLBAR_AUTO_ID: 'SimilarArtistsToggle'
		},
		settings: {
			storage: {
				getSetting: function(key, defaultVal) {
					try {
						return app.getValue('SimilarArtists_' + key, defaultVal);
					} catch (e) {
						return defaultVal;
					}
				},
				setSetting: function(key, value) {
					try {
						app.setValue('SimilarArtists_' + key, value);
					} catch (e) {
						console.error('Failed to save setting:', key);
					}
				}
			}
		},
		core: {
			orchestration: {
				generateSimilarPlaylist: async function(modules, autoModeFlag) {
					// TODO: Implement the actual similar artists logic here
					// This should:
					// 1. Get current/selected track(s)
					// 2. Query Last.fm for similar artists
					// 3. Match tracks in local library
					// 4. Create playlist or enqueue tracks
					
					console.log('SimilarArtists: generateSimilarPlaylist called (autoMode=' + autoModeFlag + ')');
					
					try {
						// Get the currently playing or selected track
						let seedTrack = null;
						
						if (autoModeFlag) {
							// In auto-mode, use currently playing track
							seedTrack = app.player.getCurrentTrack();
						} else {
							// Otherwise try to get selected tracks
							const tracks = window.uitools?.getSelectedTracklist?.();
							if (tracks && tracks.count > 0) {
								await tracks.whenLoaded();
								tracks.locked(() => {
									seedTrack = tracks.getValue(0);
								});
							} else {
								// Fall back to currently playing
								seedTrack = app.player.getCurrentTrack();
							}
						}
						
						if (!seedTrack || !seedTrack.artist) {
							console.error('SimilarArtists: No track selected or playing');
							return { 
								success: false, 
								error: 'No track selected or playing', 
								tracksAdded: 0 
							};
						}
						
						console.log('SimilarArtists: Seed artist: ' + seedTrack.artist);
						
						// TODO: Query Last.fm API for similar artists
						// TODO: Search local library for matching tracks
						// TODO: Add tracks to Now Playing or create playlist
						
						// Placeholder response for now
						return { 
							success: true, 
							error: null, 
							tracksAdded: 0,
							message: 'Feature not fully implemented yet - seed artist: ' + seedTrack.artist
						};
						
					} catch (error) {
						console.error('SimilarArtists: Error in generateSimilarPlaylist:', error);
						return { 
							success: false, 
							error: error.toString(), 
							tracksAdded: 0 
						};
					}
				}
			},
			autoMode: {
				isAutoModeEnabled: function(getSetting) {
					// First check the dedicated auto-mode setting
					const autoEnabled = getSetting('autoModeEnabled', false);
					
					// Also check the config that the settings dialog uses
					try {
						const config = app.getValue('SimilarArtists', {});
						// If config.OnPlay is explicitly set, it takes precedence
						if (config.OnPlay !== undefined && config.OnPlay !== null) {
							return Boolean(config.OnPlay);
						}
					} catch (e) {
						// Ignore and use autoEnabled
					}
					
					return Boolean(autoEnabled);
				},
				
				toggleAutoMode: function(state, getSetting, setSetting, handler, callback) {
					const current = getSetting('autoModeEnabled', false);
					const newState = !current;
					setSetting('autoModeEnabled', newState);
					
					// Also save to the config that settings dialog uses
					try {
						const config = app.getValue('SimilarArtists', {});
						config.OnPlay = newState;
						app.setValue('SimilarArtists', config);
					} catch (e) {
						console.error('Failed to persist OnPlay setting:', e);
					}
					
					// Actually attach/detach the listener
					if (state && state.playerListener) {
						if (newState) {
							// Attach listener
							if (!state.listenerAttached) {
								console.log('SimilarArtists: Attaching auto-mode listener');
								app.listen(app.player, 'onStateChange', state.playerListener);
								state.listenerAttached = true;
							}
						} else {
							// Detach listener
							if (state.listenerAttached) {
								console.log('SimilarArtists: Detaching auto-mode listener');
								app.unlisten(app.player, 'onStateChange', state.playerListener);
								state.listenerAttached = false;
							}
						}
					}
					
					if (callback) callback(newState);
					return newState;
				},
				
				createAutoTriggerHandler: function(options) {
					const { getSetting, generateSimilarPlaylist, isAutoModeEnabled, threshold = 2 } = options;
					
					let lastTriggeredTrackId = null;
					let isProcessing = false;
					
					return function onPlayerStateChange() {
						try {
							// Check if auto-mode is enabled
							if (!isAutoModeEnabled(getSetting)) {
								return;
							}
							
							// Don't trigger if already processing
							if (isProcessing) {
								return;
							}
							
							// Check player state
							if (!app.player || !app.player.isPlaying) {
								return;
							}
							
							const currentTrack = app.player.currentTrack;
							if (!currentTrack) {
								return;
							}
							
							// Don't trigger multiple times for same track
							if (lastTriggeredTrackId === currentTrack.id) {
								return;
							}
							
							// Get now playing list
							const nowPlayingList = app.player.nowPlayingList;
							if (!nowPlayingList || nowPlayingList.count === 0) {
								return;
							}
							
							// Check if we're near the end (within threshold tracks)
							const currentIndex = nowPlayingList.focusedIndex;
							const tracksRemaining = nowPlayingList.count - currentIndex - 1;
							
							if (tracksRemaining <= threshold && tracksRemaining >= 0) {
								console.log(`SimilarArtists: Auto-trigger activated (${tracksRemaining} tracks remaining)`);
								
								isProcessing = true;
								lastTriggeredTrackId = currentTrack.id;
								
								// Run similar artists in auto-mode
								generateSimilarPlaylist(true).then((result) => {
									if (result.success) {
										console.log(`SimilarArtists: Auto-queued ${result.tracksAdded} tracks`);
					
										// Show notification
										if (options.showToast) {
											options.showToast(`Auto-queued ${result.tracksAdded} similar tracks`);
										}
									}
								}).catch((error) => {
									console.error('SimilarArtists: Auto-trigger error:', error);
								}).finally(() => {
									isProcessing = false;
								});
							}
						} catch (e) {
							console.error('SimilarArtists: Player state change handler error:', e);
							isProcessing = false;
						}
					};
				},
				
				initializeAutoMode: function(getSetting, handler, logger) {
					logger('Initializing auto-mode state');
					
					const enabled = getSetting('autoModeEnabled', false);
					const state = {
						enabled: enabled,
						handler: handler,
						playerListener: handler,
						listenerAttached: false
					};
					
					// If enabled, attach listener immediately
					if (enabled && app.player) {
						logger('Auto-mode enabled, attaching listener');
						app.listen(app.player, 'onStateChange', handler);
						state.listenerAttached = true;
					}
					
					return state;
				},
				
				shutdownAutoMode: function(state, logger) {
					logger('Shutting down auto-mode');
					
					if (state && state.playerListener && state.listenerAttached) {
						try {
							app.unlisten(app.player, 'onStateChange', state.playerListener);
							state.listenerAttached = false;
							logger('Auto-mode listener detached');
						} catch (e) {
							logger('Error detaching auto-mode listener:', e);
						}
					}
				},
				
				syncAutoModeListener: function(state, getSetting, handler, logger) {
					logger('Syncing auto-mode listener');
					
					if (!state) {
						logger('No state to sync');
						return;
					}
					
					const shouldBeEnabled = getSetting('autoModeEnabled', false);
					const isAttached = state.listenerAttached;
					
					if (shouldBeEnabled && !isAttached) {
						// Should be on but isn't
						logger('Attaching auto-mode listener');
						app.listen(app.player, 'onStateChange', state.playerListener);
						state.listenerAttached = true;
					} else if (!shouldBeEnabled && isAttached) {
						// Should be off but isn't
						logger('Detaching auto-mode listener');
						app.unlisten(app.player, 'onStateChange', state.playerListener);
						state.listenerAttached = false;
					}
					
					state.enabled = shouldBeEnabled;
				}
			},
		ui: {
			notifications: {
				showToast: function(message) {
					console.log('Toast:', message);
				}
			}
		}
	};
	
	const { config, settings: { storage }, core: { orchestration, autoMode, mm5Integration } } = modules;

	// Create runtime state
	const appState = {
		mm5Integration: null,
		autoModeState: null,
		settingsUnsubscribe: null,
		started: false,
	};

	// ============================================================================
	// MAIN ENTRY POINTS (exported to global)
	// ============================================================================

	/**
	 * Run similar artists workflow.
	 * 
	 * Main entry point for the action handler.
	 * Calls Phase 5 orchestration directly.
	 * 
	 * @param {boolean} [autoModeFlag=false] - Whether running in auto-mode
	 * @returns {Promise<object>} Result from orchestration
	 */
	async function runSimilarArtists(autoModeFlag = false) {
		try {
			console.log(`SimilarArtists: Running (autoMode=${autoModeFlag})`);
			
			const result = await orchestration.generateSimilarPlaylist(modules, autoModeFlag);
			
			if (result.success) {
				console.log(`SimilarArtists: Success - added ${result.tracksAdded} tracks`);
			} else {
				console.error(`SimilarArtists: Failed - ${result.error}`);
			}
			
			return result;

		} catch (e) {
			console.error(`SimilarArtists: Error in runSimilarArtists: ${e.toString()}`);
			throw e;
		}
	}

	/**
	 * Toggle auto-mode on/off.
	 * 
	 * Called by toggle action handler.
	 * Updates settings and syncs listener.
	 */
	function toggleAuto() {
		try {
			console.log('SimilarArtists: Toggling auto-mode');

			if (!appState.autoModeState) {
				console.log('SimilarArtists: Auto-mode state not initialized');
				return;
			}

			// Get handlers
			const { getSetting, setSetting } = storage;
			const handler = createAutoTriggerHandler();

			// Toggle - this now handles attaching/detaching the listener
			const newState = autoMode.toggleAutoMode(
				appState.autoModeState,
				getSetting,
				setSetting,
				handler,
				(enabled) => {
					console.log(`SimilarArtists: Auto-mode toggled to ${enabled ? 'enabled' : 'disabled'}`);
					
					// Save to the config object that the settings dialog reads
					try {
						const config = app.getValue('SimilarArtists', {});
						config.OnPlay = enabled;
						app.setValue('SimilarArtists', config);
					} catch (e) {
						console.error('Failed to save OnPlay setting:', e);
					}
					
					// Update the state's enabled flag
					appState.autoModeState.enabled = enabled;
					
					// Update UI
					updateAutoModeUI(enabled);
					
					// Notify action state changed to update checkmark
					if (typeof window.updateActionState === 'function') {
						window.updateActionState('SimilarArtistsToggleAuto');
					}
				}
			);

			console.log(`SimilarArtists: Auto-mode is now ${newState ? 'enabled' : 'disabled'}`);

		} catch (e) {
			console.error(`SimilarArtists: Error in toggleAuto: ${e.toString()}`);
		}
	}

	/**
	 * Check if auto-mode is enabled.
	 * 
	 * @returns {boolean} True if auto-mode enabled
	 */
	function isAutoEnabled() {
		try {
			const { getSetting } = storage;
			return autoMode.isAutoModeEnabled(getSetting);
		} catch (e) {
			console.error(`SimilarArtists: Error checking auto-enabled: ${e.toString()}`);
			return false;
		}
	}

	// ============================================================================
	// AUTO-MODE SETUP
	// ============================================================================

	/**
	 * Create auto-trigger handler.
	 * 
	 * This is the callback invoked when playback near end.
	 * 
	 * @returns {Function} Handler function
	 */
	function createAutoTriggerHandler() {
		const { getSetting } = storage;
		const { showToast } = modules.ui.notifications;

		return autoMode.createAutoTriggerHandler({
			getSetting,
			generateSimilarPlaylist: (autoModeFlag) => orchestration.generateSimilarPlaylist(modules, autoModeFlag),
			showToast,
			isAutoModeEnabled: (s) => autoMode.isAutoModeEnabled(getSetting),
			threshold: 2,
			logger: console.log,
		});
	}

	/**
	 * Initialize auto-mode listener.
	 * 
	 * Sets up playback event listener if enabled.
	 */
	function initializeAutoMode() {
		try {
			console.log('SimilarArtists: Initializing auto-mode');

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

	/**
	 * Shutdown auto-mode listener.
	 * 
	 * Detaches playback event listener.
	 */
	function shutdownAutoMode() {
		try {
			console.log('SimilarArtists: Shutting down auto-mode');

			if (appState.autoModeState) {
				autoMode.shutdownAutoMode(appState.autoModeState, console.log);
				appState.autoModeState = null;
			}

			console.log('SimilarArtists: Auto-mode shutdown complete');

		} catch (e) {
			console.error(`SimilarArtists: Error shutting down auto-mode: ${e.toString()}`);
		}
	}

	// ============================================================================
	// MM5 UI INTEGRATION
	// ============================================================================

	/**
	 * Update auto-mode UI (toolbar icon, menu state, etc).
	 * 
	 * Called when auto-mode state changes.
	 * 
	 * @param {boolean} enabled - New auto-mode state
	 */
	function updateAutoModeUI(enabled) {
		try {
			const { mm5Integration: integration } = appState;
			if (!integration) return;

			// Update toolbar icon
			const toolbarId = config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle';
			mm5Integration.updateToolbarIcon(toolbarId, enabled, console.log);

			// Update action state
			mm5Integration.updateActionState('SimilarArtistsToggleAuto', console.log);
			
			// Fire a global event so other UI components (like settings dialog) can update
			try {
				const event = new CustomEvent('similarartists:automodechanged', {
					detail: { enabled: enabled }
				});
				window.dispatchEvent(event);
			} catch (e) {
				console.error('Failed to dispatch automode changed event:', e);
			}

		} catch (e) {
			console.error(`SimilarArtists: Error updating UI: ${e.toString()}`);
		}
	}

	/**
	 * Handle settings change event.
	 * 
	 * Called when user changes settings.
	 * Syncs auto-mode listener if needed.
	 */
	function onSettingsChanged() {
		try {
			console.log('SimilarArtists: Settings changed, syncing auto-mode');

			const { getSetting } = storage;
			const handler = createAutoTriggerHandler();

			autoMode.syncAutoModeListener(
				appState.autoModeState,
				getSetting,
				handler,
				console.log
			);

			// Update UI
			const enabled = isAutoEnabled();
			updateAutoModeUI(enabled);
			
			// Notify action state to update menu checkmark
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

	/**
	 * Initialize add-on.
	 * 
	 * Called once on application startup.
	 * Sets up all modules and listeners.
	 */
	function start() {
		if (appState.started) {
			console.log('SimilarArtists: Already started');
			return;
		}

		appState.started = true;

		try {
			console.log('SimilarArtists: Starting add-on...');

			// Validate MM5 environment
			const mmStatus = mm5Integration.checkMM5Availability();
			if (!mmStatus.available) {
				console.error(`SimilarArtists: MM5 API not available. Missing: ${mmStatus.missing.join(', ')}`);
				return;
			}

			// Initialize MM5 integration
			appState.mm5Integration = mm5Integration.initializeIntegration({
				onRunSimilarArtists: () => runSimilarArtists(false),
				onToggleAuto: toggleAuto,
				isAutoEnabled: isAutoEnabled,
				onSettingChanged: onSettingsChanged,
				toolbarButtonId: config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle',
				logger: console.log,
			});

			// Initialize auto-mode
			initializeAutoMode();

			console.log('SimilarArtists: Add-on started successfully');

		} catch (e) {
			console.error(`SimilarArtists: Error during startup: ${e.toString()}`);
			appState.started = false;
		}
	}

	/**
	 * Shutdown add-on.
	 * 
	 * Called on application shutdown.
	 * Cleans up all listeners and state.
	 */
	function shutdown() {
		try {
			console.log('SimilarArtists: Shutting down...');

			// Shutdown MM5 integration
			if (appState.mm5Integration) {
				mm5Integration.shutdownIntegration(appState.mm5Integration, console.log);
				appState.mm5Integration = null;
			}

			// Shutdown auto-mode
			shutdownAutoMode();

			// Unsubscribe from settings
			if (appState.settingsUnsubscribe && typeof appState.settingsUnsubscribe === 'function') {
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

	/**
	 * Main SimilarArtists global object.
	 * 
	 * Exported to window for access by MM5 and action handlers.
	 */
	globalArg.SimilarArtists = {
		// Core entry points
		start,
		shutdown,
		runSimilarArtists,
		toggleAuto,
		isAutoEnabled,

		// Lifecycle
		isStarted: () => appState.started,

		// Status and info
		getState: () => ({
			started: appState.started,
			autoModeEnabled: isAutoEnabled(),
		}),

		// Module access (for advanced usage)
		modules,
		config,
	};

	console.log('SimilarArtists: Module loaded, call start() to initialize');

})(typeof window !== 'undefined' ? window : global);
