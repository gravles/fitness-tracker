# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (revised 2026-06-20)  
**Status:** Proposal — for review

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

A **Second Wave** of six additional feature ideas was added in June 2026, covering gaps not addressed by the original pillars: food photo/barcode logging, intermittent fasting, injury tracking, cardio analytics, supplement tracking, and AI-guided live workout sessions. These are brainstormed proposals — not yet scoped for implementation.

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

## The Six Pillars

1. **Correlation Engine & Insight Feed** — surface *why* you feel good or bad
2. **Intelligent Nutrition Planning** — close the loop from tracking to planning
3. **Periodisation & Progressive Overload** — turn workout history into a training program
4. **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?"
5. **Accountability Layer** — gentle social pressure without the social media toxicity
6. **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings

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

## Second Wave — New Feature Ideas

*Brainstormed 2026-06-20. None of these are built yet. They extend beyond the six pillars and address gaps identified after reviewing outstanding work and user behaviour patterns. Review and prioritise before implementing.*

---

### Idea A — Food Photo Recognition & Barcode Scanner

#### The Problem

Text-based food logging is the biggest source of drop-off in nutrition tracking. Typing "grilled salmon with roasted vegetables" and then editing each macro is 3–5 minutes of effort per meal. Two improvements could cut that to under 30 seconds.

#### What It Does

**Photo Logging**
A camera button on the food log. The user takes a photo of their plate; it gets sent to a vision-capable Claude model which estimates the meal's components, portions, and macros. The response pre-fills the food entry form for the user to confirm or adjust. Not perfectly accurate — but close enough, and dramatically faster than manual entry.

**Barcode Scanner**
A barcode scan button on the food log. Using the device camera (via `BarcodeDetector` API or a library like `zxing-wasm`), the user scans the barcode on any packaged food. The app looks up the product in the Open Food Facts API (free, 3M+ products) and returns exact nutrition info per serving, with a serving-size selector.

#### Technical Approach

- Photo: `POST /api/food/analyse-photo` — multipart upload, passes base64 image to Claude with a structured prompt requesting JSON output (`{items: [{name, quantity, unit, calories, protein, carbs, fat}]}`). Use `claude-haiku-4-5` for cost efficiency.
- Barcode: client-side scan → `GET /api/food/barcode?code=5012345678900` → hits Open Food Facts API (`world.openfoodfacts.org/api/v0/product/{barcode}.json`), maps to app's food item schema.
- Both flows funnel into the existing `AddFoodModal` with pre-filled state — no new data model needed.

#### Why This Matters

MyFitnessPal's most-used feature for 15 years is the barcode scanner. It's table-stakes for a serious nutrition app. Photo logging is the emerging differentiator — it removes the "I don't know how to describe this" friction that stops people logging meals they didn't prepare themselves (restaurants, other people's cooking).

---

### Idea B — Intermittent Fasting Tracker

#### The Problem

Intermittent fasting (IF) is practiced by a significant fraction of health-conscious people, but no fitness app integrates it seamlessly with nutrition and wellness tracking. Users currently manage fasting with a separate app (Zero, Fastic) and have no way to correlate fasting behaviour with their workout performance or energy levels.

#### What It Does

**Fasting Timer**
Start/stop a fast with one tap. Visual countdown showing:
- Current phase: *"Glucose burning (0–4h)"*, *"Fat burning (8–12h)"*, *"Autophagy window (16h+)"*
- Time elapsed, time remaining to goal
- Historical fasts — streak of completed fasting windows

**Protocol Templates**
Pre-built protocols: 16:8, 18:6, 20:4, 5:2, OMAD. Users pick one; the app sets the daily eating window and sends a push notification when the window opens and closes.

**Integration with Daily Log**
When a fast is active, suppress food log nudges until the eating window opens. Log the fast completion as a wellness entry (feeds into the correlation engine — does fasting correlate with better sleep? lower stress?).

**Fasting + Workout Interaction**
If a workout is logged during a fasting window, the AI coach gets context: *"Nathan trained fasted today (hour 14 of a 16:8 fast). His energy was 3/5."* The readiness score gets a fasting modifier.

#### New Data Model

