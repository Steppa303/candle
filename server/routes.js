const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const router = express.Router();

// GET /api/sessions - List all sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = db.getSessions();
    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Sessions.' });
  }
});

// GET /api/sessions/:id - Get session with interactions
router.get('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = db.getSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session nicht gefunden.' });
    }

    const interactions = db.getInteractions(id);
    res.json({ session, interactions });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Session.' });
  }
});

// POST /api/sessions - Create new session
router.post('/sessions', (req, res) => {
  try {
    const { name } = req.body;
    const sessionId = uuidv4();
    const sessionName = name || `Session ${new Date().toLocaleString('de-DE')}`;
    
    const session = db.createSession(sessionId, sessionName);
    res.status(201).json({ session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Session.' });
  }
});

// DELETE /api/sessions/:id - Delete session
router.delete('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = db.getSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session nicht gefunden.' });
    }

    db.deleteSession(id);
    res.json({ success: true, message: 'Session gelöscht.' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Session.' });
  }
});

// PATCH /api/sessions/:id - Rename session
router.patch('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name ist erforderlich.' });
    }

    const session = db.getSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session nicht gefunden.' });
    }

    const updatedSession = db.updateSession(id, name.trim());
    res.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Session.' });
  }
});

module.exports = router;
