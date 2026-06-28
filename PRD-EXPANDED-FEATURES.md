# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-28  
**Status:** Living document — updated with implementation status and new feature brainstorm

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

*Updated 2026-06-28 — many items marked 🔴 in the original have since shipped.*

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
| Body metrics | ✅ Measurements + photo upload |
| Nutrition planning | ✅ Meal planner, saved meals, pantry |
| Food photo recognition (AI) | ✅ Camera → AI food identification |
| Barcode / nutrition label scanner | ✅ OpenFoodFacts integration |
| Accountability partners | ✅ Weekly email summaries to partners |
| Oura Ring integration | ✅ Readiness + sleep sync |
| Withings Smart Scale integration | ✅ Weight + body composition sync |
| In-workout rest timer | ✅ Presets: 30 / 60 / 90 / 180 s |
| Offline mode | ✅ Service worker with network-first cache |
| AI training program generator | ✅ Goal-based 12-week programs |
| Social / community features | 🔴 Not started beyond accountability partners |
| Correlation engine & insight feed | 🔴 Not started |
| Recovery / readiness score (standalone) | ⚠️ Oura data surfaces in log but no score UI |
| Progressive overload tracking | 🔴 Not started |
| TDEE / metabolic adaptation tracking | 🔴 Not started |
| Group challenges / leaderboards | 🔴 Not started |
| Apple Health / Google Fit | 🔴 Not started (requires native app shell) |

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

## June 2026 Feature Brainstorm

*These ideas are new — not covered by the six pillars above. Each is a standalone candidate for a future sprint. Ordered roughly by estimated value-to-effort ratio.*

---

### Idea 1 — Personal Records (PR) Hall of Fame + Live Celebrations

**The gap:** The workout tracker records every set, but there's no moment of recognition when a user lifts more than they ever have before. That moment — a new personal record — is intrinsically motivating and currently goes unnoticed.

**What it would do:**

- During an active workout, after a set is logged, compare it to the user's all-time best for that exercise (by estimated 1RM). If it's a new record, trigger a celebration: animated confetti overlay, a haptic buzz, a sound effect (opt-in), and a PR badge stamped on the set.
- A **PR Hall of Fame** page (under Trends or a new Records tab) shows the user's all-time bests for every exercise they've ever done — weight, reps, estimated 1RM — with the date achieved. Each exercise is a card; tapping it shows the PR history graph over time.
- PRs feed into the **Correlation Engine** (Pillar 1): *"You set 3 PRs this month — all on days after 7+ hours of sleep."*

**Data model:** The `exercise_records` table proposed in Pillar 3 covers this. PR detection is a client-side calculation on save — no additional server infrastructure.

**Effort:** 1–2 days. High delight, low complexity.

---

### Idea 2 — TDEE Learning Engine (Metabolic Adaptation Tracking)

**The gap:** The app sets calorie targets based on stated goals, but those targets become stale. As users lose weight or adapt metabolically, their actual TDEE shifts — and the app never updates. Users plateau, get frustrated, and churn.

**What it would do:**

- **Calorie balance tracking:** Each week, compute expected weight change based on logged calories vs. the current TDEE estimate (calories in − TDEE = surplus/deficit; 7,700 kcal ≈ 1 kg of fat).
- **Actual vs. expected comparison:** Compare that to the user's measured weight change (from Withings sync or manual log). The ratio reveals metabolic adaptation. If actual weight loss is 40% slower than expected for 3+ weeks, the algorithm adjusts the TDEE estimate down.
- **Adaptive calorie targets:** Prompt the user when their TDEE estimate has drifted significantly from their starting assumption, and suggest a revised calorie target.
- **Refeed / diet break detection:** If a user has been in a sustained deficit for 8+ weeks and weight loss has stalled, suggest a 1–2 week maintenance refeed. Explain the physiology briefly.
- **Dashboard widget:** A "Calorie Balance Score" card showing: this week's estimated deficit/surplus, how it compares to target, and whether the weekly weight trend matches predictions.

