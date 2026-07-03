# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
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
| Streaks & XP gamification | ✅ 15 badges, level system, streak-type selector |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, Supabase-persisted across devices |
| Push notifications | ✅ Server-side + native FCM, custom reminders |
| Native iOS & Android apps | ✅ Capacitor shell (remote URL), haptics, splash, push |
| Strava / Withings / Oura sync | ✅ OAuth-connected, consolidated in Settings |
| 12-Week AI Training Programs | ✅ Shipped — periodisation, 1RM tracking, PR toasts |
| AI Nutrition Planner & Saved Meals | ✅ Shipped — Pantry, weekly plan, photo/voice pantry scan |
| Goal Wizard | ✅ Entry point live in Settings |
| Progress photos & body metrics | ✅ Upload + compare, kg/lbs toggle |
| Accountability partners | 🟡 Partner invites + weekly summary email shipped; no in-app partner view or streak-shield nudge |
| Group challenges | 🔴 Not started |
| Correlation Engine & Insight Feed | 🔴 Not started |
| Recovery / Readiness Score | 🔴 Not started (Oura's own readiness syncs in, but isn't surfaced as an app-native score/explanation) |
| Apple Health / Google Fit | 🔴 Not started — now more feasible since a native shell already exists |

*(See CHANGELOG.md 1.1.0–2.0.0 for the full record of what's shipped since this PRD's original date.)*

---

## Status Check — 2026-07-03

Since this document was drafted, four of the six original pillars have shipped in whole or in part: 12-Week Training Programs (Pillar 3), full Nutrition Planning (Pillar 2), Strava/Withings/Oura integrations (Pillar 6, minus Apple/Google), and Accountability Partners (Pillar 5, minus group challenges and the in-app partner dashboard). Nearly all of the Quick Wins list has also landed. The app additionally grew native iOS/Android shells via Capacitor, which changes the calculus on a couple of remaining items below.

**What's still outstanding, in priority order:**

1. **Correlation Engine & Insight Feed (Pillar 1)** — still not built, and still the single highest-leverage remaining item. Every variable it needs (sleep, energy, stress, alcohol, protein, movement) has been flowing into `daily_logs` since v1.0. This is unclaimed value sitting on data already collected, with no new UI for users to learn.
2. **Recovery & Readiness Score (Pillar 4)** — still not built. Oura's raw readiness number syncs in, but there's no app-computed score, plain-English explanation, or training recommendation. It's arguably higher-value now than when drafted: the 12-Week Programs feature that shipped since has no mechanism to adapt day-to-day intensity, and a readiness score is the natural input for that.
3. **Group Challenges** — the unbuilt half of Pillar 5. Partner invites and weekly emails work; the shared-leaderboard, opt-in group mechanic hasn't been touched.
4. **Apple Health / Google Fit** — originally scored "Very Low feasibility" because it required a native shell that didn't exist. That shell now exists (Capacitor apps shipped in 2.0.0), so this should be re-scored upward — it's now HealthKit/Health Connect plugin wiring inside an existing native app, not a from-scratch native build.

**Recommendation:** tackle the Correlation Engine next. It's backend/AI work against data already captured, ships without asking users to learn anything new, and it compounds the value of nutrition planning, training programs, and readiness once each of those exists.

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

## Part 2 — New Feature Brainstorm (2026-07-03)

The six pillars above were the "close the obvious gaps" list. With four of them substantially shipped, here are eight new ideas that weren't in the original document — things that occurred to me looking at what the app has become rather than what it was missing. These are lighter-weight sketches than the original pillars: enough to evaluate, not full specs. Pick whichever land and I'll flesh them out properly before building anything.

---

### Pillar 7 — Wearable & Home Screen Presence

**Problem:** The app now ships as real native iOS/Android apps (Capacitor), but it still behaves like a website wrapped in a shell — no widgets, no watch presence, no way to see your streak or next workout without opening the app.

**What it does:**
- **Home screen widgets** (iOS WidgetKit / Android App Widgets): today's streak, ring progress for calories/protein, next scheduled workout. Small, medium, and lock-screen sizes.
- **Apple Watch companion**: a simple watch face complication showing readiness/streak, and a "log workout" watch app that writes sets/reps back via Capacitor bridge.
- **Siri Shortcuts / Google Assistant actions**: "Hey Siri, log my weight" or "log breakfast" opens straight into the right log tab.

