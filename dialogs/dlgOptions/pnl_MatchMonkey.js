/**
 * MatchMonkey Options Panel for MediaMonkey 5
 * 

 * 
 * @author Remo Imparato
 * @version 2.2.0
 * @description Configuration panel for MatchMonkey add-on in MM5 Tools > Options.
 * 
 * Config Property Mapping (UI ID -> Storage Key):
 * - PlaylistName -> PlaylistName (Supports %action% and %seed% placeholders)
 * - ParentPlaylist -> ParentPlaylist
 * - PlaylistMode -> PlaylistMode
 * - ShowConfirmDialog -> ShowConfirmDialog
 * - ShuffleResults -> ShuffleResults
 * - IncludeSeedArtist -> IncludeSeedArtist
 * - SimilarArtistsLimit -> SimilarArtistsLimit
 * - TrackSimilarLimit -> TrackSimilarLimit
 * - TracksPerArtist -> TracksPerArtist
 * - MaxPlaylistTracks -> MaxPlaylistTracks
 * - UseLastfmRanking -> UseLastfmRanking
 * - PreferHighQuality -> PreferHighQuality
 * - LocalCollection -> LocalCollection (name of MediaMonkey collection to search locally)
 * - ApiMinMatch -> ApiMinMatch (0.00-99.99 float lower bound for API match/popularity filtering)
 * - MinRating -> MinRating
 * - IncludeUnrated -> IncludeUnrated
 * - AutoModeEnabled -> AutoModeEnabled
 * - AutoModeDiscovery -> AutoModeDiscovery
 * - AutoModeSeedLimit -> AutoModeSeedLimit
 * - AutoModeSimilarLimit -> AutoModeSimilarLimit
 * - AutoModeTracksPerArtist -> AutoModeTracksPerArtist
 * - AutoModeMaxTracks -> AutoModeMaxTracks
 * - AutoModeMinRating -> AutoModeMinRating
 * - AutoModeIncludeUnrated -> AutoModeIncludeUnrated
 * - SkipDuplicates -> SkipDuplicates
 * - EnqueueMode -> EnqueueMode
 * - ClearQueueFirst -> ClearQueueFirst
 * - NavigateAfter -> NavigateAfter
 * - ArtistBlacklist -> ArtistBlacklist
 * 

 */

'use strict';

// Script namespace
const SCRIPT_ID = 'MatchMonkey';

/**
 * Read a setting from the MatchMonkey configuration.
 * @param {string} key Setting key.
 * @returns {*} Setting value or undefined.
 */
function getSetting(key) {
	try {
		const allSettings = app.getValue(SCRIPT_ID, {});
		return allSettings[key];
	} catch (e) {
		console.error('Match Monkey Options: Error reading setting:', key, e);
		return undefined;
	}
}

/**
 * Write a setting to the MatchMonkey configuration.
 * @param {string} key Setting key.
 * @param {*} value Setting value.
 */
function setSetting(key, value) {
	try {
		const allSettings = app.getValue(SCRIPT_ID, {});
		allSettings[key] = value;
		app.setValue(SCRIPT_ID, allSettings);
	} catch (e) {
		console.error('Match Monkey Options: Error saving setting:', key, e);
	}
}

