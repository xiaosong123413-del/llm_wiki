CREATE TABLE IF NOT EXISTS mobile_ai_providers (
  owner_uid TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  api_name TEXT,
  api_base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  image_model TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
