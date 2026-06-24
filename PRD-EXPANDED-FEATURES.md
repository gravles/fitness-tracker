# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Status:** Proposal — for review

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, 30-day window |
| Push notifications | ✅ Server-side, custom reminders |
| Strava sync | ✅ Manual sync |
| Goal Wizard | ⚠️ Built but no entry point |
| Progress photos | ✅ Upload + compare |
| Body metrics | ⚠️ Measurements but no photo upload |
| Social / sharing | 🔴 Stub only |
| Nutrition planning | 🔴 Not started |
| Recovery / readiness | 🔴 Not started |
| Wearable integrations | 🔴 Strava only |

---

## The Nine Pillars

1. **Correlation Engine & Insight Feed** — surface *why* you feel good or bad
2. **Intelligent Nutrition Planning** — close the loop from tracking to planning
3. **Periodisation & Progressive Overload** — turn workout history into a training program
4. **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?"
5. **Accountability Layer** — gentle social pressure without the social media toxicity
6. **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings
7. **Food Photo Logging** — point a camera at a meal and have it logged instantly
8. **Fasting & Time-Restricted Eating** — IF timers, fasting-aware coaching, and metabolic tracking
9. **Sleep Intelligence & Optimisation** — from logging sleep to actively improving it

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

---

## Pillar 7 — Food Photo Logging & AI Vision Entry

### The Problem

Manually searching for and logging each food item is the single biggest friction point in nutrition tracking. Most users abandon food logging not because they don't want to — they do — but because looking up "homemade chicken stir fry" in a database, adjusting portion sizes, and adding each component individually takes 3–5 minutes per meal. Multiply that by three meals a day and it feels like a job. A camera-first entry flow collapses this to under 30 seconds.

### What It Does

**Photo → Log in One Tap**
User opens the food log, taps a camera icon, takes a photo of their meal. Claude Vision analyses the image and returns:
- A list of identified foods (with confidence scores)
- Estimated portion sizes based on visual cues (plate size, context)
- Calculated calories, protein, carbs, fat

The user sees a confirmation screen — they can adjust portions or swap items — then taps "Log It." The whole flow takes under 30 seconds.

**Multi-Item Recognition**
A plate of chicken, rice, and broccoli correctly identifies three separate items, logs each individually, and sums the totals. Drinks, packaged foods with visible labels, and restaurant dishes are all in scope.

**Barcode Fallback**
If the user holds up a packaged product, the camera detects the barcode and switches to barcode-lookup mode automatically (using Open Food Facts API). No manual mode switching.

**Meal History Learning**
After a few weeks, the system recognises that the user's "morning bowl" is always oats + protein powder + banana. If a photo loosely matches a saved meal, it prompts: *"Looks like your usual breakfast — log as 'Morning Bowl'?"* One tap.

**Restaurant Menu Scan**
Point the camera at a physical or on-screen restaurant menu. The app identifies the dish name, looks it up in a restaurant nutrition database (Nutritionix, Spoonacular), and pre-fills the entry. Not perfect — but better than nothing, and users can adjust.

### AI Architecture

The photo logging flow sends the image to Claude's vision API with a structured prompt:

```
System: You are a professional nutritional analyst with expertise in estimating food portions visually.

Given this meal photo, return a JSON array of food items. For each:
- name: common food name
- estimated_grams: your best estimate
- calories_per_100g: standard reference value
- protein_g, carbs_g, fat_g: per 100g
- confidence: 'high' | 'medium' | 'low'

Be conservative with portions — people consistently overestimate portion sizes in photos.
When confidence is low, flag it so the user can correct it.
```

The response is validated and pre-fills the log entry form. The user's manual corrections feed back into a lightweight personal calibration (e.g. "this user always adjusts chicken up by 20% — apply as a bias").

### New Data Model

```sql
-- Track photo log events for calibration and audit
CREATE TABLE food_photo_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,           -- stored in Supabase Storage, private bucket
  ai_response jsonb NOT NULL,        -- raw Claude response
  user_confirmed_items jsonb,        -- what the user actually logged (may differ)
  accuracy_delta jsonb,              -- calorie/protein delta between AI and user edit
  logged_at timestamptz DEFAULT now()
);
```

### New Routes

- `POST /api/log/photo` — accepts image (base64 or multipart), returns AI-parsed food items
- `POST /api/log/barcode?code=xxxxx` — barcode lookup via Open Food Facts
- `POST /api/log/menu-scan` — restaurant menu photo → dish lookup

