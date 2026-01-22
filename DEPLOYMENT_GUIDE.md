# DEPLOYMENT GUIDE: SimilarArtists MM5 Refactored Add-on

## Overview

This guide covers deploying the completely refactored SimilarArtists MediaMonkey 5 add-on (Phases 1-7) with the unified `actions.js` file.

---

## ?? Deployment File Structure

```
SimilarArtistsMM5/
?
??? ?? MAIN ENTRY POINT
??? similarArtists-MM5Integration.js        Main add-on file (300+ LOC)
?
??? ?? ACTION HANDLERS
??? actions.js                               Action definitions (400+ LOC)
?
??? ?? MODULES (Phases 1-6)
??? modules/
    ??? config.js                            Phase 1 (150+ LOC)
    ??? index.js                             Main export
    ?
    ??? core/
    ?   ??? orchestration.js                 Phase 5 (600+ LOC)
    ?   ??? autoMode.js                      Phase 6 (500+ LOC)
    ?   ??? mm5Integration.js                Phase 7 helper (350+ LOC)
    ?
    ??? settings/
    ?   ??? storage.js                       (200+ LOC)
    ?   ??? prefixes.js                      (150+ LOC)
    ?   ??? lastfm.js                        (50+ LOC)
    ?
    ??? ui/
    ?   ??? notifications.js                 Phase 3 (250+ LOC)
    ?
    ??? api/
    ?   ??? cache.js                         (100+ LOC)
    ?   ??? lastfm.js                        (150+ LOC)
    ?   ??? index.js
    ?
    ??? db/
    ?   ??? index.js
    ?   ??? library.js                       Phase 4 (200+ LOC)
    ?   ??? playlist.js                      Phase 4 (100+ LOC)
    ?   ??? queries.js                       Phase 4 (300+ LOC)
    ?
    ??? utils/
        ??? normalization.js                 Phase 2 (200+ LOC)
        ??? helpers.js                       Phase 2 (150+ LOC)
        ??? sql.js                           Phase 2 (100+ LOC)

??? ?? OPTIONAL (Documentation)
    ??? [35+ documentation files]
```

---

## ? Pre-Deployment Checklist

### File Preparation
- [ ] `similarArtists-MM5Integration.js` exists
- [ ] `actions.js` exists (new unified file)
- [ ] `modules/` directory complete
- [ ] All module files present
- [ ] No syntax errors in files
- [ ] All imports resolve

### Clean Up Old Files
- [ ] ~~actions_add.js~~ (removed)
- [ ] ~~actions_add_Phase7.js~~ (removed)
- [ ] ~~similarArtists-REFACTORED.js~~ (removed if exists)
- [ ] ~~similarArtists.js~~ (old monolithic version removed)

### Dependencies Verified
- [ ] MediaMonkey 5.0+ available
- [ ] Last.fm API key configured
- [ ] Internet connection available
- [ ] Database writable
- [ ] No conflicting add-ons

---

## ?? Deployment Steps

### Step 1: Prepare Directory
```bash
# Navigate to MM5 add-ons directory
cd "C:\Users\<username>\AppData\Roaming\MediaMonkey5\Scripts\Extensions"

# Or find your MM5 extensions directory via MM5:
# Tools ? Options ? Extensions ? Open Extensions Folder
```

### Step 2: Copy Files
```bash
# Copy main entry point
copy similarArtists-MM5Integration.js .

# Copy action handlers
copy actions.js .

# Copy modules directory (entire tree)
xcopy modules modules\ /E /I /Y
```

### Step 3: Verify Structure
Check that directory contains:
```
? similarArtists-MM5Integration.js
? actions.js
? modules/
  ? config.js
  ? core/
  ? settings/
  ? ui/
  ? api/
  ? db/
  ? utils/
```

### Step 4: Reload MM5
1. Close MediaMonkey 5 completely
2. Reopen MediaMonkey 5
3. Wait for add-ons to load
4. Check console for success messages

### Step 5: Verify Installation
1. Open MM5 console (Tools ? Debugging Tools ? Console)
2. Look for these messages:
   ```
   SimilarArtists: Module loaded, call start() to initialize
   SimilarArtists: Starting add-on...
   SimilarArtists: Integration initialized successfully
   SimilarArtists: Action handlers registered
   ```

