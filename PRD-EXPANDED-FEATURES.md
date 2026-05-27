# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-05-27)  
**Status:** Living document — v2.0 shipped; outstanding items and new ideas below

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (as of v2.0.0 — 2026-05-24)

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ AI-assisted, voice, camera, barcode |
| Workout tracking (exercises, sets, reps) | ✅ Full session tracker, PR toasts |
| 12-week AI training programs | ✅ Phases, calendar, session auto-load |
| Progressive overload | ✅ 1RM estimates, session targets |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, Supabase-persisted history |
| Push notifications | ✅ VAPID + APNs + FCM; workout reminders |
| Strava sync | ✅ OAuth, automatic sync |
| Withings sync | ✅ OAuth, body composition auto-sync |
| Oura sync | ✅ OAuth, readiness + sleep data pulled |
| Goal Wizard | ✅ Entry point via Settings |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Weight history, body comp, imperial/metric |
| Nutrition planning | ✅ Pantry, AI meal plans, saved meals |
| Accountability partners | ✅ Email invites + weekly summary email |
| Native iOS & Android apps | ✅ Capacitor, App Store + Play Store |
| Calendar feed | ✅ iCal / webcal |
| Dark / light / system theme | ✅ |
| Onboarding flow | ✅ Name, DOB, height, weight, goal |
| AI weekly insights | ✅ Modal with narrative analysis |
| **Correlation engine** | 🔴 **Not started — highest priority gap** |
| **Readiness score** | 🔴 **Oura data syncs, but no calculated score or UI** |
| **Group challenges** | 🔴 Not started (partners-only accountability) |
| Apple HealthKit read/write | ⚠️ Native shell exists; HealthKit not yet wired |
| Social workout sharing | 🔴 Not started |

---

## The Six Pillars — Status Update

| Pillar | Status |
|---|---|
| 1. Correlation Engine & Insight Feed | 🔴 Not built |
| 2. Intelligent Nutrition Planning | ✅ Shipped in v1.3 |
| 3. Periodisation & Progressive Overload | ✅ Shipped in v1.5 |
| 4. Recovery & Readiness Score | ⚠️ Oura sync done; calculated score not built |
| 5. Accountability Layer | ⚠️ Partners done; Group Challenges not built |
| 6. Health Platform Integrations | ⚠️ Withings + Oura + Strava done; HealthKit pending |

Plus an **appendix of quick wins** — bugs and small features that could ship in a day each.

**The single most important outstanding item from the original PRD is Pillar 1 (Correlation Engine).** It is the feature that makes users feel *understood* rather than just *tracked*, and all the data it needs already exists.

---

---

## Pillar 1 — Correlation Engine & Insight Feed

### The Problem

The app captures sleep quality, energy level, stress, movement, protein, alcohol, and more every day. But right now that data just lives in charts. The user has to mentally connect the dots themselves: *"Did I sleep badly because I drank last night? Does my energy crash on days I skip breakfast? Do I perform better when I train in the morning?"*

A correlation engine answers these questions automatically.

### What It Does

**Daily Insight Card** (on the dashboard, below Smart Coach)  
A single, specific, data-backed insight that refreshes weekly. Examples:
- *"Your energy is 34% higher on days you hit your protein goal. You've hit it 4 of the last 7 days."*
- *"You sleep an average of 0.8 points worse after 2+ alcohol drinks. You've had drinks 3 nights this week."*
- *"Your best workout days follow nights with 7+ hours of sleep. Tonight's your chance to set that up."*

**Weekly Pattern Report** (replaces/augments AI Weekly Analysis)  
Instead of generic encouragement, the weekly modal shows 3–5 *discovered correlations* from the user's own data, ranked by statistical strength. Presented as cards with a mini chart.

**"Why do I feel this way?" Quick Ask**  
A button on the dashboard that lets users type *"Why was my energy so low on Tuesday?"* and gets an AI answer grounded in their actual data from that day and the 48 hours prior.

### Data Requirements

No new tables needed. The correlation engine runs as a server-side function against existing `daily_logs`. A new `insights_cache` table stores computed correlations so they don't regenerate on every page load.

```sql
CREATE TABLE insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,  -- 'correlation', 'trend', 'anomaly'
  insight_key text NOT NULL,   -- e.g. 'alcohol_vs_sleep'
  payload jsonb NOT NULL,      -- the full insight object
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  UNIQUE(user_id, insight_key)
);
```

### How It Works Technically

1. A Vercel cron job runs nightly (daily, within Hobby plan limits) calling `/api/insights/generate`
2. For each user with >14 days of data, it fetches all daily logs and runs a lightweight Pearson correlation across key variable pairs:
   - `alcohol_drinks` ↔ `sleep_quality`
   - `protein_grams ≥ target` ↔ `energy_level`
   - `movement_completed` ↔ `motivation_level` (next day)
   - `sleep_quality` ↔ `movement_duration` (next day)
   - `stress_level` ↔ `alcohol_drinks`
   - `calories` ↔ `energy_level`
3. Correlations above r=0.3 (moderate) get stored in `insights_cache` with natural-language descriptions generated by Claude Haiku
4. The dashboard fetches from `insights_cache` — zero latency, no AI call on page load

### The "Why" Quick Ask — AI Implementation

```
System: You are a personal health analyst. The user's data for {date} and the 48 hours prior is:
[structured JSON of relevant log fields]

Correlations we've found in their historical data:
[top 3 from insights_cache]

Answer the user's question using only their data. Be specific with numbers. Max 3 sentences.
```

