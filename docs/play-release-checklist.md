# Play Store Release Checklist — Health Connect Update

The next Play release adds Health Connect permissions (sleep, steps, resting
heart rate), which triggers Google's health-apps requirements. Everything below
is staged; the only missing piece is the upload keystore.

## 1. Signing (blocked on finding the keystore)

`android/app/build.gradle` expects `android/keystore.properties`:

```
storeFile=/absolute/path/to/upload-keystore.jks
storePassword=…
keyAlias=…
keyPassword=…
```

Drop the `.jks` + properties file in place (both gitignored), then build:

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew :app:bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

If the keystore is lost: Play Console → Setup → App signing → "Request upload
key reset" (the app uses Play App Signing, so only the upload key needs
replacing; Google processes the reset in ~2 days), then generate a new one:

```sh
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

versionCode is already bumped to 2 (versionName 2.3). If Play reports the code
is already used, bump higher.

## 2. Store listing

- **Privacy policy URL**: `https://fit.nathandavie.com/privacy` (live, public,
  no login required). Set under Play Console → Store presence → Store listing
  (or App content → Privacy policy).

## 3. App content → Health apps declaration

Declare that the app integrates with **Health Connect** and complies with the
permissions policy. Suggested answers:

- Health Connect data types read: **Sleep**, **Steps**, **Resting heart rate**
- Purpose: displayed to the user as part of the app's core fitness features —
  daily readiness score, sleep history, and activity trends.
- Limited Use compliance: **Yes** — data is used only for user-facing features,
  never for advertising, never sold or transferred for third-party purposes
  (this matches the privacy policy's Health Connect section verbatim).

## 4. App content → Data safety

Update the form to reflect current collection. Suggested answers:

- **Does your app collect or share user data?** Collects: yes. Shares: no.
- Data types collected:
  - Personal info → Email address (account management)
  - Health and fitness → Health info (sleep, heart rate, steps, wellness
    ratings) and Fitness info (workouts, nutrition, body measurements)
  - Photos → user-uploaded progress photos
  - Audio → voice recordings processed transiently for voice logging (mark as
    "processed ephemerally" — transcripts are used to create the log entry)
- For each: collected — yes; shared — no; processed for app functionality;
  encrypted in transit — yes; deletion requestable — yes (in-app deletion +
  account deletion via email, per the privacy policy).

## 5. Upload

Play Console → Testing → Closed testing → the existing track → Create new
release → upload `app-release.aab` → release notes (readiness score, Health
Connect sleep/steps/heart-rate sync, watch companion improvements) → review →
roll out. The 4 existing testers get the update automatically.

## 6. Wear app (optional, later)

The watch APK can join the same listing via a Wear OS release track (needs a
Wear screenshot set and the same versionCode discipline). Not required for the
phone update; revisit if sideloading the watch becomes annoying.
