# Quick Reference: New Playlist Naming System

## Summary of Changes

### New Default Template
```javascript
PlaylistName: 'Similar %action% (%seed%)'
```

### Available Placeholders

| Placeholder | Description | Example Values |
|------------|-------------|----------------|
| `%action%` | Discovery type | Artists, Tracks, Genres, Acoustics, Energetic, Workout |
| `%seed%` | Seed summary | "The Beatles, Pink Floyd", "Rock, Blues, Jazz" |
| `%` | Legacy (same as %seed%) | For backward compatibility |

### Discovery Mode → %action% Mapping

| Discovery Mode | %action% Value | Example Playlist Name |
|---------------|----------------|----------------------|
| Artist Search | "Artists" | "Similar Artists (The Beatles, Pink Floyd)" |
| Track Search | "Tracks" | "Similar Tracks (Led Zeppelin, Metallica)" |
| Genre Search | "Genres" | "Similar Genres (Rock, Blues, Jazz)" |
| Acoustics (ReccoBeats) | "Acoustics" | "Similar Acoustics (The Beatles)" |
| Mood: energetic | "Energetic" | "Similar Energetic (Pink Floyd)" |
| Mood: relaxed | "Relaxed" | "Similar Relaxed (Coldplay)" |
| Activity: workout | "Workout" | "Similar Workout (Metallica)" |
| Activity: study | "Study" | "Similar Study (Chopin)" |

### %seed% Examples

**Artist Mode:**
- 1 artist: "The Beatles"
- 2 artists: "The Beatles, Pink Floyd"
- 3 artists: "The Beatles, Pink Floyd, Muse"
- 4+ artists: "The Beatles, Pink Floyd, Muse..."

**Genre Mode:**
- 1 genre: "Rock"
- 2 genres: "Rock, Blues"
- 3 genres: "Rock, Blues, Jazz"
- 4+ genres: "Rock, Blues, Jazz..."

**Track Mode:**
- Uses artist names from selected tracks (same format as artist mode)

## Custom Template Examples

### Using Both Placeholders
```javascript
// Template: "My %action% Mix - %seed%"

// Results:
"My Artists Mix - The Beatles, Pink Floyd"     // Artist search
"My Tracks Mix - Led Zeppelin, Metallica"      // Track search
"My Genres Mix - Rock, Blues"                  // Genre search
"My Energetic Mix - Pink Floyd"                // Mood search
```

### Using %action% Only
```javascript
// Template: "Daily %action%"

// Results:
"Daily Artists"      // Artist search
"Daily Tracks"       // Track search
"Daily Genres"       // Genre search
"Daily Workout"      // Activity search
```

### Using %seed% Only
```javascript
// Template: "%seed% Radio"

// Results:
"The Beatles, Pink Floyd Radio"    // Artist/Track search
"Rock, Blues Radio"                // Genre search
```

### Complex Template
```javascript
// Template: "🎵 %action% Radio: %seed%"

// Results:
"🎵 Artists Radio: The Beatles, Pink Floyd"
"🎵 Genres Radio: Rock, Blues, Jazz"
"🎵 Energetic Radio: Metallica"
```

## Migration from Old System

### Automatic Upgrade

**If you had `%artist%` in your template:**
```javascript
// Before:
PlaylistName: "My %artist% Favorites"

// After (automatic):
PlaylistName: "My %seed% Favorites"

// Console log:
"Match Monkey: Upgraded 1 value(s): PlaylistName: %artist% → %seed%"
```

**If you had legacy `%` placeholder:**
```javascript
// Before and After (no change needed):
PlaylistName: "% Radio"

// Still works! % is treated as %seed%
// Result: "The Beatles, Pink Floyd Radio"
```

**If you had empty PlaylistName:**
```javascript
// Before:
PlaylistName: ''

// After (gets new default):
PlaylistName: 'Similar %action% (%seed%)'

// Now uses template system with default format
```

## Use Cases

### Scenario 1: Keep Default Naming
```javascript
PlaylistName: 'Similar %action% (%seed%)'
```
Produces names identical to the previous auto-generation system.

### Scenario 2: Personal Branding
```javascript
PlaylistName: "[Your Name]'s %action% Mix - %seed%"
// Result: "John's Artists Mix - The Beatles, Pink Floyd"
```

### Scenario 3: Radio Station Style
```javascript
PlaylistName: "🎵 %seed% Radio - %action%"
// Result: "🎵 The Beatles, Pink Floyd Radio - Artists"
```

### Scenario 4: Simple & Clean
```javascript
PlaylistName: "%seed%"
// Result: "The Beatles, Pink Floyd"
```

### Scenario 5: Pure Auto-Generation (No Template)
```javascript
PlaylistName: ''
// Uses internal auto-generation logic (legacy behavior)
// Result depends on discovery mode
```

## Testing Your Template

1. Open MediaMonkey
2. Go to Tools > Options > MatchMonkey
3. Set your PlaylistName template
4. Click OK
5. Perform a Similar Artists/Tracks/Genres search
6. Check the generated playlist name

## Notes

- Templates can use Unicode characters and emojis ✨
- Playlist names longer than 100 characters are truncated with "..."
- %action% is always capitalized (e.g., "Artists" not "artists")
- %seed% uses the same formatting as before (up to 3 items)
- Empty template ('') still works for pure auto-generation
