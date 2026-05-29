# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (updated 2026-05-29)  
**Status:** Living document — updated with implementation status and second-generation ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

*Updated 2026-05-29 to reflect actual build state.*

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry, barcode + photo + menu scan |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions, muscle heatmap |
| AI coaching chat | ✅ Context-aware, history synced to Supabase |
| Push notifications | ✅ Server-side, custom reminders |
| Strava sync | ✅ OAuth + sync |
| Goal Wizard | ✅ Built with AI recommendations + Settings entry point |
| Progress photos | ✅ Upload + compare |
| Social / sharing | ✅ Shareable achievement links, Twitter share |
| Nutrition planning | ✅ Weekly meal planner, pantry, saved meals, AI generation |
| Saved meals | ✅ Named bundles, one-tap log, use-count tracking |
| Recovery / readiness | ✅ Oura readiness + sleep data synced to daily log |
| Withings integration | ✅ OAuth, body weight + full body composition sync |
| Oura integration | ✅ OAuth, readiness + sleep staging sync |
| Periodisation & progressive overload | ✅ 12-week AI programs, deload weeks, volume modifiers |
| Accountability partners | ✅ Weekly summary emails via Resend, partner invites |
| Apple Health / Google Fit | 🔴 Not started (requires native shell) |
| Correlation Engine | 🔴 Not started — only major remaining pillar |

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

# Second-Generation Feature Ideas

*Brainstormed 2026-05-29. These build on the now-solid foundation. None are implemented yet — listed for review and prioritisation.*

---

## Idea 1 — Injury Prevention Engine (Acute:Chronic Workload Ratio)

### The Problem

The app tracks training volume week by week, but it doesn't know when you're increasing load too fast. Sports science has a well-validated signal for injury risk: the **Acute:Chronic Workload Ratio (ACWR)**. When your training load in the past 7 days (acute) is more than 1.5× your average over the past 28 days (chronic), injury risk rises sharply. Right now the app can't tell a user that they're heading toward an overuse injury — it just lets them train into the ground.

### What It Does

**Weekly Load Score**
Calculate a "load unit" per session: `sets × reps × weight` summed across all exercises. Normalise by adding cardio from Strava (distance × 10 as a proxy load unit).

**ACWR Warning Banner**
When the ratio crosses 1.3, show a yellow callout at the top of the workout page:
- *"Your training load this week is 40% higher than your recent average. Consider a lighter session or an extra rest day."*

At 1.5+, the banner turns red with a more direct warning.

**Muscle Group Frequency Flags**
Separately, flag if any muscle group has been trained 3+ days in a row with no rest day in between (using the existing exercise → muscle group mapping already in the codebase).

**Recovery Recommendation**
Pair with the readiness score (already built): if ACWR > 1.3 AND readiness < 60, recommend a rest day proactively on the dashboard.

### Data Requirements

No new tables needed. Load scores are computed on-the-fly from `workout_exercises` + `workout_sets`. A `training_load_cache` could speed up the trend calculation.

```sql
CREATE TABLE training_load_cache (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  total_load numeric NOT NULL,         -- sum of sets×reps×weight for the week
  cardio_load numeric DEFAULT 0,       -- from Strava distance proxy
  acwr numeric,                        -- acute / chronic ratio
  PRIMARY KEY(user_id, week_start)
);
```

### Why This Matters

Injury is the number-one reason people fall off fitness programmes. A feature that proactively prevents injury is rare and extremely sticky — users will credit the app every time they dodge a setback. It also differentiates from every consumer app on the market.

---

---

## Idea 2 — Micronutrient Gap Analysis

### The Problem

The app tracks calories, protein, carbs, and fat excellently. But nutrition research is clear: micronutrient deficiencies — particularly vitamin D, iron, magnesium, omega-3s, and zinc — are rampant in active people and directly impact training performance, sleep quality, and recovery. No food logging app currently surfaces this in a meaningful way.

### What It Does