### UI Sketch

```
┌─────────────────────────────────────────────────────┐
│  📊 This Week's Pattern                              │
│                                                      │
│  Your energy is 38% higher on days you hit your     │
│  protein goal (tracked across 47 days of data).     │
│                                                      │
│  You've hit it 5/7 days this week. ↑ Good week.    │
│                                    [See all insights]│
└─────────────────────────────────────────────────────┘
```

### Why This Matters

This is the feature that makes users feel *understood* rather than just *tracked*. It's the difference between a logbook and a coach. Every other feature in the app becomes more valuable once users understand the "why" behind their data.

---

---

## Pillar 2 — Intelligent Nutrition Planning

### The Problem

The app is excellent at logging food *after* you eat it. But most nutrition failure happens *before* — users don't know what to eat, default to whatever is convenient, and then feel guilty logging it. Closing the loop from tracking → planning would be a step-change in nutritional outcomes.

### What It Does

**Weekly Meal Planner**  
A simple Monday–Sunday grid where each cell is a meal (breakfast, lunch, dinner, snack). Users can:
- Fill manually
- Ask AI to suggest meals for the week based on their protein target, calorie target, food preferences (derived from Favourites), and any constraints ("I don't eat red meat", "I'm on a budget")
- One-tap to add a planned meal to that day's log when they eat it

**Smart Grocery List**  
From a filled meal plan, generate a consolidated grocery list grouped by category (Protein, Produce, Dairy, etc.) with quantities. Exportable as plain text or shareable link.

**Meal Templates / Saved Meals**  
Currently `favorite_foods` stores individual ingredients. Add `saved_meals` — a collection of food items grouped as a meal (e.g. "Post-workout shake": 2 scoops protein powder + 1 banana + 200ml oat milk = 450 cal / 45g protein). One tap logs the whole meal.

**Macro Cycling Recommendations**  
AI suggests: eat more carbs on workout days, eat at maintenance or slight deficit on rest days. Shows a weekly macro plan overlay on the calendar.

### New Data Model

```sql
-- Meal plans
CREATE TABLE meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,           -- Monday of the week
  meals jsonb NOT NULL DEFAULT '{}',  -- { "2026-05-20_breakfast": [...food_items] }
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Saved meal bundles
CREATE TABLE saved_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  food_items jsonb NOT NULL,  -- same structure as daily_logs.food_items
  total_calories int,
  total_protein int,
  total_carbs int,
  total_fat int,
  tags text[],               -- ['breakfast', 'post-workout', 'quick']
  use_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

### AI Meal Planning Prompt Strategy

```
System: You are a sports nutritionist. Generate a 7-day meal plan for a user with:
- Daily protein target: {target_protein}g
- Daily calorie target: {target_calories} kcal  
- Favourite foods: {top_10_favorites_by_frequency}
- Dietary notes: {user_provided_constraints}
- Training days this week: {scheduled_workout_dates}

Rules:
- Workout days: +15% carbs, hit protein target exactly
- Rest days: -10% calories, keep protein target
- Use favourite foods where possible for compliance
- Return JSON: { "2026-05-20": { "breakfast": [{name, calories, protein, carbs, fat}], "lunch": [...], "dinner": [...] } }
```

### New Routes

- `GET /api/nutrition/meal-plan?week=2026-05-20` — fetch or generate
- `POST /api/nutrition/meal-plan` — save plan
- `POST /api/nutrition/grocery-list` — generate from plan
- `POST /api/nutrition/saved-meals` — save a meal bundle
- `GET /api/nutrition/saved-meals` — fetch user's saved meals

### New Page: `/nutrition`

A dedicated Nutrition section in the bottom nav (replacing or complementing the current Log button). Three tabs:
1. **Today** — current day's log summary with macro rings (moved from DailyGoalTracker)
2. **Plan** — weekly meal planner grid
3. **Library** — saved meals + favourite foods

### Why This Matters

Logging is reactive. Planning is proactive. Users who plan their meals have 3× better adherence to macro targets. This feature takes the app from "what did I eat?" to "what should I eat?" — a fundamentally different and more valuable question.

---

---

## Pillar 3 — Periodisation & Progressive Overload Engine

### The Problem

The workout tracker records every exercise, set, weight, and rep. But it doesn't *do anything* with that data except show a history. A user who has been doing 3×10 bench press at 60kg for 8 weeks doesn't get any signal that they should progress. Progressive overload — consistently adding load or volume over time — is the single most important principle in strength training, and right now the app ignores it.

### What It Does

**Progressive Overload Alerts**  
When a user starts a workout and loads an exercise, show their last session's volume and a suggestion:
- *"Last time: 3×10 @ 60kg. Try 3×10 @ 62.5kg today, or 4×10 @ 60kg."*
- Calculation: if last session's all sets were completed with good form (all checked), suggest +2.5kg or +1 rep

**Volume Tracking Dashboard**  
A "Gains" tab view showing weekly volume per muscle group (sets × reps × weight), plotted over time. Flags muscle groups that haven't been trained in 7+ days. Based on `workout_exercises` and `workout_sets` with a hardcoded muscle-group mapping per exercise.

**12-Week AI Training Programs**  
A full periodisation plan generated by Claude:
- User picks goal: Strength / Hypertrophy / Endurance / Athletic
- AI generates a 12-week programme with progressive weekly volume and intensity targets, broken into phases (accumulation → intensification → deload)
- Each week auto-populates scheduled workouts with specific targets (sets/reps/load as % of estimated 1RM)
- Programme stored in new `training_programs` table; progress tracked week by week

**Estimated 1RM Tracking**  
For each exercise, calculate estimated 1RM using the Epley formula: `weight × (1 + reps/30)`. Track this over time and plot it. Show personal records prominently.

**Deload Detection**  
After 4 consecutive weeks of training, suggest a deload week: reduced volume (50%), same movements. Flag this in the schedule view.

### New Data Model

```sql
-- Training programs
CREATE TABLE training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text NOT NULL,          -- 'strength', 'hypertrophy', 'endurance', 'athletic'
  duration_weeks int NOT NULL,
  phases jsonb NOT NULL,       -- array of phase objects with week ranges
  weeks jsonb NOT NULL,        -- full week-by-week plan
  is_active boolean DEFAULT false,
  current_week int DEFAULT 1,
  started_at date,
  created_at timestamptz DEFAULT now()
);

