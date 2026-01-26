# ReccoBeats Configuration UI Guide

## Accessing the Settings

1. Open **MediaMonkey 5**
2. Go to **Tools ? Options**
3. Navigate to **Library ? MatchMonkey**
4. Scroll to the **"Mood & Activity (ReccoBeats AI)"** section

---

## Mood & Activity Settings Section

### Controls Available

#### 1. **Enable mood/activity discovery?** (Checkbox)
- Enables the ReccoBeats integration
- When checked, mood/activity functions become available
- Default: `Unchecked` (disabled)

#### 2. **Default mood** (Dropdown)
Select your default mood for quick playlist generation:
- `Energetic` - High energy, upbeat
- `Relaxed` - Calm, chill
- `Happy` - Uplifting, positive
- `Sad` - Melancholic, emotional
- `Focused` - Concentration-friendly

Default: `Energetic`

#### 3. **Default activity** (Dropdown)
Select your default activity for quick playlist generation:
- `Workout` - High tempo, motivating
- `Study` - Instrumental, focus
- `Party` - Danceable, crowd-pleasing
- `Sleep` - Soothing, ambient
- `Driving` - Engaging, road trip

Default: `Workout`

#### 4. **Playlist duration (min)** (Number)
Target duration in minutes for activity-based playlists
- Range: 10 - 300 minutes
- Default: `60` (1 hour)
- Example: Set to 90 for a 1.5-hour workout session

#### 5. **Use hybrid mode (ReccoBeats + Last.fm)?** (Checkbox)
- Combines ReccoBeats recommendations with Last.fm artist expansion
- **Recommended**: Keep this checked for best results
- When unchecked, uses ReccoBeats only (may miss artists in your library)
- Default: `Checked` (enabled)

#### 6. **Seed/Mood balance** (Slider) ? NEW!
**Most Important Setting!**

Interactive slider that controls the balance between your seed artists and mood recommendations.

```
[All Mood] ??????????????????? [All Seeds]
     0%         50%        100%
```

**Slider Values**:
- **0%** (All Mood) - Pure mood discovery, ignores your seeds completely
- **10-20%** - Mostly mood-based with slight seed influence
- **30-40%** - Adventurous discovery with your style as accent
- **50%** - **Balanced (Recommended)** - Equal mix of seeds and mood
- **60-70%** - Your musical taste with mood enhancement
- **80-90%** - Heavily seed-based with mood characteristics
- **100%** (All Seeds) - Pure seed-based discovery with mood filtering

**Default**: `50%` (Balanced)

**Visual Feedback**:
- Slider track shows gradient: Blue (mood) ? Purple (balanced) ? Green (seed)
- Current percentage displayed next to slider
- Labels below: "All Mood", "Balanced", "All Seeds"

**Interactive Features**:
- **Hover**: Handle enlarges slightly
- **Drag**: Smooth movement with 10% steps
- **Keyboard**: Arrow keys for fine control
- **Tooltip**: Shows detailed explanation on hover

---

## Usage Examples

### Example 1: Pure Discovery
**Goal**: Find completely new mood-appropriate music

**Settings**:
```
? Enable mood/activity discovery
  Default mood: Relaxed
  Seed/Mood balance: 0% (All Mood)
```

**Result**: Pure mood discovery, no influence from your current listening

---

### Example 2: Balanced Mix (Recommended)
**Goal**: Personalized mood playlist matching your taste

**Settings**:
```
? Enable mood/activity discovery
  Default mood: Energetic
  Seed/Mood balance: 50% (Balanced)
? Use hybrid mode
```

**Usage**:
1. Select 3-5 favorite rock tracks
2. Run: `window.matchMonkey.runMoodActivityPlaylist('energetic', null)`
3. Get: 50% progressive rock (like your seeds) + 50% energetic music (various genres)

---

### Example 3: Your Style Enhanced
**Goal**: Mood-enhanced playlist staying close to your taste

**Settings**:
```
? Enable mood/activity discovery
  Default mood: Happy
  Seed/Mood balance: 70% (Your taste)
```

**Usage**:
1. Select indie pop favorites
2. Run: `window.matchMonkey.runMoodActivityPlaylist('happy', null)`
3. Get: 70% indie pop artists + 30% happy music (complementary genres)

---

### Example 4: Workout Session
**Goal**: Intense workout mix based on your metal library

**Settings**:
```
? Enable mood/activity discovery
  Default activity: Workout
  Playlist duration: 90 minutes
  Seed/Mood balance: 60%
```

