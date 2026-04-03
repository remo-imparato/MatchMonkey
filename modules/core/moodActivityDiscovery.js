/**
 * Mood/Activity Discovery Module
 * 
 * Implements a hybrid approach for mood/activity-based playlist generation:
 * 1. Use seed tracks to find similar tracks via Last.fm
 * 2. Match similar tracks against local library (ignoring max count limits)
 * 3. Look up audio features for matched tracks via ReccoBeats
 * 4. Filter tracks by mood/activity audio feature templates
 * 5. Create playlist from surviving tracks
 * 
 * This approach combines Last.fm's music similarity knowledge with ReccoBeats'
 * audio feature analysis to produce mood/activity-appropriate playlists from
 * the user's local library.
 * 
 * @module modules/core/moodActivityDiscovery
 * @author Remo Imparato
 */

'use strict';

// Get logger reference
const _getMoodActivityLogger = () => window.matchMonkeyLogger;

// =============================================================================
// AUDIO FEATURE DEFINITIONS
// =============================================================================

/**
 * Audio feature names supported by ReccoBeats recommendation API.
 * Values are typically 0.0-1.0 scale (except tempo which is BPM, loudness is dB).
 */
const AUDIO_FEATURE_NAMES = [
	'acousticness', 'danceability', 'energy', 'instrumentalness',
	'liveness', 'loudness', 'mode', 'speechiness', 'tempo', 'valence'
];

/**
 * Audio feature targets for different moods.
 */
const MOOD_AUDIO_TARGETS = {
	energetic: {
		energy: { target: 0.85, min: 0.65, max: 1.0 },
		valence: { target: 0.7, min: 0.5, max: 1.0 },
		danceability: { target: 0.75, min: 0.55, max: 1.0 },
		tempo: { target: 135, min: 110, max: 180 }
	},

	relaxed: {
		energy: { target: 0.25, min: 0.0, max: 0.45 },
		acousticness: { target: 0.6, min: 0.3, max: 1.0 },
		tempo: { target: 75, min: 50, max: 105 }
	},

	happy: {
		valence: { target: 0.85, min: 0.65, max: 1.0 },
		energy: { target: 0.6, min: 0.4, max: 1.0 },
		danceability: { target: 0.65, min: 0.45, max: 1.0 }
	},

	sad: {
		valence: { target: 0.2, min: 0.0, max: 0.35 },
		energy: { target: 0.25, min: 0.0, max: 0.45 },
		acousticness: { target: 0.65, min: 0.3, max: 1.0 }
	},

	focused: {
		instrumentalness: { target: 0.7, min: 0.4, max: 1.0 },
		speechiness: { target: 0.04, min: 0.0, max: 0.12 },
		energy: { target: 0.35, min: 0.2, max: 0.55 }
	},

	angry: {
		energy: { target: 0.95, min: 0.75, max: 1.0 },
		valence: { target: 0.15, min: 0.0, max: 0.35 },
		loudness: { target: -6, min: -12, max: -2 } // realistic metal/rock mastering
	},

	romantic: {
		valence: { target: 0.65, min: 0.4, max: 0.85 },
		acousticness: { target: 0.55, min: 0.2, max: 0.85 },
		energy: { target: 0.4, min: 0.2, max: 0.6 }
	},

	uplifting: {
		valence: { target: 0.8, min: 0.6, max: 1.0 },
		energy: { target: 0.7, min: 0.5, max: 1.0 },
		danceability: { target: 0.55, min: 0.35, max: 0.85 }
	},

	dark: {
		valence: { target: 0.2, min: 0.0, max: 0.35 },
		energy: { target: 0.45, min: 0.25, max: 0.7 },
		instrumentalness: { target: 0.35, min: 0.1, max: 0.65 }
	}
};

/**
 * Audio feature targets for different activities.
 */
