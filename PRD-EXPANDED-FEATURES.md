# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-06-27 with brainstormed features)  
**Status:** Proposal — for review

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

## Brainstormed New Features — For Review

The following ideas emerged from thinking about gaps in the current feature set and patterns from the existing data model. None of these are scheduled or prioritised yet — they are candidates to add to the roadmap if they resonate.

---

### Idea A — Food Photo Logging (AI Vision)

**The Problem**  
Manual food entry is the #1 source of friction in nutrition tracking. Most users don't give up on the app because they don't care about macros — they give up because typing "200g chicken breast, 150g sweet potato, 1 tbsp olive oil" after every meal is tedious.

**What It Would Do**  
Add a camera icon to the food log entry screen. The user snaps a photo of their meal. The image is sent to Claude's vision API, which:
1. Identifies each food item in the image
2. Estimates portion sizes from visual cues (plate size, hand scale, standard servings)
3. Returns a pre-filled list of food items with estimated calories and macros
4. The user reviews, adjusts portions if needed, and taps Log

For meals that are hard to identify visually (smoothies, curries, stews), the model prompts for clarification: *"This looks like a stew — can you tell me what's in it?"*

**Data Model Changes**  
No new tables. The photo-parsed result feeds into the existing `daily_logs.food_items` jsonb field. Optionally store the image URL in Supabase Storage for audit/review purposes.

**New Route**  
`POST /api/log/photo-parse` — accepts a base64 image, returns a structured food items array.

**Why It Matters**  
Reducing the daily logging effort by 60–80% for meals is the single highest-leverage thing the app could do for retention. Users who log consistently get the data quality needed for all the intelligence features to work. This feature is the foundation everything else rests on.

**Estimated Effort:** 2–3 days (API route + UI camera flow)  
**Dependency:** Claude API vision capability (already available in claude-sonnet-4-x)

---

### Idea B — Adaptive TDEE Engine

**The Problem**  
Every fitness app calculates calorie targets using the Harris-Benedict or Mifflin-St Jeor formula based on height, weight, age, and an activity multiplier. These formulas are population averages — they can be off by 200–400 kcal/day for any given individual. After weeks of logging, the app has actual data to do better.

**What It Would Do**  
After the user has 14+ days of food logs and weight check-ins, run a background calculation:

```
Actual TDEE = Average Daily Calories Logged + (Weight Change Rate × 7700)
```

(7700 kcal ≈ 1 kg of body fat)

If the user logged 1,800 kcal/day on average and lost 0.3 kg/week, their actual TDEE is ~2,010 kcal.

Show a dashboard card:
> *"Based on your last 28 days of data, your actual maintenance calories appear to be ~2,010 kcal — about 10% higher than your formula estimate. We recommend updating your calorie goal."*

One-tap to apply the updated target. Re-runs monthly or when the user's weight trend changes.

**Data Model Changes**  
Add `actual_tdee int, tdee_confidence text, tdee_calculated_at timestamptz` to `user_settings`. No new table needed.

**Why It Matters**  
Personalised calorie targets are dramatically more effective than formula estimates. This feature makes every other nutrition feature more accurate and demonstrates that the app is learning from the user's specific biology — a powerful differentiator.

**Estimated Effort:** 1–2 days (calculation function + dashboard card)

---

### Idea C — Habit Tracker

**The Problem**  
The daily log captures food, movement, and five wellness sliders. But many health habits don't fit those categories: taking supplements, drinking enough water, hitting 10,000 steps, meditating, limiting screen time before bed, flossing. Users who want to build these habits currently have no home for them in the app.

**What It Would Do**  
A "Daily Habits" section in the log (collapsed by default, expandable) with customisable habit checkboxes. Built-in defaults:

- 💧 8 glasses of water
- 🧘 10 minutes of mindfulness
- 🪥 Morning / Evening routine complete
- 💊 Supplements taken
- 📵 No screens 1hr before bed
- 🚶 10,000 steps

