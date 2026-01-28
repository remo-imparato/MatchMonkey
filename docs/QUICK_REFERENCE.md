# MatchMonkey - Complete Quick Reference

## Discovery Modes

MatchMonkey supports **5 discovery modes**:

### 1. Artist-Based Discovery
```javascript
window.matchMonkey.runMatchMonkey(false, 'artist');
```
- Uses Last.fm `artist.getSimilar`
- Finds similar artists to your seeds
- Gets top tracks for each artist
- Best for: Genre exploration

### 2. Track-Based Discovery
```javascript
window.matchMonkey.runMatchMonkey(false, 'track');
```
- Uses Last.fm `track.getSimilar`
- Finds musically similar tracks
- Crosses artist boundaries
- Best for: Finding covers, versions, similar songs

### 3. Genre-Based Discovery
```javascript
window.matchMonkey.runMatchMonkey(false, 'genre');
```
- Uses Last.fm `tag.getTopArtists`
- Extracts genres from seeds
- Gets top artists in those genres
- Best for: Broad genre exploration

### 4. Mood-Based Discovery (ReccoBeats AI)
```javascript
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```
- Uses ReccoBeats AI + Last.fm hybrid
- Seed-aware (respects your taste)
- Configurable blend ratio
- Best for: Emotional context

### 5. Activity-Based Discovery (ReccoBeats AI)
```javascript
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```
- Uses ReccoBeats AI + Last.fm hybrid
- Duration-aware
- Activity-optimized
- Best for: Specific use cases

---

## Quick Start

### Enable Mood/Activity Discovery

1. Open MediaMonkey 5
2. Go to **Tools ? Options ? Library ? MatchMonkey**
3. Enable "Mood/activity discovery"
4. Set blend ratio to 50% (balanced)
5. Choose default mood and activity

### Generate Playlists

**Artist-Based**:
```javascript
// Select artist tracks, then:
window.matchMonkey.runMatchMonkey(false, 'artist');
```

**Track-Based**:
```javascript
// Select specific tracks, then:
window.matchMonkey.runMatchMonkey(false, 'track');
```

**Genre-Based**:
```javascript
// Select genre-tagged tracks, then:
window.matchMonkey.runMatchMonkey(false, 'genre');
```

**Mood-Based**:
```javascript
// Select favorite tracks, then:
window.matchMonkey.runMoodActivityPlaylist('happy', null);
```

