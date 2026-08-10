# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [Unreleased]

_Nothing yet._

## [3.0.0] — 2026-07-28

### Kinetic Rebrand & Redesign
- Renamed from "Life Logger" to **Kinetic**: new app name, icon/logomark, and identity across web, iOS, and Android
- New information architecture: floating glass bottom nav (Home · Workout · gold FAB · Eat · Trends) replaces the old nav; the standalone `/log` route is dissolved into inline capture on each tab (old deep links redirect); Meal Planner moves to `/nutrition/planner`
- New "Bento" home dashboard: nutrition rings, weight/movement sparklines, habit strip, coach banner, wellness check-in card; XP/leveling moved behind a `/more` toggle
- Eat (`/nutrition`) is now a unified food logger: inline voice / photo / barcode / typed / menu-scan / favorites capture, a scrollable timeline with skippable planned meals, and a day-details card
- Native voice logging switched to `@capacitor-community/speech-recognition` (fixes voice logging never having worked in the Android WebView)
- New component tree under `src/components/kinetic/`; new color/motion system (gold-gradient FAB, glass-blur nav, bento tile gradients)

### WearOS Companion App
- Full standalone Kotlin/Compose Wear OS app (module `android/wear`, sideload instructions in `android/wear/README.md`) — not a phone mirror, a real second client
- Short-code device pairing; only a hash of the on-watch device key ever leaves the watch (`pairing_migration.sql`)
- Today screen: concentric calorie/protein rings, readiness score, next scheduled workout
- Live workout sessions: crown/bezel set logging, haptic rest timer, heart-rate capture, crash-proof session drafts that survive a force-stop, progressive-overload weight prefill
- Voice food logging and voice set logging ("185 for 8") via on-device speech recognition
- Wear Tile (dual rings, quick-log actions, instant refresh) and watch-face complications (calories remaining, food/lift shortcuts)
- Morning check-in on the watch, same readiness inputs as the phone
- Design doc: [`docs/watch-companion-design.md`](./docs/watch-companion-design.md)

### Readiness Score & Health Connect
- New Readiness Score (0–100): computed from sleep quality, prior-day energy, alcohol, and acute:chronic training load — works from logged data alone, no wearable required
- Morning check-in modal: auto-opens once/day on the dashboard if sleep isn't logged yet (sleep / energy / drinks)
- Dashboard Readiness card with score ring, band label, recommendation, and a "why?" breakdown
- Health Connect (Android): syncs sleep sessions, daily steps, and resting heart rate; tracked sleep overrides the manual rating in the readiness calc when available; resting HR compared against a personal 28-day baseline
- New MCP tool `get_readiness`
- Migrations: `sleep_records_migration.sql`, `daily_metrics_migration.sql`

### Supplement & Medication Tracking
- Track supplements and medications with recurring dose schedules (multiple times/day) or ad-hoc/PRN logging
- New `/supplements` page: Today / My Stack / History tabs with adherence percentage; dashboard "Today's doses" card
- Push reminders per scheduled dose
- Six new MCP tools (`save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement`) so the AI coach can manage the stack on request — tracking only, never medical advice
- Migration: `supplement_tracking_migration.sql`
- Tool reference: [`docs/mcp-tools.md`](./docs/mcp-tools.md)

### Workout Partners & Group Challenges
- Mutual partner linking by email (distinct from the existing one-way accountability-partner email digest, which is unchanged): invite, accept, pause/end, per-user privacy control (summary-only vs. full detail)
- New Partner hub (`/partner`) with weekly stats, streaks, and one-tap encouragement nudges
- Share workout templates and saved meals directly with a partner
- Group challenges (2–8 people): create/join/decline/leave, anonymous-by-default leaderboard, automatic progress tracking, daily milestone/status updates via cron
- Migration: `partner_migration.sql`

### AI Coach MCP Tools
- New MCP tools so an AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry
- Coach-scheduled workouts use the existing `scheduled_workouts` / `workout_templates` tables, so they appear on the dashboard and Schedule page with no UI changes
- Migration: `coach_scheduling_migration.sql` (template fallbacks, skip reasons, fallback flag on scheduled entries)
- Meal-planning counterpart: `save_meal` (upsert by name), `get_meals`, `plan_meal` (saved meal or ad-hoc, single date or recurring, capped at 90 days, configurable meal slots), `get_meal_plan` (per-day entries plus planned-vs-logged macro totals), `update_planned_meal` (move, swap meal, skip with reason)
- `log_food` extended with `planned_meal_id` (copies plan macros as defaults, any field can be overridden with what was actually eaten, marks the entry logged) and a new `log_planned_meal` convenience tool for one-call "ate what I planned"
- Planned meals never count toward `get_daily_logs` totals until logged — no double counting
- New dedicated tables `mcp_meals` / `planned_meals` (kept separate from the existing pantry/AI-meal-generator tables, which model an unrelated feature)
- Dashboard: new "Today's meal plan" card showing today's planned meals with slot/time and a one-tap "Log as planned" action (hidden entirely on days with no coach plan)
- Migration: `coach_meal_planning_migration.sql`
- Tool reference: `docs/mcp-tools.md`

### Progressive Overload Suggestions
- `get_workout_templates` and `get_schedule` now return per-exercise `last_weight_lbs`, `last_reps`, `suggested_weight_lbs`, and `progression` (`increase`/`repeat`), computed via double progression over the last 90 days of logged sets
- Surfaced on the WearOS app as a weight prefill; available to any future web UI via the same fields
- Fixed a silent bug where `get_workouts` selected a nonexistent column and quietly returned history with no sets

### Coach-Integrated Meal Planner
- Coach-pushed meal plans now render inline in the Meal Planner: a "Coach Plan" section on Today plus per-day rows in Week view, with one-tap "log as planned"
- Fixed scheduled workouts not being marked complete when a session was started from the Schedule page; added a same-day safety-net auto-link in `get_schedule`

### Progress Photos
- Upload modal now offers "Take Photo" or "Choose from Gallery" separately, instead of forcing the camera
- Gallery photos (often multi-MB HEIC on iPhone) are downscaled/re-encoded client-side before upload (`src/lib/image-utils.ts`, also reused by food-photo capture)

### PDF Menu Upload
- The AI menu scanner now accepts a PDF upload (up to 3 MB) in addition to a photo

### UI/UX Audit
- Shared retry card wired into every page — network failures no longer render blank
- New accessible `Modal` primitive (focus trap, Escape, ARIA); 16 dialogs migrated to it
- Gym-usability pass: 44px tap targets on set-complete toggles, numeric input modes, WCAG AA contrast fixes
- Design-system enforcement: canonical `Button variant="brand"`, single danger-red token, Lucide icons throughout

### Reliability Fixes
- Fixed multi-device food-log clobbering: once the watch became a second writer, a stale phone tab could silently wipe a day's food log on autosave; replaced blind overwrite with a three-way merge (`src/lib/food-merge.ts`)
- Fixed food portion-quantity multipliers being ignored by `log_food` and the merge totaler, which could silently reset a day's macro totals to unscaled values
- MCP "today" defaults now resolve in the user's stored timezone instead of the server's UTC clock (`timezone_migration.sql`)
- Closed an authentication gap on several AI/process-intent API routes that predated a required API key or session check

### Release Readiness (Play Store)
- Public `/privacy` policy page, `docs/play-release-checklist.md`, and a Health Connect "Limited Use" disclosure ahead of Play's health-app review
- Release builds now fail fast if Firebase config (`google-services.json`) is missing, instead of shipping a build that crashes on login
- Android version bumped 2.3 → 2.4 for the new WearOS module and the Firebase-config safety fix

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
