-- D1 schema for LeetTracking sync

-- problems
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  leetcode_id INTEGER,
  slug TEXT,
  title TEXT,
  difficulty TEXT,
  tags TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- review_logs
CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  problem_id TEXT,
  reviewed_at TEXT,
  rating TEXT,
  action TEXT,
  raw_payload TEXT,
  created_at TEXT,
  FOREIGN KEY(problem_id) REFERENCES problems(id)
);

-- srs_state
CREATE TABLE IF NOT EXISTS srs_state (
  problem_id TEXT,
  user_id TEXT,
  repetitions INTEGER,
  interval_days INTEGER,
  easiness_factor REAL,
  last_reviewed_at TEXT,
  next_due_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (problem_id, user_id)
);
