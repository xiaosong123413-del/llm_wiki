CREATE TABLE IF NOT EXISTS mobile_task_review_settings (
  owner_uid TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
