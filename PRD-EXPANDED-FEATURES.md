# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (original proposal) — re-audited 2026-07-14 — **re-audited against the live codebase on 2026-07-18**  
**Status:** Living document — 3 of 6 original pillars now shipped; see status table below. An unplanned WearOS companion app (Pillar 7, outside original scope) shipped 2026-07-18. New brainstormed ideas added at the bottom for review.

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

**2026-07-14 update:** Since this was written, Nutrition Planning, Periodisation, and the Accountability Layer have all shipped (and the Accountability Layer went further than specced). Withings and Oura integrations are live. Every Quick Win in the appendix is done. The two pillars that matter most and remain untouched are **Correlation Engine** and **Recovery & Readiness Score** — see "What's Outstanding" below. A new "Brainstorm — New Feature Ideas" section has been added at the end for review; nothing in it has been built.

**2026-07-18 update:** A full WearOS companion app shipped (device pairing, live workout tracking with heart-rate capture, voice food logging, a Today tile, and a calories complication) — see new Pillar 7 below. This wasn't part of the original six pillars. Also shipped: a UI/UX audit pass (accessible modals, shared error states, nav IA cleanup) and an auth-hardening pass on the AI API routes (one route, `recommend-workout`, still lacks enforced auth — see New Small Gaps). **Correlation Engine** and **Recovery & Readiness Score** remain the top-priority gaps; none of this work changes that ranking.

---

## Current State (What Exists) — corrected 2026-07-18

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system, exponential XP curve |
| Trends & analytics | ✅ Charts across 5 dimensions, PRs, muscle heatmap |
| AI coaching chat | ✅ Context-aware, synced across devices via `coach_messages` |
| Push notifications | ✅ Server-side, custom reminders, smart-skip if already logged |
| Strava sync | ✅ Manual sync |
| Withings integration | ✅ OAuth + auto weight/body-comp sync |
| Oura integration | ✅ OAuth + sync (readiness/sleep pulled but only mapped into 1–5 fields — see Pillar 6 gap) |
| Goal Wizard | ✅ Entry point added (Settings banner) |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Real photo upload (Supabase Storage) |
| Social / sharing | ✅ Full accountability + workout-partner system (partnerships, nudges, challenges) — see note on duplication below |
| Nutrition planning | ✅ `/nutrition` page — weekly planner, AI generation, saved meals, pantry scan. Missing: grocery list export |
| Periodisation / progressive overload | ✅ `/programs` — AI 12-week programs, Epley 1RM, deload weeks. Missing: overload *suggestion* on freestyle (non-program) sets |
| Recovery / readiness | 🔴 Still not started — highest-priority gap |
| Correlation / insight engine | 🔴 Still not started — highest-priority gap |
| Wearable integrations | 🟡 Withings + Oura done; Apple Health / Google Fit absent (native-app blocker, as originally scoped) |
| WearOS companion app | ✅ Native Kotlin/Compose app (`android/wear/`) — device pairing, live workout session with HR capture, voice food logging, Today tile, calories complication. Sideload-only (no Play Store listing yet); not part of the original six pillars — see Pillar 7 |

**Known tech debt (not a feature, flagging for awareness):** there are now two parallel accountability systems — the original lightweight `accountability_partners` (email summary only) from this PRD, and a newer, richer `partnerships`/`challenges` system built later. They overlap in purpose. Worth consolidating at some point, but not urgent.

---

## What's Outstanding — and What's Highest Priority

Of the original six pillars, two remain completely unbuilt, and they're the two the original "Recommended Sprint 1" called out as the best ROI:

1. **Recovery & Readiness Score (Pillar 4)** — This is now *cheaper* to build than when it was written. The Oura integration already pulls real readiness and sleep-staging data server-side (`api/integrations/oura/sync`); it's currently being lossily discarded into `daily_logs.energy_level`/`sleep_quality` instead of surfaced. A first version could ship using data that's already flowing in, no new integration work required, for Oura-connected users — with the original client-side formula as a fallback for everyone else.
2. **Correlation Engine & Insight Feed (Pillar 1)** — Still zero code beyond the generic AI weekly summary. All the input data (sleep, stress, energy, alcohol, protein, movement) has been sitting in `daily_logs` this whole time, so this remains a pure-software feature — no schema blockers.

