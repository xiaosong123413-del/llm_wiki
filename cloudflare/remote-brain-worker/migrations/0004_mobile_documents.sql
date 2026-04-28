CREATE TABLE IF NOT EXISTS mobile_documents (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
