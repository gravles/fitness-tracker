# Changelog

All notable changes to Life Logger are documented here.

## [2.1.0] — 2026-06-15

### Design Refresh
- Full UI/UX rebrand aligned with the nathandavie.com design language
- Typography: Sora (display) + Inter (body), replacing Playfair Display
- Colour palette: deep ink navy `#060a13`, gold `#e0b35a`, blue `#5b9cf6`, flat solid surfaces
- New shared UI primitives: `Card`, `Button`, `Input/Select/Textarea`, `ProgressRing`, `StatTile`
- Dashboard redesigned: "Today Hero" with animated progress rings, streak pill, next-workout bento tile, compact coach card, and 3-up quick-action buttons
- Bottom nav: raised centre "+" log button; tabs now Home / Train / Eat / Trends
- Emoji chrome replaced with Lucide icons throughout; celebration emoji kept as content
- Staggered card entrances, animated ring fills, count-up numerals; respects `prefers-reduced-motion`
- PWA and native app icons/splash screens regenerated in new palette

### English / French Language Support
- Full EN/FR i18n via a custom `LanguageProvider` React context with `localStorage` persistence
- Covers all core UI: navigation, dashboard, daily log, settings, onboarding, and all section components
- Language preference also forwarded to every Claude AI API call so coaching responses match your language
- Switch anytime from **Settings → Customisation**

### Claude AI Connector (MCP)
- New per-account MCP server at `/api/mcp` (JSON-RPC 2024-11-05 spec)
- 7 tools: `get_daily_logs`, `get_workouts`, `get_body_metrics`, `get_user_profile` (read) + `log_food`, `log_workout`, `update_daily_log` (write)
- Authenticate Claude.ai with a personal API key; keys can be generated, listed, and revoked from **Settings → Claude AI Connector**
- CORS-enabled so the MCP server works directly from claude.ai

### Workout Improvements
- **Autosave per set**: every set completion is written to the DB immediately — progress survives navigation or crashes
- **Edit completed workouts**: "Edit Sets" button on each workout card reopens the full logger for any past session
- **Delete individual sets**: trash icon on each set row in the workout logger
- **Autosave status chip**: "Saving…" / "Saved" / "Save failed" shown next to the timer in the workout header

### Camera & Food Logging
- FoodCamera now offers **Gallery** as an alternative to the live camera shutter
- Food photo scan reliability improved

### Bug Fixes
- iOS push notifications: APNs production entitlement corrected; direct APNs delivery restored
- iOS black screen on launch fixed (ViewController now properly registered in Xcode project)
- AI Weekly Insights: JSON parsing hardened; resolved "no results" regression
- Habits column name corrected in MCP daily-logs query

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
