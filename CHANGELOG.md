# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

Nothing yet.

## [2.4.0] — 2026-07-28

### Kinetic Rebrand & New Navigation
- Life Logger is now **Kinetic** — new name, new "K" logomark, and refreshed app icons and splash screens across web, iOS, and Android
- Bottom navigation replaced with a floating pill nav and a gold "+" action button that opens a quick-capture sheet (photo, voice, barcode, type, or menu scan)
- **Eat** is now the primary place to log food (folding in the old separate `/log` page): inline voice/photo/barcode/menu-scan capture, a day timeline, skippable planned meals, and a live macro preview as you edit
- **Meal Planner** moved under Eat → Plan; old bookmarked links to `/log` and the previous planner URL still redirect correctly
- Home redesigned as a bento layout — nutrition rings, weight/movement sparklines, a habit strip, a coach banner, and the daily wellness check-in up front; XP/level display moved into the new More hub
- Withings sync button added directly to the Trends page header

### Native Voice Logging Fixed
- Voice logging on Android now runs on a real native speech engine instead of the in-app browser API that silently failed to capture audio — voice food and workout logging works reliably on-device

### Menu Scanner: PDF Upload
- Scan Menu now accepts an uploaded PDF (up to 3 MB) as an alternative to a photo — useful for restaurants that only publish a PDF menu

### Fixes
- Drink count on the Eat day-details card no longer goes stale — it now stays in sync with drinks logged elsewhere without needing a page reload
- Release builds now fail at build time if required push-notification configuration is missing, instead of shipping a build that crashed right after login

---

## [2.3.0] — 2026-07-19

### Wear OS Companion App
- New standalone Kinetic watch app — pair it from Settings → Pair a Device with a short code generated on your phone
- Today tile on the watch: calorie and protein progress rings, your next scheduled workout, and your readiness score
- Voice food logging directly on the watch, using the same AI parsing as the phone app
- Live workout sessions on the watch: crown-adjustable reps and weight (down to 2.5 lb increments), haptic feedback on completing a set, a full-screen rest timer, voice-logged sets ("185 for 8"), live heart-rate capture, and crash-proof recovery if the watch app closes mid-workout
- Weight fields pre-fill with a progressive-overload suggestion based on your last session for that exercise
- Watch-face complications for calories remaining, plus one-tap shortcuts straight into food or workout logging

### Health Connect Sync (Android)
- Connect Health Connect in Settings to automatically sync sleep sessions, daily steps, and resting heart rate — no manual entry needed
- Tracked sleep duration and resting heart rate now feed directly into your Readiness Score wherever available, with manual entry as the fallback

### Readiness Score
- New daily Readiness Score (0–100) on the dashboard and watch, built from sleep, yesterday's energy, alcohol, training load, and — when Health Connect is on — resting heart rate, with a plain-language breakdown of what's driving it
- A quick morning check-in (sleep, energy, drinks last night) prompts once a day if you haven't logged sleep yet, on both phone and watch

### Progressive Overload Suggestions
- Workout templates and the schedule now suggest your next weight per exercise based on your last logged performance, surfaced on the watch and available to the AI coach
- Migration: none (derived from existing workout data)

### Supplement & Medication Tracking
- New Supplements page — schedule doses (specific times, days of week, or log as-needed), see today's doses on the dashboard, and track adherence history
- Push reminders fire at each scheduled dose time; the AI coach can manage your stack too — see `save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, and `update_scheduled_supplement` in `docs/mcp-tools.md`
- Tracking only — the app never suggests doses or changes to a medication, only records what you tell it
- Migration: `supplement_tracking_migration.sql`

### Data Integrity Fixes
- Fixed a bug where a stale phone session could overwrite an entire day's food log with an older snapshot when logging also happened elsewhere (watch, another device); logs now merge instead of overwrite
- Fixed portion-quantity totals being ignored when logging via the watch, voice, or the AI connector, which could silently reset a day's macros back to full-package amounts
- Fixed logs made in the evening sometimes landing on the wrong calendar day — "today" is now resolved from your saved timezone instead of the server clock
- Migration: `timezone_migration.sql`

---

## [2.2.0] — 2026-07-14

### AI Coach Autopilot
- The AI coach can now build and push entire training plans and meal plans, not just log activity: save workout/meal templates, schedule them (single day or recurring, up to 90 days out), and they appear on your Schedule and in the Meal Planner automatically
- `log_workout` and `log_food` extended so completing a coach-scheduled session or meal automatically marks the plan entry done
- Coach-planned meals get their own section on the Eat/Meal Planner Today and Week views with a one-tap "Log as planned" action
- Fixed scheduled workouts being wrongly marked "missed" when completed from the Schedule tab instead of via the coach
- New tables `mcp_meals` / `planned_meals`, kept separate from the existing pantry/AI-meal-generator tables which model an unrelated feature
- Migrations: `coach_scheduling_migration.sql`, `coach_meal_planning_migration.sql`
- Tool reference: `docs/mcp-tools.md`

### Workout Partners
- Link up with a partner via mutual email invite, choose how much detail to share (summary or full), and see their weekly stats and streaks on a shared dashboard
- Send a one-tap nudge, share a workout template or saved meal straight to a partner, and run group challenges (2–8 people) with an anonymous-by-default leaderboard
- Existing email-only accountability partners still work alongside the new linked-partner system
- Migration: `partner_migration.sql`

### Progress Photos
- Progress photo upload now offers "Choose from Gallery" as well as the camera, with automatic client-side compression so large phone photos upload reliably

### Accessibility & Reliability Pass
- Every page now shows a retry-capable error state instead of failing silently on a network error
- Modals across the app are now keyboard- and screen-reader-accessible (focus trap, Escape to close)
- Larger tap targets and numeric keypads for logging sets mid-workout
- New **More** hub consolidates Coach, Programs, Progress, Metrics, History, Partners, and Settings; Schedule/Nutrition/Trends tabs are now deep-linkable via `?tab=`

---

## [2.1.0] — 2026-06-11

### Visual Refresh
- New color palette, typography, and a redesigned dashboard, cards, and progress rings — the first pass toward the full Kinetic rebrand
- Emoji icons replaced with a consistent icon set app-wide

### Français / French Language Support
- Full English/French toggle in Settings → Customisation, including AI coach responses, weekly insights, and program generation

### Your Own AI Connector
- Settings → Claude AI Connector: generate a personal API key and connect your own Claude (claude.ai or Claude Desktop) directly to your fitness data — read logs, workouts, and body metrics; log food and workouts
- New `mcp_api_keys` table (hashed keys, row-level security)

### Workout Logger Improvements
- Sets now autosave individually as you log them, with a save-status indicator, so a crash or accidental close no longer loses progress
- Completed workouts can be reopened and edited; individual set rows can be deleted with one tap
- Saved Meals now has its own tab in the food selector for fast re-logging
- Streak type is now configurable in Settings (Anything / Workouts / Nutrition)

### Fixes
- Fixed iOS push notifications not arriving and a black-screen crash on some TestFlight installs
- Food photo scanning made more reliable — photos are compressed client-side before upload, with a clearer error and retry if scanning still fails
- AI Weekly Insights no longer silently returns empty — timeouts fixed and a visible retry option added
- Fixed logs made after ~8pm landing on the wrong day for some timezones

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
