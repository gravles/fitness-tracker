# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (last updated 2026-06-14)  
**Status:** Living document — Wave 1 largely shipped; Wave 2 brainstorm added below

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (Updated 2026-06-14)

The app has shipped rapidly since this PRD was first written. The table below reflects the current state based on the README and CHANGELOG.

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ AI entry, voice, camera meal recognition, barcode scanner |
| Workout tracking (exercises, sets, reps, rest timer) | ✅ Full active session tracker |
| Streaks & XP gamification | ✅ Badges, levels, shareable achievement cards |
| Trends & analytics | ✅ Weight, nutrition, activity, Withings body comp overlaid |
| AI coaching chat | ✅ Context-aware, persisted to Supabase (cross-device) |
| Push notifications | ✅ FCM (iOS + Android), per-workout reminders with lead times |
| Strava sync | ✅ OAuth, automatic activity sync |
| **Withings integration** | ✅ Body comp sync (weight, fat %, muscle, bone) |
| **Oura integration** | ✅ Readiness & activity sync |
| Goal Wizard | ⚠️ Built but no Settings entry point |
| Progress photos | ✅ Upload to Supabase Storage, before/after compare |
| Body metrics | ✅ Weight chart (lbs/kg), body comp from Withings |
| **Nutrition planning** | ✅ Pantry-based AI meal planner, per-meal regen, log-to-diary |
| **Saved meals** | ✅ Save multi-food selections, one-tap re-log |
| **12-week AI training programs** | ✅ Periodised phases, 1RM targets, PR toasts, adherence grid |
| **1RM estimation & PR notifications** | ✅ Epley formula, toast on >3% gain |
| **iCal calendar feed** | ✅ webcal:// URL for Apple Calendar / Google Calendar |
| **Native iOS & Android** | ✅ Capacitor, App Store + Play Store, haptics, swipe-back |
| **Accountability partners** | ✅ Email invite, weekly summary via Resend |
| **Onboarding flow** | ✅ Name, DOB, height, weight, fitness goal |
| **Unit preference (kg / lbs)** | ✅ Persisted to Supabase |
| **Light / Dark / System theme** | ✅ Applied before first paint |
| Correlation Engine / Insight Feed | 🔴 Not built |
| Readiness Score (in-app algorithm) | ⚠️ Oura data syncs in, but no in-app score card |
| Progressive Overload Alerts (in-session) | 🔴 Not built |
| Group Challenges | 🔴 Not built |
| Social / public sharing | 🔴 Stub only |
| Injury tracking & substitutions | 🔴 Not built |
| Hydration tracking | 🔴 Not built |

---

## The Six Pillars — Status Summary

| # | Pillar | Status |
|---|---|---|
| 1 | Correlation Engine & Insight Feed | 🔴 Not built |
| 2 | Intelligent Nutrition Planning | ✅ Shipped (v1.3.0) — pantry-based AI planner, saved meals |
| 3 | Periodisation & Progressive Overload | ⚠️ 12-week programs shipped; **progressive overload alerts not yet built** |
| 4 | Recovery & Readiness Score | ⚠️ Oura data syncs in; **in-app readiness card/algorithm not built** |
| 5 | Accountability Layer | ⚠️ Partners + weekly email shipped; **group challenges not built** |
| 6 | Health Platform Integrations | ✅ Strava, Withings, Oura shipped; Apple Health / Google Fit still future |

The three remaining high-value gaps from the original plan are: **Correlation Engine**, **Readiness Score card**, and **Progressive Overload Alerts**. Details for each are preserved in the pillar sections below.

Plus an **appendix of quick wins** — bugs and small features that could ship in a day each.

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

These are bugs or small features that could each ship in a day or less.

### Bugs to Fix

| Issue | Status | Fix |
|---|---|---|
| `/workout/builder` dead link in AI Coach | ❓ | Change redirect to `/schedule?tab=templates` |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | ❓ | Replace with CSS custom properties |
| Streak counts only `movement_completed`, not nutrition logs | ❓ | Add a `getStreak(mode: 'movement' \| 'log')` variant; let user choose streak type in settings |
| `WorkoutChatModal` vs `/coach` overlap and confusion | ❓ | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" |
| Active workout uses browser `confirm()` dialogs | ❓ | Replace with the app's existing modal pattern |
| Workout Spotter fails silently on Firefox | ❓ | Show a browser compatibility warning |
| Cycle tracking is on by default | ❓ | Default `enable_cycle_tracking` to false, prompt at onboarding |

