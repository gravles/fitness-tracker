# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

## [3.0.0] — 2026-10-05

### Kinetic Redesign
- Life Logger is now **Kinetic**: new name, K logomark, manifest and metadata
- Floating glass pill navigation with a context-aware gold FAB and capture sheet
- Bento-style Home: nutrition rings, weight / movement sparklines, habit strip, coach banner, wellness check-in (XP now lives behind a toggle in More)
- **Eat** (`/nutrition`) is now the food logger: inline voice / snap / barcode / type / menu / favorites capture, a day timeline with skippable planned meals, date/time editing with proportional macro preview, and a day-details card
- Meal Planner moved to `/nutrition/planner` ("Plan" pill in the Eat header)
- Restyled Workout hub and active session (set pills, ghost values, rest bar, log-set CTA); today's activity shown at the top
- `/log` folded into the tabs; old deep links redirect
- Withings sync button added to the Trends header
- Native voice logging on Android/iOS via the speech-recognition plugin (requires app rebuild)
- Android release 2.4 (versionCode 3)

### Supplement & Medication Tracking
- New `/supplements` page: Today / My Stack / History tabs with adherence %
- Schedule builder with recurrence and multiple times per day; log by dose or ad-hoc / as-needed
- Per-dose push reminders; "Today's doses" card on the dashboard; entry in the More hub
- Six new MCP coach tools (save/get supplements, schedule, log, schedule + adherence query, skip/stop)
- Tracking only — not medical advice
- Migration: `supplement_tracking_migration.sql`

### Readiness Score & Morning Check-in
- Transparent 0–100 readiness score (primed / ready / steady / recovery) from sleep, energy, alcohol, and training load, with a "why?" breakdown and training recommendation
- Morning check-in modal on the first dashboard visit of the day (sleep, energy, drinks last night); skippable once per day
- Readiness card on the dashboard

### Health Connect (Android)
- Sleep sync from Health Connect into new `sleep_records` table; tracked sleep overrides the manual rating in readiness
- Steps and resting heart rate sync
- Connect / Sync-now card in Settings (Android app only)
- Play release prep: public privacy policy and health-declaration checklist (`docs/play-release-checklist.md`)

### Wear OS Companion
- Tile with dual progress rings and one-tap log actions; watch-face shortcut complications
- Voice food logging and morning check-in on the watch
- Voice set logging; half-pound (2.5 lb) weight steps
- Crash-proof workout sessions (draft persistence + resume)
- Readiness shown on the Today screen
- Design notes: `docs/watch-companion-design.md`

### Progressive Overload
- Workout templates and schedules now include last weight/reps and a suggested next weight (double progression: all sets at top of rep range → +5 lb)
- Watch pre-fills the suggested weight with a hint line

### Menu Scanner
- Upload a PDF menu (up to 3 MB) in addition to photos

### Fixes & Security
- AI API routes now require authentication
- Multi-device food-log clobbering fixed with merge-safe writes
- Food portion quantities respected in all daily-total computations
- Fixed stale drink count on the Eat day-details card
- Android release builds now fail if `google-services.json` is missing; Wear R8 build fix

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
