# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-05-28)  
**Status:** Living document — updated with new brainstormed ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter, autosave per set |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, Supabase-persisted cross-device |
| Push notifications | ✅ Server-side, FCM (iOS + Android), workout reminders |
| Strava sync | ✅ OAuth + automatic activity sync |
| Goal Wizard | ⚠️ Built but no entry point |
| Progress photos | ✅ Upload + compare (Supabase Storage) |
| Body metrics | ✅ Photos, weight history, kg/lbs toggle |
| Social / sharing | ⚠️ Accountability Partners (email only); Group Challenges not started |
| Nutrition planning | ✅ Full planner: pantry, AI meal plans, saved meals, grocery list |
| Recovery / readiness | 🔴 Not started |
| Wearable integrations | ✅ Strava, Withings (body comp), Oura (readiness/sleep) |
| 12-Week Training Programs | ✅ AI-generated, 1RM-derived weights, PR toasts, adherence grid |
| Progressive overload alerts | ✅ Epley 1RM estimates, target weights pre-loaded |
| Barcode scanner (food) | ✅ Shipped in v1.1 |
| Camera meal recognition | ✅ Photo-to-nutrition AI |
| Native iOS / Android apps | ✅ Capacitor builds, App Store + Play Store |
| iCal calendar feed | ✅ Subscribable webcal:// feed of scheduled workouts |
| Onboarding flow | ✅ First-launch data collection, personalised AI |
| Dark / light / system theme | ✅ Full token coverage |
| Correlation Engine & Insight Feed | 🔴 Not started |
| Apple Health / Google Fit | 🔴 Requires native shell (post-MVP) |
| Group Challenges | 🔴 Not started |

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

## Brainstormed Feature Ideas (2026-05-28)

The original six pillars are largely shipped. The app is now genuinely strong — it tracks, plans, coaches, and integrates with hardware. The ideas below are the next creative layer: features that would make it feel *personal*, *automated*, and *irreplaceable*. Organised by theme, with enough detail to evaluate and spec if the idea appeals.

---

### Theme A — Recovery & Body Intelligence

#### A1. Recovery & Readiness Score *(still the highest-priority unbuilt item)*

This is Pillar 4 from the original PRD — still not started, still the biggest gap. The algorithm is already fully specified (page 12). Now that Oura sync is live, the `hrv_avg` and `sleep_score` fields from `sleep_records` can feed directly into the weighted formula, replacing the estimated sleep quality score with gold-standard data. Start with the algorithm-only v1 (no Oura dependency), then layer in Oura data automatically where available.

**Estimated effort:** 2–3 days. Highest ROI of anything remaining.

---

#### A2. Injury & Soreness Body Map

A silhouette of the human body (front + back) where users can tap to mark sore or injured areas — by region (left knee, lower back, right shoulder, etc.) and severity (mild / moderate / sharp). Data stored per day.

**How it connects:**
- AI coach automatically checks the soreness map before suggesting workouts and avoids exercises that load the flagged areas
- Readiness score gets a modifier: "lower back pain" → −10 points
- Over time the map shows injury frequency patterns: "You get left knee soreness every 4–5 weeks of heavy leg days" → becomes a Correlation Engine insight
- Alerts the user if they've had the same area marked for 5+ consecutive days: *"You've had lower back pain for 6 days — consider seeing a physio"*

**New data model:**
```sql
CREATE TABLE soreness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  regions jsonb NOT NULL,  -- [{ area: 'lower_back', severity: 'moderate' }]
  UNIQUE(user_id, date)
);
```

**Effort:** 1–2 days. The body-map SVG tap UI is the bulk of the work.

---

#### A3. ACWR Training Load Monitor (Acute:Chronic Workload Ratio)

The ACWR is the gold-standard injury-prevention metric in sports science: divide the 7-day average training load by the 28-day average. A ratio above 1.5 ("spike zone") dramatically increases injury risk. Below 0.8 means detraining.

The data already exists in `workout_sets` (sets × reps × weight = volume load) and `daily_logs` (movement duration).

**What the user sees:**
- A small ACWR badge on the Workout page / Readiness Score card
- Green (0.8–1.3) / Amber (1.3–1.5) / Red (>1.5 or <0.8)
- Tooltip: *"Your training load spiked this week — reduce intensity or take a rest day to stay in the safe zone"*

**Effort:** 1 day. Pure calculation from existing data, no new tables needed beyond a cached value in `readiness_scores`.

---

#### A4. RPE (Rate of Perceived Exertion) per Session

