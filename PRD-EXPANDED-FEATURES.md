# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-12  
**Status:** Living document — updated with implementation status and new feature ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

> Last verified: 2026-06-12

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, 30-day window |
| Push notifications | ✅ Server-side, custom reminders |
| Strava sync | ✅ Manual sync |
| Goal Wizard | ✅ Built with settings entry point |
| Progress photos | ✅ Upload + compare |
| Body metrics | ⚠️ Measurements but no photo upload |
| Nutrition planning | ✅ Meal planner, pantry, saved meals |
| Wearable integrations | ✅ Withings + Oura OAuth + sync |
| Accountability partners | ⚠️ Backend + DB exists, no UI |
| AI weekly insights | ⚠️ Exists but AI-narrative only — no real correlation analysis |
| Social / sharing | 🔴 Stub only |
| Recovery / readiness score | 🔴 Not started |
| Correlation engine | 🔴 Not started (distinct from weekly AI insights) |
| Progressive overload alerts | 🔴 Not started |

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

## Horizon 2 — New Feature Ideas

> Brainstormed 2026-06-12. None of these are commitments — they're ideas to evaluate. Each is described with enough detail to decide whether it's worth scoping properly.

---

### Idea 1 — Injury & Soreness Tracker

**The Gap**  
The app captures energy and stress but has no concept of *where it hurts*. Users with a sore left shoulder, tight hamstrings, or a tweaked lower back currently have no way to log this, which means the AI coach and readiness score can't account for it.

**What It Would Do**  
- An interactive front/back body silhouette where users tap muscle groups to log soreness (1–5 scale) or flag an injury
- Soreness auto-decays over time (no log = assumed healing); injury persists until user clears it
- Readiness Score incorporates soreness: sore glutes on a deadlift day drops score for lower-body intensity
- Coach and Progressive Overload engine avoid recommending exercises that stress flagged areas
- Soreness history plotted over time — "your lower back is consistently sore after heavy deadlift days" feeds the correlation engine

**Why Now**  
Injury prevention is one of the top reasons people quit training. This is a safety feature as much as a UX feature, and it completes the readiness score story. The body-map UI is a well-understood pattern; the main work is wiring soreness into readiness score weighting and the workout recommendation logic.

**New Data**  
```sql
CREATE TABLE soreness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  muscle_group text NOT NULL,   -- 'lower_back', 'left_hamstring', etc.
  severity int NOT NULL,        -- 1 (mild) to 5 (injury)
  is_injury boolean DEFAULT false,
  notes text,
  resolved_at date
);
```

**Effort Estimate**: Medium (3–5 days). The body map UI is the most time-consuming part; the logic integrations are small once that exists.

---

### Idea 2 — Training Load Model (Fitness / Fatigue / Form)

**The Gap**  
Serious athletes — especially runners, cyclists, and crossfitters — track their training loads using the CTL/ATL/TSB model: Chronic Training Load (fitness), Acute Training Load (fatigue), and Training Stress Balance (form = CTL − ATL). This is the science behind "peaking" for an event. No consumer app surfaces it cleanly.

**What It Would Do**  
- After each workout, prompt for or auto-calculate RPE (Rate of Perceived Exertion, 1–10) × duration in minutes = Training Stress Score (TSS) for the session
- Plot three rolling averages on a single chart:
  - **Fitness (CTL)**: 42-day exponentially weighted moving average of daily TSS
  - **Fatigue (ATL)**: 7-day EWMA
  - **Form (TSB)**: CTL − ATL — positive = rested, negative = fatigued, very negative = over-trained
- Interpret the chart: *"You're currently at Form +8. You're rested and ready to race. Don't add volume this week — save it."*
- Integrate with the readiness score: low TSB → lower readiness, regardless of last night's sleep

**Why Now**  
This feature has zero UI complexity — it's a line chart with three series. The hard part is data collection (RPE on each workout). But the app already has workout logging; adding RPE is a 30-minute change. Once RPE is collected, the chart is straightforward maths. This would be a significant differentiator for the endurance athlete segment.