### UI Sketch

```
┌─────────────────────────────────────────────────────┐
│  📷  What did you eat?                               │
│                                                      │
│  ┌──────────────────────────────────┐               │
│  │   [Camera Preview / Photo]        │               │
│  └──────────────────────────────────┘               │
│                                                      │
│  Found 3 items:                                      │
│  ✓ Grilled chicken breast   ~180g   220 cal  42g P  │
│  ✓ White rice                ~150g   195 cal   4g P  │
│  ✓ Broccoli                  ~100g    35 cal   3g P  │
│                                                      │
│  Total: 450 cal · 49g protein                       │
│                            [Edit]  [Log It →]        │
└─────────────────────────────────────────────────────┘
```

### Why This Matters

This is the highest-leverage UX improvement the app could make. Logging friction is the number one reason people quit food tracking. Every other nutrition feature — correlation engine, meal planning, macro targets — is worthless if the user doesn't log. A photo flow that's genuinely fast enough to use at every meal unlocks adherence rates that are simply not achievable with manual search. This is also a strong differentiator: most competitors have attempted this but implemented it poorly.

---

---

## Pillar 8 — Fasting & Time-Restricted Eating

### The Problem

Intermittent fasting (IF) and time-restricted eating (TRE) are among the most widely adopted dietary strategies, with strong evidence for metabolic health, body composition, and simplicity of adherence. Despite this, the app has no fasting support at all. Users who practice IF are currently logging in a vacuum — there's no way to set a fasting window, see their remaining fast, get coaching about fasting, or correlate fasting behaviour with their outcomes.

### What It Does

**Fasting Timer Widget**
A persistent timer on the dashboard (or as a card) showing:
- Current fasting state: Fasting / Eating Window
- Time remaining in current state
- Today's window: e.g. *"16:8 · Fast started at 8pm · Break at 12pm"*
- A visual arc (like a progress ring) filling as the fast progresses

**Protocol Templates**
Pre-built fasting protocols the user can select from:
- 16:8 (most popular — 16h fast, 8h window)
- 18:6
- 20:4 (OMAD-adjacent)
- 5:2 (two low-calorie days per week)
- Custom (user defines window manually)

Once selected, the eating window anchors the daily log — food entries outside the window are flagged with a gentle note (*"This is outside your fasting window — log it anyway?"*).

**Fasting-Aware Coaching**
The AI coach becomes fasting-aware:
- If the user is in a fasting window and asks about hunger, the coach acknowledges their protocol
- Meal suggestions only appear for the eating window period
- Macro targets adjust to the eating window (e.g. 40g protein at breakfast is more urgent when you only have 8h to hit 160g)
- Electrolyte reminders during extended fasts (salt, magnesium, potassium)

**Fasting Streaks & Records**
Separate from the movement streak: a fasting consistency streak. *"14 days hitting your 16:8 window."* Longest fast record. Earns XP and specific badges (e.g. "Iron Will" for 30-day fasting streak).

**Break-Fast Meal Suggestions**
A smart prompt that fires at the end of the fasting window: *"Time to break your fast. Here's a high-protein meal to start your window well."* Suggestions prioritise protein-forward foods to maximise the post-fast anabolic window.

**Correlation with Existing Data**
The correlation engine (Pillar 1) gains a new variable: `fasting_window_hit` (boolean, daily). This immediately unlocks correlations like:
- *"Your energy is 28% higher on days you complete your 16h fast."*
- *"You sleep better on fasting days."*
- *"Your workout performance doesn't differ between fasting and eating-day mornings."*

### New Data Model

```sql
-- User's fasting configuration
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS fasting_protocol text,        -- '16:8', '18:6', '20:4', '5:2', 'custom'
  ADD COLUMN IF NOT EXISTS eating_window_start time,     -- e.g. '12:00'
  ADD COLUMN IF NOT EXISTS eating_window_end time,       -- e.g. '20:00'
  ADD COLUMN IF NOT EXISTS fasting_enabled boolean DEFAULT false;

-- Daily fasting records
CREATE TABLE fasting_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  fast_start timestamptz NOT NULL,
  fast_end timestamptz,                   -- null if still fasting
  target_duration_hours numeric NOT NULL,
  actual_duration_hours numeric,
  window_hit boolean,                     -- did they complete the target?
  notes text,
  UNIQUE(user_id, date)
);
```

### Why This Matters

