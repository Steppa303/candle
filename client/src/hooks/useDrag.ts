import { useState, useRef, useCallback } from 'react';

const STORAGE_KEY = 'candle-fab-position';
const TAP_THRESHOLD = 5; // pixels

interface Position {
  x: number;
  y: number;
}

interface UseDragOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onTap?: () => void;
}

interface UseDragReturn {
  position: Position;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  updatePosition: (pos: Position) => void;
}

function loadPosition(): Position {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  // Default: top-right area
  return { x: window.innerWidth - 64, y: 64 };
}

function savePosition(pos: Position): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function useDrag(options: UseDragOptions = {}): UseDragReturn {
  const [position, setPosition] = useState<Position>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);

  const startPosRef = useRef<Position>({ x: 0, y: 0 });
  const startPointerRef = useRef<Position>({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const draggingRef = useRef(false);
  const currentPosRef = useRef<Position>(position);

  // Keep ref in sync with state
  currentPosRef.current = position;

  const updatePosition = useCallback((pos: Position) => {
    setPosition(pos);
    savePosition(pos);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startPosRef.current = { ...currentPosRef.current };
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    draggingRef.current = false;

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startPointerRef.current.x;
      const dy = ev.clientY - startPointerRef.current.y;

      if (!movedRef.current && (Math.abs(dx) >= TAP_THRESHOLD || Math.abs(dy) >= TAP_THRESHOLD)) {
        movedRef.current = true;
        draggingRef.current = true;
        setIsDragging(true);
        options.onDragStart?.();
      }

      if (draggingRef.current) {
        const newPos = {
          x: startPosRef.current.x + dx,
          y: startPosRef.current.y + dy,
        };
        setPosition(newPos);
      }
    };

    const onPointerUp = () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);

      if (draggingRef.current) {
        setIsDragging(false);
        savePosition(currentPosRef.current);
        options.onDragEnd?.();
      } else {
        options.onTap?.();
      }

      draggingRef.current = false;
      movedRef.current = false;
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
  }, [options]);

  return { position, isDragging, onPointerDown, updatePosition };
}
