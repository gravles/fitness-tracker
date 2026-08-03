# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [Unreleased]

### Menu Scanner
- "Upload PDF Menu" button on the menu scanner (in addition to photo capture), capped at 3 MB

### Fixes
- Eat day-details card no longer shows a stale drink count after logging a drink elsewhere (voice, another device) — refreshes without a page reload

---

## [3.0.0] — 2026-07-22

### Kinetic Rebrand
- Life Logger is now **Kinetic** — new app name, icon references, and logomark across the web app, iOS, and Android
- New floating "glass" bottom nav (`KineticNav`); same tab order (Home, Workout · gold FAB · Eat, Trends) but the FAB now opens a context-aware capture sheet instead of always jumping to a log page
- `/nutrition` is now the primary food-logging surface (voice / snap / barcode / type / menu scan / favorites, plus the day timeline); the old `/log` and standalone daily-log form are gone (old deep links and PWA/watch shortcuts still redirect correctly)
- Meal Planner moved to its own `/nutrition/planner` route, reachable via a "Plan" pill in the Eat header
- Home page redesigned as a "Bento" layout: nutrition rings, sparklines, habit strip, coach banner, wellness check-in; XP/level progress moved behind a toggle on the new `/more` hub
- Native voice logging fixed on Android/iOS via a proper native speech-recognition plugin (the old in-WebView speech API silently failed on-device)
- Workout hub and active-session screen restyled; Withings sync button added to the Trends header

---

## [2.4.0] — 2026-07-19

### WearOS Companion App
- Native watch app for Samsung Galaxy Watch Ultra (WearOS) — pair from Settings with a short code
- Log a full workout from the wrist: rotary-dial reps/weight (half-pound increments), haptic set completion, full-screen rest timer, or just speak a set ("185 for 8")
- Voice food logging on the watch with a live-transcript confirmation card before saving
- Today screen and home-screen tile: calorie/protein rings, next scheduled workout, readiness score; instant refresh after logging instead of waiting on a timer
- Watch-face complications for calories remaining and one-tap shortcuts into voice logging / workout picker
- Crash-proof workout sessions — a killed watch app resumes mid-session with completed sets intact
- Heart rate captured automatically during watch workouts and saved with the session

### Readiness Score & Morning Check-In
- New 0–100 readiness score (primed / ready / steady / recovery) from sleep, prior-day energy and alcohol, and recent vs. long-term training load — with a "why?" breakdown and recommendation
- Shown on the watch Today screen and a new Dashboard card on web/phone
- Quick morning check-in (sleep quality, energy, drinks) prompted from the dashboard or by tapping readiness on the watch; prefilled from any existing entry

### Health Connect Integration (Android)
- Syncs sleep sessions, daily steps, and resting heart rate from Health Connect once connected in Settings
- Tracked sleep supersedes the manual 1–5 rating in the readiness calculation; resting-heart-rate trend (vs. a 28-day personal baseline) becomes an additional readiness input; step count shown on the dashboard readiness card

### Progressive Overload Suggestions
- Workout logger and watch now suggest a weight bump when you've earned it, based on your last 90 days of logged sets for that exercise

### Supplement & Medication Tracking
- New `/supplements` page ("Supplements & Meds"), plus a today's-doses card on the Dashboard
- Track supplements and medications with dose, unit, form, and notes; schedule recurring doses (specific times/weekdays, up to 90 days) or log as-needed intake
- Optional push reminder at each scheduled dose time
- 30-day history with an adherence percentage (taken vs. skipped vs. missed)
- AI Coach can save/schedule/log on your behalf via chat and MCP tools, but never suggests or changes a dose itself — "for personal tracking only, not medical advice"

### Reliability
- Fixed a bug where logging food from one device (e.g. the watch) while another device had a stale session open could silently wipe a whole day's food log — writes now merge instead of overwrite
- Fixed user-adjusted portion quantities being ignored by some totaling paths (MCP/watch logging, offline merges), which could silently reset daily nutrition totals
- Public `/privacy` policy page ahead of Play Store release

---

## [2.3.0] — 2026-07-14

### Workout Partners
- Add a partner by email — push notification + in-app invite if they already have an account, an email signup link if not
- Partner hub shows shared weekly stats (streak, days logged, workout count, protein-goal days, avg sleep, level) at a "Summary" or "Full" (adds recent workouts/logs) share level you each control independently
- One-tap nudges (💪🔥👏), rate-limited to one per hour, plus automatic "streak-at-risk" nudges if you haven't logged by 8pm after logging the day before
- Share a workout template, saved meal, or favorite food to a partner's "Shared" inbox with an optional note
- Group challenges (2–8 people) around a streak, protein-days, or workout-count goal over a date range, with an anonymous-by-default leaderboard and milestone/result notifications

### Progress Photos
- Progress-photo upload now offers "Choose from Gallery" alongside the camera, with automatic image compression so large photos upload reliably

### UI/UX Audit
- Failed page loads show a retry card instead of a blank screen; accessible keyboard/screen-reader modals; larger tap targets and numeric keypads for gym logging; improved light/dark contrast
- New `/more` hub consolidates Coach, Programs, Progress, Metrics, History, Partners, Settings, and Help; several tabs are now deep-linkable via URL

---

## [2.2.0] — 2026-07-05

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

---

## [2.1.0] — 2026-05-28

### Language Toggle
- English/French toggle in Settings → Customisation, switching the app UI and AI features (coach chat, weekly insights, goal wizard, workout recommendations) to the selected language

### Workout Logger
- Autosave per set, plus the ability to edit a completed workout after the fact
- Delete button for individual set rows

### Fixes
- Restored camera capture in the food-photo scanner and added a gallery-picker fallback
- Resolved an inconsistency in food-photo scan results
- Fixed AI Weekly Analysis returning no results and made its JSON parsing more robust
- Fixed an incorrect habits column name in the MCP daily-logs query
- Added a per-account Claude MCP connector for generating an API key from Settings

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