**Effort Estimate**: Medium (3–4 days: RPE field + TSS calc + chart).

---

### Idea 3 — Hydration Tracker

**The Gap**  
Hydration is directly correlated with energy, cognitive performance, and recovery — all things the app already tracks. But there's no way to log water intake.

**What It Would Do**  
- A simple water intake widget on the daily log: large +250ml / +500ml buttons, custom entry
- Daily target (default 2.5L, adjustable, optionally auto-calculated from bodyweight + activity)
- Hydration ring on the dashboard alongside protein/calorie rings
- Evening reminder if user hasn't hit 80% of target
- Correlation engine variable: `water_intake_ml` ↔ `energy_level`, `sleep_quality`
- On high-exercise days, automatically increase the daily target by a configurable amount

**Why Now**  
This is a one-day feature that rounds out the daily log. It's the most-requested "missing" feature type in fitness apps generally, and the correlation engine makes it more meaningful than a simple counter — users will actually *see* the impact on their energy scores.

**Effort Estimate**: Low (1–2 days including UI and reminder logic).

---

### Idea 4 — Intermittent Fasting / Eating Window Tracker

**The Gap**  
A significant portion of the fitness-conscious audience practices some form of intermittent fasting (IF). The current nutrition log has no concept of eating windows — a 7am breakfast and a 12pm breakfast look identical.

**What It Would Do**  
- IF timer: user taps "Start Fast" / "Break Fast" — the app tracks fasting and eating windows
- Popular presets: 16:8, 18:6, 20:4, OMAD — one tap to set the protocol
- Eating window shown as a timeline bar on the nutrition log page
- Daily log shows current fast duration and time until eating window opens/closes
- Calorie/macro targets are scoped to the eating window (dinner-heavy vs. breakfast-heavy patterns handled correctly)
- Correlation: fasting duration ↔ energy level, weight trend, sleep quality

**Why Now**  
The meal planner and nutrition log are already built; this extends them with a time dimension. The IF timer itself is a simple clock — the interesting work is adjusting how macro progress is displayed within a window. Given the user base of a fitness tracker almost certainly overlaps heavily with IF practitioners, this closes a notable gap.

**Effort Estimate**: Medium (2–3 days: timer state, window display, correlation variable).

---

### Idea 5 — Goal Event / Peak Mode

**The Gap**  
Right now, goals are abstract ("lose 5kg", "bench 100kg"). Most people who train hard are doing it *for something*: a marathon, a powerlifting meet, a wedding, a holiday. A dated goal event changes the psychology entirely — it creates urgency, a countdown, and a natural endpoint.

**What It Would Do**  
- User sets an event: type (race, competition, photo shoot, holiday, other), date, and a brief description
- A countdown badge appears on the dashboard: *"14 weeks to your marathon"*
- App enters **Peak Mode**: training volume and intensity recommendations follow a periodisation arc toward the event
  - Phase 1 (build): progressively increase volume toward event − 3 weeks
  - Phase 2 (taper): reduce volume 40–50% for the final 2–3 weeks while maintaining intensity
  - Phase 3 (peak week): light activation sessions, sleep and nutrition prioritised
- Nutrition adjusts for event type: a marathon needs carb loading; a bodybuilding show needs a calorie deficit peak
- Post-event: prompt for a reflection and celebration, then suggest a new event

**Why Now**  
This is a narrative feature more than a data feature — it gives the app a story arc. Users with a concrete event log more consistently because they have a "why." It also makes the existing periodisation (Pillar 3) much more meaningful, as all the programming has a target date to work toward.

**Effort Estimate**: Medium-High (4–6 days: event model, countdown UI, phase-aware recommendations).

---

### Idea 6 — Supplement Stack Tracker

**The Gap**  
Many fitness-focused users take supplements — creatine, protein powder, vitamin D, magnesium, omega-3, pre-workout, etc. These are logged nowhere, yet they have measurable effects on energy, recovery, and performance that the correlation engine could detect.

