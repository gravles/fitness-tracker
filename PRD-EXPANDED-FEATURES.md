# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20  
**Last Updated:** 2026-06-16  
**Status:** Living document — updated with implementation audit + new feature ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

*Updated 2026-06-16 after implementation audit of the actual codebase.*

| Area | Status |
|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter |
| Streaks & XP gamification | ✅ 15 badges, level system |
| Trends & analytics | ✅ Charts across 5 dimensions |
| AI coaching chat | ✅ Context-aware, 30-day window |
| Push notifications | ✅ Server-side, custom reminders + FCM mobile |
| Strava sync | ✅ OAuth + auto-sync (v1.4.0) |
| Withings sync | ✅ Weight + body composition (v1.4.0) |
| Oura sync | ✅ Readiness, sleep, HRV (v1.4.0) |
| Goal Wizard | ✅ Built; entry point added via onboarding (v2.0.0) |
| Progress photos | ✅ Upload + compare |
| Body metrics | ✅ Measurements + photo upload (v1.2.0) |
| Calendar feed | ✅ iCal webcal:// subscription (v2.0.0) |
| Nutrition planning | ✅ Meal planner, pantry, AI meal gen (~85% complete) |
| Periodisation & progressive overload | ✅ 12-week AI programs, 1RM, PR detection (v1.5.0) |
| Muscle heatmap & volume tracking | ✅ Shipped (v1.5.0) |
| Individual accountability partners | ✅ Invite by email, weekly summary emails |
| Social / group challenges | 🔴 Not started — no challenges table |
| Correlation engine & insights | 🔴 Not started — weekly AI insights are generic, not data-driven |
| Recovery & readiness score | 🔴 Not started — Oura data syncs but no calculated score, no UI |
| Apple Health / Google Fit | 🔴 Not started — native app required |
| Supplement tracker | 🔴 Not started |
| Injury & pain log | 🔴 Not started |
| Visual / photo food logging | 🔴 Not started |
| Barcode food scanning | 🔴 Not started |
| Water intake tracking | 🔴 Not started |

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

# New Feature Ideas — Brainstorm (June 2026)

*The six original pillars are either built or in-flight. The following are net-new ideas for the next wave of development. They are organised into five new pillars, followed by an expanded quick wins list.*

---

## Pillar 7 — Visual Food Logging & Barcode Scanning

### The Problem

The current AI food logging works by text description. Users type "chicken breast, 200g, steamed" and the AI extracts macros. This is good but still requires effort. Two powerful shortcuts are missing: scanning a barcode on packaged food (instant, accurate) and photographing a meal (zero typing, works in restaurants).

### What It Does

**Barcode Scanner**
Using the device camera, scan the barcode on any packaged food. The app hits the Open Food Facts API (free, 3M+ products) or the Nutritionix barcode API to return exact nutrition info. One tap adds it to the log.

- Works offline for recently scanned items (cache in `saved_foods`)
- Shows product image, brand, and serving size selector
- "How many servings?" prompt before adding

**Photo-to-Macros (AI Vision)**
A camera button in the food log opens the camera. The user takes a photo of their meal. Claude's vision API estimates:
- What's on the plate (identified foods)
- Approximate portion sizes based on plate geometry and context cues
- Macro breakdown with confidence indicators ("~450 kcal, likely 35–55g protein")

This is inherently less precise than weighing food, so the UI should be honest: show a range rather than a single number, and let the user adjust portion size with a slider.

**Restaurant Menu QR Scanning** *(may already partially exist — confirm)*
Scan a restaurant menu QR code or uploaded photo to get macro estimates for any item.

### Data Model

No new tables needed. Both paths write to `daily_logs.food_items` with a `source` field:

```json
{
  "name": "Oat biscuits",
  "source": "barcode",
  "barcode": "5000169106050",
  "calories": 135,
  "protein": 2.1
}
```

```json
{
  "name": "Grilled salmon with vegetables",
  "source": "photo",
  "confidence": "medium",
  "calories_range": [420, 510],
  "calories": 465
}
```

### New Routes

- `GET /api/nutrition/barcode?code=5000169106050` — look up barcode via Open Food Facts
- `POST /api/nutrition/photo-log` — accepts base64 image, returns AI macro estimate

### API Strategy

Open Food Facts is free and surprisingly complete for branded products. Only fall back to a paid API (Nutritionix, Edamam) if a barcode isn't found. The photo-to-macros endpoint uses `claude-sonnet-4-6` with vision input — cost is ~$0.01 per photo, acceptable for a premium feature.

### Why This Matters

Logging friction is the #1 reason users stop tracking food. Barcode scanning makes packaged food instant. Photo logging makes restaurant meals tractable. Together they remove the two biggest pain points in food tracking.

---

---

## Pillar 8 — Body & Health Metrics Expansion

