# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, a Wear OS companion, and deep health integrations.

## Features

**Daily Logging** (Home / Eat / Workout tabs)
- Food diary with calories, macros (protein / carbs / fat), and alcohol; portion-quantity aware
- Voice logging (native speech recognition on-device), AI camera meal recognition, barcode scanning, and menu scanning from a photo or uploaded PDF
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar and a daily wellness check-in (sleep / energy / drinks)

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Coach Autopilot: the coach can build and schedule full training plans and meal plans (single day or recurring), not just log activity — they appear on your Schedule and Meal Planner automatically
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- Your Own AI Connector: generate a personal API key and connect your own Claude (claude.ai / Claude Desktop) directly to your fitness data — see [`docs/mcp-tools.md`](./docs/mcp-tools.md)
- Responses available in English or French (Settings → Customisation)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking, per-set autosave, and a rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), progressive-overload weight suggestions, PR notifications, and progress analytics

**Readiness & Health Integrations**
- Daily Readiness Score (0–100) from sleep, energy, alcohol, training load, and resting heart rate, with a plain-language breakdown
- Health Connect (Android): automatic sleep, step count, and resting heart rate sync
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync

**Wear OS Companion App**
- Standalone watch app (Kotlin/Compose) — pair it from Settings → Pair a Device
- Calorie/protein rings, next scheduled workout, and readiness on the watch face and a home-screen tile
- Voice food logging and live guided workout sessions on the watch, with crash-proof session recovery
- Watch-face complications for calories remaining and one-tap logging shortcuts

**Supplement & Medication Tracking**
- Schedule doses (specific times, days of week, or as-needed), see today's doses on the dashboard, and track adherence history
- Push reminders at each scheduled dose time; tracking only, never medical advice

**Workout Partners & Accountability**
- Link with a partner, share as much or as little detail as you like, and see their weekly stats and streaks
- One-tap nudges, shared workout templates and meals, and group challenges (2–8 people) with a leaderboard
- Accountability partners with weekly email summaries

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison (camera or gallery picker)
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking (configurable: any activity, workouts only, or nutrition only)

**Native Apps**
- iOS (App Store), Android (Play Store), and Wear OS via Capacitor + native modules
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS

**Customisation**
- Light / System / Dark theme
- English / French language toggle
- Custom nutrition targets, habits list, available equipment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation, MCP tool server
- **Native**: Capacitor (iOS + Android), native Wear OS module (Kotlin/Compose), Firebase Cloud Messaging, native speech recognition, Health Connect
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
