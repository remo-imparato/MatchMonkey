# ?? ReccoBeats Quick Start - Seed-Aware Mood Playlists

## 60-Second Setup

1. **Open MediaMonkey 5**
2. **Select 3-5 tracks** you like (your "seeds")
3. **Open console** (F12)
4. **Run this**:

```javascript
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

**Done!** You now have an energetic playlist matching your taste! ??

---

## What Just Happened?

The algorithm:
1. ? Analyzed your selected tracks (seeds)
2. ? Found similar artists using Last.fm
3. ? Got energetic recommendations from ReccoBeats AI
4. ? **Blended both** (50% your style + 50% energetic)
5. ? Matched tracks in your library
6. ? Created your personalized playlist

---

## Try Different Moods

```javascript
// Happy mood in your style
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Relaxed mood in your style
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Focused study music in your style
window.matchMonkey.runMoodActivityPlaylist('focused', null);
```

## Try Different Activities

```javascript
// Workout music in your style
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');

// Party music in your style
window.matchMonkey.runMoodActivityPlaylist(null, 'party');

// Sleep music (pure mood discovery)
window.matchMonkey.runMoodActivityPlaylist(null, 'sleep');
```

---

## Adjust the Balance

### More Discovery, Less Familiarity

```javascript
// 30% your taste + 70% mood discovery
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.3
});
window.matchMonkey.runMoodActivityPlaylist('happy', null);
```

### More Familiarity, Less Discovery

```javascript
// 70% your taste + 30% mood enhancement
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

### Pure Discovery (Ignore Seeds)

```javascript
// 100% mood-based (no seed influence)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0
});
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);
```

---

## Example Workflows

### Morning Routine
```javascript
// Select your morning favorites
// Run energetic mood
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

### Work Focus
```javascript
// Select concentration music
// Run focused activity
window.matchMonkey.runMoodActivityPlaylist('focused', null);
```

### Gym Session
```javascript
// Select workout tracks
// Run workout activity
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

### Evening Relaxation
```javascript
// Select calming favorites
// Run relaxed mood
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);
```

---

## Available Options

### Moods
- `energetic` - High energy, upbeat
- `relaxed` - Calm, chill
- `happy` - Uplifting, positive
- `sad` - Melancholic, emotional
- `focused` - Concentration-friendly

### Activities
- `workout` - High tempo, motivating
- `study` - Instrumental, focus
- `party` - Danceable, crowd-pleasing
- `sleep` - Soothing, ambient
- `driving` - Engaging, road trip

---

## Pro Tips

### ?? Tip 1: Quality Seeds
Select 3-5 tracks from artists you want more of:
- ? Good: 5 Pink Floyd tracks
- ? Bad: Random unrelated tracks

### ?? Tip 2: Start Balanced
Use default 0.5 ratio (50/50) first:
```javascript
MoodActivityBlendRatio: 0.5  // Balanced
```

### ?? Tip 3: Experiment
Try different ratios to find your preference:
- `0.0` = All discovery
- `0.5` = Balanced (default)
- `1.0` = All familiar

### ?? Tip 4: Match Mood to Genre
- Rock/Metal ? `energetic` or `workout`
- Jazz/Classical ? `relaxed` or `focused`
- Pop/Indie ? `happy` or `party`

---

## Troubleshooting

### "Results too random"
```javascript
// Increase ratio (more familiar)
MoodActivityBlendRatio: 0.7
```

### "Results too similar to seeds"
```javascript
// Decrease ratio (more discovery)
MoodActivityBlendRatio: 0.3
```

### "Not enough tracks"
```javascript
// Increase limits
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    SimilarArtistsLimit: 30,
    TracksPerArtist: 40,
    MaxPlaylistTracks: 0  // Unlimited
});
```

---

## Next Steps

1. ? Try it now with your favorite tracks
2. ? Experiment with different ratios
3. ? Try different moods/activities
4. ? Find your perfect balance

---

## Full Documentation

- **Detailed Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Examples & Tutorials**: `docs/EXAMPLES_TUTORIAL.md`
- **Quick Reference**: `docs/QUICK_REFERENCE.md`
- **Enhancement Details**: `docs/SEED_AWARE_ENHANCEMENT.md`

---

## Need Help?

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com

---

**Happy Listening! ??**