Recommendation: these two are still the highest-leverage next build, in that order (Readiness Score first — it's a daily-visible hook and is now unusually cheap given the unused Oura data).

Secondary, smaller gaps worth closing opportunistically:
- Grocery list export (Pillar 2 gap)
- Freestyle-workout overload suggestion, not just a placeholder (Pillar 3 gap)
- `sleep_records` table to stop discarding Oura's sleep-staging/HRV detail (Pillar 6 gap — also a prerequisite for a good Readiness Score)

---

## The Six Pillars (+ one unplanned)

1. **Correlation Engine & Insight Feed** 🔴 not built — surface *why* you feel good or bad
2. **Intelligent Nutrition Planning** ✅ shipped — close the loop from tracking to planning
3. **Periodisation & Progressive Overload** ✅ shipped — turn workout history into a training program
4. **Recovery & Readiness Score** 🔴 not built — a daily signal that answers "should I train hard today?"
5. **Accountability Layer** ✅ shipped (and expanded) — gentle social pressure without the social media toxicity
6. **Health Platform Integrations** 🟡 partially shipped — Apple Health, Google Fit, Oura, Withings
7. **WearOS Companion App** ✅ shipped — outside the original scope; see below

Plus an **appendix of quick wins** — bugs and small features that could ship in a day each (✅ all done as of 2026-07-14).

---

---

## Pillar 1 — Correlation Engine & Insight Feed

> **Status (2026-07-14): 🔴 Not built.** Only the pre-existing generic AI weekly summary (`generateWeeklyInsights`) exists — no `insights_cache`, no correlation math, no dashboard insight card, no "why do I feel this way" quick-ask. Everything below is still an accurate spec to build against.

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

> **Status (2026-07-14): ✅ Shipped.** `/nutrition` page with Today / Plan / Meals / Pantry tabs, AI weekly meal generation, `saved_meals` CRUD, and a pantry-photo-scan flow that goes beyond this original spec. Coach can push planned meals in via MCP tools. **Remaining gap: no Smart Grocery List export**, and macro-cycling isn't a distinct visible overlay (though the generation prompt can be steered toward it). Spec below kept for reference on the grocery list piece.

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

> **Status (2026-07-14): ✅ Shipped.** `/programs` page with AI-generated 12-week programs (goal picker, phases, auto-set deload week), `training_programs`/`exercise_records` tables, Epley 1RM tracking with PR toasts, and a Gains/Muscle-Heatmap view in Trends. **Remaining gap: the Progressive Overload Alert is only solved for program-based training** (weights are computed from %1RM automatically); freestyle/ad-hoc workout sets still just show the last session's numbers as an input placeholder, not a computed "try 62.5kg today" suggestion. The algorithm below is still unbuilt for that path.

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

> **Status (2026-07-14): 🔴 Not built.** No `readiness_scores` table, no score anywhere in the app, no dashboard card. Notably, the Oura integration (shipped after this doc was written) already fetches Oura's own readiness and sleep data server-side — it's currently discarded into `daily_logs.energy_level`/`sleep_quality` rather than surfaced. This makes a v1 of this pillar cheaper than originally scoped: Oura-connected users could get real gold-standard readiness immediately, with the client-side formula below as the fallback for everyone else. **This and Pillar 1 are the highest-priority remaining work.**

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

> **Status (2026-07-14): ✅ Shipped — and exceeded.** Beyond the `accountability_partners` email-summary system specced below (still present, still working), a richer `partnerships`/`partner_nudges`/`challenges`/`challenge_members` system now exists: in-app partner dashboards, one-tap streak-shield nudges (exactly as specced — "hasn't logged today, send encouragement?"), and anonymous-by-default group challenges with milestone push notifications. The two systems overlap and could eventually be consolidated, but both work today.

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

> **Status (2026-07-14): 🟡 Partially shipped.** Withings (full OAuth + auto weight/body-comp sync into `body_metrics`) and Oura (full OAuth + sync) are both live in Settings. Apple HealthKit and Google Fit/Health Connect remain entirely unbuilt, as expected — both require a native app shell, which is still the correct reason to defer them. **Gap worth closing:** there's no `sleep_records` table — Oura's sleep-staging and HRV data is being squashed into the existing 1–5 `sleep_quality` field instead of stored raw, which also blocks a good Readiness Score (Pillar 4).

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

## Pillar 7 — WearOS Companion App (unplanned, shipped 2026-07-18)

> Not part of the original six pillars — added after a feasibility/design doc (`6404094`) prompted a full build-out. Native Kotlin/Compose-for-WearOS app at `android/wear/`, sideloaded via ADB (no Play Store listing yet).

**What shipped:**
- **Device pairing** — the watch generates a key and sends only its hash to `/api/pair/start`; claimed from Settings → Pair a Device in the web app.
- **Live workout session** — real-time set/rep tracking with heart-rate capture from the watch's sensor.
- **Voice food logging** — spoken input routed through `/api/ai/process-intent` into the same `log_food` MCP tool the web app uses.
- **Today tile** — calories arc + macros remaining, dual rings, one-tap log actions.
- **Watch-face complication** — calories-remaining, updates every 30 minutes.

Everything writes through the existing MCP tools against the existing `daily_logs`/`workouts` tables — no new nutrition/workout schema. Two new migrations: `pairing_requests` (device pairing) and a `timezone` column on `user_settings` (so "today" resolves correctly on-device).

**Known gap:** `android/wear/README.md` still lists live workout tracking, voice logging, and tiles as "not yet built" — stale, left over from the original scaffold commit.

---

## Quick Wins Appendix

> **Status (2026-07-14): ✅ All items below — every bug and every small feature — verified fixed/shipped in the current codebase.** Kept here as a record. See "New Small Gaps" underneath for the handful of freshly-identified quick wins that replace this list going forward.

These are bugs or small features that could each ship in a day or less. Not a pillar, but worth doing.

### Bugs to Fix — all fixed

| Issue | Fix |
|---|---|
| ✅ `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` |
| ✅ Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties |
| ✅ Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' | 'log')` variant; let user choose streak type in settings |
| ✅ `WorkoutChatModal` vs `/coach` overlap and confusion | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" |
| ✅ Body metrics photo = URL text field | Replace with real Supabase Storage upload (same code as Progress Photos) |
| ✅ Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern |
| ✅ Workout Spotter fails silently on Firefox | Show a browser compatibility warning |
| ✅ Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding |

### Small Features — all shipped

| Feature | Description | Effort |
|---|---|---|
| ✅ Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h |
| ✅ Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day |
| ✅ Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day |
| ✅ Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h |
| ✅ Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h |
| ✅ Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min |
| ✅ XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h |
| ✅ Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h |
| ✅ Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h |
| ✅ Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day |

### New Small Gaps (identified 2026-07-14 / 2026-07-18 audits — not yet built)

| Item | Description | Effort |
|---|---|---|
| Smart grocery list export | Consolidate a filled meal plan into a categorized, exportable grocery list (Pillar 2 gap) | 1 day |
| Freestyle overload suggestion | Show a computed "try +2.5kg" suggestion (not just a placeholder) on ad-hoc workout sets, using the algorithm already specced in Pillar 3 | 1 day |
| `sleep_records` table | Stop discarding Oura's sleep-staging/HRV detail into the 1–5 `sleep_quality` field; store it raw (Pillar 6 gap, also unblocks a better Readiness Score) | 1 day |
| Consolidate accountability systems | Merge/retire the older `accountability_partners` email-only system now that `partnerships` covers its use case, to reduce maintenance surface | 1–2 days |
| `recommend-workout` route missing enforced auth | Unlike the other 6 AI routes hardened in #31, `/api/ai/recommend-workout` reads an optional Authorization header but never 401s if it's absent — callable unauthenticated (personalization just silently degrades) | <1h |

---

## Prioritisation Matrix — original (2026-05-20), kept for history

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

| Pillar | Impact | Feasibility | Score | Recommended Sequencing | Status 2026-07-14 |
|---|---|---|---|---|---|
| Quick Wins | Medium | Very High | ★★★★★ | Ship first (continuous) | ✅ Done |
| Readiness Score | Very High | High | ★★★★☆ | Sprint 1 — no new tables, just logic | 🔴 Still open — top priority |
| Correlation Engine | Very High | High | ★★★★☆ | Sprint 1 — data already exists | 🔴 Still open — top priority |
| Nutrition Planning (Saved Meals only) | High | High | ★★★☆☆ | Sprint 2 — start with saved meals | ✅ Done (full planner, not just saved meals) |
| Periodisation (Overload Alerts only) | High | High | ★★★☆☆ | Sprint 2 — active workout is already there | 🟡 Done for programs; freestyle alert still open |
| Accountability (Partner only, no challenges) | Very High | Medium | ★★★☆☆ | Sprint 3 | ✅ Done (challenges too) |
| Withings Integration | High | Medium | ★★★☆☆ | Sprint 3 | ✅ Done |
| Oura Integration | High | Medium | ★★★☆☆ | Sprint 3 | ✅ Done (sync exists; data underused — see Pillar 4/6) |
| Nutrition Planning (Full Meal Planner) | High | Low | ★★☆☆☆ | Sprint 4 | ✅ Done |
| Group Challenges | Medium | Medium | ★★☆☆☆ | Sprint 4 | ✅ Done |
| 12-Week Programs | High | Low | ★★☆☆☆ | Sprint 4 | ✅ Done |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Future (requires native app) | 🔴 Still open (expected — needs native shell) |

---

## Recommended Next Sprint (as of 2026-07-14)

With three pillars shipped, the highest-ROI remaining work is unchanged from the original recommendation — it just got cheaper:

1. **Readiness Score v1** (1–2 days now, down from 2–3 — Oura readiness/sleep data is already being fetched, just needs surfacing; client-side formula as fallback for non-Oura users)
2. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card
3. **`sleep_records` table** (half a day) — do this alongside Readiness Score so Oura's raw sleep-staging/HRV data stops being discarded
4. **Freestyle Progressive Overload suggestion** (1 day) — extend the existing program-based logic to ad-hoc sets
5. **Smart grocery list export** (1 day) — closes the one remaining Nutrition Planning gap

Total estimated effort: ~7–9 days. This closes out the entire original PRD.

---

## Brainstorm — New Feature Ideas (2026-07-14, + item I added 2026-07-18, for review — nothing here has been built)

These go beyond the original six pillars. They're sized as ideas, not full specs — flag which ones (if any) you want turned into a full pillar-style spec before building. Ordered roughly by how directly they build on infrastructure that already exists (cheaper/lower-risk first).

### A. Cycle-Aware Training & Nutrition
**Problem:** `enable_cycle_tracking` exists and collects data, but nothing downstream uses it — it's inert. **Idea:** feed cycle phase into the (currently missing) Readiness Score, the AI coach's training suggestions, and program generation — e.g. suggest lower-intensity sessions and iron/protein-forward meals during the luteal/menstrual phase. **Why now:** the data is already being collected and just sitting unused; this is the single highest-leverage way to make that toggle worth having on. Rough effort: Medium (mostly prompt/logic work once Readiness Score exists to hook into).

### B. Injury / Pain Log + Smart Substitutions
**Problem:** no way to flag "my shoulder hurts" — the app will happily keep recommending overhead press. **Idea:** a quick body-map tap to log pain/soreness by region (pre- or post-workout), which the AI coach and program generator then avoid loading for a configurable window, offering substitute exercises automatically. Could also correlate pain spikes against recent volume (ties directly into the Periodisation data already being tracked). **Why now:** injury is a top reason people quit training apps; this is a safety/retention feature most competitors skip. Rough effort: Medium-Large (new table, UI, substitution logic in program generation + AI coach prompt).

### C. Sleep-Staging Trends & Better Readiness (extends Pillar 4/6 gap)
**Problem:** already called out as a gap — Oura's rich sleep data is being thrown away. **Idea:** once `sleep_records` exists, add trend charts for REM/deep/light sleep and HRV over time, and let the Readiness Score cite specific stages ("your deep sleep was 40% below average last night") rather than just a single 1–5 number. **Why now:** the data is already flowing in from a live integration — this is pure UI/analysis on top of existing pipes. Rough effort: Small once `sleep_records` exists.

### D. Equipment-Aware Workout Generator (photo scan)
**Problem:** traveling users or anyone in an unfamiliar gym have no fast way to get a session that matches what's actually in front of them. **Idea:** reuse the exact pattern already proven for pantry scanning (`api/nutrition/pantry/scan`) — snap a photo of the equipment rack/gym floor, AI identifies available equipment, generates a session using the existing equipment-tag system. **Why now:** the AI-photo-to-structured-data pattern is already built and working for nutrition; this is the same pattern applied to a new domain, which lowers implementation risk substantially. Rough effort: Medium.

### E. AI Form Check via Video
**Problem:** Workout Spotter does voice rep-counting but gives no feedback on *how* the lift looked. **Idea:** let users upload a short clip of a set for key lifts (squat, deadlift, bench) and get AI vision-based cues (depth, bar path, obvious knee valgus) using Claude's vision capability. **Why now:** natural extension of the app's AI-first identity, and a real safety/quality feature competitors mostly don't have at this depth. Rough effort: Large (video handling, vision prompt engineering, needs real validation before trusting form cues).

### F. Coach-as-Partner Mode
**Problem:** the app now has both an AI coach and a rich partner/accountability system, but they don't intersect — a human trainer can't be added as a "partner" with elevated visibility into program adherence. **Idea:** let a `partnerships` relationship optionally carry a "coach" role with read access to program compliance, PR history, and the ability to leave notes the AI coach also sees. **Why now:** this is largely wiring together two systems that already exist (`partnerships` + `training_programs` + `coach_messages`), and opens a path toward paid human-coach relationships later. Rough effort: Medium.

### G. Annual/Quarterly Recap ("Wrapped" for fitness)
**Problem:** a year-plus of rich data (PRs, total volume, streaks, meals logged, workout partner nudges) never gets reflected back to the user in a way that feels rewarding. **Idea:** an auto-generated, shareable recap at year-end or account anniversary — biggest PRs, total weight lifted, longest streak, most-hit macro target — as a shareable image/card. **Why now:** almost entirely a read-and-render feature over data that already exists; doubles as a low-cost growth/re-engagement loop if made shareable. Rough effort: Small-Medium.

### H. Consolidated Grocery + Budget-Aware Meal Planning
**Problem:** the grocery-list gap (already flagged above) is worth extending rather than doing minimally. **Idea:** beyond a plain categorized list, estimate per-item/total cost and let users set a weekly grocery budget that steers AI meal generation (e.g. "keep this week's plan under $80"). **Why now:** builds directly on the meal-plan generation prompt that already exists; budget-aware planning is a commonly requested feature this app doesn't have any story for yet. Rough effort: Medium.

### I. Workout Heart-Rate Trends (extends WearOS Pillar 7)
**Problem:** the WearOS app now captures heart rate live during workout sessions, but that data goes nowhere beyond the session itself — no trend view, no use in Progressive Overload or a future Readiness Score. **Idea:** surface average/max HR per workout in Trends, and eventually weight HR-based intensity (time-in-zone) into overload and readiness logic instead of relying on subjective "hard/moderate/light" self-report. **Why now:** the data is already being captured from a real sensor as of this WearOS ship — same "data exists, nothing reads it" pattern as the Oura sleep-staging gap. Rough effort: Small-Medium.

### Considered / Not Pursued

*(none yet — tracks brainstormed ideas reviewed and explicitly declined, so they aren't re-suggested in future audits.)*

---

*Document living as of 2026-07-18. Original proposal author: Claude. Status audit and brainstorm section: Claude. Questions, pushback, or which brainstormed ideas to spec out further — flag them and I'll revise.*
