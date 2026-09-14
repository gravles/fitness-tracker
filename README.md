# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition
- Menu scanner: photo or PDF menu upload with AI-suggested dishes
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- Coach can push training plans and meal plans directly via MCP tools — schedule workouts and meals (one-off or recurring), which then appear on the dashboard and Schedule/Meal Planner with no extra steps
- Per-account Claude MCP connector so your data can be driven from any MCP-compatible AI client (Settings → Claude AI Connector)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking, autosave per set, and a rest timer
- Edit completed workouts and delete individual set rows
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics

**Readiness & Wellness**
- Transparent 0–100 readiness score from sleep, prior-day energy, alcohol, and training load — no wearable required
- Skippable morning check-in when sleep hasn't been logged yet for the day
- Supplement & medication tracking: schedule doses, log adherence, get reminders (`/supplements`)

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): steps, resting heart rate, and sleep sync feed the readiness score and daily logs

**WearOS Companion App**
- Standalone Wear OS app with pairing, live workout sessions (with heart-rate capture), voice food/set logging, and a Today tile with calories/macro rings and readiness
- Watch-face complications for calories remaining and one-tap food/workout shortcuts

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison, camera or gallery picker
- Withings body-composition overlaid on trends

**Social**
- Workout partners: mutual pairing, shared progress dashboards, encouragement nudges, shared templates/meals, and group challenges
- Accountability partners with weekly email summaries

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store) and Android (Play Store) via Capacitor
- WearOS companion app (Play Store)
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS, native voice logging

**Customisation**
- Light / System / Dark theme
- English / French language toggle
- Custom nutrition targets, habits list, available equipment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation
- **Native**: Capacitor (iOS + Android), Firebase Cloud Messaging, Health Connect
- **Wearable**: Standalone Kotlin/Compose Wear OS companion app
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
