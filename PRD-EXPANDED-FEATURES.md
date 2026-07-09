# Fitness Tracker — Expanded Features PRD

**Author:** Claude
**Date:** 2026-07-09 (Round 2 review)
**Status:** Living document — outstanding work reprioritized, new feature ideas added for review

---

## Executive Summary

Round 1 of this PRD (2026-05-20) proposed six pillars. Since then the app shipped native iOS + Android apps, 12-week AI training programs with 1RM tracking, Withings + Oura integrations, an AI-coach MCP layer that can plan workouts and meals autonomously, accountability partner emails, and all 18 "quick win" bugs/small features. That's most of the original backlog — see [What Shipped](#what-shipped-since-round-1) below.

Two pieces of the original plan are still genuinely unstarted and remain the highest-value work available: the **Correlation Engine** (Pillar 1) and the **Readiness Score** (Pillar 4). Both were called out in Round 1 as the best ROI — no new infrastructure, built entirely from data already being captured — and that's still true today. A few smaller gaps remain too (grocery lists, group challenges, Apple Health).

This revision does three things:
1. Marks what's actually done so the pillar list stops overstating the backlog
2. Keeps the full spec for the genuinely outstanding pieces, sharpened with details from what's shipped since (e.g. Oura readiness data is already flowing in and can bootstrap Pillar 4 immediately)
3. Adds a **Round 2 brainstorm** of new feature ideas that lean on capabilities that didn't exist when Round 1 was written — a real native app, an AI coach that can act autonomously via MCP tools, and two device integrations already live

Nothing in this document has been built as part of this update — it's for review.

---

## What Shipped Since Round 1

| Area | Status | Notes |
|---|---|---|
| Native iOS + Android apps (Capacitor) | ✅ Shipped v2.0 | Changes the feasibility of Apple Health / widgets / watch companion — see below |
| 12-Week AI Training Programs | ✅ Shipped v1.5 | Phases, deload weeks, 1RM-driven load targets, PR toasts |
| Progressive overload (via program %1RM prescriptions) | ✅ Shipped | No explicit "you've stalled" plateau nudge outside of program logic |
| Withings integration | ✅ Shipped v1.4 | Weight, body fat %, muscle/bone mass → `body_metrics` |
| Oura integration | ✅ Shipped v1.4 | Readiness + sleep synced, currently collapsed into `daily_logs.energy_level` — not yet its own score |
| AI Nutrition Planner (pantry-based) | ✅ Shipped v1.3 | Different shape than Round 1's spec (pantry + AI generation vs. manual weekly grid) but same job |
| Saved Meals | ✅ Shipped v1.2 | |
| Accountability Partners (email summary) | ✅ Shipped v1.4 | Add/remove partners, one-tap weekly summary email via Resend |
| AI-coach MCP tools (workouts + meals) | ✅ Shipped (Unreleased) | Coach can push training plans and meal plans directly; renders on dashboard with zero UI changes needed |
| Coach chat history sync | ✅ Shipped v1.2 | Supabase-backed, cross-device |
| All 18 Quick Wins (8 bugs + 10 small features) | ✅ Shipped | Full list verified against code in this review |
| **Correlation Engine / Insight Feed** | 🔴 Not started | Only a manual, on-demand AI weekly narrative exists (`AIWeeklyInsightModal`) — no persistent insights, no statistical correlation, no "why do I feel this way" |
| **Readiness Score** | 🔴 Not started | Oura's own readiness number is being fetched and thrown away into `energy_level` — the data is already there, unused |
| Grocery list generation | 🔴 Not started | Part of original Pillar 2, never built |
| Group challenges | 🔴 Not started | Part of original Pillar 5, never built |
| Apple Health / HealthKit | 🔴 Not started | Now far more feasible — a native shell already exists (Capacitor), so this no longer requires a from-scratch App Store submission |
| Google Fit / Health Connect | 🔴 Not started | Same feasibility upgrade as above, Android side |

---

## Outstanding From Round 1 — Highest Priority

These two are unchanged in substance from Round 1 but sharpened below. They're still the best available ROI: zero new third-party integrations, built on data the app already has (and in Pillar 4's case, data that's already being fetched from Oura and discarded).

---

### Pillar 1 — Correlation Engine & Insight Feed

**The problem.** The app captures sleep quality, energy, stress, movement, protein, alcohol and more every day, but the user has to mentally connect the dots themselves. The only existing analysis (`AIWeeklyInsightModal`) is a one-shot narrative generated on demand — it doesn't persist, doesn't rank findings by strength, and can't answer a specific question like "why was my energy low Tuesday?"

