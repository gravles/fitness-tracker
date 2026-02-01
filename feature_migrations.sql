-- Feature Enhancement Migrations
-- Run this in Supabase SQL Editor

-- =====================================================
-- PROGRESS PHOTOS TABLE
-- =====================================================
DROP TABLE IF EXISTS progress_photos CASCADE;
CREATE TABLE progress_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    weight_at_capture DECIMAL(5,1),
    body_fat_at_capture DECIMAL(4,1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient user queries
CREATE INDEX idx_progress_photos_user_date 
ON progress_photos(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own progress photos" ON progress_photos;
CREATE POLICY "Users can view their own progress photos"
ON progress_photos FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own progress photos" ON progress_photos;
CREATE POLICY "Users can insert their own progress photos"
ON progress_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own progress photos" ON progress_photos;
CREATE POLICY "Users can delete their own progress photos"
ON progress_photos FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- USER GOALS TABLE
-- =====================================================
DROP TABLE IF EXISTS user_goals CASCADE;
CREATE TABLE user_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('lose_weight', 'build_muscle', 'maintain', 'improve_fitness', 'custom')),
    title TEXT NOT NULL,
    description TEXT,
    target_value DECIMAL(10,2),
    target_unit TEXT,
    current_value DECIMAL(10,2),
    target_date DATE,
    ai_recommendations JSONB,
    is_active BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active goals
CREATE INDEX idx_user_goals_active 
ON user_goals(user_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own goals" ON user_goals;
CREATE POLICY "Users can manage their own goals"
ON user_goals FOR ALL
USING (auth.uid() = user_id);

-- =====================================================
-- WORKOUT TEMPLATES TABLE
-- =====================================================
DROP TABLE IF EXISTS workout_templates CASCADE;
CREATE TABLE workout_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('strength', 'cardio', 'hiit', 'flexibility', 'custom')),
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    exercises JSONB NOT NULL DEFAULT '[]',
    estimated_duration INTEGER,
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for browsing templates
CREATE INDEX idx_workout_templates_public 
ON workout_templates(is_public, category, difficulty) WHERE is_public = true;

CREATE INDEX idx_workout_templates_author 
ON workout_templates(author_id);

-- RLS Policies
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public templates" ON workout_templates;
CREATE POLICY "Anyone can view public templates"
ON workout_templates FOR SELECT
USING (is_public = true OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can create templates" ON workout_templates;
CREATE POLICY "Users can create templates"
ON workout_templates FOR INSERT
WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
CREATE POLICY "Users can update their own templates"
ON workout_templates FOR UPDATE
USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON workout_templates;
CREATE POLICY "Users can delete their own templates"
ON workout_templates FOR DELETE
USING (auth.uid() = author_id);

-- =====================================================
-- PUSH NOTIFICATION SUBSCRIPTIONS
-- =====================================================
DROP TABLE IF EXISTS push_subscriptions CASCADE;
CREATE TABLE push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions"
ON push_subscriptions FOR ALL
USING (auth.uid() = user_id);

-- =====================================================
-- SHARED ACHIEVEMENTS (for social features)
-- =====================================================
DROP TABLE IF EXISTS shared_achievements CASCADE;
CREATE TABLE shared_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL CHECK (achievement_type IN ('badge', 'pr', 'streak', 'goal', 'level')),
    achievement_data JSONB NOT NULL,
    share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    view_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for share token lookups
CREATE INDEX idx_shared_achievements_token 
ON shared_achievements(share_token);

-- RLS Policies
ALTER TABLE shared_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shared achievements via token" ON shared_achievements;
CREATE POLICY "Anyone can view shared achievements via token"
ON shared_achievements FOR SELECT
USING (expires_at > now());

DROP POLICY IF EXISTS "Users can create their own shares" ON shared_achievements;
CREATE POLICY "Users can create their own shares"
ON shared_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shares" ON shared_achievements;
CREATE POLICY "Users can delete their own shares"
ON shared_achievements FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- SEED DATA: Built-in Workout Templates
-- =====================================================
INSERT INTO workout_templates (name, description, category, difficulty, exercises, estimated_duration, is_public, is_featured) VALUES
(
    'Push Day',
    'Classic push workout targeting chest, shoulders, and triceps',
    'strength',
    'intermediate',
    '[
        {"name": "Bench Press", "sets": 4, "reps": "8-10", "rest": 90},
        {"name": "Overhead Press", "sets": 3, "reps": "8-10", "rest": 90},
        {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "rest": 60},
        {"name": "Lateral Raises", "sets": 3, "reps": "12-15", "rest": 45},
        {"name": "Tricep Pushdowns", "sets": 3, "reps": "12-15", "rest": 45},
        {"name": "Overhead Tricep Extension", "sets": 2, "reps": "12-15", "rest": 45}
    ]'::jsonb,
    45,
    true,
    true
),
(
    'Pull Day',
    'Complete back and biceps workout',
    'strength',
    'intermediate',
    '[
        {"name": "Deadlift", "sets": 4, "reps": "5-6", "rest": 120},
        {"name": "Pull-ups", "sets": 3, "reps": "8-10", "rest": 90},
        {"name": "Barbell Rows", "sets": 3, "reps": "8-10", "rest": 90},
        {"name": "Face Pulls", "sets": 3, "reps": "15-20", "rest": 45},
        {"name": "Barbell Curls", "sets": 3, "reps": "10-12", "rest": 45},
        {"name": "Hammer Curls", "sets": 2, "reps": "12-15", "rest": 45}
    ]'::jsonb,
    50,
    true,
    true
),
(
    'Leg Day',
    'Lower body strength and hypertrophy',
    'strength',
    'intermediate',
    '[
        {"name": "Squats", "sets": 4, "reps": "6-8", "rest": 120},
        {"name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest": 90},
        {"name": "Leg Press", "sets": 3, "reps": "12-15", "rest": 90},
        {"name": "Walking Lunges", "sets": 3, "reps": "12 each", "rest": 60},
        {"name": "Leg Curls", "sets": 3, "reps": "12-15", "rest": 45},
        {"name": "Calf Raises", "sets": 4, "reps": "15-20", "rest": 30}
    ]'::jsonb,
    55,
    true,
    true
),
(
    'Full Body (Beginner)',
    'Perfect for those new to strength training',
    'strength',
    'beginner',
    '[
        {"name": "Goblet Squat", "sets": 3, "reps": "10-12", "rest": 60},
        {"name": "Dumbbell Bench Press", "sets": 3, "reps": "10-12", "rest": 60},
        {"name": "Dumbbell Rows", "sets": 3, "reps": "10-12", "rest": 60},
        {"name": "Dumbbell Shoulder Press", "sets": 2, "reps": "10-12", "rest": 60},
        {"name": "Plank", "sets": 3, "reps": "30 sec", "rest": 30}
    ]'::jsonb,
    30,
    true,
    true
),
(
    '5x5 Strength',
    'Classic 5x5 program for building raw strength',
    'strength',
    'intermediate',
    '[
        {"name": "Squat", "sets": 5, "reps": "5", "rest": 180},
        {"name": "Bench Press", "sets": 5, "reps": "5", "rest": 180},
        {"name": "Barbell Row", "sets": 5, "reps": "5", "rest": 180}
    ]'::jsonb,
    45,
    true,
    true
),
(
    'HIIT Cardio Blast',
    '20-minute high intensity interval training',
    'hiit',
    'intermediate',
    '[
        {"name": "Jumping Jacks", "sets": 1, "reps": "45 sec work / 15 sec rest", "rest": 15},
        {"name": "Burpees", "sets": 1, "reps": "45 sec work / 15 sec rest", "rest": 15},
        {"name": "Mountain Climbers", "sets": 1, "reps": "45 sec work / 15 sec rest", "rest": 15},
        {"name": "High Knees", "sets": 1, "reps": "45 sec work / 15 sec rest", "rest": 15},
        {"name": "Jump Squats", "sets": 1, "reps": "45 sec work / 15 sec rest", "rest": 15}
    ]'::jsonb,
    20,
    true,
    true
);
