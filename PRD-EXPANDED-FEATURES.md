# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (last updated 2026-05-24)  
**Status:** Living document — updated with shipped status and new proposals

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (Updated 2026-05-24)

> **Much has shipped.** This table reflects the actual state as of v2.0.0. The Six Pillars section below is updated with per-pillar build status.

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted, voice + camera |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions + Withings body comp |
| AI coaching chat | ✅ Context-aware, persisted to Supabase, cross-device |
| Push notifications | ✅ FCM (native iOS/Android) + Web VAPID |
| Strava sync | ✅ OAuth, automatic activity sync |
| Goal Wizard | ✅ Accessible via Settings ("Set Goals with AI") |
| Progress photos | ✅ Upload + compare (Supabase Storage) |
| Body metrics | ✅ Full metrics tab, weight chart, imperial/metric toggle |
| Saved meals | ✅ Save multi-food selections, one-tap re-log |
| Nutrition planning | ✅ /nutrition with Pantry, AI meal plans, log planned meals |
| 12-Week Training Programs | ✅ AI-generated, periodised, with 1RM targets and PR detection |
| Health integrations | ✅ Strava + Withings + Oura (OAuth + sync) |
| Accountability partners | ✅ Add partners, send weekly summary email |
| Native iOS / Android apps | ✅ Capacitor build, FCM, haptics, swipe-back |
| iCal workout calendar feed | ✅ webcal:// feed, syncs with Apple/Google Calendar |
| Dark / Light / System theme | ✅ Three-way toggle, persisted |
| Onboarding flow | ✅ Name, DOB, height, weight, goal |
| AI weekly insights | ⚠️ AI commentary on trends — not yet statistical correlation |
| Correlation engine | 🔴 Not started (insights_cache + Pearson computation) |
| Daily Readiness Score widget | 🔴 Oura data synced to daily_logs, but no dedicated 0–100 card |
| Group challenges | 🔴 Not started |
| Streak shield / partner nudge | 🔴 Not started |
| Apple HealthKit (HealthKit API) | 🔴 Not started (Capacitor native now exists — unblocked) |
| Volume / Gains tab | 🔴 Not started |
| Grocery list from meal plan | 🔴 Not started |
| Macro cycling (workout vs rest days) | 🔴 Not started |
| Deload detection | 🔴 Not started |

---

## The Six Pillars

| # | Pillar | Status |
|---|---|---|
| 1 | **Correlation Engine & Insight Feed** — surface *why* you feel good or bad | 🔴 Not started |
| 2 | **Intelligent Nutrition Planning** — close the loop from tracking to planning | ✅ Shipped (v1.2–1.3) |
| 3 | **Periodisation & Progressive Overload** — turn workout history into a training program | ✅ Shipped (v1.5) |
| 4 | **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?" | ⚠️ Partial (Oura sync only) |
| 5 | **Accountability Layer** — gentle social pressure without the social media toxicity | ⚠️ Partial (partners + email, no challenges) |
| 6 | **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings | ⚠️ Partial (Strava, Withings, Oura — no HealthKit) |

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

---

---

## What's Still Outstanding from the Six Pillars

The three pillars below are either not started or only partially built. These should be the highest-priority implementation work before moving to new feature territory.

### Outstanding: Pillar 1 — Correlation Engine

The "AI Weekly Insights" feature delivers AI commentary on the logs, but the full Pearson correlation engine (and `insights_cache` table) has not been built. What's missing:

- The nightly cron job that computes correlation coefficients across variable pairs
- The `insights_cache` table
- The **Daily Insight Card** on the dashboard (not the weekly modal — a persistent card)
- The **"Why do I feel this way?" quick-ask button** and its grounded AI response

The data is all there. This is purely a compute + UI gap.

### Outstanding: Pillar 4 — Daily Readiness Score Widget

Oura's raw readiness score is currently mapped to `energy_level` in `daily_logs` (a 1–5 value). What's missing:

- A dedicated `readiness_scores` table (or computed view) holding the 0–100 score
- The **dashboard card** with colour-coded score, label, and training recommendation
- The **AI explanation bottom sheet** (generated once daily, cached)
- The **non-Oura fallback algorithm** for users without a ring (uses sleep/stress/energy/alcohol/rest-days from `daily_logs`)

