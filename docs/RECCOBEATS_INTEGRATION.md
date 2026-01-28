# ReccoBeats API Integration - Usage Guide

This guide explains how to use the ReccoBeats API integration with MatchMonkey to create mood and activity-based playlists.

## Overview

The ReccoBeats integration combines two powerful music discovery APIs:
- **ReccoBeats**: AI-powered mood and activity recommendations
- **Last.fm**: Artist similarity and track popularity data

This hybrid approach provides context-aware playlists tailored to your mood or activity while ensuring tracks are available in your library.

## Features

### Mood-Based Playlists
Create playlists based on emotional states:
- **Energetic**: High-energy, upbeat tracks
- **Relaxed**: Calm, chill music
- **Happy**: Uplifting, positive vibes
- **Sad**: Melancholic, emotional tracks
- **Focused**: Concentration-friendly music

### Activity-Based Playlists
Create playlists optimized for specific activities:
- **Workout**: High tempo, motivating tracks
- **Study**: Instrumental, focus-enhancing music
- **Party**: Danceable, crowd-pleasing hits
- **Sleep**: Soothing, ambient sounds
- **Driving**: Engaging road trip music

## Configuration

### Settings in MediaMonkey

Open MatchMonkey settings (Tools ? Options ? Library ? MatchMonkey):

| Setting | Default | Description |
|---------|---------|-------------|
| **DefaultMood** | `energetic` | Default mood for quick playlists |
| **DefaultActivity** | `workout` | Default activity for quick playlists |
| **HybridMode** | `true` | Combine ReccoBeats + Last.fm (recommended) |
| **MoodActivityBlendRatio** | `0.5` | Blend between seed artists and mood recommendations |

### Blend Ratio Explained

The **Seed/Mood balance** slider controls how results are blended:

| Ratio | Seeds | Mood | Effect |
|-------|-------|------|--------|
| 0% | 0% | 100% | Pure mood discovery - completely new artists |
| 30% | 30% | 70% | Mostly mood-based with some familiar artists |
| **50%** | **50%** | **50%** | **Balanced (default)** - best of both worlds |
| 70% | 70% | 30% | Your taste, mood-enhanced |
| 100% | 100% | 0% | Similar artists with mood filtering |

## Usage

### From JavaScript Console

Generate mood-based playlist:
```javascript
window.matchMonkey.runMoodActivityPlaylist('happy', null);
```

Generate activity-based playlist:
```javascript
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

Use default settings:
```javascript
window.matchMonkey.runMoodActivityPlaylist();
```

### How It Works

The mood/activity discovery follows this workflow:

1. **Seed Collection** (if tracks selected)
   - Extracts unique artists from your selected/playing tracks
   - These become your "seed artists" for personalization

2. **Seed Expansion** (if blend ratio > 0)
   - Uses Last.fm to find artists similar to your seeds
   - Builds a list of "seed-similar" artists

3. **ReccoBeats Query** (if blend ratio < 100%)
   - Fetches mood/activity-appropriate tracks from ReccoBeats API
   - Extracts unique artists from recommendations
   - Uses Last.fm to expand to similar artists

4. **Intelligent Blending**
   - Takes proportional amounts from each source based on blend ratio
   - Interleaves results for variety
   - Deduplicates artists

5. **Library Matching**
   - Searches your MediaMonkey library for tracks
   - Applies quality filters (rating, bitrate preferences)

6. **Playlist Creation**
   - Builds final playlist (optionally shuffled)
   - Respects max track limits

### Progress Tracking

During generation, you'll see informative progress messages:
- "Analyzing mood: energetic..."
- "Finding artists similar to 'Pink Floyd'..."
- "Fetching mood recommendations..."
- "Blending results (50% seeds)..."
- "Searching library (15/30)..."
- "Complete! 45 tracks in 8.2s"

## API Endpoints

The integration uses ReccoBeats API v1:

### Mood Recommendations
```
GET https://api.reccobeats.com/v1/recommendations/mood
Parameters:
  - mood: Target mood (required) - energetic, relaxed, happy, sad, focused
  - genres: Comma-separated genres (optional)
  - limit: Max results (default: 50, max: 100)
```

### Activity Recommendations
```
GET https://api.reccobeats.com/v1/recommendations/activity
Parameters:
  - activity: Target activity (required) - workout, study, party, sleep, driving
  - duration: Duration in minutes (optional, 10-300)
  - limit: Max results (default: 50, max: 100)