-- Exercise 1RM history (calculated, not user-entered)
CREATE TABLE exercise_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  estimated_1rm numeric NOT NULL,
  actual_weight numeric NOT NULL,
  actual_reps int NOT NULL,
  recorded_at timestamptz DEFAULT now()
);
```

### Progressive Overload Algorithm

```typescript
function suggestNextSession(
  exerciseName: string,
  history: WorkoutSet[][],  // last 3 sessions
): { weight: number; sets: number; reps: number; reason: string } {
  const lastSession = history[0];
  const allCompleted = lastSession.every(s => s.completed);
  const avgReps = average(lastSession.map(s => s.reps));
  const weight = lastSession[0].weight;
  
  if (allCompleted && avgReps >= targetReps) {
    // Progress load
    return { weight: weight + 2.5, sets: lastSession.length, reps: targetReps, reason: 'All sets completed — time to add weight' };
  } else if (allCompleted && avgReps < targetReps) {
    // Add a set instead
    return { weight, sets: lastSession.length + 1, reps: targetReps, reason: 'Good completion — adding a set' };
  } else {
    // Maintain
    return { weight, sets: lastSession.length, reps: targetReps, reason: 'Aim to complete all sets before progressing' };
  }
}
```

### Why This Matters

Most fitness apps show you what you lifted. Almost none tell you what to lift next. This feature is the most direct path from "tracking" to "results" for strength-focused users. It's also highly defensible — it requires your historical data to be useful, creating strong lock-in.

---

---

## Pillar 4 — Recovery & Readiness Score

### The Problem

Training hard when you're under-recovered leads to injury, plateau, and burnout. But most people have no idea how recovered they actually are. They either train by schedule ("it's Monday, it's chest day") or by feel (which is unreliable under stress or poor sleep). A readiness score gives users a single daily number that synthesises all the signals already being tracked.

### What It Does

**Daily Readiness Score (0–100)**  
Calculated each morning from last night's log and recent history. Shown prominently on the dashboard, colour-coded:
- 80–100 (green): *"Peak — great day to train hard"*
- 60–79 (amber): *"Ready — normal training, listen to your body"*
- 40–59 (orange): *"Moderate — consider a lighter session"*
- 0–39 (red): *"Low — rest or active recovery only"*

**Score Algorithm (no API call, runs client-side)**

| Signal | Weight | Logic |
|---|---|---|
| Sleep quality (last night) | 25% | 5/5 = 100, 1/5 = 0 |
| Stress level (yesterday) | 15% | Inverted: 1/5 stress = 100, 5/5 = 0 |
| Energy level (yesterday) | 20% | 5/5 = 100 |
| Days since last rest day | 15% | 0–2 = 100, 3–4 = 60, 5+ = 20 |
| Alcohol (last 48h) | 15% | 0 drinks = 100, 1 = 75, 2 = 50, 3+ = 20 |
| Workout volume yesterday | 10% | Rest = 100, Light = 80, Moderate = 60, Hard = 30 |

**AI Readiness Explanation**  
Tapping the readiness card opens a bottom sheet with a Claude-generated explanation: *"Your readiness is lower than usual today. You slept 2/5 last night and had 3 drinks yesterday evening. Your body is in recovery mode — a walk or mobility session would serve you better than heavy lifting."*

This explanation is generated once per day and cached.

**HRV Integration (Phase 2)**  
If the user has an Apple Watch, Oura Ring, or Garmin, pull HRV data via Apple Health or the device API and weight it heavily in the readiness score. HRV is the gold standard for recovery measurement. This requires the Apple Health integration (Pillar 6).

**Training Recommendation**  
Below the readiness score, show what type of session is recommended today:
- **Score 80+**: suggested workout from their training program at full intensity
- **Score 60–79**: same workout, reduce volume by 10–15%
- **Score 40–59**: active recovery — a walk, yoga, or mobility session from a built-in library
- **Score <40**: rest — a breathing exercise or journaling prompt

### New Data Model

```sql
CREATE TABLE readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  score int NOT NULL,          -- 0-100
  components jsonb NOT NULL,   -- individual signal scores for transparency
  ai_explanation text,
  recommendation text,
  UNIQUE(user_id, date)
);
```

### Why This Matters

This is the app's most powerful daily hook. Instead of the user having to *decide* whether to train, the app tells them. It makes the app feel like a real personal trainer who knows your body. It also prevents the "overtraining spiral" that causes many people to quit — getting injured or burning out because they didn't know when to back off.

---

---

## Pillar 5 — Accountability Layer

### The Problem

Social pressure is one of the most powerful motivators in behaviour change. But current social fitness apps (Strava, Fitbit) require public profiles, follower counts, and likes — which creates comparison anxiety and performative behaviour. There's a better model: *private accountability partnerships* with one or two people you actually trust.

### What It Does

**Accountability Partners (1–3 people)**  
Invite a friend, partner, or coach by email. They don't need accounts with full access — they receive a weekly summary email with a simple view of your progress.

**Weekly Check-in Summary Email**  
Every Sunday evening, your accountability partner(s) receive a beautifully formatted email (or in-app notification if they have the app):
- Days logged this week: 6/7
- Streak: 14 days
- Protein goal hit: 5/7 days
- Workouts completed: 3
- One line from your weekly note
- A single message area for them to reply with encouragement

**In-App Partner View**  
Partners with accounts can see a lightweight dashboard of your stats (not your full log — privacy-preserving). They see the same summary data that goes in the email.

**Streak Shield from Partner**  
If you're about to break a streak, the app can optionally send your accountability partner a nudge: *"Nathan hasn't logged today — it's 9pm. Send them a message?"* Partners can tap a single-tap encouragement that sends you a push notification.

**Group Challenges (2–8 people)**  
A group of users agree on a shared challenge:
- *"All of us log every day for 30 days"*
- *"Hit protein goal 5 days this week"*
- *"Complete 3 workouts each this week"*

Each challenge has a shared leaderboard (anonymous by default, can reveal names). When anyone in the group hits a milestone, everyone gets a push notification. Challenges are opt-in and time-limited.

### New Data Model

```sql
-- Accountability relationships
CREATE TABLE accountability_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_email text NOT NULL,
  partner_user_id uuid REFERENCES auth.users(id),  -- null if not signed up
  status text DEFAULT 'pending',   -- 'pending', 'active', 'declined'
  share_level text DEFAULT 'summary',  -- 'summary', 'full'
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(user_id, partner_email)
);

