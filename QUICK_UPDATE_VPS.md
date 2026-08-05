# 🚀 Quick VPS Update Guide

## ✅ Latest Feature: Search & Filters System

---

## 📋 3-Step Deployment

### Step 1: Update Code on VPS
```bash
cd ~/meetpe && git pull && pm2 restart meetpe
```

### Step 2: Verify It's Working
1. Open your website
2. Click in search box → Should see "🔥 Trending Searches"
3. Click "⚙️ Filter" button → Modal should open
4. Click 🎤 icon → Voice search should work

### Step 3: Configure Trending Searches (Optional)
1. Go to `/settings.html`
2. Enter admin key
3. Load settings
4. Scroll to "🔥 Trending Searches"
5. Edit terms (one per line)
6. Save

---

## ✅ What's New

### Search Enhancements:
- 🎤 **Voice Search** - Click mic icon, speak, search automatically
- 🕒 **Recent Searches** - Shows your last 5 searches
- 🔥 **Trending Searches** - Admin-editable popular terms
- 📋 **Suggestions Dropdown** - Combined recent + trending

### Filters:
- 💰 **Price Range** - Min/Max price filter
- ⚖️ **Weight** - 500g, 1kg, 2kg+ options
- 🔪 **Type** - Boneless, Skinless options
- ✨ **Attributes** - Fresh, Marinated, Offers

### Admin Panel:
- ✅ Edit trending searches in Settings
- ✅ No code changes needed

---

## 🧪 Quick Test

```bash
# After updating VPS:

1. Open website
2. Click search box (empty)
   ✅ Should see trending searches dropdown
   
3. Type "chicken" and search
   ✅ Products filtered
   
4. Clear search, click box again
   ✅ Should see "chicken" in recent searches
   
5. Click 🎤 icon
   ✅ Microphone permission requested
   ✅ Speak → text appears → search runs
   
6. Click "⚙️ Filter" button
   ✅ Modal slides up
   ✅ Can select multiple filters
   ✅ "Apply Filters" works
```

---

## 🐛 If Something Breaks

### Check Server Logs:
```bash
pm2 logs meetpe --lines 50
```

### Restart Server:
```bash
pm2 restart meetpe
```

### Check Git Status:
```bash
cd ~/meetpe
git status
git log --oneline -5
```

### Rollback if Needed:
```bash
cd ~/meetpe
git log --oneline -10
# Find previous commit hash
git reset --hard <commit-hash>
pm2 restart meetpe
```

---

## 📁 Files Changed

- `public/index.html` - Search & filters frontend
- `src/data/settings.js` - Trending searches backend
- `public/settings.html` - Admin panel for trending

---

## ✅ Success Checklist

- [ ] `git pull` completed without errors
- [ ] `pm2 restart meetpe` successful
- [ ] Search box shows trending searches
- [ ] Voice search 🎤 button works
- [ ] Filter button opens modal
- [ ] Admin can edit trending searches in `/settings.html`
- [ ] No errors in browser console
- [ ] No errors in `pm2 logs`

---

## 🎯 That's It!

Everything pushed to GitHub.  
Just run the update command on VPS and you're done! 🎉

**Update Command:**
```bash
cd ~/meetpe && git pull && pm2 restart meetpe
```

---

**Need Help?** Check:
- `SEARCH_FILTERS_COMPLETE.md` - Full documentation
- `DEPLOYMENT_INSTRUCTIONS_SEARCH_FILTERS.md` - Detailed deployment guide
- `pm2 logs meetpe` - Server logs
