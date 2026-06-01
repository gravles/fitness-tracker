# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-01  
**Status:** Living document — updated with shipped status and new ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (Updated 2026-06-01)

*Originally written 2026-05-20. Much has shipped since — updated to reflect reality.*

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted, voice + camera |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter, autosave per set |
| Streaks & XP gamification | ✅ 15 badges, level system, XP curve |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Persistent cross-device (Supabase-backed) |
| Push notifications | ✅ FCM (iOS + Android), pre-workout reminders |
| Strava sync | ✅ Automatic OAuth sync |
| Goal Wizard | ⚠️ Built but entry point may still be missing |
| Progress photos | ✅ Upload + compare (Supabase Storage) |
| Body metrics | ✅ Full with photo upload, kg/lbs toggle |
| Saved Meals | ✅ Save multi-food selections, one-tap re-log |
| AI Nutrition Planner | ✅ `/nutrition` — pantry, meal plans, photo/voice scan |
| 12-Week AI Training Programs | ✅ Full periodisation, 1RM tracking, PR toasts |
| Estimated 1RM & PRs | ✅ Epley formula, tracked per exercise |
| Native iOS & Android | ✅ Published via Capacitor (FCM on Android, APNs on iOS) |
| iCal Calendar Feed | ✅ Subscribable `webcal://` workout calendar |
| Dark/Light/System Theme | ✅ Three-way toggle, token coverage |
| Onboarding Flow | ✅ First-launch modal, personalises AI coaching |
| Language Toggle (EN/FR) | ✅ Per-session |
| Edit completed workouts | ✅ Post-session editing |
| Withings Integration | ✅ Full body composition sync (weight, fat %, muscle, bone) |
| Oura Integration | ✅ Readiness + activity sync |
| Accountability Partners | ⚠️ Add partners + weekly email done; no group challenges, no streak shield |
| Social / sharing | 🔴 Stub only |
| Correlation Engine & Insight Feed | 🔴 Not started — **highest remaining priority** |
| Recovery / Readiness Score UI | ⚠️ Oura data available but no score UI built on it |
| Progressive Overload Alerts | ⚠️ 1RM pre-loaded in programs; no in-session "try X next" prompt |
| Group Challenges | 🔴 Not started |
| Apple Health / Google Health Connect | 🔴 Not started (native APIs required) |

---

## The Six Pillars

| # | Pillar | Status |
|---|---|---|
| 1 | **Correlation Engine & Insight Feed** — surface *why* you feel good or bad | 🔴 Not started |
| 2 | **Intelligent Nutrition Planning** — close the loop from tracking to planning | ✅ Shipped v1.2–v1.3 |
| 3 | **Periodisation & Progressive Overload** — turn workout history into a training program | ✅ Shipped v1.5 (in-session alerts still ⚠️) |
| 4 | **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?" | ⚠️ Data available, score UI not built |
| 5 | **Accountability Layer** — gentle social pressure without the social media toxicity | ⚠️ Partial — partners + email done; challenges not done |
| 6 | **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings | ✅ Oura + Withings shipped; Apple Health / Google Fit not started |

Plus an **appendix of quick wins** (partially addressed) and a new **Section 7: New Feature Ideas**.

---

---

## Pillar 1 — Correlation Engine & Insight Feed `🔴 NOT STARTED`

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

## Pillar 2 — Intelligent Nutrition Planning `✅ SHIPPED (v1.2–v1.3)`

*Shipped: `/nutrition` page, pantry management, AI meal plans, photo/voice scan, saved meals, one-tap re-log.*

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

## Pillar 3 — Periodisation & Progressive Overload Engine `✅ MOSTLY SHIPPED (v1.5)`

*Shipped: 12-week AI programs, phases, 1RM tracking (Epley), PR toasts, skip/reschedule sessions, adherence dot grid.*  
*Outstanding: in-session progressive overload alert ("last time: 3×10 @ 60kg — try 62.5kg") is not yet shown during an active workout.*

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

## Pillar 4 — Recovery & Readiness Score `⚠️ DATA AVAILABLE, UI NOT BUILT`