-- Group challenges
CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  challenge_type text NOT NULL,    -- 'streak', 'protein_days', 'workout_count'
  target_value int NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE challenge_members (
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  display_name text,               -- anonymous alias if is_anonymous
  progress int DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY(challenge_id, user_id)
);
```

### Implementation Notes

- The weekly summary email uses Resend (or similar) with a React Email template — this is the same tech stack and is free up to 3,000 emails/month
- Partner invites work via email magic link — no password required for partners who just want to cheer you on
- Challenge progress is computed by the nightly cron job alongside insights generation
- Push notifications to partners use the same VAPID push infrastructure already built

### Why This Matters

Accountability is the single biggest predictor of goal adherence in the behaviour change literature. This feature doesn't require building a social network — it's intimate, private, and focused on support rather than performance. It also dramatically increases retention: users who have an accountability partner are far less likely to churn.

---

---

## Pillar 6 — Health Platform Integrations

### The Problem

The app currently sits in a silo. Apple Health, Google Fit, Oura, Withings, and Garmin all have richer data — especially sleep staging, HRV, step counts, and passive calorie burn — that would make every existing feature more accurate. Manual logging is effortful; automatic sync removes friction.

### What It Does

**Apple Health (iOS only)**  
Read:
- Steps (daily), active energy burned
- Heart rate, resting heart rate, HRV (if Apple Watch)
- Sleep analysis (in bed / asleep / awake stages)
- Body weight (syncs to `body_metrics` automatically)
- Workouts (syncs to `workouts` table, de-duplicated against Strava)

Write:
- Log saved workouts back to Health as workout sessions
- Log body weight entries

Implementation: Apple HealthKit API via a React Native wrapper or Next.js Web extension. For a pure PWA, this requires a native shell — either a WKWebView wrapper app submitted to the App Store, or a Capacitor/Expo build. This is the only feature that requires a native app.

**Google Fit / Health Connect (Android)**  
Same read/write scope as Apple Health. Accessible via the Health Connect Android API or Google Fit REST API. Can be implemented in a PWA via `navigator.health` (experimental) or via a Trusted Web Activity (TWA) wrapper on the Play Store.

**Oura Ring**  
Read via OAuth + REST API:
- Readiness score (from Oura's own model)
- Sleep staging (REM, deep, light, awake durations)
- HRV, SpO2, body temperature deviation

Feeds directly into Pillar 4 (Readiness Score), replacing the estimated score with Oura's gold-standard data. This is the highest-signal integration for the recovery use case.

**Withings Smart Scale**  
Read via OAuth + REST API:
- Body weight (kg, lbs, auto-converts)
- Body fat %, muscle mass, bone mass, BMI
- Syncs automatically to `body_metrics` — no manual entry required

**Implementation Priority**

| Integration | Effort | Value | Platform |
|---|---|---|---|
| Withings Smart Scale | Low (REST API) | High (weight logging is annoying manually) | Web/iOS/Android |
| Oura Ring | Medium (OAuth) | Very High (enriches readiness score) | Web |
| Google Health Connect | High (native required) | High | Android |
| Apple HealthKit | Very High (native shell) | Very High | iOS only |

Start with Withings and Oura — both are pure REST APIs accessible from the web without a native app.

### New Routes

- `GET/POST /api/integrations/withings/auth` — OAuth flow
- `POST /api/integrations/withings/sync` — pull latest weight + body comp
- `GET/POST /api/integrations/oura/auth` — OAuth flow
- `GET /api/integrations/oura/readiness` — pull readiness and sleep data

### New Data Model

```sql
-- Extend integrations table (likely already exists for Strava)
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS provider_metadata jsonb;

