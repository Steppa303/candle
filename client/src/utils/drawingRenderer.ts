/**
 * Render AI drawing commands on canvas
 * Commands format:
 * - line: { type: 'line', x1, y1, x2, y2, color?, width?, position?, anchor? }
 * - circle: { type: 'circle', cx, cy, r, fill?, color?, width?, position?, anchor? }
 * - path: { type: 'path', points: [[x,y], ...], color?, width?, position?, anchor? }
 * - text: { type: 'text', x, y, content, font?, color?, position?, anchor? }
 *
 * If a command has a `position` field, coordinates are relative to an anchor point
 * calculated from the content bounds. Otherwise, coordinates are absolute.
 */

import { detectContentBounds, type ContentBounds } from './contentDetector';

const AI_COLOR = '#666666';
const AI_WIDTH = 2;
const POSITION_GAP = 20; // px gap between existing content and new drawing

/**
 * Resolve the anchor point (offset) for a command with relative positioning.
 */
function resolvePosition(
  cmd: any,
  bounds: ContentBounds
): { offsetX: number; offsetY: number } {
  const position = cmd.position || 'center';
  const anchor = cmd.anchor || 'center';

  // Default: center of content bounds
  let anchorX = bounds.x + bounds.width / 2;
  let anchorY = bounds.y + bounds.height / 2;

  switch (position) {
    case 'above':
      anchorX = bounds.x + bounds.width / 2;
      anchorY = bounds.y - POSITION_GAP;
      break;
    case 'below':
      anchorX = bounds.x + bounds.width / 2;
      anchorY = bounds.y + bounds.height + POSITION_GAP;
      break;
    case 'left_of':
      anchorX = bounds.x - POSITION_GAP;
      anchorY = bounds.y + bounds.height / 2;
      break;
    case 'right_of':
      anchorX = bounds.x + bounds.width + POSITION_GAP;
      anchorY = bounds.y + bounds.height / 2;
      break;
    case 'center':
      // Already set above
      break;
    case 'top_right':
      anchorX = bounds.x + bounds.width + POSITION_GAP;
      anchorY = bounds.y - POSITION_GAP;
      break;
    case 'top_left':
      anchorX = bounds.x - POSITION_GAP;
      anchorY = bounds.y - POSITION_GAP;
      break;
    case 'bottom_right':
      anchorX = bounds.x + bounds.width + POSITION_GAP;
      anchorY = bounds.y + bounds.height + POSITION_GAP;
      break;
    case 'bottom_left':
      anchorX = bounds.x - POSITION_GAP;
      anchorY = bounds.y + bounds.height + POSITION_GAP;
      break;
  }

  // Adjust anchor point based on anchor direction
  // (shifts where (0,0) maps to relative to the resolved position)
  switch (anchor) {
    case 'top':
      anchorY -= bounds.height / 2;
      break;
    case 'bottom':
      anchorY += bounds.height / 2;
      break;
    case 'left':
      anchorX -= bounds.width / 2;
      break;
    case 'right':
      anchorX += bounds.width / 2;
      break;
    // 'center' — no adjustment
  }

  return { offsetX: anchorX, offsetY: anchorY };
}

/**
 * Apply offset to a drawing command's coordinates.
 * Returns a new command with absolute coordinates.
 */
function applyOffset(cmd: any, offsetX: number, offsetY: number): any {
  const result = { ...cmd };

  switch (cmd.type) {
    case 'line':
      result.x1 = (cmd.x1 || 0) + offsetX;
      result.y1 = (cmd.y1 || 0) + offsetY;
      result.x2 = (cmd.x2 || 0) + offsetX;
      result.y2 = (cmd.y2 || 0) + offsetY;
      break;
    case 'circle':
      result.cx = (cmd.cx || 0) + offsetX;
      result.cy = (cmd.cy || 0) + offsetY;
      break;
    case 'path':
      if (Array.isArray(cmd.points)) {
        result.points = cmd.points.map(([x, y]: [number, number]) => [
          x + offsetX,
          y + offsetY,
        ]);
      }
      break;
    case 'text':
      result.x = (cmd.x || 0) + offsetX;
      result.y = (cmd.y || 0) + offsetY;
      break;
    case 'speechbubble':
      result.x = (cmd.x || 0) + offsetX;
      result.y = (cmd.y || 0) + offsetY;
      if (typeof cmd.tailX === 'number') result.tailX = cmd.tailX + offsetX;
      if (typeof cmd.tailY === 'number') result.tailY = cmd.tailY + offsetY;
      break;
    case 'clear':
      result.x = (cmd.x || 0) + offsetX;
      result.y = (cmd.y || 0) + offsetY;
      break;
  }

  // Remove position/anchor so we don't re-process
  delete result.position;
  delete result.anchor;

  return result;
}

export function renderDrawingCommands(
  ctx: CanvasRenderingContext2D,
  commands: any[],
  bgCanvas?: HTMLCanvasElement
) {
  if (!Array.isArray(commands)) return;

  // Compute content bounds once for all commands
  let bounds: ContentBounds | null = null;
  const hasRelative = commands.some((cmd) => cmd.position);
  if (hasRelative && bgCanvas) {
    bounds = detectContentBounds(bgCanvas);
  }

  // Save current state
  ctx.save();

  commands.forEach((cmd) => {
    try {
      // Resolve relative positioning if needed
      let resolvedCmd = cmd;
      if (cmd.position && bounds) {
        const { offsetX, offsetY } = resolvePosition(cmd, bounds);
        resolvedCmd = applyOffset(cmd, offsetX, offsetY);
      }

      switch (resolvedCmd.type) {
        case 'line':
          drawLine(ctx, resolvedCmd);
          break;
        case 'circle':
          drawCircle(ctx, resolvedCmd);
          break;
        case 'path':
          drawPath(ctx, resolvedCmd);
          break;
        case 'text':
          drawText(ctx, resolvedCmd);
          break;
        case 'speechbubble':
          drawSpeechbubble(ctx, resolvedCmd);
          break;
        case 'clear':
          drawClear(ctx, resolvedCmd);
          break;
        default:
          console.warn('Unknown drawing command type:', resolvedCmd.type);
      }
    } catch (error) {
      console.error('Error rendering drawing command:', error, cmd);
    }
  });

  // Restore state
  ctx.restore();
}

/**
 * Render AI drawing commands sequentially with animation delay.
 * Each command is drawn one by one, creating a "drawing in progress" effect.
 */
export async function renderDrawingCommandsAnimated(
  ctx: CanvasRenderingContext2D,
  commands: any[],
  options: {
    delayPerCommand?: number;
    onProgress?: (current: number, total: number) => void;
    signal?: AbortSignal;
    bgCanvas?: HTMLCanvasElement;
  } = {}
): Promise<void> {
  const { delayPerCommand = 80, onProgress, signal, bgCanvas } = options;

  if (!Array.isArray(commands) || commands.length === 0) return;

  // Compute content bounds once for all commands
  let bounds: ContentBounds | null = null;
  const hasRelative = commands.some((cmd: any) => cmd.position);
  if (hasRelative && bgCanvas) {
    bounds = detectContentBounds(bgCanvas);
  }

  ctx.save();

  for (let i = 0; i < commands.length; i++) {
    if (signal?.aborted) break;

    const cmd = commands[i];
    try {
      let resolvedCmd = cmd;
      if (cmd.position && bounds) {
        const { offsetX, offsetY } = resolvePosition(cmd, bounds);
        resolvedCmd = applyOffset(cmd, offsetX, offsetY);
      }

      switch (resolvedCmd.type) {
        case 'line':
          drawLine(ctx, resolvedCmd);
          break;
        case 'circle':
          drawCircle(ctx, resolvedCmd);
          break;
        case 'path':
          drawPath(ctx, resolvedCmd);
          break;
        case 'text':
          drawText(ctx, resolvedCmd);
          break;
        case 'speechbubble':
          drawSpeechbubble(ctx, resolvedCmd);
          break;
        case 'clear':
          drawClear(ctx, resolvedCmd);
          break;
        default:
          console.warn('Unknown drawing command type:', resolvedCmd.type);
      }
    } catch (error) {
      console.error('Error rendering drawing command:', error, cmd);
    }

    onProgress?.(i + 1, commands.length);

    // Delay between commands (skip delay after last command)
    if (i < commands.length - 1 && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delayPerCommand);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
  }

  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x1, y1, x2, y2, color, width } = cmd;

  if (
    typeof x1 !== 'number' ||
    typeof y1 !== 'number' ||
    typeof x2 !== 'number' ||
    typeof y2 !== 'number'
  ) {
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = color || AI_COLOR;
  ctx.lineWidth = width || AI_WIDTH;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, cmd: any) {
  const { cx, cy, r, fill, color, width } = cmd;

  if (
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    typeof r !== 'number'
  ) {
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2);

  if (fill) {
    ctx.fillStyle = color || AI_COLOR;
    ctx.fill();
  } else {
    ctx.strokeStyle = color || AI_COLOR;
    ctx.lineWidth = width || AI_WIDTH;
    ctx.stroke();
  }
}

function drawPath(ctx: CanvasRenderingContext2D, cmd: any) {
  const { points, color, width } = cmd;

  if (!Array.isArray(points) || points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = color || AI_COLOR;
  ctx.lineWidth = width || AI_WIDTH;

  const [startX, startY] = points[0];
  ctx.moveTo(startX, startY);

  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    if (typeof x === 'number' && typeof y === 'number') {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, content, font, color } = cmd;

  if (typeof x !== 'number' || typeof y !== 'number' || !content) {
    return;
  }

  ctx.font = font || '24px sans-serif';
  ctx.fillStyle = color || AI_COLOR;
  ctx.textBaseline = 'top';
  ctx.fillText(String(content), x, y);
}

function drawSpeechbubble(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, text, tailX, tailY, color = '#333333', fontSize = 16 } = cmd;

  if (typeof x !== 'number' || typeof y !== 'number' || !text) return;

  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Measure text
  const words = String(text).split(' ');
  const maxWidth = 200;
  const lines: string[] = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  const lineHeight = fontSize * 1.3;
  const padding = 12;
  const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = lines.length * lineHeight + padding * 2;

  const bx = x - bubbleWidth / 2;
  const by = y - bubbleHeight / 2;
  const radius = 8;

  // Rounded rectangle
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bubbleWidth - radius, by);
  ctx.quadraticCurveTo(bx + bubbleWidth, by, bx + bubbleWidth, by + radius);
  ctx.lineTo(bx + bubbleWidth, by + bubbleHeight - radius);
  ctx.quadraticCurveTo(bx + bubbleWidth, by + bubbleHeight, bx + bubbleWidth - radius, by + bubbleHeight);
  ctx.lineTo(bx + radius, by + bubbleHeight);
  ctx.quadraticCurveTo(bx, by + bubbleHeight, bx, by + bubbleHeight - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail (triangle pointing to tailX/tailY)
  if (typeof tailX === 'number' && typeof tailY === 'number') {
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bubbleHeight);
    ctx.lineTo(tailX, tailY);
    ctx.lineTo(x + 6, by + bubbleHeight);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();
  }

  // Text lines
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textStartY = by + padding + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, textStartY + i * lineHeight);
  }

  ctx.restore();
}

function drawClear(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, width, height } = cmd;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') return;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}