After completing a workout (on the session-complete screen), prompt the user with a single 1–10 RPE slider: *"How hard was that?"* Stored on the `workouts` table.

**Why it matters:**
- Progressive overload algorithm becomes smarter: if RPE is 9/10 at 60kg, don't suggest 62.5kg yet; if RPE was 5/10, suggest a bigger jump
- Trends over time show when training is chronically too easy or too hard
- Combined with the Correlation Engine: "Your RPE is 2 points higher on days you sleep under 6 hours"

**New column:** `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rpe int CHECK (rpe BETWEEN 1 AND 10);`

**Effort:** Half a day. One slider on the session-complete screen, one column.

---

### Theme B — Tracking Completeness

#### B1. Water Intake Tracker

Hydration is one of the most commonly requested features in fitness apps and one of the most impactful for energy and performance. 

**The feature:**
- A row on the daily log (or a persistent widget on the dashboard): current water intake vs. target (default 2.5L, configurable)
- Quick-add buttons: +200ml / +330ml / +500ml / +750ml / custom
- Progress fills a visual glass or wave animation
- Evening notification if user is >500ml short of target by 8pm

**Correlation Engine integration:** Once 30+ days of data exist, surface the correlation between hydration and energy/performance: *"Your energy level is 22% higher on days you hit your water target."*

**New column:** `ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_ml int DEFAULT 0;`

**Effort:** Half a day for the UI and column. The notification logic reuses the existing reminder infrastructure.

---

#### B2. Supplement Tracker

Users who take creatine, protein powder, vitamins, fish oil, etc. currently have no way to track this. A supplement log is:
- High signal for the Correlation Engine (does creatine consistency correlate with strength gains?)
- A retention hook (users who track more stick around longer)
- Practically useful for protocols that require consistent timing (e.g., creatine loading)

**The feature:**
- A supplements section in Settings: add supplements with name, dose, unit, and typical timing (morning / pre-workout / evening)
- Daily log shows a supplement checklist (similar to the existing habits checklist)
- AI coach is aware of the supplement log and can comment: *"You've missed creatine 4 days this week — consistency matters for saturation"*

**New tables:**
```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose numeric,
  unit text,   -- 'g', 'mg', 'ml', 'capsules'
  timing text, -- 'morning', 'pre_workout', 'post_workout', 'evening', 'with_meals'
  is_active boolean DEFAULT true
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  supplement_id uuid REFERENCES user_supplements(id),
  taken boolean DEFAULT false,
  UNIQUE(user_id, date, supplement_id)
);
```

**Effort:** 1.5 days.

---

#### B3. Fasting / Eating Window Tracker

Intermittent fasting (16:8, OMAD, 5:2) is extremely popular and has zero tracking support in the app today. The food log already captures timing implicitly via timestamps on food entries, but doesn't surface it.

**The feature:**
- Opt-in from Settings → Nutrition: "I follow an eating window" → pick protocol or custom window
- Dashboard widget: shows current fast duration, time until eating window opens, countdown
- When the user logs food outside their eating window, a gentle nudge (not a hard block): *"That's outside your 16:8 window — logging anyway"*
- Weekly fasting adherence score on the Trends page

**No new tables needed** if eating windows are stored in `user_settings.nutrition_prefs`. Time-stamped food entries already exist.

**Effort:** 1 day.

---

### Theme C — AI Intelligence Layer

#### C1. Correlation Engine & Insight Feed *(Pillar 1 — still unbuilt)*

Still the single most impactful feature not yet shipped. Full spec is on page 5 of this document. Summary: a nightly cron runs Pearson correlation across key variable pairs in `daily_logs`, stores results in `insights_cache`, and surfaces the top finding as a weekly insight card on the dashboard.

Now that we have Oura sleep data (actual sleep stages, HRV), the correlation quality improves significantly — the sleep quality signal is objective rather than self-reported.

**Additional correlation pairs to add (beyond the original list):**
- `hrv_avg` ↔ `workout_rpe` (if A4 is built)
- `water_ml` ↔ `energy_level` (if B1 is built)
- `supplement_taken (creatine)` ↔ `workout_volume` (if B2 is built)
- `workout_rpe` ↔ `sleep_quality_next_night`

**Effort:** 3–4 days. No new infrastructure — cron and `insights_cache` table are all that's needed.

---

#### C2. AI Workout Debrief

When the user taps "Finish Workout" on the active workout screen, instead of just closing, show a brief AI-generated debrief card (generated client-side after save, cached to the workout record):

