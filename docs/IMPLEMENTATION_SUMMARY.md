# ReccoBeats Integration - Implementation Summary

## Overview

Successfully integrated ReccoBeats API with MatchMonkey to enable mood and activity-based playlist generation, combining AI-powered recommendations with Last.fm's artist similarity data.

## Files Created

### 1. `modules/api/reccobeats.js`
- **Purpose**: ReccoBeats API client module
- **Functions**:
  - `fetchMoodRecommendations(mood, genres, limit)` - Get mood-based track recommendations
  - `fetchActivityRecommendations(activity, duration, limit)` - Get activity-based track recommendations
  - `fetchHybridRecommendations(context, value, options)` - Hybrid ReccoBeats + Last.fm discovery
- **Features**:
  - Caching support using existing cache infrastructure
  - Progress tracking integration
  - Error handling and fallbacks

### 2. `docs/RECCOBEATS_INTEGRATION.md`
- **Purpose**: Comprehensive user documentation
- **Contents**:
  - Feature overview
  - Configuration guide
  - Usage examples
  - API endpoint documentation
  - Troubleshooting tips
  - Best practices

### 3. `test/test_reccobeats.js`
- **Purpose**: Integration test script
- **Tests**:
  - Module loading verification
  - Function availability checks
  - Discovery mode validation
  - Entry point validation

## Files Modified

### 1. `modules/core/discoveryStrategies.js`
**Changes**:
- Added `MOOD` and `ACTIVITY` to `DISCOVERY_MODES`
- Implemented `discoverByMoodActivity()` function with **seed-aware blending**
- Added `extractGenresFromSeeds()` helper function
- Updated `getDiscoveryStrategy()` to handle mood/activity modes
- Updated `getDiscoveryModeName()` for mood/activity labels

**Key Features**:
- Extracts seed artists from current selection/playing tracks
- Uses Last.fm to find similar artists to seeds (seed-based component)
- Queries ReccoBeats API for mood/activity recommendations (mood-based component)
- **Intelligently blends both approaches** using configurable ratio (default 50/50)
- Interleaves results for better mixing
- Respects blacklist and configuration limits

**Blending Algorithm**:
1. Extract unique seed artists from selection
2. Find Last.fm similar artists to seeds (seed-based pool)
3. Get ReccoBeats mood/activity artists (mood-based pool)
4. Calculate target counts based on blend ratio
5. Take proportional amounts from each pool
6. Interleave for optimal mixing
7. Build candidate list for library matching

### 2. `init.js`
**Changes**:
- Added `localRequirejs('modules/api/reccobeats')` to module loading
- Added new configuration defaults:
  - `DefaultMood`: 'energetic'
  - `DefaultActivity`: 'workout'
  - `HybridMode`: true
  - `MoodActivityBlendRatio`: 0.5 (50% seed + 50% mood)

### 3. `matchMonkey.js`
**Changes**:
- Added `MOOD` and `ACTIVITY` to `DISCOVERY_MODES`
- Implemented `runMoodActivityPlaylist(mood, activity)` function
- Exported `runMoodActivityPlaylist` in global API

**Key Features**:
- Determines context (mood vs activity) from parameters
- Falls back to configuration defaults if no parameters
- Passes mood/activity context to orchestration layer
- Supports both hybrid and ReccoBeats-only modes

### 4. `modules/core/orchestration.js`
**Changes**:
- Extracts `_moodActivityContext` from modules parameter
- Adds mood/activity context to config object:
  - `moodActivityContext`: 'mood' or 'activity'
  - `moodActivityValue`: specific mood/activity name
  - `moodActivityBlendRatio`: blend ratio from settings (0.0-1.0)

### 5. `README.md`
**Changes**:
- Updated key features to highlight mood/activity playlists
- Added mood/activity discovery modes documentation
- Added usage examples with JavaScript code
- Added mood/activity configuration table
- Updated requirements to mention ReccoBeats API
- Added ReccoBeats to credits
- Added version 2.1 changelog entry
- Added ReccoBeats resources and documentation links
- Added mood/activity tips

