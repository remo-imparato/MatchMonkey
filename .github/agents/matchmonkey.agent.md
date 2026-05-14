---
name: MatchMonkey
description: Agent for MatchMonkey MediaMonkey 5 add-on development in MM5 JavaScript sandbox.
keywords:
  - mediamonkey
  - mm5
  - matchmonkey
  - lastfm
  - reccobeats
  - discovery
  - playlist
  - javascript
---

# MatchMonkey

## Project Identity

**MatchMonkey** is a MediaMonkey 2024/5 (MM5) add-on that discovers and builds playlists of similar music using Last.fm and ReccoBeats APIs. It runs entirely inside the MM5 JavaScript sandbox — no Node.js, no bundler, no browser DOM. All files are plain vanilla JS loaded via MM5's 'localRequirejs()'.

---

## Technology Stack

- **Runtime**: MediaMonkey 5 JS sandbox (Chromium-based, but no browser APIs like 'localStorage')
- **Language**: Vanilla JavaScript (ES2020+), 'use strict' in every module
- **Database**: SQLite via 'app.db.executeQueryAsync()' / 'app.db.getQueryResultAsync()'
- **HTTP**: Native 'fetch()' with 'AbortController' for timeouts
- **UI**: MM5 'uitools', 'app.actions', 'app.playlists', 'app.player'
- **No frameworks** — no React, no jQuery, no npm packages

---

## Module Map

| Path | Window export | Purpose |
|---|---|---|
| 'modules/index.js' | 'window.matchMonkeyModules' | Assembles all modules into one namespace |
| 'modules/config.js' | 'window.matchMonkeyConfig' | Version constants, default settings |
| 'modules/api/cache.js' | 'window.matchMonkeyCache' | SQLite-backed persistent API cache (1-yr TTL for lookups) |
| 'modules/api/lastfm.js' | 'window.matchMonkeyLastfmAPI' | Last.fm REST API: similar artists/tracks, top tracks, tags |
| 'modules/api/reccobeats.js' | 'window.matchMonkeyReccoBeatsAPI' | ReccoBeats REST API: track IDs, audio features, recommendations |
| 'modules/core/orchestration.js' | 'window.matchMonkeyOrchestration' | Main workflow: seeds -> discovery -> library match -> dedup -> output |
| 'modules/core/discoveryStrategies.js' | 'window.matchMonkeyDiscoveryStrategies' | Strategy dispatch: artist / track / genre / acoustics / mood / activity |
| 'modules/core/moodActivityDiscovery.js' | 'window.matchMonkeyMoodActivityDiscovery' | Hybrid Last.fm + ReccoBeats mood/activity discovery |
| 'modules/core/autoMode.js' | 'window.matchMonkeyAutoMode' | Auto-queue mode: triggers near end of Now Playing |
| 'modules/core/mm5Integration.js' | 'window.matchMonkeyMM5Integration' | MM5 UI: toolbar icons, action state |
| 'modules/db/index.js' | 'window.matchMonkeyDB' | DB facade: exposes library, playlist, queue |
| 'modules/db/library.js' | (via DB index) | 'findLibraryTracks()', 'findLibraryTracksBatch()' |
| 'modules/db/playlist.js' | (via DB index) | 'findPlaylist()', 'resolveTargetPlaylist()', 'addTracksToPlaylist()' |
| 'modules/db/queue.js' | (via DB index) | 'queueTrack()' |
| 'modules/settings/storage.js' | 'window.matchMonkeyStorage' | 'getSetting()', 'setSetting()', 'refreshSettings()' |
| 'modules/settings/prefixes.js' | 'window.matchMonkeyPrefixes' | 'fixPrefixes()' — "The Beatles" / "Beatles, The" |
| 'modules/settings/lastfm.js' | 'window.matchMonkeyLastfm' | Last.fm user account settings |
| 'modules/ui/notifications.js' | 'window.matchMonkeyNotifications' | 'updateProgress()', 'showToast()', 'isCancelled()' |
| 'modules/utils/logger.js' | 'window.matchMonkeyLogger' | Structured logger: error/warn/log/info/debug/summary |
| 'modules/utils/helpers.js' | 'window.matchMonkeyHelpers' | 'cleanArtistName()', 'cleanTrackName()', 'cleanAlbumName()', 'shuffleWithDispersion()' |
| 'modules/utils/normalization.js' | 'window.matchMonkeyNormalization' | Unicode normalization, name splitting |
| 'modules/utils/missedResults.js' | 'window.matchMonkeyMissedResults' | Tracks songs not in local library for user review |
| 'modules/utils/sql.js' | 'window.matchMonkeySQL' | SQL query builder helpers |

---

## Discovery Modes

