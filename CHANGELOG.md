# Changelog

All notable changes to Life Logger are documented here (the app is now branded Kinetic).

## [Unreleased]

## [3.0.0] — 2026-10-12

### Kinetic Redesign
- Life Logger is now **Kinetic**: new name, K logomark, floating glass-pill navigation with a context-aware gold capture button
- Bento-style Home: nutrition rings, weight/movement sparklines, habit strip, coach banner and wellness check-in (XP hidden behind a toggle in More)
- **Eat** (`/nutrition`) is now the food logger: inline voice / snap / barcode / type / menu / favorites capture, a timeline with skippable planned meals, date/time editing and a day-details card. The Meal Planner moved to `/nutrition/planner`
- Workout hub restyled; active session gets set pills, ghost values, rest bar and a log-set button; `/log` folded into the tabs (old links redirect)
- New **More** hub (Coach, Programs, Progress, Metrics, History, Partners, Settings, Help)
- UI/UX audit: retryable error cards instead of empty states, accessible modals (focus trap, Escape), 44px set-complete toggles, WCAG AA contrast, unified design tokens
- Native voice logging via the Capacitor speech plugin (fixes voice on Android WebView — app rebuild required)

### Readiness & Health Connect (Android)
- Morning check-in (sleep, energy, drinks last night) opens on the first dashboard visit of the day
- Readiness card with score ring, recommendation and "why?" breakdown
- Health Connect sync of sleep sessions, steps and resting heart rate; tracked sleep overrides the manual rating, and resting HR vs. your 28-day baseline feeds readiness
- Migration: `sleep_records_migration.sql` (plus `steps` / `resting_heartrate` on daily logs)

### Supplements & Medication
- New `/supplements` page (Today / My Stack / History with adherence %), dashboard "Today's doses" card, per-dose push reminders
- Six MCP coach tools for saving, scheduling, logging and skipping supplements
- Migration: `supplement_tracking_migration.sql`

### Workout Partners
- Invite a partner by email with mutual accept and summary/full share levels; partner dashboard with weekly stats and streaks, one-tap encouragement nudges, streak-at-risk alerts
- Send workout templates and saved meals to a partner; 2–8 person group challenges with leaderboards
- Migration: `partner_migration.sql`

### WearOS Companion (preview)
- Wear OS app with pairing flow, Today tile (calorie arc, macros remaining, next workout), complications, live workout sessions with heart rate, voice food logging and set logging, crash-safe workout drafts, half-pound weight steps
- Progressive overload suggestions (double progression) in `get_workout_templates` / `get_schedule`, prefilled on the watch
- Design doc: `docs/watch-companion-design.md`

### Other Improvements
- Menu scanner accepts PDF menus (up to 3 MB)
- Progress photos can be chosen from the gallery and are compressed before upload
- Coach-planned meals appear in the Meal Planner; scheduled entries link to completed in-app sessions
- MCP "today" defaults resolve in the user's timezone

### Fixes & Security
- Multi-device food logs no longer clobber each other (three-way merge on autosave and offline replay)
- Daily totals respect food portion quantities; stale drink count on the Eat day-details card fixed
- All AI API routes now require authentication
- Android release 2.4 (versionCode 3); release builds fail if `google-services.json` is missing

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
