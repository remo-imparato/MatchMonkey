/**
 * Test script for ReccoBeats API integration
 * 
 * Run this in MediaMonkey 5 console to test the integration:
 * localRequirejs('test/test_reccobeats')
 */

'use strict';

(async function() {
	console.log('=== ReccoBeats Integration Test ===');
	
	// Check if ReccoBeats API module is loaded
	if (!window.matchMonkeyReccoBeatsAPI) {
		console.error('? ReccoBeats API module not loaded!');
		return;
	}
	
	console.log('? ReccoBeats API module loaded');
	
	// Check if discovery strategies include mood/activity
	const strategies = window.matchMonkeyDiscoveryStrategies;
	if (!strategies) {
		console.error('? Discovery strategies module not loaded!');
		return;
	}
	
	console.log('? Discovery strategies loaded');
	
	if (!strategies.discoverByMoodActivity) {
		console.error('? discoverByMoodActivity function not found!');
		return;
	}
	
	console.log('? Mood/Activity discovery strategy available');
	
	// Check discovery modes
	if (!strategies.DISCOVERY_MODES.MOOD || !strategies.DISCOVERY_MODES.ACTIVITY) {
		console.error('? Mood/Activity discovery modes not defined!');
		return;
	}
	
	console.log('? Discovery modes include MOOD and ACTIVITY');
	
	// Check main entry point
	if (!window.matchMonkey) {
		console.error('? MatchMonkey not initialized!');
		return;
	}
	
	if (!window.matchMonkey.runMoodActivityPlaylist) {
		console.error('? runMoodActivityPlaylist function not found!');
		return;
	}
	
	console.log('? Mood/Activity playlist entry point available');
	
	// Test API endpoints (without making actual requests)
	const api = window.matchMonkeyReccoBeatsAPI;
	console.log('? ReccoBeats API endpoints:', Object.keys(api));
	
	console.log('\n=== Integration Test Complete ===');
	console.log('? All checks passed!');
	console.log('\nTo test mood/activity playlists, run:');
	console.log('  window.matchMonkey.runMoodActivityPlaylist("happy", null)');
	console.log('  window.matchMonkey.runMoodActivityPlaylist(null, "workout")');
	
})();
