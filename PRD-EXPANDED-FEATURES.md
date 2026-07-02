# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-07-02)  
**Status:** Proposal — for review

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists) — updated 2026-07-02

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system, streak-type selector |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, Supabase-synced history |
| Push notifications | ✅ Server-side, custom reminders, smart-skip |
| Strava sync | ✅ Manual sync |
| Withings integration | ✅ **Shipped** — weight + body comp auto-sync |
| Oura integration | ✅ **Shipped** — sleep/readiness pulled into daily log |
| Goal Wizard | ✅ Entry point added (Settings) |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Real photo upload (Supabase Storage) |
| Nutrition planning | ✅ **Shipped** — meal plans, saved meals, pantry/grocery list |
| Periodisation / training programs | ✅ **Shipped** — 12-week AI programs, 1RM tracking, PRs |
| Accountability partners | ⚠️ Partner invites + weekly summary shipped; **group challenges not built** |
| Social / sharing | 🔴 Stub only (beyond accountability partners) |
| Recovery / readiness score | 🔴 **Not started** — highest-priority gap, see below |
| Correlation engine / insight feed | 🔴 **Not started** — highest-priority gap, see below |
| Progressive overload alerts | ⚠️ Works for structured Programs only, not ad-hoc workouts |
| Wearable integrations | ⚠️ Withings + Oura done; Apple Health / Google Fit still require a native app |

### What shipped since this PRD was written (6 weeks)

The team moved faster than the original sequencing on some fronts and slower on others:

- **Ahead of plan:** Full Nutrition Planning (Pillar 2) and full Periodisation/Training Programs (Pillar 3) both shipped completely, including scope that was scheduled for Sprint 4. Withings and Oura integrations (Pillar 6) also shipped — both were "Sprint 3" items.
- **Behind plan:** The two features the original PRD called *Sprint 1* and rated highest impact — **Readiness Score** (Pillar 4) and **Correlation Engine** (Pillar 1) — were not built at all. Every Quick Win bug and nearly every Quick Win small feature was fixed (only the XP exponential curve remains outstanding).

### Highest priority right now: Readiness Score + Correlation Engine

These are still the two highest-leverage things left in the original plan, and they're now *cheaper* to build than when this PRD was written, because the data they depend on has since arrived:

- **Readiness Score** (Pillar 4) no longer needs to wait for a "Phase 2" HRV integration — Oura HRV/sleep-staging and Withings body composition are already flowing into the app. The score algorithm can use real recovery data from day one instead of the log-derived proxy originally specced.
- **Correlation Engine** (Pillar 1) has more, richer variables to correlate against now (body comp trend, Oura sleep score, training-program adherence), which will produce sharper insights than the original 6-pair correlation set.

Recommend these as the next sprint before starting on any of the new ideas below.

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

## Quick Wins Appendix

These are bugs or small features that could each ship in a day or less. Not a pillar, but worth doing.

**Status as of 2026-07-02: every bug and small feature below is done except the XP exponential curve.**

### Bugs to Fix

| Issue | Fix | Status |
|---|---|---|
| `/workout/builder` dead link in AI Coach | Change redirect to `/schedule?tab=templates` | ✅ Done |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | Replace with CSS custom properties | ✅ Done |
| Streak counts only `movement_completed`, not nutrition logs | Add a `getStreak(mode: 'movement' | 'log')` variant; let user choose streak type in settings | ✅ Done |
| `WorkoutChatModal` vs `/coach` overlap and confusion | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" | ✅ Done |
| Body metrics photo = URL text field | Replace with real Supabase Storage upload (same code as Progress Photos) | ✅ Done |
| Active workout uses browser `confirm()` dialogs | Replace with the app's existing modal pattern | ✅ Done |
| Workout Spotter fails silently on Firefox | Show a browser compatibility warning | ✅ Done |
| Cycle tracking is on by default | Default `enable_cycle_tracking` to false, prompt at onboarding | ✅ Done |

### Small Features

| Feature | Description | Effort | Status |
|---|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h | ✅ Done |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day | ✅ Done |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day | ✅ Done (superseded by full Meal Planner) |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h | ✅ Done |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h | ✅ Done |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min | ✅ Done |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h | 🔴 Still outstanding |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h | ✅ Done |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h | ✅ Done |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day | ✅ Done |

---

## Pillar 7 — New Feature Ideas (Brainstorm, added 2026-07-02)

