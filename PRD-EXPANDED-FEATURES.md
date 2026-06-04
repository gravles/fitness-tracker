# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-04  
**Status:** Living document — updated with build status and Phase 2 ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

*Updated 2026-06-04 after codebase audit.*

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, 30-day window |
| Push notifications | ✅ Server-side, custom reminders |
| Strava sync | ✅ Manual sync |
| Goal Wizard | ✅ Wired in Settings page |
| Progress photos | ✅ Upload + compare |
| Body metrics | ⚠️ Measurements but no photo upload |
| Accountability Partners | ✅ Invite, summary email, partner view |
| Nutrition planning / Meal Planner | ✅ Weekly grid, AI generation, `/nutrition` page |
| Saved Meals | ✅ Save + one-tap log |
| Wearable integrations | ⚠️ Withings + Oura OAuth built, Strava manual sync |
| Training Programs | ⚠️ Full backend + CRUD, no UI page yet |
| Recovery / Readiness Score | 🔴 Not started |
| Progressive Overload Alerts | 🔴 Not started |
| Sleep Records (detailed staging) | 🔴 Not started (only sleep_quality field in daily_logs) |
| Group Challenges | 🔴 Not started |
| Apple Health / Google Fit | 🔴 Not started (requires native shell) |

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

| Pillar | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Wins | Medium | Very High | ★★★★★ | ✅ Mostly shipped |
| Readiness Score | Very High | High | ★★★★☆ | 🔴 Not started — highest priority outstanding |
| Correlation Engine | Very High | High | ★★★★☆ | ⚠️ Basic AI weekly insights exist; full nightly cron + cache not built |
| Nutrition Planning (Saved Meals) | High | High | ★★★☆☆ | ✅ Shipped |
| Periodisation (Overload Alerts) | High | High | ★★★☆☆ | 🔴 Not started — high priority outstanding |
| Training Programs UI | High | High | ★★★☆☆ | ⚠️ Backend done, UI page missing |
| Accountability Partners | Very High | Medium | ★★★☆☆ | ✅ Shipped |
| Withings Integration | High | Medium | ★★★☆☆ | ⚠️ OAuth built, needs testing/polish |
| Oura Integration | High | Medium | ★★★☆☆ | ⚠️ OAuth built, needs testing/polish |
| Nutrition Planning (Full Meal Planner) | High | Low | ★★☆☆☆ | ✅ Shipped |
| Group Challenges | Medium | Medium | ★★☆☆☆ | 🔴 Not started |
| 12-Week Programs | High | Low | ★★☆☆☆ | ⚠️ Backend done, no UI |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | 🔴 Future (requires native app) |

---

## What's Still Outstanding (Priority Order)

Based on the June 2026 audit, the most important missing pieces are:

1. **Readiness Score** — The flagship daily intelligence feature. Zero implementation. Uses existing data (sleep, stress, energy, alcohol from `daily_logs`). High impact, no new data required. Should ship first.
2. **Progressive Overload Alerts** — The core strength-training value prop. Backend workout data exists but nothing surfaces "what to lift next." Show last session + suggestion at the top of each exercise when starting a workout.
3. **Training Programs UI** — Backend is fully built with CRUD. Just needs a `/programs` page to browse, activate, and view the week-by-week plan. Days of work, not weeks.
4. **Correlation Engine upgrade** — Weekly AI insights exist, but not the nightly Pearson correlation cron + `insights_cache` table described in Pillar 1. The current AI call on page load is slow and expensive; moving to cached, pre-computed insights is the right architecture.
5. **Sleep Records table** — Oura OAuth exists but has nowhere to write detailed sleep staging data. The `sleep_records` table from Pillar 6 needs creating before Oura sync is truly useful.
6. **Group Challenges** — Accountability Partners shipped, but the Group Challenge layer (time-limited shared goals) didn't. This is the social feature most likely to drive organic growth.

---

---

## Phase 2 — New Feature Ideas (Brainstorm, June 2026)

The existing pillars cover intelligence, planning, training, recovery, and social. The ideas below address **friction reduction**, **engagement depth**, and **new user segments** that aren't yet covered.

---

### Idea A — Food Photo Logging (AI Vision)

