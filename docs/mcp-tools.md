# MCP Tools Reference

The app exposes an MCP server at `POST /api/mcp` (JSON-RPC 2.0, protocol `2024-11-05`).
Authenticate with an API key generated in **Settings → Claude Connector**, passed either as
`Authorization: Bearer <key>` or `?key=<key>`.

All dates are `YYYY-MM-DD`; times are `HH:MM` 24-hour, stored in the user's local timezone.
"Today" defaults resolve in the user's stored IANA timezone (`user_settings.timezone`, kept in
sync by the web app), falling back to the server clock (UTC) when unset.
Tool errors come back as MCP tool results with `isError: true` and a plain-English message.

## Read tools

| Tool | Purpose | Arguments (defaults) |
|---|---|---|
| `get_user_profile` | Goal, targets, level/XP, equipment | none |
| `get_readiness` | Today's readiness 0–100, label (`primed`/`ready`/`steady`/`recovery`), recommendation, components (sleep, energy, alcohol, training load) | none |
| `get_daily_logs` | Nutrition, sleep, energy, notes per day | `start_date` (7 days ago), `end_date` (today) |
| `get_workouts` | Logged sessions incl. strength sets | `start_date` (30 days ago), `end_date` (today) |
| `get_body_metrics` | Weight + measurements | `days` (90, max 365) |
| `get_workout_templates` | Saved templates with exercises and fallbacks (+ progression fields, see below) | none |
| `get_schedule` | Planned workouts with derived status | `start_date` (today), `end_date` (start + 6 days) |
| `get_meals` | Saved meals with macros, tags, ingredients | none |
| `get_meal_plan` | Planned meals per day, with plan-vs-actual totals | `start_date` (today), `end_date` (start + 6 days) |
| `get_supplements` | Supplement/medication catalogue with each entry's schedule summary | none |
| `get_supplement_schedule` | Scheduled + logged doses per day, with adherence stats | `start_date` (today), `end_date` (start + 6 days) |

## Write tools

### `log_food`
Add a food item to the day's nutrition log.
`name`*, `calories`*, `protein`, `carbs`, `fat`, `date` (today), `planned_meal_id`.

Pass `planned_meal_id` (from `get_meal_plan`) to log against a planned meal instead — its macros
become the defaults, any of `name`/`calories`/`protein`/`carbs`/`fat` you also pass override just
that field with what was actually eaten, `date` defaults to the plan's own date, and the planned
entry is marked `logged`. `name`/`calories` are only required when `planned_meal_id` is omitted.
A planned meal is **never** added to daily totals until logged this way — `get_daily_logs` only
ever reports actuals.

### `log_workout`
Log a completed session and (automatically) mark the day's scheduled entry completed.

- `activity_type`* — e.g. `Running`, `Strength Training`
- `duration_mins` (45), `intensity` (`Light|Moderate|Hard`, default `Moderate`), `calories`, `notes`, `date` (today)
- `average_heartrate`, `max_heartrate` — bpm over the session, e.g. from a watch (optional)
- `exercises` — strength logging: `[{ exercise_name, sets: [{ reps, weight_lbs }] }]`
- `scheduled_workout_id` — entry id from `get_schedule` to mark completed; if omitted, the first
  still-planned entry on the same date is matched.

```json
{ "activity_type": "Strength Training", "duration_mins": 60, "intensity": "Hard",
  "exercises": [{ "exercise_name": "Bench Press",
                  "sets": [{ "reps": 8, "weight_lbs": 155 }, { "reps": 7, "weight_lbs": 155 }] }] }
```

### `update_daily_log`
`date` (today), `sleep_quality` (1–5), `energy_level` (1–5), `alcohol_drinks`, `daily_note`.

### `save_workout_template`
Create or update a reusable template. **Upserts by name, case-insensitive.**

- `name`* — e.g. `"Upper A"`
- `description`
- `exercises`* — `[{ exercise_name*, sets*, rep_range* ("8-12"), rest_seconds (60), notes, order (array position) }]`
- `fallback_exercises` — same shape; a shortened minimum version of the workout for
  low-time/low-energy days.

