# Phase 6: Quick Start Guide

## What is Phase 6?

**Phase 6: Auto-Mode** implements the automatic playback listener that queues similar artist tracks when the Now Playing playlist approaches its end.

## Core Concept

```
Track plays ? Track changes ? Check: ?2 tracks left?
                                   ?
                              YES ? Queue similar tracks
                                   ?
                              Continue playing
```

## Three Main Functions

### 1. Listener Management

```javascript
const autoMode = require('./modules').core.autoMode;
const state = autoMode.createAutoModeState();

// Attach listener
autoMode.attachAutoModeListener(state, triggerCallback);

// Detach listener
autoMode.detachAutoModeListener(state);

// Sync with settings
autoMode.syncAutoModeListener(state, getSetting, triggerCallback);
```

### 2. Trigger Detection

```javascript
// Check remaining entries (with fallbacks)
const remaining = autoMode.getPlaylistRemaining(player);

// Check if enabled
const enabled = autoMode.isAutoModeEnabled(getSetting);

// Prevent concurrent runs
if (state.autoRunning) {
  // Already running, skip
} else {
  state.autoRunning = true;
  // Do work
  state.autoRunning = false;
}
```

### 3. Toggle & Control

```javascript
// Toggle on/off
const newState = autoMode.toggleAutoMode(
  state, getSetting, setSetting, triggerCallback
);

// Initialize during startup
const state = autoMode.initializeAutoMode(getSetting, triggerCallback);

// Cleanup during shutdown
autoMode.shutdownAutoMode(state);
```

## State Object

```javascript
{
  autoListen: null,           // Listener subscription
  autoRunning: false,         // Prevents concurrent runs
  lastTriggerTime: 0,         // Rate limiting
  triggerCooldown: 5000       // 5 second cooldown
}
```

## How Auto-Mode Works

### Step 1: Initialize
```javascript
const state = autoMode.initializeAutoMode(getSetting, handler);
// Attaches listener if enabled in settings
```

### Step 2: Listen for Track Changes
```javascript
// Listener automatically subscribes to playbackState events
// Fires when: 'trackChanged' event occurs
```

### Step 3: Check Remaining
```javascript
const remaining = autoMode.getPlaylistRemaining(player);
// Returns: 0-N remaining entries
// Uses multiple fallback methods for compatibility
```

### Step 4: Compare to Threshold
```javascript
const threshold = 2;  // Default
if (remaining <= threshold) {
  // Trigger auto-queue
}
```

### Step 5: Rate Limiting
```javascript
const timeSince = Date.now() - state.lastTriggerTime;
if (timeSince < state.triggerCooldown) {
  // Cooldown active, skip
} else {
  // Update time and proceed
  state.lastTriggerTime = Date.now();
}
```

### Step 6: Call Phase 5
```javascript
const result = await generateSimilarPlaylist(modules, true);
// autoMode=true applies conservative limits:
// - seedLimit: 2
// - tracksPerArtist: 2
// - totalLimit: 10
// - Forces enqueue mode
```

## Common Tasks

### Enable Auto-Mode
```javascript
autoMode.setSetting('OnPlay', true);
autoMode.syncAutoModeListener(state, getSetting, handler);
```

### Disable Auto-Mode
```javascript
autoMode.setSetting('OnPlay', false);
autoMode.syncAutoModeListener(state, getSetting, handler);
```

### Toggle (UI Button)
```javascript
const newEnabled = autoMode.toggleAutoMode(
  state, getSetting, setSetting, handler,
  (enabled) => updateUI(enabled)
);
```

### Create Custom Handler
```javascript
const handler = autoMode.createAutoTriggerHandler({
  getSetting,
  generateSimilarPlaylist: (autoFlag) => 
    orchestration.generateSimilarPlaylist(modules, autoFlag),
  showToast,
  isAutoModeEnabled: (s) => autoMode.isAutoModeEnabled(getSetting),
  threshold: 3,  // Custom threshold
  logger: myLogger,
});
```

### Check Current Status
```javascript
const enabled = autoMode.isAutoModeEnabled(getSetting);
const remaining = autoMode.getPlaylistRemaining(player);
const isRunning = state.autoRunning;

console.log(`Auto-mode: ${enabled ? 'ON' : 'OFF'}`);
console.log(`Remaining: ${remaining} tracks`);
console.log(`Running: ${isRunning}`);
```

## Integration Points

**With Phase 5 (Orchestration):**
```javascript
// Phase 6 calls Phase 5 with autoMode=true
await generateSimilarPlaylist(modules, true);
// Phase 5 applies auto-mode configuration
```

**With Phase 2 (Settings):**
```javascript
// Reads 'OnPlay' setting to determine if enabled
const enabled = getSetting('OnPlay', false);
```

**With Phase 2 (Notifications):**
```javascript
// Shows toast notifications to user
showToast('Queuing similar artists...', 'info');
showToast('Added X tracks', 'success');
```