*Oura readiness data syncs via the integration added in v1.4. The score calculation and dashboard display described below still need to be built on top of that data.*

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

## Pillar 5 — Accountability Layer `⚠️ PARTIAL (v1.4)`

*Shipped: add accountability partners by name/email, send weekly summary email via Resend.*  
*Outstanding: in-app partner view, streak shield nudge to partner, group challenges.*

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

## Pillar 6 — Health Platform Integrations `⚠️ PARTIAL (v1.4)`

*Shipped: Withings (full body composition), Oura (readiness + activity), Strava (auto-sync).*  
*Outstanding: Apple HealthKit and Google Health Connect — both require a native shell beyond what Capacitor currently exposes.*

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

---

## Section 7 — New Feature Ideas (Brainstorm, 2026-06-01)

*These are net-new ideas not in the original six pillars. They are not yet specified in detail — the purpose of this section is to capture the ideas for review. Any that get approved should be fleshed out with the same level of spec as the pillars above.*

---

### 7.1 — Hydration Tracking

**The gap:** The app logs food, sleep, stress, alcohol, and movement — but not water intake, which is one of the most direct and easily changeable levers for energy, performance, and recovery.

**What it would do:**
- A simple water intake counter on the daily log (a row of cups or a number input, e.g. "6 / 8 glasses")
- A daily hydration goal (ml or glasses) stored in `user_settings`
- Smart reminders: a push notification if no water has been logged by 2pm
- Hydration fed into the Correlation Engine (e.g. "Your energy is 22% higher on days you hit your water goal")
- A small hydration ring next to the existing macro rings in the log UI

**Effort estimate:** 1–2 days. This is a daily-log field addition, a settings field, and optional reminder logic.

**Why it matters:** Dehydration is one of the most common and least-noticed causes of low energy and poor workout performance. The correlation data is already there; water is the missing input.

---

### 7.2 — Supplement & Medication Tracking

**The gap:** Many users taking the app seriously also follow a supplement stack (creatine, protein, omega-3, magnesium, vitamin D, caffeine). There's no way to log or track this, so the AI coaching is blind to it.

**What it would do:**
- A "Supplements" tab in the daily log (or a row in the existing Habits section)
- Add a stack of supplements to track (name, dose, timing: pre/post/morning/evening)
- One-tap daily check-off (like habits)
- Optional reminders: "Time to take your evening magnesium"
- Supplement consistency score in weekly summary
- Creatine loading phase tracking — AI can suggest a loading week then maintenance

**Effort estimate:** 2–3 days. Shares patterns with the existing habits system.

**Why it matters:** Supplements affect performance and recovery. Logging them lets the correlation engine find patterns ("Your sleep quality is 0.4 points higher on nights you take magnesium") and lets the AI coach give informed advice.

---

### 7.3 — Contextual Smart Notifications

**The gap:** Current notifications are time-based only ("remind me at 8pm to log"). The app now has enough data to make notifications *context-aware* — firing based on what's happening in the user's actual day, not just the clock.

**What it would do:**

| Trigger | Notification |
|---|---|
| 7pm and daily log not started | "Quick log before the day slips away — tap to open" |
| Readiness score < 40 and workout scheduled | "Your readiness is low today. Consider swapping to active recovery." |
| 3 consecutive high-stress days | "You've been stressed 3 days running. Today's a good day to rest." |
| Protein goal missed 3 days in a row | "Protein has been low this week. Try adding [favourite high-protein food] at lunch." |
| Streak at risk (last log was yesterday, now 10pm) | "Day 14 of your streak — don't break it now. 2 minutes to log." |
| PR on any lift | "New personal best on bench press. Share it?" (with one-tap share) |
| Workout program week completed | "Week 4 complete. Ready for Week 5?" |

**Effort estimate:** 2–3 days. Requires a new notification evaluation function in the nightly cron and potentially a new low-latency trigger endpoint.

**Why it matters:** This is what makes the app feel like it's *paying attention*. Most fitness apps send generic "don't forget to log!" messages. Context-aware notifications feel like a real coach noticing what's happening in your day.

