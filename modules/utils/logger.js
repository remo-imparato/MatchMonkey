/**
 * MatchMonkey Logging Utility
 * 
 * Provides centralized logging with verbosity control to prevent performance
 * issues from excessive console output during large discovery runs.
 * 
 * Logging Levels:
 * - error(): Always logged - errors and exceptions
 * - warn(): Always logged - warnings and non-critical issues
 * - info(): Always logged - high-level workflow events and summaries
 * - debug(): Only logged when DEBUG_MODE = true - detailed tracking
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
	error: function(context, message, ...args) {
		if (args.length > 0) {
			console.error(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.error(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Always logged - use for warnings and non-critical issues
	 */
	warn: function(context, message, ...args) {
		if (args.length > 0) {
			console.warn(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.warn(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Always logged - use for high-level workflow events and summaries
	 * Examples: workflow start/end, API responses, phase completions
	 */
	info: function(context, message, ...args) {
		if (args.length > 0) {
			console.log(`${LOG_PREFIX} [${context}]: ${message}`, ...args);
		} else {
			console.log(`${LOG_PREFIX} [${context}]: ${message}`);
		}
	},

	/**
	 * Only logged in debug mode - use for detailed tracking
	 * Examples: individual track matches, filtering decisions, loop iterations
	 */
	debug: function(context, message, ...args) {
		if (isDebugMode()) {
			if (args.length > 0) {
				console.log(`${LOG_PREFIX} [${context}] [DEBUG]: ${message}`, ...args);
			} else {
				console.log(`${LOG_PREFIX} [${context}] [DEBUG]: ${message}`);
			}
		}
	},

	/**
	 * Summary logger for batch operations
	 * Always logs summary, optionally logs individual items in debug mode
	 * 
	 * @param {string} context - Module/function context
	 * @param {string} operation - What operation completed
	 * @param {object} stats - Statistics object with counts
	 * @param {Array} [details] - Optional array of detail strings for debug mode
	 */
	summary: function(context, operation, stats, details = null) {
		// Build stats string
		const statsParts = Object.entries(stats)
			.filter(([k, v]) => v !== undefined && v !== null)
			.map(([k, v]) => `${k}=${v}`);

		console.log(`${LOG_PREFIX} [${context}]: ${operation} - ${statsParts.join(', ')}`);

		// In debug mode, log individual details if provided
		if (isDebugMode() && details && Array.isArray(details) && details.length > 0) {
			const maxDetails = 20; // Limit to prevent overwhelming output
			const showing = Math.min(details.length, maxDetails);
			details.slice(0, showing).forEach(d => {
				console.log(`${LOG_PREFIX} [${context}] [DEBUG]:   - ${d}`);
			});
			if (details.length > maxDetails) {
				console.log(`${LOG_PREFIX} [${context}] [DEBUG]:   ... and ${details.length - maxDetails} more`);
			}
		}
	},

	/**
	 * Track filtered items for debugging
	 * Collects items during processing, logs summary at end
	 */
	createFilterTracker: function(context, filterType) {
		const items = [];
		return {
			/**
			 * Track a filtered item (only stored in debug mode)
			 */
			add: function(description) {
				if (isDebugMode()) {
					items.push(description);
				}
			},
			/**
			 * Get count of tracked items
			 */
			count: function() {
				return items.length;
			},
			/**
			 * Log summary of filtered items
			 */
			flush: function(totalProcessed) {
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
window.matchMonkeyDebugMode = true; // Default: verbose logging disabled

