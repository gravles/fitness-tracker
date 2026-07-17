# Fitness Tracker — WearOS Companion

Standalone Wear OS app (Kotlin, Compose for Wear OS) that talks directly to the
production API over HTTPS — no phone relay. Design doc:
[docs/watch-companion-design.md](../../docs/watch-companion-design.md).

## What's implemented (v0.1 scaffold)

- **Pairing** (`ui/PairingScreen.kt`): generates an `ftk_` key on-device, sends only its
  SHA-256 hash to `/api/pair/start`, shows a 6-char code, polls `/api/pair/poll` until
  the code is claimed in Settings → Pair a Device. The key is stored in
  `EncryptedSharedPreferences` (`data/DeviceKeyStore.kt`).
- **Today screen** (`ui/TodayScreen.kt`): calories/protein remaining and the next planned
  workout, via MCP tools `get_user_profile`, `get_daily_logs`, `get_schedule`.
  A 401 (revoked key) clears the key and returns to pairing.
- **MCP client** (`api/McpClient.kt`): minimal JSON-RPC `tools/call` wrapper over OkHttp.

Not yet built (see design doc tiers): live workout session + rest timer, voice food
logging, tiles/complications, offline queue.

## Build

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew :wear:assembleDebug
```

APK lands at `wear/build/outputs/apk/debug/wear-debug.apk`.

## Install on the Galaxy Watch Ultra

1. On the watch: Settings → About watch → Software info → tap **Software version** 5×
   to enable developer options, then enable **ADB debugging** and **Wireless debugging**.
2. Pair from this machine: `adb pair <watch-ip>:<pair-port>` (code shown on watch),
   then `adb connect <watch-ip>:<port>`.
3. `adb install wear/build/outputs/apk/debug/wear-debug.apk`
4. Open the app, and enter the code it shows at fit.nathandavie.com → Settings → Pair a Device.

The backend base URL is a `BuildConfig` field (`BASE_URL` in `wear/build.gradle`).
