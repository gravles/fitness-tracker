# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (original) · **Revised 2026-07-01**  
**Status:** Living document — Pillars 2–6 partially or fully shipped since original proposal; new ideas appended below for review

---

## Revision Note (2026-07-01)

Six weeks and ~55 commits have landed since this PRD was written. Most of Nutrition Planning shipped in full, and every other pillar has a real foundation in production (training programs, Withings + Oura sync, accountability partners, weekly insights). See **"Status Update — 2026-07-01"** below for the item-by-item breakdown, and **"Round 2 — New Feature Ideas"** at the end for a fresh brainstorm now that the data foundation (native apps, wearable sync, vision AI) is much richer than it was in May. Original pillar text is left intact below for reference; status annotations are added inline.

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

| Area | Status (2026-05-20) | Status (2026-07-01) |
|---|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry | ✅ Unchanged, plus autosave indicator + persistent macro bar |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter | ✅ + per-set autosave, edit completed workouts, Firefox fix |
| Streaks & XP gamification | ✅ 15 badges, level system | ✅ + streak type selector, exponential XP curve |
| Trends & analytics | ✅ Charts across 5 dimensions | ✅ Unchanged |
| AI coaching chat | ✅ Context-aware, 30-day window | ✅ + Supabase-synced history, weekly insights endpoint |
| Push notifications | ✅ Server-side, custom reminders | ✅ + smart-skip if already logged, hourly cron |
| Strava sync | ✅ Manual sync | ✅ Unchanged |
| Goal Wizard | ⚠️ Built but no entry point | ✅ Entry point added in Settings |
| Progress photos | ✅ Upload + compare | ✅ Unchanged |
| Body metrics | ⚠️ Measurements but no photo upload | ✅ Real Supabase Storage upload; kg/lbs unit toggle |
| Social / sharing | 🔴 Stub only | ⚠️ Accountability partners + weekly email shipped; in-app view & challenges still missing |
| Nutrition planning | 🔴 Not started | ✅ `/nutrition` page shipped — meal plans, saved meals, pantry AI |
| Recovery / readiness | 🔴 Not started | ⚠️ Oura sync feeds `energy_level`; no standalone readiness score/UI yet |
| Wearable integrations | 🔴 Strava only | ⚠️ + Withings (full body comp) + Oura (readiness/sleep); Apple Health/Google Fit still missing |
| Training programs | 🔴 Not started | ✅ 12-week AI programs shipped in full |
| Native apps | 🔴 Web only | ✅ iOS + Android Capacitor apps shipped, in stores |

---

## The Six Pillars

1. **Correlation Engine & Insight Feed** — surface *why* you feel good or bad
2. **Intelligent Nutrition Planning** — close the loop from tracking to planning
3. **Periodisation & Progressive Overload** — turn workout history into a training program
4. **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?"
5. **Accountability Layer** — gentle social pressure without the social media toxicity
6. **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings

Plus an **appendix of quick wins** — bugs and small features that could ship in a day each.

---

## Status Update — 2026-07-01

| Pillar | Status | What shipped | What's still missing |
|---|---|---|---|
| 1. Correlation Engine & Insight Feed | ⚠️ Partial | Weekly AI insights endpoint (`/api/ai/weekly-insights`) generating narrative commentary on trends | Nightly cron, `insights_cache` table, daily insight card on dashboard, "why do I feel this way" quick-ask |
| 2. Intelligent Nutrition Planning | ✅ Done | Full `/nutrition` page (Today/Plan/Library), `meal_plans` + `saved_meals` tables, pantry-aware AI meal generation | Macro-cycling recommendations (workout-day vs rest-day targets) not yet in code |
| 3. Periodisation & Progressive Overload | ⚠️ Partial | 12-week AI training programs fully shipped, `exercise_records`/1RM + deload support in the model | No progressive-overload alert in the active-workout UI, no "Gains" volume dashboard |
| 4. Recovery & Readiness Score | ⚠️ Partial | Oura sync pulls real readiness/HRV/sleep and maps it into `energy_level` | No standalone 0–100 readiness score, no dashboard card, no AI explanation or training recommendation |
| 5. Accountability Layer | ⚠️ Partial | `accountability_partners` table, partner invites in Settings, weekly summary email endpoint | No in-app partner view, no streak-shield nudge, no group challenges |
| 6. Health Platform Integrations | ⚠️ Partial | Strava, Withings (full body comp), Oura (readiness/sleep) all live | Apple Health / Google Fit still missing — **but** iOS + Android Capacitor native shells now exist, which removes the biggest blocker the original PRD flagged |

