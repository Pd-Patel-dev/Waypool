# Fix Code Signing Error

## Quick Fix Steps:

### Step 1: Open Xcode Project
The Xcode project should now be open. If not, run:
```bash
cd driver-app
open ios/driverapp.xcworkspace
```

### Step 2: Add Your Apple ID to Xcode

1. In Xcode, go to **Xcode → Settings** (or **Preferences** on older versions)
2. Click on **Accounts** tab
3. Click the **+** button at the bottom left
4. Select **Apple ID**
5. Enter your Apple ID email and password
6. Click **Sign In**
7. Wait for it to finish loading (you'll see your name appear)

### Step 3: Configure Signing

1. In the left sidebar, click on **"driverapp"** (the blue project icon)
2. In the main area, make sure **"driverapp"** is selected under **TARGETS**
3. Click on the **"Signing & Capabilities"** tab
4. **Check the box**: "Automatically manage signing"
5. Under **Team**, select your Apple ID from the dropdown
   - It should show your name or email
   - If it says "Add an account...", go back to Step 2
6. Xcode will automatically:
   - Create a development certificate
   - Create a provisioning profile
   - Configure everything

### Step 4: Verify Your iPhone is Connected

1. Connect your iPhone to your Mac via USB
2. Unlock your iPhone
3. Trust the computer if prompted
4. In Xcode, go to **Window → Devices and Simulators**
5. Verify your iPhone appears in the list

### Step 5: Build Again

After configuring signing, try again:

```bash
cd driver-app
npx expo run:ios --device
```

Or build directly from Xcode:
1. Select your iPhone from the device dropdown (top toolbar)
2. Click the **Play** button (▶️) or press `Cmd + R`

## Troubleshooting

### "No accounts with Apple IDs were found"
- Make sure you completed Step 2 and added your Apple ID
- Wait a few seconds for Xcode to finish loading your account

### "No team available"
- Make sure you selected your team in the Signing & Capabilities tab
- Try clicking the Team dropdown and selecting your Apple ID again

### "Bundle identifier is already in use"
- Change the bundle identifier in `app.json`:
  ```json
  "ios": {
    "bundleIdentifier": "com.yourname.driverapp"
  }
  ```
- Then run: `npx expo prebuild --platform ios --clean`

### Still not working?
- Make sure you're using a free Apple Developer account (no paid membership needed)
- Try cleaning: In Xcode, **Product → Clean Build Folder** (Shift + Cmd + K)
- Restart Xcode after adding your Apple ID

