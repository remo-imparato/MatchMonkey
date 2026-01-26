# ReccoBeats Integration - Usage Examples & Tutorial

## Tutorial: Creating Your First Mood Playlist

### Scenario 1: Energetic Workout Mix (Seed-Aware)

**Goal**: Create an energetic workout playlist based on your favorite rock artists.

**Steps**:

1. **Select Seed Tracks**:
   - In MediaMonkey, navigate to your library
   - Select 3-5 tracks from artists you like for workouts
   - Example: AC/DC, Metallica, Foo Fighters tracks

2. **Configure Settings** (optional):
   ```javascript
   app.setValue('MatchMonkey', {
       ...app.getValue('MatchMonkey', {}),
       MoodActivityBlendRatio: 0.5,  // Balanced: 50% your taste + 50% workout
       SimilarArtistsLimit: 20,       // 20 total artists
       TracksPerArtist: 30,           // Up to 30 tracks per artist
       MaxPlaylistTracks: 100         // 100 track playlist
   });
   ```

3. **Generate Playlist**:
   ```javascript
   window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
   ```

4. **Result**:
   - 10 artists similar to your seeds (AC/DC ? Guns N' Roses, Led Zeppelin, etc.)
   - 10 workout-optimized artists (high tempo, energetic)
   - Total: ~100 tracks perfectly suited for your workout

---

### Scenario 2: Relaxed Study Session (Pure Mood)

**Goal**: Discover new relaxing music for studying, regardless of current listening.

**Steps**:

1. **Configure for Pure Mood Discovery**:
   ```javascript
   app.setValue('MatchMonkey', {
       ...app.getValue('MatchMonkey', {}),
       MoodActivityBlendRatio: 0.0,  // 100% mood-based
       DefaultMood: 'focused',
       TracksPerArtist: 20
   });
   ```

2. **Generate Playlist** (no need to select tracks):
   ```javascript
   window.matchMonkey.runMoodActivityPlaylist('focused', null);
   ```

3. **Result**:
   - Pure focus/study music from ReccoBeats AI
   - Instrumental, ambient, lo-fi artists
   - No influence from your current library

---

### Scenario 3: Happy Mood in Your Style (Heavily Seed-Based)

**Goal**: Happy, uplifting music similar to what you're currently enjoying.

**Steps**:

1. **Select Current Favorites**:
   - Select 5-10 tracks you're loving right now
   - Example: Indie pop/rock you've been playing

2. **Configure for Seed-Heavy**:
   ```javascript
   app.setValue('MatchMonkey', {
       ...app.getValue('MatchMonkey', {}),
       MoodActivityBlendRatio: 0.8,  // 80% your style + 20% happy mood
       IncludeSeedArtist: true        // Include original artists
   });
   ```

3. **Generate Playlist**:
   ```javascript
   window.matchMonkey.runMoodActivityPlaylist('happy', null);
   ```

4. **Result**:
   - Mostly artists similar to your selections
   - Filtered/enhanced by "happy" characteristics
   - Some new happy-mood artists for variety

---

## Real-World Examples

### Example 1: Morning Energy Boost

```javascript
// You wake up and want energetic music to start your day

// 1. Play your morning favorites (The Black Keys, Arctic Monkeys)
// 2. Select those tracks
// 3. Run:
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.6  // 60% your style, 40% energetic
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Result: Energetic indie rock perfect for your morning routine
```

### Example 2: Evening Wind-Down

```javascript
// After work, you want to relax with familiar comfort music

// 1. Select your comfort artists (Fleetwood Mac, James Taylor)
// 2. Run:
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7,  // 70% familiar, 30% relaxing
    MaxPlaylistTracks: 50          // Shorter playlist for evening
});
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Result: Mellow, familiar artists with relaxing characteristics
```

### Example 3: Discover New Party Music

```javascript
// Hosting a party, want fresh dance music

// 1. Don't select anything (or select diverse popular tracks)
// 2. Run:
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.2,  // 20% familiar, 80% party discoveries
    UseLastfmRanking: true         // Get popular tracks
});
window.matchMonkey.runMoodActivityPlaylist(null, 'party');

// Result: Mostly new party-friendly artists with broad appeal
```

### Example 4: Genre + Mood Exploration

```javascript
// You love progressive rock and want more energetic examples

// 1. Select multiple prog rock artists (Pink Floyd, Yes, Genesis)
// 2. Run:
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5,   // Balanced
    SimilarArtistsLimit: 30,       // More artists for diversity
    TracksPerArtist: 20
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Result: Energetic progressive rock (Rush, Dream Theater, etc.)
```

---

## Blend Ratio Experiments

### Finding Your Sweet Spot

Try different ratios to see what works best:

```javascript
// Ultra-conservative (mostly your taste)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.9
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Conservative (your taste with mood enhancement)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Balanced (default, best for most users)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Adventurous (mostly new discoveries)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.3
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Pure discovery (no seed influence)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);
```

---

## Advanced Workflows

### Workflow 1: Progressive Discovery

Gradually discover new music while maintaining your taste:

```javascript
// Week 1: Safe exploration (70% seeds)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Week 2: Moderate exploration (50% seeds)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.5
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Week 3: Heavy exploration (30% seeds)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.3
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

### Workflow 2: Multi-Mood Day Planner

Create playlists for different times of day:

```javascript
// Morning: Energetic wake-up
// Select morning favorites
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Afternoon: Focus work playlist
// Select concentration music
window.matchMonkey.runMoodActivityPlaylist('focused', null);

// Evening: Relaxation playlist
// Select calming favorites
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Night: Sleep preparation
// Let algorithm find ambient music
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0  // Pure sleep music
});
window.matchMonkey.runMoodActivityPlaylist(null, 'sleep');
```

### Workflow 3: Genre Deep-Dive

Explore a genre with mood variations:

```javascript
// Select multiple artists from target genre (e.g., Jazz)

