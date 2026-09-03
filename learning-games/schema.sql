PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS category_i18n (
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(language IN ('en','es','fr')),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(category_id, language)
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  engine TEXT NOT NULL DEFAULT 'fill-build',
  difficulty TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_category_status ON games(category_id, status);

CREATE TABLE IF NOT EXISTS game_i18n (
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(language IN ('en','es','fr')),
  title TEXT NOT NULL,
  instructions TEXT,
  passage TEXT NOT NULL,
  explanation TEXT,
  translation_status TEXT NOT NULL DEFAULT 'draft' CHECK(translation_status IN ('draft','generated','reviewed','approved')),
  PRIMARY KEY(game_id, language)
);

CREATE TABLE IF NOT EXISTS blanks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(language IN ('en','es','fr')),
  blank_key TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  occurrence_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  UNIQUE(game_id, language, blank_key)
);

CREATE INDEX IF NOT EXISTS idx_blanks_game_language ON blanks(game_id, language, sort_order);

CREATE TABLE IF NOT EXISTS game_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  alt_text_en TEXT,
  alt_text_es TEXT,
  alt_text_fr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_key TEXT,
  language TEXT NOT NULL CHECK(language IN ('en','es','fr')),
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  duration_ms INTEGER,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_game ON game_attempts(user_key, game_id, completed_at);

CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
