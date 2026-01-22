# Phase 5: Core Logic - Orchestration Layer

## Overview

**Phase 5** implements the **Core Logic** orchestration layer that ties together all refactored modules from Phases 1-4 into a cohesive workflow.

This is the **main algorithm** - the heart of the SimilarArtists add-on that orchestrates:
- Seed track collection (UI input)
- Similar artist discovery (Last.fm API)
- Track matching (Database queries)
- Playlist/queue management (MM5 output)
- Auto-mode triggering (playback events)

## Architecture

```
modules/core/
??? orchestration.js          (Phase 5: Orchestration Logic)
?   ??? generateSimilarPlaylist()    [Main entry point]
?   ??? collectSeedTracks()          [Input: UI selection or current track]
?   ??? processSeedArtists()         [Algorithm: Find similar artists + tracks]
?   ??? buildResultsPlaylist()       [Output: Create/update playlist]
?   ??? queueResults()               [Output: Enqueue to Now Playing]
?
??? (Future phases)
    ??? ranking.js               [Advanced ranking algorithms]
    ??? filtering.js             [Genre/rating/title filtering]
    ??? caching.js               [Performance optimization]
    ??? autoMode.js              [Auto-queue coordination]
```

## Core Functions

### generateSimilarPlaylist(modules, autoMode = false)

**Main entry point** - Complete orchestration of the workflow.

**Workflow:**
1. Collect seed tracks from selection or currently playing track
2. Process seeds through Last.fm API to discover similar artists
3. Query library for tracks matching discovered artists
4. Apply post-processing (ranking, shuffling, deduplication)
5. Create playlist or enqueue to Now Playing based on settings
6. Show confirmation dialog if enabled
7. Navigate to results if configured

**Configuration Parameters:**
- `seedLimit` - Max seed artists to process (per-run, from UI limit)
- `similarLimit` - Max similar artists per seed (from Last.fm)
- `tracksPerArtist` - Max tracks to fetch per artist
- `totalLimit` - Total track limit for final playlist
- `includeSeedArtist` - Whether to include original seed artist
- `rankEnabled` - Apply Last.fm popularity ranking
- `bestEnabled` - Select highest-rated tracks from library
- `randomize` - Shuffle results
- `showConfirm` - Display confirmation dialog
- `autoMode` - Whether in auto-queue mode (forces enqueue, conservative limits)

### collectSeedTracks(modules) ? Promise<Array>

**Inputs:** Current UI selection or playback state

**Algorithm:**
1. Try to get selected tracklist from active pane via `uitools.getSelectedTracklist()`
2. If selection exists, iterate and extract artist names
3. Split multi-artist tracks into individual seed artists
4. Fallback to currently playing track if no selection
5. Return normalized array of `{name, track}` objects

**Returns:**
- Array of seed artist objects `[{name: 'artistName', track: trackObj}, ...]`
- Empty array if no selection and no playing track

### processSeedArtists(modules, seeds, config, rankMap?) ? Promise<Array>

**Core Algorithm** - Multi-stage track discovery and matching

**Algorithm:**
```
For each seed artist (up to seedLimit):
  1. Fetch similar artists from Last.fm (up to similarLimit)
  2. Build deduplicated artist pool:
     - Optionally include seed artist itself
     - Add similar artists
     - Apply blacklist filtering
  
  For each artist in pool:
    3. Fetch top tracks from Last.fm (up to tracksPerArtist)
    4. Batch-match titles against library (3-pass fuzzy matching)
    5. Apply ranking if enabled (populate rankMap for later sorting)
    6. Accumulate matched tracks with deduplication
    7. Continue until totalLimit reached
  
  8. Return deduplicated array of matched track objects
```

**Key Features:**
- Deduplication at multiple levels (seed artists, pool artists, track keys)
- Blacklist filtering (artist exclusion list from settings)
- Ranking mode support (populated in `rankMap` for sorting)
- Early-exit optimization (stops processing when totalLimit reached)
- Error resilience (continues on per-artist failures)

### buildResultsPlaylist(modules, tracks, config) ? Promise<object>

**Playlist Creation Workflow**

**Steps:**
1. Get playlist template from settings (e.g., `"Similar - %"` with `%` = first artist)
2. Check if confirmation dialog enabled:
   - Show playlist selection dialog
   - User can create new or select existing
   - Can override with configured mode (Create New / Overwrite / Do Not Create)
3. Create new playlist if needed
4. Create temporary tracklist
5. Add all result tracks to playlist using `addTracksAsync()`
6. Navigate to playlist if configured

**Returns:**
```javascript
{
  id: playlistId,
  name: playlistName,
  trackCount: numberOfTracksAdded,
  created: boolean
}
```

