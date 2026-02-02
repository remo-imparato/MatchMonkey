# MatchMonkey - Complete Features Documentation

## Overview

MatchMonkey is a comprehensive playlist generation add-on for MediaMonkey 5 that combines multiple music discovery APIs and intelligent matching algorithms.

---

## Core Features

### 1. Multi-Mode Discovery System

MatchMonkey offers **5 distinct discovery modes**, each optimized for different use cases:

#### A. Artist-Based Discovery
**Algorithm**: Last.fm `artist.getSimilar`

**Process**:
1. Extract unique artists from selected tracks
2. Query Last.fm for similar artists (configurable limit)
3. Fetch top tracks for each similar artist
4. Match tracks against local library
5. Apply filters and ranking

**Configuration**:
- `SimilarArtistsLimit`: Max similar artists per seed (default: 20)
- `TracksPerArtist`: Tracks to fetch per artist (default: 30)
- `IncludeSeedArtist`: Include original artists (default: true)

**Best For**:
- Discovering new artists in the same genre
- Building artist-focused playlists
- Genre exploration

---

#### B. Track-Based Discovery
**Algorithm**: Last.fm `track.getSimilar`

**Process**:
1. Extract track titles from selection
2. Query Last.fm for musically similar tracks
3. Group results by artist
4. Match against local library
5. Sort by similarity score

**Configuration**:
- `TrackSimilarLimit`: Max similar tracks per seed (default: 100)
- `TracksPerArtist`: Tracks per discovered artist (default: 30)
- Higher limit improves library matching

**Best For**:
- Finding different versions of songs
- Discovering covers and remixes
- Musically similar tracks across genres
- Cross-artist discovery

---

#### C. Genre-Based Discovery
**Algorithm**: Last.fm `tag.getTopArtists` + `artist.getInfo`

**Process**:
1. Extract genres from track metadata
2. Fetch artist info from Last.fm for tags
3. Query top artists for each genre/tag
4. Get tracks from genre-matched artists
5. Match against local library

**Configuration**:
- `SimilarArtistsLimit`: Total artists to collect (default: 20)
- Distributes across multiple genres

**Best For**:
- Broad genre exploration
- Discovering top artists in genres
- Genre-consistent playlists

---

#### D. Mood-Based Discovery (ReccoBeats)
**Algorithm**: ReccoBeats

**Process**:
1. Extract seed artists from selection
2. Find acoustic features of the selection (seed component)
3. Query ReccoBeats for mood-appropriate tracks
4. **Blend both pools** using configurable ratio
5. Interleave results for optimal mixing
6. Match against local library

**Configuration**:
- `MoodActivityBlendRatio`: 0.0 (all seed) to 1.0 (all mood/activity), default: 0.5
- `SimilarArtistsLimit`: Affects seed component size

**Blend Ratio Details**:
- `0.0`: All seed influence (your taste)
- `0.3`: 70% seed-based, 30% mood-based
- `0.5`: **Balanced** (recommended) - 50/50 split
- `0.7`: 30% seed-based, 70% mood-based
- `1.0`: All mood/activity influence

**Best For**:
- Emotional context playlists
- Mood-aware music selection
- Personalized discovery with mood constraints

---

#### E. Activity-Based Discovery (ReccoBeats)
**Algorithm**: ReccoBeats

**Process**:
Same as mood-based but with activity optimization:
1. Duration targeting for activity length
2. Tempo/energy matching for activity type
3. Activity-specific characteristics

**Configuration**:
- `MoodActivityBlendRatio`: Same as mood mode

**Best For**:
- Activity-specific playlists
- Duration-constrained sessions
- Context-aware music (workout, study, etc.)

---

### 2. Intelligent Library Matching

**Multi-Pass Matching Algorithm**:

#### Pass 1: Exact Match
- Case-insensitive title matching
- Exact artist name matching
- Fastest, highest confidence

#### Pass 2: Normalized Match
- Strips punctuation, special characters
- Handles "Rock 'n' Roll" vs "Rock and Roll"
- Normalizes spacing and case

#### Pass 3: Partial Match
- Word-based matching (3+ character words)
- Catches remastered versions
- Matches featured artist variations
- Example: "Song (Remastered)" matches "Song"

**Deduplication**:
- Groups by `artist|title` key (case-insensitive)
- When duplicates found:
  1. Prefer higher bitrate
  2. Then prefer higher rating
- Prevents same track from appearing multiple times

**Artist Prefix Handling**:
- "The Beatles" matches "Beatles, The"
- "Beatles" matches both formats
- Respects MediaMonkey's ignore prefix settings

---

### 3. Advanced Filtering System

#### Rating Filter
- **MinRating** (0-100): Exclude tracks below threshold
- **IncludeUnrated** (boolean): Allow unrated tracks
- Applied after library matching, before final selection

#### Quality Preference
- **PreferHighQuality**: When enabled:
  - Selects highest bitrate when duplicates exist
  - Breaks ties with rating
  - Ensures best audio quality

---

### 4. Ranking and Sorting

#### Last.fm Popularity Ranking
- **UseLastfmRanking**: When enabled:
  - Fetches playcount data from Last.fm
  - Sorts tracks by popularity (highest first)
  - Popular tracks appear earlier in playlist
  - Disabled: Random or track order preserved

#### Randomization
- **ShuffleResults**: When enabled:
  - Fisher-Yates shuffle algorithm
  - Prevents artist clustering
  - Provides variety in listening order

