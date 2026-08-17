# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [Unreleased]

_Nothing yet._

## [3.0.0] — 2026-07-28

### Kinetic Rebrand
- Life Logger is now **Kinetic** — new name, new "K" logomark, and a new information architecture across web, iOS, and Android
- New floating bottom nav with a context-aware capture button that opens a quick-log sheet from anywhere
- Home screen redesigned as a bento grid: nutrition rings, weight/movement sparklines, a habit strip, coach banner, and a wellness check-in card; XP/levels moved behind a `/more` toggle to de-clutter
- Nutrition (now "Eat") is the primary food logger, with inline voice / photo / barcode / menu-scan / favorites capture and a day timeline; the AI meal planner moved to `/nutrition/planner`
- Native voice logging on Android now uses on-device speech recognition instead of the browser API, which never worked reliably inside the app's WebView — **requires updating to the latest app build**, not just refreshing the page

### Kinetic Watch — WearOS Companion App
- A full WearOS companion app, paired to your account with a short code from Settings
- Today tile: gold calories / blue protein rings, next scheduled workout, and today's readiness score at a glance
- Live workout sessions on the wrist: one screen per set, crown-adjustable reps/weight (down to half-pound increments), haptic feedback, and a full rest-timer ring — sessions survive a crash or restart and resume where you left off
- Voice logging for both food and mid-workout sets ("185 for 8"), and a morning check-in screen for sleep/energy
- Heart-rate capture during workouts (avg/max bpm saved with the session)
- Watch-face complications for remaining calories and one-tap shortcuts to log food or start a lift
- See [`docs/watch-companion-design.md`](docs/watch-companion-design.md) for the design background

### Health Connect (Android)
- Automatic sync of steps, resting heart rate, and sleep sessions (with stage detail) from Health Connect — no manual entry
- New Settings → Health Connect card to enable/manage the sync
- Synced sleep and resting heart rate feed directly into the new readiness score below

### Daily Readiness Score
- A new 0–100 readiness score, computed from sleep, yesterday's energy, alcohol, resting heart rate vs. your own baseline, and recent training load — with a plain-language recommendation (e.g. "primed," "recovery")
- A quick morning check-in (sleep, energy, drinks last night) opens automatically on first visit of the day if not already logged, on both the dashboard and the watch
- New dashboard readiness card with a "why?" breakdown of every factor
- New MCP tool: `get_readiness`

### Progressive Overload Suggestions
- Freestyle and template-based workouts now suggest a weight for each exercise based on your last 90 days of logged sets, following double progression (hit the top of your rep range → +5 lbs next time)
- Suggestions appear on the Schedule page and pre-fill the weight field on the watch

### Workout Partners
- Link up with a friend or training partner (mutual invite by email) and choose what they can see — summary or full detail
- Partner hub with weekly stats, streaks, and one-tap encouragement nudges
- Send a workout template or saved meal straight to a partner
- Group challenges (2–8 people) with an anonymous-by-default leaderboard
- This is a separate, richer system from the existing email-only Accountability Partners in Settings

### Supplement & Medication Tracking
- New `/supplements` page to build your stack, schedule doses (including multiple times a day and recurring schedules), and log intake
- Adherence tracking and history; push reminders at each scheduled dose time
- Ad-hoc / as-needed logging for things like pain relievers, separate from your scheduled stack
- Tracking-only — the app never suggests doses or changes to medications
- Six new MCP tools: `save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement`

### Menu Scanner: PDF Upload
- The AI Menu Scanner now accepts a PDF menu upload (up to 3 MB) in addition to a photo, for restaurants that only post a PDF

### AI Coach MCP Tools
- New MCP tools so an AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry
- Meal-planning counterpart: `save_meal` (upsert by name), `get_meals`, `plan_meal` (saved meal or ad-hoc, single date or recurring, capped at 90 days, configurable meal slots), `get_meal_plan` (per-day entries plus planned-vs-logged macro totals), `update_planned_meal` (move, swap meal, skip with reason)
- `log_food` extended with `planned_meal_id` (copies plan macros as defaults, any field can be overridden with what was actually eaten, marks the entry logged) and a new `log_planned_meal` convenience tool for one-call "ate what I planned"
- Dashboard: new "Today's meal plan" card showing today's planned meals with slot/time and a one-tap "Log as planned" action (hidden entirely on days with no coach plan)
- Migrations: `coach_scheduling_migration.sql`, `coach_meal_planning_migration.sql`
- Tool reference: [`docs/mcp-tools.md`](docs/mcp-tools.md)

### Accessibility & Design System
- Every page now shows a retry card instead of a blank screen on a failed load
- All modals rebuilt on an accessible dialog primitive (focus trap, Escape to close, screen-reader labelling)
- Larger, easier-to-tap set-complete controls for gym use
- Consistent color, iconography, and loading states across the app

### Fixes
- Fixed a bug where a food item's saved portion size (e.g. "1.5 servings") could be silently ignored by AI-coach logging or a multi-device sync replay, resetting that day's calorie/macro totals to the unscaled amount
- Fixed a multi-device sync bug where saving a food log from the phone could overwrite items logged elsewhere (e.g. from the watch) since the page was opened; food logs now merge instead of overwrite
- Fixed the drinks counter on the Eat day-details card not updating when a drink was logged from another screen or device

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
