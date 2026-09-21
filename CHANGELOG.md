# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [Unreleased]

## [3.0.0] — 2026-07-28

### Kinetic Rebrand & Redesign
- Renamed Life Logger → **Kinetic**: new K logomark, app metadata, manifest, and app-store listing name
- Floating glass pill nav with a context-aware gold FAB and capture sheet
- New Bento-style Home: nutrition rings, weight/movement sparklines, habit strip, coach banner, and wellness check-in front and center; XP/gamification moved behind a `/more` toggle
- `Eat` (`/nutrition`) is now the primary food logger: inline voice / photo / barcode / typed / menu-scan / favorites capture, a timeline with skippable planned meals, and date/time editing with a live proportional macro preview
- Meal Planner moved to `/nutrition/planner` (a "Plan" pill in the Eat header)
- Workout hub restyled with today's activity surfaced at the top; active session screen redesigned (set pills, ghost values, rest bar, log-set CTA)
- The old `/log` page dissolved into the tab bar; old deep links still redirect correctly
- Native voice logging switched to on-device speech recognition (`@capacitor-community/speech-recognition`) since the Android WebView's Web Speech API never worked reliably

### WearOS Companion App
- New standalone Wear OS app (Kotlin/Compose) for Galaxy Watch and other Wear OS devices — see `android/wear/README.md` for sideloading
- Secure short-code device pairing (the watch's key never leaves the device; only its hash is sent)
- Live workout sessions on the watch: set-by-set logging with crown/bezel input, haptic feedback, a full-screen rest-timer ring, and live heart-rate capture during the session
- Voice food logging directly from the watch, with an in-app speech recognizer and pulsing listening UI
- "Say set" voice logging during an active session (e.g. "185 for 8")
- Crash-proof sessions: an in-progress workout is persisted to disk and resumes automatically after the watch app is killed or restarted
- Today tile and watch-face complications: calories/protein rings, next scheduled workout, one-tap shortcuts into voice logging or the workout picker, calories-remaining complication
- Progressive overload suggestions carry through to the watch (server-computed target-weight prefill with a "you earned it" hint on an increase)
- Morning check-in (sleep, energy, drinks) available on the watch, mirroring the phone flow

### Readiness Score & Health Connect
- New daily Readiness Score (0–100): primed / ready / steady / recovery, computed from sleep quality, yesterday's energy, alcohol, and training load — no wearable required. Exposed to the AI coach via the new `get_readiness` MCP tool
- Dashboard readiness card with a score ring, band label, recommendation, and a "why?" breakdown of contributing factors
- Morning check-in modal on first dashboard visit of the day (sleep, energy, drinks — skippable, syncs with the watch's version)
- Android Health Connect integration: syncs steps, resting heart rate, and sleep sessions (with per-stage detail) automatically; tracked sleep now feeds the Readiness Score ahead of the manual 1–5 rating when available

### Supplement & Medication Tracking
- New `/supplements` page: Today / My Stack / History tabs with adherence percentage
- Schedule recurring or one-off doses (multiple times per day supported), or log ad-hoc/PRN intake
- Push reminders at each scheduled dose time
- Six new AI coach MCP tools (`save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement`) — the coach records exactly what it's told and never suggests or alters doses
- Dashboard "Today's doses" card

### Workout Partners & Group Challenges
- Mutual workout-partner linking (invite by email, accept, pause/end) alongside the existing email-only accountability partners
- Per-partner dashboard with weekly stats, streaks, and one-tap encouragement nudges; configurable share level (summary vs. full)
- Send workout templates and saved meals directly to a partner
- Group challenges (2–8 members): anonymous-by-default leaderboard, progress computed from logs and workouts, join/decline/leave

### AI Coach MCP Tools — Training & Meal Planning
- New MCP tools so an AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry
- Meal-planning counterpart: `save_meal` (upsert by name), `get_meals`, `plan_meal` (saved meal or ad-hoc, single date or recurring, capped at 90 days, configurable meal slots), `get_meal_plan` (per-day entries plus planned-vs-logged macro totals), `update_planned_meal` (move, swap meal, skip with reason)
- `log_food` extended with `planned_meal_id` (copies plan macros as defaults, any field can be overridden with what was actually eaten, marks the entry logged) and a new `log_planned_meal` convenience tool for one-call "ate what I planned"
- Dashboard: "Today's meal plan" card showing today's planned meals with slot/time and a one-tap "Log as planned" action
- Tool reference: `docs/mcp-tools.md`

### Other Additions
- PDF menu upload in the menu scanner (alongside photo capture), capped at 3 MB
- Progress photos: pick an existing photo from the gallery, not just the camera; images are downscaled/re-encoded client-side before upload
- Accessibility & design-system audit: shared error-with-retry card on every page loader, an accessible modal primitive (focus trap, Escape, `aria-modal`) across all 16 dialogs, 44px gym-friendly tap targets, WCAG AA contrast fixes, consistent `--color-danger` / brand button usage
- Navigation: `/more` hub for Coach, Programs, Progress, Metrics, History, Partners, Settings, and Help; tabs deep-linkable via `?tab=`

### Fixes & Reliability
- Fixed a multi-device data-loss bug where a stale phone session could overwrite food items logged elsewhere (watch, other device) — daily logs now merge instead of overwrite
- Food totals (dashboard, MCP `log_food`) now correctly respect per-item portion-quantity multipliers instead of always using full-package macros
- "Today" now resolves in the user's own timezone across all MCP tools instead of the server's UTC clock, fixing evening logs landing on the wrong day
- All AI API routes now require authentication
- Fixed a stale drink count on the Eat page's day-details card
- Android release builds now fail fast if the Firebase config is missing, instead of shipping a build that crashes on login

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
