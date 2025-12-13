# Rebuild Instructions - Fix Network Error

Since Safari works, the network is fine. The app just needs to be rebuilt to pick up the correct API URL.

## Step 1: Stop Everything
- Stop Metro bundler (Ctrl+C in terminal where it's running)
- Stop the app on your iPhone (swipe up and close it)

## Step 2: Clear Cache and Rebuild

Run these commands:

```bash
cd driver-app

# Clear all caches
rm -rf .expo node_modules/.cache

# Start Metro with LAN mode and clear cache
EXPO_PUBLIC_API_URL_IOS_PHYSICAL=http://192.168.0.103:3000 npx expo start --lan --clear
```

**In a NEW terminal window**, run:

```bash
cd driver-app

# Rebuild and install on your iPhone
npx expo run:ios --device
```

## Step 3: Check Console Logs

When the app starts, look for these logs in the Metro terminal:
- `📱 Physical iOS device detected`
- `🌐 Using API URL: http://192.168.0.103:3000`
- `🔗 API Base URL: http://192.168.0.103:3000`

If you see `localhost` instead, the environment variable isn't loading.

## Alternative: Hardcode for Testing

If environment variables still don't work, we can temporarily hardcode the URL in `config/api.ts`:

```typescript
if (isPhysicalDevice) {
  return 'http://192.168.0.103:3000'; // Hardcoded for testing
}
```

But try the rebuild first!