**Combined Effect**:
- Ranking ON + Shuffle OFF = Popular tracks first
- Ranking ON + Shuffle ON = Popular tracks, randomized
- Ranking OFF + Shuffle ON = Random order
- Ranking OFF + Shuffle OFF = Discovery order

---

### 5. Auto-Queue (Endless Playback)

**Concept**: Automatically adds similar tracks when Now Playing queue is nearly empty.

**Trigger Condition**:
- Monitors Now Playing queue
- Triggers when 2 or fewer tracks remain
- Prevents gaps in playback

**Process**:
1. Use last N tracks as seeds (AutoModeSeedLimit)
2. Run discovery (AutoModeDiscovery mode)
3. Limit results (AutoModeMaxTracks)
4. Add to Now Playing queue
5. Skip duplicates if enabled

**Configuration**:
- **AutoModeEnabled**: Enable/disable auto-queue
- **AutoModeDiscovery**: Artist/Track/Genre mode
- **AutoModeSeedLimit**: Seeds to process (default: 2)
- **AutoModeSimilarLimit**: Similar artists per seed (default: 10)
- **AutoModeTracksPerArtist**: Tracks per artist (default: 5)
- **AutoModeMaxTracks**: Max tracks per trigger (default: 30)
- **SkipDuplicates**: Skip tracks already in queue

**Performance Optimization**:
- Uses conservative limits for speed
- Caches API responses
- Asynchronous operation (doesn't block playback)

**Use Cases**:
- Background music during work
- Party playlists that never end
- Discovery radio station effect
- Long listening sessions

---

### 6. Playlist Management

#### Playlist Creation Modes

**A. Create New Playlist**
- Creates new playlist with generated name
- Template: `PlaylistName` (use `%` for artist)
- Example: "Similar to Pink Floyd"
- Optionally under `ParentPlaylist`

**B. Overwrite Existing Playlist**
- Finds playlist by name
- Clears existing tracks
- Adds new tracks
- Preserves playlist metadata

**C. Do Not Create Playlist**
- Skips playlist creation
- Requires enqueue mode enabled
- Adds directly to Now Playing

#### Parent Playlist Organization
- **ParentPlaylist**: Name of parent playlist
- Creates child playlists under parent
- Hierarchical organization
- Example: All discovery playlists under "Auto-Generated"

#### Confirmation Dialog
- **ShowConfirmDialog**: When enabled:
  - Shows playlist selection dialog
  - Allows manual playlist selection
  - Can create new or choose existing
  - Cancel aborts operation

---

### 7. Queue Behavior

#### Enqueue Mode
- **EnqueueMode**: When enabled:
  - Bypasses playlist creation
  - Adds tracks directly to Now Playing
  - Useful for quick listening

#### Queue Management
- **ClearQueueFirst**: When enabled:
  - Clears Now Playing before adding
  - Fresh start for new session

- **SkipDuplicates**: When enabled:
  - Checks if track already in queue
  - Skips duplicate entries
  - Prevents repetition

#### Navigation After Completion
- **NavigateAfter** options:
  1. **Navigate to new playlist**: Opens newly created playlist
  2. **Navigate to now playing**: Switches to Now Playing view
  3. **Stay in current view**: No navigation change

---

### 8. Caching System

**Per-Session Caching**:
- **Scope**: Single add-on run
- **Cached Data**:
  - Last.fm similar artists
  - Last.fm top tracks
  - Last.fm artist info
  - ReccoBeats mood/activity results

**Benefits**:
- Reduces API calls
- Faster subsequent operations
- Respects API rate limits

**Cache Clearing**:
- Automatically cleared on MediaMonkey restart
- Cleared after each discovery run
- Forces fresh data on new session

---

### 9. Seed Artist Inclusion

**Configuration**: `IncludeSeedArtist`

**When Enabled**:
- Includes tracks from original seed artists
- Adds at beginning of discovery pool
- Ensures familiar artists in results

**When Disabled**:
- Excludes seed artists completely
- Only similar/discovered artists
- Maximum discovery/variety

**Effect on Results**:
- Enabled: More familiar, safer playlists
- Disabled: More adventurous, discovery-focused

---

## Use Case Recommendations

- **Quick Familiar Playlist**: Use Artist mode with moderate limits and include seed artists
- **Deep Discovery**: Use Track mode with higher limits and exclude seed artists for maximum variety
- **Genre Exploration**: Use Genre mode with higher artist limits and Last.fm ranking
- **Mood-Based Personalized**: Use Mood mode with balanced blend ratio (0.5) and include seed artists
- **Activity-Optimized**: Use Activity mode with blend ratio slightly favoring your seeds (0.6)
- **Endless Background Music**: Enable Auto-Queue with Track mode and moderate limits

---

## Compatibility Notes

- **Requires**: MediaMonkey 5.0+
- **Internet**: Required for API calls
- **APIs**: Last.fm and ReccoBeats

---

## Documentation Links

- [Quick Start](QUICK_START.md) — Get started in 2 minutes
- [Quick Reference](QUICK_REFERENCE.md) — Complete settings reference
- [User Guide](USER_GUIDE.md) — Detailed usage guide
- [Examples & Tutorial](EXAMPLES_TUTORIAL.md) — Real-world examples

---

## Support

- Report issues: [GitHub Issues](https://github.com/remo-imparato/SimilarArtistsMM5/issues)
- Download updates: [GitHub Releases](https://github.com/remo-imparato/SimilarArtistsMM5/releases)
- Support the project: [Ko-fi](https://ko-fi.com/remoimparato)
