
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DB setup ---
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'elections.db');
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// --- init: load schema + seed positions once ---
async function init() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  await run('PRAGMA journal_mode = WAL');     // better concurrency
  await run('PRAGMA synchronous = NORMAL');   // safe + faster with WAL
  await run('PRAGMA busy_timeout = 3000');    // wait if DB is briefly locked

  await run('PRAGMA foreign_keys = ON');
  await run('BEGIN');
  for (const stmt of schema.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
    await run(stmt);
  }
  await run('COMMIT');

  // Seed positions only once
  const seeded = await get("SELECT v FROM meta WHERE k='seeded'");
  if (!seeded) {
    const positions = [
      { key: 'president',       title: 'Prezidents' },
      { key: 'vice_president',  title: 'Viceprezidents' },
      { key: 'min_tech',        title: 'Tehnikas ministrs' },
      { key: 'min_media',       title: 'Mēdiju ministrs' },
      { key: 'min_art',         title: 'Mākslas ministrs' },
      { key: 'min_culture',     title: 'Kultūras ministrs' },
      { key: 'min_internal',    title: 'Iekšlietu ministrs' },
    ];
    await run('BEGIN');
    for (const p of positions) {
      await run('INSERT OR IGNORE INTO positions(key, title) VALUES(?,?)', [p.key, p.title]);
    }
    await run("INSERT INTO meta(k, v) VALUES('seeded','1')");
    await run('COMMIT');
  }
}

// --- auth: simple admin password ---
const ADMIN_PASS = process.env.ADMIN_PASS || 'change-me';
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-pass'] || req.query.admin;
  if (token === ADMIN_PASS) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ---- CSV import helper used by both endpoints ----
async function importCandidatesFromCsv(csv, mode = 'merge') {
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = lines.map(line => {
    const [name, className, position_key] = line.split(',').map(s => (s || '').trim());
    return { name, className, position_key };
  }).filter(r => r.name && r.className && r.position_key);

  await run('BEGIN');
  let inserted = 0;

  for (const r of rows) {
    // insert if not exists
    const ins = await run(
      'INSERT OR IGNORE INTO candidates(position_key, name, class) VALUES (?,?,?)',
      [r.position_key, r.name, r.className]
    );
    if (ins.lastID) {
      inserted++;
      await run('INSERT OR IGNORE INTO tallies(candidate_id, count) VALUES(?, 0)', [ins.lastID]);
    }
  }

  if (mode === 'replace') {
    // make DB match the CSV exactly (removes missing)
    const placeholders = rows.map(() => '(?,?,?)').join(',');
    if (placeholders) {
      await run(
        `DELETE FROM candidates
         WHERE (position_key, name, class) NOT IN (${placeholders})`,
        rows.flatMap(r => [r.position_key, r.name, r.className])
      );
    } else {
      await run('DELETE FROM candidates');
    }
  }

  await run('COMMIT');
  return { mode, inserted, totalCsvRows: rows.length };
}

// --- API routes ---

// Public overview: positions + candidates + counts
app.get('/api/overview', async (_req, res) => {
  try {
    const positions = await all('SELECT * FROM positions ORDER BY id');
    const candidates = await all('SELECT * FROM candidates ORDER BY id');
    const counts = await all('SELECT candidate_id, count FROM tallies');
    const countMap = new Map(counts.map(c => [c.candidate_id, c.count]));
    const grouped = positions.map(p => ({
      key: p.key,
      title: p.title,
      candidates: candidates
        .filter(c => c.position_key === p.key)
        .map(c => ({ id: c.id, name: c.name, class: c.class, count: countMap.get(c.id) || 0 })),
    }));
    res.json({ positions: grouped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: add a candidate (one-by-one)
app.post('/api/candidates', requireAdmin, async (req, res) => {
  const { position_key, name, class: className } = req.body || {};
  if (!position_key || !name || !className) {
    return res.status(400).json({ error: 'position_key, name, class required' });
  }
  try {
    const r = await run(
      'INSERT INTO candidates(position_key, name, class) VALUES(?,?,?)',
      [position_key, name, className]
    );
    await run('INSERT OR IGNORE INTO tallies(candidate_id, count) VALUES(?, 0)', [r.lastID]);
    const row = await get('SELECT id, position_key, name, class FROM candidates WHERE id=?', [r.lastID]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: increment/decrement
app.post('/api/tally/increment', requireAdmin, async (req, res) => {
  const { candidateId } = req.body || {};
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  try {
    await run('INSERT OR IGNORE INTO tallies(candidate_id, count) VALUES(?, 0)', [candidateId]);
    await run('UPDATE tallies SET count = count + 1 WHERE candidate_id = ?', [candidateId]);
    const row = await get('SELECT count FROM tallies WHERE candidate_id=?', [candidateId]);
    res.json({ candidateId, count: row?.count ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tally/decrement', requireAdmin, async (req, res) => {
  const { candidateId } = req.body || {};
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  try {
    await run('INSERT OR IGNORE INTO tallies(candidate_id, count) VALUES(?, 0)', [candidateId]);
    await run('UPDATE tallies SET count = MAX(count - 1, 0) WHERE candidate_id = ?', [candidateId]);
    const row = await get('SELECT count FROM tallies WHERE candidate_id=?', [candidateId]);
    res.json({ candidateId, count: row?.count ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: reset tallies (all or per-position)
app.post('/api/tally/reset', requireAdmin, async (req, res) => {
  const { position_key } = req.body || {};
  try {
    if (position_key) {
      const ids = await all('SELECT id FROM candidates WHERE position_key=?', [position_key]);
      await run('BEGIN');
      for (const { id } of ids) {
        await run('UPDATE tallies SET count=0 WHERE candidate_id=?', [id]);
      }
      await run('COMMIT');
    } else {
      await run('UPDATE tallies SET count=0');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: paste/upload CSV (text) -> merge/replace
app.post('/api/candidates/import', requireAdmin, async (req, res) => {
  const { csv, mode = 'merge' } = req.body || {};
  if (!csv) return res.status(400).json({ error: 'csv required' });
  try {
    const result = await importCandidatesFromCsv(csv, mode);
    res.json({ ok: true, ...result });
  } catch (e) {
    await run('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

// Admin: sync from a CSV file on disk (default: data/candidates.csv)
app.post('/api/candidates/sync-file', requireAdmin, async (req, res) => {
  const csvPath = (req.body && req.body.path) || path.join(__dirname, 'data', 'candidates.csv');
  const mode = (req.body && req.body.mode) || 'merge';
  if (!fs.existsSync(csvPath)) return res.status(400).json({ error: 'file not found: ' + csvPath });
  try {
    const csv = fs.readFileSync(csvPath, 'utf8');
    const result = await importCandidatesFromCsv(csv, mode);
    res.json({ ok: true, source: csvPath, ...result });
  } catch (e) {
    await run('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

// --- start ---
init().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Tally server on http://localhost:' + port));
});