### Small Features

| Feature | Status | Description | Effort |
|---|---|---|---|
| Goal Wizard entry point | 🔴 | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h |
| Unit preference (kg/lbs) | ✅ Shipped | — | — |
| Saved Meals | ✅ Shipped (v1.2.0) | — | — |
| Log reminder smart skip | ❓ | Skip the evening log reminder if user has already logged today | 2h |
| Streak type selector | ❓ | Let users choose: streak = any log, or streak = movement only | 1h |
| Equipment quick-pick expansion | ❓ | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min |
| XP exponential curve | ❓ | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h |
| Autosave indicator | ✅ Shipped | Macro status bar shown | — |
| Persistent macro summary bar | ✅ Shipped | — | — |
| Coach chat history sync | ✅ Shipped (v1.2.0) | — | — |

---

## Prioritisation Matrix (Updated)

Items marked ✅ have shipped. Remaining items rescored for the current app state.

| Feature | Impact | Feasibility | Score | Recommended Sequencing |
|---|---|---|---|---|
| Quick Win bugs remaining | Medium | Very High | ★★★★★ | Ongoing |
| Readiness Score card (in-app algorithm) | Very High | High | ★★★★☆ | Now — Oura data already present |
| Correlation Engine | Very High | High | ★★★★☆ | Now — data already exists |
| Progressive Overload Alerts | High | High | ★★★★☆ | Now — workout data is there |
| Injury & Pain Tracking | High | High | ★★★★☆ | Next — strong retention lever |
| Hydration Tracking | Medium | Very High | ★★★★☆ | Next — trivial to add |
| Home Screen Widgets | High | High | ★★★★☆ | Next — Capacitor already live |
| Group Challenges | Medium | Medium | ★★★☆☆ | Sprint after core gaps |
| Event Countdown Mode | High | Medium | ★★★☆☆ | Sprint after core gaps |
| Menstrual Cycle Phase Recommendations | High | Medium | ★★★☆☆ | Sprint after core gaps |
| Supplement Tracker | Medium | High | ★★★☆☆ | Sprint after core gaps |
| Historical Data Import | High | Low | ★★☆☆☆ | Future |
| Workout Performance by Time-of-Day | Medium | Medium | ★★☆☆☆ | Future |
| Annual Fitness Wrapped | Medium | Medium | ★★☆☆☆ | Future |
| Blood Work / Biomarker Logging | High | Medium | ★★☆☆☆ | Future |
| Offline Mode | High | Low | ★★☆☆☆ | Future |
| AI Form Check via Video | High | Very Low | ★☆☆☆☆ | Future (requires sustained AI investment) |

---

## Wave 2 Feature Brainstorm (Added 2026-06-14)

The app is now meaningfully ahead of most consumer fitness apps. The following are new ideas that could push it further — into genuinely differentiated territory. None of these are specs; they are ideas for review and prioritisation.

---

### Idea 1 — Injury & Pain Tracker

**The gap**: The app knows everything about what you lifted, but nothing about how your body feels in a specific way. Users who are nursing a shoulder, tight hip, or sore knee currently have no way to track it — and the AI can't adapt their workouts to protect them.

**What it could do**:
- An interactive body map (front/back silhouette) on the log page where users tap to mark sore or painful areas and rate severity (1–5)
- Stored in `injury_logs` with date and body-part tags
- When an injured body part is tagged, the active workout session shows a warning on exercises that load that area: *"You marked left shoulder as sore. Consider substituting with a cable chest fly."*
- AI coach automatically surfaces injury-aware suggestions in the coaching chat
- Track injury recurrence over time: *"You've reported right knee pain 4 times in 3 months — have you seen a physio?"*

**Why it matters**: Injury is the #1 reason people quit fitness apps. A feature that helps users train *around* pain rather than ignoring it or stopping entirely is a major retention lever. No current consumer app does this well.

**Data model sketch**:
```sql
CREATE TABLE injury_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  body_part text NOT NULL,     -- 'left_shoulder', 'lower_back', 'right_knee'
  severity int NOT NULL,       -- 1-5
  notes text,
  is_resolved boolean DEFAULT false,
  resolved_at date
);
```

**Effort estimate**: 3–5 days (body map UI is the tricky part; logic is straightforward)

---

### Idea 2 — Hydration Tracking

**The gap**: The app tracks every macro and wellness signal except water intake. Hydration directly affects energy, performance, and recovery — and correlates with almost everything else in the log.