## Error Handling

All functions handle errors gracefully:

```javascript
try {
  const attached = autoMode.attachAutoModeListener(state, handler);
} catch (e) {
  console.error(`Error: ${e.message}`);
  // State still usable, can retry
}
```

## Remaining Entries Fallback Chain

The system checks remaining tracks in this order:

**1. Modern MM5 API**
```javascript
remaining = player.entriesCount - player.getCountOfPlayedEntries()
```

**2. Older MM5 API**
```javascript
remaining = player.playlist.count() - player.playlist.getCursor()
```

**3. Fallback Estimate**
```javascript
remaining = player.getSongList().getTracklist().count
```

This ensures compatibility across MM5 versions.

## Rate Limiting

Auto-mode prevents rapid re-triggering:

```javascript
const cooldown = 5000;  // 5 seconds
const timeSince = now - state.lastTriggerTime;

if (timeSince < cooldown) {
  // Skip trigger (cooldown active)
} else {
  // Proceed with trigger
}
```

This ensures smooth playback without interrupt-heavy auto-queuing.

## Testing Scenarios

1. **Enable Auto-Mode**
   - Toggle on in settings
   - Listener should attach
   - Check log: "Listener attached"

2. **Play Near End**
   - Create Now Playing with 3 tracks
   - Play until 2 tracks remain
   - Check: Auto-queue should fire

3. **Rate Limiting**
   - Trigger auto-queue
   - Trigger again immediately (within 5s)
   - Second trigger should be skipped

4. **Concurrent Prevention**
   - Trigger auto-queue
   - Trigger again while running
   - Second trigger should be skipped

5. **Disable Auto-Mode**
   - Toggle off in settings
   - Listener should detach
   - Auto-queue should stop

6. **Settings Persistence**
   - Enable/disable multiple times
   - Refresh app
   - Setting should persist

## Configuration

Auto-mode uses these settings:

| Setting | Auto-Mode Value | Purpose |
|---------|-----------------|---------|
| OnPlay | true/false | Enable/disable |
| Seed | 2 | Seed artists (conservative) |
| TPA | 2 | Tracks per artist (conservative) |
| Total | 10 | Total tracks (conservative) |
| Enqueue | true | Force queue mode |
| ShowConfirm | false | Skip dialog |

All values are automatically applied when `autoMode=true` in Phase 5.

## Logging

Enable detailed logging:

```javascript
autoMode.initializeAutoMode(
  getSetting,
  handler,
  (msg) => console.log(`[Auto-Mode] ${msg}`)
);
```

## Troubleshooting

### Listener not attaching?
- Check `app` and `app.listen` available
- Check `getSetting('OnPlay')` returns true
- Check `createAutoTriggerHandler` provides valid callback

### Trigger not firing?
- Check remaining entries: `getPlaylistRemaining(player)`
- Check threshold: default is 2
- Check cooldown: 5-second minimum between triggers
- Check console logs for error messages

### Tracks not added?
- Check Phase 5 `generateSimilarPlaylist` is working
- Check Network/Last.fm API available
- Check library has tracks
- Check `showToast` for error messages

## Examples

### Full Setup

```javascript
const modules = require('./modules');
const { autoMode, orchestration } = modules.core;
const { getSetting, setSetting } = modules.settings.storage;
const { showToast } = modules.ui.notifications;

// 1. Create handler
const handler = autoMode.createAutoTriggerHandler({
  getSetting,
  generateSimilarPlaylist: (autoFlag) =>
    orchestration.generateSimilarPlaylist(modules, autoFlag),
  showToast,
  isAutoModeEnabled: (s) => autoMode.isAutoModeEnabled(getSetting),
});

// 2. Initialize (during app startup)
const state = autoMode.initializeAutoMode(getSetting, handler);

// 3. User toggles auto-mode
function toggleAutoModeUI() {
  const newEnabled = autoMode.toggleAutoMode(
    state, getSetting, setSetting, handler,
    (enabled) => updateUIIcon(enabled)
  );
}

// 4. Cleanup (during app shutdown)
autoMode.shutdownAutoMode(state);
```

### Usage in Action Handler

```javascript
actions.SimilarArtistsToggleAuto = {
  title: 'Toggle Auto-Queue',
  icon: (state.autoListen ? 'pause' : 'play'),
  execute: function() {
    const newState = autoMode.toggleAutoMode(
      state, getSetting, setSetting, handler,
      (enabled) => updateUI(enabled)
    );
    showToast(`Auto-mode: ${newState ? 'enabled' : 'disabled'}`);
  }
};
```

## See Also

- `PHASE_6_AUTO_MODE.md` - Detailed documentation
- `PHASE_5_QUICK_START.md` - Phase 5 (Orchestration)
- `modules/core/autoMode.js` - Implementation code
