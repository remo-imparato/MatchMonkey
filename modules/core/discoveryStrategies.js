/**
 * Discovery Strategies Module
 * 
 * Implements different discovery algorithms for finding similar music:
 * - Artist-based: Use Last.fm artist.getSimilar API
 * - Track-based: Use Last.fm track.getSimilar API  
 * - Genre-based: Use Last.fm tag.getTopArtists API
 * 
 * Each strategy returns a list of artist/track candidates to search in the local library.
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

/**
 * Discovery mode constants
 */
const DISCOVERY_MODES = {
	ARTIST: 'artist',
	TRACK: 'track',
	GENRE: 'genre',
	MOOD: 'mood',
	ACTIVITY: 'activity'
};

/**
 * Artist-based discovery strategy.
 * 
 * Uses Last.fm artist.getSimilar to find similar artists, then gets their top tracks.
 * For tracks with multiple artists (separated by ';'), makes separate API calls for each.
 * This is the original/classic approach.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByArtist(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarArtists, fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	// Limit number of seeds to process
	const seedLimit = Math.min(seeds.length, config.seedLimit || 20);

	// Collect all unique artists from seeds (splitting by ';')
	const uniqueArtists = new Set();
	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (seed.artist) {
			const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
			for (const artist of artists) {
				uniqueArtists.add(artist);
			}
		}
	}

	const artistList = Array.from(uniqueArtists);
	const artistLimit = Math.min(artistList.length, config.seedLimit || 20);

	console.log(`discoverByArtist: Processing ${artistLimit} seed artists, fetching up to ${config.similarLimit} similar each`);

	for (let i = 0; i < artistLimit; i++) {
		const artistName = artistList[i];
		const progress = (i + 1) / artistLimit;
		updateProgress(`Finding similar artists to "${artistName}"...`, progress * 0.3);

		try {
			// Fetch similar artists from Last.fm
			const fixedName = fixPrefixes(artistName);
			const similar = await fetchSimilarArtists(
				fixedName,
				config.similarLimit || 20
			);

			if (!similar || similar.length === 0) {
				console.log(`discoverByArtist: No similar artists found for "${artistName}"`);
				continue;
			}

			// Optionally include seed artist
			console.log(`discoverByArtist: Include seed artist = ${config.includeSeedArtist}`);
			if (config.includeSeedArtist) {
				addArtistCandidate(artistName, seenArtists, blacklist, candidates);
			}

			// Add similar artists (respect similarLimit)
			const limitedSimilar = similar.slice(0, config.similarLimit || 20);
			for (const artist of limitedSimilar) {
				if (artist?.name) {
					addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
				}
			}

		} catch (e) {
			console.error(`discoverByArtist: Error processing seed "${artistName}": ${e.toString()}`);
		}
	}

	console.log(`discoverByArtist: Found ${candidates.length} candidate artists`);

	// Fetch top tracks for each candidate artist
	if (candidates.length > 0) {
		updateProgress('Fetching top tracks for similar artists...', 0.4);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

/**
 * Track-based discovery strategy.
 * 
 * Uses Last.fm track.getSimilar to find musically similar tracks across different artists.
 * This can discover music from artists you might not have found via artist.getSimilar.
 * For tracks with multiple artists (separated by ';'), makes separate API calls for each.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>}
 */
