-- Migration: AI-coach meal planning support for MCP tools
-- Mirrors the workout planning tables (workout_templates / scheduled_workouts):
-- mcp_meals is the reusable "recipe" catalogue, planned_meals is the per-day
-- schedule. Kept separate from the existing pantry/meal-plan-generator tables
-- (meal_plans, saved_meals, pantry_items) since those model a different
-- feature (AI meal generation from pantry contents, weekly JSONB blob) and
-- have no per-entry status/logging-link fields this feature needs.

-- ─── mcp_meals: reusable named meals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_meals (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    calories    NUMERIC NOT NULL DEFAULT 0,
    protein     NUMERIC NOT NULL DEFAULT 0,
    carbs       NUMERIC NOT NULL DEFAULT 0,
    fat         NUMERIC NOT NULL DEFAULT 0,
    tags        JSONB NOT NULL DEFAULT '[]',   -- ["lunch", "batch-cooked"]
    ingredients JSONB NOT NULL DEFAULT '[]',   -- ["chicken breast", "rice", ...] — display only
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One name per user (case-insensitive) so save_meal can upsert by name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_meals_user_name
ON mcp_meals(user_id, lower(name));

ALTER TABLE mcp_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own meals" ON mcp_meals;
CREATE POLICY "Users can manage their own meals" ON mcp_meals
    FOR ALL USING (auth.uid() = user_id);

-- ─── planned_meals: per-day schedule entries ────────────────────────────────
-- `slot` is a free-text column (not a DB CHECK) so the slot list stays
-- extensible from application code alone — see MEAL_SLOTS in route.ts.
CREATE TABLE IF NOT EXISTS planned_meals (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id           UUID REFERENCES mcp_meals(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,             -- denormalized meal name (ad-hoc or copied from mcp_meals)
    calories          NUMERIC NOT NULL DEFAULT 0, -- plan-time macro snapshot
    protein           NUMERIC NOT NULL DEFAULT 0,
    carbs             NUMERIC NOT NULL DEFAULT 0,
    fat               NUMERIC NOT NULL DEFAULT 0,
    scheduled_date    DATE NOT NULL,
    slot              TEXT NOT NULL,
    scheduled_time    TIME,
    notes             TEXT,
    status            TEXT NOT NULL DEFAULT 'planned', -- planned | logged | skipped
    skipped_reason    TEXT,
    linked_food_log_id TEXT,        -- id of the matching entry in daily_logs.food_items
    actual_calories   NUMERIC,      -- macros actually logged (may differ from the plan snapshot)
    actual_protein    NUMERIC,
    actual_carbs      NUMERIC,
    actual_fat        NUMERIC,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planned_meals_user_date
ON planned_meals(user_id, scheduled_date);

ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own planned meals" ON planned_meals;
CREATE POLICY "Users can manage their own planned meals" ON planned_meals
    FOR ALL USING (auth.uid() = user_id);
