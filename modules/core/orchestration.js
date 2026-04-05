/**
 * MatchMonkey Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - Discovery strategies (artist/track/genre/recco/mood/activity)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 

 * 
 * @author Remo Imparato

 */

'use strict';

window.matchMonkeyOrchestration = {
	/**
	 * Normalize popularity from a track object.
	 * Handles both ReccoBeats popularity (0-100 scale) and Last.fm playcount (converted to 0-100 scale).
	 * 
	 * @param {object} track - Track object with optional popularity (number) or playcount (number) properties
	 * @returns {object} Object with { popularity: number, rawPlaycount: number }
	 */
	normalizePopularityFromTrack(track) {
		let popularity = 0;
		let rawPlaycount = 0;

		if (typeof track === 'object' && track !== null) {
			// ReccoBeats popularity (already 0-100 scale)
			if (track.popularity != null && !isNaN(track.popularity)) {
				popularity = Math.round(Number(track.popularity));
			}
			// Last.fm playcount (convert to 0-100 scale using log scale)
			else if (track.playcount != null && !isNaN(track.playcount)) {
				rawPlaycount = Number(track.playcount);
				if (rawPlaycount > 0) {
					//*
					// Logarithmic scale tuned for high playcounts:
					// ~500K ~ 81, 1M ~ 85, 2M ~ 89, 3M ~ 92, 5M ~ 95, 10M ~ 99
					popularity = Math.min(100, Math.round(Math.log10(rawPlaycount + 1) * 14.18));
					/*/
					// Logarithmic popularity curve anchored at:
					// 500K plays ~ 50, 15M plays ~ 100
					const log = Math.log10(rawPlaycount + 1);
					const raw = 33.85 * log - 143.0;   // your anchored log curve
					popularity = Math.round(100 / (1 + Math.exp(-(raw - 60) / 8)));
					//*/
				}
			}
		}

		return { popularity, rawPlaycount };
	},

	/**
	 * Main orchestration function that runs the complete MatchMonkey workflow.
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', 'genre', 'acoustics', 'mood', or 'activity'
	 * @param {number} [autoModeThreshold] - Threshold for auto-mode seed collection
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false, discoveryMode = 'artist', autoModeThreshold = 3) {
		const {
			utils: { helpers },
			settings: { storage },
			ui: { notifications },
			db,
			_moodActivityContext,
		} = modules;

		const { getSetting, intSetting, boolSetting, stringSetting, refreshSettings } = storage;
		const { showToast, updateProgress, createProgressTask, terminateProgressTask, isCancelled } = notifications;
		const { formatError, shuffle: shuffleUtil, shuffleWithDispersion } = helpers;
		const checkCancelled = () => { if (isCancelled()) throw new Error('__CANCELLED__'); };

		// Get logger and discovery strategies
		const logger = window.matchMonkeyLogger;
		const strategies = window.matchMonkeyDiscoveryStrategies;
		if (!strategies) {
			logger.error('Init', 'Discovery strategies module not loaded');
			showToast('Add-on error: Discovery strategies not loaded', { type: 'error', duration: 5000 });
			return { success: false, error: 'Discovery strategies not loaded', tracksAdded: 0 };
		}

		// Initialize cache for this run
		const cache = window.matchMonkeyCache;
		cache?.init?.();

		// Refresh settings from persistent store so any changes saved in the
		// options panel are picked up without needing a restart.
		refreshSettings?.();

		let taskId = null;
		const startTime = Date.now();

		try {
			// Initialize progress tracking
			const modeName = strategies.getDiscoveryModeName(discoveryMode);
			taskId = createProgressTask(`MatchMonkey - ${modeName}`);
			updateProgress(`Preparing ${modeName} discovery...`, 0);
			logger.info('Workflow', `=== Starting ${modeName} Discovery (auto=${autoMode}) ===`);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration
			let config_;

			if (autoMode) {
				config_ = {
					seedLimit: intSetting('AutoModeSeedLimit', 2),
					similarLimit: intSetting('AutoModeSimilarLimit', 10),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('AutoModeTracksPerArtist', 5),
					totalLimit: intSetting('AutoModeMaxTracks', 30),
					includeSeedArtist: boolSetting('IncludeSeedArtist', true),
					rankEnabled: boolSetting('UseLastfmRanking', true),
					formatPreference: stringSetting('AudioFormatPreference', 'Mixed (all formats)'),
					randomize: true,
					showConfirm: false,
					minRating: intSetting('AutoModeMinRating', 0),
					allowUnknown: boolSetting('AutoModeIncludeUnrated', true),
					autoMode: true,
					discoveryMode,
				};
				logger.debug('Config', `Auto-Mode: minRating=${config_.minRating}, allowUnknown=${config_.allowUnknown}`);
			} else {
				const maxTracks = intSetting('MaxPlaylistTracks', 0);

				config_ = {
					seedLimit: intSetting('SimilarArtistsLimit', 20),
					similarLimit: intSetting('SimilarArtistsLimit', 20),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('TracksPerArtist', 10000), // High limit for manual mode (capped at 10k by database)
					totalLimit: maxTracks > 0 ? maxTracks : 100000,
					includeSeedArtist: boolSetting('IncludeSeedArtist', true),
					rankEnabled: boolSetting('UseLastfmRanking', true),
					formatPreference: stringSetting('AudioFormatPreference', 'Mixed (all formats)'),
					randomize: boolSetting('ShuffleResults', true),
					showConfirm: boolSetting('ShowConfirmDialog', false),
					minRating: intSetting('MinRating', 0),
					allowUnknown: boolSetting('IncludeUnrated', true),
					autoMode: false,
					discoveryMode,
				};
				logger.debug('Config', `Manual-Mode: minRating=${config_.minRating}, allowUnknown=${config_.allowUnknown}`);
			}

			// Read additional user settings
			try {
				config_.localCollection = stringSetting('LocalCollection', '');
				// ApiMinMatch: single threshold for both Last.fm match and ReccoBeats popularity (0.00-99.99%)
				// Treat blank, null, undefined, or 0 as "no filtering" (disabled)
				const rawApiMatch = getSetting('ApiMinMatch');
				let apiMatch = 0;
				if (rawApiMatch !== null && rawApiMatch !== undefined && rawApiMatch !== '') {
					apiMatch = parseFloat(String(rawApiMatch));
					if (isNaN(apiMatch)) apiMatch = 0;
				}
				config_.apiMinMatch = Math.max(0, Math.min(99.99, Math.round(apiMatch * 100) / 100));
				logger.debug('Config', `localCollection='${config_.localCollection}', apiMinMatch=${config_.apiMinMatch === 0 ? 'disabled' : config_.apiMinMatch + '%'}`);
			} catch (e) {
				logger.warn('Config', `Failed to read additional settings: ${e.message}`);
			}

			// Add mood/activity context if present
			if (_moodActivityContext) {
				// Context explicitly provided
				config_.moodActivityContext = _moodActivityContext.context;
				config_.moodActivityValue = _moodActivityContext.value;
				logger.info('Config', `Using ${config_.moodActivityContext} "${config_.moodActivityValue}"`);
			}

			// Log configuration summary
			logger.info('Config', `seedLimit=${config_.seedLimit}, similarLimit=${config_.similarLimit}, tracksPerArtist=${config_.tracksPerArtist}`);

			// Step 1: Collect seed tracks
			let seeds = [];
			const seedsRequired = true;

			if (seedsRequired) {
				updateProgress(`Collecting seed tracks...`, 0.05);

				// In auto-mode, collect seeds from Now Playing queue
				if (autoMode) {
					logger.debug('Seeds', `Using Now Playing queue (threshold=${autoModeThreshold})`);
					seeds = await this.collectAutoModeSeedsFromQueue(modules, autoModeThreshold);
				} else {
					// Manual mode: use selection or current track
					seeds = await this.collectSeedTracks(modules);
				}

				if (!seeds || seeds.length === 0) {
					terminateProgressTask(taskId);
					cache?.save?.();
					const modeMsg = autoMode ? 'No tracks in Now Playing queue.' : 'Select tracks or play something first.';
					showToast(`No seed tracks found. ${modeMsg}`, { type: 'warning', duration: 5000 });
					logger.info('Seeds', 'No seed tracks found, exiting');
					return { success: false, error: 'No seed tracks found.', tracksAdded: 0 };
				}

				logger.info('Seeds', `Collected ${seeds.length} seed track(s)`);
					updateProgress(`Found ${seeds.length} seed track(s)`, 0.1);
					checkCancelled();
				} else {
				// Mood/Activity modes don't need seeds
				logger.info('Seeds', `${discoveryMode} mode - no seeds required`);
				updateProgress(`Starting ${modeName} discovery...`, 0.1);
			}

			// Step 2: Run discovery strategy
			updateProgress(`Contacting ${modeName} service...`, 0.15);
			logger.info('Discovery', `=== Phase 1: ${modeName} ===`);

			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;
			let discoveryStats = { apiFilteredCount: 0, audioFeatureFilteredCount: 0, totalFromApi: 0 };

			try {
				const discoveryResult = await discoveryFn(modules, seeds, config_);
				// Discovery strategies now return {candidates, stats}
				// Mood/Activity hybrid mode also returns {libraryTracks} for direct use
				candidates = discoveryResult.candidates || discoveryResult;
				discoveryStats = discoveryResult.stats || { apiFilteredCount: 0, totalFromApi: 0 };

				// Check if discovery already matched to library (new mood/activity hybrid approach)
				if (discoveryResult.libraryTracks && discoveryResult.libraryTracks.length > 0) {
					logger.info('Discovery', `Mood/Activity hybrid mode: ${discoveryResult.libraryTracks.length} library tracks already matched`);
					// Store for use in library matching step (skip normal matching)
					config_._preMatchedLibraryTracks = discoveryResult.libraryTracks;
				}
			} catch (discoveryError) {
					if (discoveryError?.message === '__CANCELLED__') throw discoveryError;
					logger.error('Discovery', 'Discovery failed', discoveryError);
					terminateProgressTask(taskId);
					cache?.save?.();
					showToast(`Discovery failed: ${formatError(discoveryError)}`, { type: 'error', duration: 5000 });
					return { success: false, error: formatError(discoveryError), tracksAdded: 0 };
				}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				cache?.save?.();

				// Provide specific guidance based on discovery mode
				let errorMsg = `No ${modeName} candidates found.`;
				let guidance = '';

				if (discoveryMode === 'acoustics') {
					errorMsg = `No tracks found on ReccoBeats.`;
					guidance = ' Acoustic search requires Artist, Album, and Track tags to match official release names exactly. Check your library metadata for accuracy.';
				} else if (discoveryMode === 'mood' || discoveryMode === 'activity') {
					errorMsg = `No matching tracks found for ${modeName}.`;
					guidance = ' Try different seed tracks or verify your tags match official release names.';
				} else {
					guidance = ' Try different seeds or adjust settings.';
				}

				showToast(`${errorMsg}${guidance}`, { type: 'info', duration: 7000 });
				logger.info('Discovery', 'Discovery returned no candidates');
				return { success: false, error: `No ${modeName} found.`, tracksAdded: 0 };
			}

			// Log discovery results with appropriate message based on mode
			if (discoveryMode === 'mood' || discoveryMode === 'activity') {
				const audioFiltered = discoveryStats.audioFeatureFilteredCount || 0;
				const apiFiltered = discoveryStats.apiFilteredCount || 0;
				const filterParts = [];
				if (audioFiltered > 0) filterParts.push(`${audioFiltered} filtered by audio features`);
				if (apiFiltered > 0) filterParts.push(`${apiFiltered} filtered by API threshold`);
				const filterMsg = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';
				logger.info('Discovery', `Found ${candidates.length} candidates${filterMsg}`);
			} else {
				const apiFiltered = discoveryStats.apiFilteredCount || 0;
				logger.info('Discovery', `Found ${candidates.length} candidates${apiFiltered > 0 ? ` (${apiFiltered} filtered by API threshold)` : ''}`);
			}
			updateProgress(`Found ${candidates.length} candidate(s)`, 0.5);

			// Step 3: Match candidates to local library
			updateProgress(`Searching your music library...`, 0.55);
			logger.info('Library', `=== Phase 2: Library Matching ===`);

			// Step 3: Match candidates to local library
			let results;
			let matchStats = null;

			updateProgress(`Matching candidates to your library...`, 0.6);
			try {
				// Check if discovery already provided library tracks (new mood/activity hybrid approach)
				if (config_._preMatchedLibraryTracks && config_._preMatchedLibraryTracks.length > 0) {
					// Use pre-matched tracks directly (mood/activity hybrid mode)
					results = config_._preMatchedLibraryTracks;
					logger.info('Library', `Using ${results.length} pre-matched library tracks from hybrid discovery`);
				}
				// Check if this is a mood/activity filter candidate (legacy special handling)
				else if (candidates.length === 1 &&
					(candidates[0].artist === '__MOOD_FILTER__' || candidates[0].artist === '__ACTIVITY_FILTER__')) {
					// Mood/Activity mode - search library with audio filtering
					results = await this.matchMoodActivityToLibrary(modules, candidates[0], config_);
				} else {
					// Standard artist/track matching - returns {tracks, stats}
					const matchResult = await this.matchCandidatesToLibrary(modules, candidates, config_);
					results = matchResult.tracks;
					matchStats = matchResult.stats;
				}
			} catch (matchError) {
					if (matchError?.message === '__CANCELLED__') throw matchError;
					logger.error('Library', 'Library matching error', matchError);
					terminateProgressTask(taskId);
					cache?.save?.();
					showToast(`Library search failed: ${formatError(matchError)}`, { type: 'error', duration: 5000 });
					return { success: false, error: formatError(matchError), tracksAdded: 0 };
				}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				cache?.save?.();
				showToast(`No matching tracks found in your library. Try different seeds or adjust filters.`, { type: 'info', duration: 5000 });
				logger.info('Library', 'No tracks matched in library');
				return { success: false, error: 'No matching tracks found.', tracksAdded: 0 };
			}

			logger.info('Library', `Found ${results.length} matching track(s)`);
			updateProgress(`Found ${results.length} matching track(s)`, 0.8);

			// Step 4: Remove duplicates based on artist + title
			// When duplicates exist (e.g., MP3 and FLAC versions), prefer higher quality formats
			updateProgress(`Removing duplicates...`, 0.82);
			const makeDupKey = (t) => {
				if (!t) return '';
				const artistRaw = t.artist || t.Artist || '';
				const titleRaw = t.title || t.SongTitle || t.Title || '';
				const artist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
					? matchMonkeyHelpers.cleanArtistName(artistRaw)
					: String(artistRaw || '').trim();
				const title = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
					? matchMonkeyHelpers.cleanTrackName(titleRaw)
					: String(titleRaw || '').trim();
				return `${artist.toUpperCase()}||${title.toUpperCase()}`;
			};

			// Helper to determine audio quality priority (higher number = better quality)
			const getFormatPriority = (track) => {
				if (!track) return 0;
				const ext = (track.fileExtension || track.FileExtension || '').toLowerCase().replace('.', '');
				const type = (track.fileType || track.FileType || '').toLowerCase();

				// Lossless formats get highest priority
				if (ext === 'flac' || type === 'flac') return 100;
				if (ext === 'ape' || type === 'ape') return 95;
				if (ext === 'wav' || type === 'wav') return 90;
				if (ext === 'alac' || ext === 'm4a' || type === 'alac') return 85;
				if (ext === 'wv' || type === 'wavpack') return 80;

				// High bitrate lossy formats
				if (ext === 'mp3' || type === 'mp3') {
					const bitrate = track.bitrate || track.Bitrate || 0;
					if (bitrate >= 320) return 70;
					if (bitrate >= 256) return 65;
					if (bitrate >= 192) return 60;
					return 50;
				}

				// Other lossy formats
				if (ext === 'ogg' || type === 'ogg') return 55;
				if (ext === 'wma' || type === 'wma') return 45;
				if (ext === 'aac' || type === 'aac') return 52;

				return 0;
			};

			const duplicateMap = new Map();
			for (const track of results) {
				const dupKey = makeDupKey(track);
				if (!dupKey) continue;

				const existing = duplicateMap.get(dupKey);
				if (!existing) {
					duplicateMap.set(dupKey, track);
				} else {
					// Compare quality - keep the higher quality version
					const existingPriority = getFormatPriority(existing);
					const newPriority = getFormatPriority(track);

					const existingBitrate = existing.bitrate || existing.Bitrate || 0;
					const newBitrate = track.bitrate || track.Bitrate || 0;
					const existingExt = (existing.fileExtension || existing.FileExtension || 'unknown').toUpperCase();
					const newExt = (track.fileExtension || track.FileExtension || 'unknown').toUpperCase();

					if (newPriority > existingPriority || (newPriority === existingPriority && newBitrate > existingBitrate)) {
						duplicateMap.set(dupKey, track);
						logger.debug('Dedup', `Preferring ${newExt}/${newBitrate}kbps over ${existingExt}/${existingBitrate}kbps for "${makeDupKey(track).replace('||', ' - ')}"`);
					}
				}
			}

			const dedupedResults = Array.from(duplicateMap.values());
			const dedupRemovedCount = results.length - dedupedResults.length;

			logger.debug('Dedup', `Removed ${dedupRemovedCount} duplicates, ${dedupedResults.length} unique tracks remain`);
			updateProgress(`Removed ${dedupRemovedCount} duplicates → ${dedupedResults.length} unique tracks`, 0.83);

			// Step 5: Include seed tracks if enabled (before shuffling)
			// When IncludeSeedArtist is true, we also include the actual seed tracks
			if (config_.includeSeedArtist && seeds.length > 0) {
				updateProgress(`Including seed tracks...`, 0.84);
				logger.debug('Seeds', `Including ${seeds.length} seed track(s) in results`);

				const seedTracksToAdd = [];
				const existingKeys = new Set();

				// Build a set of existing track keys for deduplication
				for (const track of dedupedResults) {
					const key = makeDupKey(track);
					if (key) existingKeys.add(key);
				}

				// Find seed tracks in library and add them if not already present
				for (const seed of seeds) {
					if (!seed.artist || !seed.title) continue;

					try {
						// Search for this specific track in the library
						const foundTracks = await db.findLibraryTracks(
							seed.artist,
							seed.title,
							1, // Only need one match
							{
								formatPreference: config_.formatPreference,
								minRating: 0, // Don't filter seed tracks by rating
								allowUnknown: true,
								collection: config_.localCollection || ''
							}
						);

						if (foundTracks && foundTracks.length > 0) {
							const foundTrack = foundTracks[0];
							const key = makeDupKey(foundTrack);

							// Only add if not already in results
							if (key && !existingKeys.has(key)) {
								existingKeys.add(key);
								seedTracksToAdd.push(foundTrack);
								logger.debug('Seeds', `Added seed track "${seed.artist} - ${seed.title}"`);
							}
						}
					} catch (e) {
						logger.warn('Seeds', `Could not find seed track "${seed.artist} - ${seed.title}": ${e.message}`);
					}
				}

				// Add seed tracks to results (will be shuffled together with other tracks if shuffle is enabled)
				if (seedTracksToAdd.length > 0) {
					logger.debug('Seeds', `Adding ${seedTracksToAdd.length} seed track(s) to results pool`);
					dedupedResults.push(...seedTracksToAdd);
					updateProgress(`Added ${seedTracksToAdd.length} seed track(s) to results`, 0.85);
				}
			}

			// Step 6: Apply randomization if enabled (after adding seed tracks)
			if (config_.randomize) {
				logger.debug('Shuffle', `Dispersing and randomizing ${dedupedResults.length} results to avoid artist clustering`);
				updateProgress(`Shuffling ${dedupedResults.length} tracks...`, 0.86);

				// Use enhanced shuffle that disperses tracks from the same artist/album
				// This creates better perceived randomness by interleaving artists
				const shuffled = shuffleWithDispersion(dedupedResults);
				dedupedResults.length = 0;
				dedupedResults.push(...shuffled);

				logger.debug('Shuffle', 'Shuffle complete - tracks dispersed across artists');
				updateProgress(`Shuffled ${dedupedResults.length} tracks`, 0.87);
			}

			// Apply final limit
			// For mood/activity modes, skip the limit — tracks already survived expensive
			// multi-step filtering (Last.fm similarity → library match → ReccoBeats audio
			// features → mood/activity template filtering). The settings govern processing
			// effort, but once a track passes all criteria it should be included.
			const isMoodActivity = discoveryMode === 'mood' || discoveryMode === 'activity';
			const finalResults = (!isMoodActivity && config_.totalLimit < 100000)
				? dedupedResults.slice(0, config_.totalLimit)
				: dedupedResults;

			if (finalResults.length < dedupedResults.length) {
				logger.info('Output', `Applied limit: ${dedupedResults.length} → ${finalResults.length} tracks`);
				updateProgress(`Applied limit: ${finalResults.length} of ${dedupedResults.length} tracks`, 0.88);
			}

			logger.info('Output', `Final track count: ${finalResults.length}`);

			// Step 6: Output results
			const enqueueEnabled = boolSetting('EnqueueMode', false);
			const outputMode = config_.autoMode || enqueueEnabled ? 'queue' : 'playlist';

			updateProgress(`Adding ${finalResults.length} track(s) to ${outputMode}...`, 0.9);
			logger.info('Output', `=== Phase 3: Output (${outputMode}) ===`);

			let output;
			let outputName = '';

			try {
				if (config_.autoMode || enqueueEnabled) {
					output = await this.queueResults(modules, finalResults, config_);
				} else {
					const formatActivityName = (val) => String(val || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
					const seedName = seeds.length > 0 ? this.buildPlaylistSeedName(seeds) : formatActivityName(config_.moodActivityValue) || 'Selection';
					const genreName = seeds.length > 0 && config_.discoveryMode === 'genre' ? this.buildPlaylistGenreName(seeds) : null;
					config_.seedName = seedName;
					config_.genreName = genreName;
					config_.modeName = modeName;
					output = await this.buildResultsPlaylist(modules, finalResults, config_);
					outputName = output?.playlist?.name || config_.seedName || '';
				}
			} catch (outputError) {
				logger.error('Output', 'Output error', outputError);
				terminateProgressTask(taskId);
				cache?.save?.();
				showToast(`Failed to create ${outputMode}: ${formatError(outputError)}`, { type: 'error', duration: 5000 });
				return { success: false, error: formatError(outputError), tracksAdded: 0 };
			}

			// Calculate elapsed time
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			const actualTracksAdded = output?.added ?? output?.trackCount ?? finalResults.length;

			updateProgress(`Complete! Added ${actualTracksAdded} track(s)`, 1.0);

			terminateProgressTask(taskId);
			cache?.save?.();

			// Build comprehensive stats for final summary
			const notInLibraryCount = matchStats?.notInLibrary || 0;
			const filteredByRatingCount = matchStats?.filteredByRating || 0;
			const apiFilteredCount = discoveryStats?.apiFilteredCount || 0;
			const missedCount = window.matchMonkeyMissedResults?.getCount?.() || 0;

			// Log human-readable final summary (always visible)
			const summaryParts = [`${actualTracksAdded} tracks added in ${elapsed}s`];
			summaryParts.push(`Mode: ${modeName}`);
			if (outputName) summaryParts.push(`${outputMode === 'queue' ? 'Queue' : 'Playlist'}: "${outputName}"`);
			const filterParts = [];
			if (notInLibraryCount > 0) filterParts.push(`${notInLibraryCount} not in library`);
			if (apiFilteredCount > 0) filterParts.push(`${apiFilteredCount} below API threshold`);
			if (filteredByRatingCount > 0) filterParts.push(`${filteredByRatingCount} below rating threshold`);
			if (dedupRemovedCount > 0) filterParts.push(`${dedupRemovedCount} duplicates removed`);
			if (missedCount > 0) filterParts.push(`${missedCount} missed results tracked`);
			if (filterParts.length > 0) summaryParts.push(`Skipped: ${filterParts.join(', ')}`);
			logger.info('Complete', summaryParts.join(' | '));

			// Build success message for toast
			let successMsg = `Successfully added ${actualTracksAdded} ${modeName} track(s) in ${elapsed}s`;
			const detailParts = [];
			if (notInLibraryCount > 0) {
				detailParts.push(`${notInLibraryCount} not in library`);
			}
			if (filteredByRatingCount > 0) {
				detailParts.push(`${filteredByRatingCount} below rating threshold`);
			}
			if (apiFilteredCount > 0) {
				detailParts.push(`${apiFilteredCount} below API threshold`);
			}
			if (detailParts.length > 0) {
				successMsg += ` (${detailParts.join(', ')})`;
			}

			// Show success toast with auto-dismiss
			showToast(successMsg, { type: 'success', duration: 4000 });

			return {
				success: true,
				tracksAdded: actualTracksAdded,
				playlist: output?.playlist || null,
				elapsed: parseFloat(elapsed),
			};

		} catch (e) {
			if (e?.message === '__CANCELLED__') {
				terminateProgressTask(taskId);
				cache?.save?.();
				logger.info('Workflow', 'Cancelled by user');
				showToast('Discovery cancelled.', { type: 'info', duration: 2000 });
				return { success: false, error: 'Cancelled', tracksAdded: 0 };
			}
			logger.error('Workflow', 'Unexpected error', e);
			terminateProgressTask(taskId);
			cache?.save?.();
			showToast(`Error: ${formatError(e)}`, { type: 'error', duration: 5000 });
			return { success: false, error: formatError(e), tracksAdded: 0 };
		}
	},

	/**
	 * Collect seed tracks from selection or currently playing.
	 * 
	 * @param {object} modules - Module dependencies
	 * @returns {Promise<Array>} Array of seed objects [{artist, title, genre, album}, ...]
	 */
	async collectSeedTracks(modules) {
		const seeds = [];

		try {
			// ---------------------------------------------------------
			// PRIORITY 1: SELECTED TRACKS
			// ---------------------------------------------------------
			// Try to get selected tracklist
			let selectedList = null;
			try {
				if (typeof uitools !== 'undefined' && uitools?.getSelectedTracklist) {
					selectedList = uitools.getSelectedTracklist();
				}
			} catch (e) {
				window.matchMonkeyLogger?.debug('Seeds', 'Could not get selected tracklist: ' + e.toString());
			}

			if (selectedList) {
				try {
					await selectedList.whenLoaded();

					if (typeof selectedList.locked === 'function') {

						selectedList.locked(() => {
							let track;
							const count = selectedList.count || 0;
							for (let i = 0; i < count; i++) {
								track = selectedList.getFastObject(i, track);
								seeds.push({
									artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
									title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
									album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
									genre: track.genre || '',
								});
							}
						});
					}
				} catch (e) {
					window.matchMonkeyLogger?.error('Seeds', 'Error iterating selection: ' + e.toString());
				}
			}

			// ---------------------------------------------------------
			// PRIORITY 2: CURRENTLY PLAYING TRACK
			// ---------------------------------------------------------
			if (seeds.length === 0) {
				try {
					let track = null;

					if (typeof app.player?.getCurrentTrack === 'function') {
						track = await app.player.getCurrentTrack();
					}

					if (track) {
						console.log(
							`Match Monkey: Using current track as seed: "${track.artist} - ${track.title}"`
						);

						seeds.push({
							artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
							title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
							album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
							genre: track.genre || '',
						});
					}
				} catch (e) {
					window.matchMonkeyLogger?.warn('Seeds', 'Failed to get current track: ' + e.message);
				}
			}

		} catch (e) {
			window.matchMonkeyLogger?.error('Seeds', 'Error collecting seeds', e);
		}

		// Final cleanup
		return seeds.filter(s => s.artist && s.artist.trim().length > 0);
	},

	/**
	 * Collect seed tracks from Now Playing queue for auto-mode.
	 * Uses the threshold setting to determine how many remaining tracks to use as seeds.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {number} threshold - Number of remaining tracks that trigger auto-mode
	 * @returns {Promise<Array>} Array of seed objects [{artist, title, genre, album}, ...]
	 */
	async collectAutoModeSeedsFromQueue(modules, threshold) {
		const seeds = [];

		const logger = window.matchMonkeyLogger;

		try {
			if (!app.player) {
				logger?.warn('AutoMode', 'Player not available');
				return seeds;
			}

			// Get Now Playing tracklist
			const tracklist = (typeof app.player.getTracklist === 'function')
				? app.player.getTracklist()
				: null;

			if (!tracklist) {
				logger?.warn('AutoMode', 'Now Playing tracklist not available');
				return seeds;
			}

			// Wait for tracklist to load
			if (typeof tracklist.whenLoaded === 'function') {
				await tracklist.whenLoaded();
			}

			// Get index of the currently playing track
			let currentIndex = -1;
			try {
				if (typeof app.player.getIndexOfPlayingTrack === 'function') {
					currentIndex = app.player.getIndexOfPlayingTrack(tracklist);
				}
			} catch (e) {
				logger?.warn('AutoMode', 'Could not get playing index: ' + e.message);
			}

			if (currentIndex == null || currentIndex < 0) {
				logger?.warn('AutoMode', 'Invalid playing index');
				return seeds;
			}

			const totalTracks = tracklist.count || 0;
			const seedCount = threshold;

			const startIndex = currentIndex;
			const endIndex = Math.min(startIndex + seedCount, totalTracks);

			logger?.debug('AutoMode', `Collecting seeds from Now Playing (playing=${currentIndex}, total=${totalTracks}, collecting ${endIndex - startIndex} tracks)`);

			// Extract tracks
			if (typeof tracklist.locked === 'function') {
				tracklist.locked(() => {
					let track;
					for (let i = startIndex; i < endIndex; i++) {
						track = tracklist.getFastObject(i, track);
						if (track) {
							seeds.push({
								artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
								title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
								album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
								genre: track.genre || '',
								path: track.path || '' // optional unique key
							});
						}
					}
				});
			}

			logger?.info('AutoMode', `Collected ${seeds.length} seeds from Now Playing queue`);

		} catch (e) {
			logger?.error('AutoMode', 'Error collecting seeds from queue', e);
		}

		return seeds.filter(s => s.artist && s.artist.trim().length > 0);
	},

	/**
	 * Match discovered candidates to local library tracks.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} candidates - Array of {artist, tracks[]} from discovery
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Object with {tracks: Array, stats: {matched, notInLibrary, filteredByThreshold}}
	 */
	async matchCandidatesToLibrary(modules, candidates, config) {
		const { db, ui: { notifications } } = modules;
		const { updateProgress, isCancelled } = notifications;
		const logger = window.matchMonkeyLogger;
		const results = [];
		const seenTrackIds = new Set();

		const totalCandidates = candidates.length;
		logger.info('Library', `Matching ${totalCandidates} candidates to library`);
		logger.debug('Library', `Rating filter - minRating=${config.minRating}, allowUnknown=${config.allowUnknown}`);

		// Log active API threshold settings for developer visibility
		if (config.apiMinMatch > 0) {
			logger.debug('Library', `API threshold - min match: ${config.apiMinMatch}% (applies to both Last.fm and ReccoBeats)`);
		}
		if (config.localCollection) {
			logger.warn('Library', `Collection filter: "${config.localCollection}" (NOTE: not yet implemented in MM5)`);
		}

		updateProgress(`Searching local library for ${totalCandidates} artists...`, 0.55);

		let artistsMatched = 0;
		let totalTracksMatched = 0;

		// Track missed results - separate counts for not-in-library vs filtered-by-rating
		const missedResults = [];
		let notInLibraryCount = 0;
		let filteredByRatingCount = 0;

		for (let i = 0; i < totalCandidates; i++) {
			if (isCancelled()) throw new Error('__CANCELLED__');
			const candidate = candidates[i];
			if (!candidate?.artist) continue;

			// Skip special filter candidates
			if (candidate.artist.startsWith('__')) continue;

			// Update progress periodically
			if (i % 5 === 0) {
				const progress = 0.55 + ((i / totalCandidates) * 0.25);
				updateProgress(`Library: Searching "${candidate.artist}" (${i + 1}/${totalCandidates})...`, progress);
			}

			try {
				let tracks = [];
				let searchedSpecificTracks = false; // Track if we searched for specific tracks

				// If candidate has specific tracks, search for those
				if (candidate.tracks && candidate.tracks.length > 0) {
					const titles = candidate.tracks.map(t =>
						typeof t === 'string' ? t : (t.title || '')
					).filter(Boolean);

					if (titles.length > 0) {
						searchedSpecificTracks = true; // Mark that we searched for specific tracks

						// OPTIMIZATION: Do a single query without rating filter to get ALL tracks
						// Then filter by rating in-memory. This avoids duplicate SQL queries.
						const allTracksMap = await db.findLibraryTracksBatch(
							candidate.artist,
							titles,
							config.tracksPerArtist,
							{
								formatPreference: config.formatPreference,
								minRating: 0, // Get all tracks regardless of rating
								allowUnknown: true,
								collection: config.localCollection || ''
							}
						);

						// Helper: determine audio quality priority (higher = better)
						const getFormatPriority = (track) => {
							if (!track) return 0;
							const ext = (track.fileExtension || track.FileExtension || '').toLowerCase().replace('.', '');
							const type = (track.fileType || track.FileType || '').toLowerCase();
							if (ext === 'flac' || type === 'flac') return 100;
							if (ext === 'ape' || type === 'ape') return 95;
							if (ext === 'wav' || type === 'wav') return 90;
							if (ext === 'alac' || ext === 'm4a' || type === 'alac') return 85;
							if (ext === 'wv' || type === 'wavpack') return 80;
							if (ext === 'mp3' || type === 'mp3') {
								const bitrate = track.bitrate || track.Bitrate || 0;
								if (bitrate >= 320) return 70;
								if (bitrate >= 256) return 65;
								if (bitrate >= 192) return 60;
								return 50;
							}
							if (ext === 'ogg' || type === 'ogg') return 55;
							if (ext === 'aac' || type === 'aac') return 52;
							if (ext === 'wma' || type === 'wma') return 45;
							return 0;
						};

						// Helper: decide whether the track group should be included
						// based on the BEST rating across all versions of the same track.
						// Rules:
						//  1. If ANY version is rated >= minRating -> include (pick best quality later)
						//  2. If versions exist but ALL rated below minRating -> exclude
						//  3. If ALL versions are unrated -> respect allowUnknown setting
						const shouldIncludeTrackGroup = (groupTracks) => {
							if (config.minRating <= 0) return true; // No rating filter active

							let hasRated = false;
							let bestRating = -1;

							for (const t of groupTracks) {
								const r = t.rating ?? t.Rating ?? -1;
								if (r >= 0) {
									hasRated = true;
									if (r > bestRating) bestRating = r;
								}
							}

							if (!hasRated) {
								// All versions are unrated – defer to allowUnknown
								return config.allowUnknown;
							}

							// At least one version is rated – include if best meets threshold
							return bestRating >= config.minRating;
						};

						// Process each title and separate into matched vs filtered
						for (const [title, allTracks] of allTracksMap.entries()) {
							if (allTracks.length > 0) {
								if (shouldIncludeTrackGroup(allTracks)) {
									// Pick the highest-quality version regardless of its individual rating.
									// When two tracks share the same format priority bucket (e.g. both
									// 192-255 kbps MP3 = priority 60), use actual bitrate as tiebreaker
									// so the higher-bitrate version always wins.
									const bestTrack = allTracks.reduce((best, cur) => {
										const curPri = getFormatPriority(cur);
										const bestPri = getFormatPriority(best);
										if (curPri !== bestPri) return curPri > bestPri ? cur : best;
										// Same format priority – prefer the higher actual bitrate
										return (cur.bitrate || cur.Bitrate || 0) > (best.bitrate || best.Bitrate || 0) ? cur : best;
									});
									tracks.push(bestTrack);

									// Log matched track with its API popularity/match value
									const originalTrack = candidate.tracks.find(t => {
										const trackTitle = typeof t === 'string' ? t : (t.title || '');
										return trackTitle === title;
									});
									let matchVal = 0;
									if (typeof originalTrack === 'object') {
										matchVal = originalTrack.match || originalTrack.popularity || 0;
									}
									if (matchVal === 0 && candidate.matchScore) {
										matchVal = candidate.matchScore;
									}
									const matchValNorm = matchVal <= 1 ? (matchVal * 100).toFixed(1) : Number(matchVal).toFixed(1);
									//console.log(`Match Monkey: MATCHED in library - "${candidate.artist} - ${title}" (API score: ${matchValNorm}%)`);
								} else {
									filteredByRatingCount++;
									//console.log(`Match Monkey: FILTERED BY RATING - "${candidate.artist} - ${title}" exists but below minRating ${config.minRating}`);
								}
							} else {
								// Find the original track data to get popularity
								const originalTrack = candidate.tracks.find(t => {
									const trackTitle = typeof t === 'string' ? t : (t.title || '');
									return trackTitle === title;
								});

								// Extract and normalize popularity from track data
								const { popularity, rawPlaycount } = this.normalizePopularityFromTrack(originalTrack);

								// Determine source for logging
								const source = config.discoveryMode === 'acoustics' ||
									config.discoveryMode === 'mood' ||
									config.discoveryMode === 'activity' ? 'ReccoBeats' : 'Last.fm';

								// Get match/popularity value for logging
								// Try track-level match/popularity first, then fall back to candidate-level matchScore
								let matchVal = 0;
								if (typeof originalTrack === 'object') {
									matchVal = originalTrack.popularity || originalTrack.match || 0;
								}
								// If no track-level score, use candidate's artist similarity score
								if (matchVal === 0 && candidate.matchScore) {
									matchVal = candidate.matchScore;
								}
								const matchValDisplay = matchVal <= 1 ? (matchVal * 100).toFixed(1) : Number(matchVal).toFixed(1);

								// Log ALL missed tracks - show source and API value
								//console.log(`Match Monkey: NOT IN LIBRARY - "${candidate.artist} - ${title}" [${source} score: ${matchValDisplay}%, playcount: ${rawPlaycount}]`);
								notInLibraryCount++;

								// Track as missed result with normalized popularity
								// Use matchVal (which may come from candidate.matchScore) for missed tracking
								const normalizedMatchForStorage = matchVal <= 1 ? matchVal * 100 : matchVal;

								// Sanitize all numeric values for JSON serialization
								const safeNumber = (val) => {
									const num = Number(val);
									return (Number.isFinite(num) ? num : 0);
								};

								missedResults.push({
									artist: String(candidate.artist || ''),
									title: String(title || ''),
									popularity: safeNumber(popularity || normalizedMatchForStorage),
									additionalInfo: {
										source: String(source || 'Last.fm'),
										discoveryMode: String(config.discoveryMode || ''),
										playcount: safeNumber(typeof originalTrack === 'object' ? (originalTrack.playcount || 0) : 0),
										rank: safeNumber(typeof originalTrack === 'object' ? (originalTrack.rank || 0) : 0),
										match: safeNumber(normalizedMatchForStorage),
										reason: 'not_in_library'
									}
								});
							}
						}
					}
				}

				// Fallback: search by artist only
				if (tracks.length === 0) {
					tracks = await db.findLibraryTracks(
						candidate.artist,
						null,
						config.tracksPerArtist,
						{
							formatPreference: config.formatPreference,
							minRating: config.minRating,
							allowUnknown: config.allowUnknown,
							collection: config.localCollection || ''
						}
					);

					// If no tracks found for artist at all, track the artist's top tracks as missed
					// BUT only if we didn't already search for specific tracks (to avoid double-tracking)
					if (tracks.length === 0 && !searchedSpecificTracks && candidate.tracks && candidate.tracks.length > 0) {
						// Determine source for logging
						const source = config.discoveryMode === 'acoustics' ||
							config.discoveryMode === 'mood' ||
							config.discoveryMode === 'activity' ? 'ReccoBeats' : 'Last.fm';

						// Track up to 3 tracks from this artist as missed (without individual logging)
						candidate.tracks.slice(0, 3).forEach(t => {
							const trackTitle = typeof t === 'string' ? t : (t.title || '');
							if (!trackTitle) return;

							// Extract and normalize popularity
							const { popularity, rawPlaycount } = this.normalizePopularityFromTrack(t);

							// Get match/popularity value
							// Try track-level match/popularity first, then fall back to candidate-level matchScore
							let matchVal = typeof t === 'object' ? (t.popularity || t.match || 0) : 0;
							// If no track-level score, use candidate's artist similarity score
							if (matchVal === 0 && candidate.matchScore) {
								matchVal = candidate.matchScore;
							}

							// Track missed count
							notInLibraryCount++;

							// Use matchVal (which may come from candidate.matchScore) for missed tracking
							const normalizedMatchForStorage = matchVal <= 1 ? matchVal * 100 : matchVal;

							// Sanitize all numeric values for JSON serialization
							const safeNumber = (val) => {
								const num = Number(val);
								return (Number.isFinite(num) ? num : 0);
							};

							missedResults.push({
								artist: String(candidate.artist || ''),
								title: String(trackTitle || ''),
								popularity: safeNumber(popularity || normalizedMatchForStorage),
								additionalInfo: {
									source: String(source || 'Last.fm'),
									discoveryMode: String(config.discoveryMode || ''),
									playcount: safeNumber(typeof t === 'object' ? (t.playcount || 0) : 0),
									rank: safeNumber(typeof t === 'object' ? (t.rank || 0) : 0),
									match: safeNumber(normalizedMatchForStorage),
									reason: 'not_in_library'
								}
							});
						});
					}
				}

				// Add unique tracks to results
				let matchedForArtist = 0;
				for (const track of tracks) {
					const trackId = track.id || track.ID || track.path;
					if (trackId && !seenTrackIds.has(trackId)) {
						seenTrackIds.add(trackId);
						results.push(track);
						matchedForArtist++;
					}
				}

				if (matchedForArtist > 0) {
					artistsMatched++;
					totalTracksMatched += matchedForArtist;
				}

			} catch (e) {
				logger.warn('Library', `Error matching "${candidate.artist}": ${e.message}`);
			}
		}

		// Batch add missed results - they already have normalized popularity
		if (missedResults.length > 0 && window.matchMonkeyMissedResults?.addBatch) {
			// Filter missed results by configured API match threshold (applies to both sources)
			const apiMinMatch = config.apiMinMatch;
			const filteredMissedResults = missedResults.filter(r => {
				try {
					const src = r.additionalInfo?.source || 'Last.fm';
					if (src === 'ReccoBeats') {
						// ReccoBeats popularity is 0-100, same scale as apiMinMatch
						return (r.popularity || 0) >= apiMinMatch;
					} else {
						// Prefer explicit match field when available (Last.fm match already normalized to 0-100)
						const m = Number(r.additionalInfo?.match || 0);
						// Normalize if still in 0-1 range
						const matchNormalized = m <= 1 ? m * 100 : m;
						if (matchNormalized > 0) return matchNormalized >= apiMinMatch;
						// Fallback to popularity if no match value
						return (r.popularity || 0) >= apiMinMatch;
					}
				} catch (e) { return false; }
			});

			if (filteredMissedResults.length > 0) {
				logger.debug('Library', `Adding ${filteredMissedResults.length} missed recommendations to tracker (filtered from ${missedResults.length})`);
				window.matchMonkeyMissedResults.addBatch(filteredMissedResults);
			} else {
				logger.debug('Library', `No missed recommendations passed configured thresholds (${missedResults.length} filtered out)`);
			}
		}

		// Log summary stats
		logger.summary('Library', 'Matching complete', {
			matched: totalTracksMatched,
			notInLibrary: notInLibraryCount,
			filteredByRating: filteredByRatingCount,
			artists: `${artistsMatched}/${totalCandidates}`
		});
		updateProgress(`Library: Found ${totalTracksMatched} tracks from ${artistsMatched}/${totalCandidates} artists`, 0.8);

		// Return tracks and stats for user feedback
		return {
			tracks: results,
			stats: {
				matched: totalTracksMatched,
				notInLibrary: notInLibraryCount,
				filteredByRating: filteredByRatingCount,
				artistsMatched: artistsMatched,
				totalCandidates: totalCandidates
			}
		};
	},

	/**
	 * Match mood/activity filter to library tracks.
	 * Searches entire library and filters based on audio characteristics.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {object} filterCandidate - Filter candidate with audioTargets
	 * @param {object} config - Configuration settings
	 * @returns {Promise<Array>} Array of matching library track objects
	 */
	async matchMoodActivityToLibrary(modules, filterCandidate, config) {
		const { db, ui: { notifications } } = modules;
		const { updateProgress } = notifications;

		const audioTargets = filterCandidate.audioTargets || {};
		const moodOrActivity = filterCandidate.mood || filterCandidate.activity || 'unknown';

		console.log(`Match Monkey: Searching library for ${moodOrActivity} tracks with targets:`, audioTargets);
		updateProgress(`Searching library for ${moodOrActivity} tracks...`, 0.5);

		// For mood/activity mode, we search the entire library with rating filters
		// and then shuffle to get variety
		try {
			// Search library for tracks (broad search)
			const allTracks = await db.findLibraryTracks(
				null, // No specific artist
				null, // No specific titles
				config.totalLimit, // Get plenty of tracks
				{
					formatPreference: config.formatPreference,
					minRating: config.minRating,
					allowUnknown: config.allowUnknown,
				}
			);

			window.matchMonkeyLogger?.info('Library', `Found ${allTracks.length} tracks in library for ${moodOrActivity} filtering`);

			// For now, return all tracks - in future we could filter by audio characteristics
			// if the user has audio features stored in their library
			return allTracks;

		} catch (e) {
			window.matchMonkeyLogger?.error('Library', `Error searching library for ${moodOrActivity}`, e);
			return [];
		}
	},

	/**
	 * Queue results to Now Playing.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Track objects to queue
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Result with count added
	 */
	async queueResults(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { boolSetting } = storage;
		const { updateProgress } = notifications;

		const clearFirst = boolSetting('ClearQueueFirst', false);
		const skipDuplicates = boolSetting('SkipDuplicates', true);

		let added = 0;

		try {
			const np = app.player.getTracklist();
			if (!np) return { added: 0 };

			// Wait for load
			if (typeof np.whenLoaded === 'function') {
				await np.whenLoaded();
			}

			// Clear queue if requested
			if (clearFirst && np && typeof np.clear === 'function') {
				updateProgress('Clearing Now Playing queue...', 0.91);
				np.clear();
			}

			// Helper: build normalized dedupe key from artist + title
			const makeDupKey = (t) => {
				if (!t) return '';
				const artistRaw = t.artist || t.Artist || '';
				const titleRaw = t.title || t.SongTitle || t.Title || '';
				// Use existing helpers to normalize names consistently with rest of code
				const artist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
					? matchMonkeyHelpers.cleanArtistName(artistRaw)
					: String(artistRaw || '').trim();
				const title = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
					? matchMonkeyHelpers.cleanTrackName(titleRaw)
					: String(titleRaw || '').trim();

				// Uppercase to make comparison case-insensitive
				return `${artist.toUpperCase()}||${title.toUpperCase()}`;
			};

			// Build set of existing artist+title keys for duplicate detection
			const existing = new Set();
			let existingCount = 0;

			if (skipDuplicates && np && typeof np.locked === 'function') {
				np.locked(() => {
					let t;
					for (let i = 0; i < np.count; i++) {
						t = np.getFastObject(i, t);
						if (t) {
							const dup = makeDupKey(t);
							if (dup) existing.add(dup);
						}
					}
					existingCount = np.count;
				});

				if (existingCount > 0) {
					updateProgress(`Checking ${tracks.length} tracks against ${existingCount} in queue...`, 0.92);
				}
			}

			let skippedDuplicates = 0;

			// Add tracks to Now Playing
			updateProgress(`Adding ${tracks.length} tracks to Now Playing...`, 0.93);

			for (const track of tracks) {
				const dupKey = makeDupKey(track);

				if (skipDuplicates && dupKey && existing.has(dupKey)) {
					skippedDuplicates++;
					continue;
				}

				try {
					await db.queueTrack(track);
					added++;
					if (dupKey) existing.add(dupKey);
				} catch (e) {
					window.matchMonkeyLogger?.warn('Queue', `Failed to queue track: ${e?.message || e}`);
				}
			}

			if (skippedDuplicates > 0) {
				window.matchMonkeyLogger?.info('Queue', `Skipped ${skippedDuplicates} duplicates already in queue`);
				updateProgress(`Queued ${added} tracks (skipped ${skippedDuplicates} duplicates)`, 0.98);
			} else {
				updateProgress(`Queued ${added} tracks to Now Playing`, 0.98);
			}

			window.matchMonkeyLogger?.info('Queue', `Queued ${added} tracks to Now Playing`);

		} catch (e) {
			window.matchMonkeyLogger?.error('Queue', 'Error queuing results', e);
		}

		return { added };
	},

	/**
	 * Build a playlist from results.
	 * 
	 * Playlist Naming Convention:
	 * ---------------------------
	 * Default behavior is template-based: the PlaylistName setting is treated as a
	 * name template. init.js now seeds this setting with a non-empty default:
	 * 
	 *   "Similar %action% (%seed%)"
	 * 
	 * This template is then resolved based on the discovery mode and seed summary.
	 * For example, with the default template:
	 * 
	 * - Artist Mode:    "Similar Artists (The Beatles, Pink Floyd, Muse)"
	 * - Track Mode:     "Similar Tracks (The Beatles, Metallica...)"
	 * - Genre Mode:     "Similar Genres (Rock, Blues, Jazz)"
	 * - Acoustics Mode: "Similar Acoustics (Artist Name)"
	 * - Mood Mode:      "Similar Energetic (Artist Name)"
	 * - Activity Mode:  "Similar Workout (Artist Name)"
	 * 
	 * Auto-generation without a template only occurs when the user explicitly
	 * clears the PlaylistName setting to a blank string (''). In that case, the
	 * playlist name is derived purely from discovery mode and seeds.
	 * 
	 * PlaylistName Template Support:
	 * ------------------------------
	 * Users can customize naming by setting a PlaylistName template:
	 * 
	 * Placeholders:
	 * - %action% = Discovery type (Artists, Tracks, Genres, Acoustics, mood name, activity name)
	 * - %seed%   = Seed summary (artist names, genre names, or selection)
	 * - %        = Legacy placeholder (same as %seed% for backward compatibility)
	 * 
	 * - Examples:
	 *   * "Similar %action% (%seed%)"    ? "Similar Artists (The Beatles, Pink Floyd)"
	 *   * "My %action% Mix - %seed%"     ? "My Artists Mix - The Beatles, Pink Floyd"
	 *   * "%seed% Radio"                 ? "The Beatles, Pink Floyd Radio"
	 *   * "Daily %action%"               ? "Daily Artists"
	 *   * "%"                            ? "The Beatles, Pink Floyd" (legacy)
	 * 
	 * Seed Name Format:
	 * -----------------
	 * - Shows up to 3 items with ellipsis (...) for more
	 * - Artist seeds: "Artist1, Artist2, Artist3..." (from buildPlaylistSeedName)
	 * - Genre seeds:  "Genre1, Genre2, Genre3..." (from buildPlaylistGenreName)
	 * - Mood/Activity: Uses the mood/activity value (e.g., "Energetic", "Workout")
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Track objects for playlist
	 * @param {object} config - Configuration settings
	 * @param {string} config.discoveryMode - Discovery mode ('artist', 'track', 'genre', 'acoustics', 'mood', 'activity')
	 * @param {string} config.seedName - Formatted seed names (artists or "Selection")
	 * @param {string} config.genreName - Formatted genre names (for genre mode only)
	 * @param {string} config.moodActivityValue - Mood/activity value if applicable
	 * @returns {Promise<object>} Result with playlist reference
	 */
	//*
	async buildResultsPlaylist(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting } = storage;
		const { showToast, updateProgress } = notifications;

		const playlistTemplate = stringSetting('PlaylistName', '');
		const parentName = stringSetting('ParentPlaylist', '');
		const playlistMode = stringSetting('PlaylistMode', 'Create new playlist');
		const navigateAfter = stringSetting('NavigateAfter', 'Navigate to new playlist');

		const modeName = config.modeName || 'Similar Artists';
		const seedName = config.seedName || 'Selection';
		const genreName = config.genreName || null;

		// Build playlist name based on discovery mode (or use custom template if provided)
		let playlistName;

		// Use custom template if provided by user
		if (playlistTemplate && playlistTemplate.trim()) {
			// Determine %action% based on discovery mode
			let actionText = 'Artists'; // Default

			if (config.moodActivityValue && (config.discoveryMode === 'mood' || config.discoveryMode === 'activity')) {
				// Mood/Activity: Use the formatted mood/activity value (underscores → spaces, title-case)
				actionText = String(config.moodActivityValue).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
			} else if (config.discoveryMode === 'genre') {
				actionText = 'Genres';
			} else if (config.discoveryMode === 'track') {
				actionText = 'Tracks';
			} else if (config.discoveryMode === 'acoustics') {
				actionText = 'Acoustics';
			} else {
				// Artist mode (default)
				actionText = 'Artists';
			}

			// Determine %seed% based on discovery mode
			const seedText = (config.discoveryMode === 'genre' && genreName) ? genreName : seedName;

			// Check if template contains any supported placeholders
			const hasPlaceholders = /%action%|%seed%|%/.test(playlistTemplate);

			// Replace placeholders
			playlistName = playlistTemplate
				.replace(/%action%/g, actionText)
				.replace(/%seed%/g, seedText)
				.replace(/%/g, seedText); // Legacy % placeholder for backward compatibility

			// Fallback: if no placeholders were used, append the seed text to avoid duplicate/static names
			if (!hasPlaceholders && seedText) {
				playlistName = `${playlistName} ${seedText}`;
			}

		} else {
			// Auto-generate name based on discovery mode (when template is empty)
			if (config.moodActivityValue && (config.discoveryMode === 'mood' || config.discoveryMode === 'activity')) {
				// Mood/Activity: "Similar %mood/activity% (%artist%)"
				const capitalizedValue = String(config.moodActivityValue).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
				playlistName = `Similar ${capitalizedValue} (${seedName})`;
			} else if (config.discoveryMode === 'genre') {
				// Genre: "Similar Genres (%genre%)"
				const summary = genreName || seedName;
				playlistName = `Similar Genres (${summary})`;
			} else if (config.discoveryMode === 'track') {
				// Track: "Similar Tracks (%artist%)"
				playlistName = `Similar Tracks (${seedName})`;
			} else if (config.discoveryMode === 'acoustics') {
				// Acoustics: "Similar Acoustics (%artist%)"
				playlistName = `Similar Acoustics (${seedName})`;
			} else {
				// Artist (default): "Similar Artists (%artist%)"
				playlistName = `Similar Artists (${seedName})`;
			}
		}

		// Append audio format preference indicator (only for non-mixed modes)
		if (config.formatPreference && config.formatPreference !== 'Mixed (all formats)') {
			if (config.formatPreference === 'Lossless only') {
				playlistName = `${playlistName} [Lossless]`;
			} else if (config.formatPreference === 'Lossy only') {
				playlistName = `${playlistName} [Lossy]`;
			}
		}

		// Truncate if too long
		if (playlistName.length > 100) {
			playlistName = playlistName.substring(0, 97) + '...';
		}

		console.log(`Match Monkey: Building playlist "${playlistName}" (mode: ${playlistMode})`);
		updateProgress(`Creating playlist "${playlistName}"...`, 0.92);

		// Handle "Do not create playlist" mode
		if (playlistMode === 'Do not create playlist') {
			showToast(`Found ${tracks.length} tracks (playlist creation disabled)`, 'info');
			return { added: 0, playlist: null };
		}

		let userSelectedPlaylist = null;

		// Show confirmation dialog if enabled
		if (config.showConfirm) {
			console.log('Match Monkey: Showing playlist selection dialog');
			updateProgress('Waiting for playlist selection...', 0.93);
			try {
				const dialogResult = await this.showPlaylistDialog();

				if (dialogResult === null) {
					console.log('Match Monkey: UserCancelled playlist dialog');
					return { added: 0, playlist: null, cancelled: true };
				}

				if (dialogResult && !dialogResult.autoCreate) {
					userSelectedPlaylist = dialogResult;
				}
			} catch (dialogError) {
				console.error('Match Monkey: Dialog error:', dialogError);
			}
		}

		try {
			// Resolve target playlist
			updateProgress(`Resolving playlist "${playlistName}"...`, 0.94);
			const resolution = await db.resolveTargetPlaylist(
				playlistName,
				parentName,
				playlistMode,
				userSelectedPlaylist
			);

			const targetPlaylist = resolution.playlist;
			const shouldClear = resolution.shouldClear;

			if (!targetPlaylist) {
				throw new Error('Failed to create or find target playlist');
			}

			console.log(`Match Monkey: Using playlist "${targetPlaylist.name}" (clear: ${shouldClear})`);

			// Clear existing tracks if needed
			if (shouldClear) {
				console.log('Match Monkey: Clearing existing tracks');
				updateProgress(`Clearing existing tracks from "${targetPlaylist.name}"...`, 0.95);
				await db.clearPlaylistTracks(targetPlaylist);
			}

			// Add tracks to playlist
			updateProgress(`Adding ${tracks.length} tracks to "${targetPlaylist.name}"...`, 0.96);
			const addedCount = await db.addTracksToPlaylist(targetPlaylist, tracks);

			if (addedCount === 0) {
				console.warn('Match Monkey: No tracks were added to playlist');
				showToast(`Warning: No tracks could be added to playlist`, 'warning');
			} else {
				updateProgress(`Added ${addedCount} tracks to "${targetPlaylist.name}"`, 0.98);
			}

			// Navigate based on user settings
			this.navigateAfterCreation(navigateAfter, targetPlaylist);

			console.log(`Match Monkey: Playlist "${targetPlaylist.name}" complete with ${addedCount} tracks`);

			return { added: addedCount, playlist: targetPlaylist };

		} catch (e) {
			console.error('Match Monkey: Error creating playlist:', e);
			showToast(`Failed to create playlist: ${e.message}`, 'error');
			return { added: 0, playlist: null };
		}
	},

	/**
	 * Show the playlist selection dialog.
	 */
	async showPlaylistDialog() {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools.openDialog) {
					console.log('Match Monkey: uitools.openDialog not available');
					resolve({ autoCreate: true });
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					showNewPlaylist: false
				});

				if (!dlg) {
					console.log('Match Monkey: Dialog failed to open');
					resolve({ autoCreate: true });
					return;
				}

				const handleClose = () => {
					if (dlg.modalResult !== 1) {
						resolve(null);
						return;
					}

					const selectedPlaylist = dlg.getValue?.('getPlaylist')?.();
					if (selectedPlaylist) {
						resolve(selectedPlaylist);
					} else {
						resolve({ autoCreate: true });
					}
				};

				app.listen(dlg, 'closed', handleClose);

			} catch (e) {
				console.error('showPlaylistDialog error:', e);
				resolve({ autoCreate: true });
			}
		});
	},

	/**
	 * Navigate to playlist or now playing based on user settings.
	 */
	navigateAfterCreation(navigateAfter, playlist) {
		try {
			if (navigateAfter === 'Navigate to new playlist' && playlist) {
				if (typeof navigationHandlers !== 'undefined' && navigationHandlers['playlist']?.navigate) {
					navigationHandlers['playlist'].navigate(playlist);
					console.log('Match Monkey: Navigated to playlist');
				}
			} else if (navigateAfter === 'Navigate to now playing') {
				if (typeof navigationHandlers !== 'undefined' && navigationHandlers['nowPlaying']?.navigate) {
					navigationHandlers['nowPlaying'].navigate();
					console.log('Match Monkey: Navigated to Now Playing');
				}
			}
		} catch (navError) {
			console.warn('Match Monkey: Navigation error (non-fatal):', navError);
		}
	},

	/**
	 * Build a display name from seed tracks for playlist naming.
	 * Extracts unique artists from seed tracks and formats them nicely.
	 * 
	 * Format:
	 * - 1 artist:   "The Beatles"
	 * - 2 artists:  "The Beatles, Pink Floyd"
	 * - 3 artists:  "The Beatles, Pink Floyd, Muse"
	 * - 4+ artists: "The Beatles, Pink Floyd, Muse..."
	 * 
	 * Used in playlist names like:
	 * - "Similar Artists (The Beatles, Pink Floyd, Muse)"
	 * - "Similar Tracks (The Beatles, Metallica...)"
	 * - "Similar Energetic (The Beatles)"
	 * 
	 * @param {Array} seeds - Seed objects [{artist, title, genre, album}, ...]
	 * @returns {string} Display name for playlist (comma-separated artists or "Selection")
	 */
	buildPlaylistSeedName(seeds) {
		if (!seeds || seeds.length === 0) return 'Selection';

		const artists = new Set();
		for (const seed of seeds) {
			if (seed.artist) {
				const parts = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
				for (const part of parts) {
					artists.add(part);
				}
			}
		}

		const artistList = Array.from(artists);

		if (artistList.length === 0) return 'Selection';
		if (artistList.length === 1) return artistList[0];
		if (artistList.length === 2) return `${artistList[0]}, ${artistList[1]}`;
		if (artistList.length === 3) return `${artistList[0]}, ${artistList[1]}, ${artistList[2]}`;
		return `${artistList[0]}, ${artistList[1]}, ${artistList[2]}...`;
	},

	/**
	 * Build a genre name summary from seed tracks for playlist naming.
	 * Extracts unique genres from seed tracks and formats them nicely.
	 * 
	 * Format:
	 * - 1 genre:   "Rock"
	 * - 2 genres:  "Rock, Blues"
	 * - 3 genres:  "Rock, Blues, Jazz"
	 * - 4+ genres: "Rock, Blues, Jazz..."
	 * 
	 * Used in genre discovery playlist names like:
	 * - "Similar Genres (Rock, Blues, Jazz)"
	 * - "Similar Genres (Hip-Hop, Rap...)"
	 * 
	 * Note: Prefers using extractGenresFromSeeds() from discoveryStrategies module
	 * for consistency with genre discovery logic, falls back to inline extraction.
	 * 
	 * @param {Array} seeds - Seed objects [{artist, title, genre, album}, ...]
	 * @returns {string} Display name for playlist (comma-separated genres or "Selection")
	 */
	buildPlaylistGenreName(seeds) {
		if (!seeds || seeds.length === 0) return 'Selection';

		let genreList = [];

		// Prefer shared genre-extraction logic from discoveryStrategies to keep behaviour consistent.
		if (typeof window !== 'undefined'
			&& window.matchMonkeyDiscoveryStrategies
			&& typeof window.matchMonkeyDiscoveryStrategies.extractGenresFromSeeds === 'function') {
			const extracted = window.matchMonkeyDiscoveryStrategies.extractGenresFromSeeds(seeds);
			if (Array.isArray(extracted)) {
				genreList = extracted;
			}
		}

		// Fallback to existing inline extraction logic if the shared helper is unavailable
		// or did not return an array, preserving current behaviour.
		if (!Array.isArray(genreList) || genreList.length === 0) {
			const genres = new Set();
			for (const seed of seeds) {
				if (seed && seed.genre) {
					const parts = String(seed.genre)
						.split(';')
						.map(g => g.trim())
						.filter(Boolean);
					for (const part of parts) {
						genres.add(part);
					}
				}
			}
			genreList = Array.from(genres);
		}

		if (genreList.length === 0) return 'Selection';
		if (genreList.length === 1) return genreList[0];
		if (genreList.length === 2) return `${genreList[0]}, ${genreList[1]}`;
		if (genreList.length === 3) return `${genreList[0]}, ${genreList[1]}, ${genreList[2]}`;
		return `${genreList[0]}, ${genreList[1]}, ${genreList[2]}...`;
	},
};
