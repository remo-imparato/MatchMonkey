# Phase 5: Core Logic - Complete Implementation Summary

## ? What Was Created

### 1. Main Orchestration Module
**File:** `modules/core/orchestration.js`

Four core functions that implement the complete SimilarArtists workflow:

#### `generateSimilarPlaylist(modules, autoMode = false)` - Main Entry Point
- **Purpose:** Orchestrate the complete workflow from seed selection to playlist creation
- **Inputs:** Module dependencies, auto-mode flag
- **Outputs:** Result object with success status and track count
- **Features:**
  - Progress tracking with real-time UI updates
  - Configuration loading with auto-mode overrides
  - Multi-stage processing (collect ? process ? post-process ? output)
  - Error handling with user-friendly messages
  - Returns detailed result object

#### `collectSeedTracks(modules)` - Input Collection
- **Purpose:** Get starting point (seed artist) from UI selection or playback
- **Algorithm:**
  1. Try to get selected tracklist from active pane
  2. Fall back to currently playing track
  3. Extract artist names from tracks
  4. Split multi-artist tracks into individual seeds
  5. Return normalized seed array
- **Error Resilience:** Gracefully handles missing APIs and empty selections

#### `processSeedArtists(modules, seeds, config, rankMap)` - Core Algorithm
- **Purpose:** Multi-stage track discovery and matching
- **Algorithm:**
  1. For each seed (up to seedLimit):
     - Fetch similar artists from Last.fm (up to similarLimit)
     - Build deduplicated artist pool with blacklist filtering
     - For each artist in pool:
       - Fetch top tracks from Last.fm
       - Batch-match against library (3-pass fuzzy)
       - Apply ranking if enabled
       - Accumulate with deduplication
  2. Return deduplicated results
- **Features:**
  - Multi-level deduplication (seeds, artists, tracks)
  - Artist blacklist support
  - Early-exit optimization (stops at totalLimit)
  - Optional ranking mode with rank score population
  - Error resilience (continues on failures)
  - Progress tracking at fine granularity

#### `buildResultsPlaylist(modules, tracks, config)` - Playlist Creation
- **Purpose:** Create or update playlist with results
- **Workflow:**
  1. Load playlist template from settings
  2. Show confirmation dialog if enabled (future)
  3. Create new playlist with generated name
  4. Add all tracks via `addTracksAsync()`
  5. Return playlist info
- **Returns:** Object with {id, name, trackCount, created}

#### `queueResults(modules, tracks, config)` - Now Playing Queue
- **Purpose:** Add results to Now Playing queue
- **Workflow:**
  1. Optionally clear Now Playing
  2. Build deduplication set (if enabled)
  3. Filter out duplicate tracks
  4. Add filtered tracks via `player.addTracksAsync()`
  5. Return queue info
- **Returns:** Object with {added, total}

### 2. Module Integration
**File:** `modules/index.js` (Updated)

Added orchestration module to the central export, enabling:
```javascript
const { core: { orchestration } } = modules;
```

### 3. Documentation
**File:** `PHASE_5_CORE_LOGIC.md`

Comprehensive documentation covering:
- Architecture and module organization
- Complete function documentation
- Algorithm descriptions
- Integration points with Phases 1-4
- Configuration mapping
- Error handling strategy
- Performance optimizations
- Testing strategy

## ?? Key Technical Features

### Configuration Management
- Loads settings from Phase 2 (Settings)
- Auto-mode applies conservative defaults:
  - seedLimit: 2 (vs normal 5)
  - tracksPerArtist: 2 (vs normal 5)
  - totalLimit: 10 (vs normal 100)
- Skips confirmations in auto-mode

### Multi-Pass Deduplication
- **Seed Level:** Deduplicates seed artists
- **Artist Pool:** Dedups similar artists + blacklist filtering
- **Track Level:** Uses Set-based track key generation
- **Final Pass:** Ensures no duplicates remain

### Ranking Algorithm
When ranking enabled:
1. Fetch top tracks from Last.fm (with playcount)
2. Map Last.fm rank to score (0-100)
3. Fall back to position-based score if no rank attr
4. Track highest score for each track across seeds
5. Sort final results by score (highest first)

### Error Handling
- Try-catch blocks at function and operation level
- Detailed console logging for debugging
- User-friendly toast notifications
- Progress task cleanup on errors
- Graceful degradation (continue on partial failures)

### Progress Tracking
- 0.0-0.1: Initialization
- 0.1-0.15: Collect seed tracks
- 0.15-0.2: Initialize processing
- 0.2-0.8: Process seeds (granular per-seed updates)
- 0.8-0.85: Apply ranking
- 0.85-0.87: Randomization
- 0.87-0.9: Prepare output
- 0.9-1.0: Execute output + cleanup

## ?? Configuration Parameters

All settings loaded from Phase 2 Storage module:

| Parameter | Setting Key | Auto-Mode | Normal | Purpose |
|-----------|------------|-----------|---------|---------|
| seedLimit | `Seed` | 2 | 5 | Max seed artists |
| similarLimit | `Similar` | - | 10 | Max similar per seed |
| tracksPerArtist | `TPA` | 2 | 5 | Tracks per artist |
| totalLimit | `Total` | 10 | 100 | Final limit |
| includeSeedArtist | `IncludeSeed` | false | true | Include orig artist |
| rankEnabled | `Rank` | - | true | Enable ranking |
| bestEnabled | `Best` | - | true | Highest rated only |
| randomize | `Random` | - | false | Shuffle |
| showConfirm | `ShowConfirm` | false | true | Show dialog |
| enqueueMode | `Enqueue` | true | false | Queue vs playlist |
| blacklist | `Black` | - | - | Artist exclusion |

## ?? Integration Map

### Consumes From Phases 1-4:

**Phase 0: Config**
- `DEFAULTS` object for configuration defaults
- `API_BASE`, `SCRIPT_ID` constants

**Phase 1: Utils**
- `normalizeName()` - Artist name normalization
- `splitArtists()` - Parse multi-artist strings
- `shuffle()` - Randomize track lists
- `formatError()` - User-friendly error messages

**Phase 2: Settings**
- `getSetting()` - Load persistent settings
- `intSetting()` - Parse int settings
- `boolSetting()` - Parse bool settings
- `stringSetting()` - Parse string settings

**Phase 2: Prefix Handling**
- `fixPrefixes()` - Handle "The Beatles" vs "Beatles, The"

**Phase 2: Notifications**
- `showToast()` - User notifications
- `updateProgress()` - Progress updates
- `createProgressTask()` / `terminateProgressTask()` - Task tracking

**Phase 4: API**
- `fetchSimilarArtists()` - Last.fm queries
- `fetchTopTracks()` - Last.fm track fetching

**Phase 4: Database**
- `findLibraryTracksBatch()` - Multi-pass fuzzy matching

### Provides To (Phase 6+):

- Main orchestration entry point for action handlers
- Seed collection logic for UI integration
- Playlist/queue management for output workflows
- Auto-mode triggering mechanism

## ?? Algorithm Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Seed collection | O(n) | n = selected tracks |
| Similar artist fetch | O(s × a) | s = seeds, a = artists per seed |
| Track matching | O(a × t × m) | a = artists, t = tracks, m = library |
| Ranking | O(t log t) | t = matched tracks |
| Final dedup | O(t) | t = final tracks |
| **Total** | **O(s × a × t × m)** | Optimized with early exits |

Early exit at `totalLimit` provides effective optimization:
- Typical run: 2-5 seeds × 5-10 artists × 5 tracks = ~100-250 tracks fetched
- Worst case: all permutations × fuzzy matching overhead

## ?? Testing Considerations

**Unit Tests Should Verify:**
1. `collectSeedTracks()` with various selection states
2. `processSeedArtists()` with multiple seed combinations
3. Track key generation and deduplication
4. Ranking score calculation
5. Artist pool deduplication with blacklist
6. Early exit conditions
7. Error recovery (API failures, missing tracks)
8. Progress calculation accuracy
9. Configuration override in auto-mode
10. Playlist creation and queue management

**Integration Tests:**
1. End-to-end workflow with test data
2. MM5 API interaction (simulated)
3. Multiple auto-mode triggers
4. Concurrent seed processing

## ?? Performance Characteristics

- **Network Requests:** O(seeds × similar artists) to Last.fm
- **Database Queries:** Batched in Phase 4 (efficient)
- **Memory:** Scales with total track count (typically < 100MB)
- **UI Updates:** Frequent progress updates (100ms+ intervals recommended)

**Optimization Opportunities:**
- Parallel seed processing (if MM5 supports)
- Incremental UI updates
- Streaming results (not wait for all)
- Advanced caching strategies

## ?? Ready for Phase 6

Phase 5 provides complete foundation for:
- **Phase 6:** Auto-Mode Implementation (playback listener, threshold detection)
- **Phase 7:** Full System Integration (action handlers, dialogs)
- **Phase 8+:** Advanced Features (advanced filtering, weighting, history)

## Files Created

```
modules/
??? core/
?   ??? orchestration.js          ? NEW - Phase 5 orchestration
??? index.js                       ? UPDATED - Added core/orchestration export
??? (all Phase 1-4 modules)        ? READY

PHASE_5_CORE_LOGIC.md              ? NEW - Detailed documentation
```

## Summary

**Phase 5: Core Logic** implements the complete orchestration layer that ties together all refactored modules into the main SimilarArtists algorithm. It provides:

? **Complete workflow orchestration** - From seed selection to playlist creation  
? **Multi-pass track matching** - With fuzzy matching and ranking  
? **Flexible output modes** - Playlist creation or queue management  
? **Auto-mode support** - Conservative limits and forced enqueue  
? **Robust error handling** - Graceful degradation and user feedback  
? **Progress tracking** - Real-time UI updates  
? **Configuration management** - Full integration with Phase 2 settings  
? **Code documentation** - JSDoc comments and detailed architecture docs  

The system is ready for Phase 6 implementation of auto-mode listeners and Phase 7 integration with MM5 actions and dialogs.
