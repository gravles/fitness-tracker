-- Add food_items JSONB column to daily_logs table
ALTER TABLE daily_logs
ADD COLUMN food_items JSONB DEFAULT '[]'::jsonb;
