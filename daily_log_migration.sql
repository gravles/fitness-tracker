-- Add nutrition_logged boolean to daily_logs table
ALTER TABLE daily_logs
ADD COLUMN nutrition_logged BOOLEAN DEFAULT TRUE;