---

## ?? Testing After Deployment

### Test 1: Actions Appear in Menu
1. Click **Tools** menu
2. Look for **Similar Artists** submenu
3. Should see:
   - Similar Artists
   - Similar Artists: Auto On/Off (with checkbox)

? **PASS** if both appear

### Test 2: Run Workflow
1. Select a track in library
2. Click **Tools ? Similar Artists**
3. Workflow should start
4. Progress notification should appear
5. Tracks should be added to playlist/queue

? **PASS** if workflow completes without errors

### Test 3: Toggle Auto-Mode
1. Click **Tools ? Similar Artists: Auto On/Off**
2. Checkbox should toggle
3. Console should log toggle event
4. Try clicking again to toggle back

? **PASS** if checkbox state changes

### Test 4: Settings Persistence
1. Enable auto-mode
2. Close MediaMonkey 5
3. Reopen MediaMonkey 5
4. Check if auto-mode still enabled

? **PASS** if setting persists

### Test 5: Auto-Queue
1. Enable auto-mode
2. Create Now Playing with 5-10 tracks
3. Play until 2-3 tracks remain
4. Auto-queue should trigger
5. ~10 similar tracks should be added

? **PASS** if auto-queue works

### Test 6: Error Handling
1. Disable network connection
2. Try to run workflow
3. Should show error notification
4. Should not crash
5. Should recover gracefully

? **PASS** if error handled gracefully

### Test 7: Hotkey Configuration
1. Tools ? Options ? Hotkeys
2. Search for "Similar Artists"
3. Should find both actions
4. Should be able to configure hotkeys

? **PASS** if hotkeys configurable

### Test 8: Toolbar Integration
1. Right-click toolbar
2. "Customize Toolbar"
3. Search for "Similar Artists"
4. Drag to toolbar
5. Click button
6. Workflow should run

? **PASS** if toolbar integration works

---

## ?? Troubleshooting

### Actions Don't Appear in Menu

**Symptoms:**
- Tools menu doesn't show Similar Artists
- Console shows no registration message

**Solutions:**
1. Check `actions.js` is in root directory
2. Check for syntax errors: `console.log(window.actions)`
3. Verify `similarArtists-MM5Integration.js` loaded first
4. Restart MediaMonkey 5
5. Check console for errors

### Workflow Doesn't Run

**Symptoms:**
- Click action but nothing happens
- No error messages

**Solutions:**
1. Check `window.SimilarArtists` exists: open console and type it
2. Verify `similarArtists-MM5Integration.js` loaded
3. Check all modules in `modules/` directory
4. Look for errors in console
5. Restart MM5 and try again

### Auto-Mode Doesn't Trigger

**Symptoms:**
- Enabled auto-mode but nothing happens
- No queue additions

**Solutions:**
1. Check `app.listen` available: `console.log(typeof app.listen)`
2. Verify `app.player` available: `console.log(typeof app.player)`
3. Check auto-mode enabled: `window.SimilarArtists?.isAutoEnabled?.()`
4. Check `modules/core/autoMode.js` present
5. Look for "Auto-Mode:" messages in console

### Settings Not Persisting

**Symptoms:**
- Change setting but reverts after restart
- Save not working

**Solutions:**
1. Check database writable
2. Test settings directly: `app.settings.setSetting('OnPlay', true)`
3. Verify `modules/settings/storage.js` present
4. Check browser/MM5 console for errors
5. Restart MediaMonkey 5

### Module Not Found Error

**Symptoms:**
- Console shows "Cannot find module"
- Add-on fails to load

**Solutions:**
1. Verify `modules/` directory structure complete
2. Check all required files present
3. Verify `modules/index.js` exports all modules
4. Check file paths are correct
5. Restart MM5

---

## ?? Verification Checklist

After deployment, verify:

