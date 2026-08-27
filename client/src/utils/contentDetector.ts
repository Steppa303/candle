/**
 * Content Detection — finds bounding box of existing content on canvas.
 * Used for relative positioning of AI drawing commands.
 */

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContentInfo {
  bounds: ContentBounds;
  avgObjectSize: number;
  contentDensity: number;
}

/**
 * Detect the bounding box of non-white content on a canvas.
 * Scans every 4th pixel for performance.
 * Returns full canvas bounds if canvas is empty.
 */
export function detectContentBounds(canvas: HTMLCanvasElement): ContentBounds {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  // Scan every 4th pixel for performance
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Not white (or near-white) and not transparent
      if (a > 128 && (r < 240 || g < 240 || b < 240)) {
        hasContent = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Analyze content on canvas: bounding box, average object size, and density.
 * Scans every 4th pixel for performance.
 */
export function analyzeContent(canvas: HTMLCanvasElement): ContentInfo {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      bounds: { x: 0, y: 0, width: canvas.width, height: canvas.height },
      avgObjectSize: 0,
      contentDensity: 0
    };
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Track content pixels for density
  let contentPixels = 0;
  let totalSampled = 0;

  // Scan horizontal lines every 4px to measure object sizes
  const edgeGaps: number[] = [];

  for (let y = 0; y < h; y += 4) {
    let lastEdgeX = -1;
    let inContent = false;

    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const isContent = a > 128 && (r < 240 || g < 240 || b < 240);

      totalSampled++;
      if (isContent) contentPixels++;

      if (isContent && !inContent) {
        // Entering content region
        if (lastEdgeX >= 0) {
          edgeGaps.push(x - lastEdgeX);
        }
        lastEdgeX = x;
        inContent = true;
      } else if (!isContent && inContent) {
        // Leaving content region
        lastEdgeX = x;
        inContent = false;
      }
    }
  }

  // Average object size: mean gap between content regions
  let avgObjectSize = 0;
  if (edgeGaps.length > 0) {
    avgObjectSize = edgeGaps.reduce((a, b) => a + b, 0) / edgeGaps.length;
  }

  // Content density: percentage of canvas covered
  const contentDensity = totalSampled > 0 ? contentPixels / totalSampled : 0;

  const bounds = detectContentBounds(canvas);

  return { bounds, avgObjectSize, contentDensity };
}
