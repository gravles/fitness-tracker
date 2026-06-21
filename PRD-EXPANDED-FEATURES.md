# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-21  
**Status:** Living document — updated with new ideas and progress tracking

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

Last updated 2026-06-21 based on CHANGELOG review.

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry, voice + camera |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter and rest timer |
| Streaks & XP gamification | ✅ 15 badges, level system, shareable cards |
| Trends & analytics | ✅ Charts across 5 dimensions + Withings overlay |
| AI coaching chat | ✅ Context-aware, persisted to Supabase |
| Push notifications | ✅ FCM (iOS + Android), custom reminders with lead-time picker |
| Strava sync | ✅ OAuth, automatic activity sync |
| Withings sync | ✅ OAuth, weight + full body composition |
| Oura sync | ✅ OAuth, readiness + activity |
| Goal Wizard | ⚠️ Built but no entry point in Settings |
| Progress photos | ✅ Upload + compare (Supabase Storage) |
| Body metrics | ✅ Weight chart, body comp from Withings |
| Accountability partners | ✅ Invite by email, weekly summary via Resend |
| Group Challenges | 🔴 Not started |
| Nutrition planning | ✅ /nutrition page with pantry, AI meal plans, saved meals |
| Grocery list | 🔴 Not started |
| Weekly meal planner grid | 🔴 Not started (pantry-based AI only) |
| 12-Week training programs | ✅ Full periodisation, phase management, PR toasts |
| Progressive overload alerts | 🔴 Not started (programs exist but no in-workout suggestions) |
| Volume tracking / Gains tab | 🔴 Not started |
| Correlation Engine & Insight Feed | 🔴 Not started |
| Readiness Score (app-native) | 🔴 Not started (Oura score available, but no app-computed score) |
| Recovery recommendations | 🔴 Not started |
| Native iOS / Android | ✅ Capacitor, App Store + Play Store |
| Apple Health / Google Health Connect | 🔴 Not started (native shell now exists — feasible) |
| Calendar feed (iCal / webcal) | ✅ Subscribable URL, works with Apple/Google Calendar |
| Dark / Light / System theme | ✅ Full token coverage |
| Onboarding flow | ✅ Name, DOB, height, weight, goal |
| Unit preference (kg/lbs) | ✅ Toggle in Profile and Body Metrics |
| Coach chat cross-device persistence | ✅ Supabase-backed |

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

| Feature | Description | Effort | Status |
|---|---|---|---|
| Goal Wizard entry point | Add a "Set Goals with AI" banner to the Settings page that opens GoalWizard | 1h | 🔴 Outstanding |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day | ✅ Done |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day | ✅ Done |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h | 🔴 Outstanding |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h | 🔴 Outstanding |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min | 🔴 Outstanding |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h | 🔴 Outstanding |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h | ✅ Done (macro status bar) |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h | ✅ Done |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day | ✅ Done |

---

## Prioritisation Matrix (Updated 2026-06-21)

Scored on Impact (user value) × Feasibility for a solo developer. Items marked ✅ are shipped.

| Feature | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Win bugs | Medium | Very High | ★★★★★ | Partially done — see appendix |
| Readiness Score (app-native) | Very High | High | ★★★★☆ | 🔴 Outstanding |
| Correlation Engine | Very High | High | ★★★★☆ | 🔴 Outstanding |
| Progressive Overload Alerts | High | High | ★★★☆☆ | 🔴 Outstanding |
| Water Tracking (new) | High | Very High | ★★★★☆ | 🔴 New idea |
| Voice Check-in (new) | Very High | High | ★★★★☆ | 🔴 New idea |
| Supplement Tracker (new) | High | High | ★★★☆☆ | 🔴 New idea |
| Recipe Builder (new) | High | High | ★★★☆☆ | 🔴 New idea |
| Year in Review / Monthly Wrapped (new) | High | High | ★★★☆☆ | 🔴 New idea |
| Apple Health / Google Health Connect | Very High | Medium | ★★★☆☆ | 🔴 Now feasible (native app exists) |
| Group Challenges | Medium | Medium | ★★☆☆☆ | 🔴 Outstanding |
| Grocery List | Medium | Medium | ★★☆☆☆ | 🔴 Outstanding |
| Injury Risk Detection (new) | High | Medium | ★★★☆☆ | 🔴 New idea |
| Coach Personas (new) | Medium | Very High | ★★★☆☆ | 🔴 New idea |
| Customisable Dashboard (new) | Medium | Medium | ★★☆☆☆ | 🔴 New idea |
| Travel Mode (new) | Medium | Medium | ★★☆☆☆ | 🔴 New idea |
| Weekly Meal Planner Grid | High | Low | ★★☆☆☆ | 🔴 Outstanding |

