window.configInfo = {

	load: function (pnlDiv, addon) {
		requirejs('helpers/debugTools');
		registerDebuggerEntryPoint.call(this, 'start');

		// defaults matching similarArtists.js
		const defaults = {
			ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932' || '6cfe51c9bf7e77d6449e63ac0db2ac24',
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
			Parent: '',
			Black: '',
			Exclude: '',
			Genre: '',
		};

		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnlDiv);
		//UI.SAToolbar.controlClass.value = this.config.Toolbar;
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
		UI.SAParent.controlClass.value = this.config.Parent;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SAGenre.controlClass.value = this.config.Genre;

		/*

		// Parent playlist: populate options dynamically
		// Prefer DOM select if present; fallback to framework control if it exposes items or setItems
		const $dom = (id) => pnlDiv.querySelector('#' + id) || pnlDiv.querySelector('[data-id="' + id + '"]');
		const parentEl = $dom('SAParent');
		const storedParent = getSetting('Parent') || '';
		try {
			// try to populate a native <select>
			let sel = null;
			if (parentEl) {
				if (parentEl.tagName === 'SELECT') sel = parentEl;
				else sel = parentEl.querySelector('select');
			}
			if (sel) {
				// clear existing dynamic options (keep first '[Playlists]' if present)
				while (sel.options.length > 1) sel.remove(1);
				const pls = app.playlists?.getAll ? app.playlists.getAll() : [];
				if (Array.isArray(pls)) {
					pls.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
					pls.forEach(p => { if (p && p.title) { const opt = document.createElement('option'); opt.text = p.title; sel.add(opt); } });
				}
				// select stored parent
				if (!storedParent) sel.selectedIndex = 0;
				else {
					let found = false;
					for (let i = 0; i < sel.options.length; i++) {
						if (sel.options[i].text === storedParent) { sel.selectedIndex = i; found = true; break; }
					}
					if (!found) sel.selectedIndex = 0;
				}
			} else if (UI && UI['SAParent'] && UI['SAParent'].controlClass) {
				// some frameworks expose setItems or items array - try to set items
				const ctrl = UI['SAParent'].controlClass;
				if (typeof ctrl.setItems === 'function') {
					const pls = app.playlists?.getAll ? app.playlists.getAll() : [];
					const items = ['[Playlists]'].concat((Array.isArray(pls) ? pls.map(p => p.title).filter(t => t) : []));
					ctrl.setItems(items);
					// set selection
					const idx = items.indexOf(storedParent);
					ctrl.selectedIndex = (idx >= 0) ? idx : 0;
				}
			}
		} catch (e) {
			log('initSettingsPanel error: ' + e.toString());
		}
		//*/

	},

	save: function (pnlDiv, addon) {
		var UI = getAllUIElements(pnlDiv);

		//this.config.Toolbar = UI.SAToolbar.controlClass.value;
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
		this.config.Parent = UI.SAParent.controlClass.value;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		app.setValue('SimilarArtists', this.config);

		/*
		const setValue = (k, v) => { try { app.setValue?.('SimilarArtists', k, v); } catch (e) { } };

		const read = (id) => {
			if (UI && UI[id] && UI[id].controlClass) {
				const ctrl = UI[id].controlClass;
				if (typeof ctrl.selectedIndex !== 'undefined') return ctrl.selectedIndex;
				if (typeof ctrl.checked !== 'undefined') return ctrl.checked;
				if (typeof ctrl.value !== 'undefined') return ctrl.value;
				if (typeof ctrl.text !== 'undefined') return ctrl.text;
			}
			const el = $dom(id);
			if (!el) return null;
			if (el.tagName === 'SELECT') return el.selectedIndex;
			if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
				if (el.type === 'checkbox') return el.checked;
				return el.value;
			}
			const innerSelect = el.querySelector('select'); if (innerSelect) return innerSelect.selectedIndex;
			const innerInput = el.querySelector('input, textarea'); if (innerInput) return (innerInput.type === 'checkbox') ? innerInput.checked : innerInput.value;
			return null;
		};

		// toolbar
		const tb = read('SAToolbar'); if (tb !== null) setValue('Toolbar', parseInt(tb, 10) || 0);

		// api key
		const api = read('SAApiKey'); if (api !== null) { try { app.settings.setValue('SimilarArtists.ApiKey', api || ''); } catch (e) { } }

		// checkboxes
		const saveCheckbox = (id, key) => { const v = read(id); if (v !== null) setValue(key, Boolean(v)); };
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
		const overwrite = read('SAOverwrite'); if (overwrite !== null) setValue('Overwrite', parseInt(overwrite, 10) || 0);
		const rating = read('SARating'); if (rating !== null) setValue('Rating', (parseInt(rating, 10) || 0) * 10);
		const nav = read('SANavigate'); if (nav !== null) setValue('Navigate', parseInt(nav, 10) || 0);

		// text inputs
		const name = read('SAName'); if (name !== null) setValue('Name', name || 'Artists similar to %');
		const black = read('SABlack'); if (black !== null) setValue('Black', black || '');
		const genre = read('SAGenre'); if (genre !== null) setValue('Genre', genre || '');
		const exclude = read('SAExclude'); if (exclude !== null) setValue('Exclude', exclude || '');

		// number inputs
		const limit = read('SALimit'); if (limit !== null) setValue('Limit', parseInt(limit, 10) || 0);
		const tpa = read('SATPA'); if (tpa !== null) setValue('TPA', parseInt(tpa, 10) || 0);
		const tpl = read('SATPL'); if (tpl !== null) setValue('TPL', parseInt(tpl, 10) || 0);

		// parent
		let parentStored = '';
		// read from select if present
		const $dom = (id) => pnlDiv.querySelector('#' + id) || pnlDiv.querySelector('[data-id="' + id + '"]');
		const parentEl = $dom('SAParent');
		if (parentEl) {
			let sel = null;
			if (parentEl.tagName === 'SELECT') sel = parentEl;
			else sel = parentEl.querySelector('select');
			if (sel) parentStored = sel.options[sel.selectedIndex]?.text || '';
		}
		// try framework control
		if (!parentStored && UI && UI['SAParent'] && UI['SAParent'].controlClass) {
			const ctrl = UI['SAParent'].controlClass;
			if (typeof ctrl.selectedIndex !== 'undefined' && Array.isArray(ctrl.items)) {
				parentStored = ctrl.items[ctrl.selectedIndex] || '';
			}
		}
		try { setValue('Parent', parentStored === '[Playlists]' ? '' : parentStored); } catch (e) { }

		// After saving try to notify the addon's runtime if available
		try {
			if (window.SimilarArtists && typeof window.SimilarArtists.ensureDefaults === 'function') {
				window.SimilarArtists.ensureDefaults();
			}
		} catch (e) { }
		//*/
	}
};