**Data model:** No new tables needed. The engine runs against `daily_logs` (calories) and `body_metrics` (weight). A lightweight `tdee_estimates` table could cache computed values:

```sql
CREATE TABLE tdee_estimates (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_at date NOT NULL,
  tdee_kcal int NOT NULL,
  confidence text,   -- 'low' (<4 weeks data), 'medium', 'high'
  PRIMARY KEY(user_id, estimated_at)
);
```

**Effort:** 3–4 days. High strategic value — makes the nutrition layer genuinely adaptive.

---

### Idea 3 — Workout Session Debrief (RPE + Session Notes)

**The gap:** After a workout is completed there's no moment to reflect. RPE (Rate of Perceived Exertion) — how hard the session actually felt on a 1–10 scale — is one of the most useful signals for readiness modelling and overtraining detection, and it's not captured at all.

**What it would do:**

- When a user taps "Finish Workout", show a brief debrief modal (3 questions, swipeable, takes 15 seconds):
  1. *How hard was that session overall?* (RPE slider 1–10)
  2. *How do you feel now?* (emoji scale: 😴 Wiped / 😐 Okay / 💪 Energised)
  3. *Any notes?* (optional free text — pre-injury, felt off, PR day, etc.)
- This data attaches to the workout record and feeds:
  - **Readiness Score** (Pillar 4): high RPE + low post-feel → lower readiness tomorrow
  - **Correlation Engine** (Pillar 1): *"Your energy is highest 24h after sessions you rated 6–7 RPE, not 9–10"*
  - **Progressive Overload** (Pillar 3): a set completed at RPE 8 is treated differently to RPE 10 — the overload algorithm can be smarter about when to progress
- Sessions with notes are surfaced in the workout history with a 📝 tag, making them searchable.

**Data model:**

```sql
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS session_rpe int CHECK (session_rpe BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS post_feel text,   -- 'wiped', 'okay', 'energised'
  ADD COLUMN IF NOT EXISTS session_notes text;
```

**Effort:** 1 day. Tiny lift, big downstream value for every intelligence feature.

---

### Idea 4 — Menstrual Cycle Phase Optimisation

**The gap:** Cycle tracking is already in the app (and currently defaults to on, which the Quick Wins appendix flags as a bug). But the feature does nothing with the data. Research consistently shows that hormonal phases materially affect strength, energy, recovery, and nutrition needs — and nearly every fitness app ignores this entirely.

**What it would do:**

- **Phase detection:** From the cycle tracking start date + average cycle length, calculate the user's current phase: Menstrual (days 1–5), Follicular (days 6–13), Ovulatory (days 14–16), Luteal (days 17–28).
- **Phase-aware coaching overlay:** A subtle banner or chip on the dashboard and in the workout view: *"Follicular phase — estrogen is rising. This is your strongest week. Good time to push intensity and try for PRs."*
- **Adjusted recommendations per phase:**
  - Follicular: Higher carb targets, strength-focus workouts, increase progressive overload
  - Ovulatory: Peak strength window, high-intensity appropriate, watch ligament injury risk
  - Luteal: Reduce intensity 10–15%, increase protein slightly, rest more, expect energy dip late in phase
  - Menstrual: Active recovery recommended, heat packs and gentle movement, reduce volume targets
- **Symptom correlation:** Users can log cramps, bloating, mood, and cravings. Correlation engine picks these up: *"Your energy logs are 2.1 points lower in luteal phase on average — that's hormonal, not a failure."*
- **Readiness Score adjustment:** Automatically factor in late-luteal phase as a readiness modifier (−10 to −15 points on score, with explanation).

**Data model:** No new tables if cycle data is already stored. Add phase columns:

```sql
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS cycle_phase text,  -- 'menstrual','follicular','ovulatory','luteal'
  ADD COLUMN IF NOT EXISTS cycle_symptoms text[];  -- ['cramps','bloating','mood_low','cravings']
```

**Effort:** 3–4 days. Highly differentiated — almost no consumer fitness app does this well. Strong retention signal for a large user segment.

---

### Idea 5 — Voice-First Daily Log

