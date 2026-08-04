# Server Deployment Instructions

## Latest Changes Pushed ✅
- Commit: `62402b3` 
- Fix: Duplicate users issue completely resolved

## Deploy to Production Server

### Option 1: Using Your Server's SSH Details
Replace `<YOUR_SERVER_IP>` with your actual server IP or hostname:

```bash
ssh wasim64malik@<YOUR_SERVER_IP> "cd ~/meetpe && git stash && git pull && pm2 restart meetpe"
```

### Option 2: Step by Step
If the single command doesn't work, run these commands one by one:

```bash
# 1. Connect to server
ssh wasim64malik@<YOUR_SERVER_IP>

# 2. Navigate to project directory
cd ~/meetpe

# 3. Stash any local changes
git stash

# 4. Pull latest code
git pull origin main

# 5. Restart the application
pm2 restart meetpe

# 6. Check status
pm2 status

# 7. View logs (optional)
pm2 logs meetpe --lines 50
```

## Verify the Fix

After deployment, open your admin panel:
1. Go to Users section
2. Check if duplicate users are gone ✅
3. Click "View Profile" on any user
4. Verify all orders and reviews show correctly ✅
5. Check address breakdown shows all addresses ✅

## Rollback (if needed)
If something goes wrong:
```bash
ssh wasim64malik@<YOUR_SERVER_IP>
cd ~/meetpe
git reset --hard 6344c6f  # Previous version
pm2 restart meetpe
```

## What Was Fixed
- ✅ No more duplicate users in admin panel
- ✅ Phone numbers normalized across all formats (web:, whatsapp:)
- ✅ User profiles show ALL orders and reviews
- ✅ Address breakdown working correctly
- ✅ Order aggregation working across phone variants