This is the app's most powerful daily hook and the most glaring missing piece on the dashboard.

### Outstanding: Pillar 5 — Group Challenges & Streak Shield

Accountability partners + weekly email are shipped. Still not started:

- **Group Challenges** (2–8 people, shared leaderboard, push notifications on milestones)
- **Streak Shield** — partner nudge when user hasn't logged by 9pm
- **In-app partner view** — lightweight dashboard of a friend's summary stats (not full log)

---

---

## New Feature Proposals — Brainstorm

These are net-new ideas beyond the original six pillars, ordered roughly by strategic impact. None of these are committed — they are candidates for review and prioritisation.

---

### Proposal A — AI Form Check (Video Analysis)

**The opportunity:** The app now has native iOS and Android builds via Capacitor. The camera is available. The most-requested feature in strength training apps — "is my form correct?" — is now technically feasible without a third-party backend.

**What it does:**
- User taps "Check My Form" during an active workout set
- Records a 10–30 second clip
- Sends frames to Claude's vision API with a prompt specific to the exercise being logged (squat, deadlift, bench press, etc.)
- Returns a 2–3 sentence form note: *"Your squat depth looks good. Your knees are tracking inward slightly on the way up — think about pushing them out over your little toes."*
- Notes are saved alongside the workout set and visible in exercise history

**What it doesn't do:** No tracking, no real-time overlay, no video storage (frames only, not saved). This keeps it simple and avoids GDPR complexity.

**Technical notes:** Claude Sonnet's vision endpoint. A prompt library per exercise (squats, deadlifts, bench, OHP, rows, pull-ups) with specific cues to look for. Video frames extracted client-side via `<canvas>` before sending. 3–5 frame sample at 2fps is sufficient.

**Data model:** Add `form_notes jsonb` column to `workout_sets` (nullable). No new table needed.

**Why this matters:** Every other feature makes you track better. This makes you *train* better. It's the killer feature that no consumer fitness app does well, and it's now achievable with Claude Vision.

---

### Proposal B — Voice Daily Check-in

**The opportunity:** Filling in five sliders (sleep, energy, stress, mood, motivation) every morning is cognitive friction. A 20-second voice note is lower effort and captures richer signal.

**What it does:**
- On the dashboard, "How are you today?" — one-tap mic button
- User speaks naturally: *"Slept okay but took ages to fall asleep, maybe 6 hours. Feeling a bit flat, stressed about work stuff. Could probably train but I'm not excited about it."*
- Claude Haiku transcribes and extracts structured values: `{ sleep_quality: 3, energy_level: 2, stress_level: 4, mood_note: "work stress" }`
- Pre-fills the daily log sliders — user reviews and saves
- The raw transcription is stored alongside the structured values for richer coach context

**Why this matters:** Reduces daily log friction by ~60% for wellness fields. Makes the AI coach's context richer (the free-text has nuance that a 1–5 slider doesn't). Also a natural entry point for users who find the log overwhelming.

**Technical notes:** Web Speech API (available in Chrome/Safari and in the Capacitor WebView) for transcription. Claude Haiku for structured extraction (cheap, fast). Store `voice_note_text` in `daily_logs`. No new table.

---

### Proposal C — Hydration Tracker

**The opportunity:** Water intake is the simplest performance variable and one of the most commonly requested missing features. It's already a gap most users notice — the app tracks food, alcohol, sleep, and movement but not water.

**What it does:**
- Tap-to-add water glasses on the dashboard or in the daily log (quick-add: 250ml, 500ml, or custom)
- Daily goal: 8 glasses / 2 litres (customisable in settings, or derived from body weight: ~35ml/kg)
- A visual "fill bar" on the dashboard alongside the macro rings
- Correlations with energy level (in the Correlation Engine) — dehydration is one of the most common unexplained energy dips
- Reminder push notification if less than 50% hydrated by 2pm

**Data model:** Add `water_ml int` column to `daily_logs`. No new table.

**Why this matters:** Extremely high daily engagement because users tap it multiple times per day. Simple. Closes a gap that users notice. Feeds the correlation engine with a new high-signal variable.

---

### Proposal D — Supplement Stack Tracker

