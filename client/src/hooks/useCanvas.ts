import { useRef, useCallback, useEffect, useState } from 'react';
import { renderDrawingCommands, renderDrawingCommandsAnimated } from '../utils/drawingRenderer';

/**
 * Draw a temporary grid overlay on the canvas for AI analysis.
 * Shows crosses every 100px and coordinate labels at the edges.
 */
function drawGridOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const step = 100;
  const crossSize = 6;

  ctx.save();
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 0.5;
  ctx.fillStyle = '#CCCCCC';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Vertical lines with crosses and labels at top
  for (let x = step; x < width; x += step) {
    // Cross at top edge
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, crossSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - crossSize / 2, crossSize / 2);
    ctx.lineTo(x + crossSize / 2, crossSize / 2);
    ctx.stroke();

    // Coordinate label
    ctx.fillText(String(x), x + 2, 2);
  }

  // Horizontal lines with crosses and labels at left
  for (let y = step; y < height; y += step) {
    // Cross at left edge
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(crossSize, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(crossSize / 2, y - crossSize / 2);
    ctx.lineTo(crossSize / 2, y + crossSize / 2);
    ctx.stroke();

    // Coordinate label
    ctx.fillText(String(y), 2, y + 2);
  }

  ctx.restore();
}

interface UseCanvasOptions {
  strokeColor?: string;
  strokeWidth?: number;
  onStrokeComplete?: (canvasPng: string, canvasWidth: number, canvasHeight: number) => void;
  smoothingEnabled?: boolean;
  smoothingValue?: number;
}

