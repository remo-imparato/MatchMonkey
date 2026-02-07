/**
 * MatchMonkey Missed Results Dialog
 * 
 * Displays a list of tracks that were recommended but not found in the local library.
 * Supports real-time updates, sorting by all columns, and exporting results.
 * Popularity is shown as a percentage (0-100) normalized from both Last.fm and ReccoBeats.
 * 
 * @author Remo Imparato
 */

'use strict';

requirejs('controls/gridview');
requirejs('helpers/arraydatasource');

const STORAGE_KEY = 'MatchMonkey_MissedResults';

let UI = null;
let dataSource = null;

// Field definitions for GridView with sorting
const fieldDefs = {
	artist: {
		title: 'Artist',
		bindData: (div, item) => {
			div.innerText = item.artist || '';
		},
		columnType: 'artist'
	},
	title: {
		title: 'Title',
		bindData: (div, item) => {
			div.innerText = item.title || '';
		},
		columnType: 'title'
	},
	popularity: {
		title: 'Recommendation %',
		bindData: (div, item) => {
			const popularity = item.popularity || 0;
			div.innerText = popularity > 0 ? `${popularity}%` : '-';
			
			// Add visual indicator based on popularity
			if (popularity >= 80) {
				div.style.color = 'var(--text-success, #28a745)';
				div.style.fontWeight = 'bold';
			} else if (popularity >= 60) {
				div.style.color = 'var(--text-primary, inherit)';
			} else if (popularity > 0) {
				div.style.color = 'var(--text-secondary, #666)';
			}
		},
		columnType: 'popularity'
	},
	occurrences: {
		title: 'Times Seen',
		bindData: (div, item) => {
			const count = item.occurrences || 1;
			div.innerText = count.toString();
			
			// Highlight frequently seen tracks
			if (count >= 5) {
				div.style.fontWeight = 'bold';
				div.style.color = 'var(--text-warning, #ff9800)';
			} else if (count >= 3) {
				div.style.fontWeight = 'bold';
			}
		},
		columnType: 'occurrences'
	},
	source: {
		title: 'Source',
		bindData: (div, item) => {
			const source = item.additionalInfo?.source || 'Unknown';
			div.innerText = source;
			
			// Color code by source
			if (source === 'ReccoBeats') {
				div.style.color = 'var(--text-info, #007bff)';
			} else if (source === 'Last.fm') {
				div.style.color = 'var(--text-danger, #dc3545)';
			}
		},
		columnType: 'source'
	}
};

// Column configuration
const columns = [
	{
		width: 200,
		title: fieldDefs.artist.title,
		bindData: fieldDefs.artist.bindData,
		columnType: 'artist'
	},
	{
		width: 250,
		title: fieldDefs.title.title,
		bindData: fieldDefs.title.bindData,
		columnType: 'title'
	},
	{
		width: 100,
		title: fieldDefs.popularity.title,
		bindData: fieldDefs.popularity.bindData,
		columnType: 'popularity'
	},
	{
		width: 90,
		title: fieldDefs.occurrences.title,
		bindData: fieldDefs.occurrences.bindData,
		columnType: 'occurrences'
	},
	{
		width: 100,
		title: fieldDefs.source.title,
		bindData: fieldDefs.source.bindData,
		columnType: 'source'
	}
];

function init(params) {
	initDialog(params);
}

function initDialog(params) {
	title = 'Missed Recommendations - MatchMonkey';

	UI = getAllUIElements();
	
	// Get all missed results
	const results = app.getValue(STORAGE_KEY, []) || [];

	console.log(`dlgMissedResults: Loaded ${results.length} missed results`);

	// Update statistics
	updateStatistics(results);

	// Create data source with ArrayDataSource for proper sorting
	dataSource = new ArrayDataSource(results);
	
	// Configure grid view
	const gridView = UI.gvMissedResults.controlClass;
	gridView.dataSource = dataSource;
	gridView.multiSelect = true;
	gridView.fieldDefs = fieldDefs;
	gridView.setColumns(columns);

	// Set default sort by popularity (descending) - use string format "column DESC"
	dataSource.setAutoSort('popularity DESC');

	// Button handlers
	window.localListen(UI.btnCopyAll, 'click', () => {
		copyToClipboard(results);
	});

	window.localListen(UI.btnCopySelected, 'click', () => {
		copySelectedToClipboard();
	});

	window.localListen(UI.btnClear, 'click', () => {
		clearAllResults();
	});

	window.localListen(UI.btnClose, 'click', () => {
		closeWindow();
	});

	// Listen for real-time updates
	setupRealtimeUpdates();
	
	console.log('dlgMissedResults: Dialog initialized');
}

/**
 * Setup real-time updates when new missed results are added
 */