---

## Recommended Next Sprint

Now that the big infrastructure work (native apps, integrations, programs) is shipped, the gap is **intelligence**. The app captures a lot; it doesn't yet explain it.

1. **Readiness Score v1** (2–3 days) — calculated from existing log fields, shown on dashboard. Already designed in full above; just needs implementation.
2. **Correlation Engine v1** (3–4 days) — nightly cron, top 2–3 insights on the dashboard. All data already captured.
3. **Progressive Overload Alerts** (1–2 days) — last session + suggestion shown at the top of each exercise card in the active workout.
4. **Remaining Quick Win bugs** (1 day) — Goal Wizard entry, streak type selector, XP curve, active workout modals.

After that, the new ideas below offer the highest next tier of value.

---

---

## New Feature Ideas (Added 2026-06-21)

The following are brainstormed feature concepts not in the original PRD. They are not scoped or committed — listed here for review and prioritisation.

---

### Idea A — Voice Check-in ("Just Tell Me Your Day")

**The Problem**  
The daily log form is comprehensive but it requires tapping through five tabs. On a busy day, users skip it entirely rather than do a partial log. Voice logging already exists for food, but there's no way to log your whole day by just talking.

**The Idea**  
A single large mic button on the home screen: *"Tell me about your day."* The user dictates anything — *"Slept about 6 hours, had oats for breakfast, went for a 40-minute run at lunch, feeling a bit stressed, had one beer this evening"* — and Claude parses it into a structured daily log entry across all dimensions: sleep, food, movement, stress, alcohol. The user reviews a summary card before confirming.

**Why It's Compelling**  
This is a 60-second full log. It removes the primary reason users skip: effort. It builds on the existing voice food logging infrastructure and the existing Claude integration. Differentiated — no other app does this for the full daily log.

**Data needs:** No new tables. Extends existing `daily_logs`.  
**Effort estimate:** 3–4 days (prompt engineering + UI review card).

---

### Idea B — Supplement Tracker + Correlation

**The Problem**  
Many users take creatine, vitamin D, magnesium, omega-3, pre-workout, etc. daily. None of this is currently tracked, so the correlation engine can't connect supplements to outcomes like energy, sleep, or performance.

**The Idea**  
A simple supplements list in Settings: name, dose, timing (AM / PM / pre-workout). Each day, a "Supplements" checklist appears in the daily log — one tap per supplement to mark taken. The correlation engine then includes supplement adherence as a variable: does taking magnesium correlate with better sleep? Does pre-workout correlate with longer workouts?

**Implementation notes:**
```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,
  timing text,  -- 'morning', 'evening', 'pre_workout', 'with_meal'
  is_active boolean DEFAULT true
);

-- daily_logs gets a new column:
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS supplements_taken text[];
```

**Effort estimate:** 2–3 days (settings UI + daily log checklist + correlation hook).

---

### Idea C — Recipe Builder with Macro Calculator

**The Problem**  
Home cooks make the same meals repeatedly (stir-fry, pasta, chicken salad). Right now every ingredient must be logged separately each time. There's also no way to say "I made a batch of chilli that serves 6 — log one portion."

**The Idea**  
A recipe builder under `/nutrition/recipes`:
1. Name the recipe, set number of servings
2. Add ingredients (same AI food search as the daily log)
3. App calculates total macros and per-serving macros
4. Save as a recipe
5. Log one serving to the daily food diary with one tap — no ingredient-by-ingredient entry

A recipe can be scaled ("I'm making a double batch today") and macros recalculate. Recipes appear alongside Saved Meals in the Nutrition Library.

