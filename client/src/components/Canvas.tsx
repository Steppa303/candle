import React from 'react';
import { useCanvas } from '../hooks/useCanvas';

interface CanvasProps {
  strokeColor: string;
  strokeWidth: number;
  onStrokeComplete: (canvasPng: string, canvasWidth: number, canvasHeight: number) => void;
  drawingCommands: any[] | null;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  smoothingEnabled: boolean;
  smoothingValue?: number;
  isTapMode?: boolean;
  onTapResponse?: (x: number, y: number, canvasPng: string) => void;
  onAIDrawingComplete?: (canvasPng: string) => void;
}

export function Canvas({ 
  strokeColor, 
  strokeWidth, 
  onStrokeComplete,
  drawingCommands,
  onCanvasReady,
  smoothingEnabled,
  smoothingValue,
  isTapMode = false,
  onTapResponse,
  onAIDrawingComplete
}: CanvasProps) {
  const {
    bgCanvasRef,
    fgCanvasRef,
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    renderAIDrawing,
    exportPNG,
    isAnimating
  } = useCanvas({
    strokeColor,
    strokeWidth,
    onStrokeComplete,
    smoothingEnabled,
    smoothingValue
  });

  // Render AI drawing when commands change (animated)
  React.useEffect(() => {
    if (drawingCommands && drawingCommands.length > 0) {
      let cancelled = false;
      renderAIDrawing(drawingCommands).then(() => {
        // After animation completes, export canvas PNG for conversational memory
        if (!cancelled && onAIDrawingComplete) {
          const png = exportPNG();
          if (png) onAIDrawingComplete(png);
        }
      });
      return () => { cancelled = true; };
    }
  }, [drawingCommands, renderAIDrawing, onAIDrawingComplete, exportPNG]);

  // Expose bg canvas ref to parent
  React.useEffect(() => {
    if (bgCanvasRef.current && onCanvasReady) {
      onCanvasReady(bgCanvasRef.current);
    }
  }, [bgCanvasRef, onCanvasReady]);

  // Tap handler for tap mode
  const handleTap = React.useCallback((e: React.PointerEvent) => {
    if (!isTapMode || !onTapResponse) return;
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const png = canvas.toDataURL('image/png');
    onTapResponse(x, y, png);
  }, [isTapMode, onTapResponse, bgCanvasRef]);

  // Touch event handlers (fallback for Kindle Scribe)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    if (isTapMode && onTapResponse) {
      const canvas = bgCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const png = canvas.toDataURL('image/png');
        onTapResponse(x, y, png);
      }
      return;
    }
    startStroke({ clientX: touch.clientX, clientY: touch.clientY } as any);
  }, [startStroke, isTapMode, onTapResponse, bgCanvasRef]);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    continueStroke({ clientX: touch.clientX, clientY: touch.clientY } as any);
  }, [continueStroke]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    endStroke();
  }, [endStroke]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Background canvas: completed strokes (smoothed or raw) */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
      {/* Tap mode indicator */}
      {isTapMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 text-sm z-50 pointer-events-none">
          👆 Tippe auf die Zeichnung
        </div>
      )}

      {/* Foreground canvas: active stroke (raw, real-time) */}
      <canvas
        ref={fgCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none', cursor: isTapMode ? 'crosshair' : 'default' }}
        onPointerDown={isTapMode ? handleTap : startStroke}
        onPointerMove={isTapMode ? undefined : continueStroke}
        onPointerUp={isTapMode ? undefined : endStroke}
        onPointerLeave={isTapMode ? undefined : endStroke}
        onTouchStart={handleTouchStart}
        onTouchMove={isTapMode ? undefined : handleTouchMove}
        onTouchEnd={isTapMode ? undefined : handleTouchEnd}
      />
    </div>
  );
}
