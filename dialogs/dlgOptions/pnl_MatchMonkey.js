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