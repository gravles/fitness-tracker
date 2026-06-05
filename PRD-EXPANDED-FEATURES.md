# Fitness Tracker — Expanded Features PRD

**Author:** Claude  
**Date:** 2026-05-20 (brainstorm update: 2026-06-05)  
**Status:** Living document — updated with code-survey corrections and new feature ideas

---

## Executive Summary

The app is already stronger than most consumer fitness apps: it combines a frictionless daily log, AI-powered food and workout entry, gamification, and a real coaching layer. But it's working at the level of *data capture and encouragement*. The gap between "good tracking app" and "genuinely transformative personal health tool" is **intelligence**—taking all that captured data and turning it into specific, personal, actionable guidance that actually changes behaviour.

This document proposes six major feature pillars, each with full specifications, rationale, data model changes, and implementation notes. They are ordered by strategic impact, not implementation effort.

---

## Current State (What Exists)

*Updated 2026-06-05 after a code survey of the actual implementation. Several items originally listed as missing are already built.*

| Area | Status | Notes |
|---|---|---|
| Daily log (food, activity, wellness) | ✅ Solid, AI-assisted entry | |
| Workout tracking (exercises, sets, reps) | ✅ Full, with voice spotter | |
| Streaks & XP gamification | ✅ 15 badges, level system | |
| Trends & analytics | ✅ Charts across 5 dimensions | |
| AI coaching chat | ✅ Context-aware, 30-day window | |
| Push notifications | ✅ Server-side, custom reminders | |
| Strava sync | ✅ Manual sync | |
| Goal Wizard | ⚠️ Built but buried | Component exists; only reachable via Settings — needs a prominent entry point |
| Progress photos | ✅ Upload + compare | |
| Body metrics photo upload | 🔴 Not done | URL text field only — needs Supabase Storage (same code as Progress Photos) |
| **Barcode scanner** | ✅ Already built | Open Food Facts API — this was not in the original PRD |
| **Food photo / AI meal scan** | ✅ Already built | `/api/ai/analyze-food` endpoint; camera capture in log UI |
| **Menu photo scanner** | ✅ Already built | Photos of restaurant menus parsed by AI |
| **Voice food entry** | ✅ Already built | Natural language input wired to food log |
| **Offline mode / service worker** | ✅ Partial | SW registered, offline queue exists; background sync flagged as future work |
| **Water tracking schema** | ⚠️ Partially built | `water_glasses` field exists in daily_logs — **no UI exposes it** |
| Social / sharing | 🔴 Stub only | |
| Nutrition planning | 🔴 Not started | |
| Recovery / readiness | 🔴 Not started | |
| Supplement tracking | 🔴 Not started | No schema field, no UI |
| Wearable integrations | 🔴 Strava only | |

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
| Goal Wizard entry point | GoalWizard is built but only reachable via Settings. Add a prominent "Set Goals with AI" card to the home dashboard and onboarding flow | 2h |
| **Water tracking UI** | `water_glasses` already exists in the DB schema — just needs a UI section in DailyLogForm (e.g. a simple +/- glass counter). No migration required | 2h |
| Unit preference (kg/lbs) | Add `weight_unit` to `user_settings`, convert display throughout | 1 day |
| Saved Meals (quick version) | Allow saving a group of food items as a named meal — no planning UI needed yet | 1 day |
| Log reminder smart skip | Skip the evening log reminder automatically if user has already logged today | 2h |
| Streak type selector | Let users choose: streak = any log, or streak = movement only | 1h |
| Equipment quick-pick expansion | Add Barbell, Cable Machine, TRX, Medicine Ball, Battle Ropes to equipment list | 30min |
| XP exponential curve | `xpForLevel(n) = 100 * (1.15^n)` — makes high levels feel earned | 1h |
| Autosave indicator | Show a small "Saved ✓" or pulsing dot in DailyLogForm header when saving | 1h |
| Persistent macro summary bar | Sticky mini macro bar (P/C/F/Cal) visible across all log tabs | 2h |
| Coach chat history sync | Move coach chat history from localStorage to Supabase for cross-device persistence | 1 day |
| Complete offline sync | Background sync in service worker is marked "future enhancement" — wire it up so queued mutations actually sync when the device reconnects | 1 day |

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

## Feature Brainstorm — New Ideas (2026-06-05)

The following ideas are not yet in the roadmap. They are raw proposals — some are quick wins, some are pillars in their own right. Ordered loosely by estimated impact. None are committed; pick what resonates.

---

### B1 — Supplement Tracker

