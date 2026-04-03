/**
 * Track Queue Module - Phase 4: Database Layer
 *
 * Handles adding tracks to Now Playing queue using MM5's player API.
 * 
 * @module modules/db/queue
 */

'use strict';

/** Helper to get logger instance safely */
const _getQueueLogger = () => window.matchMonkeyLogger;

/**
 * Add a single track to the Now Playing queue.
 *
 * @async
 * @param {object} track - Track object to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @returns {Promise<boolean>} True if successfully queued
 */
async function queueTrack(track, playNow = false) {
	const logger = _getQueueLogger();
	if (!track || typeof track !== 'object') {
		logger?.error('Queue', 'queueTrack: Invalid track object');
		return false;
	}

	if (typeof app === 'undefined' || !app.player) {
		logger?.error('Queue', 'queueTrack: app.player not available');
		return false;
	}

	try {
		const list = app.utils.createTracklist(true);
		list.add(track);
		await list.whenLoaded();

		await app.player.addTracksAsync(list, {
			withClear: false,
			saveHistory: true,
			startPlayback: playNow,
		});

		return true;
	} catch (e) {
		logger?.error('Queue', 'queueTrack error: ' + e.toString());
		return false;
	}
}

/**
 * Add multiple tracks to the Now Playing queue in batch.
 *
 * @async
 * @param {object[]} tracks - Array of track objects to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @param {boolean} [clearFirst=false] - If true, clear queue before adding
 * @returns {Promise<number>} Number of tracks successfully queued
 */
async function queueTracks(tracks, playNow = false, clearFirst = false) {
	const logger = _getQueueLogger();
	if (!Array.isArray(tracks) || tracks.length === 0) {
		return 0;
	}

	if (typeof app === 'undefined' || !app.player) {
		logger?.error('Queue', 'queueTracks: app.player not available');
		return 0;
	}

	try {
		const list = app.utils.createTracklist(true);
		let validCount = 0;

		for (const track of tracks) {
			if (track && typeof track === 'object') {
				list.add(track);
				validCount++;
			}
		}

		if (validCount === 0) {
			return 0;
		}

		await list.whenLoaded();

		await app.player.addTracksAsync(list, {
			withClear: clearFirst,
			saveHistory: true,
			startPlayback: playNow,
		});

		logger?.debug('Queue', `queueTracks: Queued ${validCount} tracks`);
		return validCount;
	} catch (e) {
		logger?.error('Queue', 'queueTracks error: ' + e.toString());
		return 0;
	}
}

// Export to window namespace for MM5
window.dbQueue = {
	queueTrack,
	queueTracks,
};
