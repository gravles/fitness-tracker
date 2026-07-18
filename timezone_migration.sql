-- User timezone (IANA name, e.g. "America/Toronto"), kept in sync by the web
-- app from the browser's Intl API. Used server-side to resolve "today" for
-- MCP tool date defaults; falls back to the server clock (UTC) when unset.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone text;
