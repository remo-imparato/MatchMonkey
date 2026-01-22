/**
 * SimilarArtists MM5 Add-on Initialization
 * 
 * Phase 7: MM5 Integration
 * 
 * Loads the refactored modular entry point (Phases 1-7) and initializes
 * all components when MediaMonkey 5 is ready.
 * 
 * @author Remo Imparato
 * @version 2.0.0
 * @license MIT
 * 
 * Architecture:
 * - Uses modular entry point: similarArtists-MM5Integration.js
 * - Loads all phases (1-6) plus MM5 integration (Phase 7)
 * - Single initialization point
 * - Error-safe with fallbacks
 * 
 * Initialization Sequence:
 * 1. Load refactored modular entry point
 * 2. Wait for MM5 to be ready
 * 3. Call window.SimilarArtists.start()
 * 4. All modules initialized and ready
 */

'use strict';

// ============================================================================
// LOAD REFACTORED MODULAR ENTRY POINT (PHASES 1-7)
// ============================================================================

// Load the MM5-integrated entry point which includes all phases
// This is the refactored modular version with complete architecture
localRequirejs('similarArtists');  // -> window.SimilarArtists

// ============================================================================
// INITIALIZATION
// ============================================================================

(function() {
	'use strict';

	// Initialize when MediaMonkey 5 is ready
	window.whenReady(() => {
		try {
			// Validate that entry point loaded
			if (!window.SimilarArtists) {
				console.error('SimilarArtists: Entry point not loaded');
				return;
			}

			// Validate that start function exists
			if (typeof window.SimilarArtists.start !== 'function') {
				console.error('SimilarArtists: start() function not available');
				return;
			}

			// Initialize the add-on
			// This:
			// 1. Validates MM5 APIs available
			// 2. Registers action handlers
			// 3. Sets up menu items
			// 4. Initializes auto-mode listener
			// 5. Loads all settings
			// 6. Sets up event listeners
			window.SimilarArtists.start();

			// Log successful initialization
			console.log('SimilarArtists: Initialization complete - add-on ready');

		} catch (e) {
			// Log initialization error but don't crash MM5
			console.error(`SimilarArtists: Initialization failed - ${e.toString()}`);
		}
	});

})();

// ============================================================================
// DEBUG TOOLS (OPTIONAL)
// ============================================================================

// Uncomment to enable debugging:
/*
try {
	requirejs('helpers/debugTools');
	if (window.SimilarArtists && typeof registerDebuggerEntryPoint === 'function') {
		registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');
		console.log('SimilarArtists: Debug tools registered');
	}
} catch (e) {
	// Ignore if debug tools not available
}
*/