**Usage**:
1. Select Metallica/Slipknot tracks
2. Run: `window.matchMonkey.runMoodActivityPlaylist(null, 'workout')`
3. Get: 90-minute heavy workout playlist (60% similar metal + 40% workout music)

---

## Visual Slider Behavior

### Drag Interaction
```
Starting position (50%):
[???????????????????]

Dragging left (30%):
[???????????????????]
More mood-based

Dragging right (80%):
[???????????????????]
More seed-based
```

### Color Coding
```
0% ????????????????????????? 100%
Blue    Purple    Green
Mood    Balanced  Seeds
```

---

## Tooltip Content

**When hovering over the slider**, you'll see:

> **Seed/Mood Balance**
> 
> Control the balance between your seed artists and mood recommendations.
> 
> - **0%**: Pure mood discovery (ignore seeds)
> - **50%**: Balanced mix (recommended)
> - **100%**: Seed-based with mood filter
> 
> Select tracks first, then adjust this slider to control familiarity vs. discovery.

---

## Best Practices

### Slider Position Guide

| If you want... | Set slider to... | Why? |
|----------------|------------------|------|
| Discover new genres | 0-20% | Maximum exploration |
| Adventurous mix | 30-40% | Mostly new, some familiar |
| Balanced variety | 50% | **Optimal for most users** |
| Safe exploration | 60-70% | Mostly familiar, some new |
| Your style filtered | 80-100% | Minimum exploration |

### Recommended Workflows

1. **First Time Users**: Start at 50% (balanced)
2. **Too Random?**: Increase slider (more seeds)
3. **Too Boring?**: Decrease slider (more mood)
4. **Quick Playlists**: Use defaults and don't select seeds
5. **Personalized**: Select seeds + adjust slider

---

## Keyboard Shortcuts

When slider is focused:
- **Left Arrow**: Decrease by 10%
- **Right Arrow**: Increase by 10%
- **Home**: Jump to 0% (All Mood)
- **End**: Jump to 100% (All Seeds)
- **Page Up**: Jump to 75%
- **Page Down**: Jump to 25%

---

## Technical Details

### Storage
- Setting name: `MoodActivityBlendRatio`
- Type: `Number` (float)
- Range: 0.0 to 1.0 internally (0% to 100% in UI)
- Default: 0.5 (50%)

### Conversion
```javascript
// UI Slider (0-100) ? Internal Storage (0.0-1.0)
storageValue = sliderValue / 100.0

// Example: 50% slider ? 0.5 stored
```

### Access via JavaScript
```javascript
// Read current blend ratio
const config = app.getValue('MatchMonkey', {});
console.log(config.MoodActivityBlendRatio); // e.g., 0.5

// Set blend ratio programmatically
app.setValue('MatchMonkey', {
    ...app.getValue('MatchMonkey', {}),
    MoodActivityBlendRatio: 0.7  // 70% seed
});
```

---

## Troubleshooting

### Slider not responding
1. Ensure MoodDiscoveryEnabled is checked
2. Reload options panel (close and reopen)
3. Check console for errors (F12)

### Value not saving
1. Click "OK" or "Apply" to save settings
2. Verify in console: `app.getValue('MatchMonkey', {}).MoodActivityBlendRatio`

### Unexpected results
1. Check slider position matches your goal
2. Verify seed selection (did you select tracks?)
3. Try different slider positions to find your preference

---

## Quick Reference Card

```
???????????????????????????????????????????????
?  SEED/MOOD BALANCE SLIDER                   ?
???????????????????????????????????????????????
?                                             ?
?  0%     25%     50%     75%    100%        ?
?  [??????????????????????????]              ?
?  All     Adv    Bal    Safe    All         ?
?  Mood           ?             Seeds         ?
?                                             ?
?  ? More Discovery    More Familiar ?        ?
?                                             ?
???????????????????????????????????????????????
?  QUICK GUIDE                                ?
???????????????????????????????????????????????
?  0-20%   : Discover new genres              ?
?  30-40%  : Adventurous exploration          ?
?  50%     : ? BALANCED (recommended)         ?
?  60-70%  : Your taste + mood                ?
?  80-100% : Seed-based filtering             ?
???????????????????????????????????????????????
```

---

## Screenshot Locations

_(Add screenshots here after UI implementation)_

1. **Full Settings Panel**: Shows all mood/activity controls
2. **Slider Close-up**: Detailed view of blend ratio slider
3. **Slider at 0%**: All Mood configuration
4. **Slider at 50%**: Balanced configuration
5. **Slider at 100%**: All Seeds configuration

---

For more information:
- **User Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Examples**: `docs/EXAMPLES_TUTORIAL.md`
- **Quick Start**: `docs/QUICKSTART.md`
