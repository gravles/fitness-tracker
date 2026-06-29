# Changelog

All notable changes to Life Logger are documented here.

## [2.1.0] — 2026-06-29

### New Look & Feel — Brand Refresh
- Completely redesigned UI aligned with the nathandavie.com design language
- New typography: Sora (display) + Inter (body), replacing Playfair Display
- New colour palette: deep ink navy `#060a13`, gold `#e0b35a`, blue `#5b9cf6`
- Redesigned dashboard: Today Hero with progress rings, streak pill, level tile, next-workout bento, compact coach card, and 3-up quick actions
- Bottom nav redesign: raised centre "+" log button; tabs renamed to Home / Train / Eat / Trends
- Emoji chrome replaced with Lucide icons throughout (25+ files)
- Animated progress rings, count-up numerals, and staggered card entrances (respects `prefers-reduced-motion`)
- App icons, splash screens, and PWA icons regenerated in new palette

### English / French Language Support
- Full EN/FR bilingual UI via a custom `LanguageProvider` React context
- Covers navigation, dashboard, daily log, settings, onboarding, and all section components
- Language preference persisted to `localStorage`; no URL-segment routing (works in Capacitor / PWA)
- Toggle under Settings → Customisation

### Claude AI Connector (MCP)
- Connect Claude.ai directly to your Life Logger data via the Model Context Protocol
- 7 built-in tools: `get_daily_logs`, `get_workouts`, `get_body_metrics`, `get_user_profile`, `log_food`, `log_workout`, `update_daily_log`
- Per-account API keys stored with hashed values in Supabase (RLS-protected)
- Generate, copy, and revoke keys in Settings → Claude AI Connector
- Ask Claude "what did I eat this week?" or "log a 5 km run for me" directly from Claude.ai

### Workout Logger Improvements
- **Autosave per set**: every set completion writes to the database immediately — progress survives crashes and navigation
- **Lazy workout creation**: the DB record is created on the first completed set; crash-resume reloads from the DB
- **Edit completed workouts**: "Edit Sets" button on each workout card in the Movement log reopens the session in the full logger for set-level changes
- **Delete individual sets**: red × button on each set row removes it instantly
- Autosave status chip ("Saving…" / "Saved" / "Save failed") shown in the workout header

### Food Camera
- Restored direct camera capture button (uses `capture="environment"` for instant rear-camera launch)
- Added separate "Gallery" button to pick from the photo library
- Both paths run through the canvas compressor to keep image size under the API limit

### Bug Fixes
- iOS black screen on launch resolved (ViewController registration in Xcode project)
- iOS push notifications fixed: APNs production entitlement + direct APNs delivery path
- Food photo scan consistency issues resolved
- AI Weekly Analysis returning no results — fixed
- Weekly Insights JSON parsing made more robust
- MCP daily logs query: corrected habits column name

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
