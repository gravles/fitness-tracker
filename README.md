# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition
- Menu Scanner: scan a restaurant menu (photo or PDF) for nutrition estimates
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): automatic steps, resting heart rate, and sleep sync

**Readiness & Wellness**
- Daily readiness score (0–100) with a plain-language band and training recommendation
- Morning check-in for sleep, energy, and drinks — on web and on the watch
- Supplement & medication tracking with recurring or as-needed dosing and push reminders

**Watch Companion (WearOS)**
- Standalone watch app that talks to the server directly — no phone required nearby
- Live workout sessions with heart-rate capture, voice food/set logging, and progressive-overload weight suggestions
- Today tile, watch-face complications, and one-time phone/web pairing

**Workout Partners**
- Mutual partner linking with shared progress, nudges, and sharing of workouts/meals/foods
- Group challenges (streak, protein-days, workout-count) with anonymous-by-default membership

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison (camera or gallery)
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store) and Android (Play Store) via Capacitor
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS

**Customisation**
- Light / System / Dark theme
- Custom nutrition targets, habits list, available equipment
- Accountability partners with weekly email summaries

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation
- **Native**: Capacitor (iOS + Android), Firebase Cloud Messaging
- **Wearable**: WearOS companion app (Kotlin / Jetpack Compose for Wear OS) — see [`wear/`](./wear)
- **Styling**: Tailwind CSS with CSS custom properties
- **Email**: Resend

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Native builds

```bash
npm run cap:sync       # sync web assets to iOS/Android
npm run cap:ios        # open Xcode
npm run cap:android    # open Android Studio
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.
