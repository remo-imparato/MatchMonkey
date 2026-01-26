# ?? MatchMonkey Quick Start Guide

## What is MatchMonkey?

MatchMonkey is a powerful MediaMonkey 5 add-on that automatically generates playlists using:
- **Last.fm API** for artist similarity and track popularity
- **ReccoBeats AI** for mood and activity-based recommendations
- **Your local library** for matching tracks you already own

---

## 60-Second Setup

1. **Open MediaMonkey 5**
2. **Select 3-5 tracks** you like (your "seeds")
3. **Open console** (F12)
4. **Run this**:

```javascript
// Basic artist-based discovery (classic mode)
window.matchMonkey.runMatchMonkey(false, 'artist');
```

**Done!** You now have a playlist of similar artists! ??

---

## Discovery Modes

MatchMonkey offers **5 different discovery modes**:

### 1. Artist-Based Discovery (Classic)

Finds similar artists using Last.fm's `artist.getSimilar` API.

```javascript
// Generate playlist from similar artists
window.matchMonkey.runMatchMonkey(false, 'artist');
```

**How it works**:
1. Takes your selected artists as seeds
2. Queries Last.fm for similar artists
3. Gets top tracks for each similar artist
4. Matches tracks in your library

**Best for**: Discovering new artists in the same genre

---

### 2. Track-Based Discovery

Finds musically similar tracks across different artists using Last.fm's `track.getSimilar` API.

```javascript
// Generate playlist from similar tracks
window.matchMonkey.runMatchMonkey(false, 'track');
```

**How it works**:
1. Takes your selected track titles as seeds
2. Queries Last.fm for similar tracks
3. Expands to artists making those tracks
4. Matches tracks in your library

**Best for**: Finding different versions, covers, and musically similar tracks

---

### 3. Genre-Based Discovery

Finds top artists in the same genre using Last.fm's `tag.getTopArtists` API.

```javascript
// Generate playlist from genre artists
window.matchMonkey.runMatchMonkey(false, 'genre');
```

**How it works**:
1. Extracts genres from your selected tracks
2. Queries Last.fm for top artists in those genres
3. Gets tracks from genre-matching artists
4. Matches tracks in your library

**Best for**: Exploring a genre more broadly

---

### 4. Mood-Based Discovery (ReccoBeats AI) ? NEW

Creates playlists matching your emotional state using ReccoBeats AI.

```javascript
// Generate energetic playlist in your style
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

**How it works**:
1. Analyzes your selected tracks (seed artists)
2. Queries ReccoBeats for mood-appropriate tracks
3. Uses Last.fm to find similar artists
4. **Blends both** (configurable ratio)
5. Matches tracks in your library

**Available Moods**:
- `energetic` - High energy, upbeat
- `relaxed` - Calm, chill
- `happy` - Uplifting, positive
- `sad` - Melancholic, emotional
- `focused` - Concentration-friendly

**Best for**: Creating playlists for specific emotional contexts

---

### 5. Activity-Based Discovery (ReccoBeats AI) ? NEW

Creates playlists optimized for specific activities using ReccoBeats AI.

```javascript
// Generate workout playlist in your style
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

**How it works**:
Same as mood-based but optimized for activities with duration targeting.

**Available Activities**:
- `workout` - High tempo, motivating
- `study` - Instrumental, focus-enhancing
- `party` - Danceable, crowd-pleasing
- `sleep` - Soothing, ambient
- `driving` - Engaging, road trip music

**Best for**: Specific activities with timing requirements

---

## Quick Examples

### Example 1: Discover Similar Artists
```javascript
// 1. Select Pink Floyd tracks
// 2. Run:
window.matchMonkey.runMatchMonkey(false, 'artist');
// Result: Progressive rock artists (Yes, Genesis, King Crimson)
```