| Mode | Constant | Strategy function | API |
|---|---|---|---|
| Similar Artists | 'artist' | discoverByArtist | Last.fm 'artist.getSimilar' + 'artist.getTopTracks' |
| Similar Tracks | 'track' | discoverByTrack | Last.fm 'track.getSimilar' |
| Similar Genre | 'genre' | discoverByGenre | Last.fm 'artist.getInfo' + 'tag.getTopArtists' |
| Similar Acoustics | 'acoustics' | discoverByRecco | ReccoBeats recommendations from seed track IDs |
| Mood | 'mood' | discoverByMood | Last.fm similarity + ReccoBeats audio features + template filter |
| Activity | 'activity' | discoverByActivity | Last.fm similarity + ReccoBeats audio features + template filter |
| Popular Artist Tracks | 'besttracks' | discoverByBestTracks | Last.fm 'artist.getTopTracks' ranked by playcount |
| Popular Similar Tracks | 'popularsimilar' | discoverByPopularSimilar | Last.fm 'track.getSimilar' ranked by playcount |

---

## Core Workflow (orchestration.js)

The core workflow follows this process:
1. Extract seed artists/tracks/genres from selection
2. Call appropriate discovery strategy function
3. Match candidates to local library
4. Dedup by artist+title (prefer lossless)
5. Include seed tracks if configured
6. Shuffle with dispersion
7. Apply hard limit
8. Create playlist or queue results

Discovery functions return { candidates, stats }.
Mood/Activity hybrid also returns { libraryTracks } which bypasses matchCandidatesToLibrary.

---

## Coding Conventions

- Every module ends with 'window.matchMonkey<Name> = { ... }' export
- Cancellation: check 'window.matchMonkeyNotifications?.isCancelled?.()' in loops
- Async DB: use 'await app.db.executeQueryAsync()' for writes, 'await app.db.getQueryResultAsync()' for reads
- No 'console.log' directly — always use 'window.matchMonkeyLogger.*'
- Helpers for name cleaning: 'matchMonkeyHelpers.cleanArtistName()', 'cleanTrackName()', 'cleanAlbumName()'
- Rate-limited HTTP: use 'rateLimitedFetch()' (ReccoBeats) or 'lastfmFetch()' (Last.fm)

---

## Cache Architecture

- **Provider**: 'modules/api/cache.js' -> SQLite table 'MatchMonkeyData'
- **Persistence**: Survives MM5 restarts via 'initCache()' and 'saveCache()'
- **Maps**: lastfm.* and reccobeats.* with configurable TTL (default 72h, lookups 1-yr)
- **Usage**: Always check 'getCache(mapName)?.has(key)' before API calls

---

## ReccoBeats & Last.fm APIs

