# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android/WearOS apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging and AI-powered camera meal recognition; menu scanner accepts a photo or a PDF upload
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar; unified "Eat" timeline with inline voice/photo/barcode/typed capture

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- Coach can push training plans, meal plans, and supplement schedules directly onto your dashboard via MCP tools (see [`docs/mcp-tools.md`](./docs/mcp-tools.md))

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics
- Progressive-overload suggestions: next suggested weight per exercise, derived from your last 90 days of logs

**Readiness & Health Integrations**
- Readiness Score: a transparent 0–100 daily score from sleep, prior-day energy, alcohol, and training load — no wearable required
- Morning check-in: quick sleep / energy / drinks prompt that feeds the score
- Health Connect (Android): syncs sleep sessions, steps, and resting heart rate automatically
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync

**Supplement & Medication Tracking**
- Track supplements and medications with recurring dose schedules or ad-hoc/PRN logging
- Adherence tracking (taken vs. missed vs. skipped) and push reminders per dose
- AI Coach can manage your stack and schedule on request (tracking only — never medical advice)

**Workout Partners & Group Challenges**
- Link with a partner for shared progress, streaks, and one-tap encouragement nudges
- Share workout templates and saved meals directly with a partner
- Create or join 2–8 person group challenges with an anonymous-by-default leaderboard
- Accountability partners with weekly email summaries (separate, one-way digest feature)

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison; upload from the camera or your photo gallery
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store) and Android (Play Store) via Capacitor
- WearOS companion app: live workout logging with rest timers and heart-rate capture, voice food/set logging, readiness and next-workout tile, watch-face complications — see [`docs/watch-companion-design.md`](./docs/watch-companion-design.md)
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS

**Customisation**
- Light / System / Dark theme
- Custom nutrition targets, habits list, available equipment

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
