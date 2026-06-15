# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (revised 2026-06-15 — Appendix B added)  
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

## Appendix B — Emerging Feature Ideas (Brainstorm)

The following ideas are **unbuilt and unscored**. They extend beyond the six pillars and represent potential future directions. Each is described at the concept level for review; none should be started without a follow-up spec pass.

---

### Idea 1 — Meal Photo Logging

**The idea:** Take a photo of a plate of food and have AI estimate the macros and log the meal automatically. No manual searching for items, no portion estimation — point, shoot, done.

**Why it matters:** The single biggest reason users stop logging food is friction. This removes the heaviest part of that friction. Similar features in MyFO and Lose It have become their most-used functionality. It would be a step-change in daily active usage.

**How it would work:**
- User taps a camera icon on the food log tab
- Image is sent to Claude's vision API with a prompt requesting structured JSON: `[{ name, serving_size, calories, protein, carbs, fat }]`
- User reviews the estimate and confirms/adjusts before saving
- Logged like any other food entry

**Effort:** Medium (1–2 weeks). The AI call is straightforward; the UX for review/edit is the main work.

**Risk:** Vision-based calorie estimation has meaningful error rates (~±20%). Framing it as "AI estimate — adjust if needed" manages expectations.

---

### Idea 2 — Predictive Goal Achievement Timeline

**The idea:** Based on the past 4 weeks of trend data, project when the user will hit their current goal — and show this on the dashboard.

- *"At your current pace, you'll reach 80kg by 14 September."*
- *"You're 18 days behind pace — you'd need to average a 350 kcal deficit to stay on track."*

**Why it matters:** Abstract goals feel distant. A concrete date makes them real. It also creates urgency when pace slips, without being punishing — it's framed as information, not failure.

**How it would work:**
- Fetch the most recent `body_metrics` entries (weight) and calculate the weekly rate of change
- Extrapolate to goal weight using a simple linear projection
- Display as a label near the goal card on the dashboard, updated weekly
- Show a mini trend line: "actual" (solid) + "projected" (dashed) to goal

**Effort:** Low (2–3 days). Pure calculation from existing data, minimal UI.

**Extension:** Show pace lines on the existing weight trend chart — "goal pace" as a reference line so the user can visually see if they're above or below it.

---

### Idea 3 — Training Load & Injury Risk Indicator

**The idea:** A weekly "training load" gauge that detects potentially dangerous volume spikes before they become injuries — specifically, the Acute:Chronic Workload Ratio (ACWR), the most validated injury-risk metric in sports science.

**The problem it solves:** Most overuse injuries follow a clear pattern: a spike in training load over a short window relative to what the body is adapted to. The app has all the data to calculate this; right now it's unused.

**How it works:**
- **Acute load** = total workout volume (sets × reps × weight, or duration for cardio) in the past 7 days
- **Chronic load** = rolling 4-week average weekly volume
- **ACWR** = Acute ÷ Chronic
  - 0.8–1.3: sweet spot (green) — *"Training load is optimal."*
  - 1.3–1.5: caution (amber) — *"Volume spiked 35% above your baseline — consider backing off."*
  - >1.5 or <0.8: warning (red) — high injury risk or detraining
- Display as a compact badge on the Workout section header or the readiness card

**Effort:** Medium (3–5 days). Calculation from existing `workout_sets` data; new UI indicator.

**Note:** Works well alongside Pillar 4 (Readiness Score) and Pillar 3 (Periodisation) — could be merged into a unified training intelligence card.

---

### Idea 4 — Sleep Optimization Coach

**The idea:** A dedicated, persistent AI coach focused specifically on improving sleep quality, using only the user's own logged data to make concrete, personalized recommendations.

**The problem it solves:** Sleep quality is tracked every day but the insight from it is almost never fed back to the user in a useful way. The correlation engine (Pillar 1) might surface alcohol ↔ sleep correlations, but there's a richer seam: bedtime consistency, pre-sleep eating, workout timing, stress, and screen time all affect sleep quality.

**What it produces:**
- A weekly "Sleep Review" card with 1–3 specific recommendations:
  - *"Your worst sleep nights follow days when you logged a workout after 8pm (4 data points). Try moving evening sessions earlier."*
  - *"Your sleep quality averages 3.8/5 on days you log 3+ drinks vs 4.4/5 with none."*
  - *"You've had 5/5 sleep quality only 3 times. All three followed days where you logged < 200mg caffeine and were in bed before midnight."*
