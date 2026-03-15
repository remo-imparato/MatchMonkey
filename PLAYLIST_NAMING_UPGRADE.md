# Playlist Naming System Upgrade

## Overview
Updated the playlist naming system to use two new replacement placeholders: `%action%` and `%seed%`, replacing the previous single `%` or `%artist%` placeholder system.

## Changes Made

### 1. init.js - Configuration Defaults & Upgrade Path

**Default Value Changed:**
- **Before:** `PlaylistName: ''` (empty string for auto-generation)
- **After:** `PlaylistName: 'Similar %action% (%seed%)'`

**New Placeholders:**
- `%action%` - Discovery type (Artists, Tracks, Genres, Acoustics, mood name, activity name)
- `%seed%` - Seed summary (artist names, genre names, or selection)
- `%` - Legacy placeholder (backward compatible, same as %seed%)

**Upgrade Logic Added:**
- Added Step 2 in `checkConfig()` to upgrade existing configurations
- Automatically converts `%artist%` → `%seed%` in existing user configs
- Tracks upgraded values and logs them to console
- Example: User had "My %artist% Mix" → automatically upgraded to "My %seed% Mix"

**Example Generated Names:**
- Artists: "Similar Artists (The Beatles, Pink Floyd, Muse)"
- Tracks: "Similar Tracks (The Beatles, Metallica...)"
- Genres: "Similar Genres (Rock, Blues, Jazz)"
- Acoustics: "Similar Acoustics (Artist Name)"
- Mood: "Similar Energetic (Artist Name)"
- Activity: "Similar Workout (Artist Name)"

**Custom Template Examples:**
- `"My %action% Mix - %seed%"` → "My Artists Mix - The Beatles, Pink Floyd"
- `"%seed% Radio"` → "The Beatles, Pink Floyd Radio"
- `"Daily %action%"` → "Daily Artists"
- `"%"` → "The Beatles, Pink Floyd" (legacy format)

### 2. modules/core/orchestration.js - Template Processing

**Updated `buildResultsPlaylist()` function:**

**Action Mapping Logic:**
```javascript
// Maps discoveryMode to %action% text:
- 'mood' → Capitalized mood value (e.g., "Energetic")
- 'activity' → Capitalized activity value (e.g., "Workout")
- 'genre' → "Genres"
- 'track' → "Tracks"
- 'acoustics' → "Acoustics"
- 'artist' → "Artists" (default)
```

**Seed Text Selection:**
```javascript
// Uses genre names for genre mode, otherwise artist names
const seedText = (config.discoveryMode === 'genre' && genreName) 
    ? genreName 
    : seedName;
```

**Template Processing:**
```javascript
playlistName = playlistTemplate
    .replace(/%action%/g, actionText)
    .replace(/%seed%/g, seedText)
    .replace(/%/g, seedText); // Legacy % for backward compatibility
```

**Auto-Generation Preserved:**
- When `PlaylistName` is empty string, auto-generation still works
- Each discovery mode has its own specific format
- Maintains existing behavior for users who don't want templates

### 3. dialogs/dlgOptions/pnl_MatchMonkey.js - Documentation

**Updated:**
- Version bumped to 2.2.0
- Updated JSDoc to document new placeholder system
- Config property mapping notes `%action%` and `%seed%` support

## Backward Compatibility

✅ **Full backward compatibility maintained:**

1. **Legacy `%` placeholder** - Still works, treated as `%seed%`
   - Old template: `"% Radio"` → Still works as before
   
2. **Empty string auto-generation** - Still works
   - Users with `PlaylistName: ''` will continue to get auto-generated names
   
3. **Automatic upgrade of `%artist%`** - Seamless migration
   - Old: `"My %artist% Mix"` 
   - Automatically becomes: `"My %seed% Mix"`
   - No user action required

4. **Auto-generation fallback** - Unchanged
   - When no template is provided, same auto-generated names as before

## Testing Recommendations

Test the following scenarios:

### New User (First Install)
- Should get default: `'Similar %action% (%seed%)'`
- Artists search → "Similar Artists (Beatles, Floyd, Muse)"
- Genres search → "Similar Genres (Rock, Blues, Jazz)"
- Mood search → "Similar Energetic (Beatles)"

### Existing User with Empty PlaylistName
- Current: `PlaylistName: ''`
- After upgrade: Gets new default `'Similar %action% (%seed%)'`
- Result: Uses template system instead of pure auto-generation
- Names should be nearly identical to before

### Existing User with Custom Template Using %artist%
- Current: `PlaylistName: "My %artist% Favorites"`
- After upgrade: `"My %seed% Favorites"` (automatic)
- Console logs: "Upgraded 1 value(s): PlaylistName: %artist% → %seed%"

### Existing User with Legacy % Placeholder
- Current: `PlaylistName: "% Radio"`
- After upgrade: No change needed, still works
- `%` is treated as `%seed%` for compatibility

### Custom Templates with New Placeholders
- Template: `"My %action% Mix - %seed%"`
- Artists → "My Artists Mix - Beatles, Floyd"
- Tracks → "My Tracks Mix - Beatles, Metallica"
- Genres → "My Genres Mix - Rock, Blues"
- Mood → "My Energetic Mix - Beatles"

### Discovery Mode Specific Testing
- Last.fm Artist Search: %action% = "Artists"
- Last.fm Track Search: %action% = "Tracks"
- Last.fm Genre Search: %action% = "Genres"
- ReccoBeats Acoustics: %action% = "Acoustics"
- ReccoBeats Mood (energetic): %action% = "Energetic"
- ReccoBeats Activity (workout): %action% = "Workout"

## Migration Flow

```
User starts MediaMonkey
    ↓
init.js loads
    ↓
checkConfig() runs
    ↓
Existing config detected
    ↓
Step 1: Migrate old property names (if any)
    ↓
Step 2: **NEW** Upgrade %artist% → %seed% (if present)
    ↓
Step 3: Add missing default keys (including new PlaylistName default)
    ↓
Step 4: Remove deprecated keys
    ↓
Save updated config
    ↓
Log upgrade actions to console
```

## Benefits

1. **More Flexible** - Two placeholders provide more control
2. **Clearer Naming** - `%seed%` is more general than `%artist%` (works for genres too)
3. **Discovery Type Visibility** - `%action%` shows what kind of search was performed
4. **Better Default** - Template-based default gives consistent format
5. **Seamless Migration** - Existing users upgraded automatically
6. **Backward Compatible** - Old templates continue to work