**The problem:** Text entry and barcode scanning are faster than weighing food, but the fastest path from meal to log is a photo. A surprising number of users still don't log food because the entry friction is too high.

**What it does:** User taps a camera icon in the food log. They take a photo of their plate (or a screenshot of a restaurant menu, or a photo of food packaging). Claude vision analyses the image and returns a list of identified foods with estimated portions and macros, pre-filled in the log entry form. User reviews, adjusts quantities, and confirms.

**Why it's different:** Every major food app (MyFitnessPal, Cronometer) uses barcode scanning. Photo logging is the next generation and aligns with Claude's vision capability — something we actually have.

**Technical approach:**
- Image upload to Supabase Storage (temp bucket, auto-deleted after parsing)
- Claude `claude-haiku-4-5` with vision: pass image + system prompt requesting structured JSON food list
- User sees editable results, not raw AI output — accuracy can be imperfect because the user corrects it

**Effort estimate:** 3–4 days  
**Impact:** Very High (removes the biggest barrier to food logging compliance)

---

### Idea B — Barcode Scanner for Food Logging

**The problem:** For packaged foods, manual search is slow and nutritional data is often imprecise. Scanning the barcode gets exact manufacturer data in under 2 seconds.

**What it does:** A scan icon in the food search bar opens the device camera, reads the barcode, queries the Open Food Facts API (free, 3M+ products, no API key needed), and pre-fills the food entry with name, serving size, and macros.

**Why it's different:** This is the #1 feature request in every food tracking app. It's table stakes for serious nutrition users and practically free to implement.

**Technical approach:**
- `@zxing/library` (MIT) for browser-based barcode scanning via `getUserMedia`
- Open Food Facts REST API: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Falls back to existing AI text search if product not found

**Effort estimate:** 1–2 days  
**Impact:** High  
**Note:** This is a Quick Win that should have been in the original appendix.

---

### Idea C — Hydration Tracker

**The problem:** Water intake is one of the variables most tightly correlated with energy level, workout performance, and even hunger (people often mistake thirst for hunger). The app tracks almost everything except this.

**What it does:**
- A simple daily water counter on the log page — tap to add 250ml (1 glass), or enter a custom amount
- Daily target (default 2.5L, adjustable in settings, auto-increases on workout days)
- A small hydration ring in the daily macro summary bar alongside protein/calories
- The correlation engine gets a new variable: `water_ml` ↔ `energy_level`, `workout_performance`
- Push reminder at 2pm if user is behind on hydration target

**Data model:** Add `water_ml int DEFAULT 0` to `daily_logs` — no new table.

**Effort estimate:** 1 day  
**Impact:** Medium-High  

---

### Idea D — Intermittent Fasting / Eating Window Tracker

**The problem:** A significant portion of fitness users follow some form of intermittent fasting (16:8 is the most common). Currently the app has no awareness of when a user last ate, making calorie and macro recommendations context-free.