**The gap:** The voice spotter exists for workouts, but the daily log still requires tapping through multiple form fields. A single voice entry covering food, wellness, and activity would make logging genuinely frictionless — especially on busy mornings.

**What it would do:**

- A microphone button on the dashboard or daily log page triggers a voice session: *"Tell me about your day so far — what you ate, how you're feeling, any activity."*
- The user speaks naturally: *"Had scrambled eggs and coffee for breakfast, drank about 2 litres of water, feeling 4 out of 5 energy, slept about 7 hours, a bit stressed with work, did a 20-minute walk at lunch."*
- AI (Claude) parses the transcript and maps it to the structured log fields: food items with estimated macros, sleep hours, energy rating, stress rating, activity type and duration.
- A **confirmation screen** shows the mapped values before saving — the user can tap individual fields to adjust anything. One-tap confirm saves the whole log.
- Works entirely within the existing log data model. No new tables.

**Implementation:** The same `process-intent` API route likely handles some of this already. Extension of existing patterns.

**Effort:** 2–3 days. Dramatically reduces daily friction, especially for mobile users.

---

### Idea 6 — Training Load Analytics (Fitness-Fatigue Model)

**The gap:** The app tracks individual workouts but has no view of cumulative training load over time. Serious athletes — runners, cyclists, lifters — use training load curves to balance fitness-building stress against fatigue and injury risk. No consumer app surfaces this in an approachable way.

**What it would do:**

- **Three metrics, calculated from workout history:**
  - **ATL (Acute Training Load)** — 7-day exponentially weighted average of daily training stress. Represents current fatigue.
  - **CTL (Chronic Training Load)** — 42-day exponentially weighted average. Represents accumulated fitness.
  - **TSB (Training Stress Balance)** — CTL minus ATL. Positive = fresh/undertrained, negative = fatigued/overtrained.
- **Training Load Chart:** A line chart in the Trends section showing all three metrics over 6 or 12 weeks. The shape tells the user whether they're building fitness sensibly or digging a hole.
- **Plain-language interpretation:** Instead of showing raw numbers, translate: *"You've been building hard for 6 weeks (CTL trending up). Fatigue is high (ATL spike this week). TSB is −18 — you're in a training hole. Consider a 5-day deload."*
- **Training Stress Score (TSS) per workout:** Calculated from duration × intensity (RPE or heart rate zone if wearable data exists). This is why Idea 3 (RPE Debrief) is a prerequisite.

**Data model:**

```sql
CREATE TABLE training_load_history (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  daily_tss numeric NOT NULL,
  atl numeric NOT NULL,
  ctl numeric NOT NULL,
  tsb numeric NOT NULL,
  PRIMARY KEY(user_id, date)
);
```

**Effort:** 3–4 days. Niche but creates a very defensible moat with serious athletes. Pairs naturally with Pillar 3 (Periodisation) and Pillar 4 (Readiness).

---

### Idea 7 — Supplement Stack Tracker

**The gap:** Many active users take supplements — creatine, protein powder, vitamins, magnesium, pre-workout, omega-3. These have measurable effects on training performance and recovery, but no fitness app connects the dots. The habit of taking supplements is also frequently inconsistent, and there's no nudge mechanism.

**What it would do:**

- **Supplement library:** A curated list of common supplements with evidence summaries (e.g., *"Creatine: well-evidenced for strength and muscle mass. Best taken daily, timing flexible."*). Users can add custom supplements too.
- **Daily supplement log:** A quick tick-list within the daily log (or a separate widget). Log which supplements were taken and when (pre-workout, with food, before bed).
- **Reminder notifications:** Schedule supplement-specific reminders — *"Time for your creatine"* at 8am, *"Magnesium before bed"* at 9:30pm.
- **Correlation with performance:** After 4+ weeks of data, the correlation engine surfaces: *"On days you take creatine, your estimated 1RM is 3.2% higher. You've taken it 80% of days in the last month."* Or: *"Your sleep quality scores 0.6 points higher on days you take magnesium."*

**Data model:**