### The Problem

The app tracks weight, body fat %, and muscle mass from Withings. But a serious health-and-fitness user tracks more: injury status, supplement intake, water consumption, and periodically their blood work. These are currently either completely absent or scattered across notes in the daily log.

### What It Does

**Injury & Soreness Log**
A lightweight injury tracker within the body metrics section:
- Log a muscle, joint, or body part as "sore", "injured", or "pain-free"
- Mark severity (1–5)
- When a muscle is marked as injured, the workout planner automatically flags exercises that target it ("Caution: left knee marked sore — consider skipping squats today")
- Track recovery over time (how many days before it cleared)
- The AI coach reads injury log entries in its context window

```sql
CREATE TABLE injury_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body_part text NOT NULL,          -- 'left_knee', 'lower_back', 'right_shoulder'
  severity int NOT NULL,            -- 1-5
  status text NOT NULL,             -- 'sore', 'injured', 'pain-free'
  notes text,
  logged_at timestamptz DEFAULT now(),
  resolved_at timestamptz           -- null if still active
);
```

**Supplement Tracker**
Log daily supplement intake similarly to medications:
- User defines their supplement stack (name, dose, timing: morning/pre-workout/evening)
- Daily check-off: did you take creatine today? Omega-3? Vitamin D?
- Streak tracking per supplement
- The correlation engine (Pillar 1) can then test: "Creatine days vs. non-creatine days: is there a measurable strength difference?"

```sql
CREATE TABLE user_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,                        -- '5g', '1 capsule'
  timing text,                      -- 'morning', 'pre_workout', 'evening'
  is_active boolean DEFAULT true
);

CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES user_supplements(id),
  taken_at timestamptz DEFAULT now(),
  date date NOT NULL
);
```

**Water Intake Tracker**
A simple hydration tracker on the daily log page:
- A glassful counter (or freeform ml entry)
- Daily target (default: 2,500ml, adjustable)
- Automatically increases target on days with logged workouts
- Shows as a ring/progress bar alongside the macro rings
- The correlation engine tests: water intake vs. energy level, water intake vs. workout performance

No new table needed — extend `daily_logs` with a `water_ml int` column.

**Blood Work / Lab Results**
A "Labs" section under Body Metrics for health-conscious users:
- Upload or manually enter blood test results: cholesterol, testosterone, vitamin D, ferritin, CRP, HbA1c, etc.
- Track each biomarker over time with reference range overlays (is my value in the normal range?)
- AI coach has access to recent lab results ("Your last testosterone reading was 450 ng/dL, which is mid-range...")
- Flag when a value is outside the reference range and suggest discussing with a doctor
- No diagnostic claims — purely tracking and pattern visualisation

```sql
CREATE TABLE lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  biomarker text NOT NULL,          -- 'testosterone', 'vitamin_d', 'ldl'
  value numeric NOT NULL,
  unit text NOT NULL,               -- 'ng/dL', 'nmol/L', 'mg/dL'
  reference_low numeric,
  reference_high numeric,
  lab_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### Why This Matters

These features address the gap between fitness tracking and health tracking. A user who logs their supplements, tracks injuries, and monitors blood work is a highly engaged, sticky user. Injury tracking in particular prevents churn from overtraining — one of the most common reasons people quit.

---

---

## Pillar 9 — Coach / Trainer Mode

### The Problem

The app is built for individuals. But many of the app's most engaged users are likely working with personal trainers, or ARE personal trainers. A trainer needs to manage multiple clients, view their logs, adjust their programs, and leave coaching notes — none of which is possible today.

### What It Does

**Trainer Accounts**
A trainer account type (toggled in settings) that unlocks a multi-client dashboard. Clients invite their trainer by email or code, granting read access to their logs and write access to their training programs.

**Client Dashboard**
A trainer view showing all clients in a card grid:
- Each card: client name, today's readiness score, last workout date, streak, weekly log compliance %
- Click into any client to see their full dashboard (read-only, using their actual components)
- Quickly adjust their active training program or leave a coaching note

**Coaching Notes**
Trainers can leave timestamped notes on any client's workout session or daily log entry. The client sees these as highlighted annotations. Notes feed into the client's AI coach context ("Your trainer left a note after Tuesday's session: focus on bracing your core during deadlifts").

**Program Assignment**
Trainers can create a training program from scratch or from a template and push it to a client's account with a single action. The client sees it appear in their Programs page.

**Data Model**

```sql
CREATE TABLE trainer_client_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES auth.users(id),
  client_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending',    -- 'pending', 'active', 'ended'
  access_level text DEFAULT 'read', -- 'read', 'write_programs', 'full'
  started_at timestamptz,
  ended_at timestamptz,
  UNIQUE(trainer_id, client_id)
);