IF is not a niche — it's mainstream. A significant portion of fitness-focused users practice some form of TRE, and none of the current app's features are aware of it. Adding fasting support does three things: (1) it makes the app relevant to a large user segment currently underserved, (2) it adds a second daily engagement hook (the fasting timer) alongside the log, and (3) it creates new high-value correlations in the insight engine that users will find genuinely surprising and motivating.

---

---

## Pillar 9 — Sleep Intelligence & Optimisation

### The Problem

The app currently captures a `sleep_quality` score (1–5) each day. That's a start, but it doesn't do anything *actionable* with it beyond showing a trend line. Sleep is the most impactful lever on recovery, performance, cognitive function, and emotional regulation — more so than any single supplement or training variable. A dedicated sleep intelligence layer transforms the app from "records your sleep" to "helps you sleep better."

### What It Does

**Bedtime Recommendation**
Each evening, the app sends a push notification (if enabled) at the optimal bedtime for the user's next day:
- If tomorrow is a hard training day (per schedule), suggest 8h window
- If correlation engine has found that 7.5h+ sleep correlates with better energy, personalise to that threshold
- If it's a rest day, suggest 7h minimum
- Example: *"If you sleep now, you'll get 7.5h before your 6am alarm. Your best workout days follow 7h+ of sleep."*

**Sleep Debt Tracker**
Accumulates a rolling 7-day sleep debt metric. Shown as a small indicator on the dashboard:
- Green: on target (< 1h debt)
- Amber: mild debt (1–3h)
- Red: significant debt (3h+)

When debt is high, the readiness score (Pillar 4) is automatically suppressed — this is the connection point between the two pillars.

**Wind-Down Routine Builder**
A library of 5–15 minute wind-down routines the user can schedule as an evening reminder:
- Progressive muscle relaxation
- Box breathing (4-4-4-4 pattern, with animated guide in-app)
- Gratitude journaling prompt (3 things from today)
- Phone-down countdown ("put your phone down in 10 minutes")

Not AI-generated on demand — a curated library that the app serves. Low infrastructure cost, high perceived value.

**Sleep Quality Deep Dive**
Once per week (paired with the weekly insight card), the AI generates a sleep-specific insight using recent log data:
- *"Your worst sleep days follow high-stress days with 3+ drinks. This happened 4 times this month."*
- *"You average 0.7 points better sleep quality on days you log movement before 7pm."*
- *"Your sleep scores have improved from 2.8 to 3.6 over the past 6 weeks — something is working."*

**Morning Check-In (Alternative to Evening Log)**
An optional lightweight morning mode: instead of logging everything the night before, users answer 3 questions in 30 seconds when they wake up:
1. *How did you sleep? (1–5)*
2. *How rested do you feel? (1–5)*
3. *Any notes?*

This flows into the readiness score calculation by 7am, giving them a day-start signal rather than a day-end reflection.

**Sleep Stage Integration (Phase 2)**
When Oura or Apple Health integration (Pillar 6) is active, replace the manual sleep quality score with actual sleep stage data. The 1–5 score is derived from: `(deep_sleep_min / 90) × 0.4 + (rem_sleep_min / 90) × 0.3 + (sleep_efficiency) × 0.3`. Users who haven't connected a device keep the manual score; connected users get a richer number automatically.

### New Data Model

```sql
-- Wind-down routines library (app-managed, not user-generated)
CREATE TABLE sleep_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_min int NOT NULL,
  category text NOT NULL,   -- 'breathing', 'relaxation', 'journaling', 'mindfulness'
  steps jsonb NOT NULL,     -- ordered array of { type, duration_sec, instruction }
  is_active boolean DEFAULT true
);

-- User's sleep routine usage
CREATE TABLE sleep_routine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id uuid REFERENCES sleep_routines(id),
  completed_at timestamptz DEFAULT now(),
  completed_fully boolean DEFAULT true
);

-- Morning check-in (separate from daily_logs for flexibility)
CREATE TABLE morning_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sleep_quality int CHECK (sleep_quality BETWEEN 1 AND 5),
  restedness int CHECK (restedness BETWEEN 1 AND 5),
  notes text,
  checked_in_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- User sleep settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS target_sleep_hours numeric DEFAULT 7.5,
  ADD COLUMN IF NOT EXISTS bedtime_reminder_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bedtime_reminder_time time,
  ADD COLUMN IF NOT EXISTS morning_checkin_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS morning_checkin_time time;
```

### New Routes

