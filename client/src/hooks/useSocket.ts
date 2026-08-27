import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  onThinking?: () => void;
  onResponse?: (data: { text: string; drawing: any[] | null; interactionId: number; isProaktiv?: boolean }) => void;
  onError?: (data: { message: string }) => void;
  onSessionCreated?: (data: { session: any }) => void;
  onSessionHistory?: (data: { session: any; interactions: any[] }) => void;
  onSessionDeleted?: (data: { sessionId: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  
  // Update options ref on each render
  optionsRef.current = options;

  useEffect(() => {
    // Connect to Socket.io server
    const socket = io(window.location.origin, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    // AI events
    socket.on('ai:thinking', () => {
      optionsRef.current.onThinking?.();
    });

    socket.on('ai:response', (data) => {
      optionsRef.current.onResponse?.(data);
    });

    socket.on('ai:error', (data) => {
      optionsRef.current.onError?.(data);
    });

    // Session events
    socket.on('session:created', (data) => {
      optionsRef.current.onSessionCreated?.(data);
    });

    socket.on('session:history', (data) => {
      optionsRef.current.onSessionHistory?.(data);
    });

    socket.on('session:deleted', (data) => {
      optionsRef.current.onSessionDeleted?.(data);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Send functions
  const sendStrokeComplete = useCallback((sessionId: string, canvasPng: string, canvasWidth: number, canvasHeight: number, contentInfo?: { bounds: { x: number; y: number; width: number; height: number }; avgObjectSize: number; contentDensity: number }, storyMode?: boolean) => {
    socketRef.current?.emit('stroke:complete', { sessionId, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode });
  }, []);

  const sendSessionNew = useCallback((name?: string) => {
    socketRef.current?.emit('session:new', { name });
  }, []);

  const sendSessionSwitch = useCallback((sessionId: string) => {
    socketRef.current?.emit('session:switch', { sessionId });
  }, []);

  const sendSessionDelete = useCallback((sessionId: string) => {
    socketRef.current?.emit('session:delete', { sessionId });
  }, []);

  const sendCanvasAfterAi = useCallback((interactionId: number, canvasPng: string) => {
    socketRef.current?.emit('canvas:after-ai', { interactionId, canvasPng });
  }, []);

  const sendTapResponse = useCallback((sessionId: string, x: number, y: number, canvasPng: string) => {
    socketRef.current?.emit('tap:response', { sessionId, x, y, canvasPng });
  }, []);

  const sendProaktiv = useCallback((sessionId: string) => {
    socketRef.current?.emit('ki:proaktiv', { sessionId });
  }, []);

  return {
    socket: socketRef.current,
    sendStrokeComplete,
    sendSessionNew,
    sendSessionSwitch,
    sendSessionDelete,
    sendCanvasAfterAi,
    sendTapResponse,
    sendProaktiv
  };
}