---

### 7.4 — Sleep Optimisation Module

**The gap:** The app logs sleep quality (1–5 scale) and syncs Oura sleep staging data. But it doesn't *do* anything with that data to help users actually sleep better. Sleep is arguably the single most impactful recovery lever.

**What it would do:**

**Sleep Dashboard tab** (within the existing Trends page, or a new section):
- Sleep quality trend chart (already exists; make it more prominent)
- Average sleep duration vs. goal
- Oura sleep staging breakdown (REM / deep / light / awake) if connected
- "Sleep debt" calculation: cumulative hours below 7.5h over the past 7 nights

**Bedtime Reminder:**
- User sets a wake time goal (e.g. 7am)
- App calculates target bedtime based on target sleep duration (e.g. 10:30pm for 8h 30m of wind-down + sleep)
- Push notification at target bedtime: "For your 7am alarm, aim to be asleep within 30 minutes"

**Chronotype Detection:**
- Based on historical sleep timing patterns: are you a morning lark or evening owl?
- Surface this as a setting that nudges workout timing ("Your natural peak performance window is 10am–12pm")

**Sleep hygiene tips from AI:**
- If sleep quality < 3 for 3+ consecutive days, the AI coach proactively surfaces sleep hygiene suggestions (not alcohol-related if alcohol is already flagged by the correlation engine — avoid repeating advice)

**Effort estimate:** 3–4 days. Most of the data already exists.

---

### 7.5 — Body Composition Goal Projections

**The gap:** The app tracks weight and body composition via Withings, and has macro targets. But it doesn't tell users *when they'll get there* or *whether their current behaviour is on track* to hit their goal.

**What it would do:**
- A "Projection" card on the Body Metrics page or dashboard
- Based on current caloric deficit/surplus trend (from food logs + estimated TDEE), project the date the user will reach their goal weight
- Show a simple projected curve: where you are now, where you're heading, where your goal is
- If current trajectory overshoots or falls short: "At this rate you'll reach your goal weight in ~14 weeks. To hit it in 10 weeks, aim for an extra 200 kcal deficit per day."
- Body fat % trajectory if Withings data is available

**Effort estimate:** 2–3 days. TDEE estimation requires a simple calculation (Mifflin-St Jeor with activity factor from movement logs).

**Why it matters:** Users want to know "when will I get there?" — this is one of the most common fitness questions, and almost no apps answer it with the user's own data.

---

### 7.6 — Mindfulness & Stress Reduction Module

**The gap:** The app tracks stress (1–5 scale) but does nothing to actively reduce it. When the readiness score is low due to stress, the recommendation is "rest" — but what does "rest" actually look like? This feature answers that.

**What it would do:**

**Guided Breathing Exercises** (in-app, no API call needed):
- Box breathing (4-4-4-4): a simple animated square guides the inhale/hold/exhale/hold
- 4-7-8 breathing: popular for sleep onset
- Physiological sigh (double inhale + long exhale): fastest known way to reduce acute stress
- Each session: 2–5 minutes; plays on screen with a timer

**Suggested contextually:**
- When daily stress ≥ 4, show a "Take a breath" prompt card on the dashboard
- When readiness score < 40, the training recommendation includes "try a 5-minute breathing session"

**Short mindfulness prompts** (text-based, generated by AI, cached):
- "Reflect: what's one thing you're grateful for today?" — timed to appear when stress is high
- Stored as a log entry if the user answers

**Effort estimate:** 2 days for breathing exercises (pure UI, no backend). 1 additional day for contextual triggers.

**Why it matters:** Stress management is a major gap in fitness apps. The breathing exercises require no integration, no AI calls, and no data — yet they provide real, evidence-backed value. They also give users something to *do* when the readiness score says "don't train today."

---

### 7.7 — Monthly Health Report (PDF Export)

**The gap:** The app has 30+ days of rich health data for many users, but there's no way to get it out in a portable, readable form. Users who see a GP, sports physio, or personal trainer have no way to share their data.

