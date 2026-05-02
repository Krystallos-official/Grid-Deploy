import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'griddeploy.db'));

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    month TEXT NOT NULL,
    region TEXT NOT NULL,
    co2_kg REAL NOT NULL,
    workload_label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── Budget & Settings Methods ───

export function getBudget() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('budget');
  return row ? parseFloat(row.value) : 50; // default 50
}

export function setBudget(kg) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('budget', String(kg));
}

// ─── Runs Methods ───

export function getRuns() {
  const d = new Date();
  const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
  // Return runs for current month
  const stmt = db.prepare('SELECT * FROM runs WHERE month = ? ORDER BY timestamp ASC');
  return stmt.all(currentMonth);
}

export function logRun(region, co2Kg, workloadLabel) {
  const d = new Date();
  const timestamp = d.toISOString();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const stmt = db.prepare('INSERT INTO runs (timestamp, month, region, co2_kg, workload_label) VALUES (?, ?, ?, ?, ?)');
  stmt.run(timestamp, month, region, co2Kg, workloadLabel);
}

export default db;
