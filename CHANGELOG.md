# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [Unreleased]

Nothing yet.

## [3.0.0] — 2026-07-28 — "Kinetic"

### Kinetic Rebrand
- Life Logger → Kinetic: new name, K logomark, app icon, and metadata/manifest across web and native shells
- New information architecture: floating glass pill nav with a context-aware gold FAB and capture sheet
- Bento-style Home: nutrition rings, weight/movement sparklines, habit strip, coach banner, and wellness check-in; XP moved behind a `/more` toggle
- Eat (`/nutrition`) is now the food logger — inline voice/snap/barcode/type/menu/favorites capture, a timeline with skippable planned meals, and date/time editing with a proportional macro preview
- Meal Planner moved to `/nutrition/planner`; old `/log` deep links redirect to the new tabs
- Restyled workout hub and active-session screen (set pills, ghost values, rest bar, log-set CTA)
- Native voice logging switched to `@capacitor-community/speech-recognition` (Android's WebView Web Speech API never worked)

### WearOS Companion App
- Standalone Kotlin/Compose Wear OS app (`wear/` module) with hash-only device pairing via `/api/pair/start`
- Today tile: calories/protein rings, next planned workout, one-tap log actions, refreshes instantly after a save instead of waiting out the 30-minute cycle
- Live workout sessions on the watch with heart-rate capture, crash-proof draft persistence/resume, and progressive-overload weight suggestions (half-pound steps)
- Voice food logging and voice set logging directly on the watch
- Readiness score shown on the Today screen; `food` and `lift` watch-face shortcut complications and a calories-remaining complication
- Android build hardened: release fails fast if `google-services.json` is missing; Android release bumped to 2.4

### Health Connect Integration (Android)
- Native Health Connect plugin: daily steps and resting heart rate, synced alongside existing data and upserted per-day so partial syncs never null out existing values
- Sleep sync via `SleepSessionRecord` reads into a new `sleep_records` table; tracked sleep now drives readiness ahead of the manual 1–5 rating, which remains as a fallback
- Settings card (Android app only) to connect and sync on demand

### Readiness Score & Morning Check-In
- Transparent 0–100 readiness score computed from logged data alone (sleep quality, prior-day energy, alcohol, acute:chronic training load) — no wearable required; same engine powers the web dashboard, the watch, and the `get_readiness` MCP tool
- Dashboard readiness card with score ring, band label, and a "why?" breakdown of contributing components
- First dashboard visit of the day without sleep logged auto-opens a skippable morning check-in (sleep, energy, drinks)

### Supplement & Medication Tracking
- New `/supplements` page (Today / My Stack / History tabs with adherence %), dashboard "Today's doses" card, and an add/edit modal with a recurrence-based schedule builder
- Six AI-coach MCP tools to save, schedule, log, and query supplement/medication adherence
- Per-dose push reminders through the existing reminder pipeline

### Workout Partners
- Mutual workout-partner system (invite by email, accept, pause/end) layered on top of the existing email-only accountability partners
- Partner hub (`/partner`) and per-partner dashboard with weekly stats, streaks, one-tap encouragement nudges, and a configurable share level (summary vs. full)
- Send workout templates or saved meals directly to a partner; shared-items inbox with one-tap save; group challenges

### AI Coach MCP Tools: Scheduling & Meal Planning
- `save_workout_template`, `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule`, and `update_scheduled_workout` so an AI coach can push training plans, not just log activity
- `log_workout` extended with strength logging (per-set reps and weight) and automatic completion of the day's scheduled entry
- Meal-planning counterpart: `save_meal`, `get_meals`, `plan_meal`, `get_meal_plan` (planned-vs-logged macro totals), `update_planned_meal`
- `log_food` extended with `planned_meal_id`, plus a `log_planned_meal` convenience tool for "ate what I planned"; planned meals never double-count toward daily totals until logged
- Dashboard "Today's meal plan" card with a one-tap "Log as planned" action
- Tool reference: `docs/mcp-tools.md`

### Claude MCP Connector
- Per-account MCP connector (`/api/mcp`) so Kinetic's own data can be driven from any MCP-compatible AI client, not just the built-in coach
- Settings → "Claude AI Connector": generate, copy, and revoke a personal API key

### Language Toggle (English / French)
- Full EN/FR translation of navigation, dashboard, daily log, settings, onboarding, and all section components
- Switchable from Settings → Customisation; persisted to `localStorage`

### Menu Scanner & Progress Photos
- Menu scanner accepts PDF menu uploads in addition to photos
- Progress-photo upload can pick an existing photo from the gallery, not just the camera; large gallery originals are downscaled and re-encoded before upload

### Fixes & Hardening
- Multi-device food-log writes are now merge-safe, fixing clobbered entries when logging from more than one device
- Daily totals respect food portion quantities everywhere they're computed
- Fixed stale drink count on the Eat day-details card
- All AI API routes now require authentication
- Fixed AI weekly analysis returning no results and hardened its JSON parsing
- Fixed iOS push notifications (APNs production entitlement, direct APNs delivery) and an iOS black-screen launch bug
- Workout logger: autosave per set, edit completed workouts, delete individual set rows
- Fixed food-photo scan inconsistency and restored camera capture with a gallery fallback in the meal camera
- Accessibility and design-system pass: error states, accessible modals, consistent navigation IA
- Play Store release prep: public privacy policy and health-data declaration checklist

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