**What it could do**:
- A simple water intake counter on the daily log tab (glasses or mL/oz, per unit preference)
- A daily target (default 2.5L, adjustable in settings; higher on workout days)
- Smart reminders: push notifications at intervals during the day, skipped automatically if target is already hit
- Feeds into the Correlation Engine: *"Your energy is 22% lower on days you drink under 1.5L of water"*
- Display alongside the macro progress bar on the dashboard

**Why it matters**: Extremely low-effort to build, but fills the last obvious gap in daily health tracking. Also gives the Correlation Engine another high-signal variable.

**Effort estimate**: 1 day

---

### Idea 3 — Home Screen Widgets (iOS & Android)

**The gap**: The app requires opening it to see any data. Since Capacitor is already live on both platforms, home screen widgets are the next natural step for reducing friction.

**What they could show**:
- **Streak widget**: current streak number with a flame icon — motivating glance
- **Macro progress widget**: compact P/C/F/Cal ring chart, updated after each log
- **Quick-log widget**: one button each for Water +1, Log Mood, Start Workout — eliminates the need to open the app for micro-logs
- **Today's Readiness Score** (once the readiness card is built): colour-coded number that tells you at a glance whether to train hard

**Why it matters**: A widget turns a passive habit (opening the app) into an ambient one. The streak widget in particular is a strong daily retention hook.

**Implementation path**: Capacitor has a community widget plugin (`@capacitor/widgets`). iOS requires a Widget Extension target in Xcode; Android requires an App Widget Provider. The hard part is reading app data from the widget process — this is solved by a shared App Group (iOS) or shared preferences (Android).

**Effort estimate**: 5–7 days (mostly native boilerplate, not app logic)

---

### Idea 4 — Menstrual Cycle Phase-Aware Training & Nutrition

**The gap**: The app has a cycle tracking toggle (currently defaults on and was flagged as a bug to default off). Turning it on collects the data but does nothing with it. There's a large, underserved user base who would benefit enormously from phase-specific training and nutrition guidance.

**What it could do**:
- During the **follicular phase** (days 1–13): higher pain tolerance, higher testosterone — recommend strength-focused workouts and higher protein
- During **ovulation** (days 12–16): peak energy, coordination — recommend HIIT or sport-specific work
- During the **luteal phase** (days 17–28): rising progesterone, lower glycogen use — reduce intensity, increase carbs slightly, prioritise sleep
- The dashboard shows current cycle phase and a brief note: *"Day 18 — luteal phase. Energy may dip mid-week; a slightly lighter session today will serve you better than pushing through."*
- Correlate logged mood, energy, and sleep quality against cycle phase over time — the data is already there

**Why it matters**: This is a significant demographic who is mostly ignored by fitness apps. Doing it properly (not just a period tracker but actual training and nutrition adaptation) is a meaningful differentiator.

**Effort estimate**: 4–6 days (cycle logic + UI updates; data is already collected)

---

### Idea 5 — Event Countdown & Peak Mode

**The gap**: The app does a great job of week-to-week tracking, but has no concept of *working towards a specific event*. A user training for a marathon, powerlifting meet, wedding, or holiday is in a fundamentally different mindset — they want to know: *"Am I on track to be ready by [date]?"*

**What it could do**:
- User creates an Event: name, date, type (race, competition, photoshoot, holiday, other)
- Dashboard shows a countdown card: *"72 days to your marathon"* with a progress ring
- The 12-week AI program automatically aligns to the event date: if 16 weeks out, a 12-week program starts in 4 weeks; if 10 weeks out, the program begins immediately and compresses
- A *Readiness to Peak* indicator: tracks whether training load, nutrition adherence, and recovery are on track for the event date
- One week before the event, the app enters *Taper Mode*: suggests reduced volume, prioritises sleep and nutrition, sends daily micro-reminders

**Why it matters**: Event prep is one of the strongest motivation levers in fitness. Users training for something concrete are far more consistent than those training generically. This feature creates an emotional arc — anticipation, progress, peak, celebration — that drives daily engagement.

**Effort estimate**: 3–4 days

---

### Idea 6 — Supplement Stack Tracker

**The gap**: Supplements (creatine, protein, caffeine, pre-workout, vitamins, omega-3) significantly affect training performance and recovery, but are invisible to the app. Users who are inconsistent with creatine loading, for example, may wonder why their strength stalled.

