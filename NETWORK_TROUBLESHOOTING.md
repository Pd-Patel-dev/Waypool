# Network Error Troubleshooting for iPhone

## Quick Diagnostic Steps

### Step 1: Test Backend from iPhone Browser

1. **On your iPhone, open Safari**
2. **Navigate to:** `http://192.168.0.103:3000/health`
3. **You should see:** A JSON response with server status

**If this doesn't work:**
- Your iPhone can't reach the backend
- Check firewall settings on your Mac
- Verify both devices are on the same Wi-Fi network

### Step 2: Check Mac Firewall

**On your Mac:**
1. Go to **System Settings → Network → Firewall**
2. Temporarily **turn off the firewall** to test
3. Try accessing the backend from iPhone Safari again
4. If it works, add an exception for Node.js/port 3000

**Or allow Node.js through firewall:**
```bash
# Allow incoming connections on port 3000
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### Step 3: Verify Network Connection

**Check if both devices are on the same network:**

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On iPhone:**
- Settings → Wi-Fi → Tap the (i) next to your network
- Check the IP address (should be similar, like 192.168.0.xxx)

### Step 4: Test Backend Accessibility

**From your Mac terminal:**
```bash
# Test if backend is accessible on network interface
curl http://192.168.0.103:3000/health
```

**From iPhone Safari:**
- Go to: `http://192.168.0.103:3000/health`
- Should see JSON response

### Step 5: Check App Logs

**In your app, check the console logs:**
- Look for: `🔗 API Base URL: http://192.168.0.103:3000`
- If you see a different URL, the .env file isn't being read correctly

### Step 6: Restart Everything

1. **Stop Metro bundler** (Ctrl+C)
2. **Stop backend** (Ctrl+C)
3. **Restart backend:**
   ```bash
   cd backend
   npm run dev
   ```
4. **Restart Metro:**
   ```bash
   cd driver-app
   npx expo start --lan --clear
   ```
5. **Rebuild app:**
   ```bash
   npx expo run:ios --device
   ```

## Common Issues & Solutions

### Issue: "Network error" in app
**Solution:**
- Check iPhone Safari can access `http://192.168.0.103:3000/health`
- If not, firewall is blocking - disable temporarily or add exception
- Make sure backend is running

### Issue: Wrong API URL in logs
**Solution:**
- Check `.env` file has `EXPO_PUBLIC_API_URL_IOS_PHYSICAL=http://192.168.0.103:3000`
- Restart Metro bundler after changing .env
- Clear cache: `npx expo start --clear`

### Issue: Backend works in Safari but not in app
**Solution:**
- Check app logs for the actual API URL being used
- Verify `Constants.isDevice` is detecting physical device correctly
- Try hardcoding the URL temporarily to test

### Issue: IP address changed
**Solution:**
- Find new IP: `ipconfig getifaddr en0`
- Update `.env` file
- Restart Metro bundler

## Quick Test Commands

```bash
# 1. Check backend is running
curl http://localhost:3000/health

# 2. Check backend is accessible on network
curl http://192.168.0.103:3000/health

# 3. Check what IP your Mac is using
ipconfig getifaddr en0

# 4. Check if port 3000 is listening on all interfaces
netstat -an | grep 3000
```

## Still Not Working?

1. **Try using tunnel mode** (slower but more reliable):
   ```bash
   cd driver-app
   npx expo start --tunnel
   ```

2. **Check Xcode console** for detailed error messages

3. **Verify .env file is being loaded:**
   - Check Metro bundler output for environment variables
   - Should see: `env: export EXPO_PUBLIC_API_URL_IOS_PHYSICAL`

