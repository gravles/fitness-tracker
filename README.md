# Kinetic (formerly Life Logger)

A personal fitness and nutrition tracker with AI coaching, native iOS/Android/WearOS apps, and deep health integrations.

## Features

**Daily Logging**
- Eat tab: inline voice / photo / barcode / text / menu (incl. PDF) capture, timeline with skippable planned meals, day-details card with proportional macro preview
- Movement, sleep, and custom habit tracking
- Autosave with live macro status bar; portion-quantity aware totals

**AI Coaching**
- Smart Coach: context-aware daily tips based on recent logs
- AI Weekly Analysis: narrative breakdown of nutrition, movement, and trends
- AI-generated and editable 12-week training programs
- AI Nutrition Planner: generates meal plans from your pantry
- Coach-driven scheduling via MCP: the coach can push training plans, meal plans, and supplement schedules that appear directly in the app (see `docs/mcp-tools.md`)

**Readiness**
- Transparent 0–100 readiness score from sleep, energy, alcohol, training load, and (Android) resting heart rate
- Dashboard readiness card and morning check-in modal; mirrored on the WearOS app

**Workout Tracking**
- Active workout logger with real-time set / rep tracking and rest timer
- AI Coach builds and saves workouts from natural language
- Schedule workouts on a calendar with per-session reminders
- 1RM estimation (Epley), progressive-overload weight suggestions, PR notifications, and progress analytics

**Supplement & Medication Tracking**
- Schedule recurring or as-needed doses with push reminders
- Today / My Stack / History views with adherence tracking

**WearOS Companion App**
- Live workout logging, voice food/set logging, readiness, and morning check-in on a Galaxy Watch Ultra
- Home-screen tile and watch-face complications for calories remaining
- Short-code pairing from Settings → Pair a Device (see `android/wear/README.md`)

**Health Integrations**
- Strava: automatic activity sync
- Withings: body-composition sync (weight, fat %, muscle, bone)
- Oura: readiness and activity sync
- Health Connect (Android): steps, resting heart rate, and sleep sync

**Social**
- Mutual workout partners: linking, shared progress dashboards, nudges, and group challenges
- Accountability partners with weekly email summaries

**Calendar Feed**
- Subscribe to a personal `webcal://` URL in Apple Calendar, Google Calendar, or any iCal app
- All scheduled workouts and program sessions shown with duration

**Body Metrics & Progress**
- Weight history chart (lbs or kg)
- Progress photos with before/after comparison and gallery import
- Withings body-composition overlaid on trends

**Gamification**
- XP system, levels, badges, and a Trophy Case
- Shareable level-achievement cards
- Streak tracking

**Native Apps**
- iOS (App Store), Android (Play Store), and WearOS via Capacitor + a native Kotlin/Compose watch app
- FCM push notifications for reminders
- Native haptics, swipe-back navigation on iOS

**Customisation**
- Light / System / Dark theme
- Custom nutrition targets, habits list, available equipment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **AI**: Claude (Anthropic) — coaching, meal recognition, program generation
- **Native**: Capacitor (iOS + Android), Firebase Cloud Messaging, Health Connect
- **WearOS**: standalone Kotlin / Compose for Wear OS app (`android/wear/`), authenticated directly against `/api/mcp`
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

See [`android/wear/README.md`](./android/wear/README.md) for building and sideloading the WearOS companion app.

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
