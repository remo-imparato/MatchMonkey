# ReccoBeats API Integration - Usage Guide

This guide explains how to use the new ReccoBeats API integration with MatchMonkey to create mood and activity-based playlists.

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

Open MatchMonkey settings to configure:

1. **MoodDiscoveryEnabled** (false): Enable mood-based discovery
2. **DefaultMood** ('energetic'): Default mood for quick playlists
3. **DefaultActivity** ('workout'): Default activity for quick playlists
4. **PlaylistDuration** (60): Target duration in minutes
5. **HybridMode** (true): Combine ReccoBeats + Last.fm (recommended)
6. **MoodActivityBlendRatio** (0.5): Blend ratio between seed artists and mood recommendations
   - `0.0` = 100% mood-based (ignore seeds)
   - `0.5` = 50% seed artists + 50% mood artists (balanced)
   - `1.0` = 100% seed-based (mood-filtered)

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

1. **Seed Analysis**: Extracts unique artists from your selected/playing tracks
2. **Seed Expansion**: Uses Last.fm to find similar artists to your seeds
3. **ReccoBeats Query**: Fetches mood/activity-appropriate tracks and artists
4. **Intelligent Blending**: Combines both approaches using configurable ratio:
   - Seed-based component: Artists similar to what you're listening to
   - Mood-based component: AI-recommended artists matching the mood/activity
   - Default 50/50 blend ensures both personalization and context-awareness
5. **Artist Deduplication**: Removes duplicate artists from blended list
6. **Last.fm Expansion**: Finds similar artists using Last.fm (if in hybrid mode)
7. **Library Matching**: Searches your MediaMonkey library
8. **Quality Filtering**: Applies rating, bitrate preferences
9. **Playlist Creation**: Builds final playlist

### Blend Ratio Examples

| Ratio | Behavior | Use Case |
|-------|----------|----------|
| 0.0 | 100% mood-based | Discover completely new artists for a mood |
| 0.3 | 30% seeds, 70% mood | Mostly mood-based with some familiarity |
| 0.5 | 50% seeds, 50% mood | **Balanced** (default) |
| 0.7 | 70% seeds, 30% mood | Your taste, mood-filtered |
| 1.0 | 100% seed-based | Similar artists with mood characteristics |

## API Endpoints

The integration uses ReccoBeats API v1:

### Mood Recommendations
```
GET https://api.reccobeats.com/v1/recommendations/mood
Parameters:
  - mood: Target mood (required)
  - genres: Comma-separated genres (optional)
  - limit: Max results (default: 50)
```

### Activity Recommendations
```
GET https://api.reccobeats.com/v1/recommendations/activity
Parameters:
  - activity: Target activity (required)
  - duration: Duration in minutes (optional)
  - limit: Max results (default: 50)
```

## Caching

ReccoBeats API responses are cached using the existing MatchMonkey cache system:
- Cache key format: `reccobeats:[mood|activity]:[value]:[params]`
- Cache duration: Per-session (cleared on restart)
- Benefits: Faster subsequent queries, reduced API calls

## Best Practices

1. **Use Hybrid Mode**: Always keep HybridMode enabled for best results
2. **Seed Genres**: Play tracks with proper genre tags for better recommendations
3. **Library Coverage**: Works best with diverse music library
4. **Duration Setting**: Set realistic PlaylistDuration for your use case
5. **Filter Settings**: Use MinRating to ensure quality tracks

## Troubleshooting

### No Results Found
- **Check library**: Ensure you have tracks from recommended artists
- **Broaden filters**: Lower MinRating or enable IncludeUnrated
- **Try different mood**: Some moods may have better artist coverage

### API Errors
- **Network issues**: Check internet connection
- **Rate limiting**: Wait a moment and retry
- **Invalid parameters**: Verify mood/activity names are correct

### Performance
- **First run slow**: Initial API queries take time
- **Subsequent faster**: Caching improves repeat queries
- **Reduce limits**: Lower SimilarArtistsLimit for faster results

## Advanced Usage

### Custom Mood/Activity Values

You can pass custom mood/activity strings:
```javascript
window.matchMonkey.runMoodActivityPlaylist('melancholic', null);
window.matchMonkey.runMoodActivityPlaylist(null, 'cooking');
```

### Adjust Blend Ratio

Control how much seed artists vs mood recommendations:

```javascript
// Set blend ratio (0.0-1.0)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7  // 70% seed artists, 30% mood
});

// Then generate playlist
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

**Blend Ratio Guide**:
- `0.0` - Pure mood discovery (ignore current listening)
- `0.3` - Mostly mood-based with some seed influence
- `0.5` - **Balanced** (default) - Best of both worlds
- `0.7` - Your musical taste, mood-enhanced
- `1.0` - Pure seed-based (mood characteristics applied)

### Seed-Aware Mood Playlists

The best way to use mood/activity discovery is with seeds:

1. **Select tracks** you're currently enjoying
2. **Run mood playlist** with your target mood
3. **Get results** that match both your taste AND the mood

Example workflow:
```javascript
// You're listening to Pink Floyd
// Want energetic playlist in that style

// 1. Select Pink Floyd tracks in MediaMonkey
// 2. Open console and run:
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Result: Energetic tracks from artists similar to Pink Floyd