**What it would do:**
- A "Generate Monthly Report" button in Settings or the Trends page
- Server-side PDF generation (using a library like `pdfkit` or a Vercel Edge Function)
- Report includes:
  - Nutrition summary: average calories, protein, carbs, fat vs. targets
  - Movement summary: workouts completed, average weekly volume
  - Sleep & wellness: average sleep quality, stress, energy
  - Body metrics: weight trend chart, body composition if available
  - Highlight moments: PRs set, streak milestones, badges earned
  - AI-generated one-page narrative summary ("This was Nathan's strongest month for nutrition adherence…")

**Full data export:**
- CSV export of raw daily logs
- JSON export of all data (for power users / data portability)

**Effort estimate:** 3–4 days for a well-designed PDF. 1 day for raw CSV export.

**Why it matters:** Data ownership builds trust. A user who can take their data to a doctor or trainer has a real, tangible reason to keep logging consistently. It also positions the app as a long-term health record, not just a short-term tracking tool.

---

### 7.8 — Group Fitness Challenges (Extends Pillar 5)

**The gap:** The Accountability Layer (Pillar 5) shipped with partners and weekly emails. The group challenges spec was written but not built. This is the natural next step.

**What it would do** *(full spec already in Pillar 5 above)*:
- 2–8 person group challenges
- Types: streak challenge, protein goal challenge, workout count challenge
- Anonymous leaderboard (optional name reveal)
- Push notifications when anyone in the group hits a milestone
- Time-limited with a clear start/end date

**New additions beyond the Pillar 5 spec:**

- **Challenge templates**: pre-built challenges a user can launch immediately (e.g. "Dry January", "Workout 3× a week for a month", "Hit protein goal every day this week")
- **Challenge invites via link**: share a URL that lets someone join the challenge without needing to be an existing accountability partner
- **Post-challenge reflection**: after the challenge ends, an AI-generated summary of how the group did, who hit milestones, and a "ready for the next one?" CTA

**Effort estimate:** 4–5 days (requires `challenges` and `challenge_members` tables from the Pillar 5 data model, plus push notification hooks).

---

### 7.9 — Cardio & VO₂ Max Estimation

**The gap:** The workout tracker handles strength well (sets, reps, weight, 1RM). Cardio is a second-class citizen — it's logged via Strava sync or manual duration entry, but there's no analysis layer for it.

**What it would do:**

**Cardio session logging improvements:**
- For manually logged cardio: add distance, average heart rate (if known), and perceived effort (RPE 1–10)
- Calculate pace (min/km or min/mile) for runs/bikes

**VO₂ Max Estimation:**
- If heart rate + distance + pace are available, estimate VO₂ max using the Cooper/Uth formula
- Plot estimated VO₂ max over time as a "cardiovascular fitness" metric
- Colour-coded fitness category (average, good, excellent for age/sex)

**Training Zones:**
- Based on max HR (220 − age, or user-entered), show which HR zone each cardio session was in
- Pie chart of time spent in each zone over the past month
- AI coaching: "You've been training mostly in Zone 2 (aerobic) — consider a Zone 4 interval session this week to improve your VO₂ max"

**Effort estimate:** 2–3 days for logging improvements and zone charts. VO₂ Max estimation adds 1 more day.

---

### 7.10 — Injury & Soreness Tracking

**The gap:** There's no way to log that your shoulder hurts or that you're experiencing DOMS in your quads. This means the AI coach is blind to physical limitations, and the workout recommendations don't adapt when the user is injured.

**What it would do:**

**Daily "Body Check" prompt** (optional, in the daily log):
- A simple front/back body map: tap to mark areas of soreness or injury
- Severity: mild / moderate / sharp
- Type: DOMS (expected) vs. pain (concerning)

**Workout impact:**
- When an exercise targets a muscle group marked as injured/painful, show a warning: "You marked your left shoulder as painful yesterday — consider swapping this for a neutral-grip variation"
- AI coach references injury notes: "You've noted shoulder pain for 3 days — have you considered seeing a physio?"

**Recovery tracking:**
- Mark an injury as "resolved" once it's gone
- Plot historical injury frequency by body part — useful for identifying recurring issues ("Your lower back has been flagged 4 times in the last 3 months")