## Benefits

1. **Context-Aware**: Playlists tailored to mood and activity
2. **Personalized**: Uses your current listening as a starting point (seed-aware)
3. **Balanced Discovery**: Blend ratio controls familiarity vs exploration
4. **AI-Powered**: ReccoBeats uses machine learning for recommendations
5. **Library-First**: Still matches tracks from your local library
6. **Hybrid Discovery**: Combines ReccoBeats + Last.fm for best results
7. **Cached**: ReccoBeats responses cached for performance
8. **Configurable**: All limits, ratios, and behavior customizable
9. **Extensible**: Easy to add new moods/activities
10. **Intelligent Mixing**: Interleaves seed and mood artists for variety

## Integration Architecture

```
???????????????????????????????????????????????????????????
? User Interface / Actions                                  ?
? window.matchMonkey.runMoodActivityPlaylist(mood, activity)?
???????????????????????????????????????????????????????????
                     ?
                     ?
???????????????????????????????????????????????????????????
? matchMonkey.js (Main Entry Point)                        ?
? • Determines context (mood vs activity)                  ?
? • Reads configuration defaults                           ?
? • Enriches modules with mood/activity context            ?
???????????????????????????????????????????????????????????
                     ?
                     ?
???????????????????????????????????????????????????????????
? modules/core/orchestration.js                            ?
? • Extracts mood/activity context from modules            ?
? • Passes context to discovery strategy                   ?
? • Manages overall workflow                               ?
???????????????????????????????????????????????????????????
                     ?
                     ?
???????????????????????????????????????????????????????????
? modules/core/discoveryStrategies.js                      ?
? • discoverByMoodActivity(modules, seeds, config)         ?
? • Uses mood/activity context from config                 ?
???????????????????????????????????????????????????????????
                     ?
          ???????????????????????
          ?                     ?
?????????????????????? ???????????????????????
? ReccoBeats API      ? ? Last.fm API         ?
? modules/api/        ? ? modules/api/        ?
? reccobeats.js       ? ? lastfm.js           ?
?                     ? ?                     ?
? • Mood tracks       ? ? • Similar artists   ?
? • Activity tracks   ? ? • Top tracks        ?
? • Genre filtering   ? ? • Artist expansion  ?
?????????????????????? ???????????????????????
          ?                     ?
          ???????????????????????
                     ?
???????????????????????????????????????????????????????????
? Candidate Artists with Tracks                            ?
? • Unique artists from both APIs                          ?
? • Track lists with ranking/popularity                    ?
???????????????????????????????????????????????????????????
                     ?
                     ?
???????????????????????????????????????????????????????????
? Library Matching                                         ?
? • Multi-pass fuzzy matching                             ?
? • Deduplication by artist|title                         ?
? • Quality selection (bitrate, rating)                   ?
???????????????????????????????????????????????????????????
                     ?
                     ?
???????????????????????????????????????????????????????????
? Output (Playlist or Queue)                               ?
? • Create/overwrite playlist                              ?
? • Add to Now Playing                                    ?
? • Apply shuffle if enabled                              ?
???????????????????????????????????????????????????????????
```

## Data Flow

1. **User invokes** `runMoodActivityPlaylist('happy', null)` with seed tracks selected
2. **matchMonkey.js** determines context='mood', value='happy'
3. **Enriches modules** with `_moodActivityContext`
4. **Orchestration** calls discovery with MOOD mode, passes blend ratio
5. **Discovery strategy**:
   - **Seed Analysis**: Extracts unique artists from selected tracks
   - **Seed Component**: Calls Last.fm to find similar artists to seeds
   - **Mood Component**: Calls ReccoBeats API for "happy" mood tracks
   - **Blending**: Combines both pools using blend ratio (e.g., 50/50)
     - Takes 10 artists from seed pool
     - Takes 10 artists from mood pool
     - Interleaves for mixing
   - Returns combined artist list (20 total)
