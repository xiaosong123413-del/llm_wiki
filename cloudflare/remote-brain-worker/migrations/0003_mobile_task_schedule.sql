CREATE TABLE IF NOT EXISTS mobile_task_schedule (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'neutral',
  done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
