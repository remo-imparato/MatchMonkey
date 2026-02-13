# MatchMonkey Quick Start Guide

## What is MatchMonkey?

MatchMonkey is a MediaMonkey 5 add-on that generates playlists or queues tracks by finding music related to your seeds using:
- Last.fm — artist and track similarity, top tracks and tag/genre lookups
- ReccoBeats — audio-feature ("acoustics") recommendations and mood/activity presets
- Your local library — matching results to the files you already own

---

## Quick setup (30–60 seconds)

1. Open MediaMonkey 5
2. Select 1–5 seed tracks in your library (or start playing a track)
3. Open the Match Monkey add-on from the Tools menu or toolbar
4. Choose a discovery mode and run

---

## Discovery modes (what to use and when)

- **Artist** — Find similar artists based on your seed artists. Good for exploring related artists and getting top tracks.
- **Track** — Find musically similar tracks. Good for covers, versions, and sonically similar songs.
- **Genre** — Use genres/tags from seeds to find popular artists in those genres. Good for broad genre exploration.
- **Acoustics** — Audio-based recommendations that match your seed tracks. Requires seed tracks for best results.
- **Mood / Activity** — Create playlists tailored to a specific mood or activity, blended with your listening preferences.

Note: Mood and Activity flows compute or blend audio features from seed tracks and then request/filter recommendations. If no seeds are available (or ReccoBeats cannot find the seed track IDs) those flows may return no candidates.

---

## Seed selection & include-seed behavior

- Seeds come from your selected tracks or the currently playing track when nothing is selected.
- You can optionally include the original seed tracks in your playlists using the "Include seed track" setting.

---

## Auto-Queue (Auto-mode)

- Enable Auto-mode in Tools → Options → Match Monkey.
- Auto-mode attaches a playback listener and triggers discovery when Now Playing is near the end.
- Auto-mode prevents concurrent triggers and will try fallback discovery modes when the preferred mode returns no results.

---

## Quick tips

- For targeted results use Track or Artist mode.
- For broader exploration use Genre or Acoustics mode.
- For mood/activity playlists choose Mood or Activity mode with 3–5 representative seeds.
- Use the blend ratio setting to control how much the seed audio profile vs. mood/activity profile influences results (0 = all seed, 1 = all mood/activity).

---

## Troubleshooting (short)

- No results: select seed tracks, lower minimum rating filters, enable "Include unrated".
- Too random: increase seed influence (blend ratio) or use Artist or Track mode.
- Slow: reduce similar artists limit or tracks-per-artist limits in settings.
- Auto-queue not triggering: verify Auto-mode is enabled and Now Playing is near its end.

---

## Where to configure

Tools → Options → Match Monkey — adjust discovery mode defaults, limits, mood/activity blend, playlist behavior, and Auto-Queue settings.

---

## Need more help?

- [User Guide](USER_GUIDE.md) — Complete guide with detailed explanations
- [Quick Reference](QUICK_REFERENCE.md) — Settings reference and tips
- [Examples & Tutorial](EXAMPLES_TUTORIAL.md) — Real-world usage examples
- Report issues: [GitHub Issues](https://github.com/remo-imparato/MatchMonkey/issues)
- Support the project: [Ko-fi](https://ko-fi.com/remoimparato)
---

## Mood Tooltips
- Energetic: High‑energy, upbeat, fast‑moving tracks
- Relaxed: Calm, mellow, chill background music
- Happy: Bright, feel‑good, upbeat pop vibes
- Sad: Soft, emotional, low‑energy songs
- Focused: Minimal, steady, distraction‑free instrumentals
- Angry: Loud, intense, aggressive high‑energy music
- Romantic: Warm, smooth, intimate love‑leaning tracks
- Uplifting: Positive, inspiring, motivational songs
- Dark: Moody, atmospheric, low‑valence tracks

## Activity Tooltips
- Workout: Fast, loud, high‑energy motivation
- Study: Quiet, steady, mostly instrumental
- Party: Danceable, upbeat, club‑ready tracks
- Sleep: Soft, slow, soothing ambient music
- Driving: Steady, feel‑good road‑trip energy
- Meditation: Calm, spacious, ambient soundscapes
- Cooking: Light, pleasant, upbeat background music
- Cleaning: Energetic, catchy, movement‑friendly
- Walking: Mid‑tempo, feel‑good everyday tracks
- Coding: Minimal, repetitive, focus‑friendly electronic