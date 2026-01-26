# ReccoBeats Integration - Quick Reference

## Quick Start

### Enable Mood/Activity Discovery

1. Open MediaMonkey 5
2. Go to **Tools ? Options ? MatchMonkey**
3. Set `MoodDiscoveryEnabled` = `true`
4. Set `HybridMode` = `true` (recommended)
5. Set `MoodActivityBlendRatio` = `0.5` (50% seed + 50% mood, balanced)
6. Choose defaults:
   - `DefaultMood` = 'energetic' (or 'relaxed', 'happy', 'sad', 'focused')
   - `DefaultActivity` = 'workout' (or 'study', 'party', 'sleep', 'driving')

### Generate Playlists

**Important**: Select tracks first to use as seeds for personalized results!

Open JavaScript console (F12) and run:

```javascript
// 1. Select some tracks in MediaMonkey (e.g., Pink Floyd songs)

// 2. Generate mood playlist (energetic tracks similar to Pink Floyd)
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// 3. Generate activity playlist (workout tracks in your style)
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');

// 4. Use defaults from settings
window.matchMonkey.runMoodActivityPlaylist();
```

## Available Moods

| Mood | Description | Use Case |
|------|-------------|----------|
| `energetic` | High-energy, upbeat tracks | Workouts, morning boost |
| `relaxed` | Calm, chill music | Evening wind-down, background |
| `happy` | Uplifting, positive vibes | Good mood enhancement |
| `sad` | Melancholic, emotional tracks | Emotional release, rainy days |
| `focused` | Concentration-friendly music | Study, work, deep focus |

## Available Activities

| Activity | Description | Use Case |
|----------|-------------|----------|
| `workout` | High tempo, motivating tracks | Gym, running, exercise |
| `study` | Instrumental, focus-enhancing | Homework, reading, learning |
| `party` | Danceable, crowd-pleasing hits | Gatherings, celebrations |
| `sleep` | Soothing, ambient sounds | Bedtime, relaxation |
| `driving` | Engaging road trip music | Long drives, commutes |

## Code Examples

### Basic Usage (Seed-Aware)

```javascript
// Step 1: Select tracks you like (seeds)
// Example: Select Pink Floyd tracks in MediaMonkey

// Step 2: Run mood/activity playlist
window.matchMonkey.runMoodActivityPlaylist('happy', null);    // Happy + Pink Floyd style
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');  // Workout + your taste
window.matchMonkey.runMoodActivityPlaylist();                  // Use defaults

// Result: Personalized playlists matching both your taste AND the mood/activity
```

### Advanced Usage

```javascript
// Access modules directly
const mm = window.matchMonkey;
const modules = mm.modules;

// Custom context
const enrichedModules = {
    ...modules,
    _moodActivityContext: {
        context: 'mood',
        value: 'energetic',
        duration: 90  // 90 minutes
    }
};

// Run with custom context
await mm.modules.core.orchestration.generateSimilarPlaylist(
    enrichedModules,
    false,  // not auto-mode
    'mood'  // discovery mode
);
```

### Adjust Blend Ratio

```javascript
// Pure mood discovery (ignore current listening)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0  // 0% seed, 100% mood
});
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Balanced (default)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5  // 50% seed, 50% mood
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Your taste, mood-enhanced
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7  // 70% seed, 30% mood
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);
```

### Check Status

```javascript
// Check if ReccoBeats is loaded
console.log(window.matchMonkeyReccoBeatsAPI ? 'Loaded' : 'Not loaded');

// Check discovery modes
console.log(window.matchMonkeyDiscoveryStrategies.DISCOVERY_MODES);

// Get MatchMonkey state
console.log(window.matchMonkey.getState());
```

## Configuration Quick Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `MoodDiscoveryEnabled` | boolean | false | Enable mood playlists |
| `DefaultMood` | string | 'energetic' | Default mood |
| `DefaultActivity` | string | 'workout' | Default activity |
| `PlaylistDuration` | number | 60 | Target minutes |
| `HybridMode` | boolean | true | ReccoBeats + Last.fm |
| `MoodActivityBlendRatio` | number | 0.5 | Seed vs mood balance |
| `SimilarArtistsLimit` | number | 20 | Max similar artists |
| `TracksPerArtist` | number | 30 | Tracks per artist |
| `MaxPlaylistTracks` | number | 0 | Final limit (0=unlimited) |

### Blend Ratio Guide

| Value | Seed % | Mood % | Behavior |
|-------|--------|--------|----------|
| 0.0 | 0% | 100% | Pure mood discovery |
| 0.3 | 30% | 70% | Mostly mood-based |
| 0.5 | 50% | 50% | **Balanced (default)** |
| 0.7 | 70% | 30% | Your taste, mood-enhanced |
| 1.0 | 100% | 0% | Seed-based, mood-filtered |

## Troubleshooting

### No Results

**Problem**: `runMoodActivityPlaylist()` returns no tracks

**Solutions**:
1. **Select seed tracks first** - The algorithm works best with seeds
2. Check internet connection
3. Verify ReccoBeats API is accessible
4. Try different mood/activity
5. Adjust blend ratio (try 0.5 for balanced)
6. Lower `MinRating` setting
7. Enable `IncludeUnrated`

### Poor Match Quality

**Problem**: Results don't match your taste or mood

**Solutions**:
1. **Adjust blend ratio**:
   - Too random? Increase ratio (more seed-based)
   - Too similar to seeds? Decrease ratio (more mood-based)
2. **Better seed selection**:
   - Select multiple tracks from preferred artists
   - Use diverse seeds for variety
3. **Check mood/activity name**: Some work better than others

### Module Not Loaded

**Problem**: `window.matchMonkeyReccoBeatsAPI is undefined`

**Solutions**:
1. Check console for loading errors
2. Verify `modules/api/reccobeats.js` exists
3. Check `init.js` includes `localRequirejs('modules/api/reccobeats')`
4. Restart MediaMonkey

### API Errors

**Problem**: HTTP errors or API failures

**Solutions**:
1. Check ReccoBeats API status
2. Verify API endpoints are correct
3. Check browser console for detailed errors
4. Try with `HybridMode` = false (Last.fm only)

## Performance Tips

1. **First Run**: Slower (API queries)
2. **Cached Runs**: Much faster (same mood/activity)
3. **Reduce Limits**: Lower `SimilarArtistsLimit` for speed
4. **Use Defaults**: Pre-configured moods/activities are optimized

## Module Locations

```
modules/
??? api/
?   ??? lastfm.js          # Last.fm API
?   ??? reccobeats.js      # ReccoBeats API (NEW)
?   ??? cache.js           # API caching
??? core/
?   ??? discoveryStrategies.js  # Discovery modes (UPDATED)
?   ??? orchestration.js        # Workflow (UPDATED)
??? ...

matchMonkey.js              # Main entry point (UPDATED)
init.js                     # Initialization (UPDATED)
```

## API Endpoints

### ReccoBeats

```
https://api.reccobeats.com/v1/recommendations/mood?mood={mood}&limit={limit}
https://api.reccobeats.com/v1/recommendations/activity?activity={activity}&duration={duration}
```

### Last.fm

```
https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist={artist}&api_key={key}
https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist={artist}&api_key={key}
```

## Testing

Run test script:
```javascript
localRequirejs('test/test_reccobeats')
```

## Documentation

- **Full Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Implementation**: `docs/IMPLEMENTATION_SUMMARY.md`
- **ReccoBeats API**: https://reccobeats.com/docs/apis/reccobeats-api
- **GitHub**: https://github.com/remo-imparato/SimilarArtistsMM5

## Support

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato
