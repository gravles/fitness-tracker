# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-13  
**Status:** Living document — updated to reflect shipped work and new ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (Updated 2026-06-13)

Most original PRD pillars have shipped. The table below reflects the actual state of the app as of the latest release.

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ AI-assisted, voice + camera entry |
| Barcode scanner (food logging) | ✅ Shipped v1.1 |
| Food camera / meal recognition | ✅ Shipped v1.0 |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Rest timer in active workout | ✅ Configurable, shipped v1.1 |
| Streaks & XP gamification | ✅ Badges, levels, trophy case, shareable cards |
| Trends & analytics | ✅ Weight, nutrition, activity, body composition |
| AI coaching chat | ✅ Supabase-persisted, cross-device |
| Smart Coach daily tips | ✅ Context-aware |
| AI Weekly Insights | ✅ Shipped v1.1 |
| Push notifications | ✅ FCM (Android) + VAPID (web), scheduling reminders |
| Strava sync | ✅ OAuth + auto-sync |
| Withings integration | ✅ OAuth + body composition sync |
| Oura integration | ✅ OAuth + readiness/activity sync |
| Goal Wizard | ✅ Shipped (entry point added) |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Full tab with weight chart, metric/imperial toggle |
| Saved Meals | ✅ Multi-food bundles, one-tap re-log |
| AI Nutrition Planner | ✅ Today/This Week/Pantry tabs, meal plan generation |
| Smart Pantry Population | ✅ Photo scan + voice dictation |
| 12-Week AI Training Programs | ✅ Periodised, phase-based, 1RM-derived weights, PR toasts |
| Progressive overload targets | ✅ Built into 12-week program sessions |
| Accountability Partners | ✅ Email summaries via Resend |
| Group Challenges | 🔴 Not started |
| Correlation Engine & Insight Feed | 🔴 Not started |
| Native iOS app | ✅ Capacitor, App Store |
| Native Android app | ✅ Capacitor, Play Store |
| iCal calendar feed | ✅ Subscribable webcal:// feed |
| Dark / Light / System theme | ✅ Full coverage |
| Onboarding flow | ✅ Name, DOB, height, weight, goal |
| Heart rate zone analysis | 🔴 Not started |
| Muscle balance heatmap | 🔴 Not started (muscleMapping.ts exists) |
| Hydration tracking | 🔴 Not started |
| Supplement tracker | 🔴 Not started |
| Quarterly AI review | 🔴 Not started |
| Apple Health / Google Fit | 🔴 Future (native bridge required) |

---

## Feature Pillars

### Original Six (status as of 2026-06-13)

1. **Correlation Engine & Insight Feed** — surface *why* you feel good or bad — 🔴 **Not yet built**
2. **Intelligent Nutrition Planning** — close the loop from tracking to planning — ✅ **Shipped v1.3**
3. **Periodisation & Progressive Overload** — turn workout history into a training program — ✅ **Shipped v1.5**
4. **Recovery & Readiness Score** — a daily signal that answers "should I train hard today?" — ⚠️ **Partial** (Oura readiness synced, but no native calculated score or dashboard card)
5. **Accountability Layer** — gentle social pressure without the social media toxicity — ⚠️ **Partial** (partners + email summary built; group challenges not started)
6. **Health Platform Integrations** — Apple Health, Google Fit, Oura, Withings — ⚠️ **Partial** (Oura + Withings done; Apple Health / Google Fit require native bridge)

### New Pillars (proposed 2026-06-13)

7. **Muscle Balance & Injury Prevention Heatmap** — visualise training imbalances before they become injuries
8. **Heart Rate Zone & Cardio Analytics** — zone-based training intelligence for runners and cardio-focused users
9. **Hydration, Supplements & Micro-habit Stack** — capture the small daily habits that compound into results
10. **Quarterly AI Review & Long-term Memory** — extend the AI coaching lens from 30 days to a full quarter

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

---

---

## Pillar 7 — Muscle Balance & Injury Prevention Heatmap

### The Problem

The app has `muscleMapping.ts` and records every exercise, but none of this data is surfaced visually. The result: users unknowingly train the same muscles repeatedly (chest, quads, biceps) while neglecting opposing groups (upper back, hamstrings, triceps). Muscle imbalances are the single most common cause of non-contact sports injury, and no popular fitness app surfaces this clearly.

### What It Does

**Interactive Body Heatmap**
A front/back silhouette of the human body, where each major muscle group is colour-coded by recency of training:
- Green: trained in the last 3 days
- Yellow: last trained 4–7 days ago
- Orange: last trained 8–14 days ago
- Red: not trained in 15+ days (or never)

Tapping any muscle group shows: last trained date, total sets this week, recommended frequency (based on training goal).

**Imbalance Alerts**
The system computes push:pull ratio (chest/shoulders/triceps volume vs. back/rear delts/biceps), quad:hamstring ratio, and left:right symmetry if exercises track laterality. If the ratio falls outside a configurable threshold:
- *"You've done 4× as much chest work as back work this month. This loading pattern is a common driver of shoulder impingement."*

**Weekly Muscle Coverage Summary**
A compact summary on the dashboard (or weekly insights modal): "This week you trained chest, quads, and biceps well. Upper back, hamstrings, and glutes are underserved."

**Gap-filling Exercise Suggestions**
When a muscle group is red (neglected), the heatmap card offers 3 exercise suggestions that target it using the user's available equipment — pulled from the existing exercise library.

### Data Requirements

No new tables. `muscleMapping.ts` already maps exercise names to muscle groups. The heatmap engine reads from `workout_exercises` (joined with `workouts`) over a rolling 28-day window, aggregates sets per muscle group, and computes the colour tier. Computations can run client-side on the existing data.

### UI Sketch

```
┌────────────────────────────────────────────┐
│  💪 Muscle Coverage — This Week            │
│                                            │
│  [Front body diagram]  [Back body diagram] │
│   chest ████ 12 sets   back  ██ 4 sets     │
│   quads ███  9 sets    hams  ░░ 0 sets ⚠️  │
│                                            │
│  ⚠️ Hamstrings untrained for 11 days      │
│  Try: Romanian Deadlift, Leg Curl          │
└────────────────────────────────────────────┘
```

### Why This Matters

This is a rare feature that is both easy to build (data already exists) and has genuine health implications — not just aesthetics. It differentiates the app from programs that give you workouts without caring whether you're creating imbalances. The visual format makes abstract data instantly actionable.

---

---

## Pillar 8 — Heart Rate Zone & Cardio Analytics

### The Problem

Zone 2 training (low-intensity aerobic work) has become the dominant framework for cardiovascular health, driven by researchers like Iñigo San Millán and popularised by Peter Attia. But almost no consumer fitness app tracks zone distribution well. Strava shows average HR; Garmin keeps it in its own ecosystem. This app already has Strava sync (with HR data in the activity payload) and Oura (with resting HR and HRV). The data is there — it just isn't being used.

### What It Does

**HR Zone Configuration**
User sets their max HR (or uses the 220-minus-age default), which defines 5 training zones:
- Zone 1: 50–60% HRmax (recovery)
- Zone 2: 60–70% HRmax (aerobic base)
- Zone 3: 70–80% HRmax (aerobic threshold)
- Zone 4: 80–90% HRmax (lactate threshold)
- Zone 5: 90–100% HRmax (neuromuscular / VO2 max)

Alternatively, users can set a lactate threshold HR directly for a more accurate zone split.

**Per-Session Zone Breakdown**
After syncing a Strava run, cycle, or row, the activity detail view shows a stacked bar: time spent in each zone. This already exists in the Strava payload as `heart_rate_zones` for most Garmin/Apple Watch recorded activities.

**Weekly Zone Distribution Chart**
A stacked bar chart on the Trends page (or a new Cardio tab) showing how total weekly cardio time is split across zones. Most users will see they're spending everything in zone 3 (the "grey zone" — too hard to be truly aerobic, too easy to be high-intensity).

**Zone 2 Deficit Alert**
If the user hasn't accumulated 45+ minutes of zone 2 work in 7 days, a dashboard alert fires: *"You're light on zone 2 this week. A 45-minute easy run or bike ride would pay dividends for your aerobic base."*