- A simple "Sleep hygiene streak" that tracks nights where sleep was 4/5 or better

**Effort:** Low-medium (2–4 days). This is primarily a smart prompt engineering task over existing daily_logs data, plus a new card component.

**Future extension:** Add a "sleep window tracker" — let users log their actual bedtime/wake time (not just quality) for more precise analysis.

---

### Idea 5 — Intermittent Fasting Tracker

**The idea:** A dedicated fasting timer and log integrated into the daily entry, with correlation to energy, weight, and workout performance.

**Why it matters:** Intermittent fasting is one of the most-searched fitness topics and one of the most common nutritional strategies among the target demographic. Many users currently do IF but have no way to track it or see if it's working for them within the app.

**Core features:**
- **Fast timer:** Start/stop fasting windows with one tap; runs in background (push notification at eating window open)
- **Fasting log:** Automatically logs fasting window duration each day
- **Protocol presets:** 16:8, 18:6, 20:4, OMAD, 5:2 — user picks their protocol
- **Correlation view:** Energy level and weight trend broken down by fasting days vs non-fasting days

**New data:**
```sql
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS fasting_start timestamptz,
  ADD COLUMN IF NOT EXISTS fasting_end timestamptz,
  ADD COLUMN IF NOT EXISTS fasting_hours numeric;  -- computed
```

**Effort:** Medium (4–6 days). Timer state in the app + schema addition + correlation view.

**Risk:** Adds complexity to the daily log UI. Could be gated behind a setting: "Enable fasting tracker" (off by default).

---

### Idea 6 — AI Recipe Generator

**The idea:** Given a user's macro targets for the day (or a meal slot), generate a specific recipe with full macro breakdown, ingredients, and instructions. Goes one step further than the Meal Planner (Pillar 2) — not "what should I eat" but "how do I make it."

**Why it matters:** Meal planning fails when users don't know what to actually cook. Generating specific, macro-matched recipes with what's in their fridge closes the gap between intention and action.

**Implementation:**
- Entry points: (a) from a meal plan slot — "Generate a recipe for this lunch", (b) standalone from a "Recipes" tab, with macro target pre-filled
- User can add constraints: "I have chicken, rice, and broccoli", "under 20 minutes", "high protein"
- Claude generates a recipe with: title, servings, ingredient list with quantities, instructions, and per-serving macros
- User can save the recipe to their library, one-tap add to today's log, or one-tap add to meal plan

**Prompt shape:**
```
Generate a recipe for one person hitting these targets: {calories} kcal, {protein}g protein,
{carbs}g carbs, {fat}g fat. Constraints: {user_text}.
Return JSON: { title, servings, ingredients: [{name, quantity, unit}], steps: [string], 
macros: { calories, protein, carbs, fat } }.
```

**Effort:** Medium (4–6 days). Primarily prompt engineering + a recipe display component + save/log flow.

---

### Idea 7 — Body Recomposition Mode

**The idea:** A dedicated tracking mode for users who are simultaneously losing fat and gaining muscle — a scenario where the scale may not move (or may even go up) while body composition improves dramatically. Without this, users often quit because they "aren't losing weight."

**The problem it solves:** Standard weight-loss framing is deeply demotivating for recompers. Someone gaining 1kg of muscle while losing 1kg of fat has made excellent progress but the scale says zero change. The app currently only shows scale weight trends.

**What it adds:**
- A "Recomposition" goal type in the Goal Wizard (requires body fat % input)
- Dashboard in recomposition mode shows: scale weight + estimated lean mass + estimated fat mass — derived from weight and body fat % entries
- A "Recomposition score" = (lean mass gained in period) - (fat mass lost in period), shown as a weekly delta
- Progress photos are prominently featured in this mode since the mirror is more useful than the scale

**Data note:** Requires periodic body fat % logging. Works best with a Withings scale (Pillar 6) but can use manual caliper/estimation entries.

**Effort:** Low-medium (3–4 days). Primarily new UI/calculation layer over existing body_metrics data.

---

### Idea 8 — Circadian Performance Profiling

**The idea:** Analyse whether the user performs better at different times of day, and give them a data-backed recommendation for their optimal training window.

**Why it matters:** Chronobiology research consistently shows 10–20% performance differences based on training time relative to circadian rhythm. But the answer is highly individual. The app can discover *this user's* optimal time from their own workout data.

