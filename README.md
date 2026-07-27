# Kinetic

A personal fitness and nutrition tracker with AI coaching, native iOS/Android/WearOS apps, and deep health integrations.

## Features

**Daily Logging**
- Food diary with calories, macros (protein / carbs / fat), and alcohol
- Voice logging (native speech recognition) and AI-powered camera meal recognition
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- MCP tools so an AI coach (e.g. Claude with the Kinetic connector) can push scheduled workouts and meal plans directly — see [`docs/mcp-tools.md`](./docs/mcp-tools.md)

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), PR notifications, and progress analytics
- Progressive-overload weight suggestions carried through to the watch app

**WearOS Companion App**
- Standalone Wear OS app — pairs directly to your account, no phone nearby required
- Today tile with calorie/protein rings, readiness score, and one-tap voice logging
- Live workout sessions with rotary set logging, rest timer, and continuous heart-rate capture
- Voice food and set logging; crash-proof session drafts; watch-face complications

**Health Connect & Readiness**
- Syncs sleep, steps, and resting heart rate from Health Connect (Android)
- Daily readiness score (0–100) with a plain-language recommendation and factor breakdown
- Morning check-in for sleep quality, energy, and drinks

**Workout Partners**
- Link a partner, share weekly progress, send encouragement nudges
- Share workout templates, meals, and favorite foods
- Head-to-head challenges (streak, protein-days, workout count)

**Supplement & Medication Tracking**
- Daily stack with dose scheduling, Take/Skip/Undo, and 30-day adherence history
- Optional reminder notifications before a scheduled dose

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison (camera or gallery, auto-compressed)
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store), Android (Play Store), and WearOS via Capacitor + native Wear module
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS

**Customisation**
- Light / System / Dark theme
- English / French language toggle (also applied to AI Coach responses)
- Custom nutrition targets, habits list, available equipment
- Accountability partners with weekly email summaries

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation, MCP tool server
- **Native**: Capacitor (iOS + Android), native WearOS module, Health Connect, Firebase Cloud Messaging
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
