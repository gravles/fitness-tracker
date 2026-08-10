# Watch Companion App — Feasibility & Design (WearOS-first)

**Author:** Claude
**Date:** 2026-07-17
**Status:** ✅ Shipped. This document is now historical — it describes the original design proposal.
The companion app was built largely as designed; see [CHANGELOG.md](../CHANGELOG.md) for what shipped
and `android/wear/` (module `:wear`, sideload instructions in `android/wear/README.md`) for the code.
**Target hardware:** Samsung Galaxy Watch Ultra (WearOS 5). Apple Watch covered as future work only (§9).

---

## 1. Verdict

**Building a WearOS companion is highly feasible, and cheaper than it looks — because the backend already exists.**

The app exposes a documented, multi-user, API-key-authenticated JSON-RPC server at `POST /api/mcp` ([src/app/api/mcp/route.ts](../src/app/api/mcp/route.ts), reference: [docs/mcp-tools.md](mcp-tools.md)) whose 18 tools already cover every watch use case: reading the schedule and templates, logging strength sessions set-by-set, logging food, and updating the daily log. The AI layer that turns "chicken wrap, about 600 calories" into a structured log already exists (`processVoiceIntent()` in [src/lib/ai.ts](../src/lib/ai.ts)). The live-workout UX (elapsed timer, per-set logging, rest timer) already exists as a web reference implementation to copy from ([src/app/workout/active/[id]/page.tsx](../src/app/workout/active/%5Bid%5D/page.tsx), [src/components/RestTimer.tsx](../src/components/RestTimer.tsx), [src/components/WorkoutSpotter.tsx](../src/components/WorkoutSpotter.tsx)).

What does *not* exist is any native client code — the Capacitor `android/` and `ios/` shells are thin WebViews loading `https://fit.nathandavie.com` and share nothing with a watch app. So the project is: **a native Kotlin / Compose for Wear OS front-end over an API that is already done**, plus roughly a day of small backend prerequisites (§7).

Recommended shape: WearOS only, three tiers (§4), starting with live workout logging + voice food logging + a glanceable tile. Defer passive health sync (sleep/HRV) and Apple Watch.

---

## 2. Why a watch, specifically

The watch wins wherever the phone is the wrong form factor mid-activity:

| Moment | Today | With watch |
|---|---|---|
| Between sets at the gym | Phone out of pocket, unlock, find the active-workout tab, tap | Glance at wrist: rest countdown with haptic buzz, next set pre-filled, crown to adjust reps/weight |
| Logging food while cooking / out | Phone, app, AI food entry | Raise wrist, dictate one sentence, confirm on a card |
| "Did I hit protein today?" | Open app | Watch-face complication shows remaining protein/calories |
| Heart rate during a session | Not captured (only Strava imports have HR) | Captured automatically by the watch during every logged session |

The last row is new *data*, not just new convenience: the `workouts` table already has `average_heartrate` / `max_heartrate` / calorie columns (added by `strava_metrics_migration.sql` for Strava imports) that sit empty for every in-app session. A watch fills them for free.

---

## 3. What already exists (the leverage)

| Asset | Where | What the watch reuses |
|---|---|---|
| External API, 18 tools | `POST /api/mcp` — [src/app/api/mcp/route.ts](../src/app/api/mcp/route.ts), docs in [docs/mcp-tools.md](mcp-tools.md) | The entire watch backend. JSON-RPC 2.0 over HTTPS; CORS open; errors as plain-English tool results |
| Per-user API keys | `mcp_api_keys` table (`user_id`, `key_hash` SHA-256, `name`, `created_at`, `last_used_at`); minted at [src/app/api/mcp/keygen/route.ts](../src/app/api/mcp/keygen/route.ts); `Bearer ftk_…` | Watch authenticates exactly like the Claude connector does today |
| Voice → structured intent | `processVoiceIntent()` in [src/lib/ai.ts](../src/lib/ai.ts), exposed at `/api/ai/process-intent` | Watch sends the speech transcript; server returns the structured logging action |
| Live workout UX patterns | [workout/active/[id]/page.tsx](../src/app/workout/active/%5Bid%5D/page.tsx) (timer, per-set logging, draft autosave), [RestTimer.tsx](../src/components/RestTimer.tsx) | Screen-by-screen blueprint for the wrist session flow |
| Voice rep counting | [WorkoutSpotter.tsx](../src/components/WorkoutSpotter.tsx) (Web Speech API + wake lock) | Concept ports to Tier 2 voice set-logging |
| HR/calorie schema | `strava_metrics_migration.sql` columns on `workouts` | Home for watch-captured session metrics |
| Native project shells | `android/`, `ios/` (Capacitor 8, app id `com.nathandavie.fitnesstracker`) | Gradle project to host the `wear/` module; shared signing/app identity |