**Highest priority right now: the Readiness Score (Pillar 4).** It's the only "Very High impact" pillar with close to nothing built, and the reason to do it *now* rather than later has gotten stronger, not weaker: real Oura HRV and sleep-staging data is already flowing into the app, so this no longer has to ship as the estimated proxy-score the original PRD described — it can be Oura-grade from day one for connected users, with the client-side weighted fallback for everyone else. It also directly unblocks Pillar 3's deload detection and Pillar 1's daily insight card, so building it first compounds.

Second priority: **Progressive Overload Alerts** — the training-program and 1RM data model already exists, this is a UI-only lift on top of the active workout screen, and it's the most direct "tracking → results" moment for lifters.

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

| Issue | Fix | Status (2026-07-01) |
|---|---|---|
| `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` | ✅ Done |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties | ✅ Done |
| Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' | 'log')` variant; let user choose streak type in settings | ✅ Done |
| `WorkoutChatModal` vs `/coach` overlap and confusion | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" | 🔴 Still open |
| Body metrics photo = URL text field | Replace with real Supabase Storage upload (same code as Progress Photos) | ✅ Done |
| Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern | ✅ Done |
| Workout Spotter fails silently on Firefox | Show a browser compatibility warning | ✅ Done |
| Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding | ✅ Done |

### Small Features

| Feature | Description | Effort | Status (2026-07-01) |
|---|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h | ✅ Done |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day | ✅ Done |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day | ✅ Done (shipped as part of full Nutrition Planning) |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h | ✅ Done |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h | ✅ Done |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min | 🔴 Still open |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h | ✅ Done |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h | ✅ Done |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h | ✅ Done |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day | ✅ Done |

Only two quick wins remain open: the **WorkoutChatModal vs /coach labeling** fix and the **equipment quick-pick expansion** — both still a few hours of work each.

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

*(Note as of 2026-07-01: items 3 and 4 above — Nutrition and part of Periodisation — have since shipped via a different path than this exact sprint description. Readiness Score and Progressive Overload Alerts remain the two highest-leverage gaps and are carried forward as the top priorities below.)*

---

---

## Round 2 — New Feature Ideas (2026-07-01)

The original six pillars are mostly built or well underway. This section is a fresh brainstorm, written now that three things are true that weren't in May: **native iOS/Android apps exist** (Capacitor), **wearable data is flowing** (Oura + Withings), and **Claude vision is already wired into the food-logging pipeline**. Each idea below leans on that existing foundation rather than proposing new infrastructure from scratch. These are ideas for review, not commitments — nothing here has been built.

### A. AI Form Check (video)

**Problem:** The workout tracker records sets and reps but has no idea if the lift was performed safely. Bad form is the leading cause of training injuries, and it's exactly the kind of thing a coach would catch by watching you, not by reading a spreadsheet.

**What it does:** Let a user record a short clip (10–20s) of a lift from their phone during an active workout. Send it to Claude's vision API alongside the exercise name and ask for a structured critique: 2–3 specific cues (e.g., "knees caving in on the descent," "bar path drifting forward"), a confidence caveat that this isn't a substitute for a real coach, and a green/amber/red safety flag. Store the clip + critique against that workout set so progress is visible over time ("your squat depth consistency has improved over the last 6 sessions").

**Why it matters:** Nothing else in the fitness-app market does this well at a consumer price point. It's a natural extension of infrastructure that already exists (food photo AI, Claude API calls, Supabase Storage for photos).

**Rough effort:** Medium — mostly a new upload flow + prompt engineering; storage and AI-call plumbing already exist.

### B. Cycle-Aware Coaching