```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose_amount text,         -- '5g', '2 capsules', '1 scoop'
  timing text[],            -- ['pre_workout', 'with_breakfast', 'before_bed']
  reminder_times time[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES user_supplements(id),
  taken_at timestamptz DEFAULT now(),
  date date GENERATED ALWAYS AS (taken_at::date) STORED
);
```

**Effort:** 2–3 days for core; +1 day for correlation hookup. Moderate niche appeal with high retention value for the user segment that cares.

---

### Idea 8 — Body Composition Projection Tool

**The gap:** The app tracks weight and body fat over time but never extrapolates. Users regularly ask themselves *"If I keep going like this, when will I reach my goal?"* — and currently they can only guess. A projection view closes the loop between current trajectory and future state.

**What it would do:**

- On the body metrics / trends page, a **Projection Card**: *"At your current rate (−0.4kg/week), you'll reach your goal weight of 80kg in approximately 11 weeks — around September 13."*
- **Scenario sliders:** Users can adjust their calorie target or workout frequency and see the projected timeline update in real time. *"If I add one more workout per week, I could reach it in 9 weeks."*
- **Confidence band:** Show the projection as a shaded range (optimistic / expected / conservative), not a single line — this sets realistic expectations and prevents the "it said I'd be there by X and I'm not" disappointment.
- **Body fat projection:** If Withings or manual body fat data is available, project body fat % alongside weight.
- **Goal achievement moment:** When the projected date is crossed and the goal is hit (or within 1% of it), trigger a celebration — XP bonus, badge, confetti, a personalised congratulations message from the AI coach.

**Data model:** No new tables. Runs purely from `body_metrics` history and `user_settings` (goal weight).

**Effort:** 1–2 days. Pure data visualisation — no new data model, no API calls. High perceived value, straightforward to build.

---

### Idea 9 — Self-Challenge System

**The gap:** The gamification layer (streaks, XP, badges) is passive — it rewards what you're already doing. There's no mechanism for a user to set a personal challenge with a deadline: *"I want to complete 20 workouts in 30 days."* Time-bounded, self-directed challenges are one of the most effective behaviour-change tools in the literature, and they're entirely absent.

**What it would do:**

- **Challenge Builder:** A simple flow where users define:
  1. Challenge type: log streak, workout count, protein goal hit rate, step count, weight loss, or custom (free text with manual progress).
  2. Target: e.g. 20 workouts.
  3. Duration: 7 / 14 / 21 / 30 / 60 / 90 days.
  4. Optional: share with an accountability partner (who sees progress).
- **Active Challenge Dashboard widget:** A progress bar showing current status, days remaining, and daily requirement to stay on pace.
- **Milestone notifications:** Push notifications at 25%, 50%, 75%, 100% completion. *"You're halfway through your 30-workout challenge. 10 down, 10 to go."*
- **Challenge history:** A log of completed and failed challenges with completion rates — becoming a motivational record of what you've accomplished.
- **Challenge templates:** Pre-built challenges to choose from: *"75 Hard Lite"* (log every day for 75 days), *"Protein Perfectionist"* (hit protein goal for 21 straight days), *"Beginner Month"* (complete 12 workouts in 30 days).

**Data model:**

