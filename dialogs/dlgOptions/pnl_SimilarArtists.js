/**
 * SimilarArtists Options Panel for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @version 1.0.0
 * @description Configuration panel for SimilarArtists add-on in MM5 Tools > Options.
 *              Provides UI for configuring Last.fm API settings, playlist creation options,
 *              filters, and automatic behavior.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 * 
 * Features:
 * - Last.fm API key configuration
 * - Playlist naming and creation modes
 * - Artist/track limits and filtering options
 * - Rating-based filtering
 * - Parent playlist selection
 * - Auto-enqueue and navigation settings
 * 
 * Requirements:
 * - MediaMonkey 5.0+
 * - SimilarArtists add-on installed
 */

// Helper get/set that use the SimilarArtists namespace
function setSetting(key, value) {
	try {
		app.setValue?.('SimilarArtists', key, value);
	} catch (e) {
		// fallback
		try { app.setValue && app.setValue(key, value); } catch (e) { }
	}
}

function getSetting(key, defaultValue) {
	try {
		const v = app.getValue?.('SimilarArtists', key);
		return (v === undefined || v === null) ? defaultValue : v;
	} catch (e) {
		try { return app.getValue ? app.getValue(key, defaultValue) : defaultValue; } catch (e) { return defaultValue; }
	}
}

function intSetting(key) {
	const v = getSetting(key, defaults[key]);
	return parseInt(v, 10) || 0;
}

function boolSetting(key) {
	const v = getSetting(key, defaults[key]);
	return Boolean(v);
}

function stringSetting(key) {
	const v = getSetting(key, defaults[key]);
	return v == null ? '' : String(v);
}

