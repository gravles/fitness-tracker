# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-07-06)  
**Status:** Proposal — for review

---

## Update — 2026-07-06

Six weeks and a lot of shipping have happened since this PRD was written. Checked the actual codebase and changelog against the six pillars below:

| Pillar | Then | Now |
|---|---|---|
| 1. Correlation Engine & Insight Feed | 🔴 Proposed | 🔴 **Still not started** — no `insights_cache`, no correlation logic anywhere. Only a stateless AI weekly-summary modal exists (predates this PRD). |
| 2. Intelligent Nutrition Planning | 🔴 Proposed | ✅ Mostly shipped (v1.2–1.3, Unreleased) — `/nutrition` page, pantry, saved meals, AI meal plans, coach-pushed plans via MCP. **Grocery list generation is the one piece still missing.** |
| 3. Periodisation & Progressive Overload | 🔴 Proposed | ✅ Mostly shipped (v1.5.0) — 12-week AI programs with real phases, Epley 1RM tracking, PR toasts, deload weeks. **Explicit overload/plateau alerts inside a plain logged workout (no program) are the one piece still missing.** |
| 4. Recovery & Readiness Score | 🔴 Proposed | 🔴 **Still not started** — Oura sync pulls Oura's own readiness number, but there's no first-party score for the majority of users without a ring. |
| 5. Accountability Layer | 🔴 Proposed | ⚠️ Partial (v1.4.0) — partners + weekly summary email shipped. Group challenges, streak-shield nudges, and an in-app partner dashboard were not built. |
| 6. Health Platform Integrations | 🔴 Proposed | ⚠️ Partial (v1.4.0) — Strava, Withings, Oura all shipped. Apple Health / Google Fit still not started — but **native iOS and Android apps now exist** (v2.0.0, via Capacitor), which removes the "requires a native shell" blocker this PRD originally flagged as the reason to deprioritise them. |

**Highest priority right now:** Pillar 1 (Correlation Engine) and the generic (non-Oura) half of Pillar 4 (Readiness Score) are the two items that were rated highest-impact *and* lowest-effort in the original Sprint 1 plan — "no new infrastructure, data already exists" — yet they're the only two pillars with zero code written, while three lower-ranked, higher-effort pillars got fully built instead. Recommend picking these up next, in that order: correlations don't depend on readiness, but readiness's HRV/history-based scoring becomes materially better once the correlation engine exists to validate which signals actually predict how a user performs.

