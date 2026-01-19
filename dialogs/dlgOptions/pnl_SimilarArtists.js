/**
 * SimilarArtists Options Panel for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @description Configuration panel for SimilarArtists add-on in MM5 Tools > Options
 */

// Helper get/set that use the SimilarArtists namespace
function setSetting(key, value) {
    try {
        app.setValue?.('SimilarArtists', key, value);
    } catch (e) {
        // fallback
        try { app.setValue && app.setValue(key, value); } catch (e) {}
    }
}

function getSetting(key, defaultValue) {
    try {
        const v = app.getValue?.('SimilarArtists', key);
        return (v === undefined || v === null) ? defaultValue : v;
    } catch (e) {
        try { return app.getValue ? app.getValue(key, defaultValue) : defaultValue; } catch (e) { return defaultValue; }
    }
}

function intSetting(key) {
    const v = getSetting(key, defaults[key]);
    return parseInt(v, 10) || 0;
}

function boolSetting(key) {
    const v = getSetting(key, defaults[key]);
    return Boolean(v);
}

function stringSetting(key) {
    const v = getSetting(key, defaults[key]);
    return v == null ? '' : String(v);
}

// Defaults matching similarArtists.js
const defaults = {
	ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932',
	Confirm: true,
	Sort: false,
	Limit: 5,
	Name: 'Artists similar to %',
	TPA: 9999,
	TPL: 9999,
	Random: false,
	Seed: false,
	Seed2: false,
	Best: false,
	Rank: false,
	Rating: 0,
	Unknown: true,
	Overwrite: 'Create new playlist',
	Enqueue: false,
	Navigate: 'None',
	OnPlay: false,
	ClearNP: false,
	Ignore: false,
	Parent: 'Similar Artists Playlists',
	Black: '',
	Exclude: '',
	Genre: '',
};

function log(txt) {
    try { console.log('SimilarArtists Options: ' + txt); } catch (e) {}
}

/**
 * Recursively collect all manual (non-auto) playlists from the playlist tree.
 * @param {object} node Playlist node to process
 * @param {string[]} results Array to collect playlist names
 * @param {string} prefix Path prefix for nested playlists (optional)
 */
function collectManualPlaylists(node, results, prefix = '') {
    if (!node) return;

    try {
        // Get child playlists - try different MM5 API patterns
        let children = node.childPlaylists || node.playlists || node.children;
        
        // If it's a function, call it
        if (typeof children === 'function') {
            children = children();
        }

        // If children is not iterable, try to get count and iterate
        if (children && typeof children.count !== 'undefined') {
            const count = typeof children.count === 'function' ? children.count() : children.count;
            for (let i = 0; i < count; i++) {
                const child = typeof children.getValue === 'function' 
                    ? children.getValue(i) 
                    : (children[i] || children.getItem?.(i));
                
                if (child) {
                    processPlaylistNode(child, results, prefix);
                }
            }
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (child) {
                    processPlaylistNode(child, results, prefix);
                }
            });
        } else if (children && typeof children.forEach === 'function') {
            children.forEach(child => {
                if (child) {
                    processPlaylistNode(child, results, prefix);
                }
            });
        }
    } catch (e) {
        log('Error collecting playlists: ' + e.toString());
    }
}

/**
 * Process a single playlist node - add if manual, recurse for children
 * @param {object} playlist Playlist object
 * @param {string[]} results Array to collect playlist names
 * @param {string} prefix Path prefix for nested playlists
 */
function processPlaylistNode(playlist, results, prefix) {
    if (!playlist) return;

    try {
        const name = playlist.title || playlist.name;
        if (!name) return;

        // Check if this is a manual playlist (not auto-playlist)
        // Auto playlists typically have isAutoPlaylist=true or isAuto=true or have a query/criteria
        const isAuto = playlist.isAutoPlaylist || playlist.isAuto || 
                       (playlist.query && playlist.query.length > 0) ||
                       (playlist.criteria && playlist.criteria.length > 0);

        if (!isAuto) {
            // This is a manual playlist - add it
            const fullName = prefix ? `${prefix}/${name}` : name;
            results.push(fullName);
            log(`Found manual playlist: "${fullName}"`);
        }

        // Recurse into child playlists (even auto-playlists can have children)
        const newPrefix = prefix ? `${prefix}/${name}` : name;
        collectManualPlaylists(playlist, results, newPrefix);

    } catch (e) {
        log('Error processing playlist node: ' + e.toString());
    }
}

/**
 * Populate parent playlist dropdown with available manual playlists
 * @param {HTMLElement} pnl - The panel element
 * @param {string} storedParent - The currently stored parent playlist name
 */