**Micronutrient Estimator**
For each logged food, estimate key micronutrients using a static lookup table mapped to common food items (augmented by AI when exact data isn't available). Prioritise the 8 most performance-relevant nutrients:
1. Vitamin D (fatigue, bone health, mood)
2. Iron (energy, endurance)
3. Magnesium (sleep quality, muscle function)
4. Omega-3 (inflammation, recovery)
5. Zinc (testosterone, immunity)
6. Calcium (bone density, muscle contraction)
7. B12 (energy metabolism)
8. Potassium (hydration, muscle cramping)

**Weekly Micronutrient Report**
A card in the Nutrition page showing a mini-bar chart of estimated intake vs. recommended daily intake for each tracked nutrient. Not a medical claim — clearly labelled "estimate."

**AI Dietary Suggestions**
When a user is consistently low in a nutrient (e.g. 3+ weeks below 50% RDI for vitamin D), the AI Coach proactively surfaces a recommendation: *"Your logged foods suggest you may not be getting enough vitamin D — fatty fish, eggs, and fortified milk are easy ways to boost it."*

**Correlation Hook**
Feed this into the Correlation Engine (Pillar 1): does low iron correlate with poor energy scores? Does low magnesium correlate with poor sleep quality? These are established relationships that would feel genuinely insightful.

### Data Requirements

A new `micronutrient_profiles` table to store estimates per food item (seeded from a public database like USDA FoodData Central or Open Food Facts):

```sql
CREATE TABLE micronutrient_profiles (
  food_name_hash text PRIMARY KEY,  -- normalized hash of food name
  food_name text NOT NULL,
  vitamin_d_mcg numeric,
  iron_mg numeric,
  magnesium_mg numeric,
  omega3_mg numeric,
  zinc_mg numeric,
  calcium_mg numeric,
  b12_mcg numeric,
  potassium_mg numeric,
  source text DEFAULT 'estimated',  -- 'usda', 'openfoodfacts', 'estimated'
  created_at timestamptz DEFAULT now()
);
```

A weekly aggregate view to avoid per-day recalculation.

### Why This Matters

This is a rare intersection of "data nobody else shows" and "actually medically relevant." It creates a new reason for nutritionally conscious users to keep logging every day — not just for macros but to watch their micronutrient profile. It also creates a natural upsell narrative (detailed reports, personalised supplement suggestions).

---

---

## Idea 3 — Fitness Age Score

### The Problem

Abstract metrics like VO2 max, HRV, and training consistency are hard for users to relate to. A single, compelling number — *"your body is performing like a 28-year-old"* — is concrete, emotionally motivating, and highly shareable. It gives users a clear answer to "is all this effort actually working?"

### What It Does

**Fitness Age Calculation**
Compute a Fitness Age score (years younger or older than chronological age) from available signals:

| Signal | Source | Impact |
|---|---|---|
| Resting heart rate | Oura sync (if connected) | High |
| HRV trend | Oura sync (if connected) | High |
| Cardio consistency (workouts/week avg over 90 days) | Workout logs | High |
| VO2 max proxy (pace × effort from Strava runs) | Strava | Medium |
| Sleep quality 90-day average | Daily log | Medium |
| BMI / body fat trend | Withings or weight log | Medium |
| Strength trend (estimated 1RM trajectory) | Workout sets | Medium |

Algorithm based on published fitness age research (e.g. Nes et al., NTNU), adapted to available data points. When data is sparse, widen the confidence interval and show a range rather than a single number.

**Dashboard Widget**
A small card on the dashboard: *"Fitness Age: 27 ↓ 3 years younger than last month."* Tapping it opens a breakdown of what's helping and what's holding the score back.

**Progress Tracking**
Plot Fitness Age over time (monthly). The trend line is the motivating element — users want to see it drop.

**Shareable Result**
One-tap share card: *"My fitness age is 27 — 4 years younger than I am. Tracking with [app name]."*

### Why This Matters

This is the answer to the user's most fundamental question: *"Is what I'm doing actually working?"* It packages complex data into one emotionally resonant number. It's also the app's best marketing hook — shareable, memorable, and impossible to fake without actually putting in the work.

---

---

## Idea 4 — AI Meal Photo Logging

### The Problem

The biggest friction in food logging is describing and searching for individual ingredients. A home-cooked meal might have 8 components; restaurant meals are often mystery combinations. The app already has a menu scanner and food camera — but those require text input or structured menu text. Taking a photo of your actual plate and having AI estimate the macros would remove the last major logging friction point.

### What It Does

**Plate Photo → Macro Estimate**
User taps "Log with Photo" in the food section, takes a picture of their meal. Claude's vision API:
1. Identifies each visible food item and estimates portion size (using plate/utensils/hands as size reference)
2. Returns a list of estimated items with quantities and macros
3. User confirms or adjusts each item before saving

**Confidence Indicators**
Each item is shown with a confidence level (High / Medium / Estimated). User can tap any item to adjust. The AI is instructed to *under-estimate* calorie-dense sauces and dressings (where users consistently under-report) and flag this explicitly.

**Learning from Corrections**
When the user adjusts an AI estimate (e.g. changes "pasta, 200g" to "pasta, 350g"), that correction is stored. Over time, the user's common portion sizes are learned and used as priors in future estimates.

### Technical Approach

Uses Claude's multimodal API (already integrated in the codebase). The key prompt engineering challenge is portion estimation from a 2D image — leverage plate size and known object sizes (fork = ~18cm, fist = ~1 cup) as reference points.

```
System: You are a sports nutritionist estimating macros from a meal photo. 
Identify each food, estimate portion by comparing to visible reference objects 
(plate diameter ~25cm, fork ~18cm). For mixed dishes (curry, stew), estimate 
as the most likely combination of standard ingredients.

Return JSON: [{name, quantity_g, calories, protein_g, carbs_g, fat_g, confidence: 'high'|'medium'|'low'}]

If you see sauce or dressing, flag it and bias toward over-estimating it — 
people always under-log dressings.
```

### Why This Matters

Every reduction in logging friction improves data quality and retention. This is the feature that makes food logging feel effortless for non-obsessive users — the people who would benefit most from better nutrition data but find manual logging too tedious. It's also a natural showcase for the app's AI capabilities.

---

---

## Idea 5 — Supplement Tracker

### The Problem

Supplement use is near-universal among active people (protein powder, creatine, pre-workout, vitamins), but no fitness app tracks it seriously. Supplements affect performance, recovery, and body composition in measurable ways — but users have no way to correlate their creatine loading phase with strength gains, or their magnesium supplementation with sleep quality improvements.

### What It Does

**Supplement Log**
A new section in the daily log (alongside food, movement, subjective). Users log supplements with a simple name + dose. A pre-populated list covers the most common (Creatine, Whey Protein, Vitamin D, Magnesium, Omega-3, Pre-Workout, Caffeine, Zinc, B12, Collagen, Melatonin, Ashwagandha).

**Supplement Reminders**
Push reminders for supplements that work best at specific times (e.g. "Take creatine after your workout" if a workout just ended, "Take magnesium before bed").

**Correlation with Correlation Engine**
When Pillar 1 (Correlation Engine) is built, supplements become another variable in the analysis:
- *"Your sleep quality is 0.6 points higher on nights you log magnesium."*
- *"Your estimated 1RM has increased 8% over your 4-week creatine loading phase."*

**Stack Builder**
AI suggests a personalised supplement stack based on the user's goals, diet gaps (from Idea 2 — Micronutrient Analysis), and training style. Always includes a caveat to consult a healthcare provider.

### New Data Model

```sql
CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  supplement_name text NOT NULL,
  dose_mg numeric,
  dose_unit text DEFAULT 'mg',  -- 'mg', 'g', 'serving', 'capsule'
  logged_at time,
  notes text
);

CREATE TABLE supplement_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_name text NOT NULL,
  reminder_time time NOT NULL,
  trigger text DEFAULT 'daily',  -- 'daily', 'post_workout', 'pre_sleep'
  is_active boolean DEFAULT true
);
```

### Why This Matters

Supplement tracking occupies an underserved gap between nutrition logging apps and biohacking journals. It gives the correlation engine a new class of variables to work with, and it creates a natural, low-friction daily interaction that doesn't require a workout or a full meal log.

---

---

## Idea 6 — Running & Cardio Intelligence

### The Problem

The app handles strength training excellently but treats cardio as a single binary — "did movement today: yes/no." For users who run, cycle, swim, or row, there's a wealth of performance data (pace, distance, heart rate zones) that could be surfaced intelligently. Strava sync brings in the raw data but the app doesn't analyse it.

### What It Does

**Training Zone Analysis**
For each Strava activity, estimate which heart rate zone the session was primarily in (using estimated max HR from age if no HR data, or actual HR from Strava if available):
- Zone 1–2 (aerobic base, fat-burning)
- Zone 3 (threshold)
- Zone 4–5 (VO2 max, anaerobic)

Show a weekly zone distribution bar — most coaches recommend 80% easy, 20% hard.

**VO2 Max Trend**
Estimate VO2 max from run pace + distance using the Daniels/Gilbert formula. Track this over time and plot as a trend. Even a rough estimate is motivating to watch improve.

**Aerobic Fitness Score**
A running-specific version of the Fitness Age idea: how does your pace, consistency, and endurance compare to age-group norms?

**Cardio Periodization**
Integrate with the training programs feature: allow programs to include cardio days with specific zone targets. *"Tuesday: 30-minute Zone 2 run — easy effort, conversational pace."*

**Personal Bests for Cardio**
PR tracking for distance milestones (5K, 10K, half, full marathon) alongside the existing strength PR wall.

### Data Requirements

Primarily computed from existing Strava data. A new `cardio_sessions` view or table normalising Strava + manually logged cardio with zone annotations.

```sql
CREATE TABLE cardio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,           -- 'strava', 'manual'
  activity_type text NOT NULL,    -- 'run', 'cycle', 'swim', 'row', 'other'
  date date NOT NULL,
  duration_min int NOT NULL,
  distance_km numeric,
  avg_pace_sec_per_km numeric,
  estimated_vo2max numeric,       -- calculated
  primary_zone int,               -- 1-5
  zone_distribution jsonb,        -- {z1_pct, z2_pct, z3_pct, z4_pct, z5_pct}
  source_activity_id text,        -- Strava activity ID for dedup
  UNIQUE(user_id, source, source_activity_id)
);
```

### Why This Matters

Running is the most popular form of exercise globally. Many users will use the app primarily as runners, with strength training secondary. Deepening cardio intelligence — pace zones, VO2 max trends, training load balance — gives these users a reason to keep the app as their primary fitness tool rather than deferring to Strava or Garmin Connect.

---

---

## Idea 7 — Adaptive Goal Engine

### The Problem

Goals are set once in the Goal Wizard and then mostly ignored. The app tracks progress but doesn't update the goal when life changes — when a user starts missing weekly targets for 3 weeks running, they feel like they're failing but nobody adjusts the plan. Goals need to be living documents, not a one-time setup.

### What It Does

**Progress Projection**
For each active goal (weight target, workout frequency, protein consistency), compute the actual trajectory and project it forward. If the user is on track, show a green "on pace" indicator. If they're behind, show the adjusted timeline: *"At your current pace, you'll reach your goal in January — 6 weeks later than planned."*

**Adaptive Suggestions**
When a goal is consistently missed for 2+ weeks, the AI Coach proactively opens a check-in: *"You've been hitting protein 3/7 days lately vs. your 5/7 target. Would you like to adjust your target, or should we look at what's getting in the way?"*

**Goal Micro-Milestones**
Break long-term goals (lose 10kg over 6 months) into 2-week micro-milestones. Celebrate micro-milestone achievement with XP + a badge. When a micro-milestone is missed, the system recalculates rather than letting the main goal feel permanently off-track.

**Contextual Goal Pausing**
Let users "pause" a goal for a defined period (holiday, illness, life event) without breaking their streak or resetting their progress. The paused period is excluded from trend calculations.

**Seasonal / Phased Goals**
Support multi-phase goals: bulk phase (12 weeks, calorie surplus, strength focus) → cut phase (8 weeks, calorie deficit, maintain strength) → maintenance. The system transitions automatically at the week boundary.

### Why This Matters

Static goals create shame spirals when life intervenes. Adaptive goals create resilience. This feature changes the app's relationship with users from "judge" to "coach" — always adjusting, never punishing, always looking for a path forward. It also dramatically reduces churn caused by goal-failure discouragement.

---

---

## Idea 8 — Health Report Export

### The Problem

Users increasingly share fitness data with doctors, dietitians, personal trainers, and sports coaches. Right now there's no way to export the app's data in a format that's useful for a professional. A user meeting with a dietitian can't say "here's my food log" — they'd have to manually describe their habits. This is a missed opportunity and a growing user need.

### What It Does

**PDF Health Report**
A one-tap export generating a multi-page PDF containing:
- 30-day summary: average calories, protein, sleep quality, energy, stress, workout frequency
- Macro compliance charts
- Weight / body composition trend
- Exercise list with volume trends
- Micronutrient gaps (if Idea 2 is built)
- Notable correlations (if Correlation Engine is built)
- A plain-English AI summary written specifically for a healthcare professional audience (objective, no superlatives)

**CSV Data Export**
Raw export of all daily logs as CSV — for users who want to do their own analysis or move to another app.

**Shareable Link (Time-Limited)**
Generate a view-only link to a summary dashboard that a trainer or dietitian can access for 30 days without requiring an account.

**Apple Health / Google Fit Handshake**
When the native integration exists, export workouts and body weight back to Health so the data appears in medical apps like MyFitnessPal, Health Records, or doctor-facing platforms.

### Technical Approach

Use a PDF generation library (e.g. `@react-pdf/renderer` which is React-based and can reuse existing chart components) for the PDF. The AI summary prompt should explicitly instruct the model to use clinical language and avoid motivational tone.

### Why This Matters

Data portability is both a user right and a powerful trust signal. Users who share their data with professionals have a reason to log more carefully — which improves data quality. The professional-facing report also positions the app as a tool that healthcare providers recommend, opening a different acquisition channel.

---

---

## Idea 9 — Habit Streaks & Per-Habit Gamification

### The Problem

The current streak system tracks a single "did I log today?" signal. But users have multiple fitness habits they're trying to build — protein consistency, workout frequency, sleep consistency, alcohol limits — each deserving its own streak, celebration, and history. Collapsing everything into one streak undersells the gamification opportunity and misses users who are killing it on nutrition but inconsistent with movement.

### What It Does

**Per-Habit Streaks**
Track independent streaks for:
- Protein goal hit (≥ target protein logged)
- Workout completed
- Sleep quality logged ≥ 3/5
- Alcohol ≤ user-defined limit
- Daily log completed
- Custom habits (user-defined, e.g. "meditated", "cold shower", "no sugar")

Each habit shows its own current streak and best-ever streak.

**Habit Dashboard**
A new tab or card on the dashboard showing all active habit streaks as a row of icons with streak counts. Tapping one shows the full history (GitHub-style contribution heatmap, 12 weeks).

**Habit Badges**
New badge tier for habit streaks: bronze (7 days), silver (30 days), gold (90 days), platinum (365 days) for each habit category. These award XP on achievement.

**Habit Challenges**
Build on the Group Challenges system (Pillar 5): add habit-based challenges. *"Protein Week — hit your protein goal every day for 7 days."* Can be personal or shared with accountability partners.

**Smart Habit Suggestions**
Based on the Correlation Engine results, AI suggests which habit to prioritise: *"Your data shows hitting your protein goal is your strongest lever for energy. What if you focused on that one habit this month?"*

### Why This Matters

Habit streaks are one of the most powerful engagement mechanics in consumer apps. Duolingo's success is largely attributable to single-streak psychology. By giving each fitness habit its own streak, users have multiple "lives" — missing a workout doesn't kill the protein streak, maintaining interest even on rest days. It also personalises the gamification to what each user actually cares about.

---

---

## Idea 10 — Coach / Trainer Mode

### The Problem

Personal trainers and coaches currently have no way to work with their clients through the app. A coach wants to see client progress, assign workouts, and leave notes — but the app has no multi-account or professional view. This limits the app to self-coached users and excludes an entire professional use case.

### What It Does

**Coach Account Type**
A new account role: `coach`. Coaches can:
- View a read-only summary dashboard for each linked client (same data as the accountability partner view, but richer)
- Create and assign workout programs directly to clients (using the existing AI program generation)
- Leave coaching notes on specific workouts or weekly summaries
- View client readiness scores, recent workout performance, and trend data

**Client Linking**
Clients invite their coach by email (same flow as accountability partners). Coach accepts and gains read access. Client controls what data is visible (full log vs. summary vs. workouts only).

**Coach Inbox**
Coaches see a multi-client inbox: a scrollable list of clients with their most recent activity, readiness score, and any flagged issues (missed consecutive workouts, ACWR spike, streak break).

**Program Assignment**
Coach generates a 12-week program via the AI (already built), assigns it to the client. Client sees it in their Programs page as a "Coach-assigned" program with the coach's name.

**Monetisation Angle**
This is the app's clearest B2B opportunity. Personal trainers who use the app with 10+ clients become high-value retention anchors. Consider a "Coach plan" at a higher subscription tier.

### Data Requirements

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'user';
  -- 'user', 'coach'

CREATE TABLE coach_client_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',        -- 'pending', 'active', 'ended'
  data_access_level text DEFAULT 'summary',  -- 'summary', 'workouts', 'full'
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(coach_id, client_id)
);