**Data model:**
```sql
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  servings int NOT NULL DEFAULT 1,
  ingredients jsonb NOT NULL,  -- same food_item structure as daily_logs
  total_calories int,
  total_protein int,
  total_carbs int,
  total_fat int,
  notes text,
  cook_time_min int,
  tags text[],
  use_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**Effort estimate:** 2–3 days (shares ingredient search UI with daily log and saved meals).

---

### Idea D — Daily Water Tracking

**The Problem**  
Hydration is one of the simplest levers for energy and performance, yet it's the most skipped health metric. There's no water tracking in the app today.

**The Idea**  
A water intake counter on the daily log: tap to add 250ml / 500ml / custom. Shows a progress ring toward a daily target (default 2.5L, adjustable in settings, nudged up on workout days). AI coaching can reference hydration ("You've only logged 1L — drink another glass before your afternoon session").

Correlation engine variable: `water_ml` ↔ `energy_level`, `headache_today` (add headache as a new optional habit tracker item).

**Implementation notes:** Simplest possible version is a single `water_ml int` column added to `daily_logs`. The UI is a row of glass icons. The whole feature could ship in under a day.

**Effort estimate:** 1 day.

---

### Idea E — Year in Review / "Fitness Wrapped"

**The Problem**  
Users accumulate data for months and never see the big picture. Retention dips in December and January — the exact moment when a year-in-review would be most motivating.

**The Idea**  
An annual (and optionally monthly) stats summary, styled like Spotify Wrapped — shareable, visual, personal. Delivered as a push notification in late December: *"Your 2026 in fitness is ready."*

Slides could include:
- Total days logged: 247/365
- Total calories tracked: 428,000 kcal
- Total weight lifted (sum of sets×reps×weight across all workouts): 312 tonnes
- Longest streak: 34 days
- Favourite food: "Chicken and rice" (logged 89 times)
- Best lift PR: Bench press +12.5kg
- Biggest improvement: Sleep quality +1.2pts vs last year
- Badge unlock highlight reel

Final slide: a shareable image card (same infrastructure as the existing level-achievement card).

**Effort estimate:** 3–4 days (data aggregation queries + slide UI + share card generation). High delight, viral potential.

---

### Idea F — AI Injury Risk Detection

**The Problem**  
Overuse injuries are the #1 reason people fall off training programs. They're almost entirely preventable with data — the patterns are obvious in retrospect (too much volume too fast, same muscle group every day, no rest days). But users don't notice the patterns themselves.

**The Idea**  
A background analysis that runs weekly alongside the correlation engine and flags potential overuse risks:
- *"You've done chest exercises 6 days in a row. Pec and anterior delt strains peak after 5+ consecutive days. Consider a rest day or swap to pull movements."*
- *"Your training volume jumped 40% this week vs your 4-week average. Research suggests staying under 10% weekly increases to reduce injury risk."*
- *"You haven't logged a rest day in 12 days. Your readiness score trend is declining."*

Shown as an amber/red warning card on the dashboard or the workout schedule page. Dismissible. Not alarmist — framed as a heads-up, not a diagnosis.

**Data needs:** Runs against existing `workout_exercises`, `workout_sets`, `readiness_scores`. A new `health_alerts` table stores active alerts so they don't re-trigger on every load.

```sql
CREATE TABLE health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text NOT NULL,    -- 'overuse_risk', 'volume_spike', 'no_rest_day'
  severity text NOT NULL,      -- 'info', 'warning', 'urgent'
  message text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  resolved_at timestamptz
);
```

**Effort estimate:** 2–3 days (logic + alert card UI).

---

### Idea G — Coach Personas

**The Problem**  
The AI coach has one voice. Some users want a tough drill sergeant; others want gentle encouragement; data-heads want numbers and science citations; casual users want breezy and fun. One size does not fit all.

**The Idea**  
A "Coach Style" selector in Settings with 4 options:
- **The Scientist** — data-first, references research, avoids emotional language ("Your sleep debt of ~1.4h over the last 5 days correlates with a 23% reduction in decision-making quality...")
- **The Motivator** — high energy, celebrates every win, pushes hard ("COME ON! You're 2g of protein away from hitting your goal — you've got this!")
- **The Friend** — warm, conversational, non-judgmental ("Hey, looks like it's been a rough week — totally okay, want to talk about what's getting in the way?")
- **The Coach** — direct, practical, goal-focused ("You missed protein by 30g. Swap the afternoon snack for Greek yoghurt and you'll hit it tomorrow.")

Implementation: a `coach_persona` field in `user_settings` passed as a system-prompt prefix on every AI call. Zero new tables, zero new API routes — just a system prompt modifier.

**Effort estimate:** 1–2 days. Low effort, meaningful personalisation.

---

### Idea H — Food Mood Journal

**The Problem**  
Macros and calories don't capture the full picture. Some foods make you feel great; others leave you bloated, sluggish, or energetically crashed. Users know this intuitively but have no data on it.

**The Idea**  
After logging a meal, an optional "How did it make you feel?" prompt appears 90 minutes later (via push notification): a 3-tap rating — Energised / Neutral / Heavy/Sluggish. Over time, the correlation engine surfaces patterns: *"You rate yourself as energised after meals with <500 calories and >30g protein. Your post-pasta meals average 'heavy.'"*

This also feeds the AI nutritionist's meal plan suggestions — prefer foods with a history of positive mood scores.

**Data needs:** A `food_mood_ratings` table or a `meal_ratings` JSONB column on `daily_logs`. Push notification support already exists.

**Effort estimate:** 2–3 days.

---

### Idea I — Workout Share Card

**The Problem**  
Level-achievement cards are shareable. Individual workouts are not. Completing a hard session with a personal record is a social moment — users want to share it.

**The Idea**  
After completing a workout, if a PR was set (already detected with PR toasts), offer a "Share this workout" button. Generates an image card showing:
- Workout name and duration
- Key stats: total volume, exercises, sets
- Any PRs set (highlighted)
- App branding

Same rendering infrastructure as the level card. Card exported as a PNG, shared via the native share sheet (Capacitor Share API already available).

**Effort estimate:** 1–2 days. Viral channel.

---

### Idea J — Apple Health & Google Health Connect (Now Feasible)

**The Problem**  
This was marked "Future (requires native app)" in the original PRD. The native app now exists (Capacitor, iOS + Android).

**The Update**  
With Capacitor, Apple HealthKit and Google Health Connect are both accessible via community plugins. This is no longer blocked.

**What to read:**
- **Apple Health**: `@capacitor-community/health-kit` or `capacitor-health-connect`
- **Android Health Connect**: `@capacitor-community/health-connect`

**What to sync (read):**
- Steps, active calories burned
- Resting heart rate, HRV (if Apple Watch / Garmin)
- Sleep stages (supplements Oura for non-Oura users)
- Body weight (supplements Withings)
- Workouts (de-duplicate against Strava)

**What to write back:**
- Completed workouts logged in the app → Health
- Body weight entries → Health

**Why now:** Every user who has an Apple Watch or Android phone with a compatible app (Garmin, Fitbit, Samsung Health) would get automatic step and sleep data without any hardware purchase. Removes the biggest data gap for the readiness score (HRV).

**Effort estimate:** 4–6 days (plugin setup, permission flows, sync logic, de-duplication).

---

### Idea K — Smart Grocery List (Complement to Meal Planner)

**The Problem**  
The AI meal planner generates a weekly plan from the pantry. But users still have to figure out what to buy to restock the pantry. The loop isn't closed.

**The Idea**  
After generating a weekly meal plan, a "Generate Shopping List" button appears. The app:
1. Compares the ingredients needed for the meal plan against the pantry inventory
2. Generates a shopping list of only what's missing
3. Groups by supermarket aisle (Produce, Protein, Dairy, Dry Goods, etc.)
4. One-tap to mark items as "in cart" while shopping
5. On checkout, those items auto-update the pantry inventory

The list is shareable as plain text (for copying to WhatsApp, Notes, etc.).

**Effort estimate:** 2–3 days. Closes the planning loop dramatically.

---

### Idea L — Travel Mode / Adaptive Goals

**The Problem**  
Life gets disrupted. When users travel for work, go on holiday, or have an unusually stressful week, they can't hit their normal targets — and the app silently judges them. This is a leading cause of streak breaks and churn: the app feels unforgiving, so users disengage.

**The Idea**  
A "Travel Mode" toggle (or AI-detected from unusual patterns). While active:
- Goals adjust to a "maintenance" level (calories at TDEE, protein target -20%, workouts → "stay active" rather than program sessions)
- The streak logic switches to a softer metric: any log at all preserves the streak, not hitting targets
- Hotel gym workout suggestions (bodyweight / minimal equipment, 20–30 min)
- Streak shield: travel days don't count against streak progress (limited to 7 days per quarter)
- On return: *"Welcome back! Want to pick up your program where you left off?"*

**Effort estimate:** 2–3 days. High retention impact.

---

### Quick Win Additions (New)

| Feature | Description | Effort |
|---|---|---|
| Barcode scan history | Auto-save scanned barcodes to favourites for faster future logging | 2h |
| Workout share card | PNG share card on PR completion (see Idea I above) | 1–2 days |
| Headache habit tracker | Add "headache today" as a default optional habit — feeds hydration correlation | 1h |
| Google Calendar sync | Two-way sync for workout schedule (beyond iCal) | 1 day |
| Offline log queue | Queue daily log saves when offline, flush on reconnect | 1 day |
| Smart notification timing | Learn what time each user typically logs; shift reminder to that time | 2h |
| Workout tempo metronome | In-set tempo guide (e.g. 3-1-2) as an optional audio/haptic cue | 1 day |
| "Deload this week" button | One tap to create a deload week (volume -50%) in the active program | 2h |

---

## Prioritisation Matrix (Updated 2026-06-21)

Scored on Impact (user value) × Feasibility for a solo developer. Items marked ✅ are shipped.

| Feature | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Win bugs | Medium | Very High | ★★★★★ | Partially done — see appendix |
| Readiness Score (app-native) | Very High | High | ★★★★☆ | 🔴 Outstanding |
| Correlation Engine | Very High | High | ★★★★☆ | 🔴 Outstanding |
| Water Tracking (Idea D) | High | Very High | ★★★★☆ | 🔴 New |
| Voice Check-in (Idea A) | Very High | High | ★★★★☆ | 🔴 New |
| Coach Personas (Idea G) | Medium | Very High | ★★★★☆ | 🔴 New |
| Progressive Overload Alerts | High | High | ★★★☆☆ | 🔴 Outstanding |
| Supplement Tracker (Idea B) | High | High | ★★★☆☆ | 🔴 New |
| Recipe Builder (Idea C) | High | High | ★★★☆☆ | 🔴 New |
| Workout Share Card (Idea I) | High | High | ★★★☆☆ | 🔴 New |
| Year in Review / Wrapped (Idea E) | High | High | ★★★☆☆ | 🔴 New (time-sensitive: Dec) |
| Apple Health / Google Health Connect (Idea J) | Very High | Medium | ★★★☆☆ | 🔴 Now feasible |
| Injury Risk Detection (Idea F) | High | Medium | ★★★☆☆ | 🔴 New |
| Travel Mode (Idea L) | High | Medium | ★★★☆☆ | 🔴 New |
| Smart Grocery List (Idea K) | Medium | Medium | ★★★☆☆ | 🔴 Outstanding |
| Food Mood Journal (Idea H) | Medium | Medium | ★★☆☆☆ | 🔴 New |
| Group Challenges | Medium | Medium | ★★☆☆☆ | 🔴 Outstanding |
| Weekly Meal Planner Grid | Medium | Low | ★★☆☆☆ | 🔴 Outstanding |
| Customisable Dashboard | Medium | Low | ★★☆☆☆ | 🔴 New |

---

## Recommended Next Sprint

Now that the big infrastructure work (native apps, integrations, programs) is shipped, the gap is **intelligence and delight**. The app captures a lot; it doesn't yet explain or celebrate it.

**Sprint priority order:**
1. **Remaining Quick Win bugs** (1 day) — Goal Wizard entry, streak type selector, XP curve, active workout modals
2. **Water Tracking** (1 day) — tiny lift, fills an obvious gap, feeds correlation engine
3. **Readiness Score v1** (2–3 days) — designed in full above; just needs implementation
4. **Correlation Engine v1** (3–4 days) — all data already captured; nightly cron + insight card on dashboard
5. **Progressive Overload Alerts** (1–2 days) — last session + suggestion shown in active workout
6. **Coach Personas** (1–2 days) — zero infrastructure; prompt modifier only; high perceived personalisation

After that, Voice Check-in and Supplement Tracker offer the next tier of differentiation.

---

*Document last revised 2026-06-21. Questions, pushback, or additions — flag them and I'll revise.*