**The opportunity:** Many fitness-focused users take daily supplements (creatine, protein powder, vitamin D, omega-3, magnesium, etc.) and want to track them — partly for consistency, partly to correlate with performance. No major fitness app does this well.

**What it does:**
- Define a personal supplement stack in Settings (name, dose, frequency: daily / workout days only / custom)
- A daily "Did you take your supplements?" checklist in the log (or quick-dismiss notification)
- AI coach can reference supplement adherence: *"You've taken creatine 26 of the last 30 days — good consistency."*
- Correlation engine tracks supplement days vs performance metrics (strength, energy, sleep)

**Data model:**
```sql
CREATE TABLE supplement_stack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose_mg int,
  frequency text DEFAULT 'daily',   -- 'daily', 'workout_days', 'custom'
  notes text,
  is_active boolean DEFAULT true
);

-- Store daily check-offs in daily_logs as a jsonb column
-- ALTER TABLE daily_logs ADD COLUMN supplements_taken text[];
```

---

### Proposal E — Race / Event Countdown & Goal Peaking

**The opportunity:** Many users are working toward a specific event — a marathon, a powerlifting meet, a triathlon, a holiday they want to look good for. The app has no concept of a target date, which means the 12-week program has an arbitrary endpoint rather than a meaningful one.

**What it does:**
- Add a "Target Event" in Settings: event type (race, competition, holiday, other), date, and name
- Dashboard shows a countdown: *"Marathon — 47 days"*
- The 12-week program generator takes the event date as input and works backwards: peak week falls on race week, deload falls 1–2 weeks before, etc.
- Nutrition AI adjusts: calorie surplus during build, move to maintenance 2 weeks before the event
- The day after the event: an auto-triggered "How did it go?" prompt with PR capture and reflection

**Data model:** Add `target_event jsonb` to `user_settings`: `{ name, date, type }`.

**Why this matters:** Events are the most powerful motivation anchors. Users who have a race in 6 weeks are more consistent than users with no deadline. This feature makes the training program feel personal and purposeful rather than generic.

---

### Proposal F — Injury & Soreness Tracker

**The opportunity:** The app currently optimises for training performance, but the thing that most derails training is injury. There's no way to tell the AI coach "my left knee is sore" and have it actually adapt recommendations.

**What it does:**
- Daily soreness check-in: tap a body region on a simple body diagram (shoulders, chest, lower back, knees, etc.) and rate severity (1–3: mild soreness / moderate / pain)
- AI coach and workout recommender respect active injuries: *"You've flagged right shoulder pain. I've removed overhead pressing from today's recommendation and added a shoulder mobility circuit instead."*
- Progressive overload engine skips progression for exercises that load the injured area
- Tracks recovery timeline: each day you can mark the area as "improving / same / worse"
- After 7 days of persistent pain, prompts: *"This has persisted for a week — it may be worth speaking to a physio."*

**Data model:**
```sql
CREATE TABLE soreness_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  body_region text NOT NULL,          -- 'left_shoulder', 'lower_back', etc.
  severity int NOT NULL,              -- 1, 2, or 3
  notes text,
  status text DEFAULT 'active'        -- 'active', 'improving', 'resolved'
);
```

**Why this matters:** Injury prevention is the #1 long-term retention factor. A user who stays injury-free trains consistently. A user who gets injured often quits. This feature could be the app's most impactful health intervention — more valuable than any performance optimisation.

---

### Proposal G — Coach Persona Customisation

**The opportunity:** "AI coach" means very different things to different people. A 55-year-old woman returning from injury wants gentle encouragement and careful guidance. A 25-year-old man training for a powerlifting competition wants no-nonsense intensity. A system prompt change unlocks dramatically different coaching experiences.

**What it does:**
- In Settings → Coach, choose a coaching style:
  - **Science Coach** (default): data-driven, measured, evidence-based — *"Your cortisol patterns suggest you'd benefit from..."*
  - **Drill Sergeant**: direct, challenging, zero excuses — *"Three drinks and skipped your workout? Not on my watch. Here's what we're doing tomorrow."*
  - **Supportive Friend**: warm, encouraging, celebrates small wins — *"Hey! You hit your protein goal 5 days in a row — that's huge."*
  - **Minimalist**: ultra-brief, just the key action — one line, no fluff
