window.configInfo = {
    load: function (pnlDiv, addon) {
        // helper to get element inside the panel
        const $ = (id) => pnlDiv.querySelector('#' + id);

        // defaults matching similarArtists.js
        const defaults = {
            Toolbar: 1,
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
            Overwrite: 0,
            Enqueue: false,
            Navigate: 0,
            OnPlay: false,
            ClearNP: false,
            Ignore: false,
            Parent: '',
            Black: '',
            Exclude: '',
            Genre: '',
        };

        // helper to read stored value with fallback
        const getSetting = (key) => {
            try {
                const v = app.getValue?.('SimilarArtists', key);
                return (v === undefined || v === null) ? defaults[key] : v;
            } catch (e) {
                return defaults[key];
            }
        };

        // toolbar
        const tb = $('SAToolbar');
        if (tb) tb.selectedIndex = parseInt(getSetting('Toolbar'), 10) || 0;

        // api key (stored via app.settings)
        const api = $('SAApiKey');
        if (api) api.value = app.settings?.getValue?.('SimilarArtists.ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';

        // checkboxes
        const setCheckbox = (id, key) => { const el = $(id); if (el) el.checked = Boolean(getSetting(key)); };
        setCheckbox('SAConfirm', 'Confirm');
        setCheckbox('SASort', 'Sort');
        setCheckbox('SARandom', 'Random');
        setCheckbox('SASeed', 'Seed');
        setCheckbox('SASeed2', 'Seed2');
        setCheckbox('SABest', 'Best');
        setCheckbox('SARank', 'Rank');
        setCheckbox('SAUnknown', 'Unknown');
        setCheckbox('SAOnPlay', 'OnPlay');
        setCheckbox('SAEnqueue', 'Enqueue');
        setCheckbox('SAClearNP', 'ClearNP');
        setCheckbox('SAIgnore', 'Ignore');

        // dropdowns/selects
        const overwrite = $('SAOverwrite'); if (overwrite) overwrite.selectedIndex = parseInt(getSetting('Overwrite'), 10) || 0;
        const rating = $('SARating'); if (rating) rating.selectedIndex = Math.floor((parseInt(getSetting('Rating'), 10) || 0) / 10);
        const nav = $('SANavigate'); if (nav) nav.selectedIndex = parseInt(getSetting('Navigate'), 10) || 0;

        // text inputs
        const name = $('SAName'); if (name) name.value = getSetting('Name') || defaults.Name;
        const black = $('SABlack'); if (black) black.value = getSetting('Black') || '';
        const genre = $('SAGenre'); if (genre) genre.value = getSetting('Genre') || '';
        const exclude = $('SAExclude'); if (exclude) exclude.value = getSetting('Exclude') || '';

        // number inputs
        const limit = $('SALimit'); if (limit) limit.value = parseInt(getSetting('Limit'), 10) || 0;
        const tpa = $('SATPA'); if (tpa) tpa.value = parseInt(getSetting('TPA'), 10) || 0;
        const tpl = $('SATPL'); if (tpl) tpl.value = parseInt(getSetting('TPL'), 10) || 0;

        // Parent playlist: populate options dynamically
        const parentSel = $('SAParent');
        if (parentSel) {
            // clear existing dynamic options (keep first '[Playlists]')
            while (parentSel.options.length > 1) parentSel.remove(1);
            try {
                const pls = app.playlists?.getAll ? app.playlists.getAll() : [];
                if (Array.isArray(pls)) {
                    pls.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
                    pls.forEach(p => {
                        if (p && p.title) {
                            const opt = document.createElement('option');
                            opt.text = p.title;
                            parentSel.add(opt);
                        }
                    });
                }
            } catch (e) {
                // ignore
            }

            // select stored parent
            const storedParent = getSetting('Parent') || '';
            if (!storedParent) parentSel.selectedIndex = 0;
            else {
                let found = false;
                for (let i=0;i<parentSel.options.length;i++){
                    if (parentSel.options[i].text === storedParent) { parentSel.selectedIndex = i; found = true; break; }
                }
                if (!found) parentSel.selectedIndex = 0;
            }
        }
    },

    save: function (pnlDiv, addon) {
        const $ = (id) => pnlDiv.querySelector('#' + id);
        const set = (k, v) => { try { app.setValue?.('SimilarArtists', k, v); } catch (e) {} };

        // toolbar
        const tb = $('SAToolbar'); if (tb) set('Toolbar', parseInt(tb.selectedIndex, 10) || 0);

        // api key
        const api = $('SAApiKey'); if (api) { try { app.settings.setValue('SimilarArtists.ApiKey', api.value || ''); } catch (e) {} }

        // checkboxes
        const saveCheckbox = (id, key) => { const el = $(id); if (el) set(key, Boolean(el.checked)); };
        saveCheckbox('SAConfirm', 'Confirm');
        saveCheckbox('SASort', 'Sort');
        saveCheckbox('SARandom', 'Random');
        saveCheckbox('SASeed', 'Seed');
        saveCheckbox('SASeed2', 'Seed2');
        saveCheckbox('SABest', 'Best');
        saveCheckbox('SARank', 'Rank');
        saveCheckbox('SAUnknown', 'Unknown');
        saveCheckbox('SAOnPlay', 'OnPlay');
        saveCheckbox('SAEnqueue', 'Enqueue');
        saveCheckbox('SAClearNP', 'ClearNP');
        saveCheckbox('SAIgnore', 'Ignore');

        // dropdowns/selects
        const overwrite = $('SAOverwrite'); if (overwrite) set('Overwrite', parseInt(overwrite.selectedIndex, 10) || 0);
        const rating = $('SARating'); if (rating) set('Rating', (parseInt(rating.selectedIndex, 10) || 0) * 10);
        const nav = $('SANavigate'); if (nav) set('Navigate', parseInt(nav.selectedIndex, 10) || 0);

        // text inputs
        const name = $('SAName'); if (name) set('Name', name.value || 'Artists similar to %');
        const black = $('SABlack'); if (black) set('Black', black.value || '');
        const genre = $('SAGenre'); if (genre) set('Genre', genre.value || '');
        const exclude = $('SAExclude'); if (exclude) set('Exclude', exclude.value || '');

        // number inputs
        const limit = $('SALimit'); if (limit) set('Limit', parseInt(limit.value, 10) || 0);
        const tpa = $('SATPA'); if (tpa) set('TPA', parseInt(tpa.value, 10) || 0);
        const tpl = $('SATPL'); if (tpl) set('TPL', parseInt(tpl.value, 10) || 0);

        // parent
        const parentSel = $('SAParent'); if (parentSel) {
            const parentText = parentSel.options[parentSel.selectedIndex]?.text || '';
            set('Parent', parentText === '[Playlists]' ? '' : parentText);
        }

        // After saving try to notify the addon's runtime if available
        try {
            if (window.SimilarArtists && typeof window.SimilarArtists.ensureDefaults === 'function') {
                window.SimilarArtists.ensureDefaults();
            }
        } catch (e) {}
    }
};