Users can add custom habits with custom names and icons. Each habit shows:
- A daily checkbox
- A streak counter (separate from the main streak)
- A 7-day completion grid (like GitHub's contribution graph)

Completing habits earns small XP bonuses (e.g., 5 XP each, 20 XP bonus for 5+ in one day).

**Data Model**

```sql
CREATE TABLE user_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id uuid REFERENCES user_habits(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  UNIQUE(habit_id, completed_date)
);
```

**Why It Matters**  
Habit tracking is one of the most requested features in health apps. It expands the app's utility beyond fitness into general wellness, increasing daily engagement. The correlation engine (Pillar 1) immediately benefits: habit completion data becomes another variable to correlate with energy and mood.

**Estimated Effort:** 3–4 days (data model + UI + streaks + XP)

---

### Idea D — Body Weight Intelligence (Moving Average + Plateau Detection)

**The Problem**  
Daily body weight fluctuates by 1–3 kg due to water retention, sodium, glycogen, and digestive contents. This noise causes anxiety and makes it impossible to see real fat loss trends. Many users weigh themselves, see a higher number than yesterday, feel defeated, and stop logging. They're not seeing real trend — they're reacting to noise.

**What It Would Do**  
Three additions to the existing weight chart (no new tables):

1. **7-Day Moving Average Line** — plotted as a smooth trend line over the daily weight scatter plot. Shows the real direction of travel, ignoring day-to-day noise.

2. **Plateau Detection** — after 14+ days where the moving average variance is <0.3% and the user is logging a calorie deficit, surface an insight card:
   > *"Your weight has been stable for 3 weeks despite an average deficit of 300 kcal/day. This is common after initial progress — your body may have adapted. Consider a 1-week refeed at maintenance, or re-measure your actual TDEE."*

3. **Progress Context** — instead of just showing current weight, show:
   > *"You're 1.4 kg below your start weight. At your current pace, you'll reach your goal in ~6 weeks."*

**Why It Matters**  
This is pure intelligence layered on data that's already being collected. It requires no new user behaviour, only smarter presentation. It directly prevents one of the most common causes of app abandonment: users seeing noise as failure.

**Estimated Effort:** 1–2 days (chart enhancement + cron insight calculation)

---

### Idea E — Fasting & Time-Restricted Eating Tracker

**The Problem**  
Intermittent fasting (16:8, 18:6, OMAD) is one of the most popular dietary approaches among health-conscious users. Currently there is no way to track this in the app. Users who fast have no insight into their eating window compliance, fasting duration, or how it correlates with their energy and mood data.

**What It Would Do**  
A lightweight fasting timer, accessible from the daily log and optionally from the dashboard:

- **Start fast / End fast** buttons that log timestamps
- Shows current fasting duration in real time
- Colour-coded target zones (e.g., green at 16h for 16:8)
- Weekly eating window chart: horizontal bars per day showing when the eating window was open

Optional integration with the nutrition log: if the user logs food outside their fasting window, a gentle nudge appears ("That breaks your fast at 14h 20m — still want to log it?")

Fasting data feeds the correlation engine as a new variable: eating window compliance ↔ energy level, weight trend, sleep quality.

**Data Model**

```sql
CREATE TABLE fasting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  fast_start timestamptz NOT NULL,
  fast_end timestamptz,          -- null if fast is ongoing
  target_hours int DEFAULT 16,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

**Why It Matters**  
IF is a first-class dietary strategy for a large portion of the fitness-conscious market. Supporting it turns the app from "works best for CICO counters" to "works for me" for this entire segment.

**Estimated Effort:** 2 days (data model + timer UI + weekly chart)

---

### Idea F — Event & Race Countdown Planner

**The Problem**  
Many fitness users train *for something* — a 5K, a marathon, a triathlon, a holiday, a wedding. But the app treats all training the same regardless of whether the user has a goal event. There is no way to tell the app "I want to run a half-marathon on October 12th" and have it plan backwards from that date.

**What It Would Do**  
A "Goal Event" field in Settings (or the Goal Wizard). The user enters:
- Event type (5K, 10K, half marathon, marathon, triathlon, powerlifting meet, general fitness, other)
- Event date
- Current fitness level (beginner / intermediate / advanced)

The app then:
1. Calculates weeks until the event and displays a countdown on the dashboard
2. Generates a phase-based training structure (base building → race-specific → taper) using Claude
3. Week-by-week targets feed into the existing workout schedule system
4. In the final 2 weeks, the readiness score (Pillar 4) adjusts recommendations toward taper (lower volume, maintain intensity)
5. On event day, a special log prompt: "How did your event go?"

**Data Model**

```sql
-- Add to user_goals or create standalone:
CREATE TABLE goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_type text NOT NULL,   -- '5k', 'half_marathon', 'powerlifting', 'other'
  event_date date NOT NULL,
  fitness_level text NOT NULL,
  training_plan jsonb,         -- AI-generated week-by-week plan
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**Why It Matters**  
Having a goal event dramatically increases training adherence — users with a race on the calendar have a concrete reason to show up. This feature makes the app feel like it's rooting for the user's specific ambition, not just tracking generic fitness. It also creates a natural re-engagement moment when the event date approaches.

**Estimated Effort:** 3–4 days (data model + AI plan generation + countdown UI + schedule integration)

---

### Idea G — Sleep Coaching Module

**The Problem**  
Sleep quality is already tracked as a 1–5 slider in the daily log, and the correlation engine will surface its relationship to performance. But there is no proactive coaching around sleep — no bedtime reminders, no wind-down routine suggestions, no weekly sleep report. The app captures the data but offers no guidance on improving it.

**What It Would Do**  
A dedicated Sleep section (accessible from wellness log or the correlation insight card):

**Bedtime Reminder** — an intelligent push notification that fires not at a fixed time, but calculated from the user's target wake time and their logged average sleep duration: *"Based on your patterns, you need to be asleep by 10:40 PM to hit your 7.5h goal."*

**Wind-Down Routine** — a short, configurable checklist that appears with the bedtime notification. Options like: dim lights, stop screens, take magnesium, do 5 minutes of stretching. Completion tracked as a habit (ties into Idea C).

**Weekly Sleep Report** — a card in the weekly analysis showing:
- Average sleep quality score
- Best sleep night and what preceded it (from correlation engine)
- Worst sleep night and what preceded it
- Trend vs. last week

**Sleep Debt Tracker** — if the user has logged below their target sleep quality for 3+ consecutive nights, surface an insight: *"You've had below-target sleep for 5 days. This typically shows up as reduced energy and weaker workouts. Prioritising sleep this weekend could reset your trajectory."*

**Why It Matters**  
Sleep is the single highest-leverage health variable — it affects every other metric the app tracks. But most fitness apps treat it as an afterthought. A sleep coaching layer that uses the user's own data would be genuinely differentiated. It also gives the correlation engine more data to work with.

**Estimated Effort:** 2–3 days (smart bedtime notifications + weekly report card + wind-down routine)

---

### Idea H — Data Export & Health Reports

**The Problem**  
Users accumulate months of detailed health data in the app but have no way to export it. This creates two problems: (1) users can't share relevant data with their doctor, dietitian, or personal trainer, and (2) users worry about data lock-in and may be reluctant to log comprehensively. Portability builds trust.

**What It Would Do**  
A "My Data" section in Settings with three export options:

1. **PDF Monthly Report** — a beautifully formatted 2-page summary showing: weight trend chart, average macros, workout frequency, key habits, sleep quality trend, top insights. Shareable with a doctor or trainer. Generated server-side using a PDF library.

2. **CSV Raw Export** — download all logged data (daily logs, workouts, body metrics, insights) as a CSV zip file. Full data portability.

3. **Shareable Progress Link** — a time-limited read-only URL showing the user's last 30 days of progress as a public page (opt-in). Useful for sharing with a coach or accountability partner who doesn't have the app. Expires after 7 days.

**New Route**  
- `GET /api/export/pdf?month=2026-06` — generate monthly PDF  
- `GET /api/export/csv` — generate data zip  
- `POST /api/export/share-link` — create a time-limited read-only token

**Why It Matters**  
Data portability is increasingly a user expectation (and in some jurisdictions a legal right under GDPR/CCPA). More practically, a PDF report that users share with their doctor or trainer is free word-of-mouth marketing. Shareable progress links are a lightweight viral loop without building a full social network.

**Estimated Effort:** 2–3 days (PDF generation + CSV export + share link)

---

### Idea I — Injury & Pain Log

**The Problem**  
Every regular exerciser eventually deals with an injury or niggle — a tweaked shoulder, knee pain, lower back tightness. When this happens, most fitness apps become useless: they still recommend bench press when the shoulder is injured, still count a missed workout as a streak break. There is no graceful handling of the "I'm hurt" scenario.

**What It Would Do**  
A simple injury logging panel (accessible from workout start screen or Settings):

- User selects affected body area from a body diagram (shoulder, knee, lower back, etc.)
- Rates severity: mild (1–2), moderate (3), severe (4–5)
- Optional notes

When an injury is active:
- Workout suggestions automatically exclude exercises that use the affected muscle group (using a hardcoded muscle-group-to-exercise mapping, same as in Pillar 3)
- Streaks don't break for modified/rest days during an active injury (an "Injury Mode" flag)
- Coach chat gets context: *"[User has a moderate right knee injury logged since June 15]"*
- For moderate injuries, a suggested return-to-training protocol appears: Week 1 rest → Week 2 bodyweight only → Week 3 light load → Week 4 resume normal

**Data Model**

```sql
CREATE TABLE injury_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body_part text NOT NULL,       -- 'left_knee', 'lower_back', 'right_shoulder', etc.
  severity int NOT NULL,         -- 1-5
  notes text,
  start_date date NOT NULL,
  end_date date,                 -- null if ongoing
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**Why It Matters**  
Injury is one of the top reasons people stop working out and stop using fitness apps. An app that handles injury gracefully — protecting the streak, adjusting recommendations, suggesting safe alternatives — keeps users engaged through recovery instead of losing them. This feature is high empathy at relatively low engineering cost.

**Estimated Effort:** 2–3 days (data model + workout filter + streak mode + coach context injection)

---

### Idea J — Supplement Tracker

**The Problem**  
Many fitness users take supplements (creatine, protein, vitamins, omega-3, pre-workout, magnesium) on a daily or workout-day schedule. Compliance with supplement protocols is notoriously poor — people forget. And there's no way to correlate supplement intake with performance outcomes in the app.

**What It Would Do**  
A lightweight supplement log within the daily check-in:

- User defines their supplement stack in Settings (name, dose, timing — morning / pre-workout / post-workout / evening)
- Daily log shows supplement checkboxes at the appropriate time of day
- Smart reminder notifications at the defined timing
- Weekly compliance report (took creatine 6/7 days)
- Supplement compliance added to the correlation engine as a variable

**Data Model**

```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,            -- 'Creatine Monohydrate'
  dose text,                     -- '5g'
  timing text NOT NULL,          -- 'morning', 'pre_workout', 'post_workout', 'evening'
  days_of_week int[],            -- null = every day, [1,2,3,4,5] = weekdays
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES user_supplements(id) ON DELETE CASCADE,
  taken_date date NOT NULL,
  UNIQUE(supplement_id, taken_date)
);
```

**Why It Matters**  
Supplement tracking is a natural adjacent habit for the fitness-focused user. It adds another daily touchpoint without requiring new behaviour from the user — they're already opening the app to log food. The correlation engine immediately benefits: "Your energy is 22% higher on days you take your B12."

**Estimated Effort:** 2 days (data model + daily log integration + reminders + compliance report)

---

### Summary of New Ideas

| Idea | Rough Impact | Rough Effort | Best Sprint |
|---|---|---|---|
| A — Food Photo Logging (AI Vision) | Very High | Medium (2–3 days) | Sprint 2 |
| B — Adaptive TDEE Engine | High | Low (1–2 days) | Sprint 2 |
| C — Habit Tracker | High | Medium (3–4 days) | Sprint 2–3 |
| D — Body Weight Intelligence | High | Low (1–2 days) | Sprint 1 (add to existing) |
| E — Fasting / TRE Tracker | Medium | Low-Medium (2 days) | Sprint 3 |
| F — Event & Race Countdown | High | Medium (3–4 days) | Sprint 3 |
| G — Sleep Coaching Module | Very High | Medium (2–3 days) | Sprint 2 |
| H — Data Export & Health Reports | Medium | Medium (2–3 days) | Sprint 3 |
| I — Injury & Pain Log | High | Medium (2–3 days) | Sprint 2 |
| J — Supplement Tracker | Medium | Low (2 days) | Sprint 3 |

**Highest-priority additions to existing sprints:**
- **Sprint 1 addition:** Idea D (Body Weight Intelligence) — pure charting upgrade on existing data, very low risk
- **Sprint 2 candidates:** Ideas A (Photo Logging), B (Adaptive TDEE), G (Sleep Coaching), I (Injury Log)
- **Sprint 3 candidates:** Ideas C (Habit Tracker), E (Fasting), F (Race Countdown), H (Export), J (Supplements)

---

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
| **New Ideas** | | | | |
| Food Photo Logging (AI Vision) | Very High | Medium | ★★★★☆ | Sprint 2 |
| Body Weight Intelligence (MA + plateau) | High | Very High | ★★★★★ | Sprint 1 (add-on) |
| Sleep Coaching Module | Very High | Medium | ★★★★☆ | Sprint 2 |
| Injury & Pain Log | High | Medium | ★★★★☆ | Sprint 2 |
| Adaptive TDEE Engine | High | Very High | ★★★★☆ | Sprint 2 |
| Habit Tracker | High | Medium | ★★★☆☆ | Sprint 2–3 |
| Event & Race Countdown | High | Medium | ★★★☆☆ | Sprint 3 |
| Data Export & Health Reports | Medium | Medium | ★★★☆☆ | Sprint 3 |
| Fasting / TRE Tracker | Medium | High | ★★★☆☆ | Sprint 3 |
| Supplement Tracker | Medium | High | ★★☆☆☆ | Sprint 3–4 |

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
