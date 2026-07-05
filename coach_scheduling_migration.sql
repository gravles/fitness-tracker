-- Migration: AI-coach scheduling support for MCP tools
-- Run this in the Supabase SQL editor (safe to re-run).

-- Templates gain a shortened "minimum version" of the workout for
-- low-time / low-energy days. Same JSONB shape as the exercises column:
-- [{"name": "...", "sets": 3, "reps": "8-12", "rest": 90, "notes": "...", "order": 1}]
ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS fallback_exercises JSONB NOT NULL DEFAULT '[]';

-- Scheduled workouts gain a skip reason and a flag that the fallback
-- (shortened) version of the template should be used for the session.
ALTER TABLE scheduled_workouts
ADD COLUMN IF NOT EXISTS skipped_reason TEXT,
ADD COLUMN IF NOT EXISTS use_fallback BOOLEAN NOT NULL DEFAULT FALSE;

-- One template name per user so the MCP save_workout_template tool can
-- upsert by name. Public seed templates (author_id IS NULL) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_templates_author_name
ON workout_templates(author_id, lower(name)) WHERE author_id IS NOT NULL;