**Why it matters:** Every one of these removes a step between "I want to log something" and "it's logged." Widgets alone are known to meaningfully lift daily-active-use in habit apps, and it's now buildable without a new app shell — the native wrapper already exists.

**Rough effort:** Widgets: medium (native code per platform, but no new backend). Watch app: high. Shortcuts: low.

---

### Pillar 8 — Endurance & Race Training Plans

**Problem:** The 12-Week AI Training Program engine (shipped) is built around strength/hypertrophy periodisation — sets, reps, load. There's no equivalent for runners, cyclists, or hybrid athletes training toward a race date rather than a rep max.

**What it does:**
- User picks a goal race (5K / 10K / Half / Marathon / triathlon) and a target date; AI generates a periodised plan (base → build → peak → taper) with pace zones instead of load %.
- Pulls actual pace/HR from Strava-synced runs (already connected) to calibrate zones instead of asking the user to self-report fitness.
- Reuses the existing `training_programs` table shape — this is a new `program_type` ('strength' | 'endurance') with a different weekly-plan generator, not a parallel system.

**Why it matters:** A meaningful slice of users log runs/rides via Strava sync today but get nothing structured back — the app currently only "coaches" the lifting half of fitness.

**Rough effort:** Medium — mostly a new prompt/generator against infrastructure that already exists (programs table, Strava data, calendar view).

---

### Pillar 9 — Restaurant & Menu Macro Lookup

**Problem:** AI photo/voice food logging works well for home cooking, but eating out is still a guessing game — "chicken burrito bowl, medium" logged from memory is often wildly off, and it's one of the top reasons people abandon nutrition tracking.