- `GET /api/sleep/debt` — rolling 7-day sleep debt calculation
- `GET /api/sleep/recommendation` — tonight's target bedtime
- `GET /api/sleep/routines` — library of wind-down routines
- `POST /api/sleep/routine-log` — record routine completion
- `POST /api/morning-checkin` — submit morning check-in

### Why This Matters

Sleep is the most undertapped vector in the app. It's already being tracked (sort of), but the data goes nowhere. This pillar closes that loop. It also creates a new *morning* engagement touchpoint — right now the app is an evening app (log your day at the end). A bedtime recommendation and morning check-in bookend the user's day and double the number of meaningful app interactions without doubling the effort. For many users, improving sleep will have a more dramatic effect on energy and performance than any training or nutrition change — the app should be the thing that makes that happen.

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

### New Quick Win Ideas *(added 2026-06-24)*

**Hydration Tracker**
A simple daily water intake widget on the log page. User taps a cup icon to add 250ml (or a custom size). Progress bar shows current vs. target (default 2L, customisable). A push notification fires mid-afternoon if they're below 50% by 2pm. Zero backend complexity — just a new field (`water_ml`) in `daily_logs` and a small UI component. Estimated effort: **half a day**.

**Personal Records Hall of Fame**
A dedicated `/records` page (or sub-tab under Workout) that shows:
- All-time best for every logged exercise (heaviest set, highest estimated 1RM, most reps)
- A "Recent PRs" section showing records set in the last 30 days
- A shareable PR card (image) for social sharing — just a styled screenshot of *"New PR: 120kg Squat"* with the app logo

This requires no new data — it's entirely derived from `workout_exercises` + `workout_sets`. Estimated effort: **1–2 days**.

**Supplement Tracker**
A lightweight supplement log added to the daily entry form. Users can add supplements from a preset list (creatine, protein powder, omega-3, vitamin D, magnesium, caffeine) or type custom ones. Stored as a `supplements` jsonb array in `daily_logs`. The correlation engine can then pick up supplement adherence and correlate it with performance or recovery metrics. Estimated effort: **1 day**.

**Injury & Soreness Log**
A simple body-map UI (front/back silhouette with tappable regions) where users can flag muscle soreness or minor injuries with a severity (1–5) and optional note. Stored in a new `soreness_logs` table. Benefits:
- The AI coach becomes aware of soreness when giving workout advice
- The readiness score (Pillar 4) can optionally factor in soreness
- Users build a history of recurring problem areas, which is medically useful

The body-map doesn't need to be sophisticated — even a checkbox list of major muscle groups works for v1. Estimated effort: **1 day**.

**Data Export**
Allow users to export their data as CSV or JSON from the Settings page. Three export types:
1. Daily logs (all fields, one row per day)
2. Workout history (exercises, sets, weights)
3. Body metrics history

No AI required. Users can share with their doctor, trainer, or import into another tool. Also builds trust — users are more likely to commit to an app if they know they can leave with their data. Estimated effort: **1 day**.

**Voice Logging (General)**
Extend the existing voice spotter (which already transcribes speech) to handle general log entries:
- *"I just had two scrambled eggs, a slice of toast, and a coffee"* → auto-parsed into food log items
- *"Feeling really tired today, stress level 4, slept badly"* → auto-fills wellness fields
- *"I drank two glasses of wine last night"* → logs alcohol

Uses the same speech-to-text infrastructure already in place. The parser is a simple Claude call: *"Parse this voice note into structured log fields. Return JSON."* Estimated effort: **2 days** (mostly integration + UI).

**Onboarding Walkthrough**
A step-by-step first-run experience for new users:
1. Set primary goal (lose fat / build muscle / improve health / train for event)
2. Set a daily calorie and protein target (or use the Goal Wizard)
3. Enable notifications (log reminder, streak)
4. Tour the key screens with coach tips

Currently new users land on the dashboard with no guidance. A 5-step onboarding could meaningfully reduce early churn. Estimated effort: **2 days**.

**Dark / Light Mode Toggle in App**
Add an explicit light/dark/system toggle in Settings (currently the app likely follows system preference only). Estimated effort: **2h**.

**Workout Rest Timer**
During an active workout, add an optional rest timer that starts automatically between sets. User sets default rest duration (e.g. 90s for hypertrophy, 3–5min for strength) in workout preferences. A notification vibrates when rest is over. Estimated effort: **half a day** (just a timer component and a setting).

---

## Prioritisation Matrix

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

