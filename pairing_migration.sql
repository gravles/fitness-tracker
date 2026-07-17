-- Device pairing (watch companion etc.): short-lived pairing requests.
-- The device generates its own ftk_ API key locally and only ever sends the
-- SHA-256 hash; claiming copies that hash into mcp_api_keys. The plaintext
-- key never touches the server.
CREATE TABLE IF NOT EXISTS pairing_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash text NOT NULL UNIQUE,
    key_hash text NOT NULL,
    device_name text NOT NULL DEFAULT 'Paired device',
    claimed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;
-- No policies: the table is accessed exclusively via the service role in API routes.
