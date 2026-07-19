-- Migration: supplement & medication tracking
-- Mirrors the coach meal-planning tables (mcp_meals / planned_meals):
-- supplements is the reusable per-user catalogue (kind discriminates
-- supplement vs medication), supplement_doses is the materialized per-day
-- schedule. Ad-hoc / as-needed (PRN) intake is logged straight into
-- supplement_doses with status 'taken' and no scheduled_time, so one table
-- holds the full intake history. Kept off daily_logs on purpose: doses are
-- multi-row-per-day data (the sleep_records precedent) and reminders must
-- fire regardless of whether the day row exists yet.

-- ─── supplements: reusable catalogue ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplements (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'supplement', -- supplement | medication (app-enforced)
    dose_amount NUMERIC,                            -- e.g. 500
    dose_unit   TEXT,                               -- mg | mcg | g | IU | ml | capsule | tablet | scoop | ...
    form        TEXT,                               -- capsule | tablet | powder | liquid | gummy | ...
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One name per user (case-insensitive) so save_supplement can upsert by name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplements_user_name
ON supplements(user_id, lower(name));

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own supplements" ON supplements;
CREATE POLICY "Users can manage their own supplements" ON supplements
    FOR ALL USING (auth.uid() = user_id);

-- ─── supplement_doses: per-day dose instances ───────────────────────────────
-- `status` is free text (not a DB CHECK) so states stay extensible from
-- application code alone: planned | taken | skipped.
CREATE TABLE IF NOT EXISTS supplement_doses (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id  UUID REFERENCES supplements(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,                  -- denormalized snapshot (survives catalogue deletion)
    kind           TEXT NOT NULL DEFAULT 'supplement',
    dose_amount    NUMERIC,                        -- snapshot at schedule/log time
    dose_unit      TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,                           -- NULL for ad-hoc / PRN logs
    status         TEXT NOT NULL DEFAULT 'planned',
    taken_at       TIMESTAMPTZ,
    skipped_reason TEXT,
    notes          TEXT,
    remind_minutes INTEGER,                        -- NULL = no reminder, 0 = at dose time
    reminder_sent  BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplement_doses_user_date
ON supplement_doses(user_id, scheduled_date);

ALTER TABLE supplement_doses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own supplement doses" ON supplement_doses;
CREATE POLICY "Users can manage their own supplement doses" ON supplement_doses
    FOR ALL USING (auth.uid() = user_id);
