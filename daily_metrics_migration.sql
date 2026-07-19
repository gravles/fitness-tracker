-- Daily passive metrics from Health Connect (steps merged across sources,
-- resting heart rate from the watch). Live on daily_logs since they're
-- one-value-per-day, same as the rest of the row.
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS steps integer;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS resting_heartrate integer;
