// init.js
// Load your local module(s) first
localRequirejs('similarArtists'); // -> window.SimilarArtists
//requirejs('actions');
requirejs('helpers/debugTools');
registerDebuggerEntryPoint.call(this, 'start');

(function () {


	window.whenReady(() => {

		// Initialize defaults
		//window.SimilarArtists?.ensureDefaults?.();
		window.SimilarArtists?.start();
	});
})();