### queueResults(modules, tracks, config) ? Promise<object>

**Now Playing Queue Management**

**Steps:**
1. Check if "clear before queue" is enabled ? clear Now Playing
2. Build set of existing track IDs for deduplication (if enabled)
3. Filter out duplicate tracks
4. Create temporary tracklist
5. Add filtered tracks using `player.addTracksAsync()`
6. Update status/progress

**Returns:**
```javascript
{
  added: numberOfNewTracksAdded,
  total: totalTracksInNowPlaying
}
```

## Integration Points

### Input (Phases 1-2)
- **UI Input:** `collectSeedTracks()` uses MM5 UI APIs
- **Settings:** `config` loads preferences from Phase 2 (Settings)
- **Helpers:** Phase 1 utilities (normalization, string helpers)

### Processing (Phases 3-4)
- **Last.fm API:** Phase 4 (`api/lastfm`) for similar artists and top tracks
- **Database Queries:** Phase 4 (`db/library`) for fuzzy track matching
- **Caching:** Phase 4 (`api/cache`) for Last.fm result caching

### Output
- **Playlist Management:** MM5 `app.playlists` API
- **Queue Management:** MM5 `app.player.addTracksAsync()` API
- **UI Feedback:** Phase 2 notifications (toast, progress)

## Configuration Mapping

Phase 5 orchestration reads configuration from Phase 2 settings:

| Setting | Phase 2 Key | Usage |
|---------|------------|-------|
| Seed limit | `Seed` | Max seed artists per run |
| Similar artist limit | `Similar` | Max similar artists per seed |
| Tracks per artist | `TPA` | Max tracks fetched per artist |
| Total track limit | `Total` | Final playlist size |
| Include seed artist | `IncludeSeed` | Add original artist to results |
| Ranking mode | `Rank` | Enable Last.fm popularity ranking |
| Best tracks | `Best` | Select highest-rated tracks |
| Randomize | `Random` | Shuffle final playlist |
| Show confirmation | `ShowConfirm` | Display dialog before creation |
| Enqueue mode | `Enqueue` | Queue to Now Playing instead of create playlist |
| Blacklist | `Black` | Artist exclusion list |

## Auto-Mode Integration

When `autoMode = true`:
- Forces conservative limits: `seedLimit=2`, `tracksPerArtist=2`, `totalLimit=10`
- Forces enqueue mode (adds to Now Playing, not create playlist)
- Skips confirmation dialog
- Used by auto-queue listener when playlist near end

## Error Handling

All functions include try-catch blocks with:
- Detailed error logging to console
- User-friendly toast notifications
- Progress task cleanup
- Graceful degradation (continue on per-item failures)

## Performance Optimizations

1. **Early Exit:** Stop processing when totalLimit reached
2. **Batch Operations:** Use `findLibraryTracksBatch()` for bulk track matching
3. **Caching:** Leverages Phase 4 cache for repeated Last.fm requests
4. **Deduplication:** Efficient Set-based key tracking
5. **Progress Updates:** Frequent UI feedback for long operations

## Future Enhancements (Phase 6+)

- Advanced filtering (genre, date range)
- Weighted seed artists (different importance per seed)
- Alternative matching algorithms
- Track history tracking (avoid recently played)
- Seed artist weighting algorithms

## Testing Strategy

Unit tests should verify:
1. `collectSeedTracks()` with various selection scenarios
2. `processSeedArtists()` with multiple seeds and configuration combinations
3. Track deduplication logic (key generation, Set operations)
4. Ranking and randomization effects
5. Error resilience (API failures, missing tracks, etc.)
6. Progress tracking (updates at correct percentages)

## Files in Phase 5

```
modules/core/
??? orchestration.js           Main orchestration functions
??? (index.js updated)        Added core/orchestration export
```

## Module Dependency Graph

```
orchestration.js
??? config                     (Phase 0: Constants)
??? utils/normalization        (Phase 1: Normalization)
??? utils/helpers              (Phase 1: Helper utilities)
??? settings/storage           (Phase 2: Persistent settings)
??? settings/prefixes          (Phase 2: Prefix handling)
??? ui/notifications           (Phase 2: UI feedback)
??? api/lastfm                 (Phase 4: Last.fm queries)
??? db/library                 (Phase 4: Track matching)
??? (auto mode trigger)        (Phase 5: Playback listener)
```

## Status

- ? **Phase 5 Complete** - Core orchestration implemented
- ? Module exports updated
- ? All major workflows documented
- ? **Phase 6 (Auto-Mode)** - Pending implementation
- ? **Phase 7 (Integration)** - Full system integration