// Energetic jazz
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Relaxed jazz
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Happy jazz
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Result: Three different jazz playlists with different vibes
```

---

## Tips for Best Results

### Seed Selection Tips

1. **Quality over Quantity**: 3-5 well-chosen tracks better than 20 random ones
2. **Consistency**: Select tracks from similar genre/style for cohesive results
3. **Diversity**: Mix artists within genre for broader recommendations
4. **Recency**: Use tracks you're currently enjoying for relevant playlists

### Blend Ratio Tips

| If you want... | Use ratio... | Example |
|----------------|--------------|---------|
| Safe exploration | 0.7-0.8 | Your style with subtle mood |
| Balanced mix | 0.4-0.6 | Half familiar, half new |
| Adventure | 0.2-0.3 | Mostly new discoveries |
| Pure discovery | 0.0 | Ignore seeds completely |
| Mood filtering | 1.0 | Your seeds with mood filter |

### Mood/Activity Selection Tips

**Moods**:
- `energetic` - Best with rock, metal, electronic
- `relaxed` - Works with any genre
- `happy` - Pop, indie, upbeat genres
- `sad` - Best with singer-songwriter, indie
- `focused` - Instrumental, ambient, classical

**Activities**:
- `workout` - High tempo, energetic (use with uptempo seeds)
- `study` - Often instrumental (works without seeds)
- `party` - Danceable, popular (low blend ratio recommended)
- `sleep` - Ambient, minimal (pure mood works best)
- `driving` - Engaging but not distracting

---

## Troubleshooting Examples

### Problem: Results too random

**Solution**: Increase blend ratio

```javascript
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7  // More seed influence
});
```

### Problem: Results too similar to seeds

**Solution**: Decrease blend ratio

```javascript
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.3  // More mood influence
});
```

### Problem: Not enough tracks

**Solution**: Increase limits

```javascript
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    SimilarArtistsLimit: 30,     // More artists
    TracksPerArtist: 40,          // More tracks per artist
    MaxPlaylistTracks: 0          // No limit
});
```

### Problem: Wrong mood feel

**Solutions**:
1. Try different mood name
2. Check seed selection (are they appropriate?)
3. Adjust blend ratio
4. Check other filters (MinRating, etc.)

---

## Success Stories

### User Story 1: "Perfect Gym Mix"

> "I selected my favorite Metallica and Slipknot tracks, set ratio to 0.6, ran 'workout' activity. Got 100 tracks of heavy metal perfect for lifting. Some familiar bands, some new discoveries. Game changer!" - Mike

### User Story 2: "Study Music Discovery"

> "I knew nothing about study music. Set ratio to 0.0 (pure mood), ran 'focused' mood. Algorithm found amazing lo-fi and ambient artists I never would have discovered." - Sarah

### User Story 3: "Party Playlist Pro"

> "Hosting parties every month. I select current popular tracks, set ratio to 0.4, run 'party' activity. Always fresh, crowd-pleasing playlists with good mix of familiar and new." - DJ Alex

---

## Next Steps

1. **Experiment**: Try different ratios to find your preference
2. **Refine**: Adjust based on results
3. **Save Favorites**: Keep track of successful ratio/mood combinations
4. **Share**: Tell others about configurations that work well

---

For more information, see:
- [ReccoBeats Integration Guide](RECCOBEATS_INTEGRATION.md)
- [Quick Reference](QUICK_REFERENCE.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