### `schedule_workout`
Assign a workout to a date (status starts as **planned**). Exactly one of:

- `template_name` — a saved template (see `get_workout_templates`), or
- `activity_type` — ad-hoc cardio, e.g. `"Rowing"`

Plus: `date`*, `time` (12:00), `duration_mins` (60 or the template's estimated duration), `notes`,
and optional `recurrence: { days_of_week: ["mon","thu"], until: "YYYY-MM-DD" }` to create a repeating
pattern in one call. Recurrence is **capped at 90 days** from the start date; anything beyond is
dropped and reported in the response `note`.

```json
{ "date": "2026-07-06", "template_name": "Upper A",
  "recurrence": { "days_of_week": ["mon", "thu"], "until": "2026-08-31" } }
```

### `get_schedule`
Returns entries with `id`, `date`, `time`, `title`, `status`, `skipped_reason`, `exercises`
(the fallback list if the entry was swapped to it), and `completed_workout_id`.

**Progression fields** (on `exercises` here and in `get_workout_templates`, when the exercise has
weighted history in the last 90 days): `last_weight_lbs`, `last_reps` (reps at that weight, most
recent session), `suggested_weight_lbs`, and `progression` — `increase` (+5 lbs; every set hit the
top of the rep range last time) or `repeat`.

Status is derived: `planned` → `completed` (via `log_workout`) / `skipped` (via
`update_scheduled_workout`) / `missed` (still planned after the day has passed with no logged session).

### `update_scheduled_workout`
Change one scheduled entry by `scheduled_workout_id`* (from `get_schedule`):

- `new_date`, `new_time` — move it
- `template_name` — swap to another template
- `use_fallback: true|false` — switch between the full session and the shortened fallback version
- `status: "skipped"` + `reason`, or `status: "planned"` to restore

### `save_meal`
Create or update a reusable meal. **Upserts by name, case-insensitive.**

- `name`* — e.g. `"Fajita chicken bowl"`
- `calories`* — macros are entered directly on the meal, not derived from `ingredients`
- `protein` (0), `carbs` (0), `fat` (0)
- `tags` — e.g. `["lunch", "batch-cooked"]`
- `ingredients` — plain string list, **display only**, not used for macro calculation

### `plan_meal`
Assign a meal to a date and slot (status starts as **planned**). Exactly one of:

- `meal_name` — a saved meal (see `get_meals`), or
- `name` + `calories` (+ optional `protein`/`carbs`/`fat`) — a one-off ad-hoc meal

Plus: `date`*, `slot`* (see below), `time` (optional HH:MM), `notes`, and optional
`recurrence: { days_of_week: [...], until: "YYYY-MM-DD" }`, capped at **90 days** same as
`schedule_workout` — anything beyond is dropped and reported in the response `note`.

Slots are `break_fast`, `lunch`, `snack`, `dinner`, `closer` — a plain string column, not a DB enum,
so the list can be extended by editing `MEAL_SLOTS` in `route.ts` alone (no migration needed).

```json
{ "date": "2026-07-06", "meal_name": "Fajita chicken bowl", "slot": "lunch",
  "recurrence": { "days_of_week": ["mon", "wed", "fri"], "until": "2026-08-31" } }
```

### `get_meal_plan`
Returns one entry per day in range: `{ date, entries, planned_totals, logged_totals }`.

Each entry has `id`, `date`, `slot`, `time`, `meal_name`, macros, `status`
(`planned`/`logged`/`skipped`), `skipped_reason`, `notes`, `linked_food_log_id`.

- `planned_totals` — sum of macros for all non-skipped entries that day (the intended plan)
- `logged_totals` — sum of the *actual* macros recorded for entries already `logged` (may differ
  from the plan if `log_food`/`log_planned_meal` overrode values)

Planned meals are excluded from `get_daily_logs` totals until logged — no double counting.

### `update_planned_meal`
Change one planned entry by `planned_meal_id`* (from `get_meal_plan`):

- `new_date`, `new_slot`, `new_time` — move it
- `meal_name` — swap to a different saved meal (recalculates macros)
- `status: "skipped"` + `reason`, or `status: "planned"` to restore
- `notes`

### `log_planned_meal`
Convenience one-call "ate what I planned": equivalent to `log_food` with `planned_meal_id`, always
dated to the plan's own date. `planned_meal_id`*, `adjustments` (partial override of
`name`/`calories`/`protein`/`carbs`/`fat`).