```
Actions System
  ? actions.js loaded
  ? Both actions registered
  ? Menu items visible
  ? Hotkeys configurable
  ? Toolbar button works

Modules
  ? Config loaded
  ? Settings working
  ? Notifications appearing
  ? Database accessible
  ? API queries working

Integration
  ? Entry point initialized
  ? Phases 1-6 loaded
  ? Auto-mode listener attached
  ? MM5 events subscribed
  ? UI responding

Functionality
  ? Similar artists generates
  ? Library matching works
  ? Playlist/queue creation works
  ? Auto-mode toggles
  ? Settings persist

Error Handling
  ? Errors logged to console
  ? Graceful failure
  ? No crashes
  ? Recovery works
```

---

## ?? Deployment Checklist

### Before Deployment
- [ ] All files copied to correct locations
- [ ] Directory structure verified
- [ ] No syntax errors
- [ ] All imports resolvable
- [ ] Backup of original MM5 taken

### During Deployment
- [ ] MediaMonkey 5 closed
- [ ] Files copied completely
- [ ] No copy errors
- [ ] File permissions set correctly
- [ ] Directory structure intact

### After Deployment
- [ ] MediaMonkey 5 started cleanly
- [ ] Console shows load messages
- [ ] No initialization errors
- [ ] Actions appear in menu
- [ ] Basic tests pass
- [ ] Advanced tests pass

### Documentation
- [ ] Deployment recorded
- [ ] Issues noted
- [ ] Customizations documented
- [ ] User guide provided
- [ ] Support info available

---

## ?? Rollback Instructions

If issues occur:

```bash
# 1. Close MediaMonkey 5

# 2. Remove new files
rm similarArtists-MM5Integration.js
rm actions.js
rm -r modules/

# 3. Restore old files (if backed up)
# Or reinstall old version

# 4. Restart MediaMonkey 5
```

---

## ?? Support & Debugging

### Enable Debug Logging
```javascript
// In MM5 console:
window.SimilarArtists?.modules?.core?.mm5Integration?.checkMM5Availability?.()
```

### Check Current State
```javascript
// In MM5 console:
window.SimilarArtists?.getState?.()
// Should return: {started: true, autoModeEnabled: boolean}
```

### Manual Tests
```javascript
// Run workflow manually:
window.SimilarArtists?.runSimilarArtists?.(false)

// Toggle auto-mode manually:
window.SimilarArtists?.toggleAuto?.()

// Check if auto enabled:
window.SimilarArtists?.isAutoEnabled?.()
```

### Get Help
- Check console for error messages
- Review `PROJECT_COMPLETE.md`
- Review phase-specific documentation
- Check GitHub issues
- Contact developer

---

## ?? Distribution Package

To distribute this add-on:

```
SimilarArtistsMM5-vX.Y.Z.zip
??? similarArtists-MM5Integration.js
??? actions.js
??? modules/
??? README.md
??? LICENSE
??? MANIFEST.json
??? INSTALLATION.md
```

Create `MANIFEST.json`:
```json
{
  "name": "Similar Artists",
  "version": "2.0.0",
  "author": "Your Name",
  "description": "Generate playlists from similar artists using Last.fm",
  "license": "MIT",
  "main": "similarArtists-MM5Integration.js",
  "actions": "actions.js",
  "requirements": {
    "mm5Version": "5.0+"
  }
}
```

---

## ? Success Indicators

When deployment successful:

? Console shows "SimilarArtists: Action handlers registered"  
? Both actions appear in Tools menu  
? Auto-mode checkbox toggles  
? Run action executes workflow  
? Similar artists are generated  
? Settings persist across restarts  
? Auto-queue works when enabled  
? No console errors  

---

## ?? Deployment Complete!

Once all tests pass, your deployment is complete.

The SimilarArtists add-on is now fully deployed and ready for use.

---

**Status:** ? **Ready for Deployment**

**Files:** 
- 1 main entry point
- 1 action handler file
- 15+ modules
- 35+ documentation files

**Total LOC:** 3450+  
**Quality:** Production-Ready  
**Status:** ? Complete

---

For more information, see:
- `PROJECT_COMPLETE.md` - Project overview
- `PHASE_7_QUICK_START.md` - Quick reference
- `ACTIONS_MIGRATION_GUIDE.md` - Actions file details