```

## Caching

ReccoBeats API responses are cached to avoid redundant API calls:

- **Cache Location**: `window.lastfmCache._reccobeats` Map
- **Cache Key Format**: `reccobeats:[mood|activity]:[value]:[params]`
- **Cache Duration**: Per-session (cleared when `lastfmCache.clear()` is called)
- **Cache Hit Logging**: "Cache hit for 'energetic' (42 tracks)"

### Benefits
- Faster subsequent queries with same parameters
- Reduced API calls during retries
- Better performance when exploring similar moods

### Cache Statistics
```javascript
// Check cache status
window.lastfmCache.getStats();
// Returns: { active: true, similarArtists: 5, topTracks: 12, reccobeats: 3, ... }
```

## Best Practices

### 1. Use Hybrid Mode
Always keep HybridMode enabled for best results. It combines:
- ReccoBeats' AI recommendations for mood accuracy
- Last.fm's similarity data for better library matching

### 2. Select Good Seeds
For personalized results:
- Select 3-5 tracks from artists you enjoy
- Keep genres consistent for cohesive playlists
- Experiment with different seeds for variety

### 3. Adjust Blend Ratio
Start at 50% (balanced), then adjust:
- Too random? Increase to 60-70%
- Too familiar? Decrease to 30-40%

### 4. Set Realistic Duration
For activity-based playlists:
- Match duration to your actual activity time
- Longer durations need more library coverage

### 5. Use Filters
Apply filters for quality control:
- Set MinRating to exclude low-quality tracks
- Enable PreferHighQuality for best versions

## Troubleshooting

### No Results Found
**Causes & Solutions:**
- **No seeds selected**: Select tracks or play something first
- **Low blend ratio with no seeds**: Increase blend ratio or select seeds
- **Narrow library**: Lower MinRating or enable IncludeUnrated
- **Strict blacklist**: Review ArtistBlacklist setting

### Results Too Random
**Causes & Solutions:**
- **Low blend ratio**: Increase to 60-70%
- **No seeds selected**: Select tracks that represent your taste
- **Large library**: Results naturally more varied

### Results Too Similar
**Causes & Solutions:**
- **High blend ratio**: Decrease to 30-40%
- **Too few seeds**: Add more diverse seeds
- **Low similar limit**: Increase SimilarArtistsLimit

### API Errors
**Common Issues:**
- **Network timeout**: Check internet connection, API has 10-second timeout
- **HTTP 429**: Rate limiting - wait and retry
- **Invalid parameters**: Verify mood/activity names are valid

### Performance Tips
- **Reduce limits**: Lower SimilarArtistsLimit to 10-15 for faster results
- **Use caching**: Repeat queries hit cache instantly
- **Limit tracks per artist**: Lower TracksPerArtist to 10

## Advanced Usage

### Custom Mood/Activity Values

Pass any string - the API may support additional values:
```javascript
window.matchMonkey.runMoodActivityPlaylist('melancholic', null);
window.matchMonkey.runMoodActivityPlaylist(null, 'cooking');
```

### Adjust Blend Ratio Programmatically

```javascript
// Set blend ratio (0.0-1.0)
const config = app.getValue('MatchMonkey', {});
config.MoodActivityBlendRatio = 0.7;  // 70% seed artists, 30% mood
app.setValue('MatchMonkey', config);

// Then generate playlist
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

### Seed-Aware Workflow

For best results, combine seeds with mood:

```javascript
// 1. Select Pink Floyd tracks in MediaMonkey
// 2. Run energetic mood playlist
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Result: Energetic tracks from artists similar to Pink Floyd
// With 50% blend: half similar artists, half energetic artists
```

### Check Discovery Status

```javascript
// Check current state
window.matchMonkey.getState();
// Returns: { started: true, autoModeEnabled: false }

// View current settings
app.getValue('MatchMonkey', {});
```

## Version History

### v2.1.0 (Current)
- Added ReccoBeats API integration
- Added mood/activity discovery modes
- Added seed-aware blending with configurable ratio
- Added UI slider for blend ratio control
- Improved progress tracking with time estimates
- Improved caching with statistics

### v2.0.0
- Added track-based discovery
- Added genre-based discovery
- Added auto-queue feature

### v1.x
- Artist-based discovery only

---

**Need Help?**
- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Support**: https://ko-fi.com/remoimparato
