# Changelog

All notable changes to Kinetic (formerly Life Logger) are documented here.

## [2.7.0] — 2026-07-28

### Menu Scanning & Sync Fixes
- Menu scanner accepts PDF menus (not just photos): validated, capped at 3 MB, read through the same AI recommendation flow as a camera capture
- Fixed a stale "Standard Drinks" counter on the Eat day-details card — drinks logged from another device, the watch, or the morning check-in now show up without a manual reload

## [2.6.0] — 2026-07-22

### Kinetic Rebrand
- App renamed from Life Logger to **Kinetic** — updated branding across the PWA manifest, app metadata, logomark, and native Capacitor app name
- New information architecture: floating glass pill nav with a gold capture FAB; Home rebuilt as a bento grid (nutrition rings, weight/movement sparklines, up-next card, 7-day habit strip); Eat (`/nutrition`) is now the single food-logging surface with inline voice/photo/barcode/menu-scan/favorites capture and a timeline view; the old `/log` route redirects, preserving existing deep links and PWA shortcuts
- Native voice logging fixed on Android — the WebView's Web Speech API never actually worked; now uses a native speech-recognition plugin
- Android release hardening: release builds fail fast if `google-services.json` is missing, versioned bumped for the Play release train

## [2.5.0] — 2026-07-19

### Supplement & Medication Tracking
- New `/supplements` page — Today / My Stack / History tabs, adherence percentage, an "Rx" badge for medications, and a "not medical advice" disclaimer
- Schedule builder: times of day, weekday recurrence, an end date, and optional reminders
- Dashboard "Today's supplements" card with tap-to-take / skip / undo
- Push reminders fire in the same cron as workout reminders, deduped so each dose only reminds once
- AI Coach MCP tools (`save_supplement`, `get_supplements`, `schedule_supplement`, `log_supplement`, `get_supplement_schedule`, `update_scheduled_supplement`) — instructed to record only what the user states, never to suggest doses or alter a schedule on its own
- Migration: `supplement_tracking_migration.sql`

## [2.4.0] — 2026-07-19

### Watch Companion App (WearOS)
- Native Kotlin/Compose companion app for WearOS (Galaxy Watch), paired from Settings → Pair a Device — the watch generates its own API key locally and only a hash ever leaves the device
- Live workout sessions on-wrist: workout picker (schedule or saved templates), per-set logging with crown input, haptic rest-timer countdown, heart-rate capture recorded on the logged session
- Voice food logging: says what you ate, transcribes, confirms, logs — no phone needed
- Today tile with dual calorie/protein rings, one-tap "food" and "lift" shortcuts, and watch-face complications (calories remaining, quick-log shortcuts)
- Progressive-overload suggestions: the watch pre-fills each exercise's weight from your last session and nudges it up once you've hit the top of your rep range on every set; half-pound (2.5 lb) weight increments
- Crash-proof sessions: an in-progress workout is saved after every completed set and resumes automatically if the watch app is killed mid-session
- Morning check-in and hands-free "say set" voice logging directly on the watch

### Readiness Score
- New daily 0–100 readiness score (primed / ready / steady / recovery) computed from sleep, energy, alcohol, and recent training load — no wearable required
- Readiness card on the dashboard with a score ring, recommendation, and component breakdown; also shown color-coded on the watch
- Morning check-in modal (sleep / energy / drinks, skippable, once a day) feeds the score on both phone and watch

### Health Connect Integration (Android)
- Daily steps and resting heart rate sync automatically via Health Connect; resting HR vs. baseline feeds into the readiness score
- Sleep sync from a Galaxy Watch via Samsung Health → Health Connect, replacing the manual sleep-quality rating with tracked duration when available

### Reliability & Security
- Fixed a multi-device data-loss bug: logging from the watch and phone at the same time could silently wipe food items logged elsewhere — writes are now merged instead of overwritten
- Fixed portion quantities (e.g. "half a brick of cream cheese") being ignored by watch/coach-logged entries, which was resetting daily nutrition totals to unscaled values
- All AI API routes (food analysis, coach chat, goal generation, menu scan, weekly insights, workout chat, intent processing) now require authentication — several were previously reachable without a login
- MCP "today" now resolves in the user's own timezone instead of the server's UTC clock, so evening logs no longer land on the wrong day

### Play Store Release Prep
- Public privacy-policy page and a health-data declaration checklist for Play Console's Data Safety form

## [2.3.0] — 2026-07-15

### UI/UX Audit
- Visible error states: a shared retry-capable error card replaces silent load failures across every page
- Accessible modals: proper dialog semantics, focus trap, Escape-to-close, and body scroll lock rolled out to all 16 dialogs in the app
- Gym ergonomics: larger set-complete toggles, a decimal-friendly weight keypad, numeric keypads throughout
- WCAG AA contrast fixes for muted text and gold text in both themes
- Design-system enforcement: a canonical brand button variant, token cleanup, de-duplicated dark-mode styling, emoji UI replaced with icons
- Navigation: new `/more` hub surfacing Coach, Programs, Progress Photos, Body Metrics, History, Partners, Settings, and Help

## [2.2.0] — 2026-07-14

### Workout Partners
- Invite a friend who uses the app by email and connect as mutual workout partners; invites to non-users send a signup email and auto-link when they join
- Partner hub at `/partner`: pending invites, partner cards, shared-items inbox, encouragements feed, and challenges
- Per-partner dashboard: weekly stats (streak, days logged, workouts, protein-goal days, avg sleep, level) and their latest note
- Privacy is per-partnership and per-person: choose what *you* share — Summary (weekly stats only, default) or Full activity (recent workouts and nutrition too); pause or end a partnership anytime
- Existing email-only accountability partners (weekly summary email) keep working unchanged
- Migration: `partner_migration.sql`

### Encouragement Nudges
- One-tap encouragement (💪 🔥 👏) sends a push notification to your partner (rate-limited to one per hour per partnership)
- Streak-at-risk alerts: if your partner logged yesterday but nothing today by 8pm their time, you get a push so you can cheer them on

### Share Workouts & Meals
- "Send to partner" on workout templates (Schedule page) and saved meals (Nutrition page)
- Shares are snapshots with an optional message; the recipient gets a push and a one-tap "Save to my library" in their partner inbox

### Group Challenges
- Create challenges with 2–8 people from your active partners: logging streak, protein-goal days, or workout count, over a chosen date window
- Anonymous-by-default leaderboard ("Athlete A/B/…") with progress bars; reveal names optionally
- Daily progress updates with milestone and final-results push notifications

### Progress Photos
- Choose existing photos from your phone's gallery ("Choose from Gallery") alongside the camera option
- Photos are downscaled and converted to JPEG client-side before upload, so large iPhone HEIC originals upload fast and render everywhere

## [2.1.0] — 2026-07-10

### Visual Refresh & Design Tokens
- UI refresh aligning the app with the nathandavie.com brand: Sora + Inter typography (replacing the Playfair Display serif), deep ink navy `#060a13`, gold `#e0b35a`, blue `#5b9cf6`, flat solid surfaces
- New shared UI primitives: `Card`, `Button`, `Input` / `Select` / `Textarea`, `ProgressRing`, `StatTile`
- Dashboard redesigned: Today hero with progress rings, streak pill, level + next-workout bento tiles, compact coach card, 3-up quick actions including a barcode deep link
- Bottom nav raised with a center "+" log button; destinations renamed Home / Train / Eat / Trends
- Emoji chrome replaced with Lucide icons app-wide (achievement/celebration emoji kept as content)

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
