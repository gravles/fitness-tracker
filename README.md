# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android/WearOS apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar, merge-safe across devices (phone + watch never clobber each other)

**Readiness Score**
- Transparent 0–100 score from sleep quality, energy, alcohol, and training load — no wearable required
- `primed` / `ready` / `steady` / `recovery` label with a training recommendation and a "why?" breakdown
- Morning check-in modal feeds it each day; shown on the dashboard and the WearOS watch face

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- MCP server so an external AI coach can push training plans, meal plans, and supplement schedules directly (see `docs/mcp-tools.md`)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics
- Progressive-overload suggestions: server-computed weight recommendations pre-fill the next session

**Supplement & Medication Tracking**
- Catalogue of supplements/medications with scheduled dosing, recurrence, and push reminders
- Ad-hoc/PRN logging and adherence tracking on `/supplements` (Today / My Stack / History)
- Tracking-only — not medical advice

**Workout Partners & Challenges**
- Mutual partner linking with shared stats, streaks, and one-tap encouragement pushes
- Send workout templates and saved meals to a partner
- Group challenges (2–8 members) with an anonymous-by-default leaderboard
- Plus lightweight email-only accountability partners with weekly summaries

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): steps, resting heart rate, and sleep sync

**WearOS Companion App**
- Native Kotlin/Compose app for Galaxy Watch Ultra and other Wear OS devices
- Live workout sessions with rep/weight logging, rest timer, and heart-rate capture
- Voice food and set logging, morning check-in, crash-proof session drafts
- Tiles and watch-face complications for calories, macros, and quick-log shortcuts
- Secure short-code pairing (`android/wear/README.md`)

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison (camera or gallery, with automatic compression)
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store), Android (Play Store), and WearOS via Capacitor / native Kotlin
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