> *"Great session — you hit a new estimated 1RM on deadlift (127kg). Upper/lower split looks good this week: you've now trained legs twice and back once. Consider adding a pull session before Thursday. Post-workout window: aim for 40g protein in the next 45 minutes."*

This is distinct from the AI coach (which requires the user to ask). The debrief is *automatic and specific* — it knows exactly what just happened.

**What goes into the prompt:**
- Sets/reps/weights just completed, comparison to last session for each exercise
- New PRs set in this session
- Weekly training split so far (muscle groups hit)
- Current day's nutrition (protein eaten so far)
- User's protein target

**New column:** `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_debrief text;`

Generated once on session save, never regenerated. Uses Haiku for speed and cost.

**Effort:** 1 day.

---

#### C3. "What Should I Do Today?" Daily Recommendation

A single prominent button or card on the dashboard for users who don't want to think: *"Ask AI."* It synthesises everything — readiness score (when built), current program day (if on a program), weekly training balance, nutrition today, and last few days — and returns one concrete recommendation:

> *"Rest day — your readiness is 44 (low sleep, high stress this week). Suggestion: 20-min walk + mobility. Your program's next session is Upper Body B, which you could shift to tomorrow."*

or

> *"Go time — readiness 82. Today is your program's Heavy Squat day. Pre-load the session now: you'll be targeting 3×5 @ 95kg based on your last session."*

This is more actionable than the Smart Coach tip (which is observational) and more integrated than the AI coach (which requires a question).

**Implementation:** API route `/api/ai/daily-recommendation`, cached per day, generated on first dashboard load. Uses the Claude Sonnet API with a structured prompt that merges readiness, program, and log data.

**Effort:** 1.5 days.

---

#### C4. Natural Language Goal Updates

Currently changing nutrition targets requires navigating to Settings → Nutrition Targets and adjusting sliders. This is friction. Instead, let users say it in the AI coach: *"I want to start a bulk — put me at 500 calorie surplus"* or *"I'm cutting now, drop my calories to 1800."*

The AI coach recognises goal-change intent, confirms the new targets, and writes them directly to `user_settings` via a tool call.

**Implementation:** Add a `setNutritionTargets` tool to the coach's tool registry (Claude's function-calling). Restrict to calorie ±20% of TDEE as a guardrail.

**Effort:** Half a day. The tool-calling infrastructure already exists in the coach.

---

### Theme D — Reporting & Data Ownership

#### D1. Monthly Fitness Report (PDF)

On the 1st of every month, generate a shareable PDF report of the previous month — the user's personal "Wrapped" moment. Written by Claude Sonnet in narrative prose, not just charts.

**Contents:**
- Cover: month, name, key stats (workouts, streak, weight change, protein adherence %)
- Narrative summary: *"May was your strongest month yet. You completed 18 workouts — up from 13 in April — and hit your protein target 22 out of 31 days. You set new 1RMs on squat and bench press..."*
- Top insights from the Correlation Engine for the month
- Progress photos comparison (if available)
- Goals for next month (pulled from Goal Wizard, with AI suggestions)

**Technical approach:** Generate HTML on the server using React components → Puppeteer or `@react-pdf/renderer` → PDF stored in Supabase Storage → shareable link + download.

**Effort:** 2–3 days. Puppeteer adds complexity; `@react-pdf/renderer` is lighter.

---

#### D2. Full Data Export (CSV / JSON)

Users should own their data. A "Download all my data" button in Settings → Privacy exports everything:
- `daily_logs` → CSV
- `workouts` + `workout_exercises` + `workout_sets` → CSV
- `body_metrics` → CSV
- `user_settings` → JSON

Packaged as a ZIP file, generated server-side, emailed to the user (via Resend) or offered as an immediate download.

**Effort:** 1 day. Mostly a Supabase query and `archiver` npm package.

---

#### D3. Weekly Personal Wins Email (to Self)

Every Sunday evening, send the user a curated email about *their own* week — distinct from the partner summary email which is about accountability. This one is a personal reflection:

- "Your week in numbers": days logged, workouts, streak, protein days
- "This week's win": AI picks the single best thing from the week (a PR, a perfect day, a long streak milestone)
- "This week's pattern": top insight from the Correlation Engine
- "Next week's intention": one AI-generated suggestion based on what was weak this week

Opt-in, configurable day/time, uses Resend.

**Effort:** 1 day. The data pipeline is the same as the partner summary email.

---

### Theme E — Social & Engagement

#### E1. Group Challenges *(from Pillar 5 — still unbuilt)*

