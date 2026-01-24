/**
 * SimilarArtists Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - API processing (similar artists from Last.fm)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 
 * Provides the high-level orchestration functions:
 * - generateSimilarPlaylist() - Main entry point
 * - runSimilarArtists() - Full workflow orchestration
 * - buildResultsPlaylist() - Playlist creation workflow
 * - queueResults() - Queue management workflow
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

window.similarArtistsOrchestration = {
	/**
	 * Main orchestration function that runs the complete SimilarArtists workflow.
	 * 
	 * Workflow:
	 * 1. Collect seed tracks from selection or currently playing
	 * 2. Process seeds through Last.fm to find similar artists
	 * 3. Query library for tracks matching similar artists
	 * 4. Apply post-processing (ranking, filtering, deduplication)
	 * 5. Create playlist or enqueue results based on settings
	 * 6. Show confirmation dialog if enabled
	 * 7. Navigate to results if enabled
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode (forces enqueue, uses conservative limits)
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false) {
		const {
			config,
			utils: { normalization, helpers },
			settings: { storage, prefixes },
			ui: { notifications },
			api: { lastfmApi },
			db,  // Changed: db is already the full interface, no need to destructure library
		} = modules;

		const {
			getSetting,
			intSetting,
			boolSetting,
		} = storage;

		const {
			showToast,
			updateProgress,
			createProgressTask,
			terminateProgressTask,
		} = notifications;

		const {
			formatError,
			shuffle: shuffleUtil,
		} = helpers;

		const {
			fixPrefixes,
		} = prefixes;

		// Declare taskId outside try block so it's accessible in catch
		let taskId = null;

		try {
			// Initialize progress tracking
			taskId = createProgressTask('Generating Similar Artists Playlist');
			updateProgress('Initializing...', 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration
			const config_ = {
				seedLimit: autoMode ? 2 : intSetting('SeedLimit'),
				similarLimit: intSetting('SimilarLimit'),
				tracksPerArtist: autoMode ? 5 : intSetting('TPA'),
				totalLimit: autoMode ? 10 : intSetting('TPL'),
				includeSeedArtist: !autoMode && boolSetting('Seed'),
				rankEnabled: boolSetting('Rank'),
				bestEnabled: boolSetting('Best'),
				randomize: boolSetting('Random'),
				showConfirm: !autoMode && boolSetting('Confirm'),
				autoMode,
			};

			console.log('Similar Artists: generateSimilarPlaylist: Starting with config:', config_);

			// Step 1: Collect seed tracks
			updateProgress('Collecting seed tracks...', 0.1);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				throw new Error('No seed tracks found. Please select one or more tracks or start playing a track.');
			}

			//console.log(`generateSimilarPlaylist: Collected ${seeds.length} seed artist(s)`);
			updateProgress(`Found ${seeds.length} seed artist(s)`, 0.15);

			// Step 2: Process seeds to find similar artists and their tracks
			updateProgress('Processing seed artists...', 0.2);
			const trackRankMap = config_.rankEnabled ? new Map() : null;

			console.log(`generateSimilarPlaylist: About to process seeds with config:`, {
				seedLimit: config_.seedLimit,
				similarLimit: config_.similarLimit,
				tracksPerArtist: config_.tracksPerArtist,
				totalLimit: config_.totalLimit,
			});

			const results = await this.processSeedArtists(
				modules,
				seeds,
				config_,
				trackRankMap
			);

			console.log(`generateSimilarPlaylist: processSeedArtists returned ${results?.length || 0} tracks`);

			if (!results || results.length === 0) {
				// Not an error - just means no matches found, which is a normal scenario
				terminateProgressTask(taskId);
				showToast('No matching tracks found in your library. Try adjusting your filters or adding more music.', 'info');
				return {
					success: false,
					error: 'No matching tracks found in your library. Try adjusting your filters or adding more music.',
					tracksAdded: 0,
				};
			}

			console.log(`generateSimilarPlaylist: Found ${results.length} matching tracks`);
			updateProgress(`Found ${results.length} matching tracks`, 0.8);

			// Step 3: Apply ranking if enabled
			if (config_.rankEnabled && trackRankMap && trackRankMap.size > 0) {
				updateProgress('Applying ranking...', 0.85);
				results.sort((a, b) => {
					const rankA = trackRankMap.get(a.id || a.ID) || 0;
					const rankB = trackRankMap.get(b.id || b.ID) || 0;
					return rankB - rankA; // Higher rank first
				});
				console.log(`generateSimilarPlaylist: Applied ranking (${trackRankMap.size} ranked tracks)`);
			}

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				updateProgress('Randomizing results...', 0.87);
				shuffleUtil(results);
				console.log('generateSimilarPlaylist: Randomized track list');
			}

			// Step 5: Choose output method
			updateProgress('Preparing output...', 0.9);

			let outputPromise;
			// Use boolSetting to read Enqueue setting with safe fallback
			const enqueueEnabled = boolSetting('Enqueue', false);
			if (config_.autoMode || enqueueEnabled) {
				// Auto-mode or enqueue mode: add to Now Playing
				console.log('generateSimilarPlaylist: Enqueueing to Now Playing');
				outputPromise = this.queueResults(modules, results, config_);
			} else {
				// Create/update playlist
				console.log('generateSimilarPlaylist: Creating/updating playlist');
				// Build seed artist name list for playlist naming
				const seedName = this.buildPlaylistSeedName(seeds);
				config_.seedName = seedName;
				outputPromise = this.buildResultsPlaylist(modules, results, config_);
			}

			const output = await outputPromise;

			updateProgress('Complete!', 1.0);
			terminateProgressTask(taskId);

			showToast(`Added ${results.length} tracks from similar artists`);

			return {
				success: true,
				tracksAdded: results.length,
				tracks: results,
				output,
			};

		} catch (e) {
			console.error('generateSimilarPlaylist error: ' + formatError(e));
			if (taskId) {
				terminateProgressTask(taskId);
			}
			showToast(`Error: ${formatError(e)}`, 'error');
			return {
				success: false,
				error: e.message,
			};
		}
	},

	/**
	 * Collect seed tracks from UI selection or currently playing.
	 * 
	 * Priority:
	 * 1. Selected tracks in active pane
	 * 2. Currently playing track
	 * 
	 * Returns array of {name, track} objects where name is normalized artist name.
	 * Duplicates are removed based on normalized artist names.
	 * 
	 * @param {object} modules - Module dependencies
	 * @returns {Promise<Array>} Seed artist objects (deduplicated)
	 */
	async collectSeedTracks(modules) {
		const { utils: { normalization }, settings: { storage } } = modules;
		const { splitArtists } = normalization;
		const { getSetting } = storage;

		const seeds = [];
		const seenArtists = new Set(); // Track seen artists for deduplication

		// Helper to add artist if not already seen
		const addArtistIfNew = (artistName, track) => {
			const normalizedName = artistName.trim().toUpperCase();
			if (normalizedName && !seenArtists.has(normalizedName)) {
				seenArtists.add(normalizedName);
				seeds.push({ name: artistName, track: track });
			}
		};

		// Try to get selected tracklist from any pane
		let selectedList = null;
		try {
			if (uitools?.getSelectedTracklist) {
				selectedList = uitools.getSelectedTracklist();
			} else if (window?.currentList?.dataSource?.getSelectedTracklist) {
				selectedList = window.currentList.dataSource.getSelectedTracklist();
			}
		} catch (e) {
			console.log('collectSeedTracks: Could not get selected tracklist: ' + e.toString());
		}

		// Iterate selected tracks
		if (selectedList) {
			try {
				await selectedList.whenLoaded();

				// Prefer locked()+getFastObject (read-lock safe) when available, else fall back to forEach.
				if (typeof selectedList.locked === 'function' && typeof selectedList.getFastObject === 'function') {
					selectedList.locked(() => {
						let tmp;
						for (let i = 0; i < (selectedList.count || 0); i++) {
							tmp = selectedList.getFastObject(i, tmp);
							if (tmp?.artist) {
								for (const a of splitArtists(tmp.artist)) {
									addArtistIfNew(a, tmp);
								}
							}
						}
					});
				} else if (typeof selectedList.forEach === 'function') {
					selectedList.forEach((t) => {
						if (t?.artist) {
							for (const a of splitArtists(t.artist)) {
								addArtistIfNew(a, t);
							}
						}
					});
				} else if (typeof selectedList.getFastObject === 'function' && typeof selectedList.count === 'number') {
					// Last resort (may crash on some MM5 builds if read lock is required)
					let tmp;
					for (let i = 0; i < selectedList.count; i++) {
						tmp = selectedList.getFastObject(i, tmp);
						if (tmp?.artist) {
							for (const a of splitArtists(tmp.artist)) {
								addArtistIfNew(a, tmp);
							}
						}
					}
				}

				if (seeds.length > 0) {
					const artistNames = seeds.map(s => s.name).join(', ');
					console.log(`collectSeedTracks: Using ${seeds.length} unique selected artist(s): ${artistNames}`);
					return seeds;
				}
			} catch (e) {
				console.error('collectSeedTracks: Error iterating selection: ' + e.toString());
			}
		}

		// Fallback: use currently playing track
		try {
			const currentTrack = app.player?.getCurrentTrack?.();
			if (currentTrack?.artist) {
				for (const a of splitArtists(currentTrack.artist)) {
					addArtistIfNew(a, currentTrack);
				}
				console.log(`collectSeedTracks: Using currently playing track`);
				return seeds;
			}
		} catch (e) {
			console.error('collectSeedTracks: Error getting current track: ' + e.toString());
		}

		console.log('collectSeedTracks: No seed tracks found');
		return seeds;
	},

	/**
	 * Process seed artists to fetch similar artists from Last.fm and find matching tracks.
	 * 
	 * Algorithm:
	 * 1. For each seed artist (up to seedLimit)
	 * 2. Fetch similar artists from Last.fm (up to similarLimit)
	 * 3. Optionally include seed artist itself
	 * 4. For each artist in the pool, fetch top tracks from Last.fm
	 * 5. Batch-match tracks against library using fuzzy matching
	 * 6. Apply ranking and deduplication
	 * 7. Return deduplicated track list
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} seeds - Seed artist objects
	 * @param {object} config - Configuration settings
	 * @param {Map} [rankMap] - Optional rank scoring map (for ranking mode)
	 * @returns {Promise<Array>} Matched track objects
	 */
	async processSeedArtists(modules, seeds, config, rankMap = null) {
		const {
			utils: { helpers },
			settings: { storage, prefixes },
			ui: { notifications },
			api: { lastfmApi },
			db,
		} = modules;

		const { parseListSetting: parseListSettingUtil } = helpers;
		const { getSetting, intSetting, boolSetting } = storage;
		const { fixPrefixes } = prefixes;
		const { updateProgress } = notifications;
		const {
			fetchSimilarArtists,
			fetchTopTracks,
		} = lastfmApi;
		const {
			findLibraryTracksBatch,
		} = db;  // Changed: get function directly from db

		// Validate required functions
		console.log('processSeedArtists: Validating required functions...');
		console.log('processSeedArtists: fetchSimilarArtists available:', typeof fetchSimilarArtists === 'function');
		console.log('processSeedArtists: fetchTopTracks available:', typeof fetchTopTracks === 'function');
		console.log('processSeedArtists: findLibraryTracksBatch available:', typeof findLibraryTracksBatch === 'function');

		if (typeof findLibraryTracksBatch !== 'function') {
			console.error('processSeedArtists: findLibraryTracksBatch is not a function!');
			console.error('processSeedArtists: db object:', db);
			throw new Error('Database function findLibraryTracksBatch is not available');
		}

		const allTracks = [];
		const seenKeys = new Set();

		// Build blacklist from settings
		// parseListSetting already returns an array, no need to split
		const blacklist = new Set(
			parseListSettingUtil(getSetting('Black', ''))
				.map(s => String(s || '').trim().toUpperCase())
				.filter(s => s.length > 0)
		);

		// Helper to generate track deduplication keys
		function getTrackKey(track) {
			if (!track) return '';
			const id = track.id || track.ID;
			if (id && String(id) !== '0') return String(id);
			if (track.path) return `path:${track.path}`;
			return `meta:${track.title}:${track.album}:${track.artist}`;
		}

		// Process each seed (up to seedLimit)
		const seedSlice = seeds.slice(0, config.seedLimit || seeds.length);

		for (let i = 0; i < seedSlice.length; i++) {
			// Early exit if we reached total limit
			if (allTracks.length >= config.totalLimit) break;

			const seed = seedSlice[i];
			const progress = 0.2 + ((i + 1) / seedSlice.length) * 0.6;
			updateProgress(`Processing seed ${i + 1}/${seedSlice.length}: "${seed.name}"`, progress * 0.5);

			try {
				// Fetch similar artists
				const similar = await fetchSimilarArtists(
					fixPrefixes(seed.name),
					config.similarLimit
				);

				if (!similar || similar.length === 0) {
					console.log(`processSeedArtists: No similar artists found for "${seed.name}"`);
					continue;
				}

				// Build artist pool with deduplication and blacklist filtering
				const seen = new Set();
				const artistPool = [];

				const pushIfNew = (name) => {
					if (!name) return;
					const key = String(name).trim().toUpperCase();
					if (!key || seen.has(key)) return;
					if (blacklist.has(key)) return;
					seen.add(key);
					artistPool.push(name);
				};

				// Optionally add seed artist
				if (config.includeSeedArtist) {
					pushIfNew(seed.name);
				}

				// Add similar artists (up to similarLimit)
				for (let j = 0; j < Math.min(config.similarLimit, similar.length); j++) {
					if (similar[j]?.name) {
						pushIfNew(similar[j].name);
					}
				}
				console.log(`processSeedArtists: Processing ${artistPool.length} artists for seed "${seed.name}"`);

				// Process each artist in pool
				for (const artName of artistPool) {
					if (allTracks.length >= config.totalLimit) break;

					try {
						updateProgress(`Fetching tracks for "${artName}"...`, progress * 0.75);

						console.log(`processSeedArtists: Fetching top tracks for "${artName}" (limit: ${config.tracksPerArtist})`);

						// Fetch top tracks from Last.fm
						let titles = await fetchTopTracks(
							fixPrefixes(artName),
							config.tracksPerArtist,
							config.rankEnabled
						);

						if (!titles || titles.length === 0) {
							console.log(`processSeedArtists: No top tracks found for "${artName}"`);
							continue;
						}

						// Extract title strings (titles may be objects if rankEnabled)
						const titleStrings = titles.map(t => {
							if (typeof t === 'string') return t;
							if (t && typeof t === 'object') return t.title || t.name || String(t);
							return String(t || '');
						}).filter(s => s.length > 0);

						console.log(`processSeedArtists: Found ${titleStrings.length} top tracks for "${artName}":`, titleStrings.slice(0, 3));

						updateProgress(`Matching ${titleStrings.length} tracks from "${artName}"...`, progress * 0.9);

						// Get minimum rating from settings
						const minRating = intSetting('Rating', 0);
						const allowUnknown = boolSetting('Unknown', false);

						// Batch-match against library
						console.log(`processSeedArtists: Calling findLibraryTracksBatch for "${artName}" with ${titleStrings.length} titles`);
						const matches = await findLibraryTracksBatch(
							artName,
							titleStrings,
							1,
							{ rank: false, best: config.bestEnabled, minRating: minRating, allowUnknown: allowUnknown }
						);

						console.log(`processSeedArtists: findLibraryTracksBatch returned ${matches?.size || 0} results for "${artName}"`);

						// Add matched tracks with deduplication
						let addedCount = 0;
						for (const title of titleStrings) {
							if (allTracks.length >= config.totalLimit) break;

							const trackMatches = matches.get(title) || [];
							//console.log(`processSeedArtists: Title "${title}" has ${trackMatches.length} matches`);

							for (const track of trackMatches) {
								const key = getTrackKey(track);
								if (!key || seenKeys.has(key)) continue;

								seenKeys.add(key);
								allTracks.push(track);
								addedCount++;

								if (allTracks.length >= config.totalLimit) break;
							}
						}

						console.log(`processSeedArtists: Added ${addedCount} tracks from "${artName}" (total: ${allTracks.length})`);

					} catch (e) {
						console.error(`processSeedArtists: Error processing "${artName}": ${e.toString()}`);
						console.error(`processSeedArtists: Error stack:`, e.stack);
					}
				}

			} catch (e) {
				console.error(`processSeedArtists: Error for seed "${seed.name}": ${e.toString()}`);
			}
		}

		console.log(`processSeedArtists: Processed ${seedSlice.length} seeds, found ${allTracks.length} unique tracks`);
		return allTracks.slice(0, config.totalLimit);
	},

	/**
	 * Build and create/update a playlist with the result tracks.
	 * 
	 * Workflow:
	 * 1. Show playlist selection dialog if confirmation enabled
	 * 2. Create new playlist or get existing one
	 * 3. Add tracks to playlist
	 * 4. Navigate to playlist if enabled
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Result tracks to add
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Playlist info {id, name, created}
	 */
	async buildResultsPlaylist(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { getSetting, stringSetting, boolSetting } = storage;
		const { showToast } = notifications;

		if (!app.playlists) {
			throw new Error('Playlist API not available');
		}

		try {
			// Get playlist configuration
			const template = stringSetting('Name', '- Similar to %');
			const overwriteMode = getSetting('Overwrite', 'Create new playlist');
			const ignoreDupes = boolSetting('Ignore', false);

			console.log(`buildResultsPlaylist: overwriteMode = "${overwriteMode}"`);

			// Check for "Do not create playlist" mode - should enqueue instead
			if (overwriteMode.toLowerCase().indexOf('do not') > -1) {
				console.log('buildResultsPlaylist: "Do not create playlist" mode - enqueueing to Now Playing instead');
				// Delegate to queueResults
				const queueResult = await this.queueResults(
					modules, 
					tracks, 
					{ ...config, autoMode: false }
				);
				return {
					id: null,
					name: 'Now Playing',
					trackCount: queueResult.added || 0,
					enqueuedInstead: true,
				};
			}

			// Build playlist name from seed artists (passed in config)
			const seedName = config.seedName || 'Similar';
			
			// Apply template: replace % with seed artist names, or append if no %
			let playlistName;
			if (template.indexOf('%') >= 0) {
				playlistName = template.replace('%', seedName);
			} else {
				playlistName = `${template} ${seedName}`;
			}

			// Enforce max length of 100 characters for playlist name
			if (playlistName.length > 100) {
				playlistName = playlistName.substring(0, 97) + '...';
			}

			console.log(`buildResultsPlaylist: Generated playlist name: "${playlistName}"`);
			console.log(`buildResultsPlaylist: Template: "${template}", seedName: "${seedName}"`);

			// Show selection dialog if confirmation is enabled
			let targetPlaylist = null;
			if (config.showConfirm) {
				const dialogResult = await this.confirmPlaylist(playlistName, overwriteMode);

				if (dialogResult === null) {
					// User cancelled the dialog
					console.log('buildResultsPlaylist: User cancelled playlist dialog');
					return {
						id: null,
						name: null,
						trackCount: 0,
						cancelled: true,
					};
				} else if (dialogResult.autoCreate) {
					// User clicked OK without selecting a playlist - auto-create one
					console.log('buildResultsPlaylist: Auto-creating new playlist');
					targetPlaylist = null; // Will create below
				} else {
					// User selected an existing playlist
					targetPlaylist = dialogResult;
					console.log(`buildResultsPlaylist: User selected playlist: "${targetPlaylist.name}" (ID: ${targetPlaylist.id || targetPlaylist.ID})`);
				}
			} else {
				console.log('buildResultsPlaylist: Confirmation disabled, will auto-create playlist');
			}

			// Determine final name and whether we need to create/find playlist
			let finalName = playlistName;
			let shouldClear = false;

			// If no playlist selected from dialog, handle based on overwrite mode
			if (!targetPlaylist) {
				console.log(`buildResultsPlaylist: No target playlist selected, checking mode`);

				// "Create new playlist" mode - always generate unique name
				if (overwriteMode.toLowerCase().indexOf('create') > -1) {
					console.log('buildResultsPlaylist: "Create new playlist" mode');
					// Find unique name by appending index
					let idx = 1;
					let testPlaylist = this.findPlaylist(finalName);
					while (testPlaylist) {
						idx += 1;
						finalName = `${playlistName}_${idx}`;
						testPlaylist = this.findPlaylist(finalName);
					}
					console.log(`buildResultsPlaylist: Create mode - using unique name: "${finalName}"`);
					shouldClear = false; // New playlist, nothing to clear
				}
				// "Overwrite existing playlist" mode - find existing or create new
				else if (overwriteMode.toLowerCase().indexOf('overwrite') > -1) {
					console.log('buildResultsPlaylist: "Overwrite existing playlist" mode');
					// Try to find existing playlist with this name
					targetPlaylist = this.findPlaylist(finalName);
					if (targetPlaylist) {
						console.log(`buildResultsPlaylist: Found existing playlist "${finalName}" - will overwrite (clear first)`);
						shouldClear = true; // Existing playlist, clear it
					} else {
						console.log(`buildResultsPlaylist: No existing playlist "${finalName}" found - will create new`);
						shouldClear = false; // New playlist, nothing to clear
					}
				} else {
					// Default/unknown mode - treat as create
					console.log(`buildResultsPlaylist: Unknown mode "${overwriteMode}" - treating as create`);
					shouldClear = false;
				}
			} else {
				// User selected a playlist from dialog - respect overwrite mode for clearing
				shouldClear = overwriteMode.toLowerCase().indexOf('overwrite') > -1;
				console.log(`buildResultsPlaylist: User selected playlist, shouldClear = ${shouldClear}`);
			}

			// Create new playlist if we don't have one yet
			if (!targetPlaylist) {
				console.log(`buildResultsPlaylist: Creating new playlist with name: "${finalName}"`);
				
				const parentName = stringSetting('Parent', '');
				let parentPlaylist = null;

				// Find parent playlist if specified (and not empty)
				if (parentName && parentName.trim() !== '') {
					parentPlaylist = this.findPlaylist(parentName);
					if (parentPlaylist) {
						console.log(`buildResultsPlaylist: Found parent playlist '${parentName}' (ID: ${parentPlaylist.id || parentPlaylist.ID})`);
					} else {
						console.log(`buildResultsPlaylist: Parent playlist '${parentName}' not found, will create at root`);
					}
				} else {
					console.log('buildResultsPlaylist: No parent playlist specified, creating at root');
				}

				// Create new playlist as child of parent (or root if no parent)
				if (parentPlaylist && typeof parentPlaylist.newPlaylist === 'function') {
					targetPlaylist = parentPlaylist.newPlaylist();
					console.log(`buildResultsPlaylist: Created new playlist under parent '${parentName}'`);
				} else {
					if (!app.playlists.root) {
						console.error('buildResultsPlaylist: app.playlists.root is not available!');
						throw new Error('Playlist root not available');
					}
					targetPlaylist = app.playlists.root.newPlaylist();
					console.log('buildResultsPlaylist: Created new playlist at root level');
				}

				if (!targetPlaylist) {
					console.error('buildResultsPlaylist: Failed to create new playlist object');
					throw new Error('Failed to create new playlist object');
				}

				// Set name
				targetPlaylist.name = finalName;
				console.log(`buildResultsPlaylist: Set playlist name to '${finalName}'`);

				// Persist the playlist to database immediately
				try {
					await targetPlaylist.commitAsync();
					console.log(`buildResultsPlaylist: Committed new playlist to database (ID: ${targetPlaylist.id || targetPlaylist.ID})`);
				} catch (commitErr) {
					console.error(`buildResultsPlaylist: Error committing new playlist: ${commitErr.toString()}`);
					throw commitErr;
				}
			}

			console.log(`buildResultsPlaylist: Target playlist: "${targetPlaylist.name}" (ID: ${targetPlaylist.id || targetPlaylist.ID})`);
			console.log(`buildResultsPlaylist: shouldClear = ${shouldClear}`);

			// Add tracks to playlist using helper method
			const added = await this.addTracksToTarget(targetPlaylist, tracks, {
				ignoreDupes: ignoreDupes,
				clearFirst: shouldClear
			});

			console.log(`buildResultsPlaylist: Added ${added} track(s) to playlist "${targetPlaylist.name}"`);

			// Commit playlist changes to database (critical for persistence)
			try {
				await targetPlaylist.commitAsync();
				console.log(`buildResultsPlaylist: Committed final playlist changes to database`);
			} catch (e) {
				console.error(`buildResultsPlaylist: Error committing final playlist: ${e.toString()}`);
			}

			// Handle navigation based on user settings
			try {
				const nav = getSetting('Navigate', 'None');
				console.log(`buildResultsPlaylist: Navigation setting: "${nav}"`);
				
				// Exact string matching for navigation options
				if (nav === 'Navigate to new playlist') {
					const playlistId = targetPlaylist.id || targetPlaylist.ID;
					console.log(`buildResultsPlaylist: Navigating to playlist ID: ${playlistId}`);
					
					// Try multiple navigation methods (MM5 API variations)
					if (window.navigationHandlers?.playlist?.navigate) {
						window.navigationHandlers.playlist.navigate(targetPlaylist);
						console.log('buildResultsPlaylist: Navigated using window.navigationHandlers.playlist.navigate');
					} else if (app.playlists?.navigate) {
						app.playlists.navigate(targetPlaylist);
						console.log('buildResultsPlaylist: Navigated using app.playlists.navigate');
					} else if (window.navUtils?.navigateToPlaylist) {
						window.navUtils.navigateToPlaylist(targetPlaylist);
						console.log('buildResultsPlaylist: Navigated using navUtils.navigateToPlaylist');
					} else {
						console.log('buildResultsPlaylist: No navigation method available for playlists');
					}
				}
				else if (nav === 'Navigate to now playing') {
					console.log('buildResultsPlaylist: Navigating to Now Playing');
					
					// Try multiple navigation methods (MM5 API variations)
					if (window.navigationHandlers?.nowPlaying?.navigate) {
						window.navigationHandlers.nowPlaying.navigate();
						console.log('buildResultsPlaylist: Navigated using window.navigationHandlers.nowPlaying.navigate');
					} else if (app.player?.showNowPlaying) {
						app.player.showNowPlaying();
						console.log('buildResultsPlaylist: Navigated using app.player.showNowPlaying');
					} else if (window.navUtils?.navigateToNowPlaying) {
						window.navUtils.navigateToNowPlaying();
						console.log('buildResultsPlaylist: Navigated using navUtils.navigateToNowPlaying');
					} else {
						console.log('buildResultsPlaylist: No navigation method available for Now Playing');
					}
				} else {
					console.log(`buildResultsPlaylist: Navigation is "None"`);
				}
			} catch (e) {
				console.error(`buildResultsPlaylist: Navigation error: ${e.toString()}`);
			}

			return {
				id: targetPlaylist.id || targetPlaylist.ID,
				name: targetPlaylist.name,
				trackCount: added,
				created: true,
			};

		} catch (e) {
			console.error('buildResultsPlaylist error: ' + e.toString());
			throw e;
		}
	},

	/**
	 * Ask user for confirmation before creating/overwriting a playlist.
	 * Opens dlgSelectPlaylist dialog to let user select or create a playlist.
	 * @param {string} seedName Seed artist name used in playlist naming.
	 * @param {string} overwriteMode Mode label (Create/Overwrite/Do not create).
	 * @returns {Promise<object|null>} Selected/created playlist object, special auto-create indicator, or null if cancelled.
	 */
	async confirmPlaylist(seedName, overwriteMode) {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools.openDialog) {
					console.log('confirmPlaylist: uitools.openDialog not available');
					resolve({ autoCreate: true }); // Fallback to auto-create
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					// IMPORTANT: prevent dlgSelectPlaylist from creating a new playlist object
					showNewPlaylist: false
				});

				// Set dialog title
				try {
					dlg.title = 'Select an existing playlist or click OK to auto-create one.';
				} catch (_) {
					// ignore if title setting fails
				}

				// Handle dialog closure
				dlg.whenClosed = function () {
					try {
						// User clicked Cancel (modalResult !== 1)
						if (dlg.modalResult !== 1) {
							console.log(`confirmPlaylist: User cancelled dialog (modalResult=${dlg.modalResult})`);
							resolve(null);
							return;
						}

						// User clicked OK - check if they selected a playlist
						const selectedPlaylist = dlg.getValue && dlg.getValue('getPlaylist') ? dlg.getValue('getPlaylist')() : null;

						if (selectedPlaylist) {
							console.log(`confirmPlaylist: User selected existing playlist: ${selectedPlaylist.name || selectedPlaylist.title}`);
							resolve(selectedPlaylist);
						} else {
							console.log('confirmPlaylist: User clicked OK without selecting playlist - will auto-create');
							resolve({ autoCreate: true });
						}
					} catch (e) {
						console.error(`confirmPlaylist: Error in dialog closure: ${e.toString()}`);
						resolve({ autoCreate: true });
					}
				};

				app.listen(dlg, 'closed', dlg.whenClosed);

			} catch (e) {
				console.error(`confirmPlaylist: Error opening dialog: ${e.toString()}`);
				resolve({ autoCreate: true }); // Fallback to auto-create
			}
		});
	},

	/**
	 * Find an existing playlist by title (case-insensitive).
	 * @param {string} name Playlist title to search for.
	 * @returns {object|null} Playlist object if found, null otherwise.
	 */
	findPlaylist(name) {
		if (!name || typeof app === 'undefined' || !app.playlists) {
			return null;
		}

		try {
			// Use findByTitle (MM5 API)
			if (app.playlists?.findByTitle && typeof app.playlists.findByTitle === 'function') {
				const playlist = app.playlists.findByTitle(name);
				if (playlist) {
					console.log(`findPlaylist: Found playlist by title: "${name}"`);
					return playlist;
				}
			}
		} catch (e) {
			console.error(`findPlaylist: Error: ${e.toString()}`);
		}

		console.log(`findPlaylist: Playlist not found: "${name}"`);
		return null;
	},

	/**
	 * Add tracks to a playlist or Now Playing queue.
	 * @param {object} target Playlist or Now Playing queue object.
	 * @param {object[]} tracks Array of track objects to add.
	 * @param {object} options Options for adding tracks.
	 * @param {boolean} options.ignoreDupes Skip tracks already in target.
	 * @param {boolean} options.clearFirst Clear target before adding.
	 * @returns {Promise<number>} Number of tracks added.
	 */
	async addTracksToTarget(target, tracks, options = {}) {
		const { ignoreDupes = false, clearFirst = false } = options;

		if (!target) {
			console.log('addTracksToTarget: No target provided');
			return 0;
		}

		// Clear target if requested
		if (clearFirst) {
			try {
				if (target.clearTracksAsync && typeof target.clearTracksAsync === 'function') {
					await target.clearTracksAsync();
					console.log('addTracksToTarget: Cleared target');
				} else {
					console.log('addTracksToTarget: clearTracksAsync not available');
				}
			} catch (e) {
				console.error(`addTracksToTarget: Error clearing target: ${e.toString()}`);
			}
		}

		// Build set of existing track IDs for deduplication
		const existing = new Set();
		if (ignoreDupes) {
			try {
				// Try getTracklist() for playlists
				if (target.getTracklist && typeof target.getTracklist === 'function') {
					const tracklist = target.getTracklist();
					await tracklist.whenLoaded();
					tracklist.forEach((t) => {
						if (t) existing.add(t.id || t.ID);
					});
				}
			} catch (e) {
				console.error(`addTracksToTarget: Error building existing track set: ${e.toString()}`);
			}
		}

		// Filter out duplicates if needed
		const tracksToAdd = ignoreDupes
			? tracks.filter((t) => {
				const id = t?.id || t?.ID;
				return !id || !existing.has(id);
			})
			: tracks;

		if (!tracksToAdd || tracksToAdd.length === 0) {
			console.log('addTracksToTarget: No tracks to add after filtering');
			return 0;
		}

		// Add tracks using MM5 API
		try {
			if (!app.utils?.createTracklist) {
				console.log('addTracksToTarget: app.utils.createTracklist not available');
				return 0;
			}

			if (!target.addTracksAsync || typeof target.addTracksAsync !== 'function') {
				console.log('addTracksToTarget: target.addTracksAsync not available');
				return 0;
			}

			// Create a mutable temporary tracklist
			const tracklist = app.utils.createTracklist(true);

			if (!tracklist) {
				console.log('addTracksToTarget: Failed to create tracklist');
				return 0;
			}

			// Add all tracks to the temporary tracklist
			for (const t of tracksToAdd) {
				if (t && typeof tracklist.add === 'function') {
					tracklist.add(t);
				}
			}

			// Wait for tracklist to be ready
			await tracklist.whenLoaded();

			// Add tracks to target
			if (tracklist.count > 0) {
				await target.addTracksAsync(tracklist);
				console.log(`addTracksToTarget: Added ${tracklist.count} tracks (async batch)`);
				return tracklist.count;
			}

			console.log('addTracksToTarget: No tracks in tracklist to add');
			return 0;

		} catch (e) {
			console.error(`addTracksToTarget: Error: ${e.toString()}`);
			return 0;
		}
	},

	/**
	 * Build a comma-separated artist label from seed artists for playlist naming.
	 * Limits total length to keep playlist names readable.
	 * @param {Array<{name: string}>} seeds Array of seed artist objects.
	 * @returns {string} Comma-separated artist names with ellipsis if truncated.
	 */
	buildPlaylistSeedName(seeds) {
		const names = (seeds || []).map((s) => s?.name).filter((n) => n && n.trim().length);
		if (!names.length) return 'Similar';

		// Limit artist portion to 80 characters to keep full playlist name under 100
		const maxLabelLen = 80;
		let label = names[0];
		
		for (let i = 1; i < names.length; i++) {
			const candidate = `${label}, ${names[i]}`;
			if (candidate.length > maxLabelLen) {
				label += '...';
				break;
			}
			label = candidate;
		}
		
		return label;
	},

	/**
	 * Enqueue tracks to Now Playing queue.
	 * 
	 * Workflow:
	 * 1. Clear Now Playing if configured
	 * 2. Filter duplicates if configured  
	 * 3. Add tracks to Now Playing using MM5 API
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Result tracks to enqueue
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Queue info {added, cleared}
	 */
	async queueResults(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { boolSetting } = storage;
		const { showToast, updateProgress } = notifications;

		try {
			console.log(`queueResults: Enqueueing ${tracks.length} tracks to Now Playing`);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey player not available');
			}

			const player = app.player;

			// Get configuration
			const clearNP = config.autoMode ? false : boolSetting('ClearNP', false);
			const ignoreDupes = config.autoMode ? true : boolSetting('Ignore', false);

			// Clear Now Playing if requested
			let cleared = false;
			if (clearNP) {
				updateProgress('Clearing Now Playing...', 0.1);
				try {
					if (player.clearPlaylistAsync && typeof player.clearPlaylistAsync === 'function') {
						await player.clearPlaylistAsync();
						cleared = true;
						console.log('queueResults: Cleared Now Playing');
					} else if (player.stop && typeof player.stop === 'function') {
						player.stop();
						console.log('queueResults: Stopped playback (clearPlaylistAsync not available)');
					}
				} catch (e) {
					console.error(`queueResults: Error clearing Now Playing: ${e.toString()}`);
				}
			}

			// Build set of existing track IDs for deduplication
			const existing = new Set();
			if (ignoreDupes) {
				updateProgress('Checking for duplicates...', 0.2);
				try {
					const songList = player.getSongList?.();
					if (songList) {
						const tracklist = songList.getTracklist?.();
						if (tracklist) {
							await tracklist.whenLoaded();
							tracklist.forEach((t) => {
								if (t) existing.add(t.id || t.ID);
							});
							console.log(`queueResults: Found ${existing.size} existing tracks in Now Playing`);
						}
					}
				} catch (e) {
					console.error(`queueResults: Error building existing track set: ${e.toString()}`);
				}
			}

			// Filter out duplicates if needed
			const tracksToAdd = ignoreDupes
				? tracks.filter((t) => {
					const id = t?.id || t?.ID;
					return !id || !existing.has(id);
				})
				: tracks;

			if (!tracksToAdd || tracksToAdd.length === 0) {
				console.log('queueResults: No tracks to add after filtering');
				showToast('No new tracks to add to Now Playing', 'info');
				return {
					added: 0,
					cleared,
				};
			}

			// Add tracks using MM5 API
			updateProgress(`Adding ${tracksToAdd.length} tracks to Now Playing...`, 0.5);

			try {
				if (!app.utils?.createTracklist) {
					throw new Error('app.utils.createTracklist not available');
				}

				if (!player.addTracksAsync || typeof player.addTracksAsync !== 'function') {
					throw new Error('player.addTracksAsync not available');
				}

				// Create a mutable temporary tracklist
				const tracklist = app.utils.createTracklist(true);

				if (!tracklist) {
					throw new Error('Failed to create tracklist');
				}

				// Add all tracks to the temporary tracklist
				for (const t of tracksToAdd) {
					if (t && typeof tracklist.add === 'function') {
						tracklist.add(t);
					}
				}

				// Wait for tracklist to be ready
				await tracklist.whenLoaded();

				// Add tracks to Now Playing
				if (tracklist.count > 0) {
					await player.addTracksAsync(tracklist);
					console.log(`queueResults: Successfully added ${tracklist.count} track(s) to Now Playing`);

					updateProgress('Complete!', 1.0);

					return {
						added: tracklist.count,
						cleared,
					};
				} else {
					console.log('queueResults: No tracks in tracklist to add');
					return {
						added: 0,
						cleared,
					};
				}

			} catch (e) {
				console.error(`queueResults: Error adding tracks: ${e.toString()}`);
				throw e;
			}

		} catch (e) {
			console.error('queueResults error: ' + e.toString());
			showToast(`Error enqueuing tracks: ${e.message}`, 'error');
			throw e;
		}
	},
};