### Example 2: Find Similar Tracks
```javascript
// 1. Select "Bohemian Rhapsody"
// 2. Run:
window.matchMonkey.runMatchMonkey(false, 'track');
// Result: Epic rock songs, different versions
```

### Example 3: Explore Genre
```javascript
// 1. Select jazz tracks
// 2. Run:
window.matchMonkey.runMatchMonkey(false, 'genre');
// Result: Top jazz artists
```

### Example 4: Mood Playlist
```javascript
// 1. Select your favorite rock tracks
// 2. Run:
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
// Result: Energetic rock playlist (50% similar + 50% energetic)
```

### Example 5: Activity Playlist
```javascript
// 1. Select metal tracks
// 2. Run:
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
// Result: 60-minute workout playlist (heavy metal mix)
```

---

## Mood/Activity Balance Control

The **Seed/Mood balance** slider controls how much of your taste vs mood recommendations:

```javascript
// Pure discovery (0% seeds, 100% mood)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0
});
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Balanced (50% seeds, 50% mood) - RECOMMENDED
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Your taste (70% seeds, 30% mood)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

---

## Using the Options Panel

### Accessing Settings

1. Go to **Tools ? Options**
2. Navigate to **Library ? MatchMonkey**
3. Configure your preferences

### Key Settings

#### Playlist Creation
- **Playlist name**: Template for playlist names (use `%` for artist name)
- **Parent playlist**: Organize results under a parent (optional)
- **Playlist creation**: Create new / Overwrite / Do not create
- **Show confirmation**: Dialog before creating playlist
- **Shuffle results**: Randomize track order
- **Include seed artist**: Include original artists in results

#### Discovery Limits
- **Similar artists per seed**: Max similar artists from Last.fm (20 default)
- **Similar tracks per seed**: Max similar tracks from Last.fm (100 default)
- **Tracks per artist**: Max tracks to fetch per artist (30 default)
- **Max playlist tracks**: Final playlist size (0 = unlimited)
- **Sort by Last.fm popularity**: Prioritize popular tracks
- **Prefer high quality**: Choose higher bitrate/rating versions

#### Rating Filter
- **Minimum rating**: Only include tracks rated at least this high
- **Include unrated**: Allow tracks without ratings

#### Mood & Activity (ReccoBeats AI)
- **Enable mood/activity**: Turn on ReccoBeats integration
- **Default mood**: Mood for quick playlists (energetic, relaxed, happy, sad, focused)
- **Default activity**: Activity for quick playlists (workout, study, party, sleep, driving)
- **Playlist duration**: Target duration in minutes (60 default)
- **Use hybrid mode**: Combine ReccoBeats + Last.fm (recommended)
- **Seed/Mood balance**: Slider (0-100%) controls seed vs mood ratio

#### Auto-Queue (Endless Playback)
- **Enable auto-queue**: Automatically add tracks when playlist ends
- **Discovery mode**: Artist/Track/Genre for auto-mode
- **Auto seeds**: Seeds to process (2 default)
- **Auto similar limit**: Similar artists per seed (10 default)
- **Auto tracks/artist**: Tracks per artist (5 default)
- **Auto max tracks**: Max tracks per trigger (30 default)
- **Skip duplicates**: Don't add tracks already in queue

#### Queue Behavior
- **Enqueue mode**: Add to Now Playing instead of creating playlist
- **Clear queue first**: Clear Now Playing before adding
- **After completion**: Where to navigate (new playlist / now playing / stay)

#### Filters (Advanced)
- **Exclude artists**: Comma-separated artist names to skip
- **Exclude genres**: Comma-separated genres to skip
- **Exclude title words**: Skip tracks with these words (e.g., "Live, Remix")

---

## Common Workflows

### Morning Energy Boost
```javascript
// 1. Select morning favorites
// 2. Tools ? Options ? Set blend ratio to 0.6 (more familiar)
// 3. Run:
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

### Discover New Artists
```javascript
// 1. Select an artist you love
// 2. Run:
window.matchMonkey.runMatchMonkey(false, 'artist');
```