| Pillar / Feature | Impact | Feasibility | Score | Recommended Sequencing |
|---|---|---|---|---|
| Quick Wins (bugs) | Medium | Very High | ★★★★★ | Ship first (continuous) |
| New Quick Wins (hydration, rest timer, records) | Medium | Very High | ★★★★★ | Ship alongside bugs |
| Readiness Score | Very High | High | ★★★★☆ | Sprint 1 — no new tables, just logic |
| Correlation Engine | Very High | High | ★★★★☆ | Sprint 1 — data already exists |
| Sleep Intelligence (bedtime nudge + debt tracker) | High | High | ★★★★☆ | Sprint 1 — small UI + one push notification |
| Fasting Timer (basic 16:8 timer + widget) | High | High | ★★★★☆ | Sprint 1 — timer + settings field only |
| Nutrition Planning (Saved Meals only) | High | High | ★★★☆☆ | Sprint 2 — start with saved meals |
| Periodisation (Overload Alerts only) | High | High | ★★★☆☆ | Sprint 2 — active workout is already there |
| Food Photo Logging (v1 — Claude Vision) | Very High | Medium | ★★★☆☆ | Sprint 2 — single API route + confirmation UI |
| Supplement Tracker | Medium | High | ★★★☆☆ | Sprint 2 — just a new log field |
| Injury / Soreness Log | High | High | ★★★☆☆ | Sprint 2 — body map or checkbox list |
| Data Export | Medium | Very High | ★★★☆☆ | Sprint 2 — CSV generation, no new data needed |
| Voice Logging (general) | High | Medium | ★★★☆☆ | Sprint 2 — extends existing spotter infra |
| Accountability (Partner only, no challenges) | Very High | Medium | ★★★☆☆ | Sprint 3 |
| Withings Integration | High | Medium | ★★★☆☆ | Sprint 3 |
| Oura Integration | High | Medium | ★★★☆☆ | Sprint 3 |
| Fasting (full: 5:2, correlations, break-fast meals) | High | Medium | ★★★☆☆ | Sprint 3 |
| Sleep Intelligence (wind-down routines, morning check-in) | High | Medium | ★★★☆☆ | Sprint 3 |
| Nutrition Planning (Full Meal Planner) | High | Low | ★★☆☆☆ | Sprint 4 |
| Group Challenges | Medium | Medium | ★★☆☆☆ | Sprint 4 |
| 12-Week Programs | High | Low | ★★☆☆☆ | Sprint 4 |
| Food Photo Logging (barcode + restaurant menu scan) | High | Low | ★★☆☆☆ | Sprint 4 |
| Onboarding Walkthrough | Medium | Medium | ★★☆☆☆ | Sprint 4 |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Future (requires native app) |

---

## Recommended Sprint 1 (Next 2–4 Weeks)

The highest-ROI work is features that require **no new infrastructure** — they use data that's already being captured and add intelligence on top:

1. **Fix all Quick Win bugs** (1–2 days) — removes friction and builds trust in the app
2. **Readiness Score v1** (2–3 days) — calculated from existing log fields, shows on dashboard
3. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card
4. **Progressive Overload Alerts** (1–2 days) — show last session + suggestion at top of each exercise in active workout
5. **Fasting Timer v1** (1 day) — eating window setting + timer widget on dashboard
6. **Sleep Intelligence v1** (1 day) — bedtime push notification + rolling sleep debt badge on dashboard

Total estimated effort: 9–14 days of development.

This sprint makes the app feel dramatically more intelligent without requiring any new data collection. The fasting timer and sleep nudge are small enough to fold in without disrupting the core sprint, and they unlock a new morning and evening touchpoint with users.

---

## Sprint 2 Suggestions *(new features added 2026-06-24)*

After Sprint 1's intelligence features ship, Sprint 2 is where new *data surfaces* open up:

1. **Food Photo Logging v1** (3–4 days) — one API route + confirmation UI; the single biggest UX unlock for nutrition adherence
2. **Supplement + Soreness quick-logs** (1–2 days) — extend the daily log form with two new lightweight fields
3. **Personal Records page** (1–2 days) — entirely derived from existing data, high motivational value
4. **Hydration widget** (half a day) — simple but high daily engagement
5. **Data export** (1 day) — builds user trust, zero new infrastructure
6. **Saved Meals** (1 day) — unlocks the meal planning pillar at low cost

Total estimated Sprint 2 effort: 7–10 days.

---

*Last updated: 2026-06-24. Questions, pushback, or additions — flag them and I'll revise.*