The data model for this is already fully specced in Pillar 5 (page 17 of this document). The missing piece is the challenge browser UI and nightly progress computation. A minimal v1 could launch with:
- 3 built-in challenge templates: "7-day protein streak", "30 logged days", "100,000 XP club"
- Join via a shareable link (no invite required)
- Leaderboard visible to members; names anonymous unless revealed
- Completion notification to all members when someone finishes

More complex free-form challenges can be v2.

**Effort:** 2–3 days.

---

#### E2. Challenge Templates Library

Pre-built 1-tap challenges users can self-start without needing friends:
- **"Protein Warrior"** — hit protein target 7 days in a row
- **"Iron Consistency"** — complete 3 workouts per week for 4 weeks
- **"Sleep Architect"** — log sleep quality ≥4 for 14 consecutive days
- **"Dry January / Sober October"** — zero alcohol logged for 30 days
- **"Couch to Active"** — 10,000+ steps (via integration) or movement completed 5 days/week for 30 days

These are solo challenges — no social component needed. They award special XP and a unique badge on completion. Low barrier to try; high satisfaction on finish.

**Effort:** 1 day. Mostly config, using the existing badge/XP infrastructure.

---

### Theme F — Integration Depth

#### F1. Garmin Integration

Garmin is the dominant wearable for serious runners, cyclists, and triathletes — arguably more relevant than Withings for athletic users. Garmin Connect has an OAuth API that provides:
- Daily steps, active calories, floors climbed
- Sleep staging (when paired with a compatible watch)
- VO2Max estimate
- HRV status (newer Garmin devices)
- Activities (runs, cycles, swims) → sync to `workouts`

**Effort:** 2 days. OAuth + REST API, same pattern as Withings.

---

#### F2. WHOOP Integration

WHOOP is the recovery-focused wearable — its entire product is built around strain, recovery, and sleep coaching, which maps perfectly onto Pillars 4 (Readiness Score). The WHOOP API (developer.whoop.com) provides:
- Recovery score (0–100, their proprietary model)
- HRV, resting heart rate, respiratory rate
- Sleep stages and sleep performance score
- Strain score per activity

If a user has WHOOP, this data replaces the estimated readiness score entirely with WHOOP's gold-standard algorithm.

**Effort:** 2 days. OAuth + REST API. The highest-quality single integration for the readiness feature.

---

#### F3. Apple Health / Google Fit *(from Pillar 6 — still long-term)*

Since the native iOS and Android apps now exist via Capacitor, the barrier to HealthKit and Health Connect integration is lower than it was. The apps need a native Capacitor plugin:
- **iOS:** `@capacitor-community/health-kit` (open source, covers all required read/write scopes)
- **Android:** Health Connect API via a Capacitor plugin

Both would auto-sync weight, steps, active calories, and workouts — eliminating the most repetitive manual logging.

**Effort:** 3–4 days each. Highest value, but requires review of Apple's HealthKit privacy guidelines and Health Connect policies.

---

### Updated Prioritisation (with new ideas)

| Item | Impact | Effort | Priority |
|---|---|---|---|
| Readiness Score v1 (A, from Pillar 4) | Very High | Low | ★★★★★ |
| Correlation Engine v1 (C1, from Pillar 1) | Very High | Medium | ★★★★★ |
| Water Intake Tracker (B1) | High | Very Low | ★★★★☆ |
| RPE per session (A4) | High | Very Low | ★★★★☆ |
| AI Workout Debrief (C2) | High | Low | ★★★★☆ |
| "What Should I Do Today?" (C3) | High | Low | ★★★★☆ |
| Natural Language Goal Updates (C4) | Medium | Very Low | ★★★★☆ |
| ACWR Training Load Monitor (A3) | High | Very Low | ★★★★☆ |
| Challenge Templates Library (E2) | Medium | Low | ★★★☆☆ |
| Weekly Personal Wins Email (D3) | Medium | Low | ★★★☆☆ |
| Supplement Tracker (B2) | Medium | Medium | ★★★☆☆ |
| Injury / Soreness Body Map (A2) | Medium | Medium | ★★★☆☆ |
| Group Challenges (E1, from Pillar 5) | High | Medium | ★★★☆☆ |
| WHOOP Integration (F2) | High | Medium | ★★★☆☆ |
| Garmin Integration (F1) | High | Medium | ★★★☆☆ |
| Fasting Window Tracker (B3) | Medium | Low | ★★★☆☆ |
| Monthly Report PDF (D1) | Medium | Medium | ★★☆☆☆ |
| Data Export (D2) | Low | Low | ★★☆☆☆ |
| Apple Health / Google Fit (F3) | Very High | Very High | ★★☆☆☆ |

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
