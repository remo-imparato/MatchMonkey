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
			this._missedResultsListener = null;
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
		// Update count
		this._updateMissedResultsCount(UI);

		// Setup button click handler
		if (UI.btnViewMissedResults && UI.btnViewMissedResults.controlClass) {
			app.listen(UI.btnViewMissedResults, 'click', () => {
				this._openMissedResultsDialog();
			});
		}

		// Listen for updates to the missed results
		this._missedResultsListener = () => {
			this._updateMissedResultsCount(UI);
		};

		window.addEventListener('matchmonkey:missedresultadded', this._missedResultsListener);
		window.addEventListener('matchmonkey:missedresultscleared', this._missedResultsListener);

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

		if (window.matchMonkeyMissedResults?.getStats) {
			const stats = window.matchMonkeyMissedResults.getStats();

			if (stats.total === 0) {
				UI.missedResultsCount.innerText = 'No missed results';
			} else {
				const plural = stats.total === 1 ? '' : 's';
				const occPlural = stats.totalOccurrences === 1 ? '' : 's';
				UI.missedResultsCount.innerText = `${stats.total} unique track${plural}, ${stats.totalOccurrences} occurrence${occPlural}`;
			}
		} else {
			UI.missedResultsCount.innerText = 'Not available';
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
		// Wire up Clear Cache button
		if (UI.btnClearCache && UI.btnClearCache.controlClass) {
			app.listen(UI.btnClearCache, 'click', () => {
				try {
					if (window.matchMonkeyCache?.clear) {
							window.matchMonkeyCache.clear();
						} else {
							// Fallback: clear the storage key directly (null crashes MM5, use empty object)
							app.setValue('MatchMonkeyCache', {});
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
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._updateStorageUsage = function (UI) {
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
			try {
				value = app.getValue(entry.key, {});
			} catch (e) {
				// ignore read errors
			}

			var sizeBytes = 0;
			if (value !== null && value !== undefined) {
				try {
					var json = JSON.stringify(value);
					sizeBytes = json.length * 2; // JS strings are UTF-16 (2 bytes per char)
				} catch (e) {
					sizeBytes = 0;
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
			} else if (entry.key === 'MatchMonkey_MissedResults' && Array.isArray(value)) {
				lines.push(entry.label + ': ' + this._formatBytes(sizeBytes) + ' (' + value.length + ' tracks)');
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
 * otherwise falls back to counting entries in the raw persistent store data.
 * @param {object} rawCacheValue - Raw value from app.getValue('MatchMonkeyCache')
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