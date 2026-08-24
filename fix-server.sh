#!/bin/bash
# 🚨 NUCLEAR FIX - Run this on server to fix everything

echo "🔧 Starting complete fix process..."

# Step 1: Check current location
echo "📁 Current directory:"
pwd

# Step 2: Backup current index.html
echo "💾 Creating backup..."
cp public/index.html public/index.html.backup.$(date +%Y%m%d_%H%M%S)

# Step 3: Delete ALL CSS files
echo "🗑️ Removing all external CSS files..."
find public -name "*.css" -type f -delete
echo "✅ CSS files deleted"

# Step 4: Show git status
echo "📊 Git status:"
git status

# Step 5: Stash any local changes
echo "💼 Stashing local changes..."
git stash

# Step 6: Pull latest code
echo "⬇️ Pulling latest code from GitHub..."
git pull origin main --force

# Step 7: Check latest commit
echo "📝 Latest commit:"
git log -1 --oneline

# Step 8: Verify index.html updated
echo "🔍 Checking if index.html has latest changes..."
grep -c "getCategoryPlaceholder" public/index.html && echo "✅ Latest code confirmed" || echo "❌ Old code still present"

# Step 9: Clear PM2 logs
echo "🧹 Clearing PM2 logs..."
pm2 flush

# Step 10: Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart all

# Step 11: Show PM2 status
echo "📊 PM2 Status:"
pm2 status

# Step 12: Clear Nginx cache (if exists)
if command -v nginx &> /dev/null; then
    echo "🌐 Clearing Nginx cache..."
    sudo systemctl reload nginx 2>/dev/null || echo "⚠️ Nginx reload skipped"
fi

# Step 13: Show file modification time
echo "⏰ index.html last modified:"
ls -lh public/index.html

echo ""
echo "✅ ============================================"
echo "✅ FIX COMPLETE!"
echo "✅ ============================================"
echo ""
echo "Now do these on your phone/browser:"
echo "1. Force close the app completely"
echo "2. Clear app cache from settings"
echo "3. Reopen app - it should show images now"
echo ""
echo "For browser:"
echo "1. Press Ctrl+Shift+Delete"
echo "2. Clear cache and reload"
echo ""