**What it does:**
- A fasting timer (start fast / end fast) accessible from the log page or via a widget on the dashboard
- Preset windows: 16:8, 18:6, 20:4, 5:2, custom
- Visual countdown showing time remaining in fast / time until eating window opens
- Push notification when eating window opens and when fast should begin (based on previous day's end time)
- AI coaching aware of current fasting state: "You're 14 hours into your fast — you've got 2 hours to go. Good work."
- Correlation with energy and mood logged during fasting windows

**Data model:**
```sql
CREATE TABLE fasting_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  target_duration_hours int,
  protocol text,  -- '16:8', '18:6', 'custom'
  notes text
);
```

**Effort estimate:** 2–3 days  
**Impact:** Medium-High (high for a specific, vocal user segment)

---

### Idea E — Injury & Soreness Tracker

**The problem:** The app tells users to train hard when readiness is high, but has no awareness of *localised* pain or injury. Someone with a sore left shoulder shouldn't be told to do overhead press regardless of their overall readiness score.

**What it does:**
- A simple body map (front/back silhouette) where users tap to mark soreness or pain areas
- Severity scale (1–5: light soreness → acute pain)
- Logged per day alongside the wellness check-in
- AI coaching cross-references: if "left shoulder" is marked 4/5, workout suggestions avoid overhead movements
- Readiness Score gets a new signal: any pain >3/5 caps score at 50 regardless of other factors
- Long-term trend: flag recurring pain in the same area as a potential injury pattern

**Data model:**
```sql
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS soreness_areas jsonb;
-- e.g. [{"area": "left_shoulder", "severity": 4}, {"area": "lower_back", "severity": 2}]
```

**Effort estimate:** 2–3 days (body map SVG is the main UI work)  
**Impact:** High (safety + personalization — prevents the app recommending things it shouldn't)

---

### Idea F — Adaptive Goal Adjustment

**The problem:** Goals set in the Goal Wizard are static. A protein target set 6 weeks ago may be too easy (user has been nailing it) or too hard (user hasn't hit it once). Neither scenario is motivating. The app should notice and say something.

**What it does:**
- A nightly check (runs alongside insights generation) that evaluates goal attainment rate over the last 2 and 4 weeks
- If attainment >90% for 2+ weeks: push a suggestion to increase the target (or set a new stretch goal)
- If attainment <30% for 2+ weeks: push a suggestion to reduce the target to something achievable, with encouragement
- Presented as a non-intrusive banner on the dashboard ("Your protein goal looks easy lately — want to challenge yourself?") with quick Yes/Not yet buttons
- User approves or dismisses — AI doesn't change goals automatically

**Why this matters:** Goal psychology research is clear — goals that are too easy cause disengagement; goals that are too hard cause abandonment. The sweet spot is 60–80% attainment. This feature keeps users in that zone automatically.

**Effort estimate:** 1–2 days (logic + notification, reuses existing goal/notification infrastructure)  
**Impact:** High (directly affects long-term retention)

---

### Idea G — Smart Workout Nutrition Timing

**The problem:** The app knows when the user has scheduled a workout. It does not use this to prompt optimal pre- and post-workout nutrition, which is a well-documented performance and recovery factor.

**What it does:**
- **Pre-workout:** 90 minutes before a scheduled workout, push notification: "Your session starts in 90 mins — ideal time for your pre-workout meal. [Quick log]" — tapping opens a simplified log with the user's saved pre-workout meal pre-filled
- **Post-workout:** 30 minutes after a workout is marked complete, push notification: "Great session — log your recovery meal to hit your protein window" — same flow
- AI Coach gets explicit pre/post workout context in its system prompt when timing is relevant
- A "Workout Nutrition" card in the `/nutrition` page showing today's timing windows based on the schedule

**Effort estimate:** 1–2 days (primarily notification logic + schedule awareness)  
**Impact:** Medium-High (highly practical, directly improves nutrition adherence on training days)

---

### Idea H — Race / Event Goal Mode

**The problem:** Many users train for a specific external event: a marathon, a powerlifting meet, a holiday, a wedding. These users have a concrete endpoint and need training that peaks at a specific date — not an open-ended progressive program. The existing 12-week program model doesn't quite fit this.

**What it does:**
- User adds an "Event" to their profile: name, date, type (endurance, strength, aesthetics, general fitness)
- A countdown widget appears on the dashboard: "Marathon — 67 days"
- AI generates a periodised plan that works backwards from the event date: build → peak → taper
- Training volume and intensity auto-adjust each week based on weeks remaining
- The closer to the event, the more conservative the plan becomes (injury prevention)
- On event day: a special "Race Day" dashboard state with a journal prompt for post-event reflection

**Data model:**
```sql
CREATE TABLE goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_type text NOT NULL,   -- 'race', 'competition', 'aesthetic', 'custom'
  event_date date NOT NULL,
  notes text,
  completed boolean DEFAULT false,
  result_notes text,          -- post-event reflection
  created_at timestamptz DEFAULT now()
);
```

**Effort estimate:** 3–4 days  
**Impact:** High (very motivating for users with external deadlines — these tend to be the most engaged users)

---

### Idea I — Data Export & Year in Review

**The problem:** Users accumulate months of health data in the app with no way to take it with them or share it. This creates lock-in anxiety. More importantly, a "Year in Review" type visual summary is one of the most naturally viral features in any app (Spotify Wrapped, Strava Year in Review).

**What it does:**

**Full Data Export:**
- Settings → "Export my data" → generates a ZIP containing:
  - `daily_logs.csv` — every log entry
  - `workouts.json` — full workout history with sets and reps
  - `body_metrics.csv` — weight and measurement history
  - `progress_photos/` — folder with all uploaded photos
- Generated as a Supabase Edge Function, stored temporarily, download link emailed

**Year in Review (shareable):**
- Generates a scrollable single-page visual summary for the calendar year (or any 12-month period):
  - Total workouts, total active days, longest streak
  - Best lifts (top 5 personal records)
  - Most consistent habit ("You hit your protein goal 68% of days")
  - Total volume lifted (kg)
  - A grid of all logged days (GitHub-style contribution chart)
  - Before/after from first and most recent progress photo (user's choice to include)
- Shareable as a link (public, no login required) or downloadable as an image

**Effort estimate:** 3–5 days  
**Impact:** Medium-High for retention; High for organic acquisition (shareable)

---

### Idea J — Cycle-Synced Training Recommendations

**The problem:** The app already has cycle tracking (enabled per user), but it does nothing with the data. There's substantial research showing that training capacity and recovery vary meaningfully across menstrual cycle phases, and optimising for this is something no mainstream fitness app does well.

**What it does:**
- If cycle tracking is enabled, the current phase is surfaced in the readiness score calculation:
  - **Follicular (days 6–13):** Higher energy, strength peaks, better recovery — recommend higher intensity
  - **Ovulatory (days 14–16):** Peak performance window — ideal for PRs and max effort
  - **Luteal (days 17–27):** Fatigue increases, strength slightly lower — moderate intensity, more rest
  - **Menstrual (days 1–5):** Recovery phase — light movement, yoga, walks
- A small phase indicator on the dashboard (visible only to users with cycle tracking on)
- AI coaching references the phase contextually: "You're in your luteal phase — this week is a good time to focus on technique work rather than maxing out"
- The correlation engine gains a new variable: `cycle_phase` ↔ `energy_level`, `workout_performance`

**Note:** This is explicitly opt-in, private, and non-intrusive. It only changes recommendations — never overrides user intent.

**Effort estimate:** 1–2 days (cycle phase calculation is a known algorithm from the existing tracking data)  
**Impact:** High for the target segment — this is genuinely differentiated and research-backed

---

## Phase 2 Quick Wins

These should be added to the Quick Wins Appendix and could ship in 1–2 days each.

| Feature | Description | Effort |
|---|---|---|
| Barcode scanner | Open Food Facts API, `@zxing/library` — fastest food entry path | 1–2 days |
| Hydration counter | Add `water_ml` to `daily_logs`, tap-to-increment UI, reminder push | 1 day |
| Training Programs page | `/programs` page — browse, activate, and view week-by-week from existing backend | 1–2 days |
| Workout completion share card | After a workout, generate a shareable card: "I just lifted 4,200kg in 45 mins" — image download | 1 day |
| Rest timer between sets | Simple countdown timer in active workout — one of the most requested gym features | 1 day |
| Adaptive goal nudge | Nightly check: >90% attainment → "bump your goal?" / <30% → "lower it?" | 1 day |
| Smart pre/post workout notification | 90min before → pre-workout prompt; 30min after → log recovery meal | 1 day |

---

## Updated Recommended Next Sprint

Given the June 2026 build status, the clearest next priorities are the two features that were planned for Sprint 1–2 but never shipped:

1. **Readiness Score v1** (2–3 days) — Highest-impact missing feature. Uses `daily_logs` data already captured. Needs the score algorithm, a dashboard card, and the `readiness_scores` table.
2. **Progressive Overload Alerts** (1–2 days) — Show last session + suggestion per exercise when starting a workout. The data is all there.
3. **Training Programs UI** (1–2 days) — Backend is done. Wire up a `/programs` page.
4. **Barcode Scanner** (1–2 days) — Quick Win that significantly reduces food logging friction.

Total estimated effort: 5–9 days. All four use existing data or existing backends — no major new infrastructure needed.

---

*Document last updated 2026-06-04. New ideas in Phase 2 section are proposals only — none are under active development.*