With Nutrition Planning, Training Programs, and Withings/Oura sync now shipped, the app has a much richer data set than it did in May. These ideas build on that — none require new pillars of infrastructure, and most lean on data the app is already collecting. **This is a brainstorm for review, not a build plan** — pick what resonates and we can spec it out properly before building anything.

### 7.1 — Goal ETA & Trajectory Forecasting
Use the weight/body-fat trend already flowing in from Withings (and manual `body_metrics`) to project forward: *"At your current rate (-0.4kg/week), you'll hit your 78kg goal around August 22."* Shown on the Goals/Metrics page as a simple regression line with a confidence band. No new integration — just a linear/exponential fit over existing `body_metrics` rows. Recompute nightly alongside other cron jobs.

### 7.2 — Life-Event / Adaptive Mode
A one-tap toggle for **Travel**, **Injury**, **Illness**, or **High-stress** that temporarily relaxes streak requirements, macro targets, and workout expectations for a set window (e.g. 3–14 days), and softens the AI coach's tone during that period. Right now users who hit a rough patch just silently break their streak and often don't come back — this gives them an honest, low-shame off-ramp instead. Ties naturally into the Readiness Score work once that ships (a "Life Event" active state could auto-suppress readiness-based training pushes).

### 7.3 — Cycle-Aware Coaching
Cycle tracking already exists in the schema but defaults off and currently does very little with the data. If a user opts in, use cycle phase to: shift the readiness/energy baseline expectations, nudge carb/iron targets during menstrual/luteal phases, and flag that today's lower performance is expected rather than a red flag. Low new-infrastructure cost since the tracking toggle and presumably the underlying data already exist — the gap is in *using* it.

### 7.4 — Group Challenges
The PRD originally scoped this under Pillar 5 but it wasn't built — only 1:1 accountability partners shipped. Now that `accountability_partners` and the weekly-summary email pipeline exist, extending to small group challenges (2–8 people, shared leaderboard, opt-in anonymity) is mostly schema + UI work reusing existing invite and notification plumbing. See original Pillar 5 spec for the `challenges` / `challenge_members` schema — still valid, just unbuilt.

### 7.5 — Ad-hoc Workout Progressive Overload
Weight suggestions currently only fire inside structured Training Programs (`pctToWeight` off a saved 1RM). Free/ad-hoc workouts just show "last session's weight" with no suggestion. Extending the existing overload algorithm (already specced in Pillar 3) to ad-hoc workouts closes this gap — it's the one piece of Pillar 3 that shipped only partially.

### 7.6 — Restaurant / Eating-Out Mode
The AI food-photo scanner is built for packaged/plated food at home. Add a mode for eating out: describe the dish or restaurant ("Nando's, quarter chicken, extra rice") and Claude estimates macros with an explicit "estimate ±20%" confidence flag, rather than forcing an exact food-database match. This is one of the most common reasons people abandon food logging — reduces friction at the moment of highest logging drop-off.

### 7.7 — Smart Weekly Digest
A Sunday-morning push notification/email summarizing the week: workouts completed, macro adherence, streak, and — once built — the top correlation insight from Pillar 1. Mechanically this is a thin wrapper around the accountability-partner email pipeline that already exists, just sent to the user themselves instead of (or as well as) their partner. Cheapest way to add a proactive touchpoint.

### 7.8 — AI Video Form Check
Natural extension of the existing food-photo AI: user uploads a short clip of a lift, Claude (vision) gives form feedback and flags obvious injury-risk cues (e.g. knee valgus, excessive spinal flexion). Positioned as a "second pair of eyes," not a replacement for a coach — should carry a clear disclaimer. Higher effort than the other items here (video handling, storage costs) — worth a proper spec before committing.

### 7.9 — Injury / Pain Log & Smart Substitutions
A quick "log pain" action during a workout (e.g. tap on an exercise → "knee pain, 6/10"). The app remembers this and (a) suggests substitute exercises that avoid the affected area for subsequent sessions, and (b) factors it into the Readiness Score and deload logic once those exist. Small new table (`pain_log`), reuses the existing exercise-substitution logic already implicit in the AI workout builder.

### 7.10 — Data Export
Plain CSV/JSON export of a user's full history (logs, workouts, body metrics) from Settings. Low effort, no dependencies on anything else in this document. Good trust/privacy signal and useful for power users who want to analyze their own data outside the app.

