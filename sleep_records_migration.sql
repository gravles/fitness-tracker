-- Sleep sessions from device sources (Health Connect via the Android app;
-- room for Oura/others later). One row per sleep session, keyed by the
-- source's own id so re-syncs are idempotent. `date` is the wake-up date
-- in the user's local time — the day the sleep "belongs to" for readiness.
CREATE TABLE IF NOT EXISTS sleep_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    duration_minutes integer NOT NULL,
    deep_minutes integer,
    rem_minutes integer,
    light_minutes integer,
    awake_minutes integer,
    source text NOT NULL DEFAULT 'health_connect',
    external_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS sleep_records_user_date ON sleep_records (user_id, date DESC);

ALTER TABLE sleep_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own sleep records" ON sleep_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