const ACTIVITY_AUDIO_TARGETS = {
	workout: {
		energy: { target: 0.9, min: 0.75, max: 1.0 },
		tempo: { target: 145, min: 120, max: 185 },
		danceability: { target: 0.8, min: 0.6, max: 1.0 }
	},

	study: {
		instrumentalness: { target: 0.75, min: 0.45, max: 1.0 },
		speechiness: { target: 0.04, min: 0.0, max: 0.12 },
		energy: { target: 0.25, min: 0.1, max: 0.45 }
	},

	party: {
		danceability: { target: 0.9, min: 0.7, max: 1.0 },
		energy: { target: 0.85, min: 0.65, max: 1.0 },
		valence: { target: 0.75, min: 0.5, max: 1.0 }
	},

	sleep: {
		energy: { target: 0.1, min: 0.0, max: 0.25 },
		acousticness: { target: 0.8, min: 0.5, max: 1.0 },
		instrumentalness: { target: 0.7, min: 0.4, max: 1.0 },
		tempo: { target: 55, min: 40, max: 85 }
	},

	driving: {
		energy: { target: 0.6, min: 0.4, max: 0.8 },
		tempo: { target: 115, min: 90, max: 140 },
		valence: { target: 0.6, min: 0.4, max: 0.9 }
	},

	meditation: {
		instrumentalness: { target: 0.9, min: 0.6, max: 1.0 },
		acousticness: { target: 0.9, min: 0.5, max: 1.0 },
		energy: { target: 0.15, min: 0.0, max: 0.35 }
	},

	cooking: {
		valence: { target: 0.7, min: 0.4, max: 1.0 },
		energy: { target: 0.5, min: 0.3, max: 0.7 },
		danceability: { target: 0.55, min: 0.35, max: 0.75 }
	},

	cleaning: {
		energy: { target: 0.8, min: 0.55, max: 1.0 },
		danceability: { target: 0.75, min: 0.5, max: 1.0 },
		tempo: { target: 130, min: 100, max: 165 }
	},

	walking: {
		energy: { target: 0.55, min: 0.35, max: 0.75 },
		tempo: { target: 115, min: 90, max: 140 },
		valence: { target: 0.6, min: 0.4, max: 0.9 }
	},

	coding: {
		instrumentalness: { target: 0.75, min: 0.45, max: 1.0 },
		speechiness: { target: 0.04, min: 0.0, max: 0.12 },
		energy: { target: 0.35, min: 0.15, max: 0.55 }
	}
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

///**
// * Get the defining features for a mood.
// * @param {string} mood - Mood name (e.g., 'energetic', 'relaxed')
// * @returns {string[]} Array of feature names that define this mood
// */
//function getMoodDefiningFeatures(mood) {
//	return MOOD_DEFINING_FEATURES[mood?.toLowerCase()] || ['energy', 'valence'];
//}

///**
// * Get the defining features for an activity.
// * @param {string} activity - Activity name (e.g., 'workout', 'study')
// * @returns {string[]} Array of feature names that define this activity
// */
//function getActivityDefiningFeatures(activity) {
//	return ACTIVITY_DEFINING_FEATURES[activity?.toLowerCase()] || ['energy', 'danceability'];
//}

/**
 * Get audio targets for a mood.
 * @param {string} mood - Mood name
 * @returns {object|null} Audio target configuration or null if unknown mood
 */
function getMoodTargets(mood) {
	return MOOD_AUDIO_TARGETS[mood?.toLowerCase()] || null;
}

/**
 * Get audio targets for an activity.
 * @param {string} activity - Activity name
 * @returns {object|null} Audio target configuration or null if unknown activity
 */
function getActivityTargets(activity) {
	return ACTIVITY_AUDIO_TARGETS[activity?.toLowerCase()] || null;
}

/**
 * Check if a track's audio features match the mood/activity targets.
 * Only checks features that are defined in the targets object.
 * 
 * @param {object} audioFeatures - Track's audio features from ReccoBeats
 * @param {object} targets - Target configuration with min/max ranges
 * @returns {object} { passes: boolean, score: number, details: object }
 */
function matchesAudioTargets(audioFeatures, targets) {
	if (!audioFeatures || !targets) {
		return { passes: false, score: 0, details: {} };
	}

	const details = {};
	let totalScore = 0;
	let featureCount = 0;
	let passCount = 0;

	// Only check features that are defined in the targets
	for (const feature in targets) {
		if (!targets.hasOwnProperty(feature))
			continue;

		const targetConfig = targets[feature];
		const trackValue = audioFeatures[feature];

		if (trackValue === undefined || trackValue === null)
			continue;

		const { target, min, max } = targetConfig;
		const inRange = trackValue >= min && trackValue <= max;

		// Calculate how close to target (0-1 score, 1 = perfect match)
		let score = 0;
		if (inRange) {
			// Score based on distance from target within the acceptable range
			const range = max - min;
			const distanceFromTarget = Math.abs(trackValue - target);
			score = range > 0 ? 1 - (distanceFromTarget / range) : 1;
			passCount++;
		}

		details[feature] = {
			value: trackValue,
			target,
			min,
			max,
			inRange,
			score
		};

		totalScore += score;
		featureCount++;
	}

	// Track passes if at least half of the target features are in range
	const passes = featureCount > 0 && passCount >= Math.ceil(featureCount / 2);
	const avgScore = featureCount > 0 ? totalScore / featureCount : 0;

	return {
		passes,
		score: avgScore,
		passCount,
		featureCount,
		details
	};
}

/**
 * Build blacklist set from user settings.
 * @param {object} modules - Module dependencies
 * @returns {Set<string>} Set of blacklisted artist names (uppercase)
 */
function buildBlacklist(modules) {
	const logger = _getMoodActivityLogger();
	const blacklist = new Set();

	try {
		const { settings: { storage }, utils: { helpers } } = modules;
		const { getSetting } = storage;
		const { parseListSetting } = helpers;

		const blacklistRaw = getSetting('ArtistBlacklist', '');
		const items = parseListSetting(blacklistRaw);

		for (const item of items) {
			if (item) blacklist.add(String(item).trim().toUpperCase());
		}
	} catch (e) {
		logger?.error('MoodActivity', `Error building blacklist: ${e.message}`);
	}

	return blacklist;
}

/**
 * Extract unique artists from seeds, splitting by ';'.
 * @param {Array} seeds - Seed objects
 * @param {number} limit - Maximum artists to return
 * @returns {string[]} Array of unique artist names
 */
function extractSeedArtists(seeds, limit) {
	const uniqueArtists = new Set();

	for (const seed of seeds) {
		if (seed.artist) {
			const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
			for (const artist of artists) {
				uniqueArtists.add(artist);
			}
		}
	}

	return Array.from(uniqueArtists).slice(0, limit);
}

// =============================================================================
// MAIN DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Mood-based discovery using Last.fm + ReccoBeats hybrid approach.
 * 
 * Workflow:
 * 1. Use seed tracks to find similar tracks via Last.fm
 * 2. Match similar tracks against local library (no count limits)
 * 3. Look up audio features for matched tracks via ReccoBeats
 * 4. Filter tracks by mood audio feature templates
 * 5. Return filtered tracks for playlist creation
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, album, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<object>} { candidates, stats }
 */