**Activity-Based**:
```javascript
// Select appropriate tracks, then:
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

---

## Configuration Settings

### Playlist Creation

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **PlaylistName** | String | `- Similar to %` | Template for playlist names (`%` = artist) |
| **ParentPlaylist** | String | (empty) | Parent playlist for organization |
| **PlaylistMode** | Dropdown | Create new | Create/Overwrite/Don't create |
| **ShowConfirmDialog** | Boolean | false | Show dialog before creating |
| **ShuffleResults** | Boolean | true | Randomize track order |
| **IncludeSeedArtist** | Boolean | true | Include original artists |

**Effects**:
- **PlaylistName**: Customizes output playlist naming
- **ParentPlaylist**: Organizes playlists hierarchically
- **PlaylistMode**: Controls playlist creation behavior
- **ShowConfirmDialog**: Allows manual playlist selection
- **ShuffleResults**: Prevents clustered artist runs
- **IncludeSeedArtist**: Includes/excludes seed tracks

---

### Discovery Limits

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **SimilarArtistsLimit** | Number | 20 | Max similar artists per seed |
| **TrackSimilarLimit** | Number | 100 | Max similar tracks per seed |
| **TracksPerArtist** | Number | 30 | Tracks to fetch per artist |
| **MaxPlaylistTracks** | Number | 0 | Final playlist size (0=unlimited) |
| **UseLastfmRanking** | Boolean | true | Sort by Last.fm popularity |
| **PreferHighQuality** | Boolean | true | Choose higher bitrate/rating |

**Effects**:
- **SimilarArtistsLimit**: Higher = more variety, slower
- **TrackSimilarLimit**: Higher = better matches (track mode)
- **TracksPerArtist**: Higher = more tracks per artist
- **MaxPlaylistTracks**: Caps final output size
- **UseLastfmRanking**: Popular tracks appear first
- **PreferHighQuality**: Selects best version when duplicates exist

---

### Rating Filter

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **MinRating** | Number | 0 | Minimum track rating (0-100) |
| **IncludeUnrated** | Boolean | true | Allow tracks without ratings |

**Effects**:
- **MinRating**: Filters out low-rated tracks
- **IncludeUnrated**: Includes/excludes unrated tracks

---

### Mood & Activity (ReccoBeats AI)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **DefaultMood** | Dropdown | energetic | Default mood preset |
| **DefaultActivity** | Dropdown | workout | Default activity preset |
| **HybridMode** | Boolean | true | Combine ReccoBeats + Last.fm |
| **MoodActivityBlendRatio** | Slider | 0.5 | Seed vs mood balance (0.0-1.0) |

**Mood Options**: energetic, relaxed, happy, sad, focused
**Activity Options**: workout, study, party, sleep, driving

**Effects**:
- **DefaultMood/Activity**: Used when not specified
- **HybridMode**: Expands ReccoBeats results with Last.fm
- **MoodActivityBlendRatio**: Controls personalization
  - `0.0` = Pure mood discovery
  - `0.5` = Balanced (recommended)
  - `1.0` = Seed-based with mood filter

---

### Auto-Queue (Endless Playback)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **AutoModeEnabled** | Boolean | false | Enable auto-queue |
| **AutoModeDiscovery** | Dropdown | Track | Discovery mode for auto-queue |
| **AutoModeSeedLimit** | Number | 2 | Seeds to process |
| **AutoModeSimilarLimit** | Number | 10 | Similar artists per seed |
| **AutoModeTracksPerArtist** | Number | 5 | Tracks per artist |
| **AutoModeMaxTracks** | Number | 30 | Max tracks per trigger |
| **SkipDuplicates** | Boolean | true | Skip tracks in queue |

**AutoModeDiscovery Options**: Artist, Track, Genre

**Effects**:
- **AutoModeEnabled**: Automatically adds tracks when queue is low
- **AutoModeDiscovery**: Determines discovery algorithm
- **Limits**: Control auto-queue performance and size
- **SkipDuplicates**: Prevents repeated tracks

---

### Queue Behavior

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **EnqueueMode** | Boolean | false | Add to Now Playing |
| **ClearQueueFirst** | Boolean | false | Clear queue before adding |
| **NavigateAfter** | Dropdown | Navigate to new | Where to navigate after |

**NavigateAfter Options**: Navigate to new playlist, Navigate to now playing, Stay in current view

**Effects**:
- **EnqueueMode**: Bypasses playlist creation, adds to queue
- **ClearQueueFirst**: Replaces current queue
- **NavigateAfter**: Controls UI navigation post-generation

---

### Filters (Advanced)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **ArtistBlacklist** | String | (empty) | Excluded artists (comma-separated) |
| **GenreBlacklist** | String | (empty) | Excluded genres (comma-separated) |
| **TitleExclusions** | String | (empty) | Excluded title words (comma-separated) |

**Effects**:
- **ArtistBlacklist**: Completely skips listed artists
- **GenreBlacklist**: Skips tracks with listed genres
- **TitleExclusions**: Skips tracks with words in title (e.g., "Live", "Remix")

---

## Available Moods

| Mood | Description | Use Case |
|------|-------------|----------|
| `energetic` | High-energy, upbeat tracks | Workouts, morning boost |
| `relaxed` | Calm, chill music | Evening wind-down, background |
| `happy` | Uplifting, positive vibes | Good mood enhancement |
| `sad` | Melancholic, emotional tracks | Emotional release, rainy days |
| `focused` | Concentration-friendly music | Study, work, deep focus |

---

## Available Activities

| Activity | Description | Use Case |
|----------|-------------|----------|
| `workout` | High tempo, motivating tracks | Gym, running, exercise |
| `study` | Instrumental, focus-enhancing | Homework, reading, learning |
| `party` | Danceable, crowd-pleasing hits | Gatherings, celebrations |
| `sleep` | Soothing, ambient sounds | Bedtime, relaxation |
| `driving` | Engaging road trip music | Long drives, commutes |

---

## Blend Ratio Guide

| Value | Seed % | Mood % | Behavior | Use When |
|-------|--------|--------|----------|----------|
| 0.0 | 0% | 100% | Pure mood discovery | Want completely new music |
| 0.2 | 20% | 80% | Mostly mood-based | Adventurous discovery |
| 0.3 | 30% | 70% | More discovery | Expand beyond comfort zone |
| 0.5 | 50% | 50% | **Balanced (default)** | **Most users** |
| 0.7 | 70% | 30% | More familiar | Your taste with mood |
| 0.8 | 80% | 20% | Mostly seeds | Safe exploration |
| 1.0 | 100% | 0% | Seed-based filter | Minimal discovery |

---

## Code Examples

### Basic Artist Discovery
```javascript
// Select Pink Floyd tracks
window.matchMonkey.runMatchMonkey(false, 'artist');
// Result: Progressive rock artists
```

### Track-Based Discovery
```javascript
// Select "Bohemian Rhapsody"
window.matchMonkey.runMatchMonkey(false, 'track');
// Result: Similar epic rock songs
```

### Genre Exploration
```javascript
// Select jazz tracks
window.matchMonkey.runMatchMonkey(false, 'genre');
// Result: Top jazz artists
```

### Mood Playlist (Seed-Aware)
```javascript
// Select favorite rock tracks
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
// Result: Energetic rock (50% similar + 50% energetic)
```

### Activity Playlist
```javascript
// Select metal tracks
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
// Result: 60-minute heavy workout mix
```

### Adjust Blend Ratio
```javascript
// Pure mood discovery
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0
});

