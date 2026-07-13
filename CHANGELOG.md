# Changelog

All notable changes to Life Logger are documented here.

## [Unreleased]

## [2.1.0] — 2026-07-10

### Rebrand & Design Refresh
- Full UI/UX refresh aligning the app with the nathandavie.com brand: Sora + Inter typography (replacing Playfair Display serif), deep ink navy `#060a13`, gold `#e0b35a`, blue `#5b9cf6`, flat solid surfaces
- New shared UI primitives: `Card`, `Button`, `Input` / `Select` / `Textarea`, `ProgressRing`, `StatTile`
- Dashboard redesigned: Today hero with progress rings, streak pill, level + next-workout bento tiles, compact coach card, 3-up quick actions including a barcode deep link
- Bottom nav raised with a center "+" log button; destinations renamed Home / Train / Eat / Trends
- Emoji chrome replaced with Lucide icons app-wide (achievement/celebration emoji kept as content); motion respects `prefers-reduced-motion`
- App icons, splash screens, and PWA icons regenerated in the new palette

### Multi-language Support (English / French)
- Language toggle in Settings → Customisation, backed by a `localStorage`-persisted React context (no URL-segment routing, so it keeps working in the native/Capacitor app)
- Full translation coverage: navigation, dashboard, daily log, settings, onboarding, and all section components
- AI features now respond in the selected language: Smart Coach, AI Weekly Analysis, workout chat, goal wizard, and workout recommendations

### AI Coach MCP Tools (training plans, scheduling & meal planning)
- New MCP tools so an AI coach can push training plans, not just log activity: `save_workout_template` (upsert by name, with a shortened `fallback_exercises` version), `get_workout_templates`, `schedule_workout` (single date or recurring weekday pattern, capped at 90 days), `get_schedule` (derived planned / completed / missed / skipped statuses), `update_scheduled_workout` (move date, swap template, switch to fallback, skip with reason)
- `log_workout` extended with strength logging (`exercises` with per-set reps and weight) and automatic completion of the day's scheduled entry
- Coach-scheduled workouts use the existing `scheduled_workouts` / `workout_templates` tables, so they appear on the dashboard and Schedule page with no UI changes
- Migration: `coach_scheduling_migration.sql` (template fallbacks, skip reasons, fallback flag on scheduled entries)
- Meal-planning counterpart: `save_meal` (upsert by name), `get_meals`, `plan_meal` (saved meal or ad-hoc, single date or recurring, capped at 90 days, configurable meal slots), `get_meal_plan` (per-day entries plus planned-vs-logged macro totals), `update_planned_meal` (move, swap meal, skip with reason)
- `log_food` extended with `planned_meal_id` (copies plan macros as defaults, any field can be overridden with what was actually eaten, marks the entry logged) and a new `log_planned_meal` convenience tool for one-call "ate what I planned"
- Planned meals never count toward `get_daily_logs` totals until logged — no double counting
- New dedicated tables `mcp_meals` / `planned_meals` (kept separate from the existing pantry/AI-meal-generator tables, which model an unrelated feature)
- Dashboard: new "Today's meal plan" card showing today's planned meals with slot/time and a one-tap "Log as planned" action (hidden entirely on days with no coach plan)
- Meal Planner page: coach-pushed meals now render inline — a "Coach Plan" section on the Today tab and per-day rows in the Week view, each with a one-tap "Log as planned" action and logged/skipped status
- Starting a scheduled workout from inside the app now correctly marks the schedule entry complete on finish; `get_schedule` also self-heals stale entries by matching same-day completed sessions before reporting them missed
- Migration: `coach_meal_planning_migration.sql`
- Tool reference: `docs/mcp-tools.md`

### Personal Claude MCP Connector
- New "Claude AI Connector" section in Settings: generate a personal API key and connect your own Claude.ai account directly to your fitness data
- `POST /api/mcp` — MCP 2024-11-05 JSON-RPC server exposing 7 tools: read (`get_daily_logs`, `get_workouts`, `get_body_metrics`, `get_user_profile`) and write (`log_food`, `log_workout`, `update_daily_log`)
- Keys are hashed at rest (`mcp_api_keys` table, RLS-enabled); generate, copy, and revoke from Settings

### Workout Logger Reliability
- Autosave: every set toggle now writes to the database immediately, so progress survives navigation or a crash; a "Saving… / Saved / Save failed" chip shows next to the timer
- Completed workouts can be edited after the fact
- Delete button on individual set rows, with ids re-indexed so autosave stays in sync

### Nutrition & AI Fixes
- Fixed inconsistent food photo scans caused by oversized camera images — photos are now compressed client-side (max 1024px, 82% JPEG) before upload, with a "Processing image…" indicator
- Restored direct camera capture and added a separate Gallery picker in FoodCamera
- Fixed AI Weekly Analysis timing out or returning no results (function duration limit, log windowing, more robust JSON parsing and error/retry UI)

### Native App Fixes (iOS)
- Fixed TestFlight black screen caused by `ViewController.swift` never being registered in the Xcode project
- Fixed iOS push notifications: switched to the production APNs entitlement and added direct APNs delivery for iOS tokens (FCM only ever worked for Android)

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
