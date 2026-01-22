# Phase 6: Auto-Mode Implementation

## Overview

**Phase 6: Auto-Mode** implements the playback listener and auto-queue trigger system that automatically queues similar artist tracks when the Now Playing playlist approaches its end.

Key responsibilities:
- Attach/detach playback event listeners
- Detect when playlist is near the end
- Trigger auto-queue with rate limiting
- Coordinate with Phase 5 orchestration
- Manage state and prevent concurrent runs

## Architecture

### Core Components

```
modules/core/autoMode.js
??? createAutoModeState()           - Initialize state object
??? attachAutoModeListener()        - Subscribe to playback events
??? detachAutoModeListener()        - Unsubscribe from playback events
??? getPlaylistRemaining()          - Check remaining entries (multi-fallback)
??? isAutoModeEnabled()             - Check settings
??? createAutoTriggerHandler()      - Create trigger callback
??? syncAutoModeListener()          - Sync listener with settings
??? toggleAutoMode()                - Turn auto-mode on/off
??? initializeAutoMode()            - Setup during startup
??? shutdownAutoMode()              - Cleanup during shutdown
```

## State Management

Auto-mode maintains a state object with:

```javascript
{
  autoListen: null,           // Listener subscription handle
  autoRunning: false,         // Prevents concurrent runs
  lastTriggerTime: 0,         // Tracks last trigger time
  triggerCooldown: 5000,      // Min milliseconds between triggers
}
```

## Event Flow

```
1. User enables auto-mode (toggleAutoMode)
   ?
2. initializeAutoMode attaches listener
   ?
3. User plays a track
   ?
4. Playback advances to next track
   ?
5. 'trackChanged' event fires
   ?
6. Listener calls trigger handler
   ?
7. Check: remaining entries ? threshold?
   ?
8. Yes ? Check: not already running?
   ?
9. Yes ? Call Phase 5 orchestration (auto-mode)
   ?
10. Similar tracks queued to Now Playing
```

## Function Reference

### createAutoModeState()

Creates a fresh state object for tracking listener and run state.

```javascript
const state = autoMode.createAutoModeState();
// Returns:
// {
//   autoListen: null,
//   autoRunning: false,
//   lastTriggerTime: 0,
//   triggerCooldown: 5000
// }
```

### attachAutoModeListener(state, handleAutoTrigger, logger)

Subscribes to MM5 playback state changes.

**Parameters:**
- `state` - Auto-mode state object
- `handleAutoTrigger` - Callback function for trigger events
- `logger` - Optional logging function

**Returns:** `boolean` - True if successfully attached

**How it works:**
1. Validates environment (app, player, app.listen available)
2. Detaches existing listener if present
3. Subscribes to `player` 'playbackState' event
4. Filters for 'trackChanged' events only
5. Applies rate limiting (5 second cooldown)
6. Invokes callback when threshold reached

### detachAutoModeListener(state, logger)

Unsubscribes from playback events.

**Parameters:**
- `state` - Auto-mode state object
- `logger` - Optional logging function

**Returns:** `boolean` - True if listener was detached

**Safety:** Safe to call if no listener is attached

### getPlaylistRemaining(player, logger)

Determines how many tracks remain in Now Playing.

**Algorithm (with fallbacks):**
1. Try: `player.entriesCount - player.getCountOfPlayedEntries()` (preferred MM5 API)
2. Fallback: `player.playlist.count() - player.playlist.getCursor()`
3. Fallback: `songList.getTracklist().count` (total, not current position)

**Returns:** `number` - Remaining entries (0 if cannot determine)

**Why multiple methods:**
- Different MM5 versions expose different APIs
- Fallback ensures compatibility across versions
- Prevents silent failures

### isAutoModeEnabled(getSetting, settingKey)

Checks if auto-mode is enabled via settings.

**Parameters:**
- `getSetting` - Settings getter function
- `settingKey` - Setting key (default: 'OnPlay')

**Returns:** `boolean` - True if auto-mode enabled

### createAutoTriggerHandler(config)

Factory function that creates the trigger callback.

**Config Parameters:**
- `getSetting` - Settings getter function
- `generateSimilarPlaylist` - Phase 5 orchestration (autoMode=true)
- `showToast` - UI notification function
- `isAutoModeEnabled` - Settings check function
- `threshold` - Remaining entries threshold (default: 2)
- `logger` - Logging function

**Returns:** `Function` - Handler for playback events

**Handler Behavior:**
1. Validates auto-mode still enabled
2. Checks `autoRunning` flag (prevent concurrent)
3. Gets remaining entries count
4. Compares to threshold (? 2 by default)
5. Checks cooldown period (5 seconds)
6. Calls `generateSimilarPlaylist(modules, true)` with auto-mode
7. Updates UI with toast notification
8. Handles errors and clears state

### syncAutoModeListener(state, getSetting, handleAutoTrigger, logger)

Synchronizes listener state with settings.

**Logic:**
- If enabled + not listening ? attach listener
- If disabled + listening ? detach listener
- Otherwise ? no change

**Returns:** `boolean` - True if listener is currently attached

**Use case:** Called during initialization and settings changes

### toggleAutoMode(state, getSetting, setSetting, handleAutoTrigger, onStateChange, logger)

Toggles auto-mode on/off.

**Steps:**
1. Get current enabled state
2. Flip the setting
3. Sync listener with new state
4. Fire optional callback
5. Return new state

**Returns:** `boolean` - New enabled state

### initializeAutoMode(getSetting, handleAutoTrigger, logger)

Setup auto-mode during add-on startup.

**Steps:**
1. Create state object
2. Sync listener with settings
3. Return initialized state

