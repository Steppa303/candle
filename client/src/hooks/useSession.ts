import { useState, useEffect, useCallback } from 'react';

interface Session {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

interface Interaction {
  id: number;
  session_id: string;
  canvas_snapshot: string;
  ai_response_text: string | null;
  ai_response_drawing: string | null;
  created_at: number;
}

const STORAGE_KEY = 'candle_last_session';

export function useSession() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Load sessions from API
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, []);

  // Load session with interactions
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.session) {
        setCurrentSession(data.session);
        setInteractions(data.interactions || []);
        localStorage.setItem(STORAGE_KEY, sessionId);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session
  const createSession = useCallback(async (name?: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      
      if (data.session) {
        setCurrentSession(data.session);
        setInteractions([]);
        setSessions(prev => [data.session, ...prev]);
        localStorage.setItem(STORAGE_KEY, data.session.id);
        return data.session;
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
    return null;
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setInteractions([]);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSession]);

  // Rename session
  const renameSession = useCallback(async (sessionId: string, name: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      
      if (data.session) {
        setSessions(prev => prev.map(s => s.id === sessionId ? data.session : s));
        if (currentSession?.id === sessionId) {
          setCurrentSession(data.session);
        }
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  }, [currentSession]);

  // Add interaction (called when AI responds)
  const addInteraction = useCallback((interaction: Interaction) => {
    setInteractions(prev => [...prev, interaction]);
  }, []);

  // Load last session on mount
  useEffect(() => {
    const lastSessionId = localStorage.getItem(STORAGE_KEY);
    if (lastSessionId) {
      loadSession(lastSessionId);
    }
    loadSessions();
  }, [loadSession, loadSessions]);

  return {
    currentSession,
    sessions,
    interactions,
    loading,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    renameSession,
    addInteraction,
    setCurrentSession
  };
}
