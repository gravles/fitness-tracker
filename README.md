# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition
- Menu scanner accepts a photo or a PDF menu and recommends what to order
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- Coach-driven scheduling and meal planning via MCP tools: an AI coach can schedule workouts and plan meals directly, which then appear on the Schedule page and in the Meal Planner (see [docs/mcp-tools.md](./docs/mcp-tools.md))
- Personal Claude MCP Connector: generate a per-account API key in Settings → Claude AI Connector to link your own Claude.ai account to your logs, workouts, and body metrics

**Workout Tracking**
- Active workout logger with real-time set / rep tracking, per-set autosave, and rest timer
- Edit completed workouts after the fact
- AI Coach builds and saves workouts from natural language, with progressive-overload weight suggestions
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics

**Readiness & Recovery**
- Daily 0–100 readiness score (primed / ready / steady / recovery) from sleep, energy, alcohol, and training load — no wearable required
- Morning check-in (sleep / energy / drinks) on phone and watch feeds the score

**Watch Companion App (WearOS)**
- Native companion app for WearOS, paired from Settings → Pair a Device
- Live workout sessions with per-set logging, heart-rate capture, and a haptic rest timer
- Voice food logging, a Today tile with calorie/protein rings, and watch-face complications
- Crash-proof sessions that resume automatically if the app is killed mid-workout

**Supplements & Medications**
- Schedule supplements and medications with times of day, weekday recurrence, and reminders
- Today / My Stack / History views with adherence tracking; an AI coach can log doses on request but never alters your schedule

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): steps, resting heart rate, and sleep sync from a Galaxy Watch

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison, picked from the camera or the phone gallery
- Withings body-composition overlaid on trends

**Workout Partners**
- Invite a friend as a mutual workout partner; see each other's weekly stats and streaks with per-partnership privacy (summary vs. full activity)
- One-tap encouragement pushes and automatic streak-at-risk partner alerts
- Share workout templates and saved meals; recipients save them to their library with one tap
- Group challenges (2–8 people) with anonymous-by-default leaderboards

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
- English / French language toggle, including AI coach responses
- Custom nutrition targets, habits list, available equipment
- Accountability partners with weekly email summaries

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation
- **Native**: Capacitor (iOS + Android), Firebase Cloud Messaging
- **Watch**: native WearOS companion app (Kotlin/Compose), Android Health Connect
- **Styling**: Tailwind CSS with CSS custom properties
- **i18n**: custom React context (`LanguageProvider`), `localStorage`-persisted, English/French
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