**How it works:**
- Every workout log has a `started_at` timestamp (or could be added)
- Bucket workouts into time windows: Early Morning (5–8am), Morning (8–11am), Midday (11am–2pm), Afternoon (2–6pm), Evening (6–10pm)
- For each window with ≥5 data points, calculate: average volume, average workout completion rate, average post-workout energy (next log entry), average readiness score on those days
- Surface as a "Your best time to train" insight card — *"You log 22% more volume on afternoon workouts than morning ones. Your completion rate is also higher: 94% vs 78%."*

**Effort:** Low (2–3 days). Primarily a data analysis task over existing timestamps.

**Dependency:** Requires `started_at` timestamp on `workouts` — check if this field already exists.

---

### Idea 9 — Bloodwork & Biomarker Tracker

**The idea:** A dedicated log for periodic lab results (quarterly or annual bloodwork), with trend visualization and AI interpretation.

**Why it matters:** Health-conscious users increasingly get regular blood panels (testosterone, vitamin D, ferritin, HbA1c, CRP, etc.) but have no good place to track them over time alongside their training and nutrition data. This is niche but extremely high-value for the users who care about it — and it's a category completely unoccupied by mainstream fitness apps.

**What it tracks:**
- User manually enters lab results by date (or photos the lab report — future: AI extraction)
- Stores per-marker readings over time
- Visualizes trends with reference range overlays (e.g., "your vitamin D has been below the optimal 40–80 ng/mL range for the past 3 quarters")
- Correlates with training load and nutrition (e.g., "low ferritin correlates with your lower-energy months")
- AI can note: "Your testosterone has increased 18% since you started the protein-focused goal 6 months ago"

**New data:**
```sql
CREATE TABLE biomarker_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_date date NOT NULL,
  marker_name text NOT NULL,        -- 'vitamin_d', 'testosterone_total', 'ferritin', etc.
  value numeric NOT NULL,
  unit text NOT NULL,               -- 'ng/mL', 'nmol/L', etc.
  lab_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

**Effort:** Medium (5–7 days). Schema + entry form + trend charts + AI narrative. No integrations required for v1.

---

### Idea 10 — Personal Record Celebration System (Enhanced)

**The idea:** A more comprehensive and emotionally resonant personal records system — going beyond just 1RM to celebrate all types of achievement, and making the celebrations visible and shareable.

**The problem:** Currently PR tracking is implicit (in the workout history) and understated. Many users hit genuine breakthroughs — their longest ever streak, their best week of sleep, their first month hitting protein goal — and the app says nothing. Missed emotional peak moments are missed retention opportunities.

**What it adds:**
- **Expanded PR categories:**
  - Workout: 1RM, total session volume, most sessions in a week/month
  - Nutrition: longest protein streak, best macro week, most consistent month
  - Wellness: best sleep score, longest high-energy streak, lowest stress week
  - Meta: longest app streak ever, first time reaching a new level, first badge
- **PR wall:** A timeline of all personal records, viewable in profile
- **Celebration modal:** When a PR is set, show a distinct celebration animation (different from the generic XP gain)
- **Shareable PR cards:** Generate a clean image card for sharing to Instagram Stories / WhatsApp — "I just hit a new personal record: Bench Press 1RM 100kg 🏋️" with the app logo and a minimalist design

**Effort:** Medium (4–6 days). The detection logic needs care to avoid false positives; the share card generation can use `html2canvas` or a Vercel OG image endpoint.

---

### Summary of New Ideas

| Idea | Impact | Effort | Standout Reason |
|---|---|---|---|
| Meal Photo Logging | Very High | Medium | Highest friction-reducer in food logging; category-defining |
| Predictive Goal Timeline | High | Low | High motivation, zero new data needed |
| Training Load / ACWR | High | Medium | Evidence-based injury prevention; differentiator |
| Sleep Optimization Coach | High | Low-Medium | Underutilised existing data |
| Intermittent Fasting Tracker | Medium-High | Medium | Massive user demand; no competitor does it well |
| AI Recipe Generator | High | Medium | Closes meal planning → execution gap |
| Body Recomposition Mode | High | Low-Medium | Fixes the "scale didn't move, I quit" retention problem |
| Circadian Performance Profiling | Medium | Low | Unique insight; requires almost no new code |
| Bloodwork Tracker | Medium | Medium | Niche but extremely high-value; no direct competitors |
| PR Celebration System | Medium | Medium | Retention and virality; extends existing gamification |

---

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
