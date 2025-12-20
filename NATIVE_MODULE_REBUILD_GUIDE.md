# Native Module Rebuild Guide

## Issue
The error `Cannot find native module 'ExpoImageManipulator'` occurs because `expo-image-manipulator` is a native module that requires a rebuild after installation.

## Solution

### Option 1: Rebuild Native App (Recommended)
After installing native modules, you need to rebuild the app:

```bash
# For iOS
cd Waypool/driver-app
npx expo prebuild
npx expo run:ios

# For Android
npx expo prebuild
npx expo run:android
```

### Option 2: Use Development Build
If you're using Expo Go, native modules won't work. You need a development build:

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Create development build
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### Option 3: Temporary Workaround
The app now gracefully handles missing native modules:
- If compression fails, it uses the original image
- Shows a helpful alert explaining the issue
- Upload still works, just without compression

## What Was Fixed

1. **Lazy Loading**: ImageManipulator is now loaded dynamically, preventing crashes on import
2. **Error Handling**: Clear error messages when native module isn't available
3. **Graceful Fallback**: Uses original image if compression fails
4. **User Feedback**: Alert explains what needs to be done

## Current Status

- ✅ Code updated to handle missing native modules gracefully
- ✅ Fallback to original images when compression unavailable
- ⚠️ Compression requires native rebuild to work
- ✅ Upload functionality works with or without compression

## Next Steps

1. **For Development**: Rebuild the app with `npx expo prebuild && npx expo run:ios`
2. **For Production**: Create a development build or use EAS Build
3. **For Testing**: The app will work without compression, just with larger file sizes

---

*The app now handles missing native modules gracefully. Compression will work after a rebuild.*

