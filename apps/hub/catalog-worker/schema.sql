CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  source TEXT NOT NULL DEFAULT 'shopee',
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sync_state TEXT NOT NULL DEFAULT 'idle',
  product_count INTEGER DEFAULT 0,
  last_sync_at TEXT,
  last_sync_status TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  images TEXT NOT NULL DEFAULT '[]',
  url TEXT NOT NULL DEFAULT '',
  sku TEXT,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'shopee',
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, external_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running' | 'success' | 'partial' | 'error'
  trigger TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'scheduled' | 'webhook'
  requested_limit INTEGER NOT NULL DEFAULT 10,
  discovered INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  unchanged INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_store_id ON sync_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