function setupRealtimeUpdates() {
	const onResultAdded = () => {
		if (!dataSource) return;
		
		try {
			// Reload data from storage
			const results = app.getValue(STORAGE_KEY, []) || [];
			
			console.log(`dlgMissedResults: Real-time update - reloading ${results.length} results`);
			
			// Update data source - clear and re-add all items
			dataSource.beginUpdate();
			dataSource.clear();
			results.forEach(item => dataSource.add(item));
			dataSource.endUpdate();
			
			// Update statistics
			updateStatistics(results);
		} catch (e) {
			console.error('dlgMissedResults: Error in real-time update:', e);
		}
	};

	const onResultsCleared = () => {
		if (!dataSource) return;
		
		try {
			console.log('dlgMissedResults: Results cleared - updating grid');
			
			// Clear data source
			dataSource.clear();
			
			// Update statistics
			updateStatistics([]);
		} catch (e) {
			console.error('dlgMissedResults: Error clearing results:', e);
		}
	};

	window.addEventListener('matchmonkey:missedresultadded', onResultAdded);
	window.addEventListener('matchmonkey:missedresultscleared', onResultsCleared);
	
	// Cleanup on close
	window.localListen(window, 'unload', () => {
		window.removeEventListener('matchmonkey:missedresultadded', onResultAdded);
		window.removeEventListener('matchmonkey:missedresultscleared', onResultsCleared);
	});
}

/**
 * Update statistics display
 */
function updateStatistics(results) {
	if (!UI) return;
	
	try {
		const stats = {
			total: results.length,
			uniqueArtists: new Set(results.map(r => r.artist)).size,
			totalOccurrences: results.reduce((sum, r) => sum + (r.occurrences || 1), 0),
			avgPopularity: results.length > 0 
				? Math.round(results.reduce((sum, r) => sum + (r.popularity || 0), 0) / results.length)
				: 0
		};

		UI.totalCount.innerText = stats.total.toString();
		UI.uniqueArtistsCount.innerText = stats.uniqueArtists.toString();
		UI.totalOccurrencesCount.innerText = stats.totalOccurrences.toString();
		UI.avgPopularity.innerText = `${stats.avgPopularity}%`;
	} catch (e) {
		console.error('dlgMissedResults: Error updating statistics:', e);
	}
}

/**
 * Copy all results to clipboard
 */
function copyToClipboard(results) {
	if (!results || results.length === 0) {
		console.log('dlgMissedResults: No results to copy');
		return;
	}

	// Build tab-separated text
	let text = 'Artist\tTitle\tPopularity %\tTimes Seen\tSource\n';

	results.forEach(result => {
		const popularity = result.popularity || 0;
		const occurrences = result.occurrences || 1;
		const source = result.additionalInfo?.source || 'Unknown';
		const pop = popularity > 0 ? `${popularity}%` : '-';
		
		text += `${result.artist || ''}\t${result.title || ''}\t${pop}\t${occurrences}\t${source}\n`;
	});

	copyTextToClipboard(text, results.length);
}

/**
 * Copy selected results to clipboard
 */
function copySelectedToClipboard() {
	try {
		const gridView = UI?.gvMissedResults?.controlClass;
		if (!gridView || !dataSource) {
			console.log('dlgMissedResults: Grid view not available');
			return;
		}

		const selectedResults = [];
		const selectedList = dataSource.getSelectedList();

		if (!selectedList || selectedList.count === 0) {
			console.log('dlgMissedResults: No items selected');
			return;
		}

		window.localPromise(selectedList.whenLoaded()).then(() => {
			selectedList.locked(() => {
				for (let i = 0; i < selectedList.count; i++) {
					const item = selectedList.getValue(i);
					if (item) {
						selectedResults.push(item);
					}
				}
			});

			if (selectedResults.length > 0) {
				copyToClipboard(selectedResults);
			}
		});
	} catch (e) {
		console.error('dlgMissedResults: Error copying selected:', e);
	}
}

/**
 * Clear all results
 */
function clearAllResults() {
	try {
		console.log('dlgMissedResults: Clearing all results');
		
		// Clear storage
		app.setValue(STORAGE_KEY, []);
		
		// Clear data source
		if (dataSource) {
			dataSource.clear();
		}
		
		// Update statistics
		updateStatistics([]);
		
		// Dispatch event for other listeners
		try {
			const event = new CustomEvent('matchmonkey:missedresultscleared');
			window.dispatchEvent(event);
		} catch (e) {
			console.error('dlgMissedResults: Error dispatching clear event:', e);
		}
	} catch (e) {
		console.error('dlgMissedResults: Error clearing results:', e);
	}
}

/**
 * Copy text to clipboard (helper function)
 */
function copyTextToClipboard(text, count) {
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(() => {
				console.log(`dlgMissedResults: Copied ${count} track(s) to clipboard`);
			}).catch(err => {
				console.error('dlgMissedResults: Failed to copy to clipboard:', err);
			});
		} else {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();

			try {
				document.execCommand('copy');
				console.log(`dlgMissedResults: Copied ${count} track(s) to clipboard (fallback)`);
			} catch (err) {
				console.error('dlgMissedResults: Failed to copy to clipboard (fallback):', err);
			}

			document.body.removeChild(textarea);
		}
	} catch (err) {
		console.error('dlgMissedResults: Failed to copy to clipboard:', err);
	}
}
