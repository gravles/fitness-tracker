# Fitness Tracker — Capacitor Mobile App PRD & Setup Guide

## Overview

A React Native-style mobile app using **Capacitor** to wrap the existing Next.js app in a native shell. The WebView points at the live Vercel URL, so you get true SSR, no duplicated codebase, and native device APIs (push notifications, haptics, camera) layered on top.

---

## Architecture Decision

**Remote URL (Vercel) approach** — not a local bundle. The Capacitor WebView loads `https://your-app.vercel.app`. This means:
- One codebase, one deployment
- SSR and server components work as normal
- App Store updates don't require a new binary submission
- Native APIs (push, haptics) added via Capacitor plugins

---

## Platform Plan

Build **both Android and iOS**. Android is smoother for testing (sideloading, no $99 fee upfront), but many testers will be on iOS and a Mac is available for Xcode builds.

---

## Monthly Cost Analysis (50–100 Beta Users)

| Service | Plan | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Vercel | Pro | $20 | Required before sharing with external users. Hobby = non-commercial only. |
| Supabase | Pro | $25 | Upgrade before beta — Free tier pauses after 7 days inactivity. |
| Firebase | Spark (free) | $0 | Push notifications via FCM/APNs. Free tier is generous. |
| Apple Developer | — | ~$8 (billed $99/yr) | Required for TestFlight + iOS distribution. |
| Google Play | — | ~$2 (one-time $25) | Required for Android distribution. |
| **Total** | | **~$55/month** | During beta with 50–100 users. |

At commercialisation, costs scale with usage (Supabase compute, Vercel bandwidth). For 50–100 users these tiers are comfortably sufficient.

---

## Vercel Pro Timing

**Upgrade before your first beta link, not at commercialisation.** The Hobby plan ToS says "non-commercial use" — collecting feedback for a product you intend to ship is considered commercial intent by Vercel. At $20/month it's also worth it for the uptime SLA and support when real users depend on the app.

---

## Prerequisites Checklist

### Accounts to Register

| # | What | Cost | URL | Notes |
|---|------|------|-----|-------|
| 1 | **Apple Developer Program** | $99/year | developer.apple.com/enroll | Takes 1–2 business days to approve. Requires Apple ID with 2FA. **Do this first — approval is the only thing that can block your timeline.** |
| 2 | **Google Play Console** | $25 one-time | play.google.com/console | Instant approval. |
| 3 | **Firebase** (Google account) | Free | console.firebase.google.com | For push notifications. Create one project, add both iOS and Android apps to it. |
| 4 | **Vercel Pro** (upgrade existing) | $20/month | vercel.com/account/billing | Upgrade before first external beta link. |
| 5 | **Supabase Pro** (optional now) | $25/month | supabase.com/dashboard | Upgrade before beta so testers don't hit a paused DB. |

### Software to Install (Mac)

Install in this order — Xcode is 15–20 GB and takes hours:

1. **Xcode** — free, Mac App Store. Start this download immediately.
2. **Android Studio** — free, developer.android.com/studio. Includes Android emulator + SDK manager.
3. **JDK 17+** — Android Studio will prompt and manage this.

Node.js/npm already present from Next.js project.

### Configuration Tasks

**Apple Developer Portal**
- [ ] Create **App ID** — pick bundle ID now, e.g. `com.nathandavie.fitnesstracker` (cannot change later)
- [ ] Enable **Push Notifications** capability on that App ID
- [ ] Create **Development** provisioning profile
- [ ] Create **APNs Auth Key** (`.p8` file) — used by Firebase for iOS push. Download once, store safely.

**Firebase Console**
- [ ] Create project (e.g. "FitnessTracker")
- [ ] Add **iOS app** → download `GoogleService-Info.plist`
- [ ] Add **Android app** → download `google-services.json`
- [ ] Cloud Messaging → iOS App Configuration → upload APNs `.p8` key

**Google Play Console**
- [ ] Create app listing
- [ ] Set up **Internal Testing** track for your 50–100 beta testers

**Supabase Dashboard**
- [ ] Authentication → URL Configuration → add redirect URL: `com.nathandavie.fitnesstracker://login-callback`
- [ ] Add to allowed origins list

---

## Recommended Setup Timeline

```
Week 1  │ ① Submit Apple Developer enrollment (approval takes 1–2 days)
        │ ② Start Xcode download (do this immediately — it's huge)
        │ ③ Install Android Studio
        │ ④ Register Google Play Console ($25, instant)
        │ ⑤ Create Firebase project
        │
Week 2  │ ⑥ Apple Developer approval arrives
        │    → Create App ID, provisioning profiles, APNs key
        │    → Upload APNs key to Firebase
        │    → Download GoogleService-Info.plist + google-services.json
        │ ⑦ Upgrade Vercel to Pro
        │ ⑧ Upgrade Supabase to Pro
        │
Week 3+ │ Start Capacitor integration
        │    npm install @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
        │    npx cap init
        │    npx cap add ios
        │    npx cap add android
        │    Configure remote URL in capacitor.config.ts
```

---

## Capacitor Integration (High Level)

```ts
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nathandavie.fitnesstracker',
  appName: 'FitnessTracker',
  webDir: 'out',
  server: {
    url: 'https://your-app.vercel.app',  // Remote URL — loads live Vercel deployment
    cleartext: false,
  },
};

export default config;
```

Native plugins to add:
- `@capacitor/push-notifications` — FCM (Android) + APNs (iOS)
- `@capacitor/haptics` — already used in the web app via the haptics abstraction layer
- `@capacitor/status-bar` — hide/style native status bar
- `@capacitor/splash-screen` — branded splash screen

---

## Future Backlog (noted during development)

- **Surgical program editing** — send only affected weeks to AI, merge back server-side (avoids ~$0.13/call + 90s wait for full 12-week JSON)
- `modified` session status when exercises changed mid-workout
- Empty 1RM first-session prompt
- 1RM trend charts (using `exercise_records` table)
- Program auto-completion detection (`status → 'completed'`)
- Push notification workout reminders (requires Capacitor native setup above)

---

## Project Context

- **Stack**: Next.js 16 App Router, TypeScript, Tailwind v4, Supabase PostgreSQL
- **Supabase project ID**: mwzihjdmbrcdhiyvdzyb
- **Deployment**: Vercel
- **Key files**:
  - `src/lib/program-api.ts` — all program session logic, 1RM tracking, scheduling
  - `src/app/programs/page.tsx` — program hub, adherence grid, pause/resume
  - `src/app/schedule/page.tsx` — calendar week view, skip/reschedule UI
  - `src/app/workout/active/[id]/page.tsx` — workout logger, 1RM PR detection
  - `src/app/api/ai/edit-program/route.ts` — AI program editing (streaming, 32k tokens)