/**
 * Load handler - populates UI controls with current settings.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.load = async function (sett, pnl, wndParams) {
	try {

		// Store panel reference for use in save()
		this._pnl = pnl;

		// Read configuration from system storage (may be empty)
		this.config = app.getValue(SCRIPT_ID, {}) || {};
		const cfg = this.config || {};

		const UI = getAllUIElements(pnl);

		// === Playlist Creation ===
		UI.PlaylistName.controlClass.value = cfg.PlaylistName !== undefined ? cfg.PlaylistName : '';
		UI.ParentPlaylist.controlClass.value = cfg.ParentPlaylist || '';
		UI.PlaylistMode.controlClass.value = cfg.PlaylistMode || 'Create new playlist';
		UI.ShowConfirmDialog.controlClass.checked = Boolean(cfg.ShowConfirmDialog);
		UI.ShuffleResults.controlClass.checked = cfg.ShuffleResults !== false; // Default true
		UI.IncludeSeedArtist.controlClass.checked = Boolean(cfg.IncludeSeedArtist);

		// === Discovery Limits ===
		UI.SimilarArtistsLimit.controlClass.value = cfg.SimilarArtistsLimit || 20;
		UI.TrackSimilarLimit.controlClass.value = cfg.TrackSimilarLimit || 100;
		UI.TracksPerArtist.controlClass.value = cfg.TracksPerArtist || 30;
		UI.MaxPlaylistTracks.controlClass.value = cfg.MaxPlaylistTracks || 0; // 0 = unlimited
		UI.UseLastfmRanking.controlClass.checked = cfg.UseLastfmRanking !== false; // Default true

		// Audio format preference: 'Mixed (all formats)' | 'Lossless only' | 'Lossy only'
		// Map from stored value (if using legacy PreferHighQuality boolean, migrate to Mixed)
		let audioFormatPref = cfg.AudioFormatPreference || 'Mixed (all formats)';
		if (audioFormatPref === true || audioFormatPref === false) {
			// Migrate legacy PreferHighQuality boolean to new AudioFormatPreference
			audioFormatPref = 'Mixed (all formats)';
		}
		UI.AudioFormatPreference.controlClass.value = audioFormatPref;

		// === Rating Filter ===
		const ratingValue = parseInt(cfg.MinRating, 10) || 0;
		this._setRatingControl(UI.MinRating, ratingValue);
		UI.IncludeUnrated.controlClass.checked = cfg.IncludeUnrated !== false; // Default true

		// === Local Collection
		if (UI.LocalCollection && UI.LocalCollection.controlClass) {
			UI.LocalCollection.controlClass.value = cfg.LocalCollection || '';
		}

		// === API Thresholds ===
		// ApiMinMatch: single threshold for both Last.fm match and ReccoBeats popularity (0.00-99.99%)
		// Treat blank, null, undefined, or 0 as "no filtering" (disabled)
		if (UI.ApiMinMatch && UI.ApiMinMatch.controlClass) {
			const apiMatch = typeof cfg.ApiMinMatch === 'number' ? cfg.ApiMinMatch : parseFloat(cfg.ApiMinMatch);
			const apiMatchVal = Number.isFinite(apiMatch) && apiMatch > 0 ? Math.max(0, Math.min(99.99, apiMatch)) : '';
			// Display with two decimals or blank for no filtering
			UI.ApiMinMatch.controlClass.value = apiMatchVal === '' ? '' : apiMatchVal.toFixed(2);
		}

		// === Auto-Mode Settings ===
		this._setupAutoModeCheckbox(UI.AutoModeEnabled);
		UI.AutoModeEnabled.controlClass.checked = cfg.AutoModeEnabled || false;
		UI.AutoModeDiscovery.controlClass.value = cfg.AutoModeDiscovery || 'Similar Artist';
		UI.AutoModeSeedLimit.controlClass.value = cfg.AutoModeSeedLimit || 2;
		UI.AutoModeSimilarLimit.controlClass.value = cfg.AutoModeSimilarLimit || 10;
		UI.AutoModeTracksPerArtist.controlClass.value = cfg.AutoModeTracksPerArtist || 5;
		UI.AutoModeMaxTracks.controlClass.value = cfg.AutoModeMaxTracks || 30;

		// === Auto-Mode Rating Filter ===
		const autoRatingValue = parseInt(cfg.AutoModeMinRating, 10) || 0;
		this._setRatingControl(UI.AutoModeMinRating, autoRatingValue);
		UI.AutoModeIncludeUnrated.controlClass.checked = cfg.AutoModeIncludeUnrated !== false; // Default true

		UI.SkipDuplicates.controlClass.checked = cfg.SkipDuplicates !== false; // Default true

		// === Queue Behavior ===
		UI.EnqueueMode.controlClass.checked = Boolean(cfg.EnqueueMode);
		UI.ClearQueueFirst.controlClass.checked = Boolean(cfg.ClearQueueFirst);
		UI.NavigateAfter.controlClass.value = cfg.NavigateAfter || 'Navigate to new playlist';

		// === Filters ===
		UI.ArtistBlacklist.controlClass.value = cfg.ArtistBlacklist || '';

		// === Missed Results ===
		this._setupMissedResults(UI);

		// === API Cache ===
		if (UI.CacheTTLHours && UI.CacheTTLHours.controlClass) {
			UI.CacheTTLHours.controlClass.value = (typeof cfg.CacheTTLHours === 'number') ? cfg.CacheTTLHours : 72;
		}
		this._setupCacheSection(UI);

		console.log('Match Monkey Options: Settings loaded successfully');

	} catch (e) {
		console.error('Match Monkey Options: load error:', e.toString());
	}
};
/**
 * Helper to set rating control value.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setRatingControl = function (uiRatingControl, value) {
	if (!uiRatingControl?.controlClass) return;

	const ctrl = uiRatingControl.controlClass;
	const apply = () => {
		try {
			if (typeof ctrl.setRating === 'function') {
				ctrl.setRating(value, { force: true, disableChangeEvent: true });
			} else {
				ctrl.value = value;
			}
		} catch (e) {
			ctrl.value = value;
		}
	};

	// Check if control is initialized
	if (ctrl._initialized && Array.isArray(ctrl.stars) && ctrl.stars.length) {
		apply();
	} else {
		// Wait for control to initialize
		const onLoad = () => {
			try { apply(); }
			finally { app.unlisten(ctrl.container, 'load', onLoad); }
		};
		app.listen(ctrl.container, 'load', onLoad);
	}
};


/**
 * Helper to setup auto-mode checkbox with change listener.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setupAutoModeCheckbox = function (uiCheckbox) {
	// Set initial state from addon if available, otherwise from config
	try {
		if (window.matchMonkey?.isAutoEnabled) {
			uiCheckbox.controlClass.checked = Boolean(window.matchMonkey.isAutoEnabled());
		} else {
			uiCheckbox.controlClass.checked = Boolean(this.config.AutoModeEnabled);
		}
	} catch (e) {
		uiCheckbox.controlClass.checked = Boolean(this.config.AutoModeEnabled);
	}

	// Change handler - syncs with addon
	const onCheckboxChanged = () => {
		try {
			const desired = Boolean(uiCheckbox.controlClass.checked);
			setSetting('AutoModeEnabled', desired);

			// Sync with addon if available
			if (window.matchMonkey?.toggleAuto) {
				const current = Boolean(window.matchMonkey.isAutoEnabled?.());
				if (current !== desired) {
					window.matchMonkey.toggleAuto();
				}
			}
		} catch (e) {
			console.error('Match Monkey Options: AutoModeEnabled change error:', e);
		}
	};

	// Listen for changes
	try {
		const ctrl = uiCheckbox.controlClass;
		const el = ctrl.container?.querySelector?.('input[type="checkbox"]') || ctrl.container;
		if (el) {
			app.listen(el, 'change', onCheckboxChanged);
			app.listen(el, 'click', onCheckboxChanged);
		}
	} catch (e) {
		if (uiCheckbox.controlClass?.container) {
			app.listen(uiCheckbox.controlClass.container, 'change', onCheckboxChanged);
		}
	}

	// Listen for auto-mode changes from other sources (toolbar button, etc.)
	const onAutoModeChanged = (event) => {
		try {
			if (event.detail?.enabled !== undefined) {
				uiCheckbox.controlClass.checked = Boolean(event.detail.enabled);
			}
		} catch (e) {
			console.error('Match Monkey Options: Auto-mode event error:', e);
		}
	};

	this._autoModeListener = onAutoModeChanged;
	window.addEventListener('matchmonkey:automodechanged', onAutoModeChanged);
};

/**
 * Save handler - persists UI control values to settings.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.save = function (sett) {
	try {
		// Clean up event listeners
		if (this._autoModeListener) {
			window.removeEventListener('matchmonkey:automodechanged', this._autoModeListener);
			this._autoModeListener = null;
		}

		if (this._missedResultsListener) {
			window.removeEventListener('matchmonkey:missedresultadded', this._missedResultsListener);
			window.removeEventListener('matchmonkey:missedresultscleared', this._missedResultsListener);
			window.removeEventListener('matchmonkey:missedresultssaved', this._missedResultsListener);
			this._missedResultsListener = null;
		}

		if (this._cacheUpdatedListener) {
			window.removeEventListener('matchmonkey:cacheupdated', this._cacheUpdatedListener);
			this._cacheUpdatedListener = null;
		}

		const UI = getAllUIElements(this._pnl);

		// Read current config to preserve any keys not in UI
		this.config = app.getValue(SCRIPT_ID, {});

		// === Playlist Creation ===
		this.config.PlaylistName = UI.PlaylistName.controlClass.value !== undefined ? UI.PlaylistName.controlClass.value : '';
		this.config.ParentPlaylist = UI.ParentPlaylist.controlClass.value || '';
		this.config.PlaylistMode = UI.PlaylistMode.controlClass.value || 'Create new playlist';
		this.config.ShowConfirmDialog = UI.ShowConfirmDialog.controlClass.checked;
		this.config.ShuffleResults = UI.ShuffleResults.controlClass.checked;
		this.config.IncludeSeedArtist = UI.IncludeSeedArtist.controlClass.checked;

		// === Discovery Limits ===
		this.config.SimilarArtistsLimit = parseInt(UI.SimilarArtistsLimit.controlClass.value, 10) || 20;
		this.config.TrackSimilarLimit = parseInt(UI.TrackSimilarLimit.controlClass.value, 10) || 100;
		this.config.TracksPerArtist = parseInt(UI.TracksPerArtist.controlClass.value, 10) || 30;
		this.config.MaxPlaylistTracks = parseInt(UI.MaxPlaylistTracks.controlClass.value, 10) || 0;
		this.config.UseLastfmRanking = UI.UseLastfmRanking.controlClass.checked;

		// Audio format preference: 'Mixed (all formats)' | 'Lossless only' | 'Lossy only'
		this.config.AudioFormatPreference = UI.AudioFormatPreference.controlClass.value || 'Mixed (all formats)';

		// === Rating Filter ===
		const rawRating = Number.isFinite(UI.MinRating.controlClass.value)
			? Math.max(0, Math.min(100, UI.MinRating.controlClass.value))
			: 0;
		this.config.MinRating = rawRating;
		this.config.IncludeUnrated = UI.IncludeUnrated.controlClass.checked;

		// === Auto-Mode ===
		// Get auto-mode state from addon if available, otherwise from checkbox
		let autoEnabled = false;
		try {
			if (typeof window.matchMonkey?.isAutoEnabled === 'function') {
				autoEnabled = Boolean(window.matchMonkey.isAutoEnabled());
			} else {
				autoEnabled = Boolean(UI.AutoModeEnabled.controlClass.checked);
			}
		} catch (e) {
			autoEnabled = Boolean(UI.AutoModeEnabled.controlClass.checked);
		}
		this.config.AutoModeEnabled = autoEnabled;
		this.config.AutoModeDiscovery = UI.AutoModeDiscovery.controlClass.value || 'Similar Artist';
		this.config.AutoModeSeedLimit = parseInt(UI.AutoModeSeedLimit.controlClass.value, 10) || 2;
		this.config.AutoModeSimilarLimit = parseInt(UI.AutoModeSimilarLimit.controlClass.value, 10) || 10;
		this.config.AutoModeTracksPerArtist = parseInt(UI.AutoModeTracksPerArtist.controlClass.value, 10) || 5;
		this.config.AutoModeMaxTracks = parseInt(UI.AutoModeMaxTracks.controlClass.value, 10) || 30;

		// === Auto-Mode Rating Filter ===
		const rawAutoRating = Number.isFinite(UI.AutoModeMinRating.controlClass.value)
			? Math.max(0, Math.min(100, UI.AutoModeMinRating.controlClass.value))
			: 0;
		this.config.AutoModeMinRating = rawAutoRating;
		this.config.AutoModeIncludeUnrated = UI.AutoModeIncludeUnrated.controlClass.checked;

		this.config.SkipDuplicates = UI.SkipDuplicates.controlClass.checked;

		// === Local Collection ===
		if (UI.LocalCollection && UI.LocalCollection.controlClass) {
			this.config.LocalCollection = UI.LocalCollection.controlClass.value || '';
		}

		// === API Thresholds ===
		// ApiMinMatch: single threshold for both Last.fm match and ReccoBeats popularity (0.00-99.99%)
		// Treat blank or 0 as "no filtering" (disabled)
		if (UI.ApiMinMatch && UI.ApiMinMatch.controlClass) {
			const rawValue = String(UI.ApiMinMatch.controlClass.value || '').trim();
			if (rawValue === '') {
				// Blank = no filtering, store as null or undefined
				this.config.ApiMinMatch = undefined;
			} else {
				let apiMatch = parseFloat(rawValue.replace(',', '.'));
				if (!Number.isFinite(apiMatch) || apiMatch < 0) {
					apiMatch = 0;
				}
				apiMatch = Math.min(99.99, apiMatch);
				// Store as number with two decimals precision, or 0 for disabled
				this.config.ApiMinMatch = Math.round(apiMatch * 100) / 100;
			}
		}

		// === Queue Behavior ===
		this.config.EnqueueMode = UI.EnqueueMode.controlClass.checked;
		this.config.ClearQueueFirst = UI.ClearQueueFirst.controlClass.checked;
		this.config.NavigateAfter = UI.NavigateAfter.controlClass.value || 'Navigate to new playlist';

		// === Filters ===
		this.config.ArtistBlacklist = UI.ArtistBlacklist.controlClass.value || '';

		// === Cache TTL ===
		if (UI.CacheTTLHours && UI.CacheTTLHours.controlClass) {
			const ttl = parseInt(UI.CacheTTLHours.controlClass.value, 10);
			this.config.CacheTTLHours = Number.isFinite(ttl) && ttl >= 0 ? ttl : 24;
		}

		// Save all settings
		try {
			app.setValue(SCRIPT_ID, this.config);
			// Push the new config directly into the in-memory cache so the
			// running add-on picks up changes immediately (without a restart)
			window.matchMonkeyStorage?.updateSettingsCache(this.config);
			console.log('Match Monkey Options: Settings saved successfully');
		} catch (e) {
			console.error('Match Monkey Options: Failed to save:', e.toString());
		}

	} catch (e) {
		console.error('Match Monkey Options: save error:', e.toString());
	}
};


/**
 * Setup missed results section
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setupMissedResults = function (UI) {
	try {
		// Ensure module is initialized before reading stats/meta
		if (window.matchMonkeyMissedResults?.initMissedResults) {
			window.matchMonkeyMissedResults.initMissedResults()
				.then(() => this._updateMissedResultsCount(UI))
				.catch(() => this._updateMissedResultsCount(UI));
		} else {
			this._updateMissedResultsCount(UI);
		}

		// Setup button click handler
		if (UI.btnViewMissedResults && UI.btnViewMissedResults.controlClass) {
			app.listen(UI.btnViewMissedResults, 'click', () => {
				this._openMissedResultsDialog();
			});
		}

		// Listen for updates to the missed results
		this._missedResultsListener = () => {
			this._updateMissedResultsCount(UI);
			this._updateStorageUsage(UI);
		};

		window.addEventListener('matchmonkey:missedresultadded', this._missedResultsListener);
		window.addEventListener('matchmonkey:missedresultscleared', this._missedResultsListener);
		window.addEventListener('matchmonkey:missedresultssaved', this._missedResultsListener);

	} catch (e) {
		console.error('Match Monkey Options: Error setting up missed results:', e);
	}
};

/**
 * Update missed results count display
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._updateMissedResultsCount = function (UI) {
	try {
		if (!UI.missedResultsCount) return;

		var stats = null;

		// Prefer live module (falls back to meta internally when store not loaded)
		if (window.matchMonkeyMissedResults?.getMissedResultsStats) {
			stats = window.matchMonkeyMissedResults.getMissedResultsStats();
		} else {
			// Module not available — read meta directly
			var meta = app.getValue('MatchMonkeyMissedMeta', {});
			if (meta && typeof meta === 'object') {
				stats = {
					total: Number(meta.total) || 0,
					totalOccurrences: Number(meta.totalOccurrences) || 0,
				};
			}
		}

		if (!stats || stats.total === 0) {
			UI.missedResultsCount.innerText = 'No missed results';
		} else {
			var plural = stats.total === 1 ? '' : 's';
			var occPlural = stats.totalOccurrences === 1 ? '' : 's';
			UI.missedResultsCount.innerText = stats.total + ' unique track' + plural + ', ' + stats.totalOccurrences + ' occurrence' + occPlural;
		}
	} catch (e) {
		console.error('Match Monkey Options: Error updating missed results count:', e);
		if (UI.missedResultsCount) {
			UI.missedResultsCount.innerText = 'Error loading count';
		}
	}
};

/**
 * Open missed results dialog
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._openMissedResultsDialog = function () {
	try {
		console.log('Match Monkey Options: Opening missed results dialog');

		if (typeof uitools !== 'undefined' && uitools.openDialog) {
			uitools.openDialog('dlgMissedResults', {
				modal: true
			});
		} else {
			console.error('Match Monkey Options: uitools.openDialog not available');
		}
	} catch (e) {
		console.error('Match Monkey Options: Error opening missed results dialog:', e);
	}
};

/**
 * Setup API Cache section - Clear Cache button and storage usage display.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setupCacheSection = function (UI) {
	try {
		// Refresh storage summary whenever cache persistence updates
		this._cacheUpdatedListener = () => {
			this._updateStorageUsage(UI);
		};
		window.addEventListener('matchmonkey:cacheupdated', this._cacheUpdatedListener);

		// Wire up Clear Cache button
		if (UI.btnClearCache && UI.btnClearCache.controlClass) {
			app.listen(UI.btnClearCache, 'click', () => {
				try {
					if (window.matchMonkeyCache?.clearCache) {
						window.matchMonkeyCache.clearCache();
					} else {
							// Fallback when cache module is unavailable — use async DB API
							if (app.db && typeof app.db.executeQueryAsync === 'function') {
								app.db.executeQueryAsync("DELETE FROM MatchMonkeyData WHERE key = 'cache'");
							}
							app.setValue('MatchMonkeyCacheMeta', {
								storage: 'db',
								sizeBytes: 0,
								lastSavedTs: Date.now(),
								counts: {
									similarArtists: 0,
									topTracks: 0,
									similarTracks: 0,
									artistInfo: 0,
									artistLookups: 0,
									albumLookups: 0,
									trackLookups: 0,
									audioFeatures: 0,
									recommendations: 0,
								}
							});
						}
					console.log('Match Monkey Options: Cache cleared');
					this._updateStorageUsage(UI);
				} catch (e) {
					console.error('Match Monkey Options: Error clearing cache:', e);
				}
			});
		}

		// Show storage usage
		this._updateStorageUsage(UI);
	} catch (e) {
		console.error('Match Monkey Options: Error setting up cache section:', e);
	}
};

/**
 * Calculate and display storage usage for all MatchMonkey persistent data.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._updateStorageUsage = async function (UI) {
	try {
		if (!UI.storageUsageInfo) return;

		var storageKeys = [
			{ key: 'MatchMonkey', label: 'Settings' },
			{ key: 'MatchMonkeyCache', label: 'API Cache' },
			{ key: 'MatchMonkey_MissedResults', label: 'Missed Results' }
		];

		var lines = [];
		var totalBytes = 0;

		for (var i = 0; i < storageKeys.length; i++) {
			var entry = storageKeys[i];
			var value = null;
			var sizeBytes = 0;

			if (entry.key === 'MatchMonkeyCache') {
				// Never read full cache blob for options display; use lightweight metadata
				var cacheMeta = null;
				try {
					if (window.matchMonkeyCache?.getCachePersistentMeta) {
						cacheMeta = window.matchMonkeyCache.getCachePersistentMeta();
					} else {
						cacheMeta = app.getValue('MatchMonkeyCacheMeta', {});
					}
					// Metadata is missing or stale — init the cache from DB so that
					// updateMetaFromStore() runs and populates accurate counts/size.
					if ((!cacheMeta || !cacheMeta.sizeBytes) && window.matchMonkeyCache?.initCache) {
						await window.matchMonkeyCache.initCache();
						cacheMeta = window.matchMonkeyCache.getCachePersistentMeta();
					}
				} catch (e) {
					cacheMeta = null;
				}

				value = cacheMeta;
				sizeBytes = Number(cacheMeta?.sizeBytes) || 0;
			} else if (entry.key === 'MatchMonkey_MissedResults') {
				// Missed results are stored in DB; use lightweight metadata
				var missedMeta = null;
				try {
					if (window.matchMonkeyMissedResults?.getMissedResultsPersistentMeta) {
							missedMeta = window.matchMonkeyMissedResults.getMissedResultsPersistentMeta();
						} else {
							missedMeta = app.getValue('MatchMonkeyMissedMeta', {});
						}
						// Metadata is missing or stale — init from DB to populate accurate meta.
						if ((!missedMeta || !missedMeta.total) && window.matchMonkeyMissedResults?.initMissedResults) {
							await window.matchMonkeyMissedResults.initMissedResults();
							if (window.matchMonkeyMissedResults.getMissedResultsPersistentMeta) {
								missedMeta = window.matchMonkeyMissedResults.getMissedResultsPersistentMeta();
							}
						}
				} catch (e) {
					missedMeta = null;
				}

				value = missedMeta;
				sizeBytes = Number(missedMeta?.sizeBytes) || 0;
			} else {
				try {
					value = app.getValue(entry.key, {});
				} catch (e) {
					// ignore read errors
				}

				if (value !== null && value !== undefined) {
					try {
						var json = JSON.stringify(value);
						sizeBytes = json.length * 2; // JS strings are UTF-16 (2 bytes per char)
					} catch (e) {
						sizeBytes = 0;
					}
				}
			}

			totalBytes += sizeBytes;

			if (entry.key === 'MatchMonkeyCache') {
				var counts = this._getCacheCounts(value);
				lines.push('<strong>' + entry.label + '</strong>: ' + this._formatBytes(sizeBytes));
				lines.push(
					'\u00a0\u00a0<em>Last.fm</em>: ' +
					counts.similarArtists + ' artists \u00b7 ' +
					counts.topTracks + ' top tracks \u00b7 ' +
					counts.similarTracks + ' similar tracks \u00b7 ' +
					counts.artistInfo + ' artist info'
				);
				lines.push(
					'\u00a0\u00a0<em>ReccoBeats</em>: ' +
					counts.artistLookups + ' artist IDs \u00b7 ' +
					counts.albumLookups + ' album IDs \u00b7 ' +
					counts.trackLookups + ' track IDs \u00b7 ' +
					counts.audioFeatures + ' audio features'
				);
			} else if (entry.key === 'MatchMonkey_MissedResults') {
				var missedTotal = (value && typeof value === 'object') ? (Number(value.total) || 0) : 0;
				var missedOcc = (value && typeof value === 'object') ? (Number(value.totalOccurrences) || 0) : 0;
				if (missedTotal > 0) {
					var trackPlural = missedTotal === 1 ? '' : 's';
					var occPlural = missedOcc === 1 ? '' : 's';
					lines.push(entry.label + ': ' + this._formatBytes(sizeBytes) + ' (' + missedTotal + ' track' + trackPlural + ', ' + missedOcc + ' occurrence' + occPlural + ')');
				} else {
					lines.push(entry.label + ': ' + this._formatBytes(sizeBytes));
				}
			} else {
				lines.push(entry.label + ': ' + this._formatBytes(sizeBytes));
			}
		}

		lines.push('<strong>Total: ' + this._formatBytes(totalBytes) + '</strong>');
		UI.storageUsageInfo.innerHTML = lines.join('<br>');

	} catch (e) {
		console.error('Match Monkey Options: Error calculating storage usage:', e);
		if (UI.storageUsageInfo) {
			UI.storageUsageInfo.innerText = 'Unable to calculate storage usage';
		}
	}
};

/**
 * Get per-map cache entry counts.
 * Uses live in-memory detailed stats when the cache is active,
 * otherwise falls back to metadata counts, then raw persistent store data.
 * @param {object} rawCacheValue - Cache metadata or raw cache object
 * @returns {object} Counts keyed by map name
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._getCacheCounts = function (rawCacheValue) {
	// Prefer live in-memory stats (accurate for current session)
	if (window.matchMonkeyCache?.getDetailedStats) {
		var live = window.matchMonkeyCache.getDetailedStats();
		if (live.active) {
			return {
				similarArtists: live.lastfm?.similarArtists || 0,
				topTracks: live.lastfm?.topTracks || 0,
				similarTracks: live.lastfm?.similarTracks || 0,
				artistInfo: live.lastfm?.artistInfo || 0,
				artistLookups: live.reccobeats?.artistLookups || 0,
				albumLookups: live.reccobeats?.albumLookups || 0,
				trackLookups: live.reccobeats?.trackLookups || 0,
				audioFeatures: live.reccobeats?.audioFeatures || 0,
			};
		}
	}

	// Next prefer lightweight persisted metadata
	if (rawCacheValue && typeof rawCacheValue === 'object' && rawCacheValue.counts && typeof rawCacheValue.counts === 'object') {
		var c = rawCacheValue.counts;
		return {
			similarArtists: Number(c.similarArtists) || 0,
			topTracks: Number(c.topTracks) || 0,
			similarTracks: Number(c.similarTracks) || 0,
			artistInfo: Number(c.artistInfo) || 0,
			artistLookups: Number(c.artistLookups) || 0,
			albumLookups: Number(c.albumLookups) || 0,
			trackLookups: Number(c.trackLookups) || 0,
			audioFeatures: Number(c.audioFeatures) || 0,
		};
	}

	// Fall back to counting from raw persistent store data
	var counts = {
		similarArtists: 0, topTracks: 0, similarTracks: 0, artistInfo: 0,
		artistLookups: 0, albumLookups: 0, trackLookups: 0, audioFeatures: 0,
	};

	if (!rawCacheValue || typeof rawCacheValue !== 'object') return counts;

	var rawLf = rawCacheValue.lastfm;
	if (rawLf && typeof rawLf === 'object') {
		if (Array.isArray(rawLf.similarArtists)) counts.similarArtists = rawLf.similarArtists.length;
		if (Array.isArray(rawLf.topTracks)) counts.topTracks = rawLf.topTracks.length;
		if (Array.isArray(rawLf.similarTracks)) counts.similarTracks = rawLf.similarTracks.length;
		if (Array.isArray(rawLf.artistInfo)) counts.artistInfo = rawLf.artistInfo.length;
	}

	var rawRb = rawCacheValue.reccobeats;
	if (rawRb && typeof rawRb === 'object') {
		if (Array.isArray(rawRb.audioFeatures)) counts.audioFeatures = rawRb.audioFeatures.length;
		if (Array.isArray(rawRb.lookups)) {
			for (var j = 0; j < rawRb.lookups.length; j++) {
				var pair = rawRb.lookups[j];
				if (!Array.isArray(pair) || !pair[0]) continue;
				var k = String(pair[0]).toUpperCase();
				if (k.startsWith('TRACKID:')) counts.trackLookups++;
				else if (k.startsWith('ALBUMID:') || k.startsWith('ALBUM:') || k.startsWith('ARTISTALBUMS:') || k.startsWith('ALBUMTRACKS:')) counts.albumLookups++;
				else if (k.startsWith('ARTISTALL:')) counts.artistLookups++;
			}
		}
	}

	return counts;
};


/**
 * Format byte count to a human-readable string.
 * @param {number} bytes - Size in bytes.
 * @returns {string} Formatted string (e.g., "1.5 KB", "3.2 MB").
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._formatBytes = function (bytes) {
	if (bytes === 0) return '0 B';
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
	return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};