**Effort estimate:** 3–4 days. The body map UI is the most complex element; the workout warning logic is relatively simple.

**Why it matters:** Injury is the number one cause of training programme abandonment. Proactively routing around soreness and flagging recurring issues could meaningfully reduce injury-related churn.

---

### 7.11 — Apple Health & Google Health Connect (Native Integration)

**The gap:** This was in Pillar 6 as a "future / native required" item. The app is now published natively via Capacitor, which means HealthKit and Health Connect are now technically accessible via Capacitor plugins.

**What it would do:**
- Install `@capacitor-community/health` (or `capacitor-healthkit`)
- Read from Apple Health: steps, active energy, HRV, resting HR, sleep analysis, workouts, body weight
- Read from Google Health Connect (Android): same data categories
- Write back: log workouts to Health, log body weight entries
- De-duplicate against existing Strava and manual entries

**Specific high-value data not available from other sources:**
- Steps (passive, no manual input required)
- Resting heart rate trend (powerful for fitness tracking)
- HRV from Apple Watch (higher quality than Oura for users who have both)
- Sleep staging from iPhone (even without Apple Watch, iPhone motion-based sleep is reasonable)

**Effort estimate:** 4–6 days. The Capacitor native layer is already there; this is mostly plugin installation and the sync/de-dup logic.

**Why it matters:** Most users who downloaded a native fitness app already have Apple Health or Google Fit as their health data hub. Auto-syncing steps and HRV removes the biggest remaining source of manual friction.

---

### 7.12 — Meal Prep & Batch Cooking Mode

**The gap:** The nutrition planner generates meal plans for the week, but there's no support for the "meal prep Sunday" workflow — where a user cooks in bulk and eats from containers throughout the week.

**What it would do:**

**Batch cooking calculator:**
- From a meal plan, select meals to batch-cook and specify number of servings
- Ingredients scaled up automatically; shopping list updated with batch quantities

**Prep schedule:**
- Designate a "prep day" (typically Sunday); receive a reminder
- On prep day, a modal shows all meals to cook with consolidated ingredient list
- Mark prep items as done (e.g. "grilled chicken: ✓ done")

**Container logging:**
- Log a meal as "prepped" — it's available in the daily log as a quick-tap option for multiple days
- Portion count tracked: "3 of 5 containers remaining"

**Effort estimate:** 3–4 days building on the existing `/nutrition` page infrastructure.

---

### 7.13 — Voice Journal & Mood Log

**The gap:** The app has a stress level slider and an energy slider, but no qualitative log — users can't record *why* they're stressed or how their day went. A voice journal would add a layer of narrative context that makes the AI coaching far richer.

**What it would do:**
- A "Daily Note" field in the daily log (free text or voice input via existing `VoiceInput` component)
- Transcribed and summarised by Claude Haiku (< 2 cents per entry)
- Sentiment extracted: positive / neutral / negative — feeds into the correlation engine as a "mood quality" signal
- AI coach can reference journal entries: "You mentioned feeling overwhelmed at work on Wednesday — combined with your sleep dip, that explains the low energy Thursday"
- Searchable journal history in the Coach tab ("What was I feeling during my last deload week?")

**Effort estimate:** 2 days. The voice + transcription infrastructure already exists in `VoiceInput`.

---

### 7.14 — Running a Second Language (Expand i18n Beyond FR)

**The gap:** The English/French toggle shipped in the latest commits. The infrastructure exists, but it's limited to two languages.

**Candidate languages to add:**
- Spanish (est. 50M+ fitness app users in LATAM + Spain)
- German (strong fitness culture, high app spend)
- Portuguese (Brazil is one of the largest fitness markets globally)
- Japanese (high engagement, strong premium app market)