async function discoverByTrack(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();
	const tracksByArtist = new Map(); // artist -> {artistName, tracks[]}

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	// Limit seeds for track-based discovery (more API-intensive)
	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);

	// Use the user's configured track similar limit from settings
	// This allows users to configure how many similar tracks to fetch per seed
	const trackSimilarLimit = config.trackSimilarLimit || config.TrackSimilarLimit || 100;

	// If includeSeedArtist is enabled, add seed artists first
	console.log(`discoverByTrack: Include seed artist = ${config.includeSeedArtist}`);
	if (config.includeSeedArtist) {
		for (let i = 0; i < seedLimit; i++) {
			const seed = seeds[i];
			if (!seed.artist || !seed.title) continue;

			const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

			for (const artistName of artists) {
				const artKey = artistName.toUpperCase();
				if (blacklist.has(artKey)) continue;
				if (seenArtists.has(artKey)) continue;

				seenArtists.add(artKey);

				// Add seed track for this seed artist
				if (!tracksByArtist.has(artKey)) {
					tracksByArtist.set(artKey, {
						artistName: artistName,
						tracks: []
					});
				}

				const entry = tracksByArtist.get(artKey);
				const trackKey = seed.title.toUpperCase();
				const exists = entry.tracks.some(t => t.title.toUpperCase() === trackKey);
				if (!exists) {
					entry.tracks.push({
						title: seed.title,
						match: 1.0, // Seed tracks get perfect match score
						playcount: 0
					});
				}
			}
		}
		console.log(`discoverByTrack: Added ${seenArtists.size} seed artists`);
	}

	console.log(`discoverByTrack: Processing ${seedLimit} seed tracks, fetching up to ${trackSimilarLimit} similar tracks each`);

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		const trackTitle = seed.title;

		if (!trackTitle) {
			console.log(`discoverByTrack: Seed ${i} has no track title, skipping`);
			continue;
		}

		if (!seed.artist) {
			console.log(`discoverByTrack: Seed ${i} has no artist, skipping`);
			continue;
		}

		// Split artists by ';' and make separate API calls for each
		const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

		const progress = (i + 1) / seedLimit;
		updateProgress(`Finding tracks similar to "${trackTitle}"...`, progress * 0.5);

		for (const artistName of artists) {
			const fixedArtistName = fixPrefixes(artistName);

			try {
				// Fetch similar tracks from Last.fm for this artist/track combination
				// Use the user's configured limit
				const similarTracks = await fetchSimilarTracks(
					fixedArtistName,
					trackTitle,
					trackSimilarLimit
				);

				if (!similarTracks || similarTracks.length === 0) {
					console.log(`discoverByTrack: No similar tracks found for "${fixedArtistName} - ${trackTitle}"`);
					continue;
				}

				console.log(`discoverByTrack: Found ${similarTracks.length} similar tracks for "${fixedArtistName} - ${trackTitle}"`);

				// Group by artist
				for (const simTrack of similarTracks) {
					if (!simTrack?.artist || !simTrack?.title) continue;

					const artKey = simTrack.artist.toUpperCase();
					if (blacklist.has(artKey)) continue;

					if (!tracksByArtist.has(artKey)) {
						tracksByArtist.set(artKey, {
							artistName: simTrack.artist,
							tracks: []
						});
					}

					const entry = tracksByArtist.get(artKey);

					// Check if we already have this track
					const trackKey = simTrack.title.toUpperCase();
					const exists = entry.tracks.some(t => t.title.toUpperCase() === trackKey);
					if (!exists) {
						entry.tracks.push({
							title: simTrack.title,
							match: simTrack.match || 0,
							playcount: simTrack.playcount || 0
						});
					}
				}

			} catch (e) {
				console.error(`discoverByTrack: Error processing seed track "${fixedArtistName} - ${trackTitle}": ${e.toString()}`);
			}
		}
	}

	// Convert to candidate format
	for (const [artKey, data] of tracksByArtist) {
		if (seenArtists.has(artKey)) continue;
		seenArtists.add(artKey);

		// Sort tracks by match score (highest first)
		data.tracks.sort((a, b) => (b.match || 0) - (a.match || 0));

		// Limit tracks per artist
		candidates.push({
			artist: data.artistName,
			tracks: data.tracks.slice(0, config.tracksPerArtist || 10)
		});
	}

	console.log(`discoverByTrack: Found ${candidates.length} candidate artists from track similarity`);

	return candidates;
}