async function discoverByMood(modules, seeds, config) {
	const logger = _getMoodActivityLogger();
	const mood = config.moodActivityValue || 'energetic';

	logger?.info('MoodActivity', `=== Starting Mood Discovery: "${mood}" ===`);

	return discoverByMoodOrActivity(modules, seeds, config, 'mood', mood);
}

/**
 * Activity-based discovery using Last.fm + ReccoBeats hybrid approach.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, album, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<object>} { candidates, stats }
 */
async function discoverByActivity(modules, seeds, config) {
	const logger = _getMoodActivityLogger();
	const activity = config.moodActivityValue || 'workout';

	logger?.info('MoodActivity', `=== Starting Activity Discovery: "${activity}" ===`);

	return discoverByMoodOrActivity(modules, seeds, config, 'activity', activity);
}

/**
 * Core discovery logic for both mood and activity modes.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects
 * @param {object} config - Configuration settings
 * @param {string} type - 'mood' or 'activity'
 * @param {string} value - The mood or activity name
 * @returns {Promise<object>} { candidates, stats }
 */
async function discoverByMoodOrActivity(modules, seeds, config, type, value) {
	const logger = _getMoodActivityLogger();
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications }, db } = modules;
	const { fetchSimilarTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;

	const emptyResult = { candidates: [], stats: { audioFeatureFilteredCount: 0, totalFromApi: 0 } };
	const typeName = type === 'mood' ? 'Mood' : 'Activity';

	if (!seeds || seeds.length === 0) {
		logger?.warn('MoodActivity', 'No seed tracks provided');
		return emptyResult;
	}

	// Get targets for this mood/activity
	const targets = type === 'mood' ? getMoodTargets(value) : getActivityTargets(value);

	if (!targets) {
		logger?.error('MoodActivity', `Unknown ${type} "${value}"`);
		updateProgress(`Unknown ${type}: "${value}"`, 0.5);
		return emptyResult;
	}

	const blacklist = buildBlacklist(modules);
	const seedLimit = Math.min(seeds.length, config.seedLimit);
	const targetFeatures = Object.keys(targets);

	logger?.info('MoodActivity', `Processing ${seedLimit} seed track(s) for "${value}" ${type}`);
	logger?.debug('MoodActivity', `Target features: ${targetFeatures.join(', ')}`);
	updateProgress(`${typeName} "${value}": Finding similar tracks via Last.fm...`, 0.15);

	// ==========================================================================
	// STEP 1: Find similar tracks via Last.fm
	// ==========================================================================

	const similarTracks = new Map(); // key: "ARTIST|TITLE" -> { artist, title, seeds: Set }

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (!seed?.artist || !seed?.title) continue;

		const progress = 0.15 + ((i + 1) / seedLimit) * 0.2;
		updateProgress(`Last.fm: Finding tracks similar to "${seed.title}" (${i + 1}/${seedLimit})...`, progress);

		// Split artists by ';' and query each
		const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

		for (const artistName of artists) {
			try {
				const fixedArtistName = fixPrefixes(artistName);
				// Request a large number to maximize library matching chances
				const similar = await fetchSimilarTracks(fixedArtistName, seed.title, 100);

				if (!similar || similar.length === 0) {
					logger?.debug('MoodActivity', `No similar tracks for "${fixedArtistName} - ${seed.title}"`);
					continue;
				}

				logger?.debug('MoodActivity', `Found ${similar.length} similar to "${fixedArtistName} - ${seed.title}"`);

				for (const track of similar) {
					if (!track?.artist || !track?.title) continue;

					const key = `${track.artist.toUpperCase()}|${track.title.toUpperCase()}`;

					if (!similarTracks.has(key)) {
						similarTracks.set(key, {
							artist: track.artist,
							title: track.title,
							match: track.match || 0,
							seeds: new Set()
						});
					}

					similarTracks.get(key).seeds.add(`${seed.artist} - ${seed.title}`);
				}
			} catch (e) {
				logger?.warn('MoodActivity', `Error for "${artistName} - ${seed.title}": ${e.message}`);
			}
		}
	}

	const totalSimilar = similarTracks.size;
	logger?.info('MoodActivity', `Last.fm returned ${totalSimilar} unique similar tracks`);

	if (totalSimilar === 0) {
		logger?.info('MoodActivity', 'No similar tracks found via Last.fm');
		updateProgress(`Last.fm: No similar tracks found for your seeds`, 0.4);
		return emptyResult;
	}

	updateProgress(`Last.fm: Found ${totalSimilar} similar tracks, searching library...`, 0.35);

	// ==========================================================================
	// STEP 2: Match similar tracks against local library
	// ==========================================================================

	const matchedTracks = [];
	const tracksByArtist = new Map(); // Group by artist for efficient batch lookup

	// Group tracks by artist
	for (const [key, trackInfo] of similarTracks) {
		const artKey = trackInfo.artist.toUpperCase();
		if (blacklist.has(artKey)) continue;

		if (!tracksByArtist.has(artKey)) {
			tracksByArtist.set(artKey, {
				artistName: trackInfo.artist,
				tracks: []
			});
		}
		tracksByArtist.get(artKey).tracks.push(trackInfo);
	}

	const artistCount = tracksByArtist.size;
	logger?.debug('MoodActivity', `Searching library for tracks from ${artistCount} artists`);

	let artistsProcessed = 0;
	for (const [artKey, artistData] of tracksByArtist) {
		artistsProcessed++;

		if (artistsProcessed % 10 === 0) {
			const progress = 0.35 + ((artistsProcessed / artistCount) * 0.15);
			updateProgress(`Searching library: ${artistsProcessed}/${artistCount} artists...`, progress);
		}

		try {
			// Search library for this artist's tracks
			const trackTitles = artistData.tracks.map(t => t.title);

			// Use batch lookup - NO max count limit to get all possible matches
			const libraryTracks = await db.findLibraryTracks(
				artistData.artistName,
				trackTitles,
				10000, // High limit - we want ALL matches
				{
					formatPreference: config.formatPreference,
					minRating: config.minRating,
					allowUnknown: config.allowUnknown,
					collection: config.localCollection || ''
				}
			);

			if (libraryTracks && libraryTracks.length > 0) {
				for (const track of libraryTracks) {
					matchedTracks.push({
						track,
						artist: artistData.artistName,
						title: track.title || track.SongTitle || track.Title || ''
					});
				}
			}
		} catch (e) {
			logger?.warn('MoodActivity', `Library search error for "${artistData.artistName}": ${e.message}`);
		}
	}

	logger?.info('MoodActivity', `Library matching found ${matchedTracks.length} tracks`);

	if (matchedTracks.length === 0) {
		logger?.info('MoodActivity', 'No matching tracks found in library');
		updateProgress(`No similar tracks found in your library`, 0.5);
		return emptyResult;
	}

	updateProgress(`Found ${matchedTracks.length} tracks in library, analyzing audio features...`, 0.5);

	// ==========================================================================
	// STEP 3: Look up audio features via ReccoBeats
	// ==========================================================================

	if (!reccobeatsApi) {
		logger?.error('MoodActivity', 'ReccoBeats API not available');
		updateProgress('ReccoBeats API not available', 0.5);
		return emptyResult;
	}

	const tracksWithFeatures = [];
	const batchSize = 20; // Process in batches to show progress

	for (let i = 0; i < matchedTracks.length; i += batchSize) {
		const batch = matchedTracks.slice(i, i + batchSize);
		const progress = 0.5 + ((i / matchedTracks.length) * 0.2);
		updateProgress(`Analyzing audio features: ${Math.min(i + batchSize, matchedTracks.length)}/${matchedTracks.length}...`, progress);

		for (const { track, artist, title } of batch) {
			try {
				// Get album from track if available
				const album = track.album || track.Album || '';

				// Look up track ID on ReccoBeats
				const trackId = await reccobeatsApi.findTrackId(artist, title, album);

				if (!trackId) {
					logger?.debug('MoodActivity', `ReccoBeats: Track not found - "${artist} - ${title}"`);
					continue;
				}

				// Fetch audio features
				const features = await reccobeatsApi.fetchTrackAudioFeatures(trackId);

				if (features) {
					tracksWithFeatures.push({
						track,
						artist,
						title,
						audioFeatures: features
					});
				}
			} catch (e) {
				logger?.debug('MoodActivity', `Audio features error for "${artist} - ${title}": ${e.message}`);
			}
		}
	}

	logger?.info('MoodActivity', `Retrieved audio features for ${tracksWithFeatures.length}/${matchedTracks.length} tracks`);

	if (tracksWithFeatures.length === 0) {
		logger?.info('MoodActivity', 'No audio features available for matched tracks');
		updateProgress(`Could not retrieve audio features for any tracks`, 0.7);
		return emptyResult;
	}

	updateProgress(`Got audio features for ${tracksWithFeatures.length} tracks, filtering by ${type}...`, 0.7);

	// ==========================================================================
	// STEP 4: Filter tracks by mood/activity audio feature templates
	// ==========================================================================

	const filteredTracks = [];
	let passedCount = 0;
	let filteredCount = 0;

	for (const { track, artist, title, audioFeatures } of tracksWithFeatures) {
		const result = matchesAudioTargets(audioFeatures, targets);

		if (result.passes) {
			filteredTracks.push({
				track,
				artist,
				title,
				audioFeatures,
				matchScore: result.score,
				matchDetails: result.details
			});
			passedCount++;
		} else {
			filteredCount++;
			// Build detailed feature breakdown for debug output
			const featureDetails = Object.entries(result.details).map(([feature, detail]) => {
				const status = detail.inRange ? '✓' : '✗';
				return `${feature}: ${detail.value.toFixed(2)} [target: ${detail.target.toFixed(2)}, range: ${detail.min.toFixed(2)}-${detail.max.toFixed(2)}] ${status}`;
			}).join(', ');

			logger?.debug('MoodActivity', `Filtered out: "${artist} - ${title}" (score: ${result.score.toFixed(2)}, ${result.passCount}/${result.featureCount} features passed) - ${featureDetails}`);
		}
	}

	logger?.info('MoodActivity', `${type.charAt(0).toUpperCase() + type.slice(1)} filtering: ${passedCount} passed, ${filteredCount} filtered`);

	if (filteredTracks.length === 0) {
		logger?.info('MoodActivity', `No tracks match "${value}" ${type} criteria`);
		updateProgress(`No tracks match "${value}" ${type} criteria`, 0.8);
		return emptyResult;
	}

	// Sort by match score (best matches first)
	filteredTracks.sort((a, b) => b.matchScore - a.matchScore);

	updateProgress(`${typeName} "${value}": ${filteredTracks.length} tracks match criteria`, 0.8);

	// ==========================================================================
	// STEP 5: Convert to candidate format for orchestration
	// ==========================================================================

	// Build candidates array (one entry per track, maintaining compatibility with orchestration)
	const seenArtists = new Set();
	const candidates = [];

	for (const { track, artist, title, matchScore } of filteredTracks) {
		const artKey = artist.toUpperCase();

		if (!seenArtists.has(artKey)) {
			seenArtists.add(artKey);
			candidates.push({
				artist,
				tracks: [{ title, match: matchScore }],
				// Store the actual library track for direct use
				_libraryTracks: [track]
			});
		} else {
			// Add to existing artist
			const existing = candidates.find(c => c.artist.toUpperCase() === artKey);
			if (existing) {
				existing.tracks.push({ title, match: matchScore });
				existing._libraryTracks = existing._libraryTracks || [];
				existing._libraryTracks.push(track);
			}
		}
	}

	const totalTracks = filteredTracks.length;
	logger?.summary('MoodActivity', `"${value}" ${type} discovery complete`, {
		candidates: candidates.length,
		tracks: totalTracks,
		filtered: filteredCount,
		totalFromLastfm: totalSimilar
	});

	updateProgress(`${typeName} "${value}": ${candidates.length} artists with ${totalTracks} matching tracks`, 0.85);

	return {
		candidates,
		stats: {
			audioFeatureFilteredCount: filteredCount, // Tracks filtered by audio feature matching
			totalFromApi: totalSimilar
		},
		// Include the actual library tracks for direct playlist creation
		libraryTracks: filteredTracks.map(t => t.track)
	};
}

// =============================================================================
// EXPORT TO WINDOW NAMESPACE
// =============================================================================

window.matchMonkeyMoodActivityDiscovery = {
	// Discovery functions
	discoverByMood,
	discoverByActivity,
	discoverByMoodOrActivity,

	// Utility functions
	matchesAudioTargets,
	getMoodTargets,
	getActivityTargets,

	// Constants
	AUDIO_FEATURE_NAMES,
	MOOD_AUDIO_TARGETS,
	ACTIVITY_AUDIO_TARGETS
};
