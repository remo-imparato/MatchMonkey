/**
 * Playlist Management Module - Phase 4: Database Layer
 *
 * Handles MediaMonkey 5 playlist operations using only documented API methods:
 * - Properties: childrenCount, id, isAutoPlaylist, name, parent, parentID
 * - Methods: addTracksAsync, clearTracksAsync, commitAsync, deleteAsync, 
 *            getChildren, getTracklist, newPlaylist
 * - app.playlists.getByTitleAsync() - Find playlist by name
 * 
 * @module modules/db/playlist
 */

'use strict';

/** Helper to get logger instance safely */
const _getPlaylistLogger = () => window.matchMonkeyLogger;

/**
 * Find a playlist by name anywhere in the playlist tree.
 * Uses MM5's getByTitleAsync() method.
 *
 * @async
 * @param {string} playlistName - Name of playlist to find (case-insensitive)
 * @returns {Promise<object|null>} Playlist object if found, null otherwise
 */
async function findPlaylist(playlistName) {
	const logger = _getPlaylistLogger();
	if (!playlistName || String(playlistName).trim().length === 0) {
		return null;
	}

	if (typeof app === 'undefined' || !app.playlists) {
		logger?.warn('Playlist', 'findPlaylist: app.playlists not available');
		return null;
	}

	try {
		const name = String(playlistName).trim();

		// Use MM5's documented getByTitleAsync method
		const result = await app.playlists.getByTitleAsync(name);

		if (result) {
			logger?.debug('Playlist', `findPlaylist: Found "${name}"`);
			return result;
		}

		logger?.debug('Playlist', `findPlaylist: "${name}" not found`);
		return null;
	} catch (e) {
		logger?.error('Playlist', 'findPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Find a playlist by name that is a direct child of a parent playlist.
 * First finds the playlist globally, then verifies it's a child of the parent.
 *
 * @async
 * @param {string} playlistName - Name of playlist to find (case-insensitive)
 * @param {object} parentPlaylist - Parent playlist node to verify against
 * @returns {Promise<object|null>} Playlist object if found and is a child of parent, null otherwise
 */
async function findPlaylistUnderParent(playlistName, parentPlaylist) {
	const logger = _getPlaylistLogger();
	if (!playlistName || !parentPlaylist) {
		return null;
	}

	try {
		// Use app.playlists.getByTitleAsync to find the playlist
		const playlist = await findPlaylist(playlistName);

		if (!playlist) {
			logger?.debug('Playlist', `findPlaylistUnderParent: "${playlistName}" not found`);
			return null;
		}

		// Verify it's a child of the parent by checking parentID
		if (playlist.parentID === parentPlaylist.id) {
			logger?.debug('Playlist', `findPlaylistUnderParent: Found "${playlistName}" under parent`);
			return playlist;
		}

		logger?.debug('Playlist', `findPlaylistUnderParent: "${playlistName}" exists but not under specified parent`);
		return null;
	} catch (e) {
		logger?.error('Playlist', 'findPlaylistUnderParent error: ' + e.toString());
		return null;
	}
}

/**
 * Create a new playlist under a specified parent (or root if null).
 * Uses MM5's newPlaylist() and commitAsync() methods.
 *
 * @async
 * @param {string} playlistName - Name for the new playlist
 * @param {object|null} parentPlaylist - Parent playlist node, or null for root
 * @returns {Promise<object|null>} Created playlist object or null on failure
 */
async function createPlaylist(playlistName, parentPlaylist = null) {
	const logger = _getPlaylistLogger();
	if (!playlistName || String(playlistName).trim().length === 0) {
		logger?.error('Playlist', 'createPlaylist: Invalid playlist name');
		return null;
	}

	if (typeof app === 'undefined' || !app.playlists?.root) {
		logger?.error('Playlist', 'createPlaylist: app.playlists.root not available');
		return null;
	}

	const name = String(playlistName).trim();
	const targetNode = parentPlaylist || app.playlists.root;

	try {
		// Create new playlist using MM5's newPlaylist() method
		const playlist = targetNode.newPlaylist();
		if (!playlist) {
			logger?.error('Playlist', 'createPlaylist: newPlaylist() returned null');
			return null;
		}

		// Set the name
		playlist.name = name;

		// Commit to database using commitAsync()
		await playlist.commitAsync();

		logger?.debug('Playlist', `createPlaylist: Created "${name}"${parentPlaylist ? ' under parent' : ' at root'}`);
		return playlist;

	} catch (e) {
		logger?.error('Playlist', 'createPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Clear all tracks from a playlist using clearTracksAsync().
 *
 * @async
 * @param {object} playlist - Playlist object to clear
 * @returns {Promise<boolean>} True if cleared successfully
 */
async function clearPlaylistTracks(playlist) {
	const logger = _getPlaylistLogger();
	if (!playlist) {
		return false;
	}

	try {
		// Use MM5's clearTracksAsync method
		await playlist.clearTracksAsync();
		logger?.debug('Playlist', `clearPlaylistTracks: Cleared "${playlist.name}"`);
		return true;
	} catch (e) {
		logger?.error('Playlist', 'clearPlaylistTracks error: ' + e.toString());
		return false;
	}
}

/**
 * Add tracks to a playlist using addTracksAsync().
 *
 * @async
 * @param {object} playlist - Playlist object
 * @param {object[]} tracks - Array of track objects to add
 * @returns {Promise<number>} Number of tracks added
 */
async function addTracksToPlaylist(playlist, tracks) {
	const logger = _getPlaylistLogger();
	if (!playlist || !Array.isArray(tracks) || tracks.length === 0) {
		return 0;
	}

	try {
		// Create a tracklist with all tracks
		const tracklist = app.utils.createTracklist(true);
		let validCount = 0;

		for (const track of tracks) {
			if (track && typeof track === 'object') {
				tracklist.add(track);
				validCount++;
			}
		}

		if (validCount === 0) {
			return 0;
		}

		await tracklist.whenLoaded();

		// Use MM5's addTracksAsync method
		await playlist.addTracksAsync(tracklist);

		logger?.debug('Playlist', `addTracksToPlaylist: Added ${validCount} tracks to "${playlist.name}"`);
		return validCount;

	} catch (e) {
		logger?.error('Playlist', 'addTracksToPlaylist error: ' + e.toString());
		return 0;
	}
}

/**
 * Delete a playlist using deleteAsync().
 *
 * @async
 * @param {object} playlist - Playlist object to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deletePlaylist(playlist) {
	const logger = _getPlaylistLogger();
	if (!playlist) {
		return false;
	}

	try {
		await playlist.deleteAsync();
		logger?.debug('Playlist', `deletePlaylist: Deleted "${playlist.name}"`);
		return true;
	} catch (e) {
		logger?.error('Playlist', 'deletePlaylist error: ' + e.toString());
		return false;
	}
}

/**
 * Resolve the target playlist based on settings and mode.
 * 
 * Handles:
 * - Parent playlist: finds or creates if specified (0 or 1 parent)
 * - Playlist mode: Create new (with unique naming) or Overwrite existing
 * - Returns the playlist and whether it should be cleared
 *
 * @async
 * @param {string} playlistName - Desired playlist name
 * @param {string} parentName - Name of parent playlist (empty for root)
 * @param {string} playlistMode - 'Create new playlist' or 'Overwrite existing playlist'
 * @param {object|null} userSelectedPlaylist - User-selected playlist from dialog (overrides auto-creation)
 * @returns {Promise<{playlist: object|null, shouldClear: boolean}>}
 */
async function resolveTargetPlaylist(playlistName, parentName, playlistMode, userSelectedPlaylist = null) {
	const logger = _getPlaylistLogger();
	// If user selected a playlist via dialog, use that
	if (userSelectedPlaylist && !userSelectedPlaylist.autoCreate) {
		logger?.debug('Playlist', `resolveTargetPlaylist: Using user-selected playlist`);
		return {
			playlist: userSelectedPlaylist,
			shouldClear: playlistMode.toLowerCase().includes('overwrite'),
		};
	}

	// Determine the parent node (0 or 1 parent only)
	let parentPlaylist = null;
	if (parentName && parentName.trim()) {
		parentPlaylist = await findPlaylist(parentName.trim());
		if (!parentPlaylist) {
			// Create the parent playlist at root
			logger?.debug('Playlist', `resolveTargetPlaylist: Creating parent playlist "${parentName}"`);
			parentPlaylist = await createPlaylist(parentName.trim(), null);
		}
	}

	const isOverwriteMode = playlistMode.toLowerCase().includes('overwrite');

	if (isOverwriteMode) {
		// Look for existing playlist to overwrite
		const existing = parentPlaylist
			? await findPlaylistUnderParent(playlistName, parentPlaylist)
			: await findPlaylist(playlistName);

		if (existing) {
			logger?.debug('Playlist', `resolveTargetPlaylist: Found existing playlist to overwrite`);
			return { playlist: existing, shouldClear: true };
		}
	}

	// Create new playlist mode - need unique name if playlist exists
	let finalName = playlistName;
	if (!isOverwriteMode) {
		let counter = 1;
		let testName = playlistName;

		// Check for existing playlist with same name
		const checkExists = async (name) => {
			if (parentPlaylist) {
				return await findPlaylistUnderParent(name, parentPlaylist);
			} else {
				return await findPlaylist(name);
			}
		};

		while (await checkExists(testName)) {
			counter++;
			testName = `${playlistName}_${counter}`;
			if (counter > 100) break; // Safety limit
		}
		finalName = testName;
	}

	// Create the new playlist
	const newPlaylist = await createPlaylist(finalName, parentPlaylist);
	return { playlist: newPlaylist, shouldClear: false };
}

/**
 * Get or create a playlist by name at root level.
 *
 * @async
 * @param {string} playlistName - Name of the playlist
 * @returns {Promise<object|null>} Playlist object or null on failure
 */
async function getOrCreatePlaylist(playlistName) {
	const logger = _getPlaylistLogger();
	const existing = await findPlaylist(playlistName);
	if (existing) {
		logger?.debug('Playlist', `getOrCreatePlaylist: Using existing "${playlistName}"`);
		return existing;
	}

	logger?.debug('Playlist', `getOrCreatePlaylist: Creating new "${playlistName}"`);
	return await createPlaylist(playlistName, null);
}

// Export to window namespace for MM5
window.dbPlaylist = {
	findPlaylist,
	findPlaylistUnderParent,
	createPlaylist,
	clearPlaylistTracks,
	addTracksToPlaylist,
	deletePlaylist,
	resolveTargetPlaylist,
	getOrCreatePlaylist,
};
