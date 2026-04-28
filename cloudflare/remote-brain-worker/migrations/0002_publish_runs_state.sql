CREATE TABLE publish_runs_v2 (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  wiki_root TEXT NOT NULL,
  publish_version TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  published_at TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  index_file_count INTEGER NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO publish_runs_v2 (
  id,
  action,
  wiki_root,
  publish_version,
  status,
  error,
  published_at,
  file_count,
  index_file_count,
  manifest_json,
  created_at
)
SELECT
  id,
  action,
  wiki_root,
  published_at AS publish_version,
  'published' AS status,
  NULL AS error,
  published_at,
  file_count,
  index_file_count,
  manifest_json,
  created_at
FROM publish_runs;

DROP TABLE publish_runs;
ALTER TABLE publish_runs_v2 RENAME TO publish_runs;
