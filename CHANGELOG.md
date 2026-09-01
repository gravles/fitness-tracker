# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

_Nothing yet._

## [3.0.0] — 2026-07-20

### WearOS Companion App
- Standalone Kotlin/Compose app for Galaxy Watch Ultra and other Wear OS devices, built on the existing MCP API (`android/wear/README.md` for sideloading)
- Secure short-code pairing: the watch generates its own key locally and only a SHA-256 hash ever leaves the device (`pairing_requests` table, `/api/pair/start|claim|poll`, Settings → "Pair a Device")
- Today screen: concentric gold-calories / blue-protein rings, remaining values, next scheduled workout, readiness score
- Live workout sessions: one screen per set with reps/weight steppers (crown/bezel adjustable), haptic on set complete, full-screen rest-timer countdown, heart-rate capture during the session (avg/max logged), intensity picker, half-pound (2.5 lb) weight increments
- Crash-proof sessions: an in-progress workout is drafted to disk after every set and resumes at the first incomplete exercise on relaunch, even after a force-stop
- Voice food logging and voice set logging via in-app speech capture (pulsing mic indicator, live partial transcript, auto-submit on pause), with the system speech sheet as a fallback
- Morning check-in on the watch (sleep / energy / drinks, prefilled from existing logs)
- Progressive-overload weight prefill: each exercise pre-fills the suggested weight with a hint ("185 → 190 lbs, you earned it")
- Tiles: dual gold/blue rings with one-tap "food" and "lift" quick actions, refreshing instantly after a log instead of waiting out the 30-minute cycle
- Watch-face complications: calories-remaining progress arc, plus "food" and "lift" shortcuts

### Readiness Score
- New transparent 0–100 readiness score computed from logged data only — no wearable required — combining sleep quality, yesterday's energy, alcohol, and acute:chronic training load, with a `primed` / `ready` / `steady` / `recovery` label, training recommendation, and a "why?" component breakdown
- Dashboard readiness card, plus a first-visit-of-the-day morning check-in modal (sleep/energy/drinks) that feeds it
- `get_readiness` MCP tool so an AI coach can factor it into recommendations
- Tracked sleep (via Health Connect) and resting heart rate feed directly into the score once connected, taking priority over the manual 1–5 rating

### Health Connect Integration (Android)
- Sleep sync: native Health Connect plugin reads sleep sessions with per-stage minutes (`sleep_records` table); readiness uses tracked duration over the manual rating when available
- Steps and resting heart rate sync, both shown on the dashboard readiness card
- Settings → Health Connect card (Android app only) with connect + sync-now, alongside the existing Strava / Withings / Oura integrations

### Workout Partners & Group Challenges
- Mutual workout-partner system: invite by email, per-partner share level (summary vs. full), pause/end
- Partner hub with weekly stats, streaks, one-tap encouragement pushes, and a shared-items inbox
- Send workout templates and saved meals directly to a partner
- Group challenges (2–8 members): create/join/decline/leave, anonymous-by-default leaderboard, progress computed from daily logs and workouts
- Existing email-only accountability partners are unchanged and continue to work alongside this

### Supplement & Medication Tracking
- Supplement/medication catalogue with scheduled dosing (recurrence, multi-time days), ad-hoc/PRN logging, and adherence tracking
- `/supplements` page: Today / My Stack / History tabs with adherence percentage, plus a dashboard "Today's doses" card
- Push reminders per scheduled dose
- Six new MCP coach tools — see `docs/mcp-tools.md`
- Tracking-only disclaimer; this is not medical advice

### Also in this release
- Progress photos: gallery picker (in addition to camera capture) with automatic image compression for large HEIC originals
- UI/UX pass: accessible modal primitive (focus trap, Escape, ARIA) across all dialogs, shared error/retry states on every page loader, WCAG AA contrast fixes, larger touch targets for gym use, new `/more` hub for secondary pages
- Coach-planned meals now appear directly in the Meal Planner page (Today and Week views), not just the dashboard card

### Fixes
- **Multi-device food log**: fixed a bug where a stale phone browser tab could silently overwrite a day's food log after the watch logged to it — daily logs now merge across devices instead of one writer clobbering another
- Evening logs (after ~8 PM Eastern) no longer land on the wrong day — MCP tools now resolve "today" in the user's stored timezone instead of the server's UTC clock
- All AI API routes now require authentication (previously several were open)
- Completing a workout started from the schedule now reliably marks the scheduled entry done

### Release
- Public privacy policy at `/privacy` and a Play Store health-declaration checklist (`docs/play-release-checklist.md`) ahead of wider release

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
