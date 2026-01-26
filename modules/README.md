# MatchMonkey Module Architecture

This directory contains refactored, modular components for the MatchMonkey MediaMonkey 5 add-on.

## Directory Structure

```
modules/
??? config.js                    # Core configuration constants
??? utils/
?   ??? normalization.js        # String normalization (artist names, titles)
?   ??? helpers.js              # General utilities (shuffle, parse, format)
?   ??? sql.js                  # SQL building and escaping utilities
??? settings/
?   ??? storage.js              # Settings get/set with type coercion
?   ??? prefixes.js             # Artist name prefix handling ("The" ignore)
?   ??? lastfm.js               # Last.fm API key retrieval
??? ui/
?   ??? notifications.js        # Toast messages and progress display
??? api/
?   ??? cache.js                # API response caching (per-session)
?   ??? lastfm.js               # Last.fm API queries
?   ??? reccobeats.js           # ReccoBeats API integration (mood/activity)
??? db/
?   ??? library.js              # Library track searching (single & batch)
?   ??? playlist.js             # Playlist creation and management
?   ??? queue.js                # Track enqueueing (Now Playing & playlists)
?   ??? index.js                # Database module exports
??? core/
    ??? discoveryStrategies.js  # Discovery algorithms (artist/track/genre/mood)
    ??? orchestration.js        # Main workflow orchestration
    ??? autoMode.js             # Auto-queue functionality
    ??? mm5Integration.js       # MediaMonkey 5 UI integration
```

## Module Dependencies

```
config
  ?
  ??? ui/notifications
  ??? settings/storage ?? utils/helpers
  ??? settings/prefixes
  ??? settings/lastfm
  ??? utils/normalization
  ??? utils/helpers
  ??? utils/sql ?? utils/helpers
  ??? api/cache ?? utils/normalization
  ??? api/lastfm ?? api/cache
  ??? api/reccobeats ?? api/cache, api/lastfm
  ??? db/library ?? utils/sql, settings/prefixes
  ??? db/playlist ?? ui/notifications
  ??? db/queue ?? ui/notifications
  ??? core/discoveryStrategies ?? api/lastfm, api/reccobeats
      ??? core/orchestration ?? all modules
```

## Usage Examples

### Configuration
```javascript
const config = window.matchMonkeyConfig;
console.log(config.SCRIPT_ID);        // 'MatchMonkey'
console.log(config.API_BASE);         // 'https://ws.audioscrobbler.com/2.0/'
```

### Utilities
```javascript
// Normalization
window.stripName('The Beatles');           // 'THEBEATLES'
window.splitArtists('Artist1;Artist2');    // ['Artist1', 'Artist2']

// Helpers
window.matchMonkeyHelpers.shuffle(array);
window.matchMonkeyHelpers.formatError(error);
window.matchMonkeyHelpers.parseListSetting('a,b,c');  // ['a', 'b', 'c']

// SQL
window.matchMonkeySQL.escapeSql("O'Reilly");  // "O''Reilly"
```

### Settings
```javascript
const storage = window.matchMonkeyStorage;

// Get/set settings
storage.setSetting('AutoModeEnabled', true);
storage.intSetting('SimilarArtistsLimit');      // Returns integer
storage.boolSetting('ShuffleResults');          // Returns boolean
storage.stringSetting('PlaylistName');          // Returns string
storage.listSetting('ArtistBlacklist');         // Returns parsed array

// Prefixes
const fixed = window.matchMonkeyPrefixes.fixPrefixes('Beatles, The');  // 'The Beatles'
```

### UI
```javascript
const notifications = window.matchMonkeyNotifications;

notifications.showToast('Processing playlist...');
notifications.createProgressTask('Fetching similar artists');
notifications.updateProgress('Searching library...', 0.45);  // 45%
notifications.terminateProgressTask();
```

### API Caching
```javascript
const cache = window.lastfmCache;

cache.init();  // Initialize at start of operation
cache.cacheSimilarArtists('Pink Floyd', artists);
cache.getCachedSimilarArtists('Pink Floyd');  // Returns cached or null
cache.getStats();  // { active: true, similarArtists: 5, ... }
cache.clear();  // Clear at end of operation
```

### Last.fm API
```javascript
const lastfm = window.matchMonkeyLastfmAPI;

// Similar artists
const similar = await lastfm.fetchSimilarArtists('Pink Floyd', 10);
// Returns: [{name: 'David Gilmour', ...}, ...]

// Top tracks
const topTracks = await lastfm.fetchTopTracks('Pink Floyd', 20);
// Returns: ['Time', 'Money', 'Us and Them', ...]

// Top tracks with ranking data
const ranked = await lastfm.fetchTopTracks('Pink Floyd', 100, true);
// Returns: [{title: 'Time', playcount: 5000, rank: 1}, ...]

// Similar tracks
const similar = await lastfm.fetchSimilarTracks('Pink Floyd', 'Time', 50);
// Returns: [{artist: '...', title: '...', match: 0.9}, ...]

// Artist info (with tags/genres)
const info = await lastfm.fetchArtistInfo('Pink Floyd');
// Returns: {name: '...', tags: ['rock', 'progressive'], ...}

// Artists by tag/genre
const artists = await lastfm.fetchArtistsByTag('progressive rock', 30);
// Returns: [{name: '...', listeners: 12345}, ...]
```

