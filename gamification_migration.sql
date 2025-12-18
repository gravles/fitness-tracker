-- Add XP and Level to User Settings
ALTER TABLE user_settings 
ADD COLUMN total_xp INTEGER DEFAULT 0,
ADD COLUMN current_level INTEGER DEFAULT 1;

-- Create User Badges table
CREATE TABLE user_badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB, -- For storing specifics like "streak_length: 7"
    UNIQUE(user_id, badge_id)
);

-- RLS Policies for user_badges
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges"
ON user_badges FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges"
ON user_badges FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- No update/delete needed for badges usually, but strict if needed
