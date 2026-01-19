/*
// actions_add.js
// Put actions under the 'addons' category so they show up consistently.
if (!window.actionCategories.hasOwnProperty('addons')) {
	window.actionCategories.addons = () => _('Addons');
}

window.actions = window.actions || {};
*/
window.actions.SimilarArtistsRun = {
	title: () => _('&Similar Artists'),
	icon: 'script',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: function() {
		window.SimilarArtists?.runSimilarArtists(false);
	}
};

window.actions.SimilarArtistsToggleAuto = {
	title: () => _('Similar Artists: &Auto On/Off'),
	icon: 'script',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	checked: function() {
		// Use the exported helper function if available, otherwise read directly
		if (window.SimilarArtists?.isAutoEnabled) {
			return window.SimilarArtists.isAutoEnabled();
		}
		// Fallback: read the OnPlay setting directly
		try {
			const config = app.getValue('SimilarArtists', {});
			return Boolean(config.OnPlay);
		} catch (e) {
			return false;
		}
	},
	execute: function() {
		window.SimilarArtists?.toggleAuto();
	}
};

window._menuItems.tools.action.submenu.push({
	action: actions.SimilarArtistsRun,
	order: 40,
	grouporder: 10,
});

window._menuItems.tools.action.submenu.push({
	action: actions.SimilarArtistsToggleAuto,
	order: 50,
	grouporder: 10,
});