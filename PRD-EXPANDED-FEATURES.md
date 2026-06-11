# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-11  
**Status:** Living Document — updated with Round 2 proposals

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

> **Note:** Table updated 2026-06-11. Several features originally marked "not started" are now shipped.

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, 30-day window |
| Push notifications | ✅ Server-side, custom reminders |
| Strava sync | ✅ Manual sync |
| Goal Wizard | ⚠️ Built but no entry point in UI |
| Progress photos | ✅ Upload + compare |
| Body metrics | ⚠️ Measurements but no photo upload |
| Social / sharing | ⚠️ Accountability partners shipped; group challenges not started |
| Nutrition planning | ✅ Full meal planner, pantry, AI generation, saved meals |
| Nutrition meal scanner | ✅ Camera + voice scanning for ingredients |
| Recovery / readiness | 🔴 Not started (Pillar 4) |
| Correlation Engine | 🔴 Not started (Pillar 1) |
| Progressive Overload Engine | 🔴 Not started (Pillar 3) |
| Wearable integrations | ✅ Strava, Withings, Oura Ring connected |
| Apple Health / Google Fit | 🔴 Not started (requires native app) |
| Hydration tracking | 🔴 Not started |
| Supplement tracking | 🔴 Not started |
| Injury logging | 🔴 Not started |
| Coach persona customisation | 🔴 Not started |
| Data export | 🔴 Not started |
| Fasting mode (dedicated UI) | ⚠️ Eating window fields exist; no timer/UI |

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

---

## Round 2 — New Feature Proposals

*Added 2026-06-11. These are brainstormed additions beyond the original six pillars, ordered by estimated impact. None are designed or scoped in detail yet — this section is a backlog for future sprint planning.*

---

### R2-1 — Hydration Tracker

**The Problem**  
Dehydration is one of the most direct and easily-fixed causes of low energy and poor workout performance, yet the app captures zero hydration data. The correlation engine (Pillar 1) can't connect energy crashes to dehydration if the data doesn't exist.

**What It Does**
- Add a **water intake field** to the daily log Wellness tab: a simple numeric input (glasses or ml/oz) with a tap-to-increment control
- User sets a daily hydration goal (defaults to 8 glasses / 2L)
- A **hydration ring** sits alongside the macro rings on the log summary — same visual language the app already uses
- The Correlation Engine can then surface insights like *"Your energy is 28% higher on days you hit your water goal"*
- Optional: a mid-day push notification if the user is behind pace ("You've logged 2/8 glasses and it's 2pm")

**Data Model Change**  
Add `water_glasses int` and `water_goal int` to `daily_logs` (or user settings for the goal). No new tables needed.

**Effort:** 1–2 days. The UI pattern (tap-to-increment, ring visualisation) already exists for macros.

**Why This Matters**  
This is the single most-requested missing feature in fitness apps. It's trivial to build, immediately useful, and enriches the correlation dataset at zero ongoing cost.

---

### R2-2 — Smart TDEE Recalibration

**The Problem**  
The app sets a calorie target once (via Goal Wizard or onboarding) and never revisits it. But TDEE (Total Daily Energy Expenditure) varies with activity level, weight loss/gain, and adaptation. A user who has been in a 500 kcal deficit for 10 weeks has almost certainly adapted — their actual TDEE is lower than it was, and the original target no longer produces the expected result. Right now the app has no way to detect or correct this.

**What It Does**

**Adaptive Calorie Check-In (monthly)**  
Once a month, the app compares:
1. The user's logged calorie average over the past 30 days
2. The direction and rate of their weight change (from `body_metrics`)
3. The predicted weight change based on the current calorie target