A new brainstorm of additional feature ideas — beyond the original six pillars — is appended at the end of this document, below the Quick Wins Appendix.

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
| Body metrics | ✅ Photo upload shipped (v1.2.0), metric/imperial toggle |
| Social / sharing | ✅ Shareable level cards; accountability partners + weekly email (v1.4.0) |
| Nutrition planning | ✅ Pantry, AI meal plans, saved meals, coach-pushed plans (v1.2–1.3, Unreleased). Grocery lists still missing |
| Periodisation / progressive overload | ✅ 12-week AI programs, 1RM tracking, deload weeks (v1.5.0) |
| Recovery / readiness | 🔴 Not started (Oura's own readiness number passes through, but no first-party score) |
| Correlation / insight engine | 🔴 Not started |
| Wearable integrations | ✅ Strava, Withings, Oura (v1.4.0). Apple Health / Google Fit not started |
| Native apps | ✅ iOS + Android via Capacitor (v2.0.0) |

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

**Status (2026-07-06): 🔴 Not started — highest priority.** Everything below is still an accurate spec.

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

**Status (2026-07-06): ✅ Mostly shipped** in v1.2.0–v1.3.0 and the Unreleased coach-MCP work — pantry, AI-generated meal plans, saved meals, and coach-pushed planned meals all exist. The **Smart Grocery List** described below is the one sub-feature that was never built — no shopping-list generation exists anywhere in the code. The rest of this section is kept for reference / to spec the grocery list.

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

**Status (2026-07-06): ✅ Mostly shipped** in v1.5.0 — 12-week AI-generated programs with real phases, Epley-formula 1RM tracking, PR toasts, and deload weeks are all live. What's still missing is the lighter-weight **in-the-moment overload alert** for a plain logged set (no active program) — nudging "last time you did 3×10 @ 60kg, try 62.5kg today" outside of the structured program flow. No overload/plateau-detection logic exists in the codebase today.

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

**Status (2026-07-06): 🔴 Not started — highest priority, alongside Pillar 1.** Oura sync (v1.4.0) pulls Oura's own readiness number through, but there is no first-party score computed from the app's own data — meaning the (likely majority of) users without an Oura ring have no readiness signal at all. Everything below is still an accurate, buildable spec.

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

**Status (2026-07-06): ⚠️ Partial.** Accountability partners and the weekly summary email shipped in v1.4.0. **Group Challenges, Streak Shield nudges, and the in-app partner dashboard were not built** — the spec below is still accurate for that remaining scope.

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

**Status (2026-07-06): ⚠️ Partial.** Strava, Withings (full body composition), and Oura all shipped in v1.4.0. Apple Health and Google Fit are still not started, **but the "requires a native app" blocker no longer applies** — native iOS and Android apps now exist (v2.0.0, via Capacitor). This meaningfully changes the feasibility column below and is worth re-scoring.

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

**Note (2026-07-06):** given how much has shipped since this list was written, some of these may already be fixed as side effects of later work (e.g. dark mode, unit toggle, Goal Wizard-adjacent settings). Re-verify each against current code before triaging rather than assuming the list is still 100% outstanding.

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

## Prioritisation Matrix (original, 2026-05-20)

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer. **Kept for historical reference** — see the re-scored table below for current status.

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

### What actually happened

Sprints 2–4 landed almost entirely (Nutrition Planning, Periodisation, Accountability partners, Withings, Oura) — but Sprint 1's two items, Readiness Score and Correlation Engine, were skipped and never picked back up, even though they were tied for highest-scored and require no new infrastructure. Apple Health / Google Fit's blocker ("requires native app") no longer holds — native apps now exist.

## Remaining Work — Re-scored (2026-07-06)

| Item | Impact | Feasibility | Score | Notes |
|---|---|---|---|---|
| Correlation Engine & Insight Feed | Very High | High | ★★★★★ | Data already exists; the original blocker (time) is the only blocker |
| Readiness Score (generic, non-Oura) | Very High | High | ★★★★★ | Client-side algorithm, no new infra; feeds off same daily_logs data |
| Smart Grocery List | Medium | High | ★★★☆☆ | Small addition on top of the already-shipped meal planner |
| Overload Alerts (plain logged workouts) | Medium | High | ★★★☆☆ | Programs already have this; extend to non-program workouts |
| Group Challenges | Medium | Medium | ★★☆☆☆ | Partners infra exists; challenges/leaderboard schema still net-new |
| Streak Shield nudge | Medium | Medium | ★★☆☆☆ | Needs partner push-notification trigger logic |
| Apple Health (iOS) | High | Medium | ★★★☆☆ | Native shell now exists (Capacitor) — re-scored up from "Very Low" |
| Google Health Connect (Android) | High | Medium | ★★★☆☆ | Same — native shell now exists |

---

## Recommended Next Sprint

1. **Readiness Score v1** (2–3 days) — calculated client-side from existing log fields, shown on dashboard for every user regardless of wearables
2. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card
3. **Smart Grocery List** (1–2 days) — closes out Pillar 2, the meal planner already produces the structured data it needs
4. **Overload Alerts for plain workouts** (1–2 days) — extends the 1RM/PR logic that already exists in `program-api.ts` to non-program sessions

Total estimated effort: 7–11 days — the same "no new infrastructure" bet as before, now genuinely the highest-leverage work left on the original roadmap.

---
---

# New Feature Brainstorm (Round 2) — 2026-07-06

Everything below is a fresh idea, none of it built, none of it in the original six pillars. These lean on infrastructure that already exists (AI coach + MCP tools, push notifications, Supabase Storage, the share/ shareable-image system, accountability partners, Capacitor native shells) rather than proposing new platforms. Ordered roughly by impact ÷ effort, not strict priority — pick what's interesting.

## Summary Table

| # | Idea | Impact | Effort | Builds on |
|---|---|---|---|---|
| 1 | Year in Data / Wrapped-style recap | High | Low | Existing share/ shareable-card system, streak/XP/workout data |
| 2 | Proactive AI Coach check-ins | High | Low | Existing MCP coach + push notification infra |
| 3 | Doctor/Trainer PDF export | Medium | Low | Existing trends + body metrics data |
| 4 | Cycle-aware training & nutrition | High | Medium | Existing (dormant) cycle tracking field |
| 5 | Adaptive reminder timing | Medium | Low | Existing push notification scheduler |
| 6 | Restaurant / eating-out quick mode | High | Medium | Existing AI food-photo recognition |
| 7 | Injury/niggle log + auto substitution | Medium | Medium | Existing exercise muscle-group tagging (volume tracking) |
| 8 | Race/event countdown & taper mode | Medium | Medium | Existing 12-week AI program engine |
| 9 | Anonymous benchmark comparisons | Medium | Medium | Cross-user aggregate stats, no new social graph |
| 10 | Live co-op workout sessions | Medium | High | Existing accountability partners + active workout tracker |
| 11 | Goal conflict detector | Medium | Medium | Existing nutrition targets + training program engine |

---

### 1. Year in Data — Wrapped-Style Recap

A shareable, beautifully designed recap card (monthly, quarterly, or annual) — total workouts, longest streak, favourite exercise, protein-goal-hit rate, XP earned, a "best week" highlight. Generated as an image using the same rendering path as the existing shareable level cards, so most of the plumbing already exists. High virality potential (this is the single most-copied growth mechanic in consumer apps for exactly this reason) and very low build cost since it's mostly a query + an existing image template.

### 2. Proactive AI Coach Check-Ins

Right now the AI coach only responds when the user opens the chat. Flip it: let the coach *initiate* a conversation via push notification when it detects a pattern worth flagging — a 3-day logging gap, a sudden drop in training volume, a missed-protein-target streak, or a big PR worth celebrating. Uses the same MCP tool suite and push infrastructure already built for scheduling and reminders; the new piece is a lightweight nightly pattern-check (could share the same cron job proposed for the Correlation Engine) that decides whether today warrants a coach-initiated nudge.

### 3. Doctor / Trainer PDF Export

A one-tap "Export Summary" button that generates a clean PDF of body metrics, weight trend, workout history, and training program adherence over a chosen date range — for sharing with a doctor, physio, or personal trainer. Low effort (the data and charts already exist on the Trends and Body Metrics pages; this is a print-friendly render + PDF generation library), but a genuine trust- and retention-builder for users with a real health stake in the app.

### 4. Cycle-Aware Training & Nutrition Adjustments

The app already has a cycle-tracking setting (currently on by default per the Quick Wins bug list — should be off by default, per that same list) but it doesn't do anything with the data yet. Extend it to auto-adjust calorie/macro targets and flag lower-intensity training days by cycle phase, and — once built — feed it into the Readiness Score as a weighted signal. Turns an existing, underused field into real personalisation rather than adding new data collection.

### 5. Adaptive Reminder Timing

Instead of a fixed reminder time, learn the hour a user actually tends to log (a rolling average of their last 2–3 weeks of log timestamps) and shift the push notification to land in that window instead. Directly targets the biggest retention risk called out in Pillar 6 — forgetting to log — without requiring any wearable integration. Small, self-contained change to the existing reminder-scheduling logic.

### 6. Restaurant / Eating-Out Quick Mode

Eating out is the highest-friction, most-often-skipped logging moment. A dedicated quick-entry flow: type a restaurant + dish name, or snap a photo of a menu, and get an AI macro estimate with a visible "estimated" confidence flag rather than false precision. Reuses the existing AI food-photo recognition pipeline; the new part is a menu-text/photo prompt variant and a visual "this is an estimate" treatment in the log.

### 7. Injury / Niggle Log + Auto-Substitution

A quick one-tap way to flag "shoulder tweak" or "knee niggle" against a body part. The app already tags exercises by muscle group for the Volume Tracking Dashboard (Pillar 3) — reuse that mapping to warn before loading a conflicting lift and suggest a substitute exercise mid-workout. Meaningfully reduces injury risk and shows the app understands the user's body, not just their numbers.

### 8. Race / Event Countdown & Taper Mode

Let a user set a target date and event type (5k, powerlifting meet, wedding, holiday) and have the existing 12-week AI program engine back-calculate a taper/peak week automatically into the program it already generates, rather than always defaulting to a flat periodisation curve. Mostly a prompt/logic change to `generate-program`, not new infrastructure.

### 9. Anonymous Benchmark Comparisons

"Your protein consistency is in the top 20% of users this month" — motivation from comparison without the toxicity of a public profile, follower count, or leaderboard. Computed from aggregated, fully anonymised cross-user stats (no names, no visibility into anyone else's data), consistent with the "private, not performative" ethos already established by the Accountability Layer design. Needs a nightly aggregate-stats job and careful anonymisation, but no new user-facing social surface.

### 10. Live Co-Op Workout Sessions

Let an accountability partner "join" a user's active workout in real time — a read-only cheer view with one-tap encouragement (a nudge, a clap, a voice note) that shows up as a push notification mid-set. Turns the existing 1:1 accountability relationship into real-time support during the hardest moment of the day: mid-workout, not after the fact. Highest effort of this batch (needs a lightweight realtime channel, e.g. Supabase Realtime, which isn't wired up anywhere yet) but a genuinely differentiated feature no mainstream fitness app does well.

### 11. Goal Conflict Detector

Many users want conflicting things at once — lose fat *and* gain strength, or train for a marathon *and* build muscle. Right now the nutrition targets and the training program engine are configured independently and can quietly work against each other (aggressive deficit + high-volume hypertrophy program, for instance). A lightweight check when either is set up flags the conflict and proposes a phased approach (e.g. recomp macros + strength-maintenance phase, then a dedicated hypertrophy block after). Ties Pillars 2 and 3 together into something that feels like real coaching judgment rather than two independent tools.

---

*Document ends. Questions, pushback, or additions on either the status update or the new brainstorm — flag them and I'll revise.*
