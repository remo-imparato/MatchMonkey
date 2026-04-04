/**
 * MatchMonkey Logging Utility
 * 
 * Provides centralized logging with verbosity control to prevent performance
 * issues from excessive console output during large discovery runs.
 * 
 * Logging Levels:
 * - error(): Always logged - errors and exceptions
 * - warn(): Always logged - warnings and non-critical issues
 * - log(): Always logged - key user-facing messages and final summaries
 * - info(): Only logged in debug mode - workflow events and phase details
 * - debug(): Only logged in debug mode - detailed tracking
 * - summary(): Only logged in debug mode - batch operation summaries with optional detail lines
 * 
 * Enable debug mode by setting: window.matchMonkeyDebugMode = true
 * 
 * @author Remo Imparato
 */

'use strict';

const LOG_PREFIX = 'Match Monkey';

/**
 * Check if debug mode is enabled
 * Can be toggled at runtime via: window.matchMonkeyDebugMode = true/false
 */
function isDebugMode() {
	return Boolean(window.matchMonkeyDebugMode);
}

/**
 * Logging utility with verbosity control
 */
const logger = {
	/**
	 * Always logged - use for errors and exceptions
	 */
	error: function (context, message, ...args) {
		if (args.length > 0) {
			console.error(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.error(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Always logged - use for warnings and non-critical issues
	 */
	warn: function (context, message, ...args) {
		if (args.length > 0) {
			console.warn(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.warn(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Always logged - use for key user-facing messages and final summaries
	 * Examples: run complete summary, important state changes
	 */
	log: function (context, message, ...args) {
		if (args.length > 0) {
			console.log(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.log(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Only logged in debug mode - use for workflow events and phase details
	 * Examples: workflow start/end, API responses, phase completions
	 */
	info: function (context, message, ...args) {
		if (isDebugMode()) {
			if (args.length > 0) {
				console.info(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
			} else {
				console.info(`${LOG_PREFIX} [${context}]: ${message}`);
			}
		}
	},

	/**
	 * Only logged in debug mode - use for detailed tracking
	 * Examples: individual track matches, filtering decisions, loop iterations
	 */
	debug: function (context, message, ...args) {
		if (isDebugMode()) {
			if (args.length > 0) {
				console.debug(`${LOG_PREFIX} [${context}] [DEBUG]: ${message}`, ...args);
			} else {
				console.debug(`${LOG_PREFIX} [${context}] [DEBUG]: ${message}`);
			}
		}
	},

	/**
	 * Only logged in debug mode - summary logger for batch operations
	 * Logs summary line and optionally logs individual detail items
	 * 
	 * @param {string} context - Module/function context
	 * @param {string} operation - What operation completed
	 * @param {object} stats - Statistics object with counts
	 * @param {Array} [details] - Optional array of detail strings
	 */
	summary: function (context, operation, stats, details = null) {
		if (!isDebugMode()) return;

		// Build stats string
		const statsParts = Object.entries(stats)
			.filter(([k, v]) => v !== undefined && v !== null)
			.map(([k, v]) => `${k}=${v}`);

		console.info(`${LOG_PREFIX} [${context}]: ${operation} - ${statsParts.join(', ')}`);

		// Log individual details if provided
		if (details && Array.isArray(details) && details.length > 0) {
			const maxDetails = 20;
			const showing = Math.min(details.length, maxDetails);
			details.slice(0, showing).forEach(d => {
				console.debug(`${LOG_PREFIX} [${context}] [DEBUG]:   - ${d}`);
			});
			if (details.length > maxDetails) {
				console.debug(`${LOG_PREFIX} [${context}] [DEBUG]:   ... and ${details.length - maxDetails} more`);
			}
		}
	},

	/**
	 * Track filtered items for debugging
	 * Collects items during processing, logs summary at end
	 */
	createFilterTracker: function (context, filterType) {
		const items = [];
		return {
			/**
			 * Track a filtered item (only stored in debug mode)
			 */
			add: function (description) {
				if (isDebugMode()) {
					items.push(description);
				}
			},
			/**
			 * Get count of tracked items
			 */
			count: function () {
				return items.length;
			},
			/**
			 * Log summary of filtered items
			 */
			flush: function (totalProcessed) {
				if (items.length > 0) {
					logger.summary(context, `${filterType} filtering complete`, {
						filtered: items.length,
						total: totalProcessed,
						passed: totalProcessed - items.length
					}, items);
				}
			}
		};
	}
};

// Export to window namespace
window.matchMonkeyLogger = logger;
// ============================================================================
// DEBUGGING TOOLS (SET TO TRUE TO ENABLE)
// ============================================================================
window.matchMonkeyDebugMode = false; // Default: verbose logging disabled