**The gap:** The daily log captures food, movement, sleep, stress, and alcohol — but not supplements. Most fitness-conscious users take creatine, vitamin D, omega-3, magnesium, pre-workout, or protein powder daily. There's nowhere to log this, and the correlation engine can't account for it.

**What it does:**
- A supplements section in DailyLogForm — a checklist of the user's saved supplements, each with a one-tap "taken today" toggle
- Users build their personal stack in Settings (name, dose, timing: morning/pre-workout/evening)
- The correlation engine can then surface: *"Your energy levels are 22% higher on days you take creatine"* or *"You sleep worse on days you take pre-workout after 3pm"*

**Data model:**
```sql
-- Supplement definitions (user's personal stack)
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,              -- '5g', '2000 IU', etc.
  timing text,            -- 'morning', 'pre_workout', 'evening', 'any'
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Daily supplement log (linked to daily_logs date)
CREATE TABLE supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES supplements(id) ON DELETE CASCADE,
  date date NOT NULL,
  taken boolean DEFAULT false,
  taken_at timestamptz,
  UNIQUE(user_id, supplement_id, date)
);
```

**Effort:** 2–3 days. Low risk, high signal for the correlation engine.

---

### B2 — Personal Records (PR) Hall of Fame

**The gap:** The app tracks every set, weight, and rep. It calculates estimated 1RM (mentioned in Pillar 3). But there is no celebration when a user hits a personal best. The moment a PR happens is one of the highest-motivation moments in fitness — the app currently lets it pass silently.

**What it does:**
- During active workout, detect in real-time when a set exceeds the all-time best for that exercise
- Show a confetti/celebration animation and log the PR automatically
- A dedicated "Hall of Fame" screen (accessible from the Profile or Progress page) showing all-time records for every tracked exercise, with the date they were set
- PRs also award a significant XP bonus and a badge (e.g., "Bench Press Champion")
- Optional: push notification to accountability partner when a PR is hit

**Data model:**
```sql
CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  record_type text NOT NULL,       -- 'estimated_1rm', 'max_weight', 'max_reps', 'max_volume'
  value numeric NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  workout_id uuid REFERENCES workouts(id),
  set_details jsonb,               -- snapshot of the set that set the record
  UNIQUE(user_id, exercise_name, record_type)  -- only keeps the current best
);
```

**Effort:** 2–3 days. Extremely high engagement / emotional payoff per unit of effort.

---

### B3 — "On This Day" Fitness Memory

**The gap:** Users log data every day but rarely look back at how far they've come. Long-term progress is the most powerful motivator, but the Trends page requires active navigation. Surfacing historical data *unprompted* is far more emotionally powerful.

**What it does:**
- A card on the home dashboard (below the readiness score, if built) that appears when there is data from exactly 1 month, 3 months, 6 months, or 1 year ago
- *"One year ago today: you logged your first workout — 3×10 bench at 50kg. Your estimated 1RM is now 87.5kg. That's a 75% increase."*
- *"Three months ago: you weighed 84.2kg. Today you're at 79.8kg. 4.4kg down."*
- Tapping expands to a mini retrospective with a few key stats from that day

**Technical approach:** A lightweight server-side query on the `/api/dashboard` endpoint — no cron, no new table. Query daily_logs and workout data for dates exactly 30/90/180/365 days prior. Generate the copy with a single Claude Haiku call per user per day (cached).

**Effort:** 1–2 days. Enormous retention value for almost zero infrastructure.

---

### B4 — Shareable Workout / Progress Cards

**The gap:** Strava's killer feature is the shareable run card that people post on Instagram Stories. The app has no equivalent. A completed workout is a proud moment — give users a way to share it without requiring a social network inside the app.

**What it does:**
- After completing a workout, a "Share" button generates a beautifully formatted image card:
  - App name / branding
  - Workout name, date, duration
  - Exercises completed with top sets
  - Total volume lifted
  - A subtle background gradient matching the workout type (pull = blue, push = orange, legs = green)
