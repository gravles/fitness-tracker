# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- MCP server (`/api/mcp`) so an external AI coach can read your logs and push training/meal plans directly — see [`docs/mcp-tools.md`](docs/mcp-tools.md)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics
- Progressive overload suggestions on freestyle and template sets, based on your last 90 days of logged weights

**Kinetic Watch (WearOS Companion App)**
- Live workout sessions on the wrist: crown-adjustable reps/weight, haptics, rest-timer ring, crash-proof session resume
- Voice logging for food and mid-workout sets
- Today tile and watch-face complications (calories ring, quick-log shortcuts)
- Heart-rate capture during workouts; morning check-in on the watch
- See [`docs/watch-companion-design.md`](docs/watch-companion-design.md)

**Readiness & Recovery**
- Daily 0–100 readiness score from sleep, energy, alcohol, resting heart rate vs. baseline, and training load
- Morning check-in modal (dashboard and watch) with a "why?" breakdown of the score

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): automatic steps, resting heart rate, and sleep sync

**Supplement & Medication Tracking**
- Build a stack, schedule doses (including recurring multi-time-per-day schedules), and log intake
- Adherence tracking, history, and push reminders — tracking-only, not medical advice

**Workout Partners**
- Mutual partner linking with configurable share level (summary or full)
- Shared progress, encouragement nudges, sending workouts/meals, and group challenges

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison
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

## Further Documentation

- [`docs/mcp-tools.md`](docs/mcp-tools.md) — MCP server tool reference for AI coach integrations
- [`docs/watch-companion-design.md`](docs/watch-companion-design.md) — Kinetic Watch (WearOS) design background
- [`docs/push-notifications-setup.md`](docs/push-notifications-setup.md) — FCM / web-push configuration
- [`docs/optimistic-ui-guide.md`](docs/optimistic-ui-guide.md) — optimistic-update patterns used across the app
- [`docs/play-release-checklist.md`](docs/play-release-checklist.md) — Play Store release checklist
- [`ONBOARDING.md`](ONBOARDING.md) — new-contributor onboarding guide