**VO2 Max Estimate**
Using the Jack Daniels VDOT formula (pace + distance) or Cooper test estimate, calculate a VO2 max approximation from run data. Track this over time as a key cardio fitness metric. Show the user their estimated "cardio age" compared to population norms for their age and sex.

**Resting HR & HRV Trend**
From Oura data (already synced), plot resting HR and HRV over time. These are the two best non-invasive markers of cardiovascular fitness and recovery capacity. Show whether they're trending in the right direction relative to training load.

### Data Requirements

Most data is already in the Strava sync payload. A new `cardio_sessions` view or derived table may be useful for cleaner querying, but it could also run on top of existing `workouts` data.

```sql
-- HR zone summary (derived from Strava activity payload)
CREATE TABLE hr_zone_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE,
  date date NOT NULL,
  zone1_minutes int DEFAULT 0,
  zone2_minutes int DEFAULT 0,
  zone3_minutes int DEFAULT 0,
  zone4_minutes int DEFAULT 0,
  zone5_minutes int DEFAULT 0,
  avg_hr int,
  max_hr int,
  source text DEFAULT 'strava'  -- 'strava', 'apple_health', 'manual'
);

-- VO2 max estimates (calculated, not user-entered)
CREATE TABLE vo2max_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_vo2max numeric NOT NULL,
  method text NOT NULL,      -- 'vdot', 'cooper', 'oura'
  source_workout_id uuid,
  estimated_at timestamptz DEFAULT now()
);
```

### Why This Matters

Zone 2 training is the fastest-growing trend in performance and longevity fitness. Users who are aware of their zone distribution change their training. This feature makes the app essential for anyone doing structured cardio — a large but currently underserved segment.

---

---

## Pillar 9 — Hydration, Supplements & Micro-habit Stack

### The Problem

The app captures big health behaviours (food, exercise, sleep) but misses three smaller-but-compounding daily habits that serious health optimisers care about: hydration, supplementation, and micro-habits (small anchored routines like morning mobility or evening wind-down). These are low-effort to track but high-impact for retention — they give users reasons to open the app multiple times per day.

### What It Does

**Hydration Tracker**
A simple water intake counter in the daily log, below the food section:
- Default goal: 2.5L/day (adjustable in settings)
- Quick-add buttons: +250ml (glass), +500ml (bottle), +custom
- Dynamic target: increases on workout days (+500ml) and could factor in temperature if device location is enabled
- Daily progress bar + streak for hitting hydration goal
- Feeds into the Correlation Engine: hydration level correlates with energy, sleep, and next-day workout performance

```sql
-- Extend daily_logs with hydration field
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_ml int DEFAULT 0;
```

(Or a separate `hydration_entries` table for intra-day precision, but the daily total on `daily_logs` is the minimum viable version.)

**Supplement Stack Tracker**
Users define their personal supplement stack in Settings → Supplements:
- Name (e.g., "Creatine"), dosage (5g), timing (morning / pre-workout / post-workout / evening)
- Each supplement appears as a checkbox in the daily log
- Consistency tracking: "You've taken creatine 22/30 days this month"
- Smart Coach awareness: the coach knows what supplements the user takes and can factor them in ("You've been consistent with creatine — are you noticing the strength improvements?")
- Optional: correlate supplement adherence with workout performance via the insight engine

```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  timing text[],  -- ['morning', 'pre_workout', 'post_workout', 'evening']
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS supplements_taken text[] DEFAULT '{}';
```

**Micro-habit Stack**
Users define up to 5 micro-habits anchored to existing routines:
- *"After I log breakfast → 10 minutes of mobility"*
- *"Before bed → 5-minute journaling / gratitude"*
- *"After workout → cold shower"*

These appear as a compact checklist on the daily log (collapsible). Each completion earns a small XP bonus. The habits aren't coached or scored — they're lightweight enough that users don't feel pressure, which is key to long-term adherence.

```sql
CREATE TABLE micro_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  anchor text,           -- 'after_breakfast', 'before_bed', 'post_workout', etc.
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS micro_habits_done text[] DEFAULT '{}';
```

### Implementation Notes

- Hydration and supplements both fit neatly into the existing DailyLogForm component — they're just new sections, not a new page.
- The micro-habit list is fully user-defined — the app doesn't prescribe habits, it just tracks whatever the user sets. This avoids the "another app telling me what to do" backlash.
- Supplement awareness in the AI coaching prompt: append a short supplement context block to the Smart Coach system prompt (same pattern as existing dietary tracking context).

### Why This Matters

Hydration is universally agreed to matter, under-tracked, and trivially easy to add. Supplement tracking fills a real gap for the app's most health-conscious users. Micro-habits increase daily active sessions (opening the app 2-3× per day vs. once), which is the single strongest signal of retention. Together these three features cost roughly a week of development but deliver disproportionate engagement.

---

---

## Pillar 10 — Quarterly AI Review & Long-term Memory

### The Problem

Behaviour change is slow. The app's AI coach has a 30-day context window, which is enough to notice weekly patterns but not long enough to see seasonal trends, plateaus, or genuine progress arcs. A user who has been using the app for 6 months has an enormous amount of data — but they receive the same daily tips as a user on day 3. The 30-day window also means the coach "forgets" major life events (injury, illness, holiday) that explained a dip months ago.

This pillar gives the AI a longer lens and the user a richer narrative of their own progress.

### What It Does

**Quarterly Report Card (auto-generated every 90 days)**
A full-screen "season review" modal that appears ~90 days after account creation (and every 90 days thereafter). It contains:
- Goal vs. actual: how the user did against their stated goals (protein target hit %, workouts completed vs. planned, weight trend vs. target)
- Top 3 wins: the biggest positive changes vs. last quarter
- Top 3 friction points: where the user struggled (e.g., "You miss logging on weekends 70% of the time", "Your alcohol intake spikes in weeks where your sleep quality drops first")
- AI recommendation: one suggested goal adjustment with a one-tap "Update my goals" button
- Shareable highlight card (same design language as the level card)

**Life Events Log**
Users can mark significant events that explain performance context:
- Started new job / changed schedule
- Illness or injury (with optional body part)
- Travel / holiday
- Major stress event

These events are stored and appear in the AI coach's system prompt as context, so the coach can say: *"Your training dropped in February — that was during your recovery from the knee issue you flagged. Your return to full volume in March was well-managed."*

```sql
CREATE TABLE life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,   -- 'illness', 'injury', 'travel', 'job_change', 'other'
  description text,
  body_part text,             -- for injury events
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz DEFAULT now()
);
```

**AI Coaching Memory Layer**
A `coaching_memory` table stores persistent facts the coach has "learned" about the user — separate from the rolling chat history:
- Recurring patterns ("user misses weekends")
- Preferences ("user dislikes HIIT, prefers steady cardio")
- Historical context ("had knee injury in Feb 2026")
- Long-running goals ("wants to run a half marathon by Dec 2026")

These are generated by a summarisation pass over the past 90 days and injected into every future coaching session as a compact context block — keeping the token footprint small while giving the coach genuine long-term awareness.

```sql
CREATE TABLE coaching_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,  -- 'pattern', 'preference', 'history', 'goal'
  content text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,    -- null = permanent
  source text                 -- 'auto_quarterly', 'user_flagged', 'coach_inference'
);
```

