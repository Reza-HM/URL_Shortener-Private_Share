CREATE TABLE IF NOT EXISTS shares (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('link', 'drop')),
  code text UNIQUE,
  destination text,
  payload_kind text CHECK (payload_kind IN ('text', 'code', 'file')),
  storage_key text,
  byte_length integer,
  management_hash text NOT NULL,
  password_hash text,
  one_time boolean NOT NULL DEFAULT false,
  requests integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  disabled_at timestamptz,
  deleted_at timestamptz,
  purged_at timestamptz,
  CHECK ((kind = 'link' AND code IS NOT NULL AND destination IS NOT NULL) OR
         (kind = 'drop' AND storage_key IS NOT NULL AND payload_kind IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shares_expiry_idx ON shares(expires_at);
CREATE TABLE IF NOT EXISTS rate_buckets (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