CREATE TABLE coaching_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES auth.users(id),
  client_id uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,        -- 'workout', 'daily_log', 'general'
  entity_id uuid,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Monetisation Angle

Trainer accounts could be the app's first paid tier. A trainer managing 10 clients on a $20/month plan is a compelling B2B2C model that doesn't require the complexity of a consumer subscription. Trainers become distribution — they bring their clients.

### Why This Matters

Trainer mode is a force multiplier for reach and retention. Trainers are power users who will dogfood every feature. Their clients arrive with an existing relationship and high motivation. This is the app's clearest path to a revenue model that isn't "charge individual users $10/month."

---

---

## Pillar 10 — Year in Fitness (Wrapped)

### The Problem

The app has all the data to tell a compelling story about a user's year — personal bests, total weight lifted, meals logged, streaks, badges earned. But right now that data only lives in charts on the Trends page. There's no celebration of progress, no shareable moment, no "look how far you've come."

### What It Does

**Monthly Review Card**
On the first day of each month, a dismissible modal (or dedicated page) shows the prior month summarised as a visual card:
- Total workouts completed + total volume (kg lifted)
- Average daily calories / protein vs. target
- Sleep trend over the month
- XP earned + badges unlocked
- Longest streak in the month
- Top 3 exercises by volume
- Best personal record set