**ReccoBeats** (https://api.reccobeats.com/v1):
- searchArtistAll(name) -> [{id, name}]
- findTrackIdsGroupedBatch(seeds) -> [{seed, trackId}]
- fetchTrackAudioFeatures(trackId) -> features object
- fetchRecommendations(seedIds, audioTargets, limit) -> recommendations array

**Last.fm** (https://ws.audioscrobbler.com/2.0/):
- fetchSimilarArtists(artist, limit) -> [{name, match}]
- fetchTopTracks(artist, limit, includePlaycount) -> [string] or [{title, playcount}]
- fetchSimilarTracks(artist, track, limit) -> [{title, artist, match, playcount}]

Audio features are only fetched for tracks confirmed in the local library.

---

## Best Tracks Playlist Feature

**Goal**: Build a playlist of objectively best tracks by artist using Last.fm playcount + local rating ranking.

**New mode**: 'besttracks'
**Strategy**: discoverByBestTracks(modules, seeds, config)
**Settings**: BestTracksLimit (default 10), BestTracksRankBy ('playcount'/'rating'/'combined')

**Workflow**:
- Extract seed artists
- Per artist: fetchTopTracks(artist, BestTracksLimit * 3, true)
- Match to local library
- Score: normalize(playcount) + normalize(rating)
- Sort descending, slice to BestTracksLimit
- Return as candidates[]

**Files to modify**:
- modules/core/discoveryStrategies.js (add mode, strategy function, dispatch)
- modules/core/orchestration.js (add action label)
- modules/config.js (add settings defaults)

**Key feature**: Do not shuffle when BestTracksRankBy is active — the ranked order IS the value.

---

## Best Tracks Discovery Feature

**Goal**: Select and playlist the top-ranked tracks for specific selected artists.

**Mode**: 'besttracks' (menu label: **Artist Best Tracks**)
**Strategy function**: `discoverByBestTracks(modules, seeds, config)`
**API**: Last.fm 'artist.getTopTracks' (ranked by playcount)

**Hard rule (must follow)**:
- Use **only selected seed artists**.
- Do **not** call Last.fm `artist.getSimilar` in this mode.
- Do **not** discover additional artists in this mode.

**Configuration**:
- `BestTracksLimit` (default: 10) — Maximum tracks per artist
- `SeedLimit` — Maximum artists to process (from similar limits)

**Workflow**:
1. Extract unique seed artists from selected tracks
2. For each selected artist, call `fetchTopTracks(artist, limit * 3, true)` to get ranked tracks with playcount
3. Filter to top `BestTracksLimit` tracks (already ranked by Last.fm)
4. Match each track to local library using fuzzy matching
5. Return as candidates[] with playcount metadata
6. Library matching, deduplication, and final playlist creation handled by orchestration

**Key features**:
- **Selected artists only**: No artist expansion beyond user selection
- **Rank order matters**: Top tracks are ordered by Last.fm playcount (most popular first)
- **No shuffle when ranking**: If user wants to preserve popularity ranking, `randomize` should be false
- **Blacklist support**: Respects ArtistBlacklist setting
- **Playcount tracking**: Each track retains playcount for sorting/display

---

## Popular Similar Tracks Discovery Feature

**Goal**: Find the most popular tracks similar to selected seed tracks.

**Mode**: 'popularsimilar'
**Strategy function**: `discoverByPopularSimilar(modules, seeds, config)`
**API**: Last.fm 'track.getSimilar' (ranked by playcount)

**Configuration**:
- `PopularSimilarLimit` (default: 50) — Maximum similar tracks to fetch per seed before filtering
- `BestTracksLimit` (default: 10) — Maximum tracks per artist in final results
- `SeedLimit` — Maximum seed tracks to process (from similar limits)

**Workflow**:
1. For each seed track, split artists by ';' and process each
2. Call `fetchSimilarTracks(artist, track, limit)` to get similar tracks with playcount
3. Group similar tracks by artist
4. For each artist, sort tracks by playcount (most popular first) and keep top `BestTracksLimit`
5. Match each track to local library using fuzzy matching
6. Return as candidates[] with playcount metadata
7. Library matching, deduplication, and final playlist creation handled by orchestration

**Key features**:
- **Playcount ranking**: Results sorted by popularity across all similar tracks
- **Artist grouping**: Similar tracks grouped by artist to balance variety
- **Blacklist support**: Respects ArtistBlacklist setting
- **Efficient filtering**: Fetches larger set, filters to most popular (higher relevance)
- **Multi-artist support**: Handles seed tracks with multiple artists (split on ';')

**Files modified**:
- `modules/core/discoveryStrategies.js` — Add `discoverByPopularSimilar()` function, update `DISCOVERY_MODES`, `getDiscoveryStrategy()`, `getDiscoveryModeName()`
- `modules/core/orchestration.js` — Add `popularSimilarLimit` to config
- `init.js` — Add `PopularSimilarLimit` default setting (50)
- `dialogs/dlgOptions/pnl_MatchMonkey.html` — Add UI control
- `dialogs/dlgOptions/pnl_MatchMonkey.js` — Add load/save handlers
- `modules/config.js` — Add `ACTION_POPULARSIMILAR_ID` constant

---

## MediaMonkey 2024+ Best Practices (MM5)

- Runtime is MM5 sandbox only: avoid Node.js/browser storage APIs and npm dependencies.
- Keep modules plain vanilla JS and `'use strict'`.
- Prefer MM5 async DB APIs:
  - `await app.db.getQueryResultAsync()` for SELECT
  - `await app.db.executeQueryAsync()` for INSERT/UPDATE/DELETE/DDL
- For network calls, use existing API wrappers (`lastfmFetch`, `rateLimitedFetch`) and cache layer.
- Always route logs through `window.matchMonkeyLogger.*` in modules (avoid raw `console.log` in module code).
- Check cancellation (`window.matchMonkeyNotifications?.isCancelled?.()`) in loops and long operations.
- Keep changes minimal and localized; avoid broad rewrites.
- Preserve existing user settings behavior and defaults in `init.js`.

## Required File Update Flow for New User-Facing Features

When adding a new mode or user-visible feature, follow this order:

1. `modules/core/discoveryStrategies.js`
   - Add/extend mode constant, strategy function, dispatch, mode label, export.
2. `matchMonkey.js`
   - Add mode to runtime `DISCOVERY_MODES` so validation does not downgrade mode.
3. `modules/core/orchestration.js`
   - Wire config/settings, seed requirements, ordering/shuffle rules.
4. `init.js`
   - Add new default settings.
5. `actions_add.js`
   - Register action and include in both Tools and context submenus.
6. `dialogs/dlgOptions/pnl_MatchMonkey.html`
   - Add settings controls when needed.
7. `dialogs/dlgOptions/pnl_MatchMonkey.js`
   - Load/save the new settings.
8. Optional as needed:
   - `modules/api/lastfm.js`, `modules/api/reccobeats.js`, `modules/api/cache.js`,
     `modules/db/*`, `modules/settings/storage.js`, `modules/core/mm5Integration.js`.

## Ranked Modes Ordering Rule

For ranked modes (`besttracks`, `popularsimilar`):
- Do not randomize final results.
- Preserve popularity-first ordering in output playlist/queue.
- `besttracks` must use selected artists only and must not call `artist.getSimilar`.