```json
{ "planned_meal_id": "abc-123", "adjustments": { "calories": 700 } }
```

### `save_supplement`
Create or update an entry in the supplement/medication catalogue. **Upserts by name,
case-insensitive.** Record exactly what the user tells you — never suggest doses, frequencies, or
changes to medications; that's between the user and their prescriber.

- `name`*
- `kind` — `supplement` (default) or `medication`
- `dose_amount`, `dose_unit` — default dose, e.g. `500` / `"mg"`
- `form`, `notes`

```json
{ "name": "Creatine", "dose_amount": 5, "dose_unit": "g", "form": "powder" }
```

### `schedule_supplement`
Schedule doses of a saved supplement/medication (status starts as **planned**). Pass multiple
`times` for multi-dose days.

- `supplement_name`* — must already exist (see `get_supplements` / `save_supplement`)
- `date`* — start date; with `recurrence`, doses are created on matching weekdays from this date
- `times` — array of `HH:MM`
- `remind` — push reminder at each dose time (default `true`)
- `notes`
- `recurrence: { days_of_week: [...], until: "YYYY-MM-DD" }` — capped at **90 days**, same as
  `schedule_workout` / `plan_meal`

```json
{ "supplement_name": "Creatine", "date": "2026-07-20", "times": ["08:00"],
  "recurrence": { "days_of_week": ["mon","tue","wed","thu","fri","sat","sun"], "until": "2026-09-30" } }
```

### `log_supplement`
Record that a dose was taken. Pass `dose_id` (from `get_supplement_schedule`) to mark a scheduled
dose taken, or `supplement_name` for an ad-hoc / as-needed intake — unknown names are allowed, with
`dose_amount`/`dose_unit` passed inline. `time` optional (ad-hoc only).

```json
{ "dose_id": "abc-123" }
```
```json
{ "supplement_name": "Ibuprofen", "dose_amount": 400, "dose_unit": "mg" }
```

### `update_scheduled_supplement`
Change a scheduled dose by `dose_id`* (from `get_supplement_schedule`):

- `new_date`, `new_time` — move it
- `status: "skipped"` + `reason`, or `status: "planned"` to restore (taking a dose happens via
  `log_supplement`, not here)
- `apply_to_future_doses: true` with `status: "skipped"` — also deletes all future planned doses of
  the same supplement (i.e. the user stopped taking it). **Confirm with the user before doing this.**

```json
{ "dose_id": "abc-123", "status": "skipped", "reason": "stomach upset" }
```

## Storage

Templates live in `workout_templates` (JSONB `exercises` / `fallback_exercises`), schedule entries in
`scheduled_workouts` — the same tables the app UI reads, so coach-pushed plans appear on the
dashboard "Next workout" tile and the Schedule week view immediately. DB migration:
[`coach_scheduling_migration.sql`](../coach_scheduling_migration.sql).

Meals live in `mcp_meals`, planned meal entries in `planned_meals` — new tables dedicated to this
feature, kept separate from the existing pantry/AI-meal-generator tables (`meal_plans`,
`saved_meals`, `pantry_items`), which model a different feature (weekly JSONB meal blobs generated
from pantry contents) with no per-entry status or logging-link fields. DB migration:
[`coach_meal_planning_migration.sql`](../coach_meal_planning_migration.sql).

Supplement/medication catalogue entries live in `supplements`; scheduled and logged doses in
`supplement_doses`, which snapshots the name/dose at schedule time so history survives a later edit
or deletion of the catalogue entry. Same tables the `/supplements` page reads, RLS owner-only. DB
migration: [`supplement_tracking_migration.sql`](../supplement_tracking_migration.sql).