```sql
CREATE TABLE user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  challenge_type text NOT NULL,   -- 'workout_count', 'log_streak', 'protein_days', 'custom'
  target_value int NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  current_progress int DEFAULT 0,
  status text DEFAULT 'active',   -- 'active', 'completed', 'failed', 'abandoned'
  template_id text,               -- slug of the template used, if any
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 2–3 days. Extends the existing gamification system, reuses notification infrastructure, high engagement value.

---

### Idea 10 — Workout Partner Mode (Live Co-op Sessions)

**The gap:** The accountability partner feature is asynchronous — you see weekly summaries. But many people actually work out with a friend, either in person or remotely, and want real-time shared experience. A co-op workout mode would be a genuinely differentiated social feature that doesn't require a public social graph.

**What it would do:**

- **Start a shared session:** From the active workout screen, tap "Work out with someone" and share a 6-digit join code (or a link). A friend opens the app and joins. No public profiles needed.
- **Live shared view:** Both users see each other's sets logged in real time — a split panel or alternating feed. *"Alex just logged: Bench Press 3×10 @ 70kg"*
- **Encouragement reactions:** One-tap reactions (🔥 💪 👊) visible to the partner — like a private emoji cheer during the set.
- **Voice / text chat toggle (Phase 2):** Optional audio or text channel within the session. Phase 1 can be reactions-only for simplicity.
- **Shared session summary:** After both users finish, a combined summary: total volume each, who hit more PRs, any highlights. Saved to both users' history.

**Implementation notes:** Real-time sync requires Supabase Realtime (already available) with a `workout_sessions` live channel. The join code maps to a session ID. This is feasible without any third-party real-time infrastructure.

**Effort:** 3–5 days. The most complex idea in this brainstorm, but a very compelling differentiator. Worth a dedicated sprint once the solo-user features are solid.

---

## Updated Prioritisation Matrix

*Includes new ideas from the June 2026 brainstorm. All six original pillars remain valid; this extends the candidate list.*

| Feature | Impact | Effort | Priority Score | Notes |
|---|---|---|---|---|
| **Quick Wins (bugs)** | Medium | Very Low | ★★★★★ | Ship continuously |
| **Goal Wizard entry point** | Medium | Very Low | ★★★★★ | Already built, just needs a link |
| **Readiness Score (standalone UI)** | Very High | Low | ★★★★☆ | Oura data exists, just needs the score widget |
| **Correlation Engine** | Very High | Medium | ★★★★☆ | Data exists, logic is the work |
| **Progressive Overload Alerts** | High | Low | ★★★★☆ | Active workout is the right place |
| **PR Hall of Fame + Live Celebrations** | High | Very Low | ★★★★☆ | High delight, trivial data model |
| **Workout Session Debrief (RPE)** | High | Very Low | ★★★★☆ | Unlocks readiness + overload accuracy |
| **Body Composition Projection** | High | Low | ★★★★☆ | No new infra, pure visualisation |
| **Voice-First Daily Log** | High | Low | ★★★☆☆ | Extends existing voice/AI infra |
| **TDEE Learning Engine** | Very High | Medium | ★★★☆☆ | Makes nutrition adaptive |
| **Self-Challenge System** | High | Medium | ★★★☆☆ | Extends gamification layer |
| **Menstrual Cycle Optimisation** | Very High | Medium | ★★★☆☆ | Infra exists; high differentiation |
| **Supplement Stack Tracker** | Medium | Medium | ★★★☆☆ | Niche but sticky |
| **Training Load Analytics (ATL/CTL)** | High | Medium | ★★★☆☆ | Requires RPE debrief as prereq |
| **Accountability partners (full)** | Very High | Medium | ★★★☆☆ | Core features built; enhancements TBD |
| **Nutrition Planning (full planner)** | High | Medium | ★★★☆☆ | MVP already shipped |
| **Group Challenges** | Medium | Medium | ★★☆☆☆ | Social features are risky; do self-challenges first |
| **Workout Partner Mode (co-op)** | High | High | ★★☆☆☆ | Differentiator; complex; future sprint |
| **Withings / Oura (enhancements)** | High | Low | ★★★☆☆ | Already live; surface data more in UI |
| **Apple Health / Google Fit** | Very High | Very High | ★★☆☆☆ | Requires native app shell |

---

## Recommended Next Sprint (July 2026)

Based on what's outstanding and the updated candidate list, the highest-ROI sprint is:

1. **Quick Win bugs** (1–2 days) — Goal Wizard entry point, cycle tracking default off, browser confirm dialogs replaced
2. **Workout Session Debrief / RPE** (1 day) — unlocks accuracy of everything downstream
3. **PR Hall of Fame + Live PR detection** (1–2 days) — high delight, nearly free
4. **Readiness Score standalone UI** (2–3 days) — Oura data already flows in, just needs the score widget and dashboard card
5. **Body Composition Projection** (1–2 days) — pure visualisation, no new infra

Total estimated effort: 6–10 days. Delivers a meaningfully smarter, more motivating app with no new data infrastructure required.

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
