/**
 * MatchMonkey Action Registration
 * 
 * Registers actions and menu items with MediaMonkey 5 following MM5 standards.
 * This file is loaded by MM5's action system at startup.
 * 

 * 
 * Actions registered:
 * - SimilarArtistsRun: Find similar artists (Last.fm artist.getSimilar API)
 * - SimilarTracksRun: Find similar tracks (Last.fm track.getSimilar API)
 * - SimilarGenreRun: Find artists in same genre (Last.fm tag.getTopArtists API)
 * - SimilarReccoRun: Find similar tracks using ReccoBeats AI (requires seed tracks)
 * - SimilarMood*: Find tracks by mood preset (no seeds needed)
 * - SimilarActivity*: Find tracks by activity preset (no seeds needed)
 * - SimilarArtistsToggleAuto: Toggle auto-queue mode on/off
 * 
 * @author Remo Imparato

 */

'use strict';

// ============================================================================
// ACTION DEFINITIONS - Last.fm Based
// ============================================================================

/**
 * Run Similar Artists action (Last.fm)
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
 * Run Similar Tracks action (Last.fm)
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
 * Run Similar Genre action (Last.fm)
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

// ============================================================================
// ACTION DEFINITIONS - ReccoBeats Based
// ============================================================================

/**
 * Run Similar Recco action (ReccoBeats AI - requires seed tracks)
 * Uses selected tracks to find AI-powered recommendations
 */
actions.similarReccoRun = {
	title: _('Similar &AI'),
	icon: 'analyzeWaveform',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'recco');
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	},
	getTracklist: uitools.getSelectedTracklist
};

// ============================================================================
// MOOD ACTIONS - Use predefined audio profiles (no seeds needed)
// ============================================================================

actions.similarMoodEnergetic = {
	title: _('&Energetic'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false, // Mood doesn't need track selection
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'energetic' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodRelaxed = {
	title: _('&Relaxed'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'relaxed' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodHappy = {
	title: _('&Happy'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'happy' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodSad = {
	title: _('&Sad'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'sad' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodFocused = {
	title: _('&Focused'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'focused' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodAngry = {
	title: _('&Angry'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'angry' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarMoodRomantic = {
	title: _('R&omantic'),
	icon: 'actor',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'mood', { moodActivityValue: 'romantic' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

// ============================================================================
// ACTIVITY ACTIONS - Use predefined audio profiles (no seeds needed)
// ============================================================================

actions.similarActivityWorkout = {
	title: _('&Workout'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false, // Activity doesn't need track selection
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'workout' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivityStudy = {
	title: _('&Study'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'study' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivityParty = {
	title: _('&Party'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'party' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivitySleep = {
	title: _('S&leep'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'sleep' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivityDriving = {
	title: _('&Driving'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'driving' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivityMeditation = {
	title: _('&Meditation'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'meditation' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

actions.similarActivityCooking = {
	title: _('&Cooking'),
	icon: 'mediamonkey',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function () {
		if (window.matchMonkey && window.matchMonkey.runMatchMonkey) {
			window.matchMonkey.runMatchMonkey(false, 'activity', { moodActivityValue: 'cooking' });
		} else {
			console.error('Match Monkey: Add-on not loaded');
		}
	}
};

// ============================================================================
// AUTO-MODE ACTION
// ============================================================================

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

// Mood submenu items (no track selection required)
var moodSubmenuItems = [
	{ action: actions.similarMoodEnergetic, order: 10 },
	{ action: actions.similarMoodRelaxed, order: 20 },
	{ action: actions.similarMoodHappy, order: 30 },
	{ action: actions.similarMoodSad, order: 40 },
	{ action: actions.similarMoodFocused, order: 50 },
	{ action: actions.similarMoodAngry, order: 60 },
	{ action: actions.similarMoodRomantic, order: 70 }
];

// Activity submenu items (no track selection required)
var activitySubmenuItems = [
	{ action: actions.similarActivityWorkout, order: 10 },
	{ action: actions.similarActivityStudy, order: 20 },
	{ action: actions.similarActivityParty, order: 30 },
	{ action: actions.similarActivitySleep, order: 40 },
	{ action: actions.similarActivityDriving, order: 50 },
	{ action: actions.similarActivityMeditation, order: 60 },
	{ action: actions.similarActivityCooking, order: 70 }
];

// Match Monkey submenu for Tools menu
_menuItems.tools.action.submenu.push({
	action: {
		title: _('&Match Monkey...'),
		icon: 'script',
		visible: true,
		submenu: [
			{ action: actions.similarReccoRun, order: 10 },
			{ action: actions.similarTracksRun, order: 20 },
			{ action: actions.similarArtistsRun, order: 30 },
			{ action: actions.similarGenreRun, order: 35 },
			{ separator: true, order: 38 },
			{
				action: {
					title: _('&Mood'),
					icon: 'actor',
					visible: true,
					submenu: moodSubmenuItems
				},
				order: 40
			},
			{
				action: {
					title: _('&Activity'),
					icon: 'mediamonkey',
					visible: true,
					submenu: activitySubmenuItems
				},
				order: 45
			},
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
				{ action: actions.similarReccoRun, order: 10 },
				{ action: actions.similarTracksRun, order: 20 },
				{ action: actions.similarArtistsRun, order: 30 },
				{ action: actions.similarGenreRun, order: 35 },
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