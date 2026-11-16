# Changelog

All notable changes to Life Logger are documented here.

## [2.5.0] — 2026-10-14

### Share Meals & Activities with Your Partner
- Send a logged meal or activity to a workout partner; they copy it into their own log instead of re-entering it
- Share after the fact: "Share with partner" on food in the Eat timeline, and a share button on logged workouts (Eat timeline and Workout hub)
- Tag while logging: "Did this with…" partner chips on the custom workout form, and an "Eating with" toggle on the Eat capture bar that shares everything logged while it is on
- Partner inbox: new "Log it" action with a review step — pick your own portion for meals (quantity multiplier), your own duration and optional calories for activities; logs to the day it happened by default
- Duplicate guard: warns if a same-kind workout is already logged that day (e.g. synced from Strava)
- Privacy: activity shares carry type, duration, intensity, distance, elevation, and notes only — heart rate, calories burned, and Strava ids stay with the sender
- Migration: `partner_log_share_migration.sql` (until it is applied, sharing these types shows a "not enabled on the server yet" message; nothing else is affected)

### Starting Weight
- Settings → My Targets: new Starting weight card showing your first weigh-in, with a reset button to correct it (in your unit) or remove it
- One-tap fix offered when the first weigh-in looks like it was saved in kg by the onboarding bug below

### PDF Menu Upload
- Menu Scanner: new "Upload PDF Menu" button alongside the camera — analyse a restaurant's PDF menu (up to 3 MB) for high-protein picks

### Fixes
- Onboarding saved the first weigh-in in kg while the rest of the app uses lbs, skewing weight trends (a 180 lb entry became 81.6); it now saves lbs
- Eat day-details card: drink count now re-syncs when drinks are added elsewhere (voice log, morning check-in, another device) without a page reload

---

## [2.4.0] — 2026-07-22

### Kinetic Redesign
- Rebrand: Life Logger is now **Kinetic** — new name, K logomark, metadata, and app manifest
- Floating glass pill navigation with a context-aware gold action button and capture sheet
- Bento Home: nutrition rings, weight / movement sparklines, habit strip, coach banner, and wellness check-in; XP hidden behind a toggle in More
- Eat (`/nutrition`) is now the food logger: inline voice / snap / barcode / type / menu / favorites capture, a timeline with skippable planned meals, date and time editing with a proportional macro preview, and a day-details card
- Meal Planner moved to `/nutrition/planner` ("Plan" pill in the Eat header)
- Workout hub restyled with today's activity at the top; active session gets set pills, ghost values, a rest bar, and a log-set button
- `/log` dissolved into the tabs — old deep links redirect
- New More hub: Coach, Programs, Progress, Metrics, History, Partners, Settings, Help
- Native voice logging via on-device speech recognition (voice never worked in the Android WebView before) — requires the updated native app
- Withings sync button surfaced in the Trends header

### Workout Partners & Group Challenges
- Mutual workout partners: invite by email, both sides accept; per-user share level (summary vs full), pause or end at any time
- Partner hub (`/partner`) and per-partner dashboard with weekly stats, streak, and one-tap encouragement pushes
- Send workout templates and saved meals to a partner; shared-items inbox with one-tap save to your library
- Streak-at-risk partner nudge (20:00 local) and group challenges for 2–8 members with an anonymous-by-default leaderboard
- Existing email-only accountability partners keep working unchanged
- Migration: `partner_migration.sql`

### Readiness Score & Morning Check-in
- Transparent 0–100 readiness score from sleep, yesterday's energy, alcohol, and acute:chronic training load — no wearable required; bands: primed / ready / steady / recovery, each with a training recommendation
- Dashboard readiness card with score ring, recommendation, and a "why?" component breakdown
- Morning check-in: first dashboard visit of the day prompts for sleep, energy, and drinks last night (skippable)
- Resting-heart-rate component compares today against your 28-day baseline when Health Connect data is available
- New `get_readiness` MCP tool

### Health Connect (Android)
- Sleep sync from Health Connect: tracked sleep duration replaces the manual 1–5 rating in readiness (manual stays as fallback)
- Daily steps and resting heart rate sync on app open; steps shown on the readiness card
- Settings card (Android app only) with connect and sync-now
- Migration: `sleep_records_migration.sql`

### Supplement & Medication Tracking
- `/supplements` page with Today / My Stack / History tabs and adherence %
- Add/edit modal with a schedule builder (recurring days, multiple times per day)
- Per-dose push reminders; "Today's doses" card on the dashboard
- Six MCP coach tools: `save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement`
- Tracking only — the app never suggests doses or medication changes
- Migration: `supplement_tracking_migration.sql`

### Wear OS Companion App
- Standalone Wear OS app (`android/wear`) paired via a short code (Settings → Pair a Device); only a hash of the device key ever leaves the watch
- Today screen with concentric calories / protein rings, readiness, and next scheduled workout
- Live workout sessions: per-set reps / weight steppers with crown support (2.5 lb steps), rest-timer ring with haptics, heart-rate capture, crash-proof drafts that resume after the app is killed
- Voice food logging with a confirmation card, and voice set logging ("185 for 8")
- Morning check-in on the watch
- Today tile (dual rings + one-tap food / lift actions), calories-remaining complication, and food / lift shortcut complications
- Design doc: `docs/watch-companion-design.md`

### Progressive Overload
- Workout templates and schedule entries now carry last weight / reps and a suggested weight (double progression over the last 90 days: hit the top of the rep range on every set → +5 lbs)
- The watch pre-fills each exercise with the suggestion

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

### Progress Photos
- Choose existing photos from the gallery, not just the camera
- Images are downscaled and re-encoded before upload (fixes multi-MB HEIC originals that some browsers could not display)

### Reliability, Accessibility & Security
- Multi-device food logs are merged instead of overwritten — a stale phone or watch can no longer wipe items logged elsewhere
- Portion quantities respected in every daily-total computation; voice logging estimates one typical serving unless you state a quantity
- MCP "today" defaults resolve in your timezone (evening logs no longer land on tomorrow)
- Load-error cards with retry on every page, instead of misleading empty states
- Accessible modals (focus trap, Escape, scroll lock), larger gym touch targets, WCAG AA contrast in both themes
- All AI API routes now require authentication
- Public privacy policy at `/privacy`; Play release checklist in `docs/play-release-checklist.md`

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