### Study Session
```javascript
// 1. Select instrumental tracks
// 2. Run:
window.matchMonkey.runMoodActivityPlaylist('focused', null);
```

### Workout Mix
```javascript
// 1. Select high-energy tracks
// 2. Tools ? Options ? Set duration to 90 minutes
// 3. Run:
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

### Party Playlist
```javascript
// 1. Don't select anything (pure discovery)
// 2. Tools ? Options ? Set blend ratio to 0.2 (adventurous)
// 3. Run:
window.matchMonkey.runMoodActivityPlaylist(null, 'party');
```

---

## Pro Tips

### ?? Tip 1: Choose the Right Mode
- **Artist mode**: Discover new artists in same genre
- **Track mode**: Find similar songs, covers, versions
- **Genre mode**: Explore a genre broadly
- **Mood mode**: Match emotional state
- **Activity mode**: Optimize for specific use

### ?? Tip 2: Seed Selection Matters
- 3-5 tracks from preferred artists = best results
- Consistent genre = cohesive playlist
- Diverse seeds = variety in results

### ?? Tip 3: Adjust Discovery Limits
Lower limits = faster, more focused results
Higher limits = more variety, slower

### ?? Tip 4: Use Auto-Queue for Endless Music
- Enable in settings
- Choose discovery mode
- Let it run continuously

### ?? Tip 5: Experiment with Blend Ratio
- Start at 50% (balanced)
- Too random? Increase to 70%
- Too boring? Decrease to 30%

---

## Troubleshooting

### No Results Found
**Problem**: Playlist has no tracks

**Solutions**:
1. Check internet connection (APIs require online access)
2. Select seed tracks (most modes work better with seeds)
3. Lower minimum rating filter
4. Enable "Include unrated" option
5. Check artist/genre blacklist

### Results Too Random
**Problem**: Tracks don't match your taste

**Solutions**:
1. Increase blend ratio (for mood/activity mode)
2. Select better seed tracks
3. Use artist mode instead of genre mode
4. Lower similar artists limit

### Results Too Similar
**Problem**: All tracks from same artists

**Solutions**:
1. Decrease blend ratio (for mood/activity mode)
2. Increase similar artists limit
3. Try track or genre mode
4. Enable "Shuffle results"

### Slow Performance
**Problem**: Takes too long to generate

**Solutions**:
1. Lower similar artists limit (try 10-15)
2. Lower tracks per artist (try 10-20)
3. Lower track similar limit (try 50)
4. Use artist mode (fastest)

### Auto-Queue Not Working
**Problem**: No tracks added automatically

**Solutions**:
1. Check "Enable auto-queue" is checked
2. Verify Now Playing has few tracks left
3. Check auto limits aren't too restrictive
4. Review console for errors (F12)

---

## Next Steps

1. ? **Configure Settings**: Tools ? Options ? MatchMonkey
2. ? **Try Each Mode**: Experiment with all 5 discovery modes
3. ? **Find Your Balance**: Adjust blend ratio for mood/activity
4. ? **Set Up Auto-Queue**: Enable endless playback
5. ? **Customize Filters**: Add artist/genre exclusions

---

## Keyboard Shortcuts

When in options panel:
- **Arrow Keys**: Navigate slider
- **Home**: Jump to 0% (all mood)
- **End**: Jump to 100% (all seeds)
- **Page Up/Down**: Quick adjustments

---

## Full Documentation

- **Detailed Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Examples & Tutorials**: `docs/EXAMPLES_TUTORIAL.md`
- **Quick Reference**: `docs/QUICK_REFERENCE.md`
- **UI Configuration**: `docs/UI_CONFIGURATION_GUIDE.md`
- **Enhancement Details**: `docs/SEED_AWARE_ENHANCEMENT.md`

---

## Need Help?

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato

---

**Happy Listening! ??**