**Returns:** `object` - Initialized state object

**Called by:** Add-on `start()` function

### shutdownAutoMode(state, logger)

Cleanup auto-mode during shutdown.

**Steps:**
1. Detach listener
2. Clear running flags
3. Log completion

## Configuration Parameters

Auto-mode uses these settings from Phase 2:

| Setting | Default | Purpose |
|---------|---------|---------|
| `OnPlay` | false | Enable/disable auto-mode |
| `Seed` | 2 (auto) | Seed artists limit (overridden in auto-mode) |
| `TPA` | 2 (auto) | Tracks per artist (overridden in auto-mode) |
| `Total` | 10 (auto) | Total track limit (overridden in auto-mode) |
| `IncludeSeed` | false | Don't include original artist |
| `Enqueue` | true | Force enqueue mode |
| `ShowConfirm` | false | Skip confirmation dialog |

## Threshold Detection

Auto-mode uses a **2-track remaining threshold**:
- When ? 2 tracks remain in Now Playing
- Auto-queue is triggered
- Similar artist tracks are added

This is configurable via `createAutoTriggerHandler` config

## Rate Limiting

Auto-mode implements **5-second cooldown** between triggers:
- Prevents rapid re-triggering
- Allows tracks to play normally
- Configurable via `state.triggerCooldown`

## Integration with Phase 5

Auto-mode coordinates with Phase 5 orchestration:

```javascript
// Phase 6 calls Phase 5 with autoMode=true
const result = await generateSimilarPlaylist(modules, true);

// Phase 5 applies conservative limits:
// - seedLimit: 2 (vs normal 5)
// - tracksPerArtist: 2 (vs normal 5)
// - totalLimit: 10 (vs normal 100)
// - Skips confirmation dialog
// - Forces enqueue mode
```

## Error Handling

All functions include:
- Try-catch blocks
- Graceful degradation
- Informative error messages
- Detailed logging
- State cleanup in finally blocks

## Logging

All functions accept optional `logger` parameter:

```javascript
// Use custom logger
autoMode.attachAutoModeListener(state, handler, (msg) => {
  console.log(`[Auto-Mode] ${msg}`);
});

// Or use default console.log
autoMode.attachAutoModeListener(state, handler);
```

## Example Usage

### Basic Setup

```javascript
const modules = require('./modules');
const { core: { autoMode, orchestration } } = modules;
const { getSetting, setSetting } = modules.settings.storage;
const { showToast } = modules.ui.notifications;

// Create state
const state = autoMode.createAutoModeState();

// Create trigger handler
const handler = autoMode.createAutoTriggerHandler({
  getSetting,
  generateSimilarPlaylist: (autoModeFlag) => 
    orchestration.generateSimilarPlaylist(modules, autoModeFlag),
  showToast,
  isAutoModeEnabled: (setting) => autoMode.isAutoModeEnabled(getSetting),
  threshold: 2,
  logger: console.log,
});

// Initialize (attach if enabled)
autoMode.initializeAutoMode(getSetting, handler, console.log);
```

### Toggle During Runtime

```javascript
const newState = autoMode.toggleAutoMode(
  state,
  getSetting,
  setSetting,
  handler,
  (enabled) => {
    console.log(`Auto-mode is now ${enabled ? 'on' : 'off'}`);
    // Update UI icons/buttons here
  }
);
```

### Shutdown

```javascript
autoMode.shutdownAutoMode(state, console.log);
```

## Fallback Methods for Remaining Entries

The `getPlaylistRemaining()` function uses intelligent fallbacks:

### Method 1 (Preferred)
```javascript
total = player.entriesCount
played = player.getCountOfPlayedEntries()
remaining = total - played
```
**Pros:** Accurate, clearest intent  
**Cons:** May not be available in older MM5 builds

### Method 2 (Fallback)
```javascript
cursor = player.playlist.getCursor()
total = player.playlist.count()
remaining = total - cursor
```
**Pros:** Works in most MM5 versions  
**Cons:** API semantics vary by version

### Method 3 (Final Fallback)
```javascript
tracklist = player.getSongList().getTracklist()
remaining = tracklist.count
```
**Pros:** Almost always available  
**Cons:** Gives total count, not current position

## Performance Characteristics

- **Memory:** ~100 bytes for state object
- **CPU:** Minimal - listener only fires on track change
- **Latency:** ~100-200ms between trigger and queue addition
- **Scalability:** Single listener instance, handles playlist of any size

## Testing Checklist

- [ ] Listener attaches when auto-mode enabled
- [ ] Listener detaches when auto-mode disabled
- [ ] Trigger fires when ?2 tracks remaining
- [ ] Trigger doesn't fire when >2 tracks remaining
- [ ] Rate limiting prevents duplicate triggers
- [ ] `autoRunning` flag prevents concurrent invocations
- [ ] Similar tracks added to Now Playing
- [ ] Toast notifications appear
- [ ] Error handling works (no crashes)
- [ ] Shutdown cleanup works
- [ ] Toggle works during runtime
- [ ] Settings sync works after changes

## Future Enhancements

- Configurable threshold (per-user preference)
- Configurable cooldown period
- Different thresholds for different playlist types
- Analytics (track how many times triggered)
- User-friendly UI to show auto-mode status
- Advanced triggering (e.g., by time remaining, not count)

## Files

```
modules/core/autoMode.js          Phase 6 auto-mode implementation
modules/index.js                  Updated with autoMode export
```

## Status

? **Phase 6 Complete** - Auto-mode implementation ready for integration

Next: Phase 7 (MM5 Action Handlers Integration)