CREATE TABLE coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users(id),
  client_id uuid REFERENCES auth.users(id),
  note_type text NOT NULL,              -- 'weekly', 'workout', 'general'
  reference_id uuid,                    -- workout_id or weekly date
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Why This Matters

Every personal trainer who adopts the app brings their entire client roster with them. It's a classic B2B2C acquisition lever. It also solves a genuine problem — personal trainers currently manage client programmes across Google Sheets, WhatsApp, and paper — and replaces all of it with one place.

---

---

## Second-Generation Prioritisation Matrix

| Idea | Impact | Feasibility | Score | Notes |
|---|---|---|---|---|
| AI Meal Photo Logging | Very High | High | ★★★★★ | Claude vision already integrated — mostly prompt engineering |
| Habit Streaks & Per-Habit Gamification | High | Very High | ★★★★★ | Builds on existing streak/XP system, no new infra |
| Injury Prevention (ACWR) | Very High | High | ★★★★☆ | Data already exists in workout_sets; calculation is straightforward |
| Adaptive Goal Engine | High | High | ★★★★☆ | Goal Wizard already built; this adds intelligence on top |
| Micronutrient Analysis | High | Medium | ★★★☆☆ | Needs food-to-nutrient lookup table; AI can fill gaps |
| Supplement Tracker | Medium | High | ★★★☆☆ | Simple new log section; high correlation engine value |
| Health Report Export | Medium | Medium | ★★★☆☆ | Good trust signal; PDF generation library needed |
| Running & Cardio Intelligence | High | Medium | ★★★☆☆ | Strava data already available; zone calc is straightforward |
| Fitness Age Score | High | Medium | ★★★☆☆ | Compelling hook; needs careful algorithm calibration |
| Coach / Trainer Mode | Very High | Low | ★★☆☆☆ | High strategic value; significant auth/permission complexity |

### Recommended Next Sprint (after Correlation Engine ships)

1. **Habit Streaks** — high impact, fits directly into existing gamification, could ship in 2–3 days
2. **AI Meal Photo Logging** — removes the biggest logging friction, uses existing Claude vision
3. **Injury Prevention (ACWR)** — all data already exists; adds proactive, safety-focused intelligence
4. **Adaptive Goal Engine** — makes goals feel alive rather than abandoned

---

*Document last updated 2026-05-29. Standing items: Correlation Engine (Pillar 1) and Apple Health integration remain the outstanding original pillars.*
