/**
 * Playlist Management Module - Phase 4: Database Layer
 *
 * Handles MediaMonkey playlist operations including creation, retrieval,
 * and population with tracks from the library.
 * 
 * MediaMonkey 5 API Only
 *
 * @module modules/db/playlist
 */

'use strict';

/**
 * Create a new playlist in MediaMonkey.
 *
 * Creates a new user playlist with the specified name. The playlist
 * will be added to the user's playlist collection, optionally under
 * a parent playlist. If the parent doesn't exist, it will be created.
 * If a child playlist with the same name already exists, returns the existing one.
 *
 * @async
 * @function createPlaylist
 * @param {string} playlistName - Name for the new playlist
 * @param {string} [parentName=''] - Name of parent playlist to create under (empty for root)
 * @returns {Promise<object|null>} Playlist object or null if creation failed
 */
async function createPlaylist(playlistName, parentName = '') {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			console.error('createPlaylist: Invalid playlist name');
			return null;
		}

		const name = String(playlistName).trim();

		// Validate MM5 environment
		if (typeof app === 'undefined' || !app.playlists) {
			console.error('createPlaylist: MM5 app.playlists not available');
			return null;
		}

		// Step 1: Check if child playlist already exists anywhere
		const existingChild = findPlaylist(name);
		if (existingChild) {
			console.log(`createPlaylist: Playlist "${name}" already exists, returning existing`);
			return existingChild;
		}

		// Step 2: Determine parent node
		let parentNode = app.playlists.root;
		
		if (parentName && String(parentName).trim().length > 0) {
			const parentNameTrimmed = String(parentName).trim();
			let parent = findPlaylist(parentNameTrimmed);
			
			if (!parent) {
				// Parent doesn't exist, create it first
				console.log(`createPlaylist: Parent playlist "${parentNameTrimmed}" not found, creating it first`);
				parent = app.playlists.root.newPlaylist();
				if (!parent) {
					console.error('createPlaylist: Failed to create parent playlist object');
					return null;
				}
				parent.name = parentNameTrimmed;
				await parent.commitAsync();
				console.log(`createPlaylist: Created parent playlist "${parentNameTrimmed}"`);
			}
			
			parentNode = parent;
			console.log(`createPlaylist: Creating under parent "${parentNameTrimmed}"`);
		}

		// Step 3: Create new playlist under parent
		const newPlaylist = parentNode.newPlaylist();
		if (!newPlaylist) {
			console.error('createPlaylist: Failed to create new playlist object');
			return null;
		}

		newPlaylist.name = name;

		// Commit changes to database
		await newPlaylist.commitAsync();

		console.log(`createPlaylist: Created playlist "${name}"`);

		return newPlaylist;
	} catch (e) {
		console.error('createPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Find an existing playlist by name in MediaMonkey.
 *
 * Searches the user's playlist collection for a playlist matching
 * the specified name (case-insensitive).
 *
 * @function findPlaylist
 * @param {string} playlistName - Name of playlist to find
 * @returns {object|null} Playlist object if found, null otherwise
 */
function findPlaylist(playlistName) {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			return null;
		}

		if (typeof app === 'undefined' || !app.playlists) {
			console.warn('findPlaylist: MM5 app.playlists not available');
			return null;
		}

		const targetName = String(playlistName).trim().toLowerCase();

		// Recursive search through playlist hierarchy
		function searchNode(node) {
			if (!node) return null;

			// Check if this node is the target playlist (case-insensitive)
			// MediaMonkey 5 playlists use .name property
			if (node.name && node.name.toLowerCase() === targetName) {
				return node;
			}

			// Search in child playlists if available
			if (node.childNodes) {
				// childNodes may be array or list-like
				const children = Array.isArray(node.childNodes) 
					? node.childNodes 
					: (node.childNodes.length ? Array.from(node.childNodes) : []);
				
				for (const child of children) {
					const found = searchNode(child);
					if (found) return found;
				}
			}

			return null;
		}

		// Start search from root
		const result = searchNode(app.playlists.root);
		if (result) {
			console.log(`findPlaylist: Found playlist "${targetName}"`);
			return result;
		}

		console.log(`findPlaylist: Playlist "${targetName}" not found`);
		return null;
	} catch (e) {
		console.error('findPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Get or create a playlist, preferring to find existing if available.
 *
 * Attempts to find an existing playlist by name. If not found, creates
 * a new one, optionally under a parent.
 *
 * @async
 * @function getOrCreatePlaylist
 * @param {string} playlistName - Name of the playlist
 * @param {string} [parentName=''] - Name of parent playlist (empty for root)
 * @returns {Promise<object|null>} Playlist object or null on failure
 */
async function getOrCreatePlaylist(playlistName, parentName = '') {
	try {
		// First try to find existing
		const existing = findPlaylist(playlistName);
		if (existing) {
			console.log(`getOrCreatePlaylist: Using existing playlist "${playlistName}"`);
			return existing;
		}

		// If not found, create new
		console.log(`getOrCreatePlaylist: Creating new playlist "${playlistName}"`);
		return await createPlaylist(playlistName, parentName);
	} catch (e) {
		console.error('getOrCreatePlaylist error: ' + e.toString());
		return null;
	}
}

// Export to window namespace for MM5
window.dbPlaylist = {
	createPlaylist,
	findPlaylist,
	getOrCreatePlaylist,
};