/**
 * Genre-based discovery strategy.
 * 
 * Uses Last.fm artist.getInfo to get genres/tags, then tag.getTopArtists to find
 * popular artists in those genres. Also uses genre from seed tracks if available.
 * For tracks with multiple genres (separated by ';'), processes each genre.
 * 
 * IMPORTANT: This strategy respects config limits to prevent collecting too many artists.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByGenre(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchArtistInfo, fetchArtistsByTag } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();
	const collectedTags = new Map(); // tag -> count (to prioritize common tags)

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	// IMPORTANT: Apply config limits to prevent over-collection
	const maxCandidates = config.similarLimit || 20; // Total similar artists to collect
	const maxTagsToSearch = Math.min(5, Math.ceil(maxCandidates / 5)); // Search up to 5 tags
	const artistsPerTag = Math.ceil(maxCandidates / maxTagsToSearch); // Distribute across tags

	console.log(`discoverByGenre: Target ${maxCandidates} candidates from ${maxTagsToSearch} tags (${artistsPerTag} per tag)`);

	// Step 1: Collect genres/tags from seed tracks and their artists
	updateProgress('Analyzing seed genres...', 0.1);

	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);

	// If includeSeedArtist is enabled, add seed artists first
	console.log(`discoverByGenre: Include seed artist = ${config.includeSeedArtist}`);
	if (config.includeSeedArtist) {
		const uniqueSeedArtists = new Set();
		for (let i = 0; i < seedLimit; i++) {
			const seed = seeds[i];
			if (seed.artist) {
				const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
				for (const artist of artists) {
					uniqueSeedArtists.add(artist);
				}
			}
		}

		for (const artistName of uniqueSeedArtists) {
			addArtistCandidate(artistName, seenArtists, blacklist, candidates);
		}
		console.log(`discoverByGenre: Added ${candidates.length} seed artists`);
	}

	// First, collect genres directly from seed tracks (highest priority)
	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (seed.genre) {
			const genres = seed.genre.split(';').map(g => g.trim()).filter(Boolean);
			for (const genre of genres) {
				const tagKey = genre.toLowerCase();
				collectedTags.set(tagKey, (collectedTags.get(tagKey) || 0) + 3); // Weight seed genres highest
			}
		}
	}

	// Then, fetch additional tags from artists via Last.fm (if we don't have enough)
	if (collectedTags.size < maxTagsToSearch) {
		const uniqueArtists = new Set();
		for (let i = 0; i < seedLimit; i++) {
			const seed = seeds[i];
			if (seed.artist) {
				const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
				for (const artist of artists) {
					uniqueArtists.add(artist);
				}
			}
		}

		const artistList = Array.from(uniqueArtists);
		// Only fetch from a few artists to keep it quick
		const artistLimit = Math.min(artistList.length, 3);

		for (let i = 0; i < artistLimit; i++) {
			const artistName = artistList[i];
			const fixedName = fixPrefixes(artistName);

			try {
				const artistInfo = await fetchArtistInfo(fixedName);

				if (artistInfo?.tags && artistInfo.tags.length > 0) {
					console.log(`discoverByGenre: "${artistName}" has tags: ${artistInfo.tags.slice(0, 3).join(', ')}`);

					// Count tag occurrences (top 3 tags per artist)
					for (const tag of artistInfo.tags.slice(0, 3)) {
						const tagKey = tag.toLowerCase();
						collectedTags.set(tagKey, (collectedTags.get(tagKey) || 0) + 1);
					}
				}

			} catch (e) {
				console.error(`discoverByGenre: Error getting info for "${artistName}": ${e.toString()}`);
			}
		}
	}

	if (collectedTags.size === 0) {
		console.log('discoverByGenre: No tags found for seed artists');
		return candidates;
	}

	// Sort tags by frequency (most common first)
	const sortedTags = Array.from(collectedTags.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([tag]) => tag);

	console.log(`discoverByGenre: Top tags: ${sortedTags.slice(0, maxTagsToSearch).join(', ')}`);

	// Step 2: Get top artists for each tag (with limits)
	updateProgress('Finding artists in similar genres...', 0.3);

	const numTags = Math.min(sortedTags.length, maxTagsToSearch);

	for (let i = 0; i < numTags; i++) {
		// Stop early if we have enough candidates
		if (candidates.length >= maxCandidates) {
			console.log(`discoverByGenre: Reached candidate limit (${maxCandidates}), stopping tag search`);
			break;
		}

		const tag = sortedTags[i];
		const progress = 0.3 + ((i + 1) / numTags) * 0.3;
		updateProgress(`Searching "${tag}" genre...`, progress);

		try {
			// Only fetch as many artists as we need
			const remainingNeeded = maxCandidates - candidates.length;
			const fetchLimit = Math.min(artistsPerTag, remainingNeeded);

			const tagArtists = await fetchArtistsByTag(tag, fetchLimit);

			if (!tagArtists || tagArtists.length === 0) {
				console.log(`discoverByGenre: No artists found for tag "${tag}"`);
				continue;
			}

			console.log(`discoverByGenre: Found ${tagArtists.length} artists for tag "${tag}"`);

			for (const artist of tagArtists) {
				// Stop if we have enough
				if (candidates.length >= maxCandidates) break;

				if (artist?.name) {
					addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
				}
			}

		} catch (e) {
			console.error(`discoverByGenre: Error fetching artists for tag "${tag}": ${e.toString()}`);
		}
	}

	console.log(`discoverByGenre: Found ${candidates.length} candidate artists from genre search (limit was ${maxCandidates})`);

	// Step 3: Fetch top tracks for candidates (with limit)
	if (candidates.length > 0) {
		updateProgress('Fetching top tracks from genre artists...', 0.7);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

/**
 * Mood/Activity-based discovery strategy (ReccoBeats + Last.fm hybrid).
 * 
 * Uses ReccoBeats API to get mood/activity-appropriate tracks, then
 * combines with Last.fm similar artists for better library matching.
 * 
 * ENHANCEMENT: Now blends seed artists with mood/activity recommendations
 * for personalized, context-aware playlists that respect your musical taste.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings with mood/activity context
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByMoodActivity(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarArtists } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;
	
	if (!reccobeatsApi) {
		console.error('discoverByMoodActivity: ReccoBeats API not loaded');
		return [];
	}
	
	const candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);
	
	// Extract context from config
	const context = config.moodActivityContext || 'mood';
	const value = config.moodActivityValue || 'energetic';
	const blendRatio = config.moodActivityBlendRatio || 0.5; // 50% seeds, 50% mood by default
	
	console.log(`discoverByMoodActivity: Starting ${context}="${value}" discovery with ${seeds.length} seeds`);
	console.log(`discoverByMoodActivity: Blend ratio - ${Math.round(blendRatio * 100)}% seed artists, ${Math.round((1 - blendRatio) * 100)}% mood artists`);
	
	updateProgress(`Finding tracks for ${context}: ${value}...`, 0.1);
	
	// STEP 1: Extract unique seed artists
	const seedArtistSet = new Set();
	for (const seed of seeds) {
		if (seed.artist) {
			const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
			for (const artist of artists) {
				seedArtistSet.add(artist);
			}
		}
	}
	
	const seedArtists = Array.from(seedArtistSet);
	console.log(`discoverByMoodActivity: Extracted ${seedArtists.length} unique seed artists`);
	
	// STEP 2: Get similar artists to seeds using Last.fm (seed-based component)
	const seedSimilarArtists = [];
	
	if (seedArtists.length > 0 && blendRatio > 0) {
		updateProgress(`Analyzing your listening context (${seedArtists.length} seed artists)...`, 0.15);
		
		// Include seed artists if configured
		if (config.includeSeedArtist) {
			console.log(`discoverByMoodActivity: Including ${seedArtists.length} seed artists in results`);
			seedSimilarArtists.push(...seedArtists);
		}
		
		// Limit seed artists to process (avoid too many API calls)
		const seedLimit = Math.min(seedArtists.length, config.seedLimit || 5);
		
		for (let i = 0; i < seedLimit; i++) {
			const artistName = seedArtists[i];
			const progress = 0.15 + ((i + 1) / seedLimit) * 0.15;
			updateProgress(`Finding artists similar to "${artistName}"...`, progress);
			
			try {
				const fixedName = fixPrefixes(artistName);
				const similar = await fetchSimilarArtists(fixedName, 10);
				
				for (const s of similar) {
					if (s?.name) {
						seedSimilarArtists.push(s.name);
					}
				}
				
				console.log(`discoverByMoodActivity: Found ${similar.length} similar artists to "${artistName}"`);
				
			} catch (e) {
				console.error(`discoverByMoodActivity: Error fetching similar for "${artistName}":`, e);
			}
		}
		
		console.log(`discoverByMoodActivity: Total seed-based artists: ${seedSimilarArtists.length}`);
	}
	
	// STEP 3: Get mood/activity-appropriate artists using ReccoBeats (mood-based component)
	const moodArtists = [];
	
	if (blendRatio < 1) {
		updateProgress(`Fetching ${context}-appropriate recommendations...`, 0.35);
		
		const hybridResults = await reccobeatsApi.fetchHybridRecommendations(
			context,
			value,
			{
				genres: extractGenresFromSeeds(seeds),
				duration: config.playlistDuration || 60,
				limit: Math.ceil((config.similarLimit || 20) * (1 - blendRatio) * 2) // Extra for filtering
			}
		);
		
		for (const result of hybridResults) {
			if (result.artist) {
				moodArtists.push(result.artist);
			}
		}
		
		console.log(`discoverByMoodActivity: ReccoBeats provided ${moodArtists.length} mood-appropriate artists`);
	}
	
	// STEP 4: Blend both approaches based on ratio
	updateProgress(`Blending ${seedSimilarArtists.length} seed artists with ${moodArtists.length} mood artists...`, 0.5);
	
	const targetLimit = config.similarLimit || 20;
	const seedCount = Math.ceil(targetLimit * blendRatio);
	const moodCount = targetLimit - seedCount;
	
	console.log(`discoverByMoodActivity: Target ${seedCount} seed-based + ${moodCount} mood-based = ${targetLimit} total`);
	
	// Deduplicate seed artists
	const uniqueSeedArtists = Array.from(new Set(seedSimilarArtists));
	const uniqueMoodArtists = Array.from(new Set(moodArtists));
	
	// Take proportional amounts from each source
	const selectedSeedArtists = uniqueSeedArtists.slice(0, seedCount);
	const selectedMoodArtists = uniqueMoodArtists.slice(0, moodCount);
	
	// Interleave both lists for better mixing
	const blendedArtists = [];
	const maxLength = Math.max(selectedSeedArtists.length, selectedMoodArtists.length);
	
	for (let i = 0; i < maxLength; i++) {
		if (i < selectedSeedArtists.length) {
			blendedArtists.push(selectedSeedArtists[i]);
		}
		if (i < selectedMoodArtists.length) {
			blendedArtists.push(selectedMoodArtists[i]);
		}
	}
	
	console.log(`discoverByMoodActivity: Blended list contains ${blendedArtists.length} artists (${selectedSeedArtists.length} seed + ${selectedMoodArtists.length} mood)`);
	
	// STEP 5: Build candidates from blended list
	updateProgress(`Building candidate list from ${blendedArtists.length} artists...`, 0.6);
	
	for (const artist of blendedArtists) {
		if (!artist) continue;
		addArtistCandidate(artist, seenArtists, blacklist, candidates);
	}
	
	console.log(`discoverByMoodActivity: Found ${candidates.length} candidate artists for ${context} "${value}" (after blacklist filtering)`);
	
	// STEP 6: Fetch top tracks for each artist
	if (candidates.length > 0) {
		updateProgress(`Fetching tracks for ${context}-matched artists...`, 0.65);
		await fetchTracksForCandidates(modules, candidates, config);
	}
	
	return candidates;
}

/**
 * Extract genres from seed tracks for ReccoBeats recommendations.
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @returns {string[]} Array of genre names
 */
