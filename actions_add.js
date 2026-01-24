/**
 * SimilarArtists Action Registration
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
 * Run Similar Artists action
 */
actions.SimilarArtistsRun = {
	title: _('Similar &Artists'),
	icon: 'artist',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function() {
		if (window.SimilarArtists && window.SimilarArtists.runSimilarArtists) {
			window.SimilarArtists.runSimilarArtists(false, 'artist');
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

/**
 * Run Similar Tracks action
 */
actions.SimilarTracksRun = {
	title: _('Similar &Tracks'),
	icon: 'track',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function() {
		if (window.SimilarArtists && window.SimilarArtists.runSimilarArtists) {
			window.SimilarArtists.runSimilarArtists(false, 'track');
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

/**
 * Run Similar Genre action
 */
actions.SimilarGenreRun = {
	title: _('Similar &Genre'),
	icon: 'genre',
	hotkeyAble: true,
	visible: true,
	disabled: uitools.notMediaListSelected,
	execute: function() {
		if (window.SimilarArtists && window.SimilarArtists.runSimilarArtists) {
			window.SimilarArtists.runSimilarArtists(false, 'genre');
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

/**
 * Toggle Auto-Mode action
 */
actions.SimilarArtistsToggleAuto = {
	title: _('Similar Artists: &Auto On/Off'),
	icon: 'script',
	checkable: true,
	hotkeyAble: true,
	visible: true,
	disabled: false,
	
	checked: function() {
		try {
			return Boolean(window.SimilarArtists && window.SimilarArtists.isAutoEnabled && window.SimilarArtists.isAutoEnabled());
		} catch (e) {
			return false;
		}
	},
	
	execute: function() {
		if (window.SimilarArtists && window.SimilarArtists.toggleAuto) {
			window.SimilarArtists.toggleAuto();
		} else {
			console.error('SimilarArtists: Add-on not loaded');
		}
	}
};

// ============================================================================
// TOOLS MENU REGISTRATION - Using Submenu
// ============================================================================

// Similar Artists submenu for Tools menu
_menuItems.tools.action.submenu.push({
	action: {
		title: _('&Similar...'),
		icon: 'script',
		visible: true,
		submenu: [
			{ action: actions.SimilarArtistsRun, order: 10 },
			{ action: actions.SimilarTracksRun, order: 20 },
			{ action: actions.SimilarGenreRun, order: 30 },
			{ separator: true, order: 40 },
			{ action: actions.SimilarArtistsToggleAuto, order: 50 }
		]
	},
	order: 40,
	grouporder: 10
});

// ============================================================================
// CONTEXT MENU REGISTRATION (Right-click on tracks)
// ============================================================================

// Define the context submenu action
var similarContextSubmenu = {
	title: _('&Similar...'),
	icon: 'script',
	visible: true,
	disabled: uitools.notMediaListSelected,
	submenu: [
		{ action: actions.SimilarArtistsRun, order: 10 },
		{ action: actions.SimilarTracksRun, order: 20 },
		{ action: actions.SimilarGenreRun, order: 30 }
	]
};

// Add to track context menu (songsSelected)
if (_menuItems.songsSelected && _menuItems.songsSelected.action && _menuItems.songsSelected.action.submenu) {
	_menuItems.songsSelected.action.submenu.push({
		action: similarContextSubmenu,
		order: 100,
		grouporder: 20
	});
}

// Add to album context menu
if (_menuItems.albumsSelected && _menuItems.albumsSelected.action && _menuItems.albumsSelected.action.submenu) {
	_menuItems.albumsSelected.action.submenu.push({
		action: similarContextSubmenu,
		order: 100,
		grouporder: 20
	});
}

// Add to artist context menu
if (_menuItems.artistsSelected && _menuItems.artistsSelected.action && _menuItems.artistsSelected.action.submenu) {
	_menuItems.artistsSelected.action.submenu.push({
		action: similarContextSubmenu,
		order: 100,
		grouporder: 20
	});
}

// Add to Now Playing context menu
if (_menuItems.nowplayingSelected && _menuItems.nowplayingSelected.action && _menuItems.nowplayingSelected.action.submenu) {
	_menuItems.nowplayingSelected.action.submenu.push({
		action: similarContextSubmenu,
		order: 100,
		grouporder: 20
	});
}