# 🔧 VPS SLIDER FIX - Step by Step

## 🔴 Current Issue on VPS
1. **Git Pull Error**: Local changes conflict in `data/catalog.json`
2. **Slider Not Showing**: User app still showing only 1 image, no dots/swipe

## ✅ SOLUTION (Run on VPS)

### Step 1: Resolve Git Conflict
```bash
cd ~/meetpe

# Backup current catalog first
cp data/catalog.json data/catalog.json.backup

# Discard local changes and force pull latest
git checkout data/catalog.json
git pull origin main

# Verify pull was successful
git log --oneline -1
```

Expected output: Should show commit `5f09a6b` (latest)

### Step 2: Verify catalog.json Has Images
```bash
# Check if C1 has images array
grep -A 10 '"code": "C1"' data/catalog.json | head -15
```

Expected output:
```json
{
  "code": "C1",
  "cat": "chicken",
  "name": "Premium Fresh Chicken (1kg)",
  "price": 260,
  "unit": "1kg",
  "images": [
    "https://images.unsplash.com/photo-1563379091339-d0feefd290e5?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1599599810694-b5ac4dd12b20?w=400&h=400&fit=crop"
  ]
}
```

If shows `"img": ""` (empty) → catalog.json not updated yet

### Step 3: Restart PM2
```bash
# Restart the app to load new code
pm2 restart meetpe

# Verify restart successful
pm2 logs meetpe --lines 20
```

### Step 4: Clear Browser Cache
On your testing device:
- **Desktop**: Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- **Mobile**: Force quit app, clear app cache, reopen

### Step 5: Test Slider
1. Open app
2. Go to "Chicken" category
3. Click "Premium Fresh Chicken (1kg)"
4. Should see **● ○ ○** (three dots below image)
5. Click any dot → image should change
6. On mobile: Try swiping left/right

---

## 🐛 If Slider Still Not Showing

### Check 1: Verify Server Has New Code
```bash
# Check if slider code exists in app.js
grep -n "card-slider" public/app.js | head -5
```

Expected: Should find multiple matches (lines with slider references)

### Check 2: Verify CSS Loaded
```bash
# Check if slider CSS exists
grep -n "card-slider" public/style.css | head -5
```

Expected: Should find CSS definitions

### Check 3: Check Server Logs for Errors
```bash
# View real-time logs
pm2 logs meetpe --lines 50

# Look for any JavaScript errors or API issues
```

### Check 4: Test API Directly
```bash
# From VPS, test if /api/menu returns images
curl http://localhost:3000/api/menu | jq '.menu[0]'
```

Expected output should include:
```json
{
  "code": "C1",
  "images": ["url1", "url2", "url3"],
  ...
}
```

If images array is missing → server not restarted properly

### Check 5: Verify Browser Loaded New Code
Open browser DevTools (F12):
1. Go to Network tab
2. Reload page (F5)
3. Look for `app.js` - check if it loaded from server
4. Go to Sources tab
5. Find `app.js`
6. Search for `card-slider` - should find slider code

---

## 🚀 Quick Fix Checklist

- [ ] Resolved git conflict with `git checkout data/catalog.json`
- [ ] Pulled latest with `git pull origin main`
- [ ] Verified catalog.json has images array (not empty img fields)
- [ ] Restarted PM2 with `pm2 restart meetpe`
- [ ] Cleared browser cache (Ctrl+Shift+R)
- [ ] Tested on device (should see dots)
- [ ] Tried clicking dots and swiping

---

## 🔧 Manual Fix (If Still Doesn't Work)

If slider absolutely not showing, manually add images to catalog.json:

```bash
cd ~/meetpe

# Edit catalog.json directly
nano data/catalog.json
```

Find C1 product and replace:
```json
// OLD:
{
  "code": "C1",
  "cat": "chicken",
  "name": "Premium Fresh Chicken (1kg)",
  "price": 260,
  "unit": "1kg",
  "img": ""
}

// NEW:
{
  "code": "C1",
  "cat": "chicken",
  "name": "Premium Fresh Chicken (1kg)",
  "price": 260,
  "unit": "1kg",
  "images": [
    "https://images.unsplash.com/photo-1563379091339-d0feefd290e5?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1599599810694-b5ac4dd12b20?w=400&h=400&fit=crop"
  ]
}
```

Save (Ctrl+O, Enter, Ctrl+X) then:
```bash
pm2 restart meetpe
```

---

## 📱 Test on Mobile

1. Open browser
2. Go to your app URL
3. Tap on Chicken category
4. Tap "Premium Fresh Chicken (1kg)"
5. You should see product card with image
6. **Below image**: Should see 3 dots (● ○ ○)
7. **Swipe left**: Image changes to image #2 (○ ● ○)
8. **Swipe left again**: Image changes to image #3 (○ ○ ●)

If dots not visible → images not in catalog.json

---

## 📞 If Still Issues

1. Check `/var/log/meetpe.log` for server errors
2. Verify pm2 process is running: `pm2 list`
3. Check if port 3000 is listening: `netstat -tlnp | grep 3000`
4. Check disk space: `df -h`
5. Check memory: `free -h`

---

## ✅ Expected Result After Fix

```
BEFORE:
- Single image showing
- No dots/indicators
- No swipe functionality
- No auto-play

AFTER:
- 3 images visible via dots
- Click any dot → jump to image
- Swipe left/right on mobile → navigate
- Auto-play: Changes every 3.5 seconds
- Hover on desktop → pauses auto-play
```

---

Run these commands and let me know if slider shows! 🚀
