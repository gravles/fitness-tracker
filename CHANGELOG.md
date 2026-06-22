# Changelog

All notable changes to Life Logger are documented here.

## [3.0.0] — 2026-06-22

### Full UI / UX Rebrand
- New design language matching nathandavie.com: Sora + Inter typography, deep ink navy `#060a13`, gold `#e0b35a`, blue `#5b9cf6`
- Dashboard redesigned: animated progress rings for daily goals, streak pill, next-workout bento tile, compact coach card
- Bottom nav redesigned: raised center "+" log button; tabs renamed to Home / Train / Eat / Trends
- Lucide icons replace emoji chrome across 25+ components (celebration emoji preserved as content)
- Staggered card entrances, animated ring fills, count-up numerals; respects `prefers-reduced-motion`
- App icons, splash screens, and PWA icons regenerated in new palette
- Pinch-to-zoom re-enabled

### English / French Language Support
- Full EN/FR i18n system via a custom `LanguageProvider` React context with `localStorage` persistence
- Covers all core UI: navigation, dashboard, daily log, settings, onboarding, and all section components
- Switch language in Settings → Customisation
- Language preference passed to all Claude AI calls (coaching, weekly insights, workout chat, goal wizard, recommendations)

### Claude MCP Connector
- Connect Claude.ai directly to your Life Logger data via a personal API key
- Seven MCP tools: `get_daily_logs`, `get_workouts`, `get_body_metrics`, `get_user_profile`, `log_food`, `log_workout`, `update_daily_log`
- Generate, copy, and revoke API keys from Settings → Claude AI Connector
- Compliant with MCP 2024-11-05 JSON-RPC spec; CORS-enabled for Claude.ai

### Workout Autosave & Edit Completed Workouts
- Every set toggle (complete / uncomplete) writes to the database immediately — progress survives crashes and navigation
- Lazy workout creation: DB record created on the first completed set; crash-resume reloads from DB
- "Saving… / Saved / Save failed" status chip shown next to the timer during a session
- "Edit Sets" button on any completed workout card opens the full logger for set-level corrections
- Delete individual sets with a red X button directly on each set row

### Bug Fixes & Polish
- iOS push notifications: switched `aps-environment` entitlement to production; direct APNs HTTP/2 delivery (no Firebase dependency)
- iOS black screen on TestFlight: registered `ViewController.swift` in `project.pbxproj`
- XP bar now uses the correct exponential curve (matches the widget and streak endpoints)
- Streak type picker added to Settings (any log / workout only / nutrition only)
- Saved Meals tab added to the food selector
- AI Weekly Insights: robust JSON parsing with regex extraction; 60-second Vercel timeout; retry UI

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
