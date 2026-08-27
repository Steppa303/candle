import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { TextOverlay } from './components/TextOverlay';
import { Toolbar } from './components/Toolbar';
import { SessionList } from './components/SessionList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingToolbox } from './components/FloatingToolbox';
import { useSocket } from './hooks/useSocket';
import { useSession } from './hooks/useSession';
import { analyzeContent } from './utils/contentDetector';

export default function App() {
  // State
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isThinking, setIsThinking] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [drawingCommands, setDrawingCommands] = useState<any[] | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const [smoothingValue, setSmoothingValue] = useState(0.4);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [storyMode, setStoryMode] = useState(() => localStorage.getItem('candle_story_mode') === 'true');
  const [isTapMode, setIsTapMode] = useState(false);
  const [proaktivDelay, setProaktivDelay] = useState<number>(() => {
    const stored = localStorage.getItem('candle_proaktiv_delay');
    return stored ? parseInt(stored, 10) : 60000;
  });
  const tapModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session management
  const {
    currentSession,
    sessions,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    setCurrentSession
  } = useSession();

  // Track last interactionId for canvas-after-ai
  const lastInteractionIdRef = useRef<number | null>(null);

  // Socket handlers
  const handleThinking = useCallback(() => {
    setIsThinking(true);
  }, []);

  const handleResponse = useCallback((data: { text: string; drawing: any[] | null; interactionId: number }) => {
    setIsThinking(false);
    setAiText(data.text);
    lastInteractionIdRef.current = data.interactionId;
    if (data.drawing) {
      setDrawingCommands(data.drawing);
    }

    // Feature 5: Activate tap mode for 10 seconds after AI response
    setIsTapMode(true);
    if (tapModeTimerRef.current) clearTimeout(tapModeTimerRef.current);
    tapModeTimerRef.current = setTimeout(() => setIsTapMode(false), 10000);
  }, []);

  const handleError = useCallback((data: { message: string }) => {
    setIsThinking(false);
    setAiText(`Fehler: ${data.message}`);
  }, []);

  const handleSessionCreated = useCallback((data: { session: any }) => {
    setCurrentSession(data.session);
    loadSessions();
  }, [setCurrentSession, loadSessions]);

  const handleSessionHistory = useCallback((data: { session: any; interactions: any[] }) => {
    setCurrentSession(data.session);
    // TODO: Re-render previous interactions on canvas
  }, [setCurrentSession]);

  const handleSessionDeleted = useCallback((data: { sessionId: string }) => {
    loadSessions();
  }, [loadSessions]);

  // Socket connection
  const {
    sendStrokeComplete,
    sendSessionNew,
    sendSessionSwitch,
    sendSessionDelete,
    sendCanvasAfterAi,
    sendTapResponse,
    sendProaktiv
  } = useSocket({
    onThinking: handleThinking,
    onResponse: handleResponse,
    onError: handleError,
    onSessionCreated: handleSessionCreated,
    onSessionHistory: handleSessionHistory,
    onSessionDeleted: handleSessionDeleted
  });

  // Feature 1: After AI drawing renders, send canvas snapshot back
  const handleAIDrawingRendered = useCallback((canvasPng: string) => {
    if (lastInteractionIdRef.current) {
      sendCanvasAfterAi(lastInteractionIdRef.current, canvasPng);
    }
  }, [sendCanvasAfterAi]);

  // Feature 5: Handle tap on canvas
  const handleTapResponse = useCallback((x: number, y: number, canvasPng: string) => {
    setIsTapMode(false);
    if (tapModeTimerRef.current) {
      clearTimeout(tapModeTimerRef.current);
      tapModeTimerRef.current = null;
    }
    if (currentSession) {
      sendTapResponse(currentSession.id, x, y, canvasPng);
    }
  }, [currentSession, sendTapResponse]);

  // Feature 3: Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (proaktivDelay <= 0 || !aiEnabled || !currentSession) return;

    inactivityTimerRef.current = setTimeout(() => {
      if (currentSession) {
        sendProaktiv(currentSession.id);
      }
    }, proaktivDelay);
  }, [proaktivDelay, aiEnabled, currentSession, sendProaktiv]);

  // Feature 3: Reset timer on every interaction
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [drawingCommands, aiText, resetInactivityTimer]);

  // Feature 3: Persist proaktiv delay
  useEffect(() => {
    localStorage.setItem('candle_proaktiv_delay', String(proaktivDelay));
  }, [proaktivDelay]);

  // Persist story mode
  useEffect(() => {
    localStorage.setItem('candle_story_mode', String(storyMode));
  }, [storyMode]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tapModeTimerRef.current) clearTimeout(tapModeTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  // Handle stroke completion
  const handleStrokeComplete = useCallback((canvasPng: string, canvasWidth: number, canvasHeight: number) => {
    if (!aiEnabled) return;

    let contentInfo = undefined;
    if (canvasElement) {
      const info = analyzeContent(canvasElement);
      contentInfo = {
        bounds: info.bounds,
        avgObjectSize: info.avgObjectSize,
        contentDensity: info.contentDensity
      };
    }

    if (!currentSession) {
      createSession().then((session) => {
        if (session) {
          sendStrokeComplete(session.id, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode);
        }
      });
      return;
    }
    sendStrokeComplete(currentSession.id, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode);
  }, [currentSession, sendStrokeComplete, createSession, aiEnabled, canvasElement, storyMode]);

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  // Handle session switch
  const handleSessionSwitch = useCallback((sessionId: string) => {
    loadSession(sessionId);
    sendSessionSwitch(sessionId);
    // Clear canvas for new session
    setDrawingCommands(null);
    setAiText(null);
  }, [loadSession, sendSessionSwitch]);

  // Handle session delete
  const handleSessionDelete = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    sendSessionDelete(sessionId);
  }, [deleteSession, sendSessionDelete]);

  // Handle clear canvas
  const handleClear = useCallback(() => {
    if (canvasElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      }
    }
    setDrawingCommands(null);
    setAiText(null);
  }, [canvasElement]);

  // Canvas ready callback
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvasElement(canvas);
  }, []);

  return (
    <ErrorBoundary>
    <div className="relative w-full h-full bg-white">
      {/* Canvas */}
      <Canvas
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        onStrokeComplete={handleStrokeComplete}
        drawingCommands={drawingCommands}
        onCanvasReady={handleCanvasReady}
        smoothingEnabled={smoothingEnabled}
        smoothingValue={smoothingValue}
        isTapMode={isTapMode}
        onTapResponse={handleTapResponse}
        onAIDrawingComplete={handleAIDrawingRendered}
      />

      {/* Floating Toolbox */}
      <FloatingToolbox
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onWidthChange={setStrokeWidth}
        smoothingValue={smoothingValue}
        onSmoothingValueChange={setSmoothingValue}
        aiEnabled={aiEnabled}
        onAiToggle={() => setAiEnabled(prev => !prev)}
        storyMode={storyMode}
        onStoryToggle={() => setStoryMode(prev => !prev)}
        proaktivDelay={proaktivDelay}
        onProaktivDelayChange={setProaktivDelay}
      />

      {/* AI disabled indicator */}
      {!aiEnabled && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black text-white px-3 py-1 text-xs z-50">
          KI AUS — Nur Zeichnen
        </div>
      )}

      {/* Story mode indicator */}
      {storyMode && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-amber-100 text-amber-900 px-3 py-1 text-xs z-50 font-medium">
          📖 Story-Modus
        </div>
      )}

      {/* Text overlay */}
      <TextOverlay
        text={aiText}
        duration={8000}
        onDismiss={() => setAiText(null)}
      />

      {/* Toolbar */}
      <Toolbar
        sessionName={currentSession?.name || ''}
        onSessionClick={() => setShowSessionList(true)}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onWidthChange={setStrokeWidth}
        onClear={handleClear}
        onNewSession={handleNewSession}
        isThinking={isThinking}
        smoothingEnabled={smoothingEnabled}
        onSmoothingChange={setSmoothingEnabled}
      />

      {/* Session list modal */}
      {showSessionList && (
        <SessionList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelect={handleSessionSwitch}
          onDelete={handleSessionDelete}
          onNew={handleNewSession}
          onClose={() => setShowSessionList(false)}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
