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

// Migration: add ai_svg column to interactions (V2)
try {
  db.prepare('SELECT ai_svg FROM interactions LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE interactions ADD COLUMN ai_svg TEXT');
  console.log('[DB] Migration: added ai_svg column');
}

// V2: Pages table for paging system
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    png_snapshot TEXT NOT NULL,
    ai_text TEXT,
    story_narrative TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_pages_session ON pages(session_id);
`);

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

// V2: Page functions
function addPage(sessionId, pngSnapshot, aiText = null, storyNarrative = null) {
  const maxPage = db.prepare('SELECT MAX(page_number) as max FROM pages WHERE session_id = ?').get(sessionId);
  const nextPage = (maxPage?.max || 0) + 1;

  const stmt = db.prepare(`
    INSERT INTO pages (session_id, page_number, png_snapshot, ai_text, story_narrative)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sessionId, nextPage, pngSnapshot, aiText, storyNarrative);
  return result.lastInsertRowid;
}

function getPages(sessionId) {
  return db.prepare('SELECT * FROM pages WHERE session_id = ? ORDER BY page_number ASC').all(sessionId);
}

function getCurrentPage(sessionId) {
  return db.prepare('SELECT * FROM pages WHERE session_id = ? ORDER BY page_number DESC LIMIT 1').get(sessionId);
}

function updateCurrentPage(sessionId, pngSnapshot, aiText) {
  const page = getCurrentPage(sessionId);
  if (page) {
    db.prepare('UPDATE pages SET png_snapshot = ?, ai_text = ? WHERE id = ?').run(pngSnapshot, aiText, page.id);
  }
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
  updateInteractionCanvasAfterAi,
  addPage,
  getPages,
  getCurrentPage,
  updateCurrentPage
};
