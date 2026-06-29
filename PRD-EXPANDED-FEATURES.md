# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (revised 2026-06-29)  
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

## New Feature Ideas — Brainstorm (Added 2026-06-29)

The features below are not yet scheduled. They are organised by theme, with enough detail to assess before committing. Each entry includes a one-line rationale, a rough technical approach, and an estimated effort band.

---

### Idea 1 — Food Photo Recognition

**One-line:** Point your camera at a meal and have AI identify the food items and estimate macros — no typing required.

**The problem:** Manual food entry is the highest-friction part of the daily log. Users skip it, forget it, or give up. Photo logging removes the cognitive cost entirely.

**What it does:**
- A camera button in the food log opens the device camera (or file picker)
- The image is sent to a multimodal AI model (Claude or GPT-4o Vision) with a prompt asking it to identify visible food items and estimate weights/portions
- Returns a list of food items with estimated macros, pre-filled into the log for user review before saving
- Users can adjust quantities or remove items before confirming

**Technical approach:**
- Uses the existing food-entry AI pipeline, extended with image input
- Claude's vision capability handles the image analysis (`claude-sonnet-4-6` supports image attachments)
- Prompt: *"Identify all visible food items in this image. For each, estimate the portion size and provide: name, estimated calories, protein (g), carbs (g), fat (g). Return JSON. If uncertain, give a range and flag it."*
- The same `FoodEntryAI` component gains an "Upload photo" mode alongside the existing text mode

**Edge cases to handle:** Multiple foods in one photo, packaged foods (lower confidence), unclear lighting. Show confidence level and always let the user edit before saving.

**Effort:** 2–3 days (model is already integrated; mostly UI + prompt tuning)

**Why it matters:** Reduces the #1 friction point in food tracking. Likely to increase daily log completion rates significantly.

---

### Idea 2 — Hydration Tracker

**One-line:** Track daily water intake with a simple tap-to-add interface and smart reminders that adjust based on workout intensity and weather.

**The problem:** Hydration affects energy, recovery, and cognitive function — all of which the app already tracks — but there's no way to log water. It's also one of the easiest wins for user health with very low logging effort.

**What it does:**
- A water intake section in the daily log: a visual progress ring (e.g. 6/8 glasses) with large "+1 glass" and "+500ml" tap targets
- Daily goal defaults to 2L but adjusts: +500ml if a workout was logged, +250ml on days with high step counts
- Hydration becomes a new variable in the Correlation Engine (dehydration vs energy, headaches, sleep quality)
- Evening reminder if the user is below 60% of their target by 6pm

**New data model:**
```sql
-- Add to daily_logs (or as its own lightweight table)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_ml int DEFAULT 0;
```

**Effort:** 1 day (UI + one column)

**Why it matters:** Extremely low-effort to build. Adds a new dimension to the correlation engine. Users who track water tend to drink more of it — direct health impact with minimal development cost.

---

### Idea 3 — Supplement Tracker

**One-line:** Log daily supplements and correlate them with workout performance, recovery scores, and energy levels.

**The problem:** Many users take supplements (creatine, omega-3, magnesium, vitamin D, pre-workout) but have no way to track consistency or measure whether they're working. The correlation engine has no supplement data to work with.

**What it does:**
- A "Supplements" section in the daily log — a checkbox list of the user's supplement stack
- Users define their stack once (name + dose + timing: morning/pre-workout/evening). The log shows a checkbox per supplement per day
- The Correlation Engine gains new variable pairs: `creatine_taken` ↔ `strength_improvement`, `magnesium_taken` ↔ `sleep_quality`, `pre_workout_taken` ↔ `workout_duration`
- A simple compliance view: "You've taken creatine 18/21 days this month"

**New data model:**
```sql
CREATE TABLE supplement_stack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose_mg int,
  timing text,   -- 'morning', 'pre_workout', 'post_workout', 'evening', 'with_food'
  active boolean DEFAULT true
);

-- Track daily intake as part of daily_logs or as a join table
CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  supplement_id uuid REFERENCES supplement_stack(id) ON DELETE CASCADE,
  taken boolean DEFAULT false,
  UNIQUE(user_id, date, supplement_id)
);
```

**Effort:** 1–2 days

**Why it matters:** Makes the app useful for a much wider audience (supplement users are highly engaged fitness people). Also feeds the Correlation Engine with a new class of variable.

---

### Idea 4 — Intermittent Fasting / Eating Window Timer

**One-line:** A visual countdown timer that tracks the user's fasting window, eating window, and time since last food — with configurable protocols (16:8, 18:6, 5:2).