-- Body composition (extends body_metrics)
ALTER TABLE body_metrics
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric,
  ADD COLUMN IF NOT EXISTS muscle_mass_kg numeric,
  ADD COLUMN IF NOT EXISTS bone_mass_kg numeric,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';  -- 'manual', 'withings', 'apple_health'

-- Sleep staging (from Oura / Apple Health)
CREATE TABLE sleep_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_sleep_min int,
  rem_sleep_min int,
  deep_sleep_min int,
  light_sleep_min int,
  awake_min int,
  sleep_score int,          -- 0-100 from provider, or null if manual
  hrv_avg numeric,
  source text NOT NULL,     -- 'oura', 'apple_health', 'manual'
  raw_data jsonb,
  UNIQUE(user_id, date, source)
);
```

### Why This Matters

Every extra data source makes the correlation engine, readiness score, and AI coaching more accurate. More importantly, *automatic sync removes the single biggest source of churn*: forgetting to log. A user whose weight syncs from their scale, whose workouts come from their watch, and whose sleep comes from their ring only needs to manually log food — cutting the daily effort by 60%.

---

---

## Quick Wins Appendix

These are bugs or small features that could each ship in a day or less. Not a pillar, but worth doing.

### Bugs to Fix

| Issue | Fix |
|---|---|
| `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties |
| Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' | 'log')` variant; let user choose streak type in settings |
| `WorkoutChatModal` vs `/coach` overlap and confusion | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" |
| Body metrics photo = URL text field | Replace with real Supabase Storage upload (same code as Progress Photos) |
| Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern |
| Workout Spotter fails silently on Firefox | Show a browser compatibility warning |
| Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding |

### Small Features

| Feature | Description | Effort |
|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day |

---

## Prioritisation Matrix

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

| Pillar | Impact | Feasibility | Score | Recommended Sequencing |
|---|---|---|---|---|
| Quick Wins | Medium | Very High | ★★★★★ | Ship first (continuous) |
| Readiness Score | Very High | High | ★★★★☆ | Sprint 1 — no new tables, just logic |
| Correlation Engine | Very High | High | ★★★★☆ | Sprint 1 — data already exists |
| Nutrition Planning (Saved Meals only) | High | High | ★★★☆☆ | Sprint 2 — start with saved meals |
| Periodisation (Overload Alerts only) | High | High | ★★★☆☆ | Sprint 2 — active workout is already there |
| Accountability (Partner only, no challenges) | Very High | Medium | ★★★☆☆ | Sprint 3 |
| Withings Integration | High | Medium | ★★★☆☆ | Sprint 3 |
| Oura Integration | High | Medium | ★★★☆☆ | Sprint 3 |
| Nutrition Planning (Full Meal Planner) | High | Low | ★★☆☆☆ | Sprint 4 |
| Group Challenges | Medium | Medium | ★★☆☆☆ | Sprint 4 |
| 12-Week Programs | High | Low | ★★☆☆☆ | Sprint 4 |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Future (requires native app) |

---

## Recommended Sprint 1 (Next 2–4 Weeks)

The highest-ROI work is features that require **no new infrastructure** — they use data that's already being captured and add intelligence on top:

1. **Fix all Quick Win bugs** (1–2 days) — removes friction and builds trust in the app
2. **Readiness Score v1** (2–3 days) — calculated from existing log fields, shows on dashboard
3. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card
4. **Progressive Overload Alerts** (1–2 days) — show last session + suggestion at top of each exercise in active workout

Total estimated effort: 7–11 days of development.

This sprint alone would make the app feel dramatically more intelligent without requiring any new data collection from the user.

---

---

## Post-v2.0 Feature Ideas — Brainstorm

The app is now genuinely strong across tracking, planning, and training. The next phase is about **depth, delight, and defensibility** — features that are hard to copy, create daily habits, and make the app feel irreplaceable. Ideas below are grouped by theme, with rough effort and strategic value noted for each.

---

### Theme A — Complete the Outstanding Gaps First

#### A1. Correlation Engine & Insight Feed *(Critical — Pillar 1)*

Still the highest-priority unbuilt feature. Full spec in Pillar 1 above. Quick summary of the ask:
- Nightly cron runs Pearson correlation across ~8 variable pairs (alcohol↔sleep, protein↔energy, etc.)
- Results cached in `insights_cache` table with Claude Haiku descriptions
- One insight card on the dashboard that refreshes weekly
- "Why was my energy low Tuesday?" quick-ask button that grounds AI answers in the user's actual data

**Effort:** 3–4 days. **Data:** Already captured. **Impact:** Transforms the app from logbook to coach.

---

#### A2. Readiness Score *(High Priority — Pillar 4)*

Oura data syncs but there's no daily score card showing on the dashboard. The algorithm in Pillar 4 requires no new data — just reads from last night's `daily_logs` entry and recent workout history.

