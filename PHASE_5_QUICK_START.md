# Phase 5: Quick Start Guide

## What is Phase 5?

**Phase 5: Core Logic** implements the **main algorithm orchestration layer** that ties together all modules into the complete SimilarArtists workflow.

It's the **heart of the application** - where seed artists are collected, similar artists discovered, tracks matched, and playlists created.

## Three Ways to Use Phase 5

### 1. Direct Entry Point
```javascript
const modules = require('./modules');
const { core: { orchestration } } = modules;

// Run the complete workflow
const result = await orchestration.generateSimilarPlaylist(modules, false);
console.log(`Added ${result.tracksAdded} tracks`);
```

### 2. Test Specific Functions
```javascript
// Test seed collection
const seeds = await orchestration.collectSeedTracks(modules);
console.log(`Found ${seeds.length} seed artists`);

// Test album processing
const tracks = await orchestration.processSeedArtists(
  modules, 
  seeds, 
  { seedLimit: 2, similarLimit: 10, tracksPerArtist: 5, totalLimit: 50 }
);
console.log(`Found ${tracks.length} matching tracks`);
```

### 3. Auto-Mode
```javascript
// Run with conservative limits (for auto-queue)
const result = await orchestration.generateSimilarPlaylist(modules, true);
// Automatically uses: seedLimit=2, tracksPerArtist=2, totalLimit=10
// Automatically forces: enqueueMode=true, skipConfirm=true
```

## Module Files

| File | Purpose |
|------|---------|
| `modules/core/orchestration.js` | Main orchestration functions |
| `modules/index.js` | Module exports (updated) |
| `PHASE_5_CORE_LOGIC.md` | Detailed architecture |
| `PHASE_5_SUMMARY.md` | Implementation summary |
| `PHASE_5_COMPLETE.md` | Project status |

## Core Functions at a Glance

### generateSimilarPlaylist(modules, autoMode?)
**Main entry point** - Runs complete workflow
```javascript
const result = await generateSimilarPlaylist(modules);
// Returns: { success, tracksAdded, tracks, output }
```

### collectSeedTracks(modules)
**Get seed artists** - From selection or playing track
```javascript
const seeds = await collectSeedTracks(modules);
// Returns: [{ name: 'Artist', track: trackObj }, ...]
```

### processSeedArtists(modules, seeds, config, rankMap?)
**Core algorithm** - Find similar artists and matching tracks
```javascript
const tracks = await processSeedArtists(modules, seeds, {
  seedLimit: 2,
  similarLimit: 10,
  tracksPerArtist: 5,
  totalLimit: 50,
  includeSeedArtist: true,
  rankEnabled: true,
  bestEnabled: true
});
// Returns: [{ id, title, artist, album, ... }, ...]
```

### buildResultsPlaylist(modules, tracks, config)
**Create playlist** - With result tracks
```javascript
const result = await buildResultsPlaylist(modules, tracks, config);
// Returns: { id, name, trackCount, created }
```

### queueResults(modules, tracks, config)
**Queue to Now Playing** - Add to playback queue
```javascript
const result = await queueResults(modules, tracks, config);
// Returns: { added, total }
```

## Configuration Quick Reference

All settings are loaded from Phase 2 storage. Key parameters:

```javascript
{
  seedLimit: 5,           // Max seed artists per run
  similarLimit: 10,       // Max similar artists per seed
  tracksPerArtist: 5,     // Tracks fetched per artist
  totalLimit: 100,        // Final playlist size
  includeSeedArtist: true,      // Include original artist
  rankEnabled: true,            // Enable Last.fm ranking
  bestEnabled: true,            // Only highest-rated
  randomize: false,             // Shuffle results
  showConfirm: true,            // Show dialog
  autoMode: false               // Auto-queue mode
}
```

## Data Flow

```
User Selection / Currently Playing
    ?
collectSeedTracks() ? [{name, track}, ...]
    ?
processSeedArtists() ? Similar artists + track matching
    ?
Apply ranking/randomization
    ?
buildResultsPlaylist() or queueResults()
    ?
User sees results in playlist or Now Playing
```

## Error Handling

All functions include:
- Try-catch blocks
- User-friendly toast notifications
- Detailed console logging
- Progress task cleanup
- Graceful degradation

```javascript
try {
  const result = await generateSimilarPlaylist(modules);
  showToast(`Added ${result.tracksAdded} tracks`);
} catch (e) {
  showToast(`Error: ${e.message}`, 'error');
  console.error(e);
}
```

## Progress Tracking

Functions provide real-time progress updates:
```javascript
// 0.0 - Initialize
// 0.1 - Collect seeds
// 0.2 - Process seeds (per-seed granularity)
// 0.8 - Apply ranking
// 0.9 - Prepare output
// 1.0 - Complete
```

## Common Tasks

### Run with default settings
```javascript
const result = await generateSimilarPlaylist(modules);
```

### Run in auto-mode (auto-queue)
```javascript
const result = await generateSimilarPlaylist(modules, true);
```

### Just collect seeds
```javascript
const seeds = await collectSeedTracks(modules);
console.log(seeds.map(s => s.name).join(', '));
```

### Just process specific artists
```javascript
const seeds = [{ name: 'The Beatles' }];
const tracks = await processSeedArtists(modules, seeds, {
  seedLimit: 1,
  similarLimit: 5,
  tracksPerArtist: 3,
  totalLimit: 20
});
```

### Create playlist (not queue)
```javascript
const config = { autoMode: false };
const result = await buildResultsPlaylist(modules, tracks, config);
console.log(`Created: ${result.name}`);
```

### Queue to Now Playing
```javascript
const config = { autoMode: false };
const result = await queueResults(modules, tracks, config);
console.log(`Added ${result.added} to queue`);
```

## Testing Checklist

- [ ] Can collect seed tracks from selection
- [ ] Can collect seed track from currently playing
- [ ] Handles no selection gracefully
- [ ] Processes multiple seeds
- [ ] Deduplicates properly
- [ ] Applies blacklist filtering
- [ ] Ranks correctly when enabled
- [ ] Randomizes when enabled
- [ ] Creates playlists successfully
- [ ] Queues to Now Playing successfully
- [ ] Handles API errors gracefully
- [ ] Progress tracking works
- [ ] Auto-mode applies conservative limits

## Integration with Other Phases

**Phase 5 depends on:**
- Phase 0 (config) - Configuration constants
- Phase 1 (utils) - String helpers, normalization
- Phase 2 (settings) - Persistent settings, UI feedback
- Phase 3 (db) - Track matching queries
- Phase 4 (api) - Last.fm API wrapper

**Phase 5 enables:**
- Phase 6 (Auto-Mode) - Auto-queue trigger
- Phase 7 (MM5 Integration) - Action handlers
- Phase 8+ (Advanced Features) - Filtering, weighting, history

## Next: Phase 6 (Auto-Mode)

Phase 6 will implement:
- Playback event listeners
- Threshold detection (near end of playlist)
- Auto-triggering with rate limiting
- Integration with Phase 5 orchestration

---

**For detailed info:** See `PHASE_5_CORE_LOGIC.md`  
**For implementation details:** See `PHASE_5_SUMMARY.md`  
**For project status:** See `PHASE_5_COMPLETE.md`