export function useCanvas(options: UseCanvasOptions = {}) {
  // Two canvases: background (completed strokes) and foreground (active stroke)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const fgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Raw points of current stroke
  const rawPointsRef = useRef<Array<{ x: number; y: number }>>([]);

  // Detect Kindle / E-Ink
  const isEInk = useCallback(() => {
    const ua = navigator.userAgent || '';
    return ua.includes('Kindle') || ua.includes('Silk') || ua.includes('KFOT') || ua.includes('KFTT') || ua.includes('KFJWI') || ua.includes('KFJWA') || ua.includes('KFAPWI') || ua.includes('KFAPWA');
  }, []);

  // Initialize both canvases
  const initCanvas = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!bgCanvas || !fgCanvas) return;

    const updateSize = () => {
      const rect = fgCanvas.getBoundingClientRect();
      const dpr = isEInk() ? 1 : (window.devicePixelRatio || 1);

      // Size both canvases identically
      for (const canvas of [bgCanvas, fgCanvas]) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      // Background context (completed strokes)
      const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: false });
      if (bgCtx) {
        if (dpr !== 1) bgCtx.scale(dpr, dpr);
        bgCtx.lineCap = 'round';
        bgCtx.lineJoin = 'round';
        bgCtx.strokeStyle = '#000000';
        bgCtx.lineWidth = 2;
        bgCtxRef.current = bgCtx;
      }

      // Foreground context (active stroke)
      const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: false });
      if (fgCtx) {
        if (dpr !== 1) fgCtx.scale(dpr, dpr);
        fgCtx.lineCap = 'round';
        fgCtx.lineJoin = 'round';
        fgCtx.strokeStyle = '#000000';
        fgCtx.lineWidth = 2;
        fgCtxRef.current = fgCtx;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [isEInk]);

  // Get coordinates from pointer event
  const getPoint = useCallback((e: React.PointerEvent | PointerEvent) => {
    const canvas = fgCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Ramer-Douglas-Peucker point reduction
  const simplifyPoints = useCallback((points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> => {
    if (points.length < 3 || epsilon <= 0) return points;

    // Find the point with max distance from line (first→last)
    const first = points[0];
    const last = points[points.length - 1];
    let maxDist = 0;
    let maxIdx = 0;

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const lineLenSq = dx * dx + dy * dy;

    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      let dist: number;

      if (lineLenSq === 0) {
        // Degenerate: first == last
        dist = Math.sqrt((p.x - first.x) ** 2 + (p.y - first.y) ** 2);
      } else {
        // Perpendicular distance to line segment
        const t = Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / lineLenSq));
        const projX = first.x + t * dx;
        const projY = first.y + t * dy;
        dist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
      }

      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      // Recurse on both halves
      const left = simplifyPoints(points.slice(0, maxIdx + 1), epsilon);
      const right = simplifyPoints(points.slice(maxIdx), epsilon);
      // Concatenate (remove duplicate at junction)
      return [...left.slice(0, -1), ...right];
    }

    // All points within epsilon → keep only endpoints
    return [first, last];
  }, []);

  // Catmull-Rom spline with tangent clamping to prevent overshoot at sharp corners
  const catmullRomSmooth = useCallback((raw: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    if (raw.length < 3) return raw;

    const result: Array<{ x: number; y: number }> = [];
    const TENSION = 0.5; // standard Catmull-Rom
    const STEPS = 8;
    const CLAMP_FACTOR = 4.0;

    for (let i = 0; i < raw.length - 1; i++) {
      const p0 = raw[Math.max(0, i - 1)];
      const p1 = raw[i];
      const p2 = raw[i + 1];
      const p3 = raw[Math.min(raw.length - 1, i + 2)];

      const segLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const maxTangent = segLen * CLAMP_FACTOR;

      let t1x = TENSION * (p2.x - p0.x);
      let t1y = TENSION * (p2.y - p0.y);
      let t2x = TENSION * (p3.x - p1.x);
      let t2y = TENSION * (p3.y - p1.y);

      const t1Len = Math.sqrt(t1x * t1x + t1y * t1y);
      if (t1Len > maxTangent) {
        const scale = maxTangent / t1Len;
        t1x *= scale;
        t1y *= scale;
      }
      const t2Len = Math.sqrt(t2x * t2x + t2y * t2y);
      if (t2Len > maxTangent) {
        const scale = maxTangent / t2Len;
        t2x *= scale;
        t2y *= scale;
      }

      for (let t = 0; t < STEPS; t++) {
        const s = t / STEPS;
        const s2 = s * s;
        const s3 = s2 * s;

        const h00 = 2 * s3 - 3 * s2 + 1;
        const h10 = s3 - 2 * s2 + s;
        const h01 = -2 * s3 + 3 * s2;
        const h11 = s3 - s2;

        const x = h00 * p1.x + h10 * t1x + h01 * p2.x + h11 * t2x;
        const y = h00 * p1.y + h10 * t1y + h01 * p2.y + h11 * t2y;

        result.push({ x, y });
      }
    }

    result.push(raw[raw.length - 1]);
    return result;
  }, []);

  // Combined smoothing: simplify first, then spline
  const smoothStroke = useCallback((raw: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    const strength = options.smoothingValue ?? 0; // 0 = no smoothing, 1 = max
    if (strength < 0.01 || raw.length < 3) return raw;

    // Epsilon scales with smoothing strength:
    // 0 → epsilon 0 (no reduction), 1 → epsilon 15px (aggressive reduction)
    const epsilon = strength * 15;
    const simplified = simplifyPoints(raw, epsilon);

    // Apply Catmull-Rom spline to the reduced points
    return catmullRomSmooth(simplified);
  }, [options.smoothingValue, simplifyPoints, catmullRomSmooth]);

  // Draw a stroke on a given context
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, color: string, width: number) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  }, []);

  // Start stroke
  const startStroke = useCallback((e: React.PointerEvent) => {
    const point = getPoint(e);
    if (!point) return;

    isDrawingRef.current = true;
    rawPointsRef.current = [point];

    // Cancel pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Clear foreground canvas
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (fgCtx && fgCanvas) {
      fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    }

    // Draw first point on foreground
    if (fgCtx) {
      fgCtx.beginPath();
      fgCtx.strokeStyle = options.strokeColor || '#000000';
      fgCtx.lineWidth = options.strokeWidth || 2;
      fgCtx.moveTo(point.x, point.y);
    }
  }, [getPoint, options.strokeColor, options.strokeWidth]);

  // Continue stroke — draw raw on foreground
  const continueStroke = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;

    const point = getPoint(e);
    if (!point) return;

    rawPointsRef.current.push(point);

    // Draw raw line on foreground (immediate, no smoothing)
    const fgCtx = fgCtxRef.current;
    if (fgCtx) {
      fgCtx.lineTo(point.x, point.y);
      fgCtx.stroke();
      fgCtx.beginPath();
      fgCtx.moveTo(point.x, point.y);
    }
  }, [getPoint]);

  // End stroke — smooth and render to background
  const endStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const raw = rawPointsRef.current;
    const bgCtx = bgCtxRef.current;
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;

    if (!bgCtx || !fgCtx || !fgCanvas || raw.length < 2) {
      rawPointsRef.current = [];
      return;
    }

    // Clear foreground
    fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);

    // Apply smoothing if enabled
    const smoothed = options.smoothingEnabled ? smoothStroke(raw) : raw;

    // Draw smoothed stroke on background
    drawStroke(bgCtx, smoothed, options.strokeColor || '#000000', options.strokeWidth || 2);

    // Export PNG (debounced)
    const debounceMs = parseInt(localStorage.getItem('candle_debounce') || '500', 10);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const bgCanvas = bgCanvasRef.current;
      if (bgCanvas) {
        // Draw temporary grid overlay for AI analysis
        const gridCtx = bgCanvas.getContext('2d');
        let savedImageData: ImageData | null = null;
        if (gridCtx) {
          savedImageData = gridCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);
          drawGridOverlay(gridCtx, bgCanvas.width, bgCanvas.height);
        }

        const png = bgCanvas.toDataURL('image/png');

        // Restore canvas to pre-grid state
        if (gridCtx && savedImageData) {
          gridCtx.putImageData(savedImageData, 0, 0);
        }

        const dpr = isEInk() ? 1 : (window.devicePixelRatio || 1);
        const cssWidth = Math.round(bgCanvas.width / dpr);
        const cssHeight = Math.round(bgCanvas.height / dpr);
        options.onStrokeComplete?.(png, cssWidth, cssHeight);
      }
    }, debounceMs);

    rawPointsRef.current = [];
  }, [options.onStrokeComplete, options.smoothingEnabled, options.strokeColor, options.strokeWidth, smoothStroke, drawStroke]);

  // Clear both canvases
  const clearCanvas = useCallback(() => {
    const bgCtx = bgCtxRef.current;
    const bgCanvas = bgCanvasRef.current;
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;

    if (bgCtx && bgCanvas) {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    }
    if (fgCtx && fgCanvas) {
      fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    }
  }, []);

  // Animation state for AI drawing
  const animationAbortRef = useRef<AbortController | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Render AI drawing on background canvas (animated)
  const renderAIDrawing = useCallback(async (drawingCommands: any[]) => {
    const bgCtx = bgCtxRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!bgCtx || !drawingCommands) return;

    // Abort any previous animation
    if (animationAbortRef.current) {
      animationAbortRef.current.abort();
    }
    animationAbortRef.current = new AbortController();

    setIsAnimating(true);

    const delay = isEInk() ? 150 : 80;

    try {
      await renderDrawingCommandsAnimated(bgCtx, drawingCommands, {
        delayPerCommand: delay,
        signal: animationAbortRef.current.signal,
        bgCanvas: bgCanvas ?? undefined,
      });
    } finally {
      setIsAnimating(false);
    }
  }, [isEInk]);

  // Export background canvas as PNG
  const exportPNG = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return null;
    return bgCanvas.toDataURL('image/png');
  }, []);

  // Initialize on mount
  useEffect(() => {
    const cleanup = initCanvas();
    return cleanup;
  }, [initCanvas]);

  return {
    bgCanvasRef,
    fgCanvasRef,
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    renderAIDrawing,
    exportPNG,
    isAnimating
  };
}