- The selected persona is injected into all AI system prompts (coach chat, smart coach tips, weekly insights, readiness explanation)
- User can change any time

**Technical notes:** One `coach_persona` field in `user_settings`. Three system prompt variants in a `lib/personas.ts` file, interpolated into all AI routes. Zero new infrastructure.

**Why this matters:** Persona match is a major factor in coaching effectiveness. This costs almost nothing to build and makes the app feel genuinely personalised in a way most users will immediately notice.

---

### Proposal H — Data Export & Privacy Dashboard

**The opportunity:** GDPR (and equivalents) require the ability to export all personal data and request deletion. The app has never shipped this. As the user base grows and the app collects increasingly sensitive health data, this is increasingly a legal and trust requirement.

**What it does:**
- **Data Export**: one-click export of all personal data as a zip file: `daily_logs.csv`, `workouts.json`, `body_metrics.csv`, `food_items.json`, etc. Downloadable from Settings → Privacy.
- **Delete My Account**: full account deletion flow that cascades through all tables and deletes Supabase Storage objects (progress photos, voice notes). Irreversible — requires typing "DELETE" to confirm.
- **Privacy Dashboard**: a plain-English summary of what data the app collects, where it's stored, and which third parties receive it (Anthropic API for AI features, Supabase, Strava, Withings, Oura). Links to each third party's privacy policy.

**Why this matters:** Legal compliance (GDPR Art. 15–17). Trust. As AI features handle increasingly sensitive health data, privacy transparency is a meaningful competitive advantage with health-conscious users.

---

### Proposal I — Personal Records Hall of Fame

**The opportunity:** The 1RM calculator already runs on every workout set. There's PR toast detection built in. But there's no dedicated page celebrating these achievements — they disappear after the toast fades.

**What it does:**
- `/records` page (or a tab on the Programs/Workout page): a searchable gallery of PRs across all exercises
- Each card shows: exercise name, all-time best (weight × reps), date set, estimated 1RM, a mini sparkline of 1RM progress over time
- Sort by: recently broken, biggest improvement, muscle group
- **Shareable PR cards**: tap any record → generate a stylised card image: *"New PR: Deadlift 5RM @ 180kg — 14 May 2026"* → share to Instagram/WhatsApp
- Milestone badges: "First 100kg squat", "Deadlift 2× bodyweight", custom body-weight multiples based on user's actual weight

**Data model:** Already exists — `exercise_records` table is defined in Pillar 3 but not yet built.

**Why this matters:** PR moments are the highest-emotion events in strength training. They should be celebrated, not forgotten. Shareable PR cards drive organic growth. The sparkline over time makes users *want* to come back and beat their records.

---

### Proposal J — Apple HealthKit Integration

**The opportunity:** The Capacitor native app is now live on iOS. HealthKit integration was flagged as "requires native app" — that blocker is now gone.

**What it does** (extends Pillar 6):
- Read from HealthKit: steps, active energy burned, resting heart rate, HRV, sleep analysis (in-bed / asleep / awake), body weight
- Write to HealthKit: log completed workouts as HealthKit workout sessions; log body weight entries
- Auto-sync on app foreground: no manual "Sync" button needed
- Weight from HealthKit → `body_metrics` (de-duplicated against Withings)
- Sleep staging from HealthKit → `sleep_records` (source: `'apple_health'`)
- HRV from HealthKit → feeds the Readiness Score directly (removes dependency on Oura)

**Technical notes:** Capacitor HealthKit plugin (`@capacitor-community/health`). Requires iOS entitlement and privacy usage strings (already familiar from App Store submission). Only applies to iOS build — Android uses Google Health Connect (separate effort).

**Why this matters:** Apple Watch users (a huge segment of health-conscious iOS users) currently get no value from having a watch. HealthKit integration means their sleep, HRV, and activity data flows in automatically — transforming the app from "another thing to log" to "the place where all my health data lives."

---

### Proposal K — Smart Weekly Planning Notification

**The opportunity:** Every Sunday evening the app has all the information it needs to suggest a smart plan for the coming week: training program sessions, current readiness trend, upcoming calendar (from the iCal feed if connected), and nutrition targets. Nobody else does this.

