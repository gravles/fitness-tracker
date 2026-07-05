# MCP Tools Reference

The app exposes an MCP server at `POST /api/mcp` (JSON-RPC 2.0, protocol `2024-11-05`).
Authenticate with an API key generated in **Settings → Claude Connector**, passed either as
`Authorization: Bearer <key>` or `?key=<key>`.

All dates are `YYYY-MM-DD`; times are `HH:MM` 24-hour, stored in the user's local timezone.
Tool errors come back as MCP tool results with `isError: true` and a plain-English message.

## Read tools

| Tool | Purpose | Arguments (defaults) |
|---|---|---|
| `get_user_profile` | Goal, targets, level/XP, equipment | none |
| `get_daily_logs` | Nutrition, sleep, energy, notes per day | `start_date` (7 days ago), `end_date` (today) |
| `get_workouts` | Logged sessions incl. strength sets | `start_date` (30 days ago), `end_date` (today) |
| `get_body_metrics` | Weight + measurements | `days` (90, max 365) |
| `get_workout_templates` | Saved templates with exercises and fallbacks | none |
| `get_schedule` | Planned workouts with derived status | `start_date` (today), `end_date` (start + 6 days) |

## Write tools

### `log_food`
Add a food item to the day's nutrition log.
`name`*, `calories`*, `protein`, `carbs`, `fat`, `date` (today).

### `log_workout`
Log a completed session and (automatically) mark the day's scheduled entry completed.

- `activity_type`* — e.g. `Running`, `Strength Training`
- `duration_mins` (45), `intensity` (`Light|Moderate|Hard`, default `Moderate`), `calories`, `notes`, `date` (today)
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

Status is derived: `planned` → `completed` (via `log_workout`) / `skipped` (via
`update_scheduled_workout`) / `missed` (still planned after the day has passed with no logged session).

### `update_scheduled_workout`
Change one scheduled entry by `scheduled_workout_id`* (from `get_schedule`):

- `new_date`, `new_time` — move it
- `template_name` — swap to another template
- `use_fallback: true|false` — switch between the full session and the shortened fallback version
- `status: "skipped"` + `reason`, or `status: "planned"` to restore

## Storage

Templates live in `workout_templates` (JSONB `exercises` / `fallback_exercises`), schedule entries in
`scheduled_workouts` — the same tables the app UI reads, so coach-pushed plans appear on the
dashboard "Next workout" tile and the Schedule week view immediately. DB migration:
[`coach_scheduling_migration.sql`](../coach_scheduling_migration.sql).
