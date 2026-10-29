# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

## [3.0.0] — 2026-07-28 — "Kinetic"

### Rebrand & Redesign
- Renamed Life Logger → **Kinetic** app-wide (metadata, manifest, app icon, "K" logomark)
- Floating glass pill navigation with a context-aware gold FAB and capture sheet
- Bento-style Home: nutrition rings, weight/movement sparklines, habit strip, coach banner, wellness check-in; gamification (XP/levels) moved behind a "More" toggle
- **Eat** (`/nutrition`) is now the primary food logger: inline voice / photo / barcode / text / menu capture, a timeline with skippable planned meals, and a day-details card with proportional macro preview
- Meal Planner moved to `/nutrition/planner` (reached via the "Plan" pill in Eat)
- Workout hub restyled, today's activity surfaced at the top; redesigned active session screen (set pills, ghost values, rest bar, log-set FAB)
- `/log` retired — old deep links redirect to the new tabs

### AI Coach: Scheduling & Meal Planning (MCP)
- New tools so the AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry
- Meal-planning counterpart: `save_meal`, `get_meals`, `plan_meal` (saved or ad-hoc, single/recurring, configurable slots), `get_meal_plan` (plan-vs-actual totals), `update_planned_meal`; `log_food` gained `planned_meal_id` plus a `log_planned_meal` convenience tool for "ate what I planned"
- Coach-scheduled meals now also render directly on the redesigned Meal Planner page (Today "Coach Plan" section + per-day rows in Week view), not just the dashboard card
- Tool reference: `docs/mcp-tools.md`

### WearOS Companion App
- New Galaxy Watch Ultra (Wear OS) companion app — standalone Kotlin/Compose client talking directly to the API (`android/wear/README.md`)
- Today screen: concentric gold-calories / blue-protein rings, next scheduled workout
- Live workout sessions: one screen per set with crown/bezel input, haptic feedback, a full-screen rest-timer ring, half-pound (2.5 lb) weight increments, and crash-proof draft persistence that resumes an in-progress session after a force-stop
- Voice food logging and voice set logging, using in-app speech capture
- Morning check-in and readiness score, mirrored from the phone
- Home-screen tile (dual rings + one-tap food/lift actions) that refreshes instantly after a log, plus a calories-remaining watch-face complication and food/lift shortcut complications
- Progressive-overload weight prefill with a suggested-weight hint ("185 → 190 lbs, you earned it")
- Short-code device pairing from Settings → Pair a Device; the device key never leaves the watch (only its hash is sent)

### Readiness Score
- Transparent 0–100 readiness score from sleep quality, yesterday's energy, alcohol, and training load — plus a resting-heart-rate component on Android via Health Connect
- Dashboard readiness card with score ring, band label (primed/ready/steady/recovery), recommendation, and a "why?" component breakdown; the watch shows the same score
- Morning check-in modal (dashboard + watch), auto-prompted once per day when sleep hasn't been logged yet
- New `get_readiness` MCP tool

### Health Connect Integration (Android)
- Sync steps, resting heart rate, and sleep (with per-sleep-stage minutes) from Health Connect
- Settings card to connect and sync on demand; also syncs automatically whenever the native app is opened

### Supplement & Medication Tracking
- New `/supplements` page: Today / My Stack / History tabs with an adherence percentage
- Schedule recurring or as-needed doses, log intake, and get push reminders at each dose time
- Dashboard "Today's doses" card
- Six new MCP coach tools: `save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement` — the coach only records what the user tells it and never suggests or alters doses

### Workout Partners
- Mutual partner linking (invite by email, accept to connect) alongside the existing email-only accountability partners
- Partner hub and per-partner dashboard with weekly stats, streaks, and one-tap encouragement nudges
- Per-partner sharing level (summary vs. full) and group challenges

### Also
- Progressive overload: workout templates and schedule entries now carry a suggested next weight, computed server-side from the last 90 days of logged sets (double progression)
- Progress photos: gallery picker with client-side image compression
- Menu scanner accepts PDF menu uploads, not just photos
- Accessibility & UI pass: focus-trapped/ARIA modals, consistent loading-error/retry states, WCAG AA contrast in both themes, larger touch targets for gym use

### Fixes & Reliability
- Fixed a food-log data-loss bug where a stale phone session could overwrite items logged elsewhere (watch, another device) — logs now merge instead of blindly overwriting
- Food totals (MCP and web) now respect the portion-quantity multiplier instead of always using full-package macros
- "Today" now resolves in the user's own timezone everywhere (web and MCP) instead of the server's UTC clock, fixing evening logs landing on the wrong date
- Fixed the Eat day-details card showing a stale drink count until a full page reload
- All AI API routes now require authentication
- Android release builds fail fast if the Firebase config is missing, instead of shipping a build that crashes on login
- Android bumped to 2.4 (versionCode 3); fixed a Wear OS release build failure

