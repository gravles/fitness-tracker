# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging (native on-device speech recognition) and AI-powered camera/menu-photo/PDF meal recognition
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- AI coach MCP tools: an AI coach can push training plans, schedule meals, and manage supplement/medication doses directly (see `docs/mcp-tools.md`)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics
- Progressive overload suggestions (server-computed target weights from your last 90 days of sets)

**Readiness & Recovery**
- Daily Readiness Score (0–100): primed / ready / steady / recovery, from sleep, energy, alcohol, and training load — no wearable required
- Morning check-in (sleep, energy, drinks) on first dashboard visit of the day
- Android Health Connect sync: steps, resting heart rate, and per-stage sleep sessions

**Supplement & Medication Tracking**
- Log supplements and medications with a schedule (recurring or one-off, multiple doses/day) or ad-hoc/PRN
- Adherence tracking and push reminders at each dose time
- AI coach can record doses via MCP tools, but never suggests or alters a schedule

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Android Health Connect: steps, resting heart rate, sleep

**Wear OS Companion App**
- Standalone Wear OS app for Galaxy Watch and other Wear OS devices, paired via a secure short code
- Live workout sessions with set-by-set logging, rest-timer ring, and heart-rate capture
- Voice food logging and "say set" voice logging during a session
- Crash-proof sessions that resume automatically after the watch app restarts
- Today tile and watch-face complications for calories, protein, and next workout

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison (camera or gallery)
- Withings body-composition overlaid on trends

**Workout Partners & Challenges**
- Mutual workout-partner linking with weekly stats, streaks, and encouragement nudges
- Configurable share level (summary vs. full) per partner
- Send workout templates and saved meals to a partner
- Group challenges (2–8 members) with an anonymous-by-default leaderboard

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
- **Wear OS**: Kotlin/Compose companion app (`wear/` module), paired over the MCP API
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