**The problem:** Intermittent fasting is one of the most popular dietary approaches but there's no native support in the app. IF users currently use a separate app for the timer, which creates fragmentation.

**What it does:**
- User selects a fasting protocol: 16:8 (fast 16h, eat in 8h window), 18:6, 5:2, or custom eating window hours
- Dashboard widget shows: current state (fasting / eating window), a countdown ring to next state, time fasted so far
- "Start eating" and "Stop eating" buttons log the eating window boundaries
- At the end of each fast, the completed fast is logged and can feed the Correlation Engine (`fasting_hours` ↔ `energy_level`, ↔ `weight_trend`)
- The Nutrition Plan (Pillar 2) becomes aware of the eating window — all meal suggestions fall within the window
- Optionally: push notification when the eating window opens or closes

**New data model:**
```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS fasting_protocol text DEFAULT null,  -- '16:8', '18:6', '5:2', 'custom'
  ADD COLUMN IF NOT EXISTS eating_window_start time,            -- e.g. 12:00
  ADD COLUMN IF NOT EXISTS eating_window_end time;              -- e.g. 20:00

CREATE TABLE fasting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  fast_start timestamptz NOT NULL,
  fast_end timestamptz,
  eating_window_end timestamptz,
  target_hours int,
  completed boolean DEFAULT false
);
```

**Effort:** 2 days

**Why it matters:** IF is mainstream. This is a "why doesn't this app have that?" gap that causes users to install a second app. Consolidating it improves daily active usage.

---

### Idea 5 — Goal Projection & Timeline

**One-line:** Show users a projected date for reaching each goal based on their current trend, and flag when they're off-track.

**The problem:** Users set goals (lose 5kg, bench 100kg, run 5km) but the app never tells them whether they're on pace or falling behind. Goal-setting without feedback on trajectory is motivationally hollow.

**What it does:**
- For each active goal, calculate the linear trend from the last 30 days of data and project when the user will hit the target at their current rate
- Show on the Goals page and in the AI coaching context: *"At your current rate of ~0.4kg/week, you'll reach your goal of 75kg in about 10 weeks — by September 7th."*
- Flag when a goal is off-track: *"You're behind pace on your protein goal — you've hit it only 40% of days, but need 70%+ to meet your target."*
- Weekly AI Coach message includes trajectory update: "On track", "Slightly behind", "Off track"
- A simple chart on the goal card showing actual progress vs the required rate curve

**Technical approach:** Linear regression on the relevant metric (body weight from `body_metrics`, average protein from `daily_logs`, max weight from `workout_sets`). No AI needed for the calculation — pure math. AI generates the natural-language framing.

**Effort:** 2 days

**Why it matters:** Goals without trajectory feedback are wishes. This turns every goal into a project with a deadline and a progress indicator — the single most effective motivational frame.

---

### Idea 6 — Smart Contextual Push Notifications