---

## [2.0.0] — 2026-05-24

### Native iOS & Android Apps
- Published iOS app via Capacitor with App Store–ready signing and splash screen
- Published Android app to the Play Store with FCM push notifications
- Native haptic feedback throughout the app
- Swipe-back navigation on iOS
- App icon: gold heart on navy background

### Calendar Feed (iCal)
- Subscribable `webcal://` calendar feed of scheduled workouts
- Works with Apple Calendar, Google Calendar, and any iCal-compatible app
- Copy-URL button in Settings → Workout Calendar
- Per-workout duration carried into iCal events
- Program sessions included alongside ad-hoc workouts

### Workout Scheduling & Notifications
- "Remind Me" picker on the Schedule Workout modal (0 / 5 / 15 / 30 / 60 min / 1 day before)
- FCM push notifications fire at the configured lead time
- Timezone-aware: times stored in user's local timezone and converted to UTC for delivery
- Time picker on the reschedule modal; selected time shown on workout cards
- Default scheduled time is noon instead of 9 am

### Dark / Light / System Theme
- Three-way toggle (Light / System / Dark) in Settings → Customisation
- Stored in `localStorage`; applied before first paint to prevent flash
- Full dark-mode token coverage across all pages and components

### Onboarding Flow
- First-launch modal collects name, date of birth, height, weight, and fitness goal
- Data saved to `user_settings` and used to personalise AI coaching
- Home screen greeting pulls from `display_name` (falls back to auth metadata / email prefix)

---

## [1.5.0] — 2026-05-22

### 12-Week AI Training Programs
- AI generates a periodised 12-week plan tailored to your goal, schedule, and equipment
- Phases: Accumulation → Intensification → Peaking
- Full program review before activation; AI editing via natural language
- Calendar integration: sessions shown color-coded by type (strength / cardio / mobility)
- Workout logger pre-loads exercises with 1RM-derived target weights (Epley formula)
- Session auto-completes on save; stores 1RM estimates
- PR toast notifications (>3 % gain on any lift)
- Skip session with optional cascade (shift all future sessions +1 day)
- Reschedule individual sessions with a date picker
- Progress analytics: 12-week adherence dot grid on the program card
- Pause / resume / delete programs from the Programs hub

---

## [1.4.0] — 2026-05-21

### Health Integrations
- **Strava**: OAuth connection + automatic activity sync; Sync button on Workout page
- **Withings**: OAuth + full body-composition sync (weight, fat %, muscle mass, bone mass); Sync button on Body tab; Withings data shown on Trends page
- **Oura**: OAuth + readiness / activity sync
- All integrations consolidated in Settings → Health Integrations
- lbs / kg unit toggle in Profile and on the Body Metrics page (preference persisted to Supabase)

### Accountability Partners
- Add partners by name and email in Settings → Accountability
- Send weekly summary email to any partner (via Resend)

---

## [1.3.0] — 2026-05-21

### AI Nutrition Planner
- `/nutrition` page with Today / This Week / Pantry tabs
- Pantry management: add items with category, prep time, and macros
- AI-generated meal plans using pantry contents and prep-time constraints
- Per-meal regeneration; weekly plan view with day navigation
- Log planned meals directly to the daily food diary

### Smart Pantry Population
- Scan a photo of groceries to auto-populate pantry items
- Dictate pantry additions by voice

---

## [1.2.0] — 2026-05-21

### Saved Meals
- Save any multi-food selection as a named meal in the Nutrition tab
- Re-log saved meals with one tap

### AI Coach Persistence
- Coach conversation history stored in Supabase (with `localStorage` fallback)
- History survives across devices and sessions

### Body Metrics Tab
- Replaced Stats tab in the bottom nav with a dedicated Body Metrics view
- Progress photos: upload and compare over time (Supabase Storage bucket)
- Weight history chart with metric / imperial toggle

---

## [1.1.0] — 2026-05-20

### Workout Builder
- Workout builder with active session tracker
- AI Coach can build and save workouts from natural language
- Real-time set / rep logging during a session
- Rest timer with configurable duration
- Barcode scanner for food logging

### AI Weekly Insights
- Weekly analysis with AI commentary on nutrition, movement, alcohol, and sleep trends
- Accessible from the dashboard

### Feature Tutorial
- First-run guided tour of app features; re-launchable via `?tutorial=true`

---

## [1.0.0] — 2026-05-19

### Initial Release
- Daily log: food (calories, protein, carbs, fat, alcohol), movement, sleep, habits
- Voice logging and camera-based meal recognition
- Smart Coach: contextual daily tips based on recent logs
- Streak tracking
- Gamification: XP, levels, badges, Trophy Case, shareable level cards
- Trends charts for weight, nutrition, and activity
- Settings: nutrition targets, habits, equipment, notification preferences