**What it could do**:
- A simple log: which supplements taken today, at what time (morning / pre-workout / evening)
- A supplement library with common items pre-loaded (creatine, protein powder, caffeine, vitamin D, zinc, magnesium)
- Streak tracking per supplement: *"Creatine: 12 days in a row ✅"*
- Integration with the Correlation Engine: *"On days you take pre-workout, your workout volume is 18% higher"*
- Optional timing reminder: *"Take your creatine — you haven't logged it today"*

**Why it matters**: Many serious users already track this manually in spreadsheets. In-app tracking closes another logging gap and gives the AI more signal to work with. It's also a natural cross-sell point (no affiliation required — just awareness).

**Effort estimate**: 2 days

---

### Idea 7 — Historical Data Import

**The gap**: Many potential users have months or years of data in MyFitnessPal, Cronometer, or the Strong app. Starting fresh loses that history, making the Correlation Engine and trend charts much less valuable on day 1. Import removes the biggest switching cost.

**What it could do**:
- **MyFitnessPal CSV export** → map to `daily_logs.food_items`; import calorie and macro history
- **Strong app CSV export** → map to `workouts` and `workout_exercises`; import lifting history including 1RM history
- **Apple Health export** (XML) → import weight history into `body_metrics`, workout calories into logs
- A one-time import flow in Settings → Data; shows a preview before committing
- Deduplication: skip days already in the database; flag conflicts for user review

**Why it matters**: The Correlation Engine and all trend-based features require historical data. Import gives new users an instant data advantage and dramatically lowers the switching cost from other apps.

**Effort estimate**: 4–6 days (mostly CSV parsing and mapping logic; import UI is a day)

---

### Idea 8 — Workout Performance by Time of Day

**The gap**: The app logs when workouts happen (timestamps exist on `workouts`). But it never asks: *"Do you actually perform better in the morning or evening?"* This is one of the most actionable questions in personal fitness optimisation.

**What it could do**:
- Analyses workout timestamps vs. 1RM estimates, volume completed, and user-reported energy level for that day
- Surfaces an insight card: *"Your average workout volume is 23% higher between 5–8pm than before 9am (based on 34 sessions)"*
- Feeds into the scheduling UI: when scheduling a workout, the app shows *"Your best time: evenings"* as a suggested default
- Can also correlate with sleep time the night before: *"You lift more after sleeping 7+ hours, regardless of time of day"*

**Why it matters**: Highly personalised, data-driven, and immediately actionable. No other app does this automatically. Small implementation lift since the data is already there.

**Effort estimate**: 2 days (cron job extension + one new insight type)

---

### Idea 9 — Annual Fitness Wrapped

**The gap**: The app has great weekly and trend views, but no yearly reflection. Spotify Wrapped proved that an annual "look back at your year" drives enormous engagement and sharing — and fitness data makes for an even more personal and meaningful summary.

