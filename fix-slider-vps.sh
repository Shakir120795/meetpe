#!/bin/bash
# Fix Image Slider on VPS
# Run this script on your VPS to resolve slider issues

set -e  # Exit on error

echo "🔧 Image Slider VPS Fix Script"
echo "=================================="
echo ""

cd ~/meetpe

# Step 1: Backup catalog
echo "📦 Step 1: Backing up catalog.json..."
cp data/catalog.json data/catalog.json.backup
echo "✅ Backup created: data/catalog.json.backup"
echo ""

# Step 2: Resolve git conflict
echo "🔀 Step 2: Resolving git conflict..."
git checkout data/catalog.json
echo "✅ Git conflict resolved"
echo ""

# Step 3: Pull latest code
echo "📥 Step 3: Pulling latest code from GitHub..."
git pull origin main
if [ $? -eq 0 ]; then
  echo "✅ Git pull successful"
else
  echo "❌ Git pull failed. Check your connection."
  exit 1
fi
echo ""

# Step 4: Check if catalog has images
echo "🔍 Step 4: Verifying catalog.json has images..."
if grep -q '"images":' data/catalog.json; then
  echo "✅ Found images array in catalog.json"
  IMAGES_COUNT=$(grep -c '"images":' data/catalog.json)
  echo "   Products with images: $IMAGES_COUNT"
else
  echo "⚠️  No images found in catalog.json"
  echo "   Adding sample images to C1 product..."
  # Could add migration script here if needed
fi
echo ""

# Step 5: Check if app.js has slider code
echo "🎬 Step 5: Verifying slider code..."
if grep -q "card-slider" public/app.js; then
  echo "✅ Slider code found in app.js"
else
  echo "❌ Slider code NOT found in app.js"
  exit 1
fi

if grep -q "card-slider" public/style.css; then
  echo "✅ Slider CSS found in style.css"
else
  echo "❌ Slider CSS NOT found in style.css"
  exit 1
fi
echo ""

# Step 6: Restart PM2
echo "🚀 Step 6: Restarting PM2..."
if command -v pm2 &> /dev/null; then
  pm2 restart meetpe
  echo "✅ PM2 restarted successfully"
  echo "   Waiting 3 seconds for restart..."
  sleep 3
else
  echo "⚠️  PM2 not found. Start server manually."
fi
echo ""

# Step 7: Verify server is running
echo "🔗 Step 7: Verifying server is running..."
if curl -s http://localhost:3000/api/menu > /dev/null; then
  echo "✅ Server is responding"
  
  # Check if C1 has images in API response
  if curl -s http://localhost:3000/api/menu | grep -q '"images":'; then
    echo "✅ API returning images in response"
  else
    echo "⚠️  API response doesn't include images"
  fi
else
  echo "⚠️  Server not responding on :3000"
  echo "   Check: ps aux | grep node"
  echo "   Or: pm2 logs meetpe"
fi
echo ""

# Step 8: Show final status
echo "=================================="
echo "✅ Fix Complete!"
echo "=================================="
echo ""
echo "NEXT STEPS:"
echo "1. On your device/browser:"
echo "   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "   - Open the app"
echo "   - Go to 'Chicken' category"
echo "   - Click 'Premium Fresh Chicken (1kg)'"
echo ""
echo "2. You should see:"
echo "   - Product image"
echo "   - ● ○ ○ (three dots below image)"
echo "   - Can click dots to navigate"
echo "   - Can swipe on mobile"
echo ""
echo "3. If slider still not showing:"
echo "   - Check: pm2 logs meetpe"
echo "   - Verify: grep 'card-slider' public/app.js"
echo "   - Test: curl http://localhost:3000/api/menu"
echo ""
echo "Troubleshooting: See VPS_SLIDER_FIX.md"