**What it does:**
- Search or scan a restaurant menu (photo of a physical menu, or a name lookup) and get AI-estimated macros per item before ordering, with a confidence indicator.
- One-tap log directly from the lookup result.
- Builds a personal cache of "usual orders" per restaurant so repeat visits get instant, increasingly accurate estimates (first visit is a guess; by the third visit it's closer to a saved meal).

**Why it matters:** This is squarely the moment nutrition tracking usually breaks down. Solving it well would differentiate this app from every calorie counter that just eats the "restaurant food" excuse.

**Rough effort:** Medium-high — needs a menu-photo AI pipeline and a small new cache table; can start with text search only (no photo) as a cheaper v1.

---

### Pillar 10 — Cycle-Aware Training & Nutrition

**Problem:** Cycle tracking already exists (`enable_cycle_tracking`, off by default, visible on Trends) but it's purely observational — it's charted, not acted on. Once the Readiness Score (Pillar 4) and Nutrition Planning both exist, cycle phase is a strong, evidence-backed input neither currently uses.

**What it does:**
- Feed cycle phase into the Readiness Score as an additional signal (e.g. lower luteal-phase readiness weighting, or simply surface it in the AI explanation rather than scoring against it).
- Nutrition planner nudges: slightly higher iron-rich food suggestions and calorie awareness during menstruation, per standard sports-nutrition guidance.
- Training program adjusts suggested intensity/deload timing around cycle phase if the user opts in.

**Why it matters:** Low build cost (the data already exists and is already off-by-default/opt-in), but meaningfully improves accuracy of two other flagship features for users who enable it. This is a "wire together things we already have" feature, not a new subsystem.

**Rough effort:** Low, but depends on Readiness Score (Pillar 4) shipping first.

---

### Pillar 11 — Year in Review

**Problem:** The app now holds over a year of rich, personal data (streaks, workouts, PRs, weight trend, badges) and none of it is ever presented back as a single satisfying artifact. Spotify Wrapped-style annual recaps are one of the most effective, lowest-cost retention and organic-growth mechanics in consumer apps.

**What it does:**
- An annual (or "your year so far") generated summary: total workouts, heaviest lift progress, longest streak, favourite meal, best/worst month for consistency, total XP earned, a few AI-written highlight lines.
- Rendered as a shareable card sequence (reuses the existing shareable level-card infra from gamification) — exportable as an image for social sharing.
- Could ship as a simple "Recap" page callable any time, not just at year-end, using a rolling 12-month window.

**Why it matters:** Pure delight feature with a viral/sharing angle, and technically cheap — it's a read-only aggregation over data and infrastructure (shareable cards) that already exist.

**Rough effort:** Low-medium.

---

### Pillar 12 — Personal AI Calibration for Food Logging

**Problem:** AI photo food logging is a headline feature, but its accuracy is fixed at "generically good" — it doesn't learn that *this* user's "large" protein shake is always 40g protein, or that their go-to lunch salad reliably comes in 100 calories lighter than the AI's first guess.

**What it does:**
- After AI estimates a meal's macros, let the user do a lightweight correction ("actually ~450 cal, not 520") instead of ignoring it or re-logging manually.
- Store corrections; when a very similar food/photo is logged again, bias the AI's estimate toward the user's own correction history for that food rather than the generic estimate.
- Surface it passively — no new UI screen, just a "was this right?" thumbs affordance on the existing log confirmation step.

**Why it matters:** Compounding accuracy is a strong differentiator and increases trust in the AI logging flow specifically, which is the feature most likely to make or break whether nutrition data (feeding Pillars 1, 2, and 4) is trustworthy in the first place.

**Rough effort:** Medium — needs a small corrections table and a retrieval step in the existing food-logging prompt, no new page.

---

### Pillar 13 — Injury / Pain Log & Smart Substitutions

**Problem:** The Progressive Overload engine (shipped) will happily suggest "add 2.5kg" to someone with a tweaked shoulder. There's no way to tell the app "my knee hurts" and have that change anything about today's suggested workout.

**What it does:**
- A quick, optional "anything hurt today?" tag on the daily log (body area + severity 1–3), separate from general wellness fields.
- When active, the workout suggestion / progressive-overload engine swaps or de-loads exercises that load the flagged area (using the same muscle-group mapping already built for the Volume Tracking Dashboard) and flags it in-session: *"Skipping barbell squat — knee flagged Tuesday. Try leg press at reduced load instead."*
- Simple rehab nudges (mobility work suggestions) rather than medical advice — clearly scoped as "train around it," not diagnosis.

**Why it matters:** Training through pain is the single biggest cause of long-term attrition in strength apps. This reuses the exercise/muscle-group data model already built for Pillar 3 rather than inventing a new one.

**Rough effort:** Medium — mostly logic against existing exercise metadata plus one new log field.

---

### Pillar 14 — Full Data Export & Account Portability

**Problem:** As the app accumulates more of a user's health picture (workouts, nutrition, body comp, sleep, integrations), the absence of a "get all my data out" option becomes a bigger trust liability, and it's the kind of thing worth having *before* it's asked for rather than after.

**What it does:**
- A Settings → "Export my data" action that generates a downloadable archive (CSV per table, or one combined JSON) of everything: daily logs, workouts, body metrics, programs, saved meals.
- Optional: a clean PDF "training log" export for a date range, useful for sharing with an actual coach or physio.

**Why it matters:** Low glamour, but it's the right kind of feature to ship proactively — good practice, low cost, and removes a real objection some users have to logging sensitive health data into any app.

**Rough effort:** Low.

---

## Updated Prioritisation Note

Combining what's left of the original six pillars with this new list, if I were sequencing the next stretch of work:

| Item | Why it's near the top |
|---|---|
| Correlation Engine (Pillar 1) | Highest-leverage unclaimed value; data already exists |
| Readiness Score (Pillar 4) | Unlocks Pillar 10 (cycle-aware training) and makes 12-Week Programs adaptive |
| Year in Review (Pillar 11) | Cheap, high-delight, reuses existing shareable-card infra |
| Personal AI Calibration (Pillar 12) | Strengthens trust in the flagship AI logging feature |
| Data Export (Pillar 14) | Cheap, proactive trust-builder |
| Apple Health / Google Fit | Re-scored upward now that a native shell exists |
| Endurance Training Plans (Pillar 8) | Serves the "cardio half" of users currently underserved |
| Widgets & Watch (Pillar 7) | High native-dev cost but strong habit-loop payoff |
| Restaurant Lookup (Pillar 9) | Solves a real churn point, but higher build cost |
| Group Challenges | Medium value, no dependency blocking it |
| Injury Log & Substitutions (Pillar 13) | Valuable but lower urgency than the above |
| Cycle-Aware Nutrition (Pillar 10) | Blocked on Readiness Score shipping first |

This is a starting opinion, not a final ranking — flag anything you'd move.

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

*Document ends. Original pillars (2026-05-20), status check and new feature brainstorm added 2026-07-03. Questions, pushback, or additions — flag them and I'll revise.*