**MCP tools the watch consumes** (all existing, verbatim from [docs/mcp-tools.md](mcp-tools.md)):

- Read: `get_user_profile` (targets for the tile), `get_daily_logs` (today's totals), `get_schedule` (planned workouts, with `id`/`status`/`exercises`), `get_workout_templates` (exercises, rep ranges, `rest_seconds` — this drives the rest timer), `get_meal_plan` (today's planned meals for one-tap logging)
- Write: `log_workout` (`activity_type`, `duration_mins`, `intensity`, `calories`, `exercises: [{ exercise_name, sets: [{ reps, weight_lbs }] }]`, `scheduled_workout_id` — auto-completes the day's scheduled entry), `log_food` (`name`, `calories`, macros, `planned_meal_id` for plan-based logging), `update_daily_log` (sleep/energy 1–5, `alcohol_drinks`, `daily_note`), `update_scheduled_workout` (skip with reason, swap to fallback)

---

## 4. Recommended feature set (tiered)

### Tier 1 — v1 "wrist logging" (build this to validate the whole idea)

**W1. Live workout session on wrist** — the flagship.
- Start from today's `get_schedule` entry or pick a template (`get_workout_templates`).
- Per-exercise screen: current set number, target rep range, last weight used pre-filled; **rotary crown** steppers for reps/weight (no keyboard, ever).
- On set completion: haptic tick, **rest timer** seeded from the template's `rest_seconds`, strong haptic + vibration pattern at zero. This alone justifies the app — it's the interaction the phone is worst at.
- Health Services `ExerciseClient` runs an exercise session for the duration: continuous HR, calorie estimate, ambient-mode-safe ongoing activity.
- Finish → single `log_workout` call with exercises/sets, `duration_mins`, `calories`, HR fields (§7.2), and `scheduled_workout_id` so the schedule flips to `completed` automatically.

**W2. Voice food logging** — the ~5-second interaction.
- Complication/tile shortcut → system speech input (`RemoteInput`/`RecognizerIntent`; on-device STT on the Watch Ultra) → transcript to `/api/ai/process-intent` (after §7.1 adds auth) → confirmation card showing parsed name/calories/macros → tap to confirm → `log_food`.
- If today's `get_meal_plan` has a matching planned meal, offer "log as planned" via `planned_meal_id` so plan-vs-actual stays intact.

**W3. Today tile + complications.**
- Tile: calories & protein remaining (targets from `get_user_profile` minus `get_daily_logs` actuals), next scheduled workout with time, streak. Tap targets: start workout / log food by voice.
- Complications (watch-face): calories remaining (ranged value), next workout (short text).

**W4. Pairing & auth** — see §6.

### Tier 2 — v1.x (after the v1 loop is proven on-wrist)

- **Voice set logging mid-workout**: "185 for 8" between sets — port the WorkoutSpotter concept through `processVoiceIntent` (or parse the simple `weight × reps` grammar on-device to avoid a network hop mid-set).
- **Offline queue**: gyms have bad signal. Room DB for the active session + queued `log_workout`/`log_food` payloads; WorkManager flushes with retry when connectivity returns. The active session should *never* depend on the network — only start (template fetch, cacheable) and finish (log, queueable) touch the API.
- **Quick daily-log entry**: 1–5 pickers for sleep/energy + alcohol count → `update_daily_log`. Natural on the wrist first thing in the morning.
- **Skip/swap from the wrist**: `update_scheduled_workout` — "skip today (reason)" or "swap to fallback" when short on time, matching the existing fallback-workout feature.
- **Standalone LTE**: nothing to build — the watch talks HTTPS directly to the Vercel API, so it already works phone-free on Wi-Fi/LTE. Just verify and advertise it.

### Tier 3 — future / explicitly deferred

- **Passive health sync (sleep stages, HRV, daily steps, resting HR)** via Health Connect / Health Services passive monitoring. *Deferred because the schema isn't ready*: [PRD-EXPANDED-FEATURES.md](../PRD-EXPANDED-FEATURES.md) already flags that Oura's rich sleep/readiness data is being lossily squashed into `daily_logs.sleep_quality`/`energy_level` 1–5 fields, and a proper `sleep_records`-style table is the prerequisite (Pillar 4/6 gap). Building watch passive sync before that schema exists would create a *second* lossy pipeline plus an Oura-vs-watch dedupe problem. Do the Recovery/Readiness schema work first; the watch then becomes another feed into it.
- **Samsung BIA body composition** (the Watch Ultra's bioimpedance sensor → `body_metrics`). Genuinely attractive — but it requires the **Samsung Health / Samsung Privileged Health SDK, which is partner-gated** (application + approval, not a public API). Treat as uncertain until access is confirmed; do not design around it.
- **Watch-face data richness** (HR zones during workout, weekly volume complication), **partner nudges on wrist** (push via existing FCM plumbing — [docs/push-notifications-setup.md](push-notifications-setup.md)).
- **Apple Watch port** — §9.

---

## 5. Architecture

```
Galaxy Watch Ultra                        Vercel (existing)
┌─────────────────────────┐               ┌──────────────────────────┐
│ wear/ module (Kotlin)   │   HTTPS       │ POST /api/mcp            │
│  Compose for Wear OS    │──JSON-RPC────▶│  (18 tools, ftk_ keys)   │
│  Health Services (HR)   │               │ POST /api/ai/            │
│  Tiles + Complications  │               │   process-intent (§7.1)  │
│  Room (offline queue)   │               │ POST /api/pair/* (§6)    │
│  EncryptedSharedPrefs   │               └──────────┬───────────────┘
└─────────────────────────┘                          │ Supabase
                                                     ▼ (unchanged)
        (no phone relay — standalone HTTPS; the Capacitor
         phone app shares nothing with the watch app)
```

Decisions:

- **New `wear/` Gradle module inside the existing `android/` project.** Kotlin, Compose for Wear OS + Horologist (scaffolding, rotary input, tiles helpers), Health Services API for exercise HR/calories, Wear Tiles + Complications Data Source APIs. Same app id family (`com.nathandavie.fitnesstracker.wear`), same signing.
- **Direct-to-API, no phone relay.** The watch calls `https://fit.nathandavie.com/api/mcp` itself (OkHttp + kotlinx.serialization; JSON-RPC is a trivial envelope — one `callTool(name, args)` function). This keeps the watch fully standalone (LTE/Wi-Fi) and avoids Wearable Data Layer complexity entirely. The phone app is irrelevant to the watch except as one place to complete pairing.
- **The MCP endpoint is the product API.** No parallel REST facade. Tool names/params above are the contract; anything the watch needs that MCP lacks gets added as an MCP tool param (§7.2), keeping Claude-connector and watch capabilities in lockstep.
- **API key in `EncryptedSharedPreferences`**; sent as `Authorization: Bearer ftk_…` exactly like the existing connector.
- **Offline stance (Tier 2, but architect for it from day one):** repository layer returns cached templates/schedule from Room; writes go to an outbox table flushed by WorkManager. v1 can ship online-only but with the repository seam in place.

---

## 6. Pairing & auth design

Problem: keys are minted via [keygen/route.ts](../src/app/api/mcp/keygen/route.ts), which requires a Supabase JWT (logged-in browser session). A watch has no browser login and typing a 44-char `ftk_` key on a 1.5" screen is a non-starter.

**Design: short-code device pairing** (the standard TV-app pattern), reusing `mcp_api_keys` unchanged. The watch generates its own `ftk_` key locally and only ever sends the SHA-256 hash — **the plaintext key never touches the server or the network**:

1. **Watch:** generates `ftk_` + 20 random bytes locally, then `POST /api/pair/start` with `{ key_hash: sha256(key), device_name }` → server stores `{ code_hash, key_hash, expires_at }` in a `pairing_requests` table and returns a **6-character code** (unambiguous alphabet, no 0/O/1/I/L). Watch displays it.
2. **Phone/web (already authenticated):** Settings → "Pair a device"; user types the code. `POST /api/pair/claim` (JWT-authed, same `getUserId` helper as keygen) verifies the code and inserts the stored `key_hash` into `mcp_api_keys` with the device name.
3. **Watch:** polls `POST /api/pair/poll` (with the code) every ~3s; on `{ status: "claimed" }` it starts using the key it already holds (stored in `EncryptedSharedPreferences`); the pairing row is deleted.

Codes: single-use, ~5-minute expiry. Revocation already works — deleting the key from Settings (existing keygen DELETE) instantly de-authorizes the watch, which falls back to the pairing screen on its next 401.

*Implemented as designed (2026-07-17): `pairing_migration.sql`, [src/app/api/pair/start/route.ts](../src/app/api/pair/start/route.ts), [claim/route.ts](../src/app/api/pair/claim/route.ts), [poll/route.ts](../src/app/api/pair/poll/route.ts), helpers in [src/lib/pairing.ts](../src/lib/pairing.ts).*

Rejected alternatives: typing the key on-watch (unusable), QR (watches display QR well but can't scan one, and the phone app is a WebView with no scanner wired to this flow).

---

## 7. Backend prerequisites (small — hours, not days)

Everything below is the *complete* list of server-side work; every feature in Tiers 1–2 otherwise runs on the API as it exists today.

1. **Authenticate `/api/ai/process-intent`.** ⚠️ [Its route](../src/app/api/ai/process-intent/route.ts) currently has **no auth at all** — anyone who finds the URL can spend Anthropic credits. Add the same `ftk_` key check the MCP route uses (accept Supabase JWT too, for the web app). **Worth doing immediately, watch or no watch.**
2. **Extend `log_workout` with `average_heartrate` and `max_heartrate`** (optional numbers). The `workouts` columns already exist from the Strava migration; this is a tool-schema + insert change in [route.ts](../src/app/api/mcp/route.ts). No migration.
3. **Pairing endpoints** (§6): one `pairing_requests` table + three small routes that reuse the existing keygen logic.
4. *(Nice-to-have, not blocking)* A `get_today` convenience tool bundling profile targets + today's log + next scheduled workout in one round-trip for the tile, instead of three calls on a constrained radio. The tile can ship with three calls; add this if refresh latency annoys.

---

## 8. Effort & risk

### Sizing (order-of-magnitude, single developer)

| Chunk | Estimate |
|---|---|
| Backend prerequisites (§7.1–7.3) | ~1 day |
| Watch scaffold: project, API client, pairing flow, encrypted storage | ~1–2 weekends |
| W1 live workout (session UI, crown input, rest timer, Health Services HR) | ~2–3 weekends — the bulk of v1 |
| W2 voice food logging | ~1 weekend |
| W3 tile + complications | ~1 weekend |
| Tier 2 offline queue | ~1–2 weekends |

Call Tier 1 **roughly 5–7 weekends** for someone new to Compose for Wear OS (less if the pattern-copying from the web active-workout page goes smoothly). Distribution: personal use needs only developer-mode sideload or a Play internal-testing track — no store review burden.

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Native Kotlin/Compose-for-Wear learning curve (codebase is all TypeScript) | Medium | Horologist samples are strong; the app is small and screen-simple; the web active-workout page is a complete behavioral spec |
| Samsung BIA SDK is partner-gated | Low (Tier 3 only) | Explicitly deferred; don't promise it |
| Battery during long HR-tracked sessions | Low-Med | Health Services batching + ambient mode are designed for exactly this; a 60–90 min session is well within normal |
| Gym connectivity | Medium | Tier 2 offline queue; v1 mitigates by fetching the template at session start and logging at the end (one call each side) |
| JSON-RPC verbosity on watch radio | Low | Payloads are ~1–4 KB; fine. §7.4 `get_today` if tile refresh feels slow |
| Two clients drift from one API | Low | MCP-as-product-API rule (§5) keeps watch and Claude connector on the same contract |
| Passive-sync scope creep | Medium | Tier 3 gate: no passive health data until the `sleep_records` schema (PRD Pillar 4/6) exists |

---

## 9. Apple Watch (future work — brief by design)

A watchOS port would be: SwiftUI app + `HKWorkoutSession`/`HKLiveWorkoutBuilder` for HR, the **same MCP API and the same §6 pairing flow completely unchanged**, WidgetKit complications. The server work done for WearOS transfers 100%.

Why wait: (a) no Apple Watch on hand to dogfood — the Watch Ultra is the device actually on Nathan's wrist; (b) watchOS apps require an iOS companion target with entitlements, heavier than the current WebView shell; (c) WearOS validates whether wrist logging changes behavior before paying a second-platform tax. Revisit only if the WearOS app proves sticky and an Apple-side user exists.

---

## 10. Recommendation

**Worth building — as a WearOS-only Tier 1, treated as a hobby-scale native project (~5–7 weekends) rather than a platform investment.** The decisive facts: the backend is already finished and documented, the two features that matter most on a wrist (rest-timer set logging and one-sentence voice food entry) map one-to-one onto existing MCP tools and existing AI plumbing, and the watch adds heart-rate data the schema already has empty columns for. The main cost is learning Compose for Wear OS, not building infrastructure.

Suggested sequence if greenlit:
1. §7.1 auth fix (immediately, regardless of the watch decision)
2. §7.2–7.3 backend prerequisites + Settings "Pair a device" UI
3. Watch scaffold + pairing + W3 tile (proves the end-to-end loop cheaply)
4. W1 live workout, then W2 voice food logging
5. Reassess before Tier 2/3
