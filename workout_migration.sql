-- Add available_equipment to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS available_equipment text[] DEFAULT '{}';

-- Create Workout Templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Template Exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  order_index integer DEFAULT 0,
  target_sets integer DEFAULT 3,
  target_reps text DEFAULT '10', -- text to allow "8-12" or "Failure"
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Workout Exercises (for actual performed workouts, linked to the daily 'workouts' log)
-- Note: existing 'workouts' table is used as the session header.
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Workout Sets (Detailed logs per exercise)
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id uuid REFERENCES workout_exercises(id) ON DELETE CASCADE NOT NULL,
  set_number integer NOT NULL,
  weight numeric, -- kg/lbs
  reps integer,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own templates" ON workout_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own template exercises" ON template_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_templates 
      WHERE workout_templates.id = template_exercises.template_id 
      AND workout_templates.user_id = auth.uid()
    )
  );

-- For workout_exercises, we need to join back to workouts -> user_id
CREATE POLICY "Users can manage their own workout exercises" ON workout_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own workout sets" ON workout_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_exercises 
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workout_exercises.id = workout_sets.exercise_id 
      AND workouts.user_id = auth.uid()
    )
  );