### Quick reference

| Idea | Depends on | Rough effort |
|---|---|---|
| Goal ETA forecasting | Existing body_metrics/Withings data | Low |
| Life-Event / Adaptive Mode | Nothing new; pairs well with Readiness Score | Low–Medium |
| Cycle-aware coaching | Existing (unused) cycle tracking data | Medium |
| Group Challenges | Existing accountability_partners infra | Medium |
| Ad-hoc progressive overload | Existing Program overload algorithm | Low |
| Restaurant / eating-out mode | Existing AI food-photo pipeline | Low–Medium |
| Smart weekly digest | Existing accountability email pipeline | Low |
| AI video form check | New: video upload/storage + vision prompt | High |
| Injury/pain log & substitutions | Small new table; existing AI workout builder | Medium |
| Data export | Nothing new | Low |

---

## Prioritisation Matrix — updated 2026-07-02

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer. Struck-through rows are already shipped.

| Pillar | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Wins | Medium | Very High | ★★★★★ | ✅ Done (except XP curve) |
| **Readiness Score** | Very High | High | ★★★★☆ | 🔴 **Not built — top priority** |
| **Correlation Engine** | Very High | High | ★★★★☆ | 🔴 **Not built — top priority** |
| ~~Nutrition Planning (Saved Meals only)~~ | High | High | ★★★☆☆ | ✅ Done |
| Periodisation (Ad-hoc Overload Alerts) | Medium | High | ★★★☆☆ | ⚠️ Partial — only in structured Programs (see idea 7.5) |
| Accountability (Partner only, no challenges) | Very High | Medium | ★★★☆☆ | ✅ Done |
| ~~Withings Integration~~ | High | Medium | ★★★☆☆ | ✅ Done |
| ~~Oura Integration~~ | High | Medium | ★★★☆☆ | ✅ Done |
| ~~Nutrition Planning (Full Meal Planner)~~ | High | Low | ★★☆☆☆ | ✅ Done |
| Group Challenges (idea 7.4) | Medium | Medium | ★★☆☆☆ | 🔴 Not built |
| ~~12-Week Programs~~ | High | Low | ★★☆☆☆ | ✅ Done |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | 🔴 Future (requires native app) |
| Goal ETA forecasting (idea 7.1) | Medium | Very High | ★★★★☆ | 🆕 New idea |
| Smart weekly digest (idea 7.7) | Medium | Very High | ★★★★☆ | 🆕 New idea |
| Ad-hoc progressive overload (idea 7.5) | Medium | High | ★★★★☆ | 🆕 New idea |
| Data export (idea 7.10) | Low | Very High | ★★★☆☆ | 🆕 New idea |
| Restaurant/eating-out mode (idea 7.6) | High | Medium | ★★★☆☆ | 🆕 New idea |
| Life-Event / Adaptive Mode (idea 7.2) | High | Medium | ★★★☆☆ | 🆕 New idea |
| Cycle-aware coaching (idea 7.3) | Medium | Medium | ★★★☆☆ | 🆕 New idea |
| Injury/pain log (idea 7.9) | Medium | Medium | ★★★☆☆ | 🆕 New idea |
| AI video form check (idea 7.8) | High | Low | ★★☆☆☆ | 🆕 New idea |

---

## Recommended Next Sprint — updated 2026-07-02

Sprint 1 from the original PRD is **mostly done**, with two notable exceptions that were the highest-rated items and should be next:

1. **Readiness Score v1** (2–3 days) — now cheaper than originally scoped: Oura HRV/sleep and Withings body comp data already exist, so the score can use real recovery signal instead of the log-derived proxy in the original spec.
2. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 correlations shown in a weekly insight card. More data sources are now available to correlate against than when this was first specced.
3. **Ad-hoc Progressive Overload** (1 day, idea 7.5) — closes the one gap left in Pillar 3; small enough to bundle into this sprint.
4. **XP exponential curve** (1h) — the one remaining Quick Win.

Total estimated effort: 6–9 days of development — this closes out the original PRD entirely.

**After that**, the Pillar 7 brainstorm above (added 2026-07-02) is where to look for what's next. Goal ETA Forecasting, Smart Weekly Digest, and Data Export stand out as the highest-ROI new ideas — all low effort, no new infrastructure, and they lean on data the app already has.

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