```sql
CREATE TABLE fasting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol text NOT NULL,        -- '16:8', '18:6', 'custom', etc.
  started_at timestamptz NOT NULL,
  ended_at timestamptz,          -- null while active
  target_hours int NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

#### Why This Matters

IF users are highly engaged and data-driven — exactly the users who will love the correlation engine. This feature creates a natural home for them without requiring a second app. It also feeds uniquely useful data into the AI coach that no other feature provides.

---

### Idea C — Injury & Rehab Tracker

#### The Problem

Almost every regular exerciser is dealing with some injury or nagging pain. Yet no major fitness app addresses this. The result: users either train through pain and make things worse, or stop training entirely and churn. A good injury tracking layer could prevent both outcomes.

#### What It Does

**Injury Log**
Log a current injury or pain point: body region (shoulder, lower back, knee, etc.), severity (1–5), type (acute, overuse, soreness), and a note. Set a status: *Active*, *Recovering*, *Resolved*.

**AI Workout Modifications**
When the user starts a workout session with an active injury flagged, the AI coach automatically generates modifications:
- *"You have a left shoulder injury logged. I'll flag exercises that load the shoulder and suggest alternatives."*
- Per-exercise tags: ✅ Safe / ⚠️ Modify / 🚫 Avoid — based on injury region and exercise muscle group mapping.

**Recovery Timeline**
For each injury, a simple log of daily check-ins: *"How is it feeling today?"* (1–5 scale). Plotted as a recovery curve. If severity increases, the app suggests rest and notes it in the readiness score.

**Return-to-Sport Milestones**
For longer injuries (2+ weeks), set milestone targets: *"Pain-free squatting"*, *"Return to full training"*. Celebrate reaching them with XP and a badge.

**Correlation: Injury vs. Training Load**
After resolution, the correlation engine can look back: *"Your lower back injury followed 3 weeks of above-average deadlift volume. Your body's signal was increased soreness in week 2."*

#### New Data Model

```sql
CREATE TABLE injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body_region text NOT NULL,      -- 'left_shoulder', 'lower_back', 'right_knee', etc.
  injury_type text NOT NULL,      -- 'acute', 'overuse', 'soreness', 'tightness'
  severity int NOT NULL,          -- 1-5
  description text,
  status text DEFAULT 'active',   -- 'active', 'recovering', 'resolved'
  onset_date date NOT NULL,
  resolved_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE injury_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id uuid REFERENCES injuries(id) ON DELETE CASCADE,
  date date NOT NULL,
  severity int NOT NULL,          -- 1-5
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(injury_id, date)
);
```

#### Why This Matters

This is the most differentiated feature idea in this document. No mainstream fitness app does injury management well. For the app's target user — someone training consistently and caring about data — this is a feature they've never had and immediately understand the value of. It also prevents the biggest source of churn: getting hurt and quitting. An app that helps you train *through* an injury (safely) is one you never abandon.

---

### Idea D — Running & Cardio Analytics Module

#### The Problem

The app's workout tracker and periodisation features are implicitly strength-focused. A meaningful fraction of fitness users are primarily runners, cyclists, or cardio-focused. Right now they get Strava sync but no analytics native to the app. They're second-class citizens.

#### What It Does

**Cardio Session Logging**
When a workout type is "Run", "Cycle", or "Row", switch to a cardio-specific session view: log distance, duration, pace/split (auto-calculated), heart rate zone (if available from Strava/wearable), and a perceived effort (RPE 1–10).

**Running Pace Analytics**
A dedicated "Cardio" tab in the analytics section:
- Pace trend over time for a given distance (e.g., average 5K pace, plotted weekly)
- Training load: weekly mileage / duration, flagging weeks above a safe increase threshold (the "10% rule")
- PR tracking: fastest recorded times at 1K, 5K, 10K, half marathon, marathon

**Estimated VO2 Max**
Calculate estimated VO2 max from pace and heart rate data using the Cooper formula or the Firstbeat method (if HR is available). Track it over time as a fitness indicator distinct from strength metrics.

**Race Predictor**
Using the Riegel formula (`T2 = T1 × (D2/D1)^1.06`), predict race finish times from a recent performance. *"Based on your 5K time of 24:30, your predicted marathon time is 4:18."* Can be updated as fitness improves.

**Easy/Moderate/Hard Zone Classification**
Auto-classify each run as Easy, Moderate, or Hard based on pace relative to the user's recent average. Flag if the user is doing too many hard runs without recovery (polarised training model).

#### New Data Model

```sql
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cardio_type text;  -- 'run', 'cycle', 'row', 'swim'
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS distance_km numeric;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_pace_per_km interval;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_heart_rate int;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS max_heart_rate int;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS elevation_gain_m int;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rpe int;  -- 1-10 perceived effort