function extractGenresFromSeeds(seeds) {
	const genres = new Set();
	for (const seed of seeds) {
		if (seed.genre) {
			const genreList = seed.genre.split(';').map(g => g.trim()).filter(Boolean);
			for (const g of genreList) genres.add(g);
		}
	}
	return Array.from(genres).slice(0, 5); // Top 5 genres
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build blacklist set from settings.
 * Supports both old and new property names.
 */
function buildBlacklist(modules) {
	const { settings: { storage }, utils: { helpers } } = modules;
	const { getSetting } = storage;
	const { parseListSetting } = helpers;

	const blacklist = new Set();

	try {
		// Try new property name first, fall back to old
		const blacklistRaw = getSetting('ArtistBlacklist', '') || getSetting('Black', '');
		const items = parseListSetting(blacklistRaw);

		for (const item of items) {
			if (item) {
				blacklist.add(String(item).trim().toUpperCase());
			}
		}
	} catch (e) {
		console.error('buildBlacklist error: ' + e.toString());
	}

	return blacklist;
}

/**
 * Add artist to candidates if not already seen and not blacklisted.
 */
function addArtistCandidate(artistName, seenArtists, blacklist, candidates) {
	if (!artistName) return;

	const key = String(artistName).trim().toUpperCase();
	if (!key || seenArtists.has(key) || blacklist.has(key)) return;

	seenArtists.add(key);
	candidates.push({
		artist: artistName,
		tracks: [] // Will be filled later
	});
}

/**
 * Fetch top tracks for candidate artists.
 * Respects tracksPerArtist limit from config.
 */
async function fetchTracksForCandidates(modules, candidates, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const tracksPerArtist = config.tracksPerArtist || 10;
	const totalCandidates = candidates.length;

	console.log(`fetchTracksForCandidates: Fetching up to ${tracksPerArtist} tracks for ${totalCandidates} artists`);

	for (let i = 0; i < totalCandidates; i++) {
		const candidate = candidates[i];

		// Skip if already has tracks (e.g., from track-based discovery)
		if (candidate.tracks && candidate.tracks.length > 0) continue;

		const progress = 0.5 + ((i + 1) / totalCandidates) * 0.3;
		updateProgress(`Fetching tracks for "${candidate.artist}"...`, progress);

		try {
			const fixedName = fixPrefixes(candidate.artist);
			const topTracks = await fetchTopTracks(fixedName, tracksPerArtist, true);

			if (topTracks && topTracks.length > 0) {
				candidate.tracks = topTracks.map(t => ({
					title: typeof t === 'string' ? t : (t.title || ''),
					playcount: typeof t === 'object' ? (t.playcount || 0) : 0,
					rank: typeof t === 'object' ? (t.rank || 0) : 0
				})).filter(t => t.title); // Filter out empty titles
			}

		} catch (e) {
			console.error(`fetchTracksForCandidates: Error for "${candidate.artist}": ${e.toString()}`);
		}
	}
}

/**
 * Get the appropriate discovery function for a mode.
 * 
 * @param {string} mode - Discovery mode ('artist', 'track', 'genre', 'mood', 'activity')
 * @returns {Function} Discovery function
 */
function getDiscoveryStrategy(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return discoverByTrack;
		case DISCOVERY_MODES.GENRE:
			return discoverByGenre;
		case DISCOVERY_MODES.MOOD:
		case DISCOVERY_MODES.ACTIVITY:
			return discoverByMoodActivity;
		case DISCOVERY_MODES.ARTIST:
		default:
			return discoverByArtist;
	}
}

/**
 * Get human-readable name for discovery mode (for playlist naming).
 * 
 * @param {string} mode - Discovery mode
 * @returns {string} Human-readable mode name
 */
function getDiscoveryModeName(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return 'Similar Tracks';
		case DISCOVERY_MODES.GENRE:
			return 'Similar Genre';
		case DISCOVERY_MODES.MOOD:
			return 'Mood';
		case DISCOVERY_MODES.ACTIVITY:
			return 'Activity';
		case DISCOVERY_MODES.ARTIST:
		default:
			return 'Similar Artists';
	}
}

// Export to window namespace for MM5
window.matchMonkeyDiscoveryStrategies = {
	DISCOVERY_MODES,
	discoverByArtist,
	discoverByTrack,
	discoverByGenre,
	discoverByMoodActivity,
	getDiscoveryStrategy,
	getDiscoveryModeName,
	buildBlacklist,
};
