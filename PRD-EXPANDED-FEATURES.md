# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (originally) — **reviewed and updated 2026-07-13**  
**Status:** Proposal — for review. See "Status Update — 2026-07-13" below for what has shipped since this was first written.

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Status Update — 2026-07-13

Eight weeks and a lot of shipping since this was first written. Quick summary of what changed and what to focus on next — full detail is inline under each pillar below (look for the **Status:** line under each heading).

**Fully shipped:** every single item in the original Quick Wins Appendix (8 bugs + 9 of 10 small features — only the persistent macro summary bar is still open).

**Substantially built (partial, gaps noted inline):**
- **Pillar 2 (Nutrition Planning)** — `/nutrition` page, meal plans, saved meals, AI-generated plans, and rich MCP coach tools (recurrence, skip/swap, plan-vs-actual) all shipped. Still missing: the Smart Grocery List and an explicit macro-cycling overlay.
- **Pillar 3 (Periodisation & Overload)** — full AI-generated 12-week programs, Epley 1RM tracking with PR toasts, and a muscle-group volume heatmap all shipped. Still missing: the specific per-exercise progressive-overload suggestion ("try 3×10 @ 62.5kg today") and adaptive deload detection outside the pre-baked program.
- **Pillar 5 (Accountability)** — partner invites and a weekly summary exist in Settings. Still missing: the automated Sunday cron (it's a manual "Send Summary" button today), an in-app partner dashboard, Streak Shield nudges, and Group Challenges (not started at all).
- **Pillar 6 (Integrations)** — Oura and Withings are both fully live (OAuth + sync). Apple Health / Google Fit are still not started, though the Capacitor iOS/Android shells that would host them already exist — this lowers the effort bar the original PRD assumed.

**Not started at all:** Pillar 1 (Correlation Engine & Insight Feed) and Pillar 4 (Recovery & Readiness Score). Neither has any code, table, or cron behind it yet.

**Highest priority right now:** Pillars 1 and 4 were the two items the original Sprint 1 called out as highest-ROI — no new infrastructure, pure logic on top of data already being captured — and they're the only pillars with zero progress. They're also the two features most likely to make the app feel like it's actually "thinking," rather than just recording. **Recommendation: do these next**, ahead of rounding out Pillars 2/3/5/6's remaining gaps.

Also worth a follow-up housekeeping item, unrelated to any pillar: `supabase/schema.sql` and the root `*_migration.sql` files are stale — several tables now live in production (`training_programs`, `exercise_records`, `accountability_partners`, `meal_plans`, `planned_meals`, `pantry_items`, `mcp_meals`, `integrations`, `coach_messages`, etc.) with no committed migration. Worth reverse-engineering a current schema dump into a proper `supabase/migrations` directory before this drifts further.

New feature ideas beyond the original six pillars are brainstormed in **Pillar 7**, near the end of this document.

---

## Current State (What Exists)

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system, exponential XP curve |
| Trends & analytics | ✅ Charts across 5 dimensions + muscle-group heatmap |
| AI coaching chat | ✅ Context-aware, MCP tools (logs, workouts, scheduling, meal planning), Supabase-synced history |
| Push notifications | ✅ Server-side, custom reminders, smart-skip if already logged |
| Strava sync | ✅ Manual sync |
| Oura / Withings sync | ✅ OAuth + automatic sync (new since May) |
| Goal Wizard | ✅ Entry point added in Settings |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Real photo upload (Supabase Storage), body comp via Withings |
| Nutrition planning | ✅ `/nutrition` page, meal plans, saved meals, AI planning — grocery list still missing |
| Training programs / 1RM tracking | ✅ AI-generated 12-week programs, Epley 1RM, PR toasts — overload suggestion text still missing |
| Accountability (partner) | ⚠️ Partner invites + manual weekly summary — not automated, no challenges |
| Social / sharing | 🔴 Group challenges not started |
| Correlation Engine / Insight Feed | 🔴 Not started |
| Recovery / readiness score | 🔴 Not started |
| Apple Health / Google Fit | 🔴 Not started (Capacitor native shell already exists though) |

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

**Status (2026-07-13): 🔴 Not started.** No `insights_cache` table, no correlation math, no cron, no "Why do I feel this way?" feature. The only related thing that exists is the pre-existing generic AI Weekly Analysis, which this pillar is meant to replace/augment. **This is the highest-priority pillar to build next** — no new infra required, and it's the biggest lever on making the app feel intelligent rather than just a logbook.

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

**Status (2026-07-13): 🟡 Substantially built.** The `/nutrition` page, `meal_plans`/`saved_meals`/`planned_meals`/`pantry_items` tables, AI-generated weekly plans, and MCP coach tools (`plan_meal`, `save_meal`, recurrence, skip/swap, plan-vs-actual comparison) are all shipped — and the MCP recurrence support goes beyond what this doc originally scoped. **Still missing:** the Smart Grocery List (zero code exists for it) and an explicit macro-cycling calendar overlay. Saved Meals is done to a fuller spec than the "quick version" originally recommended for Sprint 2.

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

**Status (2026-07-13): 🟡 Substantially built.** `/programs` generates full AI 12-week periodised programs (accumulation/intensification/realisation/deload phases), Epley 1RM is tracked with PR toast notifications, and a muscle-group volume heatmap covers the "Volume Tracking Dashboard" concept. MCP scheduling tools (`schedule_workout`, recurrence, template swaps) are live. **Still missing:** the specific per-exercise progressive-overload suggestion text ("Last time 3×10 @ 60kg — try 62.5kg today") — there's no `suggestNextSession`-style algorithm anywhere — and adaptive 4-week deload detection outside the pre-baked program's fixed deload week. No "muscle group untouched for 7+ days" flag on the heatmap yet either.

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

**Status (2026-07-13): 🔴 Not started.** No `readiness_scores` table, no daily score, no dashboard card. The Oura integration pulls Oura's own readiness/sleep data but only maps it onto the existing 1–5 `energy_level`/`sleep_quality` fields — it doesn't populate a dedicated score or run the weighted algorithm below, and has no UI surface of its own. **Along with Pillar 1, this is the highest-priority pillar to build next** — the algorithm needs no API calls and no new user input, just logic over data already captured.

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

**Status (2026-07-13): 🟡 Partially built (partner only).** `accountability_partners` table, add/list/remove partner in Settings, and a "Send Summary" endpoint that gathers 7 days of stats all exist. **Still missing:** the summary send is a manual button, not an automated Sunday-evening cron (no such cron entry exists in `vercel.json`); there's no in-app partner dashboard view; no Streak Shield nudge; and Group Challenges (`challenges`/`challenge_members`) are entirely unbuilt.

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

**Status (2026-07-13): 🟡 Oura and Withings shipped; Apple/Google not started.** Both Oura (readiness + sleep staging) and Withings (weight + full body composition, with token refresh) are fully live via OAuth, exactly matching the schema extensions proposed below. **Still missing:** Apple HealthKit and Google Fit/Health Connect. Worth noting: the app already has Capacitor iOS/Android shells (`android/`, `ios/`) wrapping the deployed web app for push notifications — this is exactly the "native shell" prerequisite this section says HealthKit would require, so the effort bar here is now lower than originally estimated (a HealthKit/Health Connect Capacitor plugin, not a whole new native app).

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

**Status (2026-07-13): all 8 bugs and 9 of 10 small features are shipped.** Only "Persistent macro summary bar" remains open — see the ✅/🔴 marks below.

### Bugs to Fix

| Issue | Fix | Status |
|---|---|---|
| `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` | ✅ Fixed |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties | ✅ Fixed |
| Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' | 'log')` variant; let user choose streak type in settings | ✅ Fixed |
| `WorkoutChatModal` vs `/coach` overlap and confusion | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" | ✅ Fixed |
| Body metrics photo = URL text field | Replace with real Supabase Storage upload (same code as Progress Photos) | ✅ Fixed |
| Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern | ✅ Fixed |
| Workout Spotter fails silently on Firefox | Show a browser compatibility warning | ✅ Fixed |
| Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding | ✅ Fixed |

### Small Features

| Feature | Description | Effort | Status |
|---|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h | ✅ Fixed |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day | ✅ Fixed |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day | ✅ Fixed (built to a fuller spec than "quick") |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h | ✅ Fixed |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h | ✅ Fixed |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min | ✅ Fixed |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h | ✅ Fixed |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h | ✅ Fixed |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h | 🔴 Still open |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day | ✅ Fixed (Supabase primary, localStorage fallback) |

---

## Prioritisation Matrix

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

**Status as of 2026-07-13** — most of the original matrix has shipped; this table now reflects what's actually left.

| Pillar / Item | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Wins | Medium | Very High | ★★★★★ | ✅ Done (bar the macro summary bar) |
| Readiness Score | Very High | High | ★★★★☆ | 🔴 Not started — **top priority** |
| Correlation Engine | Very High | High | ★★★★☆ | 🔴 Not started — **top priority** |
| Progressive Overload Alerts (suggestion text) | High | High | ★★★★☆ | 🔴 Not started — quick add-on to Pillar 3 |
| Smart Grocery List | Medium | High | ★★★☆☆ | 🔴 Not started — quick add-on to Pillar 2 |
| Nutrition Planning (Saved Meals + full planner) | High | High | ★★★☆☆ | ✅ Done |
| Periodisation (12-Week Programs + 1RM) | High | Medium | ★★★☆☆ | ✅ Done |
| Withings / Oura Integration | High | Medium | ★★★☆☆ | ✅ Done |
| Accountability — automate weekly summary cron | Medium | Very High | ★★★★☆ | 🔴 Not started — small lift, cron already exists as a pattern |
| Accountability — Group Challenges | Medium | Medium | ★★☆☆☆ | 🔴 Not started |
| Apple Health / Google Fit | Very High | Low–Medium | ★★★☆☆ | 🔴 Not started, but Capacitor shell lowers the bar vs. original estimate |
| **New ideas (Pillar 7, see below)** | — | — | — | See individual scores in that section |

---

## Recommended Sprint 1 (Next 2–4 Weeks) — Original, now mostly complete

The highest-ROI work is features that require **no new infrastructure** — they use data that's already being captured and add intelligence on top:

1. ~~Fix all Quick Win bugs~~ (1–2 days) — ✅ **done**
2. **Readiness Score v1** (2–3 days) — calculated from existing log fields, shows on dashboard — 🔴 **still open, do this next**
3. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card — 🔴 **still open, do this next**
4. **Progressive Overload Alerts** (1–2 days) — show last session + suggestion at top of each exercise in active workout — 🔴 **still open**

Everything else that shipped since May (nutrition planning, 12-week programs, Oura/Withings, accountability partners) moved *faster* than this original sprint plan anticipated — but the two items with the biggest "feels like magic" payoff (Readiness Score, Correlation Engine) haven't been touched. They remain the recommended next sprint, now joined by the smaller add-ons above (overload suggestion text, grocery list, automated accountability cron).

---

## Pillar 7 — New Feature Ideas (Brainstorm, 2026-07-13)

These are new ideas, not in the original six pillars, surfaced while reviewing what's shipped so far. They're sized as brainstorm-level concepts for review — not full specs — so pick whichever resonate and ask for a full spec + data model before building. Ordered roughly by expected impact.

| # | Idea | One-line pitch | Impact | Effort |
|---|---|---|---|---|
| 1 | **Cycle-Aware Coaching** | When cycle tracking is on, have the AI meal planner and program generator adjust macros/training load by cycle phase (e.g. iron-rich suggestions + lower intensity during menstrual/luteal phases) | High | Medium |
| 2 | **Native Health Bridge (Capacitor plugin)** | Add a HealthKit / Health Connect Capacitor plugin to the existing iOS/Android shells to pull steps, active energy, and sleep automatically — the "native app" barrier is already crossed | Very High | Medium |
| 3 | **Proactive AI Nudges** | A background job that watches for risk signals (3-day protein miss, workout gap, stalled program) and sends one specific, actionable push via the existing VAPID infra — distinct from the fixed-time reminder cron | High | Medium |
| 4 | **Injury / Pain Log + Safe Substitution** | One-tap "this body part is sore" flag; the program generator and AI coach automatically avoid or swap exercises that load it for N days | High | Medium |
| 5 | **Eating-Out Mode** | Extend the existing menu/pantry photo-scanning pipeline to scan a restaurant menu and get AI-ranked picks against today's remaining macros | Medium-High | Low-Medium |
| 6 | **Year-in-Review Recap** | A shareable, opt-in "Wrapped"-style recap card (streaks, PRs, workouts, XP) exportable as an image — private-by-default social payoff without building a real social network | Medium | Low |
| 7 | **Data Export & Ownership** | One-click CSV/PDF export of full log/workout/metrics history from Settings — trust and portability, and a quick build | Medium | Low |
| 8 | **Companion Home-Screen Widget** | Native iOS/Android widget (via Capacitor) showing today's streak, remaining macros, and (once built) readiness score without opening the app | Medium-High | Medium |
| 9 | **Household / Shared Plan** | A lightweight two-person mode (e.g. couples) sharing one meal plan and grocery list — a smaller, more useful slice of "social" than full Group Challenges | Medium | Medium |
| 10 | **Additional Languages** | Extend the existing EN/FR toggle infrastructure to Spanish/German/Portuguese — low incremental cost now that the plumbing exists | Low-Medium | Low |

### Notes on a few of these

**#2 (Native Health Bridge)** is worth calling out specifically: the original Pillar 6 treated Apple Health as "Very High effort — requires a native app," but the Capacitor iOS/Android shells built since then for push notifications mean that prerequisite is already satisfied. This meaningfully changes Pillar 6's cost-benefit and could jump the queue.

**#1 (Cycle-Aware Coaching)** turns a currently-passive setting (`enable_cycle_tracking`, off by default) into something the AI coach actively uses — closing a loop that exists in the data model today but isn't acted on anywhere.

**#3 (Proactive Nudges)** and **#4 (Injury Log)** both lean on infrastructure that already exists (VAPID push, the AI coach/program generator) and would compound well with Pillar 1's Correlation Engine once that ships — a nudge like "your energy tanks after 2+ drinks, and you've had drinks 3 nights this week" is exactly the kind of thing both pillars would want to produce together.

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