- A second card type: Weekly Summary — shares the week's stats (days logged, workouts, streak, top PR)
- Cards are generated as PNG via a `/api/share/workout-card` route using `@vercel/og` (Vercel's OG image library — no canvas, no puppeteer)
- Users can download or share directly from the app

**Why `@vercel/og`:** It renders JSX to an image at the edge, takes ~150ms, and is free on the Vercel hobby plan.

**Effort:** 2–3 days. Acts as free top-of-funnel marketing every time a user shares.

---

### B5 — AI Weekly Goal Review

**The gap:** Goals are set via the Goal Wizard but then feel static. There's no moment where the app says *"Based on last week, should we adjust your targets?"* This makes goals feel like a set-and-forget form rather than a living coaching relationship.

**What it does:**
- Every Monday morning, a card appears on the dashboard (or a push notification is sent): *"Weekly review ready — 2 min"*
- Tapping opens a guided AI conversation:
  1. Show last week's performance vs. targets (hit protein 4/7 days, 2 workouts vs. 3 target, etc.)
  2. Ask: "How did last week feel — too hard, about right, or too easy?"
  3. Based on performance data + user's response, AI suggests specific target adjustments: *"You've hit your protein goal 5/7 days for 3 weeks running — ready to increase to 165g?"* or *"You only hit 2 of your 3 workout targets — want to drop to 2 and build back from there?"*
  4. User approves or dismisses each suggestion; approved changes update `user_settings` directly

**Technical approach:** Extends the existing AI coach infrastructure. The Monday card is a new notification type. The conversation uses the coach endpoint with a structured system prompt focused on goal calibration.

**Effort:** 2–3 days. Makes the entire app feel like it's paying attention.

---

### B6 — Habit Template Library

**The gap:** The app has a custom habits checklist in the daily log, but starting from scratch is friction. Many users don't know what habits to track, so they log nothing. A curated library of pre-built habits removes that barrier and helps users discover what's worth tracking.

**What it does:**
- In Settings → Habits, a "Browse habit library" button opens a modal with ~30 pre-built habits grouped by category:
  - **Nutrition:** Eat vegetables at every meal, No ultra-processed foods, 2L water (pre-populated from water tracker), No alcohol today, Eat breakfast
  - **Movement:** 10,000 steps, Morning stretch, Post-workout mobility, Take the stairs
  - **Sleep:** In bed by 10pm, No screens 30 min before bed, 7+ hours
  - **Mental:** 5-min meditation, Gratitude note, No social media before 9am
  - **Recovery:** Cold shower, Foam roll, Sauna session
- One tap adds to their personal habit list
- Each habit has a suggested correlation pair: "This habit correlates with better sleep quality in users who track it" (shown as a tooltip)

**Effort:** 1 day. Massively reduces onboarding friction; feeds the correlation engine with richer data.

---

### B7 — Adaptive Rest Timer

**The gap:** The active workout screen has no between-set rest timer. Users either guess their rest period, use their phone's clock app (interrupting the workout flow), or use muscle memory. Adding a rest timer is one of the most-requested features in fitness apps and keeps users inside the app between sets instead of switching away.

**What it does:**
- When a set is marked complete in the active workout, a rest timer starts automatically in the bottom bar
- Default rest periods are smart by exercise type:
  - Compound strength (squat, deadlift, bench): 3 min
  - Isolation (curls, laterals): 90 sec
  - Bodyweight / HIIT: 60 sec
- User can tap to adjust (tap +30s / -30s) or set a custom default per exercise
- Timer pulses green → amber → red as it counts down; haptic feedback + optional sound on completion
- Rest periods are logged and contribute to readiness score calculation (longer rests → higher perceived exertion context)

**Technical approach:** Pure client-side timer (`useInterval` + Web Audio API for the beep). No new API calls. Rest duration preferences stored in `user_settings.exercise_preferences jsonb`.

**Effort:** 1–2 days. High daily-use value; keeps users in the app longer during workouts.

---

### B8 — Meal Timing & Pre/Post Workout Nutrition Guidance

**The gap:** The app knows when workouts are scheduled (from the schedule/calendar) and what the user eats (from the food log). But it never connects these two signals to give timing guidance. Pre and post-workout nutrition is one of the highest-leverage levers for training outcomes.

**What it does:**
- When a workout is scheduled, the coach surfaces a proactive nudge 90 minutes before: *"You have a leg session at 6pm. Aim for 40–60g carbs and 20–30g protein around 4:30pm for optimal performance."*
- After a logged workout, if the user hasn't logged a post-workout meal within 45 minutes, send a push: *"Recovery window: log your post-workout nutrition — protein within the hour helps muscle repair."*
- A new "Nutrition Timing" section in the coach chat: user can ask "what should I eat before my run?" and get a personalised answer based on their macros, weight, and workout intensity

**Effort:** 2 days. Uses existing schedule, notification, and coach infrastructure — just needs the logic to connect them.

---

### B9 — Coach Persona Selection

**The gap:** The AI coach currently has one voice. But people respond very differently to different coaching styles — some want data and science, some want a hype buddy, some want tough love. A single voice is optimised for no one.

**What it does:**
- In Settings → AI Coach, a "Coaching Style" selector with 4 options:
  - **Motivator** — Energetic, positive, celebrates every win. *"Let's GO! You crushed that workout!"*
  - **Scientist** — Data-first, minimal fluff, specific numbers. *"Your progressive overload rate is 1.3kg/week — above the 0.5–1kg optimal range. Consider slowing down."*
  - **Supportive Friend** — Warm, empathetic, non-judgmental. *"That was a tough week — and you still showed up twice. That counts."*
  - **Drill Sergeant** — Direct, demanding, zero excuses. *"You missed your protein target 4 days in a row. What's the plan?"*
- The selected persona is injected into the system prompt of every coach interaction
- Persona is also reflected in push notification copy, weekly summaries, and readiness explanations

**Technical approach:** A `coach_persona` field in `user_settings`. Each persona maps to a system prompt prefix stored as a constant. No new API routes needed.

**Effort:** 1 day. High personalisation payoff for minimal engineering.

---

### B10 — Fasting / Eating Window Tracker

**The gap:** The daily log already has an `eating_windows` field (noted in the code survey), suggesting this was planned. Intermittent fasting is one of the most popular nutrition approaches. The app captures the data but doesn't surface it as a first-class feature.

**What it does:**
- A simple "Eating Window" widget in the log: user taps "First bite" and "Last bite" to record their eating window, or enters times manually
- The dashboard shows the current eating window (e.g., "16:8 — eating from 12pm–8pm") and a streak for maintaining the window
- Correlation engine can then surface: *"Your energy is 18% higher on days your eating window is under 9 hours"*
- Optional: a push notification at the close of the eating window: *"Your eating window closes at 8pm — 30 minutes left"*

**Effort:** 1–2 days (schema likely already partially exists). High value for intermittent fasting users.

---

### B11 — Full Data Export & Portability

**The gap:** Users who log diligently for months accumulate deeply personal health data. Currently there is no way to export it. This is a trust issue as much as a feature issue — users who know they can leave take the leap of trusting the app more fully.

**What it does:**
- Settings → Privacy → "Export my data" button
- Triggers a background job that compiles:
  - All daily logs (CSV)
  - All workouts and sets (CSV)
  - All body metrics (CSV)
  - Progress photos (zip of originals)
  - A summary PDF with charts (total workouts, weight trend, streak history)
- User receives an email (via Resend, already in the stack) with a time-limited download link (48h)
- The export job runs as a Vercel serverless function; the download is served from Supabase Storage

**Effort:** 2–3 days. GDPR compliance by-product; builds long-term user trust.

---

### B12 — Non-Scale Victory (NSV) Tracker

**The gap:** Weight loss or muscle gain apps often make users feel like failures if the scale doesn't move for a week — even when real progress is happening (better sleep, more energy, a new lift PR, clothes fitting differently). Celebrating non-scale victories is a well-evidenced technique for maintaining motivation during plateau periods.

**What it does:**
- A "Victories" section in the Progress page, separate from body metrics
- Users can log NSVs in free text or pick from a library of common ones:
  - First unassisted pull-up
  - Ran 5km without stopping
  - Slept 7+ hours 5 nights in a row
  - Went 30 days without alcohol
  - Fit into a smaller clothing size
  - Did 10 consecutive press-ups
- Each NSV auto-awards XP and a badge, and is stored with the date
- The AI coach references recent NSVs when responding: *"You just logged your first pull-up last week — that's a serious milestone worth celebrating."*
- NSVs appear in the accountability partner weekly summary

**Data model:**
```sql
CREATE TABLE non_scale_victories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,           -- 'strength', 'cardio', 'nutrition', 'sleep', 'lifestyle'
  description text,
  achieved_at date NOT NULL,
  xp_awarded int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);
```

**Effort:** 1–2 days. Disproportionately powerful for motivation and churn prevention.

---

### B13 — AI Injury Prevention Alerts

**The gap:** Overuse injuries are the number one reason people stop training. The app has all the data needed to detect the warning signs — sudden volume spikes, muscle group imbalances, training frequency without rest days — but currently does nothing with it.

**What it does:**
- A new category of correlation engine insight: **risk alerts** (amber/red, distinct from green insight cards)
- Alert triggers (computed by the nightly cron alongside other insights):
  - **Volume spike:** Weekly volume for any muscle group has increased >30% vs the prior 4-week average
  - **Imbalance:** A push muscle group (chest, triceps, front delts) has >2× the weekly sets of its antagonist pull group (back, biceps, rear delts) for 3+ consecutive weeks
  - **No rest day:** 7+ consecutive days of logged workouts with moderate/high intensity
  - **Repetitive strain pattern:** Same movement pattern (e.g., overhead pressing) logged >4x/week for 3+ weeks
- Alerts appear as an amber card on the dashboard: *"Heads up — your chest volume has jumped 45% this week. Consider extra shoulder mobility work and a light session instead of heavy pressing."*
- Tapping the card opens an AI explanation with specific recommendations

**Effort:** 2–3 days (rides the Pillar 3 muscle-group mapping and Pillar 1 cron job). Could genuinely prevent injuries and the churn that follows.

---

### B14 — Recipe URL → Food Log

**The gap:** The app already has AI food photo analysis, barcode scanning, and voice entry — but one common logging scenario is missing: *"I cooked this recipe from a website, how do I log it?"* Currently the user has to manually search and add each ingredient. This is the highest-friction scenario in the food log.

**What it does:**
- In the food log's AI input options, add "Paste a recipe link"
- User pastes any recipe URL (e.g., BBC Good Food, NYT Cooking, a random food blog)
- The app fetches the page, extracts the ingredient list using a scraper + Claude, calculates approximate macros per serving, and adds it as a single food log entry with a breakdown
- User can adjust servings ("I had 1.5 portions") before confirming

**Technical approach:**
- Server-side route: `POST /api/ai/analyze-recipe` — takes a URL, fetches the HTML (Vercel edge function bypasses CORS), passes ingredients to Claude Haiku for macro estimation
- Macro estimation uses the same logic as the existing AI food analyzer
- Edge cases: paywalled content (NYT Cooking) — fall back to "paste the ingredient list instead"

**Effort:** 2–3 days. Eliminates the biggest single friction point in food logging for home cooks.

---

### B15 — Smart Notification Learning

**The gap:** The app sends reminders at fixed times set by the user. But the app knows when users actually engage — when they open the app, when they log, when they complete workouts. A system that learns from this behaviour and shifts notification timing accordingly would have meaningfully higher open rates.

**What it does:**
- Track `notification_events` (sent, opened, dismissed) for each user
- After 14 days of data, compute each user's "peak engagement windows" — the times of day they are most likely to open the app
- Shift reminder notifications (log reminder, workout reminder) to the nearest engagement peak, within a ±90-minute window of the user's set time
- The AI coach weekly summary is sent at the time the user historically opens Saturday or Sunday morning messages

**Data model:**
```sql
CREATE TABLE notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at timestamptz NOT NULL,
  opened_at timestamptz,
  action_taken boolean DEFAULT false
);
```

**Effort:** 2–3 days. Increases notification open rate across all existing notification types — multiplies the value of every other reminder feature.

---

## Brainstorm Prioritisation

Quick score across the 15 new ideas: Impact (1–5) × Effort (1 = hardest, 5 = easiest).

| # | Feature | Impact | Effort | Score | Notes |
|---|---|---|---|---|---|
| B3 | "On This Day" memories | 5 | 5 | 25 | Zero infrastructure, huge emotional hit |
| B2 | PR Hall of Fame | 5 | 4 | 20 | Celebrates the moments that matter most |
| B7 | Adaptive rest timer | 4 | 5 | 20 | Keeps users in the app during workouts |
| B9 | Coach persona selection | 4 | 5 | 20 | 1 day to add, feels premium |
| B6 | Habit template library | 4 | 5 | 20 | Reduces onboarding friction |
| B12 | NSV tracker | 5 | 4 | 20 | Critical for motivation during plateaus |
| B1 | Supplement tracker | 4 | 4 | 16 | Enriches correlation engine significantly |
| B4 | Shareable workout cards | 4 | 4 | 16 | Free marketing on every share |
| B5 | AI weekly goal review | 5 | 3 | 15 | Makes the whole app feel alive |
| B10 | Fasting / eating window | 3 | 5 | 15 | Schema partially exists already |
| B8 | Meal timing guidance | 4 | 4 | 16 | Connects two existing data streams |
| B14 | Recipe URL logging | 4 | 3 | 12 | High friction reduction for home cooks |
| B13 | Injury prevention alerts | 5 | 3 | 15 | Prevents the churn that follows injury |
| B11 | Data export | 3 | 3 | 9 | Trust + GDPR compliance |
| B15 | Smart notification learning | 3 | 3 | 9 | Boosts existing notification ROI |

**Top 5 picks to consider for the next sprint:**
1. **B3 — On This Day** — ships in a day, will delight users immediately
2. **B2 — PR Hall of Fame** — the biggest emotional gap in the current workout flow
3. **B7 — Rest Timer** — most-requested type of feature in fitness apps
4. **B12 — NSV Tracker** — one of the strongest churn-prevention mechanisms
5. **B9 — Coach Persona** — one day of work, feels like a completely personalised product

---

*Document ends. Questions, pushback, or additions — flag them and I'll revise.*