**What it does:**
- Sunday at 7pm, a push notification arrives: *"Your week is ready — tap to see your plan"*
- Opens a modal with a day-by-day summary: training days, estimated recovery windows, nutrition focus (high-carb days on workout days, deficit on rest days), and a single goal for the week (*"Hit protein every day — you've managed 4/7 the last two weeks"*)
- User can adjust (swap training days, mark days as travel/rest)
- The plan integrates with the existing schedule — sessions are already pre-populated from the training program

**Technical notes:** Extends the existing `send-reminders` cron endpoint. Uses the nightly cron infrastructure already in place. AI generation via Claude Haiku (low cost, weekly not daily). Leverages `training_programs`, `daily_logs`, and `readiness_scores`.

**Why this matters:** Sunday planning is a proven habit-formation technique. Users who plan their week train more consistently. This notification becomes a weekly ritual — the equivalent of a personal trainer meeting before the week starts.

---

---

## Updated Prioritisation Matrix

| Feature | Impact | Feasibility | Score | Notes |
|---|---|---|---|---|
| **Correlation Engine** (outstanding) | Very High | High | ★★★★★ | Data exists, just needs cron + UI |
| **Readiness Score Widget** (outstanding) | Very High | High | ★★★★★ | Most-missing dashboard element |
| **Voice Check-in** (new) | High | High | ★★★★☆ | Reduces daily friction dramatically |
| **Hydration Tracker** (new) | High | Very High | ★★★★☆ | One column, high daily engagement |
| **Coach Persona** (new) | Medium | Very High | ★★★★☆ | One settings field, high perceived value |
| **PR Hall of Fame** (new) | High | High | ★★★★☆ | `exercise_records` table already designed |
| **Data Export / GDPR** (new) | Medium | High | ★★★☆☆ | Legal requirement, trust signal |
| **Apple HealthKit** (outstanding) | Very High | Medium | ★★★☆☆ | Capacitor now unblocks this |
| **Group Challenges** (outstanding) | High | Medium | ★★★☆☆ | Requires new tables + real-time |
| **AI Form Check** (new) | Very High | Medium | ★★★☆☆ | Killer feature, needs video work |
| **Event Countdown** (new) | High | Medium | ★★★☆☆ | Program generator needs adapting |
| **Injury Tracker** (new) | High | Medium | ★★★☆☆ | High retention impact |
| **Supplement Tracker** (new) | Medium | Medium | ★★★☆☆ | Engaged niche, feeds correlations |
| **Smart Weekly Plan Notification** (new) | High | Medium | ★★★☆☆ | Extends cron + program |
| **Streak Shield** (outstanding) | Medium | Low | ★★☆☆☆ | Requires partner notification flow |
| **Google Health Connect** | High | Low | ★★☆☆☆ | Separate from HealthKit |
| **Grocery List from Meal Plan** (outstanding) | Medium | Medium | ★★☆☆☆ | Nice-to-have nutrition feature |
| **Volume / Gains Tab** (outstanding) | Medium | Medium | ★★☆☆☆ | Workout data exists, just needs UI |

---

## Recommended Next Sprint

Given what's shipped, the highest-ROI next steps are:

1. **Readiness Score widget** (2–3 days) — The most glaring missing piece on the dashboard. Oura data is already flowing in; add the computed score card with colour coding and the AI explanation sheet for non-Oura users using logged signals.
2. **Correlation Engine v1** (3–4 days) — The data is all there. The nightly cron, `insights_cache` table, and a single dashboard insight card would make the app feel dramatically smarter.
3. **Voice Check-in** (1–2 days) — Web Speech API + Claude Haiku extraction. Removes the highest-friction part of daily logging.
4. **Hydration Tracker** (1 day) — One column, tap-to-add on the dashboard, feeds directly into the correlation engine.
5. **Coach Persona** (half a day) — One settings field, system prompt variants. Huge perceived personalisation for almost zero effort.

Total estimated: 8–12 days. This sprint alone closes the biggest intelligence gaps and adds three features users will notice immediately.

---

*Document updated 2026-05-24. Questions, pushback, or additions — flag them and I'll revise.*
