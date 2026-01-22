/**
 * SimilarArtists Action Handlers for MediaMonkey 5
 * 
 * This file registers MM5 action handlers for the Similar Artists add-on.
 * 
 * Provides:
 * - SimilarArtistsRun: Main action to generate similar artists
 * - SimilarArtistsToggleAuto: Action to toggle auto-mode on/off
 * 
 * Actions are automatically discovered by MM5 and appear in:
 * - Tools menu
 * - Toolbar (if added to toolbar config)
 * - Hotkey configuration
 * - Context menus (if configured)
 * 
 * @license MIT
 */

'use strict';

// Ensure action categories exist
if (!window.actionCategories) {
	window.actionCategories = {};
}

// Register 'addons' category
if (!window.actionCategories.hasOwnProperty('addons')) {
	window.actionCategories.addons = () => _('Addons');
}

// Ensure actions registry exists
window.actions = window.actions || {};

// ============================================================================
// ACTION 1: SimilarArtistsRun
// ============================================================================

/**
 * SimilarArtistsRun Action
 * 
 * Triggers the main similar artists workflow.
 * Generates or queues tracks from similar artists based on user selection.
 * 
 * Features:
 * - Hotkey support (user-configurable)
 * - Menu item in Tools ? Similar Artists
 * - Toolbar button support
 * - Error handling with console feedback
 * 
 * Flow:
 * 1. User clicks toolbar button or menu item
 * 2. MM5 calls execute()
 * 3. Calls window.SimilarArtists.runSimilarArtists(false)
 * 4. Phase 5 orchestration runs
 * 5. Similar artists workflow completes
 */
window.actions.SimilarArtistsRun = {
	// User-facing title (& indicates keyboard shortcut letter)
	title: () => _('&Similar Artists'),

	// Icon identifier
	icon: 'script',

	// Category for organization in action list
	category: 'addons',

	// Support user-defined hotkeys
	hotkeyAble: true,

	// Always available in UI
	visible: true,

	// Not disabled by default
	disabled: false,

	// Action execution
	execute: function() {
		try {
			// Check that main add-on module is loaded
			if (!window.SimilarArtists) {
				console.error('SimilarArtists: Add-on not initialized');
				return;
			}

			// Check that function exists
			if (typeof window.SimilarArtists.runSimilarArtists !== 'function') {
				console.error('SimilarArtists: runSimilarArtists function not available');
				return;
			}

			// Run the workflow (false = user-initiated, not auto-mode)
			window.SimilarArtists.runSimilarArtists(false);

		} catch (e) {
			console.error(`SimilarArtists: Error executing SimilarArtistsRun: ${e.toString()}`);
		}
	}
};

// ============================================================================
// ACTION 2: SimilarArtistsToggleAuto
// ============================================================================

/**
 * SimilarArtistsToggleAuto Action
 * 
 * Toggles automatic similar artist queuing on/off.
 * When enabled, automatically queues similar tracks when playlist nears end.
 * 
 * Features:
 * - Checkable action (shows checkbox in menu)
 * - Hotkey support (user-configurable)
 * - Toolbar button support
 * - Dynamic checkbox state
 * - Error handling with console feedback
 * 
 * Flow:
 * 1. User clicks toggle button/menu item
 * 2. MM5 calls execute()
 * 3. Calls window.SimilarArtists.toggleAuto()
 * 4. Setting updated
 * 5. Listener attached/detached
 * 6. UI updated (checkbox, icon, etc)
 */
window.actions.SimilarArtistsToggleAuto = {
	// User-facing title
	title: () => _('Similar Artists: &Auto On/Off'),

	// Icon identifier
	icon: 'script',

	// Category for organization
	category: 'addons',

	// This is a checkable action (shows checkbox in menu)
	checkable: true,

	// Support user-defined hotkeys
	hotkeyAble: true,

	// Always available in UI
	visible: true,

	// Not disabled by default
	disabled: false,

	// Determine current checked state
	checked: function() {
		try {
			// Check that main add-on module is loaded
			if (!window.SimilarArtists) {
				return false;
			}

			// Check that function exists
			if (typeof window.SimilarArtists.isAutoEnabled !== 'function') {
				return false;
			}

			// Return current auto-mode state
			return Boolean(window.SimilarArtists.isAutoEnabled());

		} catch (e) {
			console.error(`SimilarArtists: Error checking auto state: ${e.toString()}`);
			return false;
		}
	},

	// Action execution (toggle)
	execute: function() {
		try {
			// Check that main add-on module is loaded
			if (!window.SimilarArtists) {
				console.error('SimilarArtists: Add-on not initialized');
				return;
			}

			// Check that function exists
			if (typeof window.SimilarArtists.toggleAuto !== 'function') {
				console.error('SimilarArtists: toggleAuto function not available');
				return;
			}

			// Toggle auto-mode
			window.SimilarArtists.toggleAuto();

		} catch (e) {
			console.error(`SimilarArtists: Error executing SimilarArtistsToggleAuto: ${e.toString()}`);
		}
	}
};

// ============================================================================
// MENU REGISTRATION
// ============================================================================

/**
 * Register actions in Tools menu.
 * 
 * Adds both actions to Tools ? Similar Artists submenu so they appear
 * in the Tools menu alongside other MM5 tools.
 */
if (window._menuItems && window._menuItems.tools) {
	// Ensure action submenu exists
	if (!window._menuItems.tools.action) {
		window._menuItems.tools.action = {};
	}

	// Ensure submenu array exists
	if (!window._menuItems.tools.action.submenu) {
		window._menuItems.tools.action.submenu = [];
	}

	// Register SimilarArtistsRun in menu
	window._menuItems.tools.action.submenu.push({
		action: window.actions.SimilarArtistsRun,
		order: 40,           // Position in menu
		grouporder: 10,      // Group assignment
	});

	// Register SimilarArtistsToggleAuto in menu
	window._menuItems.tools.action.submenu.push({
		action: window.actions.SimilarArtistsToggleAuto,
		order: 50,           // Position in menu (after Run)
		grouporder: 10,      // Group assignment
	});
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Log successful registration
console.log('SimilarArtists: Action handlers registered');

/**
 * Verify MM5 environment on load.
 * Ensures required APIs are available.
 */
(function() {
	'use strict';

	try {
		// Check MM5 APIs are available
		if (!window.actions) {
			console.warn('SimilarArtists: window.actions not available');
			return;
		}

		if (!window._menuItems) {
			console.warn('SimilarArtists: window._menuItems not available');
			return;
		}

		// Log verification success
		console.log('SimilarArtists: MM5 APIs verified');

	} catch (e) {
		console.error(`SimilarArtists: Error verifying MM5 APIs: ${e.toString()}`);
	}
})();