6. **Orchestration** matches artists to library
7. **Output** creates playlist or queues tracks

### Blend Ratio Impact

**Example with 20 artist limit and 0.5 ratio**:

```
Selected: Pink Floyd, Led Zeppelin
Mood: energetic

Seed Component (50%):
  - Pink Floyd (seed)
  - Led Zeppelin (seed)
  - David Gilmour (similar to Pink Floyd)
  - Roger Waters (similar to Pink Floyd)
  - Deep Purple (similar to Led Zeppelin)
  - Black Sabbath (similar to Led Zeppelin)
  ... (10 total)

Mood Component (50%):
  - AC/DC (energetic rock)
  - Metallica (energetic metal)
  - Foo Fighters (energetic alternative)
  - Queens of the Stone Age (energetic rock)
  ... (10 total)

Final Blended List (interleaved):
  Pink Floyd, AC/DC, David Gilmour, Metallica,
  Roger Waters, Foo Fighters, Deep Purple, Queens...
```

## Configuration Settings

### User-Configurable
- `DefaultMood` - Default mood preset
- `DefaultActivity` - Default activity preset
- `HybridMode` - Combine ReccoBeats + Last.fm
- `MoodActivityBlendRatio` - Blend ratio (0.0-1.0, default 0.5)
  - `0.0` = 100% mood-based (ignore seeds)
  - `0.5` = 50% seed + 50% mood (balanced)
  - `1.0` = 100% seed-based (mood-filtered)

### Existing Settings (Also Apply)
- `SimilarArtistsLimit` - Max artists to expand
- `TracksPerArtist` - Tracks per artist from library
- `MaxPlaylistTracks` - Final playlist size
- `UseLastfmRanking` - Sort by Last.fm popularity
- `PreferHighQuality` - Prefer higher bitrate/rating
- `MinRating` - Minimum rating filter
- `IncludeUnrated` - Allow unrated tracks
- `ShuffleResults` - Randomize final results

## API Endpoints Used

### ReccoBeats API
```
BASE: https://api.reccobeats.com/v1

GET /recommendations/mood
  Parameters:
    - mood: Target mood (required)
    - genres: Comma-separated genres (optional)
    - limit: Max results (default: 50)
  
GET /recommendations/activity
  Parameters:
    - activity: Target activity (required)
    - duration: Duration in minutes (optional)
    - limit: Max results (default: 50)
```

### Last.fm API
```
BASE: https://ws.audioscrobbler.com/2.0/

GET artist.getSimilar
  - Used for artist expansion
  
GET artist.getTopTracks
  - Used to get tracks for expanded artists
```

## Usage Examples

### JavaScript Console

```javascript
// Generate happy mood playlist (uses selected tracks as seeds)
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Generate workout activity playlist (uses selected tracks as seeds)
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');

// Use configuration defaults
window.matchMonkey.runMoodActivityPlaylist();

// Adjust blend ratio for different behaviors
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7  // 70% seed, 30% mood
});
window.matchMonkey.runMoodActivityPlaylist('energetic', null);

// Pure mood discovery (ignore seeds)
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.0  // 0% seed, 100% mood
});
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);

// Other moods (with seed context)
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
window.matchMonkey.runMoodActivityPlaylist('relaxed', null);
window.matchMonkey.runMoodActivityPlaylist('sad', null);

// Other activities (with seed context)
window.matchMonkey.runMoodActivityPlaylist(null, 'study');
window.matchMonkey.runMoodActivityPlaylist(null, 'party');
window.matchMonkey.runMoodActivityPlaylist(null, 'sleep');
```

### Recommended Workflow

1. **Select tracks** you want to base the playlist on
2. **Set blend ratio** based on how adventurous you want to be:
   - `0.3` - Mostly new discoveries with your style
   - `0.5` - Balanced (default)
   - `0.7` - Mostly your style with mood enhancement
3. **Run mood/activity playlist**
4. **Enjoy** personalized, context-aware music!
