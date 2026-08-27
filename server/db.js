const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'candle.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT 'Untitled',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    canvas_snapshot TEXT NOT NULL,
    canvas_after_ai TEXT,
    ai_response_text TEXT,
    ai_response_drawing TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
`);

// Migration: add canvas_after_ai column if missing
try {
  db.prepare('SELECT canvas_after_ai FROM interactions LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE interactions ADD COLUMN canvas_after_ai TEXT');
  console.log('[DB] Migration: added canvas_after_ai column');
}

// CRUD Functions

function createSession(id, name = 'Untitled') {
  const stmt = db.prepare('INSERT INTO sessions (id, name) VALUES (?, ?)');
  stmt.run(id, name);
  return getSession(id);
}

function getSessions() {
  return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all();
}

function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

function deleteSession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

function updateSession(id, name) {
  db.prepare('UPDATE sessions SET name = ?, updated_at = unixepoch() WHERE id = ?').run(name, id);
  return getSession(id);
}

function addInteraction(sessionId, canvasSnapshot, aiResponseText, aiResponseDrawing, canvasAfterAi = null) {
  const stmt = db.prepare(`
    INSERT INTO interactions (session_id, canvas_snapshot, ai_response_text, ai_response_drawing, canvas_after_ai)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sessionId, canvasSnapshot, aiResponseText, aiResponseDrawing, canvasAfterAi);
  
  // Update session timestamp
  db.prepare('UPDATE sessions SET updated_at = unixepoch() WHERE id = ?').run(sessionId);
  
  return result.lastInsertRowid;
}

function getInteractions(sessionId) {
  return db.prepare('SELECT * FROM interactions WHERE session_id = ? ORDER BY created_at ASC').all(sessionId);
}

function updateInteractionCanvasAfterAi(interactionId, canvasAfterAi) {
  db.prepare('UPDATE interactions SET canvas_after_ai = ? WHERE id = ?').run(canvasAfterAi, interactionId);
}

module.exports = {
  db,
  createSession,
  getSessions,
  getSession,
  deleteSession,
  updateSession,
  addInteraction,
  getInteractions,
  updateInteractionCanvasAfterAi
};