// Defaults matching similarArtists.js
const defaults = {
	ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932',
	Confirm: true,
	Sort: false,
	// Legacy setting. Kept for backward compatibility.
	Limit: 5,
	// New, explicit settings (fallback to `Limit` if undefined).
	SeedLimit: 5,
	SimilarLimit: 5,
	Name: '- Similar to %',
	TPA: 9999,
	TPL: 9999,
	Random: false,
	Seed: false,
	Best: false,
	Rank: false,
	Rating: 0,
	Unknown: true,
	Overwrite: 'Create new playlist',
	Enqueue: false,
	Navigate: 'None',
	OnPlay: false,
	ClearNP: false,
	Ignore: false,
	Parent: 'Similar Artists Playlists',
	Black: '',
	Exclude: '',
	Genre: '',
};

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = async function (sett, pnl, wndParams) {
	try {
		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnl);
		UI.SAApiKey.controlClass.value = this.config.ApiKey;
		UI.SAConfirm.controlClass.checked = this.config.Confirm;
		UI.SASort.controlClass.checked = this.config.Sort;
		// UI has a single field (`SALimit`). Prefer explicit values; fallback to legacy `Limit`.
		const legacyLimit = this.config.Limit;
		const seedLimit = (this.config.SeedLimit === undefined || this.config.SeedLimit === null) ? legacyLimit : this.config.SeedLimit;
		const similarLimit = (this.config.SimilarLimit === undefined || this.config.SimilarLimit === null) ? legacyLimit : this.config.SimilarLimit;
		// Keep existing UI as-is: represent the effective value (seed and similar share the same control for now).
		UI.SALimit.controlClass.value = seedLimit || similarLimit || legacyLimit;
		UI.SAName.controlClass.value = this.config.Name;
		UI.SATPA.controlClass.value = this.config.TPA;
		UI.SATPL.controlClass.value = this.config.TPL;
		UI.SARandom.controlClass.checked = this.config.Random;
		UI.SASeed.controlClass.checked = this.config.Seed;
		// Removed: UI.SASeed2
		UI.SABest.controlClass.checked = this.config.Best;
		UI.SARank.controlClass.checked = this.config.Rank;

		// Rating control API: `value` is -1..100; -1 is allowed only when `useUnknown=true`.
		// Persist behavior:
		// - `Unknown` == true means "include unknown" and the control is allowed to use -1.
		// - `Rating` stores the minimum rating (0..100). When Unknown is true and Rating is 0,
		//   we show -1 in the control to represent "no minimum, include unknown".
		const allowUnknown = Boolean(this.config.Unknown);
		const ratingValueRaw = (this.config.Rating === undefined || this.config.Rating === null)
			? 0
			: parseInt(this.config.Rating, 10);
		const ratingValue = Number.isFinite(ratingValueRaw) ? Math.max(0, Math.min(100, ratingValueRaw)) : 0;
		UI.SARating.controlClass.value = ratingValue;

		/*
		const applyRatingUI = () => {
			if (!UI.SARating?.controlClass) return;
			UI.SARating.controlClass.useUnknown = allowUnknown;
			UI.SARating.controlClass.value = (allowUnknown && ratingValue === 0) ? -1 : ratingValue;
		};

		// Apply immediately if available, otherwise wait for control to initialize
		applyRatingUI();
		if (!(UI.SARating && UI.SARating.controlClass)) {
			await waitFor(() => UI.SARating && UI.SARating.controlClass, 1000, 50);
		}
		// Reapply after control is ready to ensure correct display
		applyRatingUI();


		// Keep rating control in sync when toggling "Include unknown rating?"
		try {
			const unknownCtrl = UI.SAUnknown?.controlClass;
			const ratingCtrl = UI.SARating?.controlClass;
			if (unknownCtrl && ratingCtrl) {
				unknownCtrl.onChange = () => {
					try {
						const checked = Boolean(unknownCtrl.checked);
						ratingCtrl.useUnknown = checked;
						// If enabling "unknown", display -1 (Unknown) when minimum is 0.
						if (checked && (parseInt(ratingCtrl.value, 10) || 0) <= 0) {
							ratingCtrl.value = -1;
						}
						// If disabling "unknown" and the control is at -1, reset to 0.
						if (!checked && parseInt(ratingCtrl.value, 10) < 0) {
							ratingCtrl.value = 0;
						}
					} catch (e) {
						// ignore
					}
				};
			}
		} catch (e) {
			// ignore
		}

		console.log(`Similar Artists: load: Rating set to ${UI.SARating?.controlClass?.value} (useUnknown=${allowUnknown})`);
		*/

		UI.SAUnknown.controlClass.checked = allowUnknown;
		UI.SAOverwrite.controlClass.value = this.config.Overwrite;
		UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
		UI.SANavigate.controlClass.value = this.config.Navigate;

		// Options panel can be loaded in a different window context than the main UI,
		// so window.SimilarArtists may not be present. Try to load it; otherwise fallback to stored setting.
		const setOnPlayCheckbox = () => {
			try {
				if (window.SimilarArtists?.isAutoEnabled) {
					UI.SAOnPlay.controlClass.checked = Boolean(window.SimilarArtists.isAutoEnabled());
				} else {
					UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
				}
			} catch (e) {
				UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
			}
		};

		/*
		try {
			if (!window.SimilarArtists && typeof window.localRequirejs === 'function') {
				window.localRequirejs('similarArtists');
				// wait for the module to initialize if possible
				await waitFor(() => window.SimilarArtists && typeof window.SimilarArtists.isAutoEnabled === 'function', 2000, 100);
			}
		} catch (e) {
			// ignore, handled by fallback
		}
		*/

		// Set checkbox now that we've attempted to ensure module is loaded
		setOnPlayCheckbox();

		UI.SAClearNP.controlClass.checked = this.config.ClearNP;
		UI.SAIgnore.controlClass.checked = this.config.Ignore;
		UI.SAParent.controlClass.value = this.config.Parent;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAGenre.controlClass.value = this.config.Genre;

		/*
		// Populate Exclude Artists control (Dropdown multi) - set value directly and apply checked flags if datasource present
		try {
			if (UI.SABlack && UI.SABlack.controlClass) {
				// Let the control populate itself via dbFunc; set the effective value (CSV or array) so control reflects stored config
				try { UI.SABlack.controlClass.value = this.config.Black || ''; } catch (e) { }

				// If datasource is already available, attempt best-effort to mark checked items (non-blocking)
				try {
					const ds = UI.SABlack.controlClass.dataSource;
					if (ds) {
						const blacks = (this.config.Black || '').split(',').map(s => s.trim()).filter(Boolean);
						if (blacks.length) {
							if (typeof ds.forEach === 'function') {
								ds.forEach((item, idx) => {
									const name = item.name || item.title || item.toString();
									if (blacks.indexOf(name) >= 0) {
										if (typeof ds.setChecked === 'function') ds.setChecked(idx, true);
										else item.checked = true;
									}
								});
							} else if (typeof ds.getValue === 'function') {
								for (let i = 0; i < ds.count; i++) {
									const item = ds.getValue(i);
									const name = item.name || item.title || item.toString();
									if (blacks.indexOf(name) >= 0) item.checked = true;
								}
							}
							try { if (UI.SABlack.controlClass.callEvent) UI.SABlack.controlClass.callEvent('change'); } catch(e){}
						}
					}
				} catch (e) { console.error('Similar Artists: load: non-blocking SABlack datasource handling failed: ' + e.toString()); }
			}
		} catch (e) {
			console.error('Similar Artists: load: error setting SABlack control: ' + e.toString());
		}

		// Populate Exclude Genres control (ImageGrid) with existing genres and mark checked ones
		try {
			if (UI.SAGenre && UI.SAGenre.controlClass) {
				// try to get a genre list datasource; prefer app.utils.createGenrelist or similar APIs
				let gds;
				if (app.utils && typeof app.utils.createGenrelist === 'function') {
					gds = app.utils.createGenrelist();
				} else if (app.db && typeof app.db.getGenreList === 'function') {
					// fallback hypothetical API
					gds = app.db.getGenreList();
				}
				if (!gds) {
					// As a last resort, try to construct list from existing tracks' genres (simple DB query)
					try {
						const tl = app.db.getTracklist("SELECT DISTINCT Genre AS name FROM Tracks", -1);
						if (tl) {
							await tl.whenLoaded();
							let arr = [];
							if (typeof tl.forEach === 'function') {
								tl.forEach((row) => {
									try { const v = row.getValue ? row.getValue('name') : row['name']; if (v) arr.push({ title: String(v) }); } catch (e) { }
								});
							}
							gds = new ArrayDataSource(arr, { isLoaded: true });
						}
					} catch (e) { }
				}
				if (gds) {
					UI.SAGenre.controlClass.dataSource = gds; // dropdown will auto-populate via dbFunc in HTML, but keep if present
					// non-blocking attempt to set selected genres
					try {
						// prefer setting control value directly
						try { UI.SAGenre.controlClass.value = this.config.Genre || ''; } catch (e) { }
						const blacks = (this.config.Genre || '').split(',').map(s => s.trim()).filter(Boolean);
						if (blacks.length) {
							if (typeof gds.forEach === 'function') {
								gds.forEach((item, idx) => {
									const name = item.title || item.name || item.toString();
									if (blacks.indexOf(name) >= 0) { if (typeof gds.setChecked === 'function') gds.setChecked(idx, true); else item.checked = true; }
								});
							} else if (typeof gds.getValue === 'function') {
								for (let i = 0; i < gds.count; i++) { const it = gds.getValue(i); const name = it.title || it.name || it.toString(); if (blacks.indexOf(name) >= 0) it.checked = true; }
							}
							try { if (UI.SAGenre.controlClass.callEvent) UI.SAGenre.controlClass.callEvent('change'); } catch(e){}
						}
					} catch (e) { console.error('Similar Artists: load: non-blocking SAGenre datasource handling failed: ' + e.toString()); }
				}
			}
		} catch (e) {
			console.error('Similar Artists: load: error populating SAGenre ImageGrid: ' + e.toString());
		}

		// Wire up Select All / Clear buttons for SAGenre
		try {
			const btnAllG = qid('btnGenreSelectAll');
			const btnClearG = qid('btnGenreClear');
			const setupGenreButtons = () => {
				if (!btnAllG || !btnClearG) return;
				btnAllG.controlClass.disabled = false;
				btnClearG.controlClass.disabled = false;
				btnAllG.controlClass.onexecute = () => {
					try {
						const ds2 = UI.SAGenre.controlClass.dataSource;
						if (!ds2) return;
						if (typeof ds2.forEach === 'function') { ds2.forEach((item, idx) => { if (typeof ds2.setChecked === 'function') ds2.setChecked(idx, true); else item.checked = true; }); }
						else if (typeof ds2.getValue === 'function') { for (let i = 0; i < ds2.count; i++) { const it = ds2.getValue(i); if (it) it.checked = true; } }
					} catch (e) { }
				};
				btnClearG.controlClass.onexecute = () => {
					try {
						const ds2 = UI.SAGenre.controlClass.dataSource;
						if (!ds2) return;
						if (typeof ds2.forEach === 'function') { ds2.forEach((item, idx) => { if (typeof ds2.setChecked === 'function') ds2.setChecked(idx, false); else item.checked = false; }); }
						else if (typeof ds2.getValue === 'function') { for (let i = 0; i < ds2.count; i++) { const it = ds2.getValue(i); if (it) it.checked = false; } }
					} catch (e) { }
				};
			};
			setupGenreButtons();
			//requestAnimationFrame(setupGenreButtons);
		} catch (e) {
			console.error('Similar Artists: load: error wiring SAGenre buttons: ' + e.toString());
		}
		*/

		// Populate parent playlist dropdown with available manual playlists
		// Wait for playlists tree to be available instead of using a fixed timeout
		//await waitFor(() => app.playlists && app.playlists.root, 2000, 100);
		/*
		// Robustly wait for playlists to be initialized (different MM builds expose different hooks)
		try {
			if (app.playlists && app.playlists.root) {
				if (typeof app.playlists.root.whenLoaded === 'function') {
					await app.playlists.root.whenLoaded();
				} else if (typeof app.playlists.root.whenReady === 'function') {
					await app.playlists.root.whenReady();
				} else if (typeof app.playlists.whenLoaded === 'function') {
					await app.playlists.whenLoaded();
				} else if (typeof app.playlists.whenReady === 'function') {
					await app.playlists.whenReady();
				} else {
					// Fallback: wait until child collections appear
					await waitFor(() => (app.playlists.root.childPlaylists || app.playlists.root.children || (typeof app.playlists.root.getChildren === 'function')), 2000, 100);
				}
			}
		} catch (e) {
			console.error('Similar Artists: waiting for playlists readiness failed: ' + e.toString());
		}
		// call populate and await it so UI is ready when load completes
		await populateParentPlaylist(pnl, this.config.Parent);
		*/
	} catch (e) {
		console.error('Similar Artists: load error: ' + e.toString());
	}
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
	try {
		var UI = getAllUIElements();

		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.Sort = UI.SASort.controlClass.checked;
		// Persist both explicit settings using the single UI value.
		this.config.SeedLimit = UI.SALimit.controlClass.value;
		this.config.SimilarLimit = UI.SALimit.controlClass.value;
		// Also persist legacy `Limit` for compatibility with older builds.
		this.config.Limit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Parent = UI.SAParent.controlClass.value;

		// Rating control stores a normalized value in range 0-100; -1 only when useUnknown is enabled.
		// Explicitly persist as string to match text input control behavior.
		const rawRating = UI.SARating?.controlClass?.value;
		this.config.Rating = (rawRating === undefined || rawRating === null) ? '0' : String(rawRating);

		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;
		// Detect real Auto OnPlay state: checkbox may not always reflect module status if toggled manually.
		const isAutoEnabled = !!(UI.SAOnPlay.controlClass.checked && window.SimilarArtists?.isAutoEnabled);
		this.config.OnPlay = isAutoEnabled;

		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;

		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		/*
		// Read selected excluded artists from control value or datasource
		try {
			const val = UI.SABlack?.controlClass?.value;
			if (val !== undefined && val !== null) {
				if (Array.isArray(val)) this.config.Black = val.join(', ');
				else this.config.Black = String(val);
			} else {
				// fallback to datasource iteration
				const blackNames = [];
				if (UI.SABlack && UI.SABlack.controlClass && UI.SABlack.controlClass.dataSource) {
					const ds = UI.SABlack.controlClass.dataSource;
					if (typeof ds.forEach === 'function') {
						ds.forEach((item) => { if (item && item.checked) blackNames.push(item.name || item.title || item.toString()); });
					} else if (typeof ds.getValue === 'function') {
						for (let i = 0; i < ds.count; i++) { const item = ds.getValue(i); if (item && item.checked) blackNames.push(item.name || item.title || item.toString()); }
					}
				}
				this.config.Black = blackNames.join(', ');
			}
		} catch (e) {
			console.error('Similar Artists: save: error reading SABlack selections: ' + e.toString());
			this.config.Black = UI.SABlack?.controlClass?.value || '';
		}

		// Persist selected genres from control value or datasource
		try {
			const gval = UI.SAGenre?.controlClass?.value;
			if (gval !== undefined && gval !== null) {
				if (Array.isArray(gval)) this.config.Genre = gval.join(', ');
				else this.config.Genre = String(gval);
			} else {
				const genreNames = [];
				if (UI.SAGenre && UI.SAGenre.controlClass && UI.SAGenre.controlClass.dataSource) {
					const gds2 = UI.SAGenre.controlClass.dataSource;
					if (typeof gds2.forEach === 'function') {
						gds2.forEach((item, idx) => { if (item && item.checked) genreNames.push(item.title || item.name || item.toString()); });
					} else if (typeof gds2.getValue === 'function') {
						for (let i = 0; i < gds2.count; i++) { const it = gds2.getValue(i); if (it && it.checked) genreNames.push(it.title || it.name || it.toString()); }
					}
				}
				this.config.Genre = genreNames.join(', ');
			}
		} catch (e) {
			console.error('Similar Artists: save: error reading SAGenre selections: ' + e.toString());
			this.config.Genre = UI.SAGenre?.controlClass?.value || '';
		}
		*/

		// Update settings
		for (let k in this.config) {
			if (Object.hasOwnProperty.call(this.config, k)) {
				setSetting(k, this.config[k]);
			}
		}

		// Report updated values for debug
		console.log('Similar Artists: save: updated settings:', JSON.stringify(this.config, null, 2));

		//// Special case: Some users may have upgraded from old portable builds where the DB path was relative.
		//// To avoid confusion, we force-reset the stored Last.fm API key if it differs from the current one.
		//try {
		//	const currentApiKey = app?.utils?.web?.getAPIKey('lastfmApiKey');
		//	if (currentApiKey && currentApiKey !== this.config.ApiKey) {
		//		console.log('Similar Artists: save: detected API key change, resetting stored key');
		//		app.setValue('SimilarArtists', 'ApiKey', currentApiKey);
		//	}
		//} catch (e) {
		//	console.error('Similar Artists: save: error handling API key reset: ' + e.toString());
		//}

	} catch (e) {
		console.error('Similar Artists: save error: ' + e.toString());
	}
}