// Balanced (default)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5
});

// Your taste, mood-enhanced
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7
});
```

### Configure Limits
```javascript
// Faster, more focused
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    SimilarArtistsLimit: 10,
    TracksPerArtist: 15,
    MaxPlaylistTracks: 50
});

// Slower, more variety
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    SimilarArtistsLimit: 30,
    TracksPerArtist: 40,
    MaxPlaylistTracks: 0  // Unlimited
});
```

---

## Effect of Settings on Results

### High Similar Artists Limit (30+)
- ? More variety
- ? Broader discovery
- ? Slower generation
- ? Less focused results

### Low Similar Artists Limit (5-10)
- ? Faster generation
- ? More focused results
- ? Less variety
- ? May repeat artists

### High Tracks Per Artist (40+)
- ? Deep artist coverage
- ? More album tracks
- ? Slower generation
- ? May cluster artists

### Low Tracks Per Artist (5-10)
- ? Faster generation
- ? Only top tracks
- ? Limited coverage
- ? Misses deep cuts

### UseLastfmRanking = true
- ? Popular tracks first
- ? Crowd-pleasing
- ? Misses hidden gems
- ? Less diversity

### UseLastfmRanking = false
- ? Includes deep cuts
- ? More diversity
- ? May include obscure tracks
- ? Less consistent quality

### PreferHighQuality = true
- ? Best versions selected
- ? Higher bitrate preference
- ? May skip some versions

### PreferHighQuality = false
- ? All versions considered
- ? May get lower quality
- ? Random version selection

---

## Troubleshooting

### No Results

**Problem**: Playlist has no tracks

**Causes & Solutions**:
1. **No internet**: APIs require online access
2. **No seeds selected**: Select tracks first (except genre/mood pure discovery)
3. **Rating filter too high**: Lower MinRating or enable IncludeUnrated
4. **Blacklist too restrictive**: Check ArtistBlacklist and GenreBlacklist
5. **No library matches**: Try different seeds or discovery mode

### Results Too Random

**Problem**: Tracks don't match your taste

**Causes & Solutions**:
1. **Blend ratio too low**: Increase to 0.7 (mood/activity mode)
2. **Poor seed selection**: Select consistent genre seeds
3. **Genre mode too broad**: Use artist or track mode instead
4. **Similar limit too high**: Lower to 10-15 for focus

### Results Too Similar

**Problem**: All tracks from same artists

**Causes & Solutions**:
1. **Blend ratio too high**: Decrease to 0.3 (mood/activity mode)
2. **Similar limit too low**: Increase to 25-30
3. **Tracks per artist too high**: Lower to 10-15
4. **Try different mode**: Switch from artist to track mode
5. **Enable shuffle**: Check ShuffleResults

### Slow Performance

**Problem**: Takes too long to generate

**Causes & Solutions**:
1. **Similar limit too high**: Lower to 10-15
2. **Tracks per artist too high**: Lower to 10-20
3. **Track similar limit too high**: Lower to 50 (track mode)
4. **Use artist mode**: Fastest discovery mode
5. **Reduce max tracks**: Set MaxPlaylistTracks to 50-100

### Auto-Queue Not Working

**Problem**: No tracks added automatically

**Causes & Solutions**:
1. **Not enabled**: Check AutoModeEnabled
2. **Queue not low enough**: Needs 2 or fewer tracks left
3. **Limits too restrictive**: Check AutoModeSeedLimit, AutoModeSimilarLimit
4. **No seeds available**: Needs tracks in Now Playing history
5. **Check console**: F12 for error messages

---

## Performance Tips

1. **First Run**: Slower (API queries, no cache)
2. **Cached Runs**: Much faster (same seeds/mood)
3. **Artist Mode**: Fastest discovery mode
4. **Track Mode**: Slower (more API calls)
5. **Mood/Activity**: Medium speed (hybrid approach)
6. **Reduce Limits**: Lower for speed, higher for variety

---

## Keyboard Shortcuts

**In Options Panel** (Slider focused):
- **Left Arrow**: Decrease blend ratio 10%
- **Right Arrow**: Increase blend ratio 10%
- **Home**: Jump to 0% (all mood)
- **End**: Jump to 100% (all seeds)
- **Page Up**: Jump to 75%
- **Page Down**: Jump to 25%

---

## Module Locations

```
modules/
??? api/
?   ??? lastfm.js          # Last.fm API
?   ??? reccobeats.js      # ReccoBeats API
?   ??? cache.js           # API caching
??? core/
?   ??? discoveryStrategies.js  # 5 discovery modes
?   ??? orchestration.js        # Workflow
??? db/
?   ??? library.js         # Library matching
?   ??? playlist.js        # Playlist creation
?   ??? queue.js           # Queue management
??? settings/
?   ??? storage.js         # Settings management
??? ui/
    ??? notifications.js   # Progress tracking

dialogs/dlgOptions/
??? pnl_MatchMonkey.html   # Options UI
??? pnl_MatchMonkey.js     # Options logic
??? pnl_MatchMonkey.css    # Options styling
```

---

## API Endpoints

### ReccoBeats
```
https://api.reccobeats.com/v1/recommendations/mood
https://api.reccobeats.com/v1/recommendations/activity
```

### Last.fm
```
https://ws.audioscrobbler.com/2.0/
  ?method=artist.getSimilar
  ?method=track.getSimilar
  ?method=tag.getTopArtists
  ?method=artist.getInfo
  ?method=artist.getTopTracks
```

---

## Testing

Run test script:
```javascript
localRequirejs('test/test_reccobeats')
```

---

## Documentation

- **Quick Start**: `docs/QUICKSTART.md`
- **Full Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Examples**: `docs/EXAMPLES_TUTORIAL.md`
- **UI Guide**: `docs/UI_CONFIGURATION_GUIDE.md`
- **Implementation**: `docs/IMPLEMENTATION_SUMMARY.md`

---

## Support

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato
