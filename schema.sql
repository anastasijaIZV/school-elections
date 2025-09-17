-- schema.sql

-- Positions (President, Vice President, and ministries)
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key   TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL
);

-- Candidates (with class), linked to a position
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_key TEXT NOT NULL,
  name  TEXT NOT NULL,
  class TEXT NOT NULL,
  FOREIGN KEY(position_key) REFERENCES positions(key) ON DELETE CASCADE
);

-- Tally totals per candidate
CREATE TABLE IF NOT EXISTS tallies (
  candidate_id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- Meta for seeding flags
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- match candidates by (position_key, name, class)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_candidate
ON candidates(position_key, name, class);