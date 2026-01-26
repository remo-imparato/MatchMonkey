/**
 * MatchMonkey Action Registration
 * 
 * Registers actions and menu items with MediaMonkey 5 following MM5 standards.
 * This file is loaded by MM5's action system at startup.
 * 
 * MediaMonkey 5 API Only
 * 
 * Actions registered:
 * - SimilarArtistsRun: Find similar artists (artist.getSimilar API)
 * - SimilarTracksRun: Find similar tracks (track.getSimilar API)
 * - SimilarGenreRun: Find artists in same genre (tag.getTopArtists API)
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
 * Run action
 */
actions.similarArtistsRun = {
	title: _('Similar &Artists'),
	icon: 'artist',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'artist');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

/**
 * Run Similar Tracks action
 */
actions.similarTracksRun = {
	title: _('Similar &Tracks'),
	icon: 'song',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'track');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

/**
 * Run Similar Genre action
 */
actions.similarGenreRun = {
	title: _('Similar &Genre'),
	icon: 'genre',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'genre');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

/**
 * Run Mood action
 */
actions.similarMoodRun = {
	title: _('Similar &Mood'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

/**
 * Run Activity action
 */
actions.similarActivityRun = {
	title: _('Similar &Activity'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

/**
 * Toggle Auto-Mode action
 */
actions.matchMonkeyToggleAuto = {
	title: _('Similar: &Auto Queue'),
	icon: 'script',
	checkable: true,
	hotkeyAble: true,
	visible: true,
	disabled: false,

	checked: function () {
		try {
			return Boolean(window.matchMonkey && window.matchMonkey.isAutoEnabled && window.matchMonkey.isAutoEnabled());
		} catch (e) {
			return false;
		}
	},

	execute: function () {
		if (window.matchMonkey && window.matchMonkey.toggleAuto) {
			window.matchMonkey.toggleAuto();
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

// ============================================================================
// TOOLS MENU REGISTRATION - Using Submenu
// ============================================================================

// Similar Artists submenu for Tools menu
_menuItems.tools.action.submenu.push({
	action: {
		title: _('&Match Monkey...'),
		icon: 'script',
		visible: true,
		submenu: [
			{ action: actions.similarArtistsRun, order: 10 },
			{ action: actions.similarTracksRun, order: 20 },
			{ action: actions.similarGenreRun, order: 30 },
			{ action: actions.similarMoodRun, order: 40 },
			{ action: actions.similarActivityRun, order: 45 },
			{ separator: true, order: 50 },
			{ action: actions.matchMonkeyToggleAuto, order: 60 }
		]
	},
	order: 40,
	grouporder: 10
});

// ============================================================================
// CONTEXT MENU REGISTRATION - Add to tracklistMenuItems
// ============================================================================

// Ensure menus object exists
if (!window.menus) {
	window.menus = {};
}

// Wait for tracklistMenuItems to be initialized, then add our items
(function () {
	var matchMonkeyMenuItem = {
		action: {
			title: _('&Match Monkey...'),
			icon: 'script',
			visible: true,
			disabled: uitools.notMediaListSelected,
			submenu: [
				{ action: actions.similarArtistsRun, order: 10 },
				{ action: actions.similarTracksRun, order: 20 },
				{ action: actions.similarGenreRun, order: 30 },
				{ action: actions.similarMoodRun, order: 40 }
			]
		},
		order: 100,
		grouporder: 50
	};

	// Check if tracklistMenuItems is already initialized
	if (window.menus.tracklistMenuItems && Array.isArray(window.menus.tracklistMenuItems)) {
		// Already initialized, add our item
		window.menus.tracklistMenuItems.push(matchMonkeyMenuItem);
	} else {
		// Not yet initialized, wait for it
		var checkInterval = setInterval(function () {
			if (window.menus.tracklistMenuItems && Array.isArray(window.menus.tracklistMenuItems)) {
				clearInterval(checkInterval);
				window.menus.tracklistMenuItems.push(matchMonkeyMenuItem);
			}
		}, 100);

		// Fallback: if it never initializes (shouldn't happen), create it
		setTimeout(function () {
			if (!window.menus.tracklistMenuItems) {
				clearInterval(checkInterval);
				console.warn('MatchMonkey: tracklistMenuItems never initialized, creating array');
				window.menus.tracklistMenuItems = [matchMonkeyMenuItem];
			}
		}, 5000);
	}
})();