**Year in Fitness (December / Anniversary)**
A full-page "wrapped" experience once per year (December 1st, or the user's 12-month signup anniversary):
- Hero stat: "You lifted X,XXX kg this year"
- Animated progression through months
- Top foods, top exercises, most consistent habits
- Biggest personal record
- Readiness + energy trends (if available)
- A shareable image card (download as PNG) designed to post to Instagram / share with friends

**Progress Story Generator**
At any time from the Progress page, generate a "My Journey" PDF/image that combines:
- Body composition before/after (if progress photos exist)
- Key stats from the period
- Biggest wins highlighted by AI ("You went from logging 3 days/week to 6 days/week over 6 months")

### Technical Notes

- Monthly reviews are cheap — computed from existing data, no AI needed for the core stats
- The AI is only needed for the narrative headline ("This was your strongest month yet — here's why")
- Shareable images can be generated server-side with `@vercel/og` (already in the stack or easily added)
- Year in Fitness is a single page route: `/wrapped` or `/year-review`

### Why This Matters

Shareable milestone moments are the most organic growth mechanism an app can have. When a user posts their Year in Fitness card, every person who sees it is a warm lead. Monthly reviews are also a powerful retention mechanism — users who feel seen and celebrated don't churn.

---

---

## Pillar 11 — Adaptive Goals & Scenario Planning

### The Problem

Goals in the app are currently set once (via Goal Wizard) and rarely revisited. But a user's context changes constantly: they get injured, they travel, their schedule changes, they plateau. Static goals become demotivating when life diverges from the plan. Meanwhile, the app has all the data to answer "what's actually achievable?" and "what would happen if I changed X?"

### What It Does

**Adaptive Goal Recalibration**
Every 4 weeks, the app proposes goal updates based on recent performance:
- "You've hit your protein target 6/7 days for the last 3 weeks — ready to increase from 160g to 175g?"
- "You've only completed 1 workout/week vs. your 3/week goal. Want to temporarily drop to 2/week while you're travelling?"
- "Your average sleep has been 5.5h — that's limiting your recovery. Addressing sleep might be more impactful than your current calorie deficit."

These are proposals, not automatic changes. The user accepts, adjusts, or dismisses with one tap. Declined proposals are remembered and not shown again for 4 weeks.

**"What If" Scenario Planner**
A tool on the Goals or Trends page that lets users model outcomes:
- "If I eat 200 kcal/day less than my target, when would I reach my goal weight?" → plots a trajectory line on the weight chart
- "If I add one more strength session per week, how much faster will my 1RM progress?" → uses historical 1RM progression rate to extrapolate
- "What's my estimated body fat % if I lose 5 more kg?" → uses current weight/BF% ratio

These are shown as overlaid projections on existing charts with a "this assumes consistent behaviour" disclaimer.

**Goal Archive & Reflection**
When a goal is completed or replaced, it moves to a Goal History view showing:
- The original goal and target date
- Actual completion date (or reason for change)
- Key metrics at start vs. end
- A one-line AI reflection ("You hit this 3 weeks early — your protein consistency was the key driver")

**Data Model**

No major new tables. Extend `user_goals`:

```sql
ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS proposed_update jsonb,      -- pending recalibration proposal
  ADD COLUMN IF NOT EXISTS proposal_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_note text;        -- AI-generated reflection
```

### Why This Matters

Goals that adapt to reality are goals users keep. Static goals that fall behind become guilt — and guilt causes churn. The scenario planner also serves curiosity: users who can explore "what if I did X" are more likely to actually try X. This turns the app from a historical record into a forward-looking planning tool.

---

---

## Expanded Quick Wins (June 2026 additions)

*New items added below the existing quick wins list.*

### Additional Bugs to Fix

| Issue | Fix |
|---|---|
| Grocery list route exists (`/api/nutrition/grocery-list`) but generation logic unclear | Audit and wire up the generate-from-meal-plan flow end-to-end |
| Oura readiness score is mapped to `energy_level` (1–5) rather than stored as a separate field | Store raw Oura readiness score (0–100) alongside mapped value |
| `coach_messages` stored in localStorage as fallback even when Supabase is connected | Remove localStorage path entirely once Supabase chat history is confirmed stable |

### Additional Small Features

| Feature | Description | Effort |
|---|---|---|
| Water intake quick-add | Add water ml buttons (250ml, 500ml, 750ml) to the daily log page; store in `daily_logs.water_ml` | 2h |
| Barcode food lookup | Integrate Open Food Facts API; add camera scan button to food log | 1 day |
| Supplement daily checklist | Hard-coded list of supplements the user defines; simple daily toggle, no correlation analysis yet | 1 day |
| Injury flag on exercise | When adding an exercise, show a warning if the user has an active injury for that muscle group | 2h |
| Monthly review modal | First-of-month modal showing prior month's top stats (no AI needed — pure aggregation) | 1 day |
| Adaptive goal proposal | 4-week check: if user consistently over/under-performs a goal, surface a proposal card on dashboard | 1 day |
| Shareable achievement card | "Share" button on any badge/PR that generates a static OG image via `@vercel/og` | 1 day |
| Dark-mode chart theme | Recharts charts don't respect dark mode — swap hardcoded colour strings for CSS custom properties | 2h |
| "Skip rest day" guard | If user tries to log a high-intensity workout on a day with readiness <40, show a confirmation prompt | 2h |
| Coach mode toggle | Add "I am a personal trainer" toggle to settings (no functionality yet — just a flag for future gating) | 30min |

---

## Updated Prioritisation Matrix (June 2026)

Original pillars updated with actual implementation status. New pillars added.

| Feature | Impact | Feasibility | Score | Status |
|---|---|---|---|---|
| Quick Wins (existing list) | Medium | Very High | ★★★★★ | Ongoing |
| **Readiness Score** | Very High | High | ★★★★☆ | **Most important outstanding original pillar** |
| **Correlation Engine** | Very High | High | ★★★★☆ | **Most important outstanding original pillar** |
| Nutrition — Grocery List | Medium | High | ★★★☆☆ | Finish the ~15% incomplete nutrition work |
| Group Challenges | Medium | Medium | ★★★☆☆ | Accountability layer extension |
| **Barcode / Photo Food Logging** | High | High | ★★★★☆ | New — highest-impact quick UX win |
| **Water Intake Tracker** | Medium | Very High | ★★★★☆ | New — one column + UI, very fast |
| **Monthly Review / Wrapped** | High | High | ★★★☆☆ | New — retention + virality driver |
| **Injury Log** | High | High | ★★★☆☆ | New — safety + coach integration |
| **Supplement Tracker** | Medium | High | ★★★☆☆ | New — extends Pillar 1 data coverage |
| **Adaptive Goals** | High | Medium | ★★★☆☆ | New — drives long-term retention |
| **Scenario Planner** | Medium | Medium | ★★☆☆☆ | New — powerful but complex UI |
| **Lab Results Tracker** | Medium | Medium | ★★☆☆☆ | New — niche but high engagement |
| **Trainer Mode** | High | Low | ★★☆☆☆ | New — requires auth model rework |
| Withings Integration | Already shipped | — | ✅ Done | — |
| Oura Integration | Already shipped | — | ✅ Done | — |
| Full Meal Planner | Already shipped | — | ✅ Done | — |
| 12-Week Programs | Already shipped | — | ✅ Done | — |
| Apple Health / Google Fit | Very High | Very Low | ★★☆☆☆ | Still future (requires native app) |

### Recommended Next Sprint (given current state)

**Highest-priority items that are not yet started and can be shipped quickly:**

1. **Readiness Score v1** (2–3 days) — the biggest gap in the original PRD; all data exists
2. **Correlation Engine v1** (3–4 days) — all data exists; adds AI insight layer
3. **Barcode Food Scanner** (1 day) — single API integration, huge UX improvement
4. **Water Intake Tracker** (2h) — one column, one UI element
5. **Monthly Review Modal** (1 day) — pure data aggregation, no AI needed, retention boost

These five items together would close the biggest gap (original Pillar 1 + 4) and add the highest-value new feature from the brainstorm, all within roughly a 2-week sprint.

---

*Document ends. Questions, pushback, or additions — flag them and revise.*