**What It Would Do**  
- A supplement library: user adds their stack with dose, timing (morning/pre-workout/evening), and days (daily/training days only)
- Each day, a supplement checklist — one tap to confirm you took them
- Compliance tracking: did you take your supplements consistently this week?
- Correlation engine: supplement adherence ↔ energy, sleep, performance metrics
- Cost tracking: monthly spend on supplements with "cost per logged use" stat
- Reminders: push notification at configured supplement times if not yet confirmed

**Why Now**  
The existing daily log is food + activity + wellness — supplements fall in none of these categories but are part of most serious fitness users' routines. The correlation angle is genuinely interesting: if a user starts creatine, the app should surface "your strength metrics improved 8% in the 4 weeks since you started creatine." This is a feature no other tracking app does well.

**Effort Estimate**: Medium (3–4 days: supplement model, checklist UI, correlation variable, reminders).

---

### Idea 7 — AI Form Check (Camera)

**The Gap**  
Every gym in the world has people squatting with rounded backs and benching with flared elbows. Form coaching is the highest-value service a personal trainer provides. It's also entirely absent from every fitness app.

**What It Would Do**  
- User props up their phone, selects an exercise, and records a set
- Video is sent to a vision-capable model (Claude's vision or a dedicated pose estimation model)
- AI provides written form feedback: *"Your knees are caving inward on the descent. Focus on driving them out over your little toes. Your depth is good."*
- Key checkpoints displayed per exercise (e.g., for squat: depth, knee tracking, back angle, bar path)
- Form score per set (1–5) stored against the workout set — plotted over time to show improvement
- **Privacy first**: video is processed server-side and immediately deleted; only the text feedback is stored

**Considerations**  
This feature has the highest wow factor but the highest complexity. Real-time pose estimation requires either a native app (for on-device ML) or server-side video processing (higher latency, bandwidth, cost). A pragmatic v1 would skip real-time and do post-set upload + async feedback within 10–30 seconds.

**Effort Estimate**: High (7–10 days for a basic v1). Requires evaluating model capability and infrastructure cost before committing.

---

### Idea 8 — Personalised Warm-up & Cool-down Generator

**The Gap**  
Most people skip warm-ups because they don't know what to do. A generic 5-minute treadmill walk is poor preparation for a heavy squat session. Targeted warm-ups — hip flexor activation before squats, rotator cuff work before pressing — reduce injury risk and improve performance.

**What It Would Do**  
- When user starts a workout (or views the workout plan the day before), the app generates a 5–10 minute warm-up specific to the planned exercises
  - E.g., chest day → band pull-aparts, face pulls, light flyes, chest stretch
  - E.g., leg day → hip circles, leg swings, goblet squats, couch stretch
- Warm-up shown as an ordered list of movements with reps/duration and a brief technique note
- User can swipe through exercises with a timer, then tap "Done — Start Workout"
- Same logic generates a cool-down: static stretches targeting muscles worked
- Soreness tracker (Idea 1) informs warm-up — extra attention to areas showing soreness

**Why Now**  
This is largely an AI prompt engineering feature. The exercise library is already built; generating targeted warm-ups from a list of planned exercises is a well-scoped Claude prompt. The UI is a simple ordered list with a timer. The impact on injury prevention and user experience is disproportionate to the implementation effort.

**Effort Estimate**: Low-Medium (2–3 days: warm-up generation prompt, exercise display UI, timer).

---

### Idea 9 — Menstrual Cycle Phase Training & Nutrition

**The Gap**  
The app already has cycle tracking, but it only logs cycle data — it doesn't do anything with it. Research shows that hormonal phases strongly influence optimal training intensity, recovery needs, and nutritional strategies. This is an underserved area in mainstream fitness apps.

**What It Would Do**  
- Extend the cycle tracker to identify the current phase (menstrual, follicular, ovulatory, luteal) based on logged cycle data
- Phase-specific recommendations shown on the dashboard:
  - **Menstrual (days 1–5)**: lower intensity suggested, iron-rich foods highlighted, rest normalised
  - **Follicular (days 6–14)**: higher intensity and PRs appropriate (estrogen peak), higher carb tolerance
  - **Ovulatory (around day 14)**: peak strength and power output window
  - **Luteal (days 15–28)**: higher calorie needs, more recovery time, PMS symptom tracking
- Readiness score incorporates cycle phase as a modulating factor
- Correlation engine: cycle phase ↔ energy, performance, sleep quality, mood

**Why Now**  
The infrastructure is already there (cycle tracking is built). This is primarily a recommendation layer on top of existing data — adding phase detection logic and surfacing phase-aware nudges. It addresses an audience that is systematically underserved by generic fitness apps that treat all users as male-default.

**Effort Estimate**: Medium (3–4 days: phase detection logic, phase-aware recommendations, readiness integration).

---

### Idea 10 — Year in Review / Data Export & Shareable Highlights

**The Gap**  
Users accumulate months of data with no way to appreciate the full arc of their progress or share it outside the app. Spotify Wrapped created a cultural moment; fitness apps haven't done the same.

**What It Would Do**  
**On-Demand "My Year" (or any date range)**  
A generated summary page with:
- Total workouts, total sets lifted, total distance run
- Biggest personal records set
- Longest streak achieved
- Best month for consistency
- Weight change trend (if tracked)
- Most-logged foods, most-trained muscle groups
- AI-generated "story of your year": *"You started 2026 unable to squat your bodyweight. You ended it with a 120kg 1RM. That's a 40% improvement in 9 months."*
- Visually shareable as an image card (like Spotify Wrapped) — tap to share to Instagram/WhatsApp

**Data Export**  
- Export all data as CSV (for users who want to analyse in Excel/Sheets)
- Export a PDF "Health Report" — a formatted summary of the last 90 days, structured like what you'd bring to a doctor or nutritionist
- GDPR-compliant: full data dump available from Settings

**Why Now**  
This is a retention and acquisition feature. Users who see their year in review feel pride and attachment to the app. Shareable cards create organic word-of-mouth. The data export signals trust — users who know they can export their data are more willing to put data in. The Year in Review is also a natural annual hook that brings churned users back.

**Effort Estimate**: Medium (3–5 days: stats aggregation query, narrative prompt, card design, export generation).

---

## Updated Prioritisation Matrix

Including outstanding original pillars + new Horizon 2 ideas, ordered by recommended sequencing.

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| **Accountability UI** (backend exists) | High | Very Low | ★★★★★ Ship now |
| **Readiness Score** | Very High | Low | ★★★★★ Sprint 1 |
| **Correlation Engine** (real stats, not AI narrative) | Very High | Medium | ★★★★☆ Sprint 1 |
| **Progressive Overload Alerts** | High | Low | ★★★★☆ Sprint 1 |
| **Hydration Tracker** (Idea 3) | Medium | Very Low | ★★★★☆ Sprint 1 — quick win |
| **Injury & Soreness Tracker** (Idea 1) | High | Medium | ★★★★☆ Sprint 2 |
| **Warm-up Generator** (Idea 8) | Medium | Low | ★★★☆☆ Sprint 2 |
| **Supplement Tracker** (Idea 6) | Medium | Medium | ★★★☆☆ Sprint 2 |
| **Intermittent Fasting Timer** (Idea 4) | Medium | Medium | ★★★☆☆ Sprint 2 |
| **Training Load Model** (Idea 2) | High (athletes) | Medium | ★★★☆☆ Sprint 3 |
| **Goal Event / Peak Mode** (Idea 5) | High | Medium-High | ★★★☆☆ Sprint 3 |
| **Cycle Phase Training** (Idea 9) | High (subset) | Medium | ★★★☆☆ Sprint 3 |
| **Year in Review / Export** (Idea 10) | Medium | Medium | ★★★☆☆ Sprint 3 |
| **AI Form Check** (Idea 7) | Very High | Very High | ★★☆☆☆ Sprint 4+ |
| **Apple Health / Google Fit** | Very High | Very High | ★★☆☆☆ Sprint 4+ |
| **12-Week Training Programs** | High | High | ★★☆☆☆ Sprint 4 |
| **Group Challenges** | Medium | Medium | ★★☆☆☆ Sprint 4 |

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