**Problem:** `enable_cycle_tracking` and cycle phase data already exist in the schema (the PRD's own quick-win fixed its *default*), but nothing in the app actually *uses* the phase data once it's collected. It's tracked and then ignored.

**What it does:** For users who opt in, surface phase-aware guidance already backed by real physiology: suggest higher carb intake and lower relative training intensity in the luteal phase, flag that PRs are more likely in the follicular phase, and let the AI Coach reference cycle phase when answering questions ("is it normal to feel low energy right now?"). This is a thin intelligence layer on data the app already has, similar in spirit to Pillar 1's correlation engine but seeded with established research rather than discovered from scratch.

**Why it matters:** Closes a real gap (collect-but-don't-use) for a meaningful chunk of the user base at very low engineering cost.

**Rough effort:** Low — no new tables, mostly coach-prompt and insight-card additions gated on existing `enable_cycle_tracking` flag.

### C. Native Widgets & Lock Screen Glance

**Problem:** The original PRD marked Apple Health/native features as "Very Low feasibility" because there was no native app. That's no longer true — iOS and Android Capacitor apps already ship to both stores.

**What it does:** A home-screen widget (iOS WidgetKit / Android App Widget) showing today's streak, macro rings, or (once built) readiness score, plus an iOS Lock Screen widget for the current streak. No login flow inside the widget — just a glanceable pull from the same data already cached for the dashboard.

**Why it matters:** Widgets are one of the highest-retention features in habit apps precisely because they don't require opening the app — they're a passive daily reminder that costs the user nothing. This was blocked by "no native app" in May; it isn't anymore.

**Rough effort:** Medium-High — requires native widget extensions in the Xcode/Android Studio projects (outside the shared Capacitor webview), but no new backend.

### D. Proactive Coach Nudges (not just reminders)

**Problem:** Push notifications today are scheduled reminders ("log your day"). They don't react to what's actually happening in the user's data.

**What it does:** Extend the nightly insights job (already partially built for Pillar 1) to also decide, per user, whether a *proactive coach message* is warranted — e.g., "You've hit protein 1/5 days this week, want me to adjust your meal plan?" or "3 days without logging a workout — everything okay?" Cap at one per day, respect quiet hours, and make it dismissible/mutable per category in Settings.

**Why it matters:** Converts the passive reminder system into something that feels like it's actually paying attention, which is the same emotional shift Pillar 1 (Correlation Engine) is chasing — this is a delivery mechanism for those insights rather than a dashboard card.

**Rough effort:** Low-Medium — reuses the existing VAPID push pipeline and (once built) the nightly insights cron; mostly a decision-rules layer.

### E. Restaurant Menu Scan

**Problem:** The food photo AI already estimates macros from a plate of food, but it can't help *before* the meal is chosen — which is when eating-out decisions actually go off track.

**What it does:** Point the camera at a restaurant menu (or a menu photo/screenshot) and have Claude vision extract the dish list, estimate macros per dish, and rank them against the user's remaining daily targets — "Best fit: grilled salmon bowl (~42g protein, 610 cal)." One tap logs the chosen dish once eaten.

**Why it matters:** Extends existing vision infrastructure to the highest-friction real-world moment (deciding what to order) rather than just the after-the-fact logging moment.

**Rough effort:** Medium — same AI plumbing as food photo scan, new prompt for multi-item extraction + ranking.

### F. Full Data Export

**Problem:** Users have been logging for months; there's no way for them to get their own data out. This is both a trust issue and, in some jurisdictions, a compliance expectation.

**What it does:** A "Download my data" button in Settings that generates a CSV/JSON export of daily logs, workouts, body metrics, and progress photo links, emailed or downloaded directly.

**Why it matters:** Low effort, meaningful trust signal, and removes a support burden ("can you send me my history") before it happens. Pure retention/trust investment rather than a growth feature — but cheap enough to slot in anywhere.

**Rough effort:** Low — read-only queries against tables that already exist, formatted and zipped.

### G. Adaptive Goal Phases (cut / bulk / maintain)

**Problem:** Users' targets are static. Someone cutting for 8 weeks then switching to a lean bulk currently has to manually recompute and re-enter every macro target.

**What it does:** Let users define named goal phases (e.g., "Cut — 8 weeks," "Maintenance," "Lean Bulk") each with its own macro/calorie targets and an optional end date. Switching phases is one tap and swaps the active targets used everywhere (daily rings, nutrition planner, AI coach). The existing Goal Wizard becomes the entry point for creating a phase rather than a one-time-only setup.

**Why it matters:** Matches how people actually train (in phases, not against one static number forever) and turns the already-built Goal Wizard into a recurring tool instead of a one-off.

**Rough effort:** Medium — one new table (`goal_phases`) plus wiring the "active phase" into the places that currently read static targets from `user_settings`.

### Suggested sequencing for Round 2

Given the reprioritized Sprint 1 above (Readiness Score, then Progressive Overload Alerts), the natural next slice from this list is:

1. **Cycle-Aware Coaching (B)** — lowest effort, closes an existing collect-but-ignore gap
2. **Full Data Export (F)** — cheap trust-builder, no dependencies
3. **Proactive Coach Nudges (D)** — highest leverage once the Readiness Score / insights cron exists, since it becomes the delivery mechanism for both
4. **Restaurant Menu Scan (E)** and **AI Form Check (A)** — both strong differentiators, medium effort, no urgency
5. **Native Widgets (C)** and **Adaptive Goal Phases (G)** — valuable but either higher effort (native code) or lower urgency (nice-to-have) than the rest

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