### ReccoBeats API
```javascript
const reccobeats = window.matchMonkeyReccoBeatsAPI;

// Mood-based recommendations
const moodTracks = await reccobeats.fetchMoodRecommendations('energetic', [], 50);
// Returns: [{artist: '...', title: '...', energy: 0.9, valence: 0.7}, ...]

// Activity-based recommendations
const activityTracks = await reccobeats.fetchActivityRecommendations('workout', 60, 50);
// Returns: [{artist: '...', title: '...', tempo: 130}, ...]

// Hybrid recommendations (ReccoBeats + Last.fm expansion)
const hybrid = await reccobeats.fetchHybridRecommendations('mood', 'happy', {
    genres: ['rock', 'pop'],
    duration: 60,
    limit: 30
});
// Returns: [{artist: 'Artist Name'}, ...]
```

### Database
```javascript
const db = window.matchMonkeyDB;

// Find library tracks by artist
const tracks = await db.findLibraryTracks('Pink Floyd', ['Time', 'Money'], 20);

// Batch find tracks for multiple titles
const titleMap = await db.findLibraryTracksBatch('Pink Floyd', ['Time', 'Money'], 5);
// Returns: Map { 'Time' => [...tracks], 'Money' => [...tracks] }

// Playlist operations
const playlist = await db.createPlaylist('Similar - Pink Floyd');
const existing = db.findPlaylist('My Favorites');
const playlistOrCreate = await db.getOrCreatePlaylist('My Collection');

// Queue operations
await db.queueTrack(trackObject);
const count = await db.queueTracks(trackArray, true);  // true = play now
await db.addTracksToPlaylist(playlist, trackArray);
await playlist.commitAsync();  // Save changes
```

### Discovery Strategies
```javascript
const strategies = window.matchMonkeyDiscoveryStrategies;

// Get strategy function by mode
const discoveryFn = strategies.getDiscoveryStrategy('artist');
const candidates = await discoveryFn(modules, seeds, config);

// Available modes
strategies.DISCOVERY_MODES.ARTIST    // 'artist'
strategies.DISCOVERY_MODES.TRACK     // 'track'
strategies.DISCOVERY_MODES.GENRE     // 'genre'
strategies.DISCOVERY_MODES.MOOD      // 'mood'
strategies.DISCOVERY_MODES.ACTIVITY  // 'activity'

// Get human-readable name
strategies.getDiscoveryModeName('track');  // 'Similar Tracks'
```

### Orchestration
```javascript
const orchestration = window.matchMonkeyOrchestration;

// Generate playlist (main entry point)
const result = await orchestration.generateSimilarPlaylist(modules, false, 'artist');
// Returns: { success: true, tracksAdded: 45, playlist: {...}, elapsed: 8.2 }
```

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `config.js` | Script IDs, menu IDs, API endpoints |
| `normalization.js` | Artist/title string normalization for matching |
| `helpers.js` | Shuffle, error formatting, list parsing |
| `sql.js` | SQL escaping, query building |
| `storage.js` | Read/write settings with type coercion |
| `prefixes.js` | Handle "The Beatles" vs "Beatles, The" |
| `notifications.js` | Toast messages, progress tracking |
| `cache.js` | Per-session API response caching |
| `lastfm.js` | Last.fm API queries (similar artists, top tracks) |
| `reccobeats.js` | ReccoBeats AI recommendations (mood/activity) |
| `library.js` | Search local library for tracks |
| `playlist.js` | Create and manage playlists |
| `queue.js` | Add tracks to Now Playing |
| `discoveryStrategies.js` | Discovery algorithms (artist/track/genre/mood) |
| `orchestration.js` | Main workflow coordination |
| `autoMode.js` | Auto-queue when playlist nears end |
| `mm5Integration.js` | MediaMonkey 5 UI hooks |

## Adding New Modules

When adding new modules:

1. **Place in appropriate subdirectory** (`utils`, `settings`, `ui`, `api`, `db`, `core`)
2. **Export to window namespace** (e.g., `window.myModule = { ... }`)
3. **Add to init.js load order** (respect dependencies)
4. **Document in this README**
5. **Ensure no circular dependencies**
6. **Keep responsibilities focused and single-purpose**

## Testing

Each module can be tested independently in the browser console:

```javascript
// Test normalization
console.assert(window.stripName('The Beatles') === 'THEBEATLES');

// Test cache
window.lastfmCache.init();
window.lastfmCache.cacheSimilarArtists('Test', [{name: 'Artist'}]);
console.assert(window.lastfmCache.getCachedSimilarArtists('Test').length === 1);
window.lastfmCache.clear();
```

## Migration Notes

- No external dependencies beyond MM5's built-in `app` object
- Settings modules gracefully handle cases where `app` is undefined
- Caching is per-session to avoid stale data across restarts
- All API modules include timeout handling and error recovery
