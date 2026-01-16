// init.js
// Load your local module(s) first
localRequirejs('similarArtists'); // -> window.SimilarArtists
//requirejs('actions');

(function () {

	window.whenReady(() => {

		// Initialize defaults
		window.SimilarArtists?.ensureDefaults?.();
		window.SimilarArtists?.start();
	});
})();
