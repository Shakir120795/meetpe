# NOW - Mobile App (Capacitor)

Fresh Meat Delivery App — Android & iOS builds using Capacitor.

## How It Works
- App loads your live server URL (http://34.100.249.86)
- Any changes on server = instant in app (no app update needed)
- Native shell provides: splash screen, push notifications, status bar control

---

## Prerequisites

1. **Node.js** (already installed)
2. **Android Studio** — Download from https://developer.android.com/studio
   - Install Android SDK (API 33+)
   - Set `ANDROID_HOME` environment variable
3. **Java JDK 17** — Android Studio installs it

---

## Setup (One-time)

```bash
cd mobile-app
npm install
npx cap add android
npx cap sync
```

---

## Build APK (Android)

### Debug APK (for testing):
```bash
npx cap sync android
npx cap open android
```
Then in Android Studio: **Build → Build Bundle/APK → Build APK**

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK (for Play Store):
1. Generate signing key:
```bash
keytool -genkey -v -keystore now-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias now
```

2. In Android Studio:
   - Build → Generate Signed Bundle/APK
   - Select "Android App Bundle" for Play Store
   - Upload to Google Play Console

---

## Build iOS (requires Mac)

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```
Then open in Xcode, set signing team, and archive for App Store.

---

## App Configuration

Edit `capacitor.config.ts`:
- `appId`: Your unique app ID (com.now.meatdelivery)
- `appName`: Display name (NOW)
- `server.url`: Your live server URL

---

## Customize App Icon & Splash Screen

### App Icon:
Place your icon (1024x1024 PNG) at:
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
- Or use: https://icon.kitchen (generates all sizes)

### Splash Screen:
- `android/app/src/main/res/drawable/splash.png`
- Background color set in capacitor.config.ts

---

## Push Notifications (Firebase)

1. Create Firebase project: https://console.firebase.google.com
2. Add Android app with package name: `com.now.meatdelivery`
3. Download `google-services.json` → place in `android/app/`
4. Capacitor Push plugin handles the rest

---

## Important Notes

- Keep `now-release-key.jks` SAFE — you need it for ALL future Play Store updates
- Server URL in config should be HTTPS for production
- Test APK on real device before Play Store upload
- Play Store review takes 3-7 days first time

---

## Folder Structure
```
mobile-app/
├── package.json          # Dependencies
├── capacitor.config.ts   # App config
├── www/                  # Fallback page (shows while loading)
│   └── index.html
├── android/              # (generated) Android project
└── ios/                  # (generated) iOS project
```