**What it could do**:
- Triggered each January 1st (or on the user's account anniversary)
- A full-screen animated card sequence: *"In 2026, you logged 284 days. You lifted 186,000 kg total. Your longest streak was 42 days. Your best PR: 110kg bench press."*
- Shareable as an image card (same tech as the existing level-achievement cards)
- Top achievements: most consistent month, best workout, biggest strength gain, most calories burned in a week
- A personal "fitness movie" summary the AI writes from the year's data

**Why it matters**: Massive social sharing potential, zero new data collection needed, and creates a strong emotional connection to the app. It's also a powerful re-engagement tool for lapsed users who open a January notification.

**Effort estimate**: 3–4 days for a polished v1

---

### Idea 10 — Blood Work & Biomarker Logging

**The gap**: The app tracks lifestyle inputs and performance outputs but has no visibility into the biological layer in between: testosterone, cortisol, Vitamin D, ferritin, HbA1c, VO2 max (estimated). Users who get regular blood work have no place to track it alongside their training data.

**What it could do**:
- Manual log: upload lab result values with date (no OCR required for v1)
- Reference ranges shown alongside: *"Ferritin: 22 ng/mL — below optimal for endurance athletes (40–80)"*
- Correlation with performance data: *"Your Vitamin D dropped to 18 ng/mL in November. Your energy logs averaged 2.1/5 that month vs. 3.8/5 the rest of the year."*
- AI coach can reference recent blood work in coaching responses: *"Given your low ferritin, prioritising iron-rich foods like red meat and lentils would help your recovery."*
- Over time: track trends in biomarkers and flag significant changes

**Why it matters**: This is the connective tissue between lifestyle data and health outcomes. It elevates the app from "fitness tracker" to "personal health dashboard" — a meaningfully bigger category. Most users already get annual blood work; giving it a home here completes the data picture.

**Data model sketch**:
```sql
CREATE TABLE biomarker_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_date date NOT NULL,
  marker text NOT NULL,       -- 'vitamin_d', 'ferritin', 'testosterone', 'hba1c'
  value numeric NOT NULL,
  unit text NOT NULL,         -- 'ng/mL', 'nmol/L', 'mmol/mol'
  source text DEFAULT 'manual',
  notes text
);
```

**Effort estimate**: 3–4 days

---

### Idea 11 — Muscle Group Recovery Heat Map

**The gap**: The app tracks every exercise, set, and rep. But when a user goes to schedule or start a workout, they have no visual summary of which muscle groups are fresh vs. fatigued. They're guessing.

**What it could do**:
- A front/back body silhouette (similar to the injury map idea) that colour-codes muscle groups by recency of training:
  - Green: >72h since trained — ready
  - Amber: 48–72h — recovering
  - Red: <48h — likely still fatigued
- Shown on the workout Schedule page and optionally on the dashboard
- Derived entirely from `workout_exercises` + a hardcoded muscle-group-per-exercise mapping
- When starting a workout, flag exercises that load red muscle groups: *"You trained chest 16 hours ago — consider swapping incline press for rear delts."*

**Why it matters**: This closes the gap between "I logged a workout" and "I made smart decisions about my next workout." It's a lightweight but visually powerful feature that would feel like magic to most users.

**Effort estimate**: 3 days (the exercise-to-muscle-group mapping is the main effort)

---

### Idea 12 — Offline Mode with Background Sync

**The gap**: Gyms often have poor WiFi and spotty cellular. Right now, any network interruption likely causes silent failures or blocks the user from logging. For an app used during workouts, this is a meaningful friction point.

**What it could do**:
- A service worker caches the app shell and recent data (last 7 days of logs, today's workout)
- When offline, all writes go to IndexedDB
- When connectivity returns, a background sync flushes the queue to Supabase
- A subtle "Offline mode" banner appears at the top when disconnected; a "Syncing…" banner when reconnecting
- Conflicts (e.g., edited the same log on two devices while offline) are resolved by last-write-wins with a notification

**Why it matters**: This isn't a glamorous feature but it removes a real reliability concern for gym use. Users who lose a set of data to a network error are likely to get frustrated and eventually churn.

**Effort estimate**: 5–7 days (service worker setup + IndexedDB queue + sync logic)

---

## Revised Prioritisation — What To Do Next

Given that Wave 1 is largely shipped, here's a suggested focus order for Wave 2:

### Immediate (1–2 weeks)
These close obvious gaps in the existing app with minimal effort:
1. **Hydration Tracking** (1 day) — fills the last daily log gap
2. **Readiness Score Card** (2–3 days) — Oura data is already there; just needs the UI + algorithm
3. **Progressive Overload Alerts** (1–2 days) — workout history is already there; show it at session start
4. **Correlation Engine v1** (3–4 days) — daily logs are there; add the nightly cron and insight card
5. **Goal Wizard entry point** (1h) — it's built; just needs a Settings link

### Near-term (2–6 weeks)
Higher effort but high strategic value:
6. **Injury & Pain Tracker** (3–5 days) — retention lever, no competitor does it well
7. **Muscle Group Recovery Map** (3 days) — completes the workout intelligence story
8. **Event Countdown & Peak Mode** (3–4 days) — creates sustained motivation arc
9. **Supplement Tracker** (2 days) — fills a real gap for serious users

### Future
10. **Home Screen Widgets** (5–7 days) — high engagement value, meaningful native effort
11. **Menstrual Cycle Phase Recommendations** (4–6 days) — underserved demographic
12. **Annual Fitness Wrapped** (3–4 days) — best shipped January 2027
13. **Historical Data Import** (4–6 days) — reduces switching cost; grows addressable market
14. **Blood Work Logging** (3–4 days) — elevates the app's category
15. **Workout Performance by Time-of-Day** (2 days) — powerful insight, low effort, good timing for later
16. **Offline Mode** (5–7 days) — reliability, not delight; deprioritise until other gaps closed

---

*Document updated 2026-06-14. Wave 1 status reflects CHANGELOG through v2.0.0.*
