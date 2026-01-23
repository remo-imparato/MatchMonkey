/**
 * Last.fm API Configuration
 * 
 * Handles Last.fm API key retrieval and Last.fm-specific settings.
 */

'use strict';

// Load dependencies from window namespace
const getSetting = () => window.similarArtistsStorage.getSetting;

/**
 * Get the Last.fm API key from MediaMonkey settings with a built-in fallback.
 * @returns {string} API key for Last.fm service.
 */
function getApiKey() {
	return getSetting()('ApiKey', '7fd988db0c4e9d8b12aed27d0a91a932');
}

// Export to window namespace for MM5
window.similarArtistsLastfm = {
	getApiKey,
};
