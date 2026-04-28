CREATE TABLE IF NOT EXISTS publish_runs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  wiki_root TEXT NOT NULL,
  published_at TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  index_file_count INTEGER NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  r2_key TEXT,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mobile_entries (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  media_files_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  desktop_path TEXT,
  synced_at TEXT,
  failed_at TEXT,
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mobile_entries_owner_created
  ON mobile_entries(owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_chats (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'wiki',
  messages_json TEXT NOT NULL DEFAULT '[]',
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mobile_chats_owner_updated
  ON mobile_chats(owner_uid, updated_at DESC);

CREATE TABLE IF NOT EXISTS web_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  web_search_enabled INTEGER NOT NULL DEFAULT 0,
  search_scope TEXT NOT NULL DEFAULT 'local',
  agent_id TEXT,
  article_refs_json TEXT NOT NULL DEFAULT '[]',
  messages_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_web_conversations_updated
  ON web_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS wiki_comments (
  id TEXT PRIMARY KEY,
  page_path TEXT NOT NULL,
  quote TEXT NOT NULL,
  comment TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wiki_comments_page_updated
  ON wiki_comments(page_path, updated_at DESC);
