# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

## [3.0.0] — 2026-07-23

### Kinetic Rebrand
- Renamed from Life Logger to **Kinetic**, with a full visual and structural overhaul in two stages: a design-language refresh (new navy/gold/blue palette, Sora/Inter typography, Lucide icons, shared Card/Button/ProgressRing primitives) followed by a new information architecture
- Floating glass "pill" navigation with a context-aware gold FAB that opens a capture sheet, replacing the old raised nav button
- Bento-style Home screen: nutrition rings, weight/movement sparklines, habit strip, coach banner, and wellness check-in front and center; XP/gamification moved behind the `/more` hub
- **Eat** (`/nutrition`) is now the primary food logger (voice / snap / barcode / type / menu / favorites) with a skippable timeline; the AI meal planner moved to `/nutrition/planner`; `/log` deep links redirect into the new tab bar
- Native voice logging fix: Android/iOS now use a real native speech engine (`@capacitor-community/speech-recognition`) instead of the WebView's Web Speech API, which never actually worked on-device

### WearOS Companion App
- New standalone Wear OS app — pair a watch from Settings → Pair a Device with a 6-character code; the watch talks directly to the backend, no phone nearby required
- **Today tile**: dual progress rings (calories / protein), readiness score at a glance, one-tap "say food" voice logging, and a chip that launches straight into the next scheduled workout
- **Live workout sessions** on the watch: today's scheduled workouts front and center, rotary/±  set logging (half-pound increments), full-screen rest timer with haptics, continuous heart-rate capture, and progressive-overload weight prefill with a callout when it's time to go up in weight
- Crash-proof sessions — an in-progress workout is saved as a draft and resumes exactly where it left off if the watch app is killed
- Voice food logging and voice set logging ("185 for 8"), transcribed on-device with cloud fallback
- Watch-face complications: calories-remaining, plus shortcuts straight into voice food logging or the workout picker; tiles refresh instantly after any log instead of waiting on the periodic refresh

### Health Connect & Readiness Score
- Connect Health Connect (Settings, Android) to sync sleep sessions (with sleep-stage breakdown), daily steps, and resting heart rate from the watch
- New **readiness score** (0–100, primed / ready / steady / recovery) computed from sleep, energy, alcohol, resting-heart-rate baseline, and training load, shown as a dashboard card with an expandable "why?" breakdown and inline on the watch
- Daily **morning check-in** modal (dashboard + watch) captures sleep quality, energy, and last night's drinks when not already logged, feeding the readiness score

### AI Coach MCP Tools
- New MCP tools so an AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry; a same-day auto-link safety net catches sessions started from the Schedule page that would otherwise read as "missed"
- Coach-scheduled workouts use the existing `scheduled_workouts` / `workout_templates` tables, so they appear on the dashboard and Schedule page with no UI changes
- Migration: `coach_scheduling_migration.sql` (template fallbacks, skip reasons, fallback flag on scheduled entries)
- Meal-planning counterpart: `save_meal` (upsert by name), `get_meals`, `plan_meal` (saved meal or ad-hoc, single date or recurring, capped at 90 days, configurable meal slots), `get_meal_plan` (per-day entries plus planned-vs-logged macro totals), `update_planned_meal` (move, swap meal, skip with reason)
- `log_food` extended with `planned_meal_id` (copies plan macros as defaults, any field can be overridden with what was actually eaten, marks the entry logged) and a new `log_planned_meal` convenience tool for one-call "ate what I planned"
- Planned meals never count toward `get_daily_logs` totals until logged — no double counting
- New dedicated tables `mcp_meals` / `planned_meals` (kept separate from the existing pantry/AI-meal-generator tables, which model an unrelated feature)
- Dashboard "Today's meal plan" card and a "Coach Plan" section on the Meal Planner page itself, both with a one-tap "Log as planned" action (hidden entirely on days with no coach plan)
- Migration: `coach_meal_planning_migration.sql`
- Tool reference: `docs/mcp-tools.md`

### Workout Partners
- Invite a partner by email from the new Partners hub; accept/decline, pause, or end a partnership at any time
- Weekly shared-progress dashboard per partner: streak, days logged, workout count, protein-goal days, average sleep quality, level
- Two visibility tiers — Summary (stat tiles only) or Full (also shows recent workouts and nutrition logs)
- One-tap encouragement nudges, plus automatic nudges when a partner hasn't logged
- Share saved workout templates, saved meals, or favorite foods directly to a partner's shared inbox
- Partner challenges: streak, protein-days-hit, or workout-count targets over a date range, tracked side-by-side

### Supplement & Medication Tracking
- New Supplements page: add supplements or prescription medications to a personal stack with dose, form, and notes (medications get an "Rx" badge)
- Today tab with Take / Skip / Undo on scheduled doses, plus ad-hoc logging outside the schedule
- History tab with 30-day adherence percentage and a day-by-day taken / skipped / missed log
- Optional reminder notifications before a scheduled dose (web push, APNs, FCM)

### Language Support
- English/French toggle in Settings → Customisation, translating the full core UI
- Selected language is passed to every Claude-powered feature (weekly insights, workout chat, AI coach, goal wizard, workout recommendations) so AI responses come back in the chosen language

### Progress Photos
- Upload flow now offers "Choose from Gallery" alongside the camera
- Photos are automatically downscaled and re-encoded before upload, fixing failures on large HEIC photos from iPhone

### Accessibility & Navigation
- Consistent error states with retry, accessible modal dialogs (focus trap, Escape, ARIA), larger touch targets, and WCAG AA contrast fixes
- Navigation reorganized into a `/more` hub consolidating Coach, Programs, Progress, Metrics, History, Partners, and Settings

### Play Store Release Readiness
- Public privacy policy and a Health Connect health-data declaration (Data Safety form, Limited Use compliance) required for the new Health Connect permissions
- Android release bumped to 2.4 with a Wear OS R8/ProGuard build fix; release builds now fail loudly if `google-services.json` is missing rather than shipping broken

### Bug Fixes
- Food portion quantities (e.g. a partial package) are now respected everywhere daily totals are computed — a watch or connector log no longer silently resets a day's calories/macros to full-package amounts
- The Eat day-details drink counter now re-syncs live when drinks are logged elsewhere (voice, morning check-in, another device) instead of only after a full page reload
- Logging food from a second device (e.g. the watch) no longer overwrites food already logged elsewhere that day — writes are merged instead of replaced
- All AI API routes now require authentication

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
