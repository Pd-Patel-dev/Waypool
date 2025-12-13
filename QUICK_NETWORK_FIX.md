# Quick Fix for Network Error on iPhone

## The Problem
"Network request failed" means your iPhone can't reach the backend server.

## Step-by-Step Fix

### Step 1: Test Backend from iPhone Safari ⚠️ CRITICAL

**On your iPhone:**
1. Open **Safari**
2. Type in address bar: `http://192.168.0.103:3000/health`
3. Press Go

**Expected Result:** You should see JSON like:
```json
{"status":"ok","message":"Server is running",...}
```

**If you see an error or can't connect:**
→ **Mac Firewall is blocking connections** (most common issue)

### Step 2: Fix Mac Firewall

**Option A: Temporarily Disable (for testing)**
1. **System Settings** → **Network** → **Firewall**
2. Turn **OFF** firewall temporarily
3. Test from iPhone Safari again
4. If it works, proceed to Option B

**Option B: Allow Node.js Through Firewall**
```bash
# Allow Node.js through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node

# Or find Node.js path:
which node
# Then use that path in the command above
```

**Option C: Allow Port 3000**
1. **System Settings** → **Network** → **Firewall** → **Options**
2. Click **+** to add an application
3. Find and add **Terminal** or **Node.js**
4. Or add a port exception for port 3000

### Step 3: Verify Same Wi-Fi Network

**Check Mac IP:**
```bash
ipconfig getifaddr en0
```
Should show: `192.168.0.103`

**Check iPhone IP:**
- Settings → Wi-Fi → Tap (i) next to network
- Should be similar: `192.168.0.xxx`

**If different networks:**
- Connect both to the same Wi-Fi network

### Step 4: Restart Everything

1. **Stop backend** (Ctrl+C in backend terminal)
2. **Restart backend:**
   ```bash
   cd backend
   npm run dev
   ```
3. **Check backend logs** - should show:
   ```
   🌐 Accessible from local network at: http://192.168.0.103:3000
   ```

4. **Stop Metro** (Ctrl+C)
5. **Restart Metro:**
   ```bash
   cd driver-app
   npx expo start --lan --clear
   ```

6. **Rebuild app:**
   ```bash
   npx expo run:ios --device
   ```

### Step 5: Check App Logs

When the app runs, check the console for:
- `📱 Physical iOS device detected`
- `🌐 Using API URL: http://192.168.0.103:3000`
- `🔗 API Base URL: http://192.168.0.103:3000`

If you see `localhost` or a different IP, the `.env` file isn't being read.

## Quick Test Checklist

- [ ] Backend is running (`npm run dev` in backend folder)
- [ ] iPhone Safari can access `http://192.168.0.103:3000/health`
- [ ] Mac firewall allows connections (or is disabled for testing)
- [ ] Both devices on same Wi-Fi network
- [ ] `.env` file has `EXPO_PUBLIC_API_URL_IOS_PHYSICAL=http://192.168.0.103:3000`
- [ ] Metro bundler shows the correct API URL in logs

## Most Common Solution

**90% of the time, it's the Mac firewall.**

1. Disable firewall temporarily
2. Test from iPhone Safari: `http://192.168.0.103:3000/health`
3. If it works, add Node.js exception to firewall
4. Re-enable firewall

## Still Not Working?

Try tunnel mode (slower but bypasses network issues):
```bash
cd driver-app
npx expo start --tunnel
```

This uses Expo's tunnel service and should work even with firewall issues.

