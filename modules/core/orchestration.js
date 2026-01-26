/**
 * MatchMonkey Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - Discovery strategies (artist/track/genre based)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

window.matchMonkeyOrchestration = {
	/**
	 * Main orchestration function that runs the complete MatchMonkey workflow.
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', or 'genre`
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false, discoveryMode = 'artist') {
		const {
			utils: { helpers },
			settings: { storage },
			ui: { notifications },
			db,
			_moodActivityContext,  // NEW: Optional mood/activity context
		} = modules;

		const { intSetting, boolSetting, stringSetting } = storage;
		const { showToast, updateProgress, createProgressTask, terminateProgressTask } = notifications;
		const { formatError, shuffle: shuffleUtil } = helpers;

		// Get discovery strategies
		const strategies = window.matchMonkeyDiscoveryStrategies;
		if (!strategies) {
			console.error('Match Monkey: Discovery strategies module not loaded');
			showToast('Add-on error: Discovery strategies not loaded', 'error');
			return { success: false, error: 'Discovery strategies not loaded', tracksAdded: 0 };
		}

		let taskId = null;

		try {
			// Initialize progress tracking
			const modeName = strategies.getDiscoveryModeName(discoveryMode);
			taskId = createProgressTask(`Generating ${modeName} Playlist`);
			updateProgress(`Initializing ${modeName} search...`, 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration with new property names
			// Support both old and new property names for backwards compatibility
			let config_;

			if (autoMode) {
				// Auto-mode uses dedicated auto-mode settings
				config_ = {
					// Auto-mode specific limits (user configurable)
					seedLimit: intSetting('AutoModeSeedLimit', 2),
					similarLimit: intSetting('AutoModeSimilarLimit', 10),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('AutoModeTracksPerArtist', 5),
					totalLimit: intSetting('AutoModeMaxTracks', 30),
					
					// Behavior settings
					includeSeedArtist: boolSetting('IncludeSeedArtist', boolSetting('Seed', true)),
					rankEnabled: boolSetting('UseLastfmRanking', boolSetting('Rank', true)),
					bestEnabled: boolSetting('PreferHighQuality', boolSetting('Best', true)),
					randomize: true, // Always shuffle in auto-mode
					showConfirm: false, // Never show confirm in auto-mode
					minRating: intSetting('MinRating', intSetting('Rating', 0)),
					allowUnknown: boolSetting('IncludeUnrated', boolSetting('Unknown', true)),
					autoMode: true,
					discoveryMode,
				};
			} else {
				// Manual mode uses standard settings
				const maxTracks = intSetting('MaxPlaylistTracks', intSetting('TPL', 0));
				
				config_ = {
					// Discovery limits
					seedLimit: intSetting('SimilarArtistsLimit', intSetting('SeedLimit', 20)),
					similarLimit: intSetting('SimilarArtistsLimit', intSetting('SimilarLimit', 20)),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('TracksPerArtist', intSetting('TPA', 30)),
					// 0 = unlimited (a very high number to effectively disable the limit)
					totalLimit: maxTracks > 0 ? maxTracks : 100000,
					
					// Behavior settings
					includeSeedArtist: boolSetting('IncludeSeedArtist', boolSetting('Seed', true)),
					rankEnabled: boolSetting('UseLastfmRanking', boolSetting('Rank', true)),
					bestEnabled: boolSetting('PreferHighQuality', boolSetting('Best', true)),
					randomize: boolSetting('ShuffleResults', boolSetting('Random', true)),
					showConfirm: boolSetting('ShowConfirmDialog', boolSetting('Confirm', false)),
					minRating: intSetting('MinRating', intSetting('Rating', 0)),
					allowUnknown: boolSetting('IncludeUnrated', boolSetting('Unknown', true)),
					autoMode: false,
					discoveryMode,
				};
			}
			
			// Add mood/activity context if present
			if (_moodActivityContext) {
				config_.moodActivityContext = _moodActivityContext.context;
				config_.moodActivityValue = _moodActivityContext.value;
				config_.playlistDuration = _moodActivityContext.duration;
				config_.moodActivityBlendRatio = intSetting('MoodActivityBlendRatio', 50) / 100.0; // Convert 0-100 to 0.0-1.0
				console.log(`Match Monkey: Using ${_moodActivityContext.context} context: ${_moodActivityContext.value} (blend ratio: ${config_.moodActivityBlendRatio})`);
			}

			console.log(`Match Monkey: Starting ${modeName} discovery (autoMode=${autoMode}, mode=${discoveryMode})`);
			console.log(`Match Monkey: Limits - seeds:${config_.seedLimit}, similar:${config_.similarLimit}, tracksPerArtist:${config_.tracksPerArtist}, total:${config_.totalLimit}`);

			// Step 1: Collect seed tracks
			updateProgress(`[${modeName}] Collecting seed tracks...`, 0.05);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No seed tracks found. Select tracks or play something first.`, 'warning');
				return {
					success: false,
					error: 'No seed tracks found.',
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Collected ${seeds.length} seed(s)`);
			updateProgress(`[${modeName}] Found ${seeds.length} seed(s)`, 0.1);

			// Step 2: Run discovery strategy
			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;

			try {
				candidates = await discoveryFn(modules, seeds, config_);
			} catch (discoveryError) {
				console.error(`Match Monkey [${modeName}]: Discovery error:`, discoveryError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Discovery error: ${formatError(discoveryError)}`, 'error');
				return {
					success: false,
					error: formatError(discoveryError),
					tracksAdded: 0,
				};
			}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No matches found. Try different seeds.`, 'info');
				return {
					success: false,
					error: `No ${modeName.toLowerCase()} found.`,
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Discovery returned ${candidates.length} candidates`);

			// Step 3: Match candidates to local library
			updateProgress(`[${modeName}] Searching local library...`, 0.6);
			let results;

			try {
				results = await this.matchCandidatesToLibrary(modules, candidates, config_);
			} catch (matchError) {
				console.error(`Match Monkey [${modeName}]: Library matching error:`, matchError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Library error: ${formatError(matchError)}`, 'error');
				return {
					success: false,
					error: formatError(matchError),
					tracksAdded: 0,
				};
			}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No matching tracks in your library. Try different seeds or filters.`, 'info');
				return {
					success: false,
					error: 'No matching tracks found in your library.',
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Found ${results.length} matching tracks in library`);
			updateProgress(`[${modeName}] Found ${results.length} matching tracks`, 0.8);

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				updateProgress(`[${modeName}] Randomizing results...`, 0.85);
				shuffleUtil(results);
			}

			// Apply final limit only if set (totalLimit < 100000 means it was explicitly set)
			const finalResults = config_.totalLimit < 100000 
				? results.slice(0, config_.totalLimit)
				: results; // No limit - use all found tracks

			console.log(`Match Monkey [${modeName}]: Final results: ${finalResults.length} tracks (limit was ${config_.totalLimit < 100000 ? config_.totalLimit : 'unlimited'})`);

			// Step 5: Choose output method
			updateProgress(`[${modeName}] Preparing output...`, 0.9);

			const enqueueEnabled = boolSetting('EnqueueMode', boolSetting('Enqueue', false));
			let output;

			try {
				if (config_.autoMode || enqueueEnabled) {
					output = await this.queueResults(modules, finalResults, config_);
				} else {
					const seedName = this.buildPlaylistSeedName(seeds);
					config_.seedName = seedName;
					config_.modeName = modeName;
					output = await this.buildResultsPlaylist(modules, finalResults, config_);
				}
			} catch (outputError) {
				console.error(`Match Monkey [${modeName}]: Output error:`, outputError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Output error: ${formatError(outputError)}`, 'error');
				return {
					success: false,
					error: formatError(outputError),
					tracksAdded: 0,
				};
			}

			updateProgress(`[${modeName}] Complete!`, 1.0);
			terminateProgressTask(taskId);

			// Get actual number of tracks added from output
			const actualTracksAdded = output?.added ?? finalResults.length;
			
			showToast(`Added ${actualTracksAdded} tracks (${modeMode
