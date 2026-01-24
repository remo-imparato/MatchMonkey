/**
 * SimilarArtists Action Registration
 * 
 * Registers actions and menu items with MediaMonkey 5 following MM5 standards.
 * This file is loaded by MM5's action system at startup.
 * 
 * MediaMonkey 5 API Only
 * 
 * Actions registered:
 * - SimilarArtistsRun: Main "Similar Artists" command
 * - SimilarArtistsToggleAuto: Toggle auto-queue mode on/off
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

/**
 * Run Similar Artists action
 * 
 * Generates a playlist or queue of similar artists based on selected/playing track(s).
 * 
 * Accessible via:
 * - Tools menu ? Similar Artists
 * - Toolbar button
 * - Configurable hotkey
 */
window.actions.SimilarArtistsRun = {
	title: () => _('&Similar Artists'),
	icon: 'script',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function() {
		// Call the main entry point with autoMode=false (manual invocation)
		if (window.SimilarArtists?.runSimilarArtists) {
			window.SimilarArtists.runSimilarArtists(false);
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

/**
 * Toggle Auto-Mode action
 * 
 * Enables/disables automatic queuing of similar artists when Now Playing
 * reaches the end of the current playlist.
 * 
 * Accessible via:
 * - Tools menu ? Similar Artists: Auto On/Off (checkbox)
 * - Toolbar toggle button
 * - Configurable hotkey
 * 
 * Shows checked state when auto-mode is enabled.
 */
window.actions.SimilarArtistsToggleAuto = {
	title: () => _('Similar Artists: &Auto On/Off'),
	icon: 'script',
	checkable: true,
	hotkeyAble: true,
	visible: true,
	disabled: false,
	
	/**
	 * Dynamic checked state - reads from SimilarArtists module
	 */
	checked: function() {
		try {
			return Boolean(window.SimilarArtists?.isAutoEnabled?.());
		} catch (e) {
			return false;
		}
	},
	
	/**
	 * Toggle the auto-mode on/off
	 */
	execute: function() {
		if (window.SimilarArtists?.toggleAuto) {
			window.SimilarArtists.toggleAuto();
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

// ============================================================================
// TOOLS MENU REGISTRATION
// ============================================================================

/**
 * Add "Similar Artists" to Tools menu
 * 
 * Order 40 places it after most built-in tools.
 * Group order 10 groups related actions together.
 */
window._menuItems.tools.action.submenu.push({
	action: window.actions.SimilarArtistsRun,
	order: 40,
	grouporder: 10,
});

/**
 * Add "Similar Artists: Auto On/Off" to Tools menu
 * 
 * Order 50 places it right after the main action.
 * Shows as a checkbox menu item due to checkable:true.
 */
window._menuItems.tools.action.submenu.push({
	action: window.actions.SimilarArtistsToggleAuto,
	order: 50,
	grouporder: 10,
});