**Minimal v1:**
- Calculate score server-side on first dashboard load (or nightly cron + cache)
- Show a large score badge (0–100, colour-coded) on the dashboard home screen above the Smart Coach card
- One-line recommendation: "Peak — great day to train hard" / "Rest — active recovery only"
- If Oura data is present, blend it in (replace the sleep component with Oura's sleep score)

**Effort:** 2 days. **Data:** Already captured. **Impact:** Best daily hook in the app.

---

#### A3. Group Challenges *(Medium Priority — Pillar 5)*

Accountability partners exist but the social layer stops there. Group Challenges extend the same infrastructure:
- Create a challenge (type: streak / protein days / workout count; duration; target)
- Invite 2–7 people via email or share link
- Anonymous-by-default leaderboard (same weekly cron that runs reminder emails)
- Push notification when anyone in your group hits the target
- Badge awarded to all members who complete it

Full data model in Pillar 5. Start with the simplest challenge type (streak) and generalise.

**Effort:** 3–4 days. **Impact:** Strongest retention mechanism in consumer apps.

---

#### A4. Apple HealthKit Read *(Now Feasible — Pillar 6)*

The native Capacitor app ships to the App Store. HealthKit read access just needs to be wired up. Priority reads:

1. **Steps** → auto-populate `daily_logs.movement_duration` (or a dedicated steps field)  
2. **Resting heart rate + HRV** → feed into Readiness Score (replaces estimated components)  
3. **Body weight** → auto-sync to `body_metrics` (eliminates manual weighing for Apple Watch users)  
4. **Active energy burned** → show alongside logged workouts

Write: log completed workouts back to HealthKit as HKWorkout objects.

Requires: Capacitor Health plugin (e.g., `@capacitor-community/health`) + HealthKit entitlement in the iOS project. The Android equivalent (Health Connect) follows the same plugin pattern.

**Effort:** 3–5 days (mostly iOS entitlements + permission UX). **Impact:** Removes the biggest daily friction for Apple Watch users.

---

### Theme B — Depth on Existing Features

#### B1. Video Form Analysis

**The idea:** During a workout session, the user can record a short video (5–10s) of a set and get AI form feedback via Claude Vision.

**How it works:**
- "Analyse my form" button in the active exercise card
- User records with phone camera (already available in native app)
- Video is sent as frames (3–5 key frames extracted client-side) to Claude with a structured prompt: "This is a [exercise name]. Analyse form and give 2–3 specific cues."
- Response shown as a coaching card attached to that set's log entry
- Stored in Supabase Storage alongside the workout record

**What it catches:** Depth on squats, bar path on bench press, back rounding on deadlifts, knee cave, elbow flare.

**What it can't do:** Precise bar-path tracking or frame-by-frame biomechanics. Position it as "form cues from a knowledgeable training partner", not "biomechanics analysis". That expectation is accurate and still very useful.

**Data model:**
```sql
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS form_video_url text;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS form_feedback text;
```

**Effort:** 2–3 days. **Defensibility:** Very high — requires both native camera and AI integration. **Risk:** Claude Vision accuracy varies by lighting and angle; manage expectations in UI.

---

#### B2. AI Workout Debrief

**The idea:** After saving a completed workout, a one-question prompt appears: *"How did that feel? (Energy, effort, any soreness)"* The user can speak or type a free-text response. Claude processes it and adds structured tags to the workout record.

**Value:** Creates a richer signal than just sets/reps. "Felt strong but left knee aching a bit" becomes a data point that:
- Flags to the AI Coach when recommending the next session
- Surfaces in the correlation engine (perceived effort vs. next-day energy)
- Contributes to Readiness Score when a muscle group feels sore

**Data model:**
```sql
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS debrief_text text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS debrief_tags jsonb;
-- e.g. { "perceived_effort": 8, "soreness": ["left_knee"], "mood": "good" }
```

**Effort:** 1 day. **Impact:** Medium individually, high compounding — this data enriches three other features.

---

#### B3. Running & Cardio Analytics

**The problem:** The app is implicitly strength-focused. Strava pulls in runs and rides, but there's no analysis beyond "activity logged". For the significant subset of users who run, cycle, or row, the app gives them nothing useful.

**What to build:**

1. **Pace trend chart** — weekly average pace per km for runs, visible on the Trends page
2. **Estimated VO2 max** — calculated from Strava run HR + pace data using the standard formula. Shown on the Body Metrics page alongside weight.
3. **Race time predictor** — given current VO2 max estimate, predict 5K / 10K / half marathon finish times
4. **Weekly mileage widget** — total run/ride distance this week vs. target (user-set in Settings)
5. **Training zones** — based on estimated max HR (220 − age), show which zone each Strava activity landed in

**Effort:** 3–4 days (most data already in Strava sync). **Impact:** High for cardio-primary users who currently get very little value from the app beyond basic logging.

---

#### B4. Sleep Optimization Module

**The problem:** Sleep quality is logged every day. The app has scheduled workouts. These two facts should talk to each other — but currently don't.

**What to build:**

1. **Bedtime calculator** — if tomorrow's workout is at 7am (from schedule), calculate a recommended bedtime to get the user's average sleep need (derived from their own data)
2. **Wind-down routine** — a customisable 10-minute pre-sleep sequence: 2-min breathing exercise, 5-min stretching from a built-in library, 3-min journaling prompt. Triggered by a push notification 45 min before bedtime.
3. **Sleep debt tracker** — running tally of sleep deficit vs. the user's average. Shown on dashboard when deficit > 2h. Feeds directly into Readiness Score.
4. **Trigger alerts** — when sleep quality drops below the user's average for 3+ nights, AI Coach proactively surfaces it: *"You've averaged 2/5 sleep this week. Your energy and workout performance tend to drop when this happens. Want to talk about what's going on?"*

**No new data needed.** Everything builds on `daily_logs.sleep_quality` and scheduled workouts.

**Effort:** 2–3 days. **Impact:** High — sleep is the highest-leverage health behaviour and the app already has the data.

---

### Theme C — New Tracking Dimensions

#### C1. Hydration Tracker

**The idea:** Simple daily water intake logging. One of the most-requested features in any health app, conspicuously absent here.

**How it works:**
- A water counter on the daily log (below food): tap to add 250ml / 500ml / custom
- Daily target based on body weight (35ml/kg/day, adjusted for exercise intensity)
- Smart reminders: if it's 3pm and you've only had 500ml, a push notification fires
- Hydration appears on the Trends page and feeds into the correlation engine (dehydration ↔ energy/headaches)
- On workout days, target auto-increases by 500–750ml

**Data model:**
```sql
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_ml int DEFAULT 0;
```

**Effort:** 1 day. **Impact:** Medium individual, high for user expectations (feels like a glaring omission).

---

#### C2. Supplement Stack Tracker

**The idea:** Users log which supplements they take (creatine, protein powder, vitamins, fish oil, etc.) with AI suggesting optimal timing relative to workouts.

**Features:**
- Add supplements to a personal stack (name, dose, frequency, category)
- Morning / pre-workout / post-workout / evening timing buckets — user sets where each supplement belongs
- Daily checklist on the log page: check off each supplement as you take it
- Streak tracking for supplement adherence (separate from main streak)
- AI Coach can see supplement stack and reference it: *"You've been consistent with creatine for 3 weeks — you're likely past the loading phase now"*
- Reminders at the configured timing

**Data model:**
```sql
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose_amount numeric,
  dose_unit text,   -- 'g', 'mg', 'ml', 'capsule', 'scoop'
  timing text NOT NULL,  -- 'morning', 'pre_workout', 'post_workout', 'evening', 'with_meals'
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS supplements_taken jsonb DEFAULT '[]';
-- Array of supplement IDs taken that day
```

**Effort:** 2 days. **Impact:** Medium — niche but loyal user segment (supplement users are often the most engaged fitness app users).

---

#### C3. Injury & Pain Log

**The idea:** Track injuries with affected muscle group, pain level, and onset date. AI adjusts workout suggestions to avoid aggravating injuries.

**Features:**
- Log an injury: body part (from a body map), pain level (1–10), type (acute / chronic / soreness), date of onset
- "Injury active" badge shown on relevant exercises in the workout builder: *"You logged left knee pain — skip this exercise?"*
- AI Coach aware of active injuries: avoids recommending loaded squats when knee is flagged
- Recovery timeline estimated by injury type (standard physiotherapy estimates)
- Daily check-in: pain level logged alongside the morning wellness log
- Auto-clears when user marks it resolved

**Data model:**
```sql
CREATE TABLE injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body_part text NOT NULL,
  muscle_groups text[],   -- for exercise filtering
  pain_level int NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
  injury_type text NOT NULL,  -- 'acute', 'chronic', 'doms'
  onset_date date NOT NULL,
  resolved_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 2–3 days. **Impact:** High for injury-prone users (a common and underserved segment). Prevents the "I hurt myself because the app told me to keep going" churn trigger.

---

### Theme D — Retention & Virality

#### D1. Streak Protection System (Streak Shields)

**The idea:** Extend the gamification layer with a mechanic that protects streaks during life disruptions (travel, illness, genuine emergencies) — without undermining the streak's meaning.

**Rules:**
- Earn one Streak Shield every time you hit a 30-day streak milestone
- Maximum 2 shields banked at any time
- On a day you don't log, the shield auto-deploys and preserves the streak (with a notification: *"Streak Shield used — you're protected"*)
- Shield used streaks are shown with a small shield icon in the streak history, for transparency
- Shields cannot be purchased or gifted — only earned

**Why this matters:** Streaks are the app's strongest engagement mechanic, but they also cause "rage quit" churn when broken. This gives high-streak users a safety net without devaluing the metric.

**Effort:** 1 day. **Impact:** High retention for users with 30+ day streaks (highest-value cohort).

---

#### D2. Shareable Workout Cards

**The idea:** After completing a workout, generate a beautiful shareable image card (like Strava's segment cards or Spotify Wrapped). User can save to camera roll or share directly to Instagram, WhatsApp, etc.

**Card contents:**
- Workout name + date
- Key stats: total volume (kg), sets completed, PRs hit, duration
- XP earned + current level badge
- Current streak
- A motivational line generated by Claude based on the session

**Technical approach:** Render a canvas element in the app at fixed 1080×1080 and convert to PNG (using `html2canvas` or a Canvas API approach). No server-side image generation needed.

**Effort:** 2 days. **Virality:** High — every shared card is an organic ad. This is how Strava and Duolingo grow.

---

#### D3. Goal Timeline & Progress Projection

**The idea:** Based on historical progress rate, AI projects when the user will hit their stated goal — and whether they're ahead of or behind their implied pace.

**Examples:**
- *"At your current rate of −0.3kg/week, you'll reach 80kg in approximately 8 weeks (around 22 July)."*
- *"Your protein adherence improved from 55% → 72% over the last month — you're ahead of pace."*
- *"You haven't lost weight in 3 weeks — your current intake might be at maintenance. Want to review your targets?"*

**Implementation:**
- Shown as a projection bar on the Goals section of the Settings or Dashboard
- Updated weekly by the cron job (same job as insights generation)
- Claude generates the natural-language framing; the underlying calculation is a simple linear regression on body weight or a rolling average of habit adherence

**Effort:** 2 days. **Impact:** High — makes goals feel concrete and time-bound rather than vague aspirations. Drives the behaviour loop: see you're behind → adjust → see it working.

---

### Theme E — AI Depth

#### E1. Coach Personas

**The idea:** Let users choose an AI coaching style that best matches their personality and needs.

**Personas:**

| Persona | Style | Best for |
|---|---|---|
| **Performance Coach** | Direct, data-heavy, no fluff | Competitive athletes |
| **Supportive Friend** | Warm, encouraging, checks in on mood | Beginners, people prone to all-or-nothing thinking |
| **Nutritionist** | Food-first, macro-obsessive, recipe-happy | Users primarily focused on diet |
| **Movement Coach** | Exercise science, biomechanics, program nerd | Gym-focused, technical users |
| **Mindset Coach** | Habit psychology, identity-based coaching, journaling | Users who struggle with motivation/consistency |

**Implementation:** Each persona is a system-prompt variation stored in the database. User selects in Settings → AI Coach → Coaching Style. Current conversation history is preserved when switching personas.

**Effort:** 1 day (the infrastructure already exists). **Impact:** Medium individually, but high on perceived personalisation — users who feel the coach "gets them" are more likely to engage daily.

---

#### E2. AI Recipe Generator

**The idea:** The Nutrition Planner has a pantry and a meal plan, but doesn't generate cooking *recipes*. The gap: a meal plan says "salmon + rice + broccoli" but doesn't tell you how to cook it or how to hit exactly 45g protein from that combination.

**Features:**
- "Generate a recipe" button on any meal plan slot
- AI generates full cooking instructions (ingredients with exact quantities, method, cook time) calibrated to the user's macro targets for that meal
- Macro breakdown shown per serving
- "Missing from pantry" diff — highlights ingredients not in the user's pantry as a shopping list addition
- Save recipe to a Recipe Library for future use
- One-tap to log the recipe as eaten (pre-fills food log with macro values)

**Data model:**
```sql
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  ingredients jsonb NOT NULL,  -- [{ name, amount, unit, calories, protein, carbs, fat }]
  instructions text[] NOT NULL,
  servings int DEFAULT 1,
  total_calories int,
  total_protein int,
  total_carbs int,
  total_fat int,
  prep_time_min int,
  cook_time_min int,
  tags text[],
  source text DEFAULT 'ai_generated',
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 2–3 days. **Impact:** High — closes the gap between "I know what to eat" and "I know how to cook it". Moves the app into territory no other fitness tracker occupies.

---

## Updated Prioritisation Matrix (Post-v2.0)

| Feature | Impact | Effort | Score | Recommended Sprint |
|---|---|---|---|---|
| Correlation Engine (A1) | Very High | Medium | ★★★★★ | Sprint 1 — highest ROI, data exists |
| Readiness Score (A2) | Very High | Low | ★★★★★ | Sprint 1 — 2 days, huge daily hook |
| Apple HealthKit (A4) | Very High | Medium | ★★★★☆ | Sprint 1 — native app makes this feasible now |
| Streak Shields (D1) | High | Very Low | ★★★★☆ | Sprint 1 — 1 day, protects top-cohort retention |
| Goal Projection (D3) | High | Low | ★★★★☆ | Sprint 1 — builds on cron job already needed for A1 |
| Group Challenges (A3) | Very High | Medium | ★★★★☆ | Sprint 2 |
| Shareable Workout Cards (D2) | High | Low | ★★★★☆ | Sprint 2 — virality flywheel |
| AI Workout Debrief (B2) | Medium | Very Low | ★★★☆☆ | Sprint 2 — 1 day, enriches 3 other features |
| Hydration Tracker (C1) | Medium | Very Low | ★★★☆☆ | Sprint 2 — table stakes, 1 day |
| Sleep Optimization Module (B4) | High | Medium | ★★★☆☆ | Sprint 2 |
| Running & Cardio Analytics (B3) | High | Medium | ★★★☆☆ | Sprint 3 — big win for cardio users |
| AI Recipe Generator (E2) | High | Medium | ★★★☆☆ | Sprint 3 |
| Coach Personas (E1) | Medium | Very Low | ★★★☆☆ | Sprint 3 — 1 day |
| Supplement Tracker (C2) | Medium | Medium | ★★☆☆☆ | Sprint 4 |
| Injury & Pain Log (C3) | Medium | Medium | ★★☆☆☆ | Sprint 4 |
| Video Form Analysis (B1) | High | Medium | ★★☆☆☆ | Sprint 4 — high wow factor, moderate accuracy risk |

---

## Recommended Sprint 1 (Post-v2.0)

**Theme: Intelligence + Native**

1. **Readiness Score v1** (2 days) — score card on dashboard, feeds from existing daily log data + Oura
2. **Correlation Engine v1** (3 days) — nightly cron, top 3 correlations, insight card on dashboard
3. **Apple HealthKit read** (3 days) — steps + HRV + body weight auto-sync (native app now supports this)
4. **Streak Shields** (1 day) — earn at 30-day milestones, auto-deploy on missed day
5. **Goal Timeline Projection** (1–2 days) — weekly update, "on track" / "behind" signal on dashboard

Total: ~10–11 days. Result: the app gains a daily reason to open it (readiness score) + a compelling intelligence layer (correlations + projections) + the auto-sync that removes the biggest logging friction.

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
