-- Add extended metrics columns to the workouts table
ALTER TABLE workouts 
ADD COLUMN IF NOT EXISTS distance float, -- in meters
ADD COLUMN IF NOT EXISTS calories int,
ADD COLUMN IF NOT EXISTS average_heartrate float,
ADD COLUMN IF NOT EXISTS max_heartrate float,
ADD COLUMN IF NOT EXISTS elevation_gain float, -- in meters
ADD COLUMN IF NOT EXISTS average_speed float; -- in meters/second