**What it requires:**
- Translation strings added to the existing i18n framework
- AI coach system prompts translated (or instructed to respond in the user's chosen language, which is already being done per the recent commit)

**Effort estimate:** 1 day per language for strings (using Claude to generate translations and a human review pass). The infrastructure is already done.

---

### Summary Table — New Feature Ideas

| # | Feature | Impact | Effort | Priority |
|---|---|---|---|---|
| 7.3 | Contextual Smart Notifications | Very High | Low (2–3d) | ⭐⭐⭐⭐⭐ |
| 7.1 | Hydration Tracking | High | Very Low (1–2d) | ⭐⭐⭐⭐⭐ |
| 7.4 | Sleep Optimisation Module | Very High | Medium (3–4d) | ⭐⭐⭐⭐☆ |
| 7.5 | Body Composition Projections | High | Low (2–3d) | ⭐⭐⭐⭐☆ |
| 7.6 | Mindfulness & Stress Module | High | Low (2–3d) | ⭐⭐⭐⭐☆ |
| 7.2 | Supplement Tracking | Medium | Low (2–3d) | ⭐⭐⭐☆☆ |
| 7.9 | Cardio & VO₂ Max Estimation | High | Medium (3–4d) | ⭐⭐⭐☆☆ |
| 7.10 | Injury & Soreness Tracking | High | Medium (3–4d) | ⭐⭐⭐☆☆ |
| 7.13 | Voice Journal & Mood Log | High | Low (2d) | ⭐⭐⭐☆☆ |
| 7.7 | Monthly Health Report PDF | Medium | Medium (3–4d) | ⭐⭐⭐☆☆ |
| 7.8 | Group Fitness Challenges | High | Medium (4–5d) | ⭐⭐⭐☆☆ |
| 7.11 | Apple Health / Google Health Connect | Very High | High (4–6d) | ⭐⭐☆☆☆ |
| 7.12 | Meal Prep & Batch Cooking | Medium | Medium (3–4d) | ⭐⭐☆☆☆ |
| 7.14 | Additional Languages | Medium | Low per language | ⭐⭐☆☆☆ |

---

## Quick Wins Appendix

These are bugs or small features that could each ship in a day or less. Not a pillar, but worth doing.

### Bugs to Fix

| Issue | Fix | Status |
|---|---|---|
| `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` | ❓ Verify |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties | ✅ Fixed (chunk 4+5 commit) |
| Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' \| 'log')` variant | ✅ Fixed (quick wins batch) |
| `WorkoutChatModal` vs `/coach` overlap and confusion | Add labels distinguishing them | ❓ Verify |
| Body metrics photo = URL text field | Replace with Supabase Storage upload | ✅ Fixed (v1.2) |
| Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern | ✅ Fixed (quick wins batch) |
| Workout Spotter fails silently on Firefox | Show a browser compatibility warning | ❓ Verify |
| Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding | ✅ Addressed in onboarding flow |

### Small Features

| Feature | Description | Effort | Status |
|---|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page | 1h | ❓ Verify |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert throughout | 1 day | ✅ Shipped v1.4 |
| Saved Meals (quick version) | Save a group of food items as a named meal | 1 day | ✅ Shipped v1.2 |
| Log reminder smart skip | Skip evening reminder if user has already logged today | 2h | ❓ Verify |
| Streak type selector | Let users choose: any log vs. movement only | 1h | ✅ Shipped (quick wins batch) |
| Equipment quick-pick expansion | Add Barbell, Cable, TRX, Medicine Ball, Battle Ropes | 30min | ❓ Verify |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` | 1h | ❓ Verify |
| Autosave indicator | "Saved ✓" dot in DailyLogForm | 1h | ❓ Verify |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) across log tabs | 2h | ❓ Verify |
| Coach chat history sync | Move from localStorage to Supabase | 1 day | ✅ Shipped v1.2 |

### New Quick Wins (Post-v2.0 Ideas)

| Feature | Description | Effort |
|---|---|---|
| Water intake quick-tap | 3 buttons in daily log: +1 glass / +500ml / custom | 2h |
| Workout notes field | Free-text note on a completed workout session (e.g. "felt strong, shoulder tight") | 1h |
| Share a PR | One-tap share card for a new personal record (extends existing share infrastructure) | 2h |
| Program week preview | Before starting a new program week, show a modal summary of the coming sessions | 2h |
| "Rest day" badge | Award XP and a badge for a properly logged rest day with sleep ≥ 3/5 | 1h |
| Nutrition page shortcut | Long-press the log button in bottom nav to go directly to `/nutrition` | 30min |
| Dark mode OLED variant | True black (#000) variant for OLED screens — saves battery, popular on Android | 2h |
| In-app changelog | Show a "What's New" badge on the settings cog when a new version deploys | 1h |

---

## Prioritisation Matrix (Updated 2026-06-01)

*Reflects what has already shipped. Rows marked ✅ are done; remaining rows are the live backlog.*

| Item | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Readiness Score | Very High | High | ★★★★★ | ⚠️ Do first — data already exists |
| Correlation Engine | Very High | High | ★★★★★ | 🔴 Do first — data already exists |
| Progressive Overload Alerts (in-session) | High | Very High | ★★★★★ | ⚠️ 1RM exists, just needs UI |
| Contextual Smart Notifications (7.3) | Very High | High | ★★★★★ | 🔴 New idea |
| Hydration Tracking (7.1) | High | Very High | ★★★★☆ | 🔴 New idea — trivial to add |
| Sleep Optimisation Module (7.4) | Very High | High | ★★★★☆ | 🔴 New idea |
| Body Composition Projections (7.5) | High | High | ★★★★☆ | 🔴 New idea |
| Mindfulness & Stress Module (7.6) | High | High | ★★★★☆ | 🔴 New idea |
| Voice Journal & Mood Log (7.13) | High | High | ★★★★☆ | 🔴 New idea |
| Accountability Group Challenges (7.8 / Pillar 5) | High | Medium | ★★★☆☆ | 🔴 Specced in Pillar 5 |
| Supplement Tracking (7.2) | Medium | Very High | ★★★☆☆ | 🔴 New idea |
| Cardio & VO₂ Max (7.9) | High | Medium | ★★★☆☆ | 🔴 New idea |
| Injury & Soreness Tracking (7.10) | High | Medium | ★★★☆☆ | 🔴 New idea |
| Monthly Health Report PDF (7.7) | Medium | Medium | ★★★☆☆ | 🔴 New idea |
| Apple Health / Google Health Connect (7.11) | Very High | Medium | ★★★☆☆ | 🔴 Now feasible (native app exists) |
| Meal Prep Mode (7.12) | Medium | Medium | ★★☆☆☆ | 🔴 New idea |
| Additional Languages (7.14) | Medium | Low per lang | ★★☆☆☆ | 🔴 i18n infra exists |
| Nutrition Planning (Full Meal Planner) | High | — | ✅ | Shipped v1.3 |
| 12-Week Programs | High | — | ✅ | Shipped v1.5 |
| Accountability Partners + Email | Very High | — | ✅ | Shipped v1.4 |
| Withings / Oura Integrations | High | — | ✅ | Shipped v1.4 |

---

## Recommended Next Sprint

Three outstanding original-PRD items that require no new infrastructure — the data is already being collected:

1. **Readiness Score UI** (2–3 days) — pull from Oura if connected, else calculate from existing log fields; show on dashboard as a coloured score with AI explanation
2. **Correlation Engine v1** (3–4 days) — nightly cron, Pearson correlations across existing `daily_logs`, top 2–3 shown as an insight card on the dashboard
3. **Progressive Overload Alert** (1 day) — in the active workout, above each exercise show: "Last time: 3×10 @ 60kg. Suggested today: 3×10 @ 62.5kg"

Then from the new ideas, the three highest-leverage additions:

4. **Hydration Tracking** (1–2 days) — feeds immediately into the Correlation Engine
5. **Contextual Smart Notifications** (2–3 days) — highest daily engagement impact
6. **Body Composition Projections** (2 days) — uses Withings data that's already syncing

Total: ~12–15 days of development for a sprint that would make the app feel genuinely transformative.

---

*Document last updated 2026-06-01. Original six pillars mostly shipped — highest remaining priorities are the Correlation Engine, Readiness Score UI, and in-session Progressive Overload Alerts. Section 7 contains 14 new feature ideas for review.*