**What it does.**
- **Daily Insight Card** on the dashboard — one specific, data-backed insight, refreshed weekly, e.g. *"Your energy is 34% higher on days you hit your protein goal. You've hit it 4 of the last 7 days."*
- **Weekly Pattern Report** — 3–5 ranked correlations replacing the current generic weekly modal
- **"Why do I feel this way?" Quick Ask** — free-text question answered from the user's own data, grounded with the top correlations already found

**Data model.**
```sql
CREATE TABLE insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,  -- 'correlation', 'trend', 'anomaly'
  insight_key text NOT NULL,   -- e.g. 'alcohol_vs_sleep'
  payload jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  UNIQUE(user_id, insight_key)
);
```

**How it works.** Nightly cron (there's already a working cron for reminders — reuse the pattern) computes Pearson correlations across key pairs (alcohol↔sleep, protein-goal-hit↔energy, movement↔next-day motivation, sleep↔next-day movement duration, stress↔alcohol, calories↔energy). r ≥ 0.3 gets a Claude Haiku–written description and lands in `insights_cache`. Dashboard reads the cache — zero AI latency on page load. The existing `generateWeeklyInsights()` in `src/lib/ai.ts` can be repointed to consume this cache instead of re-deriving everything from raw logs each time.

**Why it matters.** This is still the single highest-leverage remaining feature — it's the difference between a logbook and a coach, and it makes every other feature (readiness, programs, meal plans) feel smarter without touching them.

---

### Pillar 4 — Recovery & Readiness Score

**The problem.** Training hard while under-recovered causes injury, plateau, and burnout. The app has all the signals to compute this today — and for Oura users, it's *already pulling Oura's own readiness score* during sync and silently mapping it into `energy_level` (1–5), throwing away the precision.

**What it does.**
- **Daily Readiness Score (0–100)**, colour-coded, shown prominently on the dashboard:
  - 80–100 green *"Peak — great day to train hard"*
  - 60–79 amber *"Ready — normal training"*
  - 40–59 orange *"Moderate — consider a lighter session"*
  - 0–39 red *"Low — rest or active recovery only"*
- **Two data paths, same score slot:**
  - Oura-connected users: use Oura's own readiness number directly (gold-standard, already being fetched — this is the fast path, close to zero net-new work)
  - Everyone else: client-side weighted formula from existing log fields

  | Signal | Weight | Logic |
  |---|---|---|
  | Sleep quality (last night) | 25% | 5/5 = 100 |
  | Stress level (yesterday) | 15% | Inverted |
  | Energy level (yesterday) | 20% | 5/5 = 100 |
  | Days since last rest day | 15% | 0–2 = 100, 3–4 = 60, 5+ = 20 |
  | Alcohol (last 48h) | 15% | 0 = 100, 1 = 75, 2 = 50, 3+ = 20 |
  | Workout volume yesterday | 10% | Rest = 100, Hard = 30 |
- **AI Readiness Explanation** — one Claude-generated sentence, cached daily, e.g. *"You slept 2/5 and had 3 drinks yesterday — a walk would serve you better than heavy lifting today."*
- **Training Recommendation** — ties directly into the existing 12-Week Programs feature: score 80+ runs today's program session at full prescription, 60–79 auto-reduces volume 10–15%, <60 suggests swapping to active recovery

**Data model.**
```sql
CREATE TABLE readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  score int NOT NULL,
  components jsonb NOT NULL,
  source text NOT NULL DEFAULT 'computed',  -- 'computed' | 'oura'
  ai_explanation text,
  recommendation text,
  UNIQUE(user_id, date)
);
```

**Why it matters.** This is the app's most powerful daily hook — it tells the user what to do instead of making them decide, and it directly plugs into the program engine that already exists. For Oura users it's close to a UI-only feature since the data is already in hand.

---

## Smaller Gaps Carried Over From Round 1

Not top priority, but worth keeping on the list — trimmed to just the part that's still missing.

**Grocery List** (rest of Pillar 2). From a filled meal/pantry plan, generate a consolidated shopping list grouped by category with quantities, exportable as text or a shareable link. `POST /api/nutrition/grocery-list`, no new tables — derives from existing `meal_plans` / `pantry_items`.

**Group Challenges** (rest of Pillar 5). 2–8 people opt into a shared, time-boxed challenge (streak, protein-days, workout-count) with a leaderboard, anonymous by default. Needs a `challenges` + `challenge_members` table; reuses the VAPID push infra already built for accountability nudges.

**Apple Health / Google Fit** (rest of Pillar 6). Originally scored "very low feasibility — requires native app." That blocker is gone: the app has shipped native iOS and Android builds via Capacitor since Round 1. This should be re-scored as medium feasibility — likely a Capacitor HealthKit/Health-Connect plugin rather than a from-scratch native module. Worth revisiting soon given the feasibility shift; see Round 2 idea #2 below, which depends on this.

---

## Round 2 — New Feature Brainstorm

These are new, not carried over from Round 1. Each leans on something that exists now but didn't in May: a real native app shell, an AI coach that can already act autonomously through MCP tools, live Oura/Withings data, and a mature gamification/sharing system. Lighter-weight pitches, not full build specs — flag which ones you want fleshed out and I'll write the full spec.

### Intelligence & notifications

**1. Morning Briefing push notification.** One bundled push each morning — readiness score, today's planned meals, today's scheduled workout — instead of the separate pings the app currently sends for each. Written by the AI coach in one sentence, e.g. *"Readiness 82 — good day to hit legs. Lunch is planned, dinner needs prep by 6."* Depends on Pillar 4 (readiness) existing; otherwise reuses the push infra and MCP meal/workout data that's already there.

**2. Unified notification digest + quiet hours.** The app now has several independent push sources (workout reminders, log reminders, accountability nudges, and soon the morning briefing). Let users set quiet hours and choose "one digest" vs "individual pings" in Settings. Low effort, meaningfully reduces notification fatigue as the app adds more of these.

### Native platform (unlocked by the Capacitor apps)

**3. Home-screen / lock-screen widgets.** iOS/Android native widget showing streak, today's macros, and next scheduled workout — glanceable without opening the app. Capacitor supports native widget bridges on both platforms now that the shell exists.

**4. Apple Watch / Wear OS companion.** Quick-log a meal or set, glance at readiness score, rep counter during a workout. Phase 2 after the Apple Health integration above, since it needs HealthKit as a data bridge anyway.

### Gamification & social

**5. Streak insurance / freeze tokens.** Earn a "streak freeze" from badges or level-ups; spend one to protect a streak through a missed day. Same pattern Duolingo uses to cut streak-loss churn — cheap to build on top of the existing XP/badge system.

**6. Friendly Duels.** A lighter, faster version of Group Challenges (which is a bigger lift) — a 1v1, time-boxed bet between two accountability partners ("most workouts this week"). Natural stepping stone since `accountability_partners` already exists; ships before full challenges if that's too big a first slice.

**7. Year-in-Review / Wrapped recap.** Annual (or quarterly) shareable summary card — total workouts, PRs, streak record, macro adherence — reusing the level-card image-sharing code that already exists for gamification.

### Content loop

**8. AI visual progress comparison.** Pick two progress photos, get an AI-generated narrative of visible change plus a side-by-side. Reuses the same vision model already wired up for food-photo scanning and the Progress Photos storage bucket — mostly a prompt-and-UI job, not new infra.

**9. Recipe suggestions from food history.** When the same 3–4 food items get logged together repeatedly, prompt "turn this into a saved meal?" — nudges usage of the Saved Meals feature that already exists but currently requires the user to remember to do it manually.

---

## Updated Prioritisation Matrix

| Item | Impact | Feasibility | Recommended Sequencing |
|---|---|---|---|
| Readiness Score | Very High | Very High (Oura path is nearly free) | **Next up — start here** |
| Correlation Engine | Very High | High | **Next up — in parallel or right after** |
| Morning Briefing (#1) | High | High | After readiness ships |
| Grocery List | Medium | Very High | Cheap follow-on to nutrition planner |
| Streak Insurance (#5) | Medium | Very High | Cheap gamification add |
| Notification Digest (#2) | Medium | High | Ship alongside Morning Briefing |
| Friendly Duels (#6) | Medium | Medium | Lighter first slice of Group Challenges |
| AI Visual Comparison (#8) | Medium | High | Reuses existing vision pipeline |
| Recipe Suggestions (#9) | Low-Medium | High | Small, opportunistic |
| Widgets (#3) | High | Medium | Native-app follow-on |
| Group Challenges | Medium | Medium | After Friendly Duels validates the format |
| Apple Health / Google Fit | Very High | Medium (upgraded from Round 1) | Bigger lift, worth scoping given feasibility shift |
| Watch companion (#4) | Medium | Low | Depends on Apple Health landing first |
| Wrapped recap (#7) | Low | High | Nice-to-have, no urgency |

---

## Recommended Next Steps

1. **Readiness Score v1** — Oura-connected users get their real readiness score surfaced immediately (mostly UI + one table); non-Oura users get the client-side formula. This alone closes the biggest gap left from Round 1.
2. **Correlation Engine v1** — nightly cron computing the six correlation pairs into `insights_cache`, one insight card on the dashboard.
3. Pick 2–3 Round 2 ideas to scope in full — Morning Briefing and Grocery List are the cheapest wins and compound directly on top of #1 and #2.

*Document ends. This is a proposal for review — nothing above has been implemented. Flag which items you want built and I'll write full specs / start implementation.*