If the actual change diverges significantly from predicted (e.g., user is in deficit but weight isn't dropping), the app surfaces a **Calorie Review card** on the dashboard:
> *"Over the last 30 days, your average intake was 1,850 kcal and your weight dropped 0.2 kg — slower than your target of 0.5 kg/week suggests. Your body may have adapted. Would you like to recalibrate your goal?"*

The user can trigger an AI-guided recalibration that adjusts their calorie and macro targets based on current weight and recent activity.

**Non-linear plateau detection**  
If weight has been within ±0.3 kg for 3+ weeks despite being in a logged deficit, flag a plateau and suggest a diet break (2 weeks at maintenance) before resuming — this is evidence-based and rarely implemented in consumer apps.

**Data Model Change**  
A `tdee_snapshots` table to store recalibration events and reasoning, for auditability and to power the AI explanation.

```sql
CREATE TABLE tdee_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  estimated_tdee int,
  avg_logged_calories int,
  avg_weight_change_kg_per_week numeric,
  recommendation text,
  new_calorie_target int,
  applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 3–4 days. Requires the body_metrics weight data to be consistently logged — works best alongside Withings integration.

**Why This Matters**  
This is the "closing the loop" feature for weight management. Almost no consumer app does this automatically. It turns the app from a passive logger into an active advisor — and it directly prevents the plateau frustration that causes users to quit.

---

### R2-3 — Injury Log & AI Exercise Modifications

**The Problem**  
Real athletes get niggles, aches, and injuries. Right now, there's nowhere to log them. The AI coach has no idea the user has a sore shoulder, so it will happily suggest overhead press in a workout recommendation. This is a significant gap for any user who trains consistently.

**What It Does**

**Pain/Discomfort Log**  
A new sub-section in the daily log (or accessible from the workout screen) where users can tag:
- Body region (shoulder, knee, lower back, etc.) using a simple body-map tap interface
- Severity (1–5: twinge → sharp pain)
- Status: active, monitoring, resolved
- Optional free-text note

**AI Coach Context Injection**  
Unresolved injury records are automatically injected into the AI coach system prompt:
> *"User has an active right shoulder complaint rated 3/5. Avoid overhead pressing movements. Suggest alternatives."*

This means every workout suggestion and coaching response is automatically injury-aware — no extra user action required after the initial log.

**Exercise Modification Cards**  
When an active injury overlaps with a planned exercise (detected by a muscle-group mapping), show an inline card in the active workout:
> *"⚠️ Shoulder complaint active — consider cable flyes instead of overhead press. [Substitute]"*

**Injury History & Recovery Timeline**  
A simple log of past injuries with dates and recovery duration — useful for spotting patterns (e.g., recurring lower back issues on high-volume deadlift weeks).

**Data Model**

```sql
CREATE TABLE injury_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body_region text NOT NULL,      -- 'right_shoulder', 'left_knee', 'lower_back', etc.
  severity int NOT NULL,          -- 1-5
  status text DEFAULT 'active',   -- 'active', 'monitoring', 'resolved'
  notes text,
  onset_date date NOT NULL,
  resolved_date date,
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 3–4 days (body map UI is the main complexity; logic is straightforward).

**Why This Matters**  
This is the feature that makes the app feel like it actually knows the user's body. It prevents bad AI recommendations and builds significant trust. Injury awareness is table stakes for any app targeting serious fitness users.

---

### R2-4 — Data Export & Year in Review

**The Problem**  
Users have months or years of personal health data in the app with no way to get it out. This is both a trust/privacy issue (users should own their data) and a missed engagement opportunity — a beautiful annual summary is one of the highest-shareability moments an app can create.

**What It Does**

**Data Export (Settings Page)**  
A "Download My Data" button in Settings that exports:
- All daily logs (CSV or JSON)
- All workout sessions (CSV)
- Body metrics history (CSV)
- Progress photos (ZIP)
- Full JSON archive of everything

Generated as a background job, delivered via a download link emailed to the user. No streaming to the browser for large datasets.

**Year in Review (Annual Feature)**  
Each January (or on the user's first log-anniversary), generate a personalised summary page — think Spotify Wrapped for fitness:
- Total workouts, total volume lifted, total distance moved
- Best streak, biggest PR, most consistent habit
- Favourite foods (by log frequency), most-skipped goal
- Readiness score trend, sleep trend
- A single "headline stat" the AI picks as most impressive
- Shareable as a card (image export or link)

This is the app's highest organic-sharing moment. It also creates a strong reason to keep logging — users don't want to break the data record.

**Effort:** Export = 2 days. Year in Review = 3–5 days (depends on design investment).

**Why This Matters**  
Data portability builds trust and is increasingly a regulatory expectation (GDPR, etc.). The Year in Review is a viral-growth mechanism — users share these. It's also a powerful retention driver: the longer you use the app, the better your Year in Review.

---

### R2-5 — AI Coach Persona Customisation

**The Problem**  
The AI coach currently has a fixed communication style. Different users respond dramatically differently to motivational approaches — some want tough love, some want encouragement, some want clinical data. A single tone alienates significant portions of the user base.

**What It Does**

A setting in the coach or settings page lets users choose a **coaching style**:

| Persona | Description | Example |
|---|---|---|
| **Drill Sergeant** | Direct, no-nonsense, pushes hard | *"You missed your protein by 40g. That's not good enough. Fix it tomorrow."* |
| **Best Friend** | Warm, casual, empathetic | *"Aw, tough week! You still logged 5 days — that's genuinely great. What got in the way?"* |
| **Sports Scientist** | Data-driven, precise, minimal emotion | *"Protein deficit: 40g (-22%). Recommend increasing lunch protein by ~35g. Current 7-day avg: 118g vs 160g target."* |
| **Zen Master** | Mindful, process-focused, non-judgmental | *"Every log is a moment of self-awareness. Today wasn't perfect — that's information, not failure."* |

The chosen persona is stored in `user_settings` and injected into the coach system prompt as a style instruction.

**Data Model Change**  
Add `coach_persona text DEFAULT 'best_friend'` to `user_settings`. No new tables.

**Effort:** 1 day. The core change is writing 4 prompt persona blocks and wiring the setting.

**Why This Matters**  
Persona fit is one of the biggest factors in whether users find an AI assistant engaging or off-putting. This is low-effort and high-delight — the kind of customisation that makes users feel the app "gets them".

---

### R2-6 — Fasting Mode (Full Feature)

**The Problem**  
The eating window start/end times are already being logged, but there's no UI built around them. Intermittent fasting is one of the most popular dietary approaches, and right now the data is captured but ignored.

**What It Does**

**Fasting Timer**  
A persistent card on the dashboard (or log page) when a fast is active:
- Shows elapsed fasting time and target duration (e.g., "14:32 / 16:00 hours")
- Colour-coded: grey (in eating window) → green (in fast, on track) → amber (approaching eating window) → red (past target, should eat)
- Tap to end fast (logs eating window start time)
- Tap to start fast (logs eating window end time)
- Optional push notification when fast target is reached

**Fasting History & Insights**  
A simple history view of fasting windows with average duration, consistency score, and the correlation with energy/sleep from the existing log data.

**Fasting Goal Setting**  
User can set a fasting protocol (12:12, 14:10, 16:8, OMAD, custom) and the app tracks adherence.

**Data Model Change**  
Add `fasting_protocol text` and `fasting_goal_hours int` to `user_settings`. The existing `eating_window_start` and `eating_window_end` fields on `daily_logs` are sufficient for storage.

**Effort:** 2–3 days (timer UI and push notification for fast-complete are the main pieces).

**Why This Matters**  
Intermittent fasting users are highly engaged and vocal. This takes existing half-implemented data and builds a complete, useful feature around it — high ROI because the infrastructure is already there.

---

### R2-7 — Supplement Tracker

**The Problem**  
Most serious fitness users take supplements — creatine, protein powder, vitamin D, omega-3, magnesium, pre-workout. These are part of their daily routine, affect their performance and recovery, and yet no fitness app tracks them well. This is a gap the app could own.

**What It Does**

**Supplement Library**  
Users build a personal supplement list with:
- Name, dose, unit (mg, g, capsules, scoops)
- Timing: morning / pre-workout / post-workout / with meals / evening
- Category: vitamin / mineral / performance / recovery / other

**Daily Check-off**  
A simple check-off widget in the daily log (Wellness tab or a new tab) — tap each supplement to mark as taken. Unchecked supplements contribute to a "compliance %" metric.

**Smart Reminders**  
At the configured timing (e.g., 30 min before a logged workout), send a push notification: *"Pre-workout reminder: take your creatine and beta-alanine."*

**Supplement-Outcome Correlations**  
Once the Correlation Engine exists (Pillar 1), creatine compliance can be correlated with workout performance, magnesium with sleep quality, etc. This turns the supplement log into actionable data rather than just a checklist.

**Data Model**

```sql
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose numeric,
  unit text,
  timing text[],    -- ['morning', 'pre_workout']
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Daily supplement logs stored as jsonb on daily_logs:
-- supplements_taken: [{ supplement_id, taken: true/false, taken_at: timestamp }]
-- (avoids a separate table for simple use cases)
```

**Effort:** 2–3 days.

**Why This Matters**  
This is highly sticky (users configure it once, interact daily) and differentiating (almost no consumer app does this well). It also creates a richer dataset for the correlation engine.

---

### R2-8 — Training Load Analytics (ATL / CTL / TSB)

**The Problem**  
Serious athletes manage their training using load metrics — specifically the balance between acute fatigue and chronic fitness. The app captures all the raw data needed to calculate this (workout volume, intensity, frequency) but doesn't do the math. For any user training for a race, competition, or peak performance event, this is exactly the insight they need.

**What It Does**

**Three Derived Metrics (calculated from workout history):**

| Metric | What It Measures | Calculation |
|---|---|---|
| **CTL** — Chronic Training Load (Fitness) | Long-term training stress absorbed; your "fitness" | 42-day exponentially weighted average of daily TSS |
| **ATL** — Acute Training Load (Fatigue) | Recent stress; how tired you are right now | 7-day exponentially weighted average of daily TSS |
| **TSB** — Training Stress Balance (Form) | CTL − ATL; positive = fresh, negative = fatigued | CTL minus ATL |

**Training Stress Score (TSS) per workout** is estimated from: duration × intensity multiplier (Light=0.5, Moderate=1.0, Hard=1.5, Max=2.0). For more precision, heart rate data from wearables can be used.

**"Performance Management Chart"**  
A time-series chart (similar to TrainingPeaks' PMC) showing CTL, ATL, and TSB over time. Shows peaking periods, taper windows, and overtraining risk zones.

**Interpretation Guidance**  
- TSB > +25: very fresh, possibly detrained — schedule a hard session
- TSB -10 to +10: optimal training zone
- TSB < -20: high fatigue — risk of overtraining; recommend lighter sessions
- TSB < -30: excessive fatigue — force a rest day recommendation

**Integration with Readiness Score (Pillar 4)**  
TSB becomes a weighted input in the Readiness Score calculation, replacing the cruder "days since last rest" signal.

**Data Model Change**  
Add daily TSS as a computed field (or store it on `workouts`). CTL/ATL/TSB are always computed on-the-fly from workout history — no caching needed for most views.

**Effort:** 3–4 days. The chart component is the main UI investment; the math is simple.

**Why This Matters**  
This is the feature that makes the app legitimately useful for anyone training for a goal event — marathon, triathlon, powerlifting meet, Hyrox. It's currently the preserve of expensive coaching software (TrainingPeaks charges $19/month). Building it here creates a compelling argument for athletes to consolidate to this app.

---

### R2-9 — AI Form Coach (Browser Video Analysis)

**The Problem**  
Poor exercise form is the leading cause of gym injuries, yet form feedback has always required an in-person coach. Browser-based pose estimation (via TensorFlow.js + MoveNet or MediaPipe) has reached a point where real-time analysis is viable on a mid-range phone. This would be the most technically differentiating feature in the app.

**What It Does**

**Phase 1: Rep Counter + Depth Check**  
- User opens the camera during an active workout set
- The AI detects the exercise being performed (based on joint angles) and counts reps automatically
- For squat/deadlift/bench: checks depth/range of motion against minimums and flags incomplete reps
- End of set: summary card — "12 reps detected. 2 were above parallel — depth was inconsistent."

**Phase 2: Form Feedback**  
- Real-time visual overlay on the camera feed (skeleton rendering)
- Voice feedback during the set: *"Drive through your heels"* / *"Keep your back flat"* — triggered by angle threshold violations
- Post-set written summary with the specific fault and a corrective cue

**Phase 3: Progress Tracking**  
- Form scores recorded per set over time (% of reps with good depth, bar path deviation, etc.)
- Shows form improvement trend alongside strength trend

**Technical Approach**  
- TensorFlow.js MoveNet (blazepose for upper body, thunder for lower body) running entirely in the browser — no video uploaded to servers
- Angle calculations on 33 keypoints
- Exercise classification from characteristic joint angle signatures
- All processing client-side: no privacy concern, works offline, no API cost

**Effort:** High — 1–2 weeks for Phase 1 alone. This is a significant engineering investment.

**Why This Matters**  
No major consumer fitness app has shipped real-time form coaching at this fidelity in the browser. If it works well, this single feature could drive significant word-of-mouth and press coverage. The "no video uploaded" privacy angle is also a strong differentiator over camera-based AI competitors.

---

---

## Round 2 — Priority Assessment

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| Hydration Tracker | High | Very Low (1-2 days) | ★★★★★ Ship immediately |
| Coach Persona Customisation | High | Very Low (1 day) | ★★★★★ Ship immediately |
| Fasting Mode (full feature) | High | Low (2-3 days) | ★★★★☆ Sprint 2 |
| Data Export | Medium-High | Low (2 days) | ★★★★☆ Sprint 2 |
| Injury Log & Modifications | Very High | Medium (3-4 days) | ★★★★☆ Sprint 2 |
| Smart TDEE Recalibration | Very High | Medium (3-4 days) | ★★★★☆ Sprint 2 |
| Supplement Tracker | Medium | Medium (2-3 days) | ★★★☆☆ Sprint 3 |
| Year in Review | High | Medium (3-5 days) | ★★★☆☆ Sprint 3 (time-dependent) |
| Training Load Analytics | High | Medium (3-4 days) | ★★★☆☆ Sprint 3 (for serious athletes) |
| AI Form Coach | Very High | Very High (1-2 weeks) | ★★☆☆☆ Future investment |

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