function populateParentPlaylist(pnl, storedParent) {
    try {
        const parentCtrl = getAllUIElements(pnl)?.SAParent?.controlClass;
        if (!parentCtrl) {
            log('populateParentPlaylist: SAParent control not found');
            return;
        }

        // Helper function to get all manual playlists using recursive traversal
        const getPlaylistsList = () => {
            const allPlaylists = [];
            
            log('Starting playlist enumeration...');

            // Use app.playlists.root as the starting point (MM5 standard)
            if (app.playlists?.root) {
                log('Using app.playlists.root');
                collectManualPlaylists(app.playlists.root, allPlaylists, '');
            } else {
                log('app.playlists.root not available');
            }

            log(`Found ${allPlaylists.length} manual playlist(s)`);
            return allPlaylists;
        };

        // Helper function to populate dropdown
        const populateDropdown = (playlists) => {
            try {
                playlists.sort((a, b) => a.localeCompare(b));
                const items = ['[None]'].concat(playlists);

                // Create StringList dataSource (MM5 standard pattern)
                const stringListFactory = app.utils?.newStringList || window.newStringList;
                if (typeof stringListFactory === 'function') {
                    const stringList = stringListFactory();
                    items.forEach(item => stringList.add(item));
                    
                    // Set dataSource
                    parentCtrl.dataSource = stringList;
                    log('Set dataSource with ' + items.length + ' items');

                    // Set focused index to match stored parent
                    const defaultParent = storedParent || 'Similar Artists Playlists';
                    let selectedIndex = 0;

                    const foundIndex = items.indexOf(defaultParent);
                    if (foundIndex >= 0) {
                        selectedIndex = foundIndex;
                    }

                    parentCtrl.focusedIndex = selectedIndex;
                    log(`Set focusedIndex to ${selectedIndex} (${items[selectedIndex]})`);
                } else {
                    log('newStringList() not available');
                }
            } catch (e) {
                log('Error populating dropdown: ' + e.toString());
            }
        };

        // Attempt to populate immediately
        let playlists = getPlaylistsList();
        
        if (playlists.length > 0) {
            // Got playlists immediately
            populateDropdown(playlists);
        } else {
            // No playlists yet, try again after a short delay (playlists may not be loaded yet)
            log('No playlists found immediately, retrying in 1s...');
            setTimeout(() => {
                playlists = getPlaylistsList();
                populateDropdown(playlists);
            }, 1000);
        }

    } catch (e) {
        log('populateParentPlaylist error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = function (sett, pnl, wndParams) {
    try {
		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnl);
		UI.SAApiKey.controlClass.value = this.config.ApiKey;
		UI.SAConfirm.controlClass.checked = this.config.Confirm;
		UI.SASort.controlClass.checked = this.config.Sort;
		UI.SALimit.controlClass.value = this.config.Limit;
		UI.SAName.controlClass.value = this.config.Name;
		UI.SATPA.controlClass.value = this.config.TPA;
		UI.SATPL.controlClass.value = this.config.TPL;
		UI.SARandom.controlClass.checked = this.config.Random;
		UI.SASeed.controlClass.checked = this.config.Seed;
		UI.SASeed2.controlClass.checked = this.config.Seed2;
		UI.SABest.controlClass.checked = this.config.Best;
		UI.SARank.controlClass.checked = this.config.Rank;
		UI.SARating.controlClass.value = this.config.Rating;
		UI.SAUnknown.controlClass.checked = this.config.Unknown;
		UI.SAOverwrite.controlClass.value = this.config.Overwrite;
		UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
		UI.SANavigate.controlClass.value = this.config.Navigate;
		UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
		UI.SAClearNP.controlClass.checked = this.config.ClearNP;
		UI.SAIgnore.controlClass.checked = this.config.Ignore;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SAGenre.controlClass.value = this.config.Genre;

		// Populate parent playlist dropdown with available manual playlists
		// Default to 'Similar Artists Playlists' if not yet set
		populateParentPlaylist(pnl, this.config.Parent || 'Similar Artists Playlists');

    } catch (e) {
        log('load error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
    try {
		var UI = getAllUIElements();

		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.Sort = UI.SASort.controlClass.checked;
		this.config.Limit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Seed2 = UI.SASeed2.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Rating = UI.SARating.controlClass.value;
		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;
		this.config.OnPlay = UI.SAOnPlay.controlClass.checked;
		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		// Get selected parent playlist using MM5 pattern (focusedIndex + dataSource)
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl && parentCtrl.dataSource && typeof parentCtrl.focusedIndex !== 'undefined') {
				const ds = parentCtrl.dataSource;
				const idx = parentCtrl.focusedIndex;
				
				// Get the selected item from dataSource
				if (idx >= 0 && idx < ds.count) {
					const selectedItem = ds.getValue(idx);
					const selectedValue = selectedItem ? selectedItem.toString() : '';
					
					// Store empty string if [None] is selected, otherwise store the playlist name
					this.config.Parent = (selectedValue === '[None]') ? '' : selectedValue;
					log(`save: Parent playlist = "${this.config.Parent}" (index ${idx})`);
				} else {
					this.config.Parent = '';
					log('save: No valid selection, Parent = ""');
				}
			} else {
				// Fallback if dataSource not available
				this.config.Parent = '';
				log('save: dataSource not available, Parent = ""');
			}
		} catch (e) {
			log('save: Error reading Parent playlist: ' + e.toString());
			this.config.Parent = '';
		}

		app.setValue('SimilarArtists', this.config);

    } catch (e) {
        log('save error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.beforeWindowCleanup = function () {
	// Cleanup if needed
}