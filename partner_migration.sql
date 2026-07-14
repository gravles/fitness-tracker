-- ============================================================================
-- WORKOUT PARTNER FEATURE MIGRATION
-- ============================================================================
-- Run this file manually in the Supabase SQL editor BEFORE deploying the
-- partner feature. It is safe to re-run (idempotent) and intentionally
-- NON-DESTRUCTIVE: no DROP TABLE statements — these tables hold live social
-- data. Sections are independent so M1 can be applied before M2/M3 ship.
--
-- Before running, sanity-check the live `profiles` table shape:
--   select column_name from information_schema.columns where table_name = 'profiles';
-- This migration only ADDS columns to it.
-- ============================================================================


-- ============================================================================
-- M1 §1: PROFILES (commit live-only table + email lookup column)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from auth.users (covers users created before this migration)
INSERT INTO profiles (id, email)
SELECT id, lower(email) FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = COALESCE(profiles.email, EXCLUDED.email);

UPDATE profiles p SET email = lower(u.email)
FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles (lower(email));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile"
ON profiles FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Partners may read each other's profile (names for display).
-- Email exposure is acceptable: a partner already knows the email they
-- invited / were invited by.
DROP POLICY IF EXISTS "Partners read profile" ON profiles;
CREATE POLICY "Partners read profile"
ON profiles FOR SELECT
USING (EXISTS (
    SELECT 1 FROM partnerships pt
    WHERE pt.status IN ('pending', 'active', 'paused')
      AND ((pt.inviter_id = auth.uid() AND pt.invitee_id = profiles.id)
        OR (pt.invitee_id = auth.uid() AND pt.inviter_id = profiles.id)
        -- Unlinked invitee (matched by verified JWT email) may see the inviter's name
        OR (pt.inviter_id = profiles.id AND pt.invitee_id IS NULL
            AND lower(pt.invitee_email) = lower(auth.jwt() ->> 'email')))
));


-- ============================================================================
-- M1 §2: PARTNERSHIPS (one row per pair; two-sided share levels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partnerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL until account linked
    invitee_email TEXT NOT NULL,                                   -- always stored lowercase
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'paused', 'declined', 'ended')),
    inviter_share_level TEXT NOT NULL DEFAULT 'summary'
        CHECK (inviter_share_level IN ('summary', 'full')),
    invitee_share_level TEXT NOT NULL DEFAULT 'summary'
        CHECK (invitee_share_level IN ('summary', 'full')),
    invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    invited_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- One live partnership per (inviter, email) pair; declined/ended rows don't block re-inviting
CREATE UNIQUE INDEX IF NOT EXISTS idx_partnerships_pair
ON partnerships (inviter_id, lower(invitee_email))
WHERE status IN ('pending', 'active', 'paused');

CREATE INDEX IF NOT EXISTS idx_partnerships_invitee ON partnerships (invitee_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_invitee_email ON partnerships (lower(invitee_email));

ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;

-- Participants can read their partnerships. The email clause makes a pending
-- invite visible to the invitee before their account is linked (email in the
-- JWT is verified — this app uses email-OTP auth).
DROP POLICY IF EXISTS "Participants read partnerships" ON partnerships;
CREATE POLICY "Participants read partnerships"
ON partnerships FOR SELECT
USING (
    auth.uid() = inviter_id
    OR auth.uid() = invitee_id
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
);

-- NO client INSERT/UPDATE/DELETE policies: all mutations go through
-- service-role API routes (per-column rules like "invitee may only set
-- invitee_share_level" cannot be expressed in RLS).


-- ============================================================================
-- M2 §3: PARTNER SHARED ITEMS (workout/meal snapshots sent between partners)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_shared_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('workout_template', 'saved_meal', 'favorite_food')),
    payload JSONB NOT NULL,   -- snapshot at share time; no FK into sender's library
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'saved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_items_to ON partner_shared_items (to_user_id, status);

ALTER TABLE partner_shared_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Share participants read" ON partner_shared_items;
CREATE POLICY "Share participants read"
ON partner_shared_items FOR SELECT
USING (auth.uid() IN (from_user_id, to_user_id));

DROP POLICY IF EXISTS "Sender inserts shares" ON partner_shared_items;
CREATE POLICY "Sender inserts shares"
ON partner_shared_items FOR INSERT
WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
        SELECT 1 FROM partnerships p
        WHERE p.id = partnership_id
          AND p.status = 'active'
          AND ((p.inviter_id = from_user_id AND p.invitee_id = to_user_id)
            OR (p.invitee_id = from_user_id AND p.inviter_id = to_user_id))
    )
);

DROP POLICY IF EXISTS "Recipient updates share status" ON partner_shared_items;
CREATE POLICY "Recipient updates share status"
ON partner_shared_items FOR UPDATE
USING (auth.uid() = to_user_id)
WITH CHECK (auth.uid() = to_user_id);


-- ============================================================================
-- M2 §4: PARTNER NUDGES (encouragements + system streak alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for system nudges
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nudge_type TEXT NOT NULL
        CHECK (nudge_type IN ('encouragement', 'check_in', 'streak_save', 'system_not_logged')),
    message TEXT,
    local_date DATE,   -- recipient's local date; dedup key for system nudges
    created_at TIMESTAMPTZ DEFAULT now()
);

-- The evening cron may only alert once per partnership per local day
CREATE UNIQUE INDEX IF NOT EXISTS idx_nudges_system_dedup
ON partner_nudges (partnership_id, to_user_id, local_date)
WHERE nudge_type = 'system_not_logged';

CREATE INDEX IF NOT EXISTS idx_nudges_to ON partner_nudges (to_user_id, created_at DESC);

ALTER TABLE partner_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nudge participants read" ON partner_nudges;
CREATE POLICY "Nudge participants read"
ON partner_nudges FOR SELECT
USING (auth.uid() IN (from_user_id, to_user_id));

-- Inserts happen only via the API route (rate limiting + push live there).


-- ============================================================================
-- M3 §5: GROUP CHALLENGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL
        CHECK (challenge_type IN ('streak', 'protein_days', 'workout_count')),
    target_value INTEGER NOT NULL CHECK (target_value > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_anonymous BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_members (
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    display_alias TEXT NOT NULL,   -- always set; real name shown only when NOT is_anonymous
    progress INTEGER DEFAULT 0,
    progress_updated_at TIMESTAMPTZ,
    milestone_notified BOOLEAN DEFAULT false,   -- "target reached" push sent
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'joined', 'declined', 'left')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (challenge_id, user_id)
);

-- A challenge_members policy that references challenge_members would recurse
-- infinitely. SECURITY DEFINER bypasses RLS inside the helper.
CREATE OR REPLACE FUNCTION is_challenge_member(cid UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM challenge_members
        WHERE challenge_id = cid
          AND user_id = auth.uid()
          AND status IN ('invited', 'joined')
    )
$$;

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read challenges" ON challenges;
CREATE POLICY "Members read challenges"
ON challenges FOR SELECT
USING (auth.uid() = creator_id OR is_challenge_member(id));

ALTER TABLE challenge_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read challenge members" ON challenge_members;
CREATE POLICY "Members read challenge members"
ON challenge_members FOR SELECT
USING (is_challenge_member(challenge_id));

-- Challenge mutations (create, invite, respond, progress updates) go through
-- service-role API routes which enforce the 2-8 member cap and alias assignment.