**Annual Health Recap ("Year in Review")**
Once a year (or on the app's anniversary), generate a polished summary:
- Total workouts, sets, reps
- Total protein consumed, calories logged
- Longest streak, total XP, level progression
- Best lifts vs. starting lifts
- Body composition change
- Most-used exercises, most-logged foods

Presented as a swipeable card story (similar to Spotify Wrapped). Shareable as a single image.

### AI Implementation

The quarterly review is generated by a single Claude call with a structured prompt:

```
System: You are a personal health coach reviewing the past 90 days for a user.
Here is their data summary:
- Goal: {stated_goal}
- Logging consistency: {days_logged}/{days_in_period}
- Nutrition: protein target hit {pct}% of days; avg daily: {avg_cal} kcal / {avg_protein}g protein
- Workouts: {workouts_completed} completed, {workouts_planned} planned ({adherence_pct}% adherence)
- Body: weight change {delta_kg}kg; body fat change {delta_fat_pct}% (if available)
- Sleep: average quality {avg_sleep}/5
- Life events: {life_events_summary}

Produce a quarterly review with: 3 specific wins, 3 specific friction points, and 1 concrete goal recommendation.
Be specific with numbers. Avoid generic encouragement. Max 300 words total.
```

The output is stored in a new `quarterly_reviews` table and displayed in the review modal — no re-generation on every view.

### Why This Matters

Users who see genuine long-term progress stay. The 90-day review is the feature that makes a user think *"this app actually knows me"* — not just today's macros but their whole health arc. It's also the most powerful retention mechanism at the 3-month mark, which is precisely when most fitness app users churn. The life events feature adds a layer of empathy that no competitor has — the app acknowledges that life is complicated and adjusts its expectations accordingly.

---

---

## Quick Wins Appendix

These are bugs or small features that could each ship in a day or less. Not a pillar, but worth doing.

### Bugs to Fix

| Issue | Status | Fix |
|---|---|---|
| `/workout/builder` dead link in AI Coach | ✅ Fixed | Change redirect to `/schedule?tab=templates` |
| Help page uses hardcoded Tailwind grey classes (broken dark mode) | ✅ Fixed (dark mode shipped v2.0) | Replace with CSS custom properties |
| Streak counts only `movement_completed`, not nutrition logs | ❓ Check | Add a `getStreak(mode: 'movement' \| 'log')` variant; let user choose streak type in settings |
| `WorkoutChatModal` vs `/coach` overlap and confusion | ❓ Check | Add a tooltip/label distinguishing them: "Quick log" vs "Full coaching session" |
| Body metrics photo = URL text field | ✅ Fixed (Progress Photos shipped v1.2) | Replace with real Supabase Storage upload |
| Active workout uses browser `confirm()` dialogs | ❓ Check | Replace with the app's existing modal pattern |
| Workout Spotter fails silently on Firefox | ❓ Check | Show a browser compatibility warning |
| Cycle tracking is on by default | ❓ Check | Default `enable_cycle_tracking` to false, prompt at onboarding |

### Original Small Features (status)

| Feature | Status | Notes |
|---|---|---|
| Goal Wizard entry point | ✅ Shipped | Entry point added |
| Unit preference (kg/lbs) | ✅ Shipped v1.4 | Metric/imperial toggle live |
| Saved Meals | ✅ Shipped v1.2 | Full multi-food bundles |
| Log reminder smart skip | ❓ Check | Skip if already logged today |
| Streak type selector | ❓ Check | Any log vs. movement only |
| Equipment quick-pick expansion | ❓ Check | Barbell, Cable Machine, TRX, etc. |
| XP exponential curve | ❓ Check | `xpForLevel(n) = 100 * (1.15^n)` |
| Autosave indicator | ❓ Check | "Saved ✓" pulse in DailyLogForm |
| Persistent macro summary bar | ❓ Check | Sticky P/C/F/Cal bar across log tabs |
| Coach chat history sync | ✅ Shipped v1.2 | Persisted to Supabase |

### New Quick Wins (proposed 2026-06-13)

| Feature | Description | Effort |
|---|---|---|
| Weekly calorie banking | Show net calorie surplus/deficit accumulated over the week, not just each day. Helps flexible dieters who don't want per-day precision. Small badge below the daily calorie ring. | 2h |
| Daily mini-quests | Alongside badges, add rotating short-duration quests: "Log before 9am 3 days in a row" (+50 XP), "Hit water goal today" (+25 XP). Fresh quests each day. Increases daily open rate. | 1 day |
| Coach tip rating | Add thumbs up/down on each Smart Coach daily tip. Store ratings in Supabase. Suppress tips that consistently get thumbs down; surface ones that get thumbs up. Cheap signal for personalisation. | 2h |
| Monthly PDF health report | One-tap export: a polished summary PDF of the past month's top stats, charts, key insights, and workout highlights. Useful to share with a GP, dietitian, or sports coach. | 1–2 days |
| Macro auto-cycling by day type | Since the calendar knows which days are workout days, automatically set a higher calorie/carb target on those days and lower on rest days. Show the adjusted ring without user having to change settings. | 1 day |
| RPE logging per set | Add an optional Rate of Perceived Exertion field (1–10) per exercise (or per set). Feeds into the Correlation Engine: high RPE on "easy" days is an early recovery warning. | 1 day |
| Superset builder | In the workout builder, allow tagging two exercises as a superset (A1/A2). The active workout screen then alternates between them with a short inter-set rest and a longer inter-round rest. | 2 days |
| Restaurant menu memory | The app can already scan restaurant menus. Add the ability to save a scanned restaurant and its macro-friendly items for quick re-logging: "I'm at Pret — log my usual." | 1 day |
| Workout note / RPE journal | A free-text "how did this session feel?" field at the end of each workout, separate from the daily log. Feeds the AI coaching context for next session planning. | 2h |
| Smart streak repair | If a user breaks a streak, offer a 24-hour "streak repair" by completing a double log the next day. One free repair per 30 days — keeps long streaks alive after genuine slip-ups without devaluing them. | 3h |

---

## Prioritisation Matrix (Updated 2026-06-13)

Scored on Impact (user value) × Feasibility (time + complexity) for a solo developer.

| Feature | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| New Quick Wins (mini-quests, banking, RPE) | Medium–High | Very High | ★★★★★ | Not started |
| **Correlation Engine** (Pillar 1) | Very High | High | ★★★★☆ | **Not started — highest outstanding priority** |
| **Readiness Score** (native calculated, dashboard card) | Very High | High | ★★★★☆ | Partial (Oura data synced, no display) |
| **Muscle Balance Heatmap** (Pillar 7) | High | High | ★★★★☆ | Not started — muscleMapping.ts exists |
| **Hydration + Supplements** (Pillar 9) | High | High | ★★★★☆ | Not started — easy schema additions |
| **Quarterly AI Review** (Pillar 10) | Very High | Medium | ★★★☆☆ | Not started |
| **HR Zone & Cardio Analytics** (Pillar 8) | High | Medium | ★★★☆☆ | Not started — Strava HR data available |
| Group Challenges (Pillar 5 remainder) | Medium | Medium | ★★★☆☆ | Not started |
| Macro auto-cycling by day type | High | High | ★★★☆☆ | Not started |
| Superset builder | Medium | Medium | ★★☆☆☆ | Not started |
| Monthly PDF health report | Medium | Medium | ★★☆☆☆ | Not started |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Future (requires native bridge) |

---

## Recommended Next Sprint

The outstanding work from the original PRD plus the highest-value new ideas:

### Sprint A — Intelligence Layer (2–3 weeks)
The app has enormous amounts of data that still isn't being turned into insight. This is the biggest gap.

1. **Correlation Engine v1** (3–4 days) — nightly cron, Pearson correlations on existing `daily_logs`, top 2–3 findings surfaced on dashboard as insight cards. This is what makes the app feel like a coach rather than a logbook.
2. **Native Readiness Score dashboard card** (1–2 days) — calculate from existing logged data (sleep, stress, energy, alcohol, workout load) and show prominently on the home screen. Oura data enhances it but isn't required.
3. **Muscle Balance Heatmap** (2–3 days) — `muscleMapping.ts` already does the hard work; the remaining effort is the visual heatmap component and imbalance-detection logic.

Total effort: 6–9 days. Outcome: the app feels dramatically smarter with zero new data collection from users.

### Sprint B — Daily Engagement Layer (1–2 weeks)
Small features that increase daily opens and retention.

1. **Hydration tracker** (1 day) — a water counter in the daily log. Trivial to build, meaningful to users.
2. **Supplement stack tracker** (1–2 days) — daily checkbox log for personal supplements.
3. **Daily mini-quests** (1 day) — rotating XP challenges that give users a reason to open the app and try something new.
4. **Coach tip rating** (2h) — thumbs up/down on Smart Coach tips; cheap personalisation signal.

### Sprint C — Depth Features (3–4 weeks)
For users who want to go deeper.

1. **HR Zone & Cardio Analytics** (3–4 days) — parse Strava HR zone data, weekly zone distribution chart, zone 2 deficit alert.
2. **Quarterly AI Review** (3–4 days) — 90-day report card, life events log, coaching memory layer.
3. **Group Challenges** (3–5 days) — complete the accountability pillar.

---

*Document updated 2026-06-13. Questions, pushback, or additions — flag them and I'll revise.*