**One-line:** Replace time-based reminders with behavior-aware nudges that fire based on what the user actually does (and doesn't do), not a fixed schedule.

**The problem:** The current push notification system sends reminders at fixed times set by the user. This means reminders fire even when the user has already logged, and don't fire when the user is unusually inactive relative to their own pattern.

**What it does:**
- Replace static reminder times with a smart trigger system that evaluates conditions at intervals:
  - *"You usually log by 10am but haven't today — still want to?"* (fires at 10:30am if no log exists)
  - *"It's 8pm and you're still below 60% of your water target."*
  - *"Your readiness score is 88 today — best you've had this week. Great day to hit the gym."*
  - *"You've gone 5 days without logging a workout. Your streak ends tomorrow."*
  - *"You're 3 days from your longest streak ever (21 days). Keep going!"*
- Users choose a notification style: "Smart" (behavior-based), "Fixed" (current system), or "Off"
- No new data collection needed — all triggers are evaluated against existing data

**Technical approach:** Nightly/hourly Vercel cron job evaluates trigger conditions per user and sends via existing VAPID push infrastructure. Conditions are a small library of evaluator functions.

**Effort:** 2–3 days

**Why it matters:** Push notification relevance is the #1 determinant of whether users keep notifications on. Behavior-aware nudges are far less annoying and far more effective than static reminders.

---

### Idea 7 — Training Balance & Injury Prevention Flags

**One-line:** Detect muscle group imbalances and training gaps in the user's workout history, and surface warnings before injury patterns develop.

**The problem:** The app tracks every exercise but doesn't analyse the *distribution* of training. Many users inadvertently over-train push movements (bench, shoulder press) and under-train pull movements (rows, pull-ups), or chronically skip leg day, leading to imbalances that cause injury.

**What it does:**
- A "Balance" section in the workout/gains view showing training volume by muscle group category: Push, Pull, Legs, Core, Cardio
- Visual balance indicator: a pentagon/radar chart showing volume distribution across the 5 categories
- Flags:
  - *"You haven't trained your back in 12 days."*
  - *"Push-to-pull ratio is 3:1 this month — consider adding rows or pull-ups."*
  - *"You've trained legs every day this week — consider a rest day for lower body."*
  - *"Same muscle groups trained 3 days in a row — risk of overuse injury."*
- Exercise-to-muscle-group mapping stored as a lookup table (populated from a standard exercise database, or crowdsourced from the app's existing exercise library)
- An AI-generated "Recovery Suggestion" when an imbalance is detected: *"Your posterior chain hasn't been trained this week. Consider adding Romanian deadlifts or face pulls to your next session."*

**New data model:**
```sql
-- Muscle group mapping (can be seeded from exercise database)
CREATE TABLE exercise_muscle_groups (
  exercise_name text PRIMARY KEY,
  primary_groups text[],   -- e.g. ['chest', 'triceps']
  secondary_groups text[], -- e.g. ['front_deltoid']
  category text NOT NULL   -- 'push', 'pull', 'legs', 'core', 'cardio'
);
```

**Effort:** 2–3 days (mostly the exercise mapping data work and the radar chart UI)

**Why it matters:** Injury prevention is one of the most concrete, high-value things a fitness app can do. It requires the historical workout data already captured — no new user input. And it creates urgency that drives re-engagement ("you haven't trained back in 12 days").

---

### Idea 8 — Monthly Health Report Card

**One-line:** A beautiful, shareable summary of the user's month — auto-generated, highlights progress, suitable for sharing with a coach or doctor.

**The problem:** Users accumulate months of data but rarely step back to see the full picture. There's no shareable artefact of their progress — nothing to show a personal trainer at a consultation, or a doctor at a checkup, or to celebrate on social media without exposing raw personal data.

**What it does:**
- On the 1st of each month, generate a Monthly Report Card for the previous month
- Delivered as a push notification: *"Your May Report is ready — here's your month in numbers."*
- Report includes:
  - Days logged / streak best / total XP earned
  - Average macros vs targets (% hit rate)
  - Total workouts, total volume lifted, personal records broken
  - Weight change, body composition change if tracked
  - Top 3 AI-generated insights from the month
  - One motivational summary sentence
- Exportable as a PNG (shareable to Instagram Stories, WhatsApp, etc.) or PDF
- Also shareable with accountability partners in-app

**Technical approach:**
- Claude generates the narrative summary and insight highlights
- The PNG export uses a server-side HTML-to-image renderer (Satori or Puppeteer on Vercel) with the app's design system
- Data is all pulled from existing tables in a single query

**Effort:** 3–4 days (report generation is straightforward; the image export/renderer is the new piece)

**Why it matters:** Creates a shareable, dopamine-inducing artefact. Drives word-of-mouth when users share their report cards. Also gives users a reason to keep logging — they want a complete month to show.

---

### Idea 9 — Fitness Age Score

**One-line:** A single number that estimates your "biological fitness age" based on all captured health data — a gamified, shareable metric that motivates long-term improvement.

**The problem:** Abstract health metrics (VO2 max, resting heart rate, body fat %) mean little to most people. Translating them into "your body is performing like a 28-year-old" is deeply motivating and far more shareable than raw numbers.

**What it does:**
- A computed score, displayed as "Your Fitness Age: 31" (vs chronological age)
- Calculated from a weighted combination of available data:
  - Resting heart rate (estimated from workouts, or from Apple Health/Oura if available)
  - Recovery score trend (from Pillar 4)
  - Body composition (BMI or body fat % if available)
  - Workout frequency and progression trend
  - Sleep quality average
  - Nutrition consistency (protein + calorie targets hit rate)
- The score improves as the user's habits improve — a long-run motivational north star
- Historical chart: "Your fitness age over time" — seeing it drop from 38 to 33 over 6 months is powerful
- Formula is transparent and explainable: the AI Coach can explain exactly which inputs are dragging the score up or down

**Technical approach:** Purely algorithmic — a weighted formula based on validated reference ranges for each metric (e.g. resting HR <60 → score like a 25-year-old). No AI needed for calculation; AI generates the explanation.

**Effort:** 2 days

**Why it matters:** Fitness age is the ultimate gamification metric. It's instantly understandable, emotionally resonant, and improves over time in proportion to actual health — unlike XP points which reward mere consistency. Highly shareable.

---

### Idea 10 — Diet Protocol Mode

**One-line:** First-class support for specific eating protocols (Keto, Carnivore, Vegan, High-Protein, IIFYM) that reconfigures macro targets, food suggestions, and AI coaching to match.

**The problem:** The app currently treats nutrition as generic calorie/macro tracking. Users following specific protocols (keto tracks net carbs not total carbs; carnivore has almost no carbs; vegan needs B12 and iron flagging) are under-served. The AI Coach gives generic advice that contradicts their chosen approach.

**What it does:**
- A "Diet Protocol" setting (alongside the existing dietary restrictions field):
  - **Standard / Flexible** — current behaviour
  - **High-Protein** — protein target is 1× bodyweight in grams; de-emphasises fat
  - **IIFYM** — strict macro tracking, daily rollover of remaining macros
  - **Keto** — net carbs (total − fiber) replace total carbs; hard cap at 20–50g net carbs; fat target at 65–75% of calories
  - **Carnivore** — only animal products; disables vegetable/fruit suggestions; tracks animal-source protein and fat only
  - **Vegan / Plant-Based** — flags low B12, iron, zinc, omega-3 if not supplemented; suggests plant protein combinations
  - **Mediterranean** — emphasises olive oil, fish, legumes, whole grains; flags processed food entries
- Choosing a protocol reconfigures: macro rings, food entry suggestions, AI coaching system prompt, and correlation variables
- The AI Coach is told which protocol the user is following and adjusts its advice accordingly

**New data model:**
```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS diet_protocol text DEFAULT 'standard';
  -- 'standard', 'high_protein', 'iifym', 'keto', 'carnivore', 'vegan', 'mediterranean'
```

**Effort:** 3 days (mostly the protocol-specific logic branches and AI prompt variations)

**Why it matters:** Protocol-specific users are the most engaged nutrition trackers. They'll choose an app that speaks their language over a generic tracker every time. This widens the addressable user base significantly without adding complexity for users who don't opt in.

---

### Summary of New Ideas

| Idea | Impact | Effort | Priority |
|---|---|---|---|
| Food Photo Recognition | Very High | 2–3 days | High — reduces the #1 friction point |
| Hydration Tracker | Medium | 1 day | High — trivial to build, feeds correlation engine |
| Supplement Tracker | Medium | 1–2 days | Medium — niche but engaged audience |
| IF / Eating Window Timer | High | 2 days | High — closes a gap vs dedicated IF apps |
| Goal Projection & Timeline | Very High | 2 days | High — makes goals feel real and urgent |
| Smart Contextual Notifications | High | 2–3 days | High — directly improves retention |
| Training Balance & Injury Prevention | High | 2–3 days | Medium — requires exercise mapping data |
| Monthly Health Report Card | High | 3–4 days | Medium — shareable, drives word-of-mouth |
| Fitness Age Score | High | 2 days | Medium — strong gamification, shareable |
| Diet Protocol Mode | High | 3 days | Medium — widens audience, high engagement |

**Highest-priority new ideas for near-term consideration:**
1. **Goal Projection & Timeline** — uses only existing data, directly boosts motivation
2. **Smart Contextual Notifications** — uses existing infrastructure, directly improves retention
3. **Hydration Tracker** — one column, one day, feeds the correlation engine
4. **Food Photo Recognition** — biggest friction reduction in the app

---

---

## Prioritisation Matrix

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

### Original Six Pillars

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

### New Brainstorm Ideas (Added 2026-06-29)

| Idea | Impact | Feasibility | Score | Suggested Sequencing |
|---|---|---|---|---|
| Hydration Tracker | Medium | Very High | ★★★★★ | Sprint 2 — one column, one day |
| Goal Projection & Timeline | Very High | High | ★★★★☆ | Sprint 2 — pure maths on existing data |
| Smart Contextual Notifications | High | High | ★★★★☆ | Sprint 2 — uses existing push infra |
| Food Photo Recognition | Very High | High | ★★★★☆ | Sprint 3 — vision model already integrated |
| Fitness Age Score | High | High | ★★★☆☆ | Sprint 3 — algorithmic, no new data needed |
| IF / Eating Window Timer | High | High | ★★★☆☆ | Sprint 3 — closes gap vs dedicated IF apps |
| Supplement Tracker | Medium | High | ★★★☆☆ | Sprint 3 — niche but engaged audience |
| Monthly Health Report Card | High | Medium | ★★★☆☆ | Sprint 4 — image renderer is new infra |
| Training Balance & Injury Prevention | High | Medium | ★★★☆☆ | Sprint 4 — requires exercise mapping data |
| Diet Protocol Mode | High | Medium | ★★★☆☆ | Sprint 4 — logic branches + prompt variants |

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