CREATE TABLE cardio_prs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cardio_type text NOT NULL,
  distance_km numeric NOT NULL,
  best_time interval NOT NULL,
  achieved_at date NOT NULL,
  source_workout_id uuid REFERENCES workouts(id)
);
```

#### Why This Matters

Runners are the most engaged and analytics-hungry segment of the fitness market. They obsess over pace, mileage, and performance trends. Adding dedicated cardio analytics expands the app's appeal to a large user segment currently underserved, while leveraging all the data already flowing in from Strava.

---

### Idea E — Supplement Stack Tracker

#### The Problem

Most people taking supplements have no idea whether they're actually working. They take creatine for three months, feel roughly the same, and stop. The supplement industry's dirty secret is that most users have no way to measure effectiveness — they're just following recommendations.

The fitness tracker already captures performance (weights lifted, endurance metrics, energy levels, sleep quality). It's in a unique position to actually evaluate whether supplements are doing anything.

#### What It Does

**Supplement Log**
A simple daily log for supplements: name, dose, timing (morning, pre-workout, with food, before bed). Preloaded library of common supplements (Creatine, Whey Protein, Vitamin D, Omega-3, Magnesium, Caffeine, Ashwagandha, etc.) with default doses and standard timing.

**Daily Supplement Reminders**
Integrate supplements into the existing push notification system: *"Time for your morning supplements: Vitamin D (2000 IU), Omega-3 (1g)"*. One-tap confirmation logs them.

**Supplement Compliance Tracking**
Dashboard showing weekly compliance per supplement (6/7 days taken). Analogous to the nutrition protein-goal hit counter — a simple visual of consistency.

**Correlation with Performance Metrics**
This is the killer feature. After 30+ days of supplement + performance data, the correlation engine can surface things like:
- *"On days you take creatine, your total workout volume is 12% higher on average."*
- *"Your sleep quality is 0.6 points higher on nights you take Magnesium Glycinate."*
- *"No correlation found between your pre-workout intake and energy level — consider whether it's still working for you."*

**AI Supplement Advice (Research-Based)**
In the coach chat, users can ask *"Should I take ashwagandha?"* and get evidence-based guidance grounded in their current goals, training load, and the specific evidence tier for that supplement (Tier 1: strong evidence, Tier 2: promising, Tier 3: limited evidence).

#### New Data Model

```sql
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text NOT NULL,              -- '5g', '2000 IU', '500mg'
  timing text NOT NULL,            -- 'morning', 'pre_workout', 'with_food', 'before_bed'
  is_active boolean DEFAULT true,
  started_at date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES supplements(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL,
  date date NOT NULL,
  UNIQUE(supplement_id, date)
);
```

#### Why This Matters

This feature is the clearest expression of the app's core promise: *"We turn your data into insight."* Users who see a real correlation between a supplement and a performance metric don't just keep using the supplement — they become evangelists for the app that showed them the connection. No other fitness app does this.

---

### Idea F — AI-Guided Live Workout Sessions

#### The Problem

The voice spotter is useful but narrow — it listens for rep counts and provides a single AI response after a set. What most people actually want when they train alone is the experience of having a personal trainer: someone who announces the exercise, tells them to rest, pushes them when they slow down, and adapts if they say they're struggling.

#### What It Does

**Session Mode: "Train with AI"**
An opt-in mode for the active workout screen. When enabled:

1. **Verbal announcements**: Claude (via text-to-speech) announces each exercise as the user navigates to it: *"Next up: Romanian Deadlifts, 3 sets of 12 at 70kg. Take 90 seconds rest then tap when ready."*

2. **Guided rest timer**: After a set is logged, a countdown timer starts automatically. Claude gives a 10-second warning: *"10 seconds. Get ready."*

3. **Mid-workout check-in**: After every 3 sets, a quick spoken check-in: *"How are you feeling? Say 'good', 'tired', or 'great'."* If the user says tired, Claude adjusts the remaining workout (reduces load or sets).

4. **Motivational cues**: On the last rep of a hard set, Claude delivers a brief, context-aware push: *"This is your 4th week of progressive overload on this lift — finish it strong."*

5. **End-of-session summary**: After the workout ends, a 30-second verbal summary: *"Great session. You hit a volume PR on bench press — 14% more total volume than last week. Rest well tonight."*

#### Technical Approach

- Text-to-speech: Web Speech API (`speechSynthesis`) for zero-cost audio output. Works in all modern browsers.
- Speech recognition for check-in responses: Web Speech API (`SpeechRecognition`). Graceful fallback to tap-based input on unsupported browsers.
- Session logic: a client-side state machine tracking current exercise, current set, rest state. Claude is called once at session start to generate a "coaching script" for the full workout, reducing per-set API calls to zero. The script is stored in-memory and triggered by state transitions.
- One API call at the end for the session summary, using the actual log data.

#### UI Consideration

A small toggle "Train with AI" in the active workout header. Off by default — this is a mode for users who want it, not a mandatory overlay. Users who prefer the current silent mode are unaffected.

#### Why This Matters

This is the clearest step toward the app's aspirational positioning: not "a tracking app" but "a personal trainer in your pocket." The technology already exists (Web Speech API, Claude). The experience — having an AI coach that knows your history and guides you in real time — is genuinely novel and retention-driving. It makes solo training less lonely and more structured.

---

### New Quick Win Ideas

*Additions to the existing Quick Wins Appendix.*

| Feature | Description | Effort |
|---|---|---|
| Water intake tracker | Log cups/glasses throughout the day, set a daily goal (e.g. 8 glasses), get a mid-day reminder if behind. Correlates with energy in the correlation engine. | 1 day |
| Flexible macro week view | Show weekly macro totals alongside daily view. Allows calorie banking — deficit days "credit" into higher days. | 1 day |
| Body recomposition mode | When weight is flat but body composition is changing (measurements shifting), surface a "recomposition in progress" message instead of letting the user think they're stalling. Uses `body_metrics` + `body_measurements`. | 2h |
| Workout difficulty rating | After each workout, ask "How hard was that? (1–5)". Store as perceived exertion. Feed into readiness score and correlation engine. | 2h |
| Fasting mode quick toggle | Even before building the full fasting tracker (Idea B), add a simple "Fasting now" toggle on the dashboard that suppresses food-log nudges and shows a simple elapsed timer. | 2h |
| Supplement quick-add | A simplified version of Idea E — just a free-text notes field on the daily log for supplements taken. Zero data model changes; feeds into AI coach context immediately. | 1h |

---

## Updated Prioritisation Matrix

*Original six pillars unchanged. New ideas scored on same criteria.*

| Feature | Impact | Feasibility | Score | Recommended Sequencing |
|---|---|---|---|---|
| **Original Pillars** | | | | |
| Quick Wins (original) | Medium | Very High | ★★★★★ | Ongoing |
| Readiness Score | Very High | High | ★★★★☆ | Sprint 1 |
| Correlation Engine | Very High | High | ★★★★☆ | Sprint 1 |
| Nutrition Planning (Saved Meals) | High | High | ★★★☆☆ | Sprint 2 |
| Periodisation (Overload Alerts) | High | High | ★★★☆☆ | Sprint 2 |
| Accountability (Partner only) | Very High | Medium | ★★★☆☆ | Sprint 3 |
| Withings / Oura Integrations | High | Medium | ★★★☆☆ | Sprint 3 |
| **New Ideas** | | | | |
| Barcode Scanner (Idea A, partial) | Very High | High | ★★★★☆ | Sprint 2 — barcode only, no photo |
| Photo Food Logging (Idea A, full) | Very High | Medium | ★★★☆☆ | Sprint 3 — after barcode |
| Injury & Rehab Tracker (Idea C) | Very High | High | ★★★★☆ | Sprint 2 — highly differentiated |
| Supplement Tracker (Idea E) | High | High | ★★★☆☆ | Sprint 3 |
| Water Intake (Quick Win) | Medium | Very High | ★★★★☆ | Sprint 1 quick win |
| Fasting Tracker (Idea B) | High | Medium | ★★★☆☆ | Sprint 3 |
| AI Guided Sessions (Idea F) | Very High | Medium | ★★★☆☆ | Sprint 4 |
| Cardio Analytics (Idea D) | High | Medium | ★★★☆☆ | Sprint 4 |
| Full Nutrition Meal Planner | High | Low | ★★☆☆☆ | Sprint 4+ |
| Group Challenges | Medium | Medium | ★★☆☆☆ | Sprint 4+ |
| 12-Week Programs | High | Low | ★★☆☆☆ | Sprint 4+ |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Future (native app required) |

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

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
