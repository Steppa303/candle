# 🕯️ Candle — AI-Rendering-Upgrade

**Datum:** 2026-08-27
**Status:** Planung
**Ziel:** KI zeichnet nicht mehr nur Strichmännchen, sondern kann komplexe, ausdrucksstarke Inhalte auf den Canvas bringen.

---

## Problem

Aktuell bekommt Gemini ein Canvas-PNG und gibt JSON-Drawing-Commands zurück (`line`, `circle`, `path`, `text`). Das Ergebnis:
- Primitive Strichzeichnungen
- Text wird nicht vernünftig gerendert (kein Word-Wrap, keine Größenanpassung)
- Keine Möglichkeit für komplexe Inhalte (Diagramme, Comics, Infografiken)
- Koordinaten werden aus dem PNG geschätzt → unpräzise

## Lösung: Drei Säulen

| Säule | Was | Impact |
|-------|-----|--------|
| **(A) SVG-Generierung** | KI generiert SVG statt JSON-Commands | 🔴 Hoch — Game-Changer |
| **(B) Text-Rendering** | Proper Font-Loading, Word-Wrap, Alignment | 🟡 Mittel — fixt das größte UX-Problem |
| **(C) Template-Bibliothek** | Vorgefertigte SVG-Shapes die die KI platzieren kann | 🟡 Mittel — konsistente, hochwertige Elemente |

---

## Säule A: SVG-Generierung

### Warum SVG?

Das aktuelle JSON-Command-System (`line`, `circle`, `path`, `text`) ist ein Mini-Renderer den wir selbst bauen und warten müssen. SVG ist ein **fertiger Standard** den jeder Browser nativ kann:

- **Text:** SVG hat natives Text-Rendering mit Font-Size, Alignment, Word-Wrap (via `<foreignObject>`)
- **Pfade:** `<path>` mit Bézier-Kurven, Arcs, alles was Canvas kann, aber als deklaratives Markup
- **Formen:** `<rect>`, `<ellipse>`, `<polygon>`, `<circle>` — alles nativ
- **Füllungen:** Solid, Gradient, Pattern, Opacity
- **Gruppierung:** `<g>` für logische Gruppen (z.B. eine Figur mit allen Teilen)
- **Transformationen:** rotate, scale, translate — ohne Koordinaten neu zu berechnen

**Der entscheidende Vorteil:** Gemini kann SVG viel besser generieren als Canvas-Koordinaten. SVG ist textbasiert, strukturiert, und die KI hat Unmengen an SVG-Beispielen im Training-Data.

### Architektur

```
Gemini gibt zurück:
{
  "text": "Ich sehe einen Kopf. Ich male den Körper dazu!",
  "svg": "<svg viewBox='0 0 400 300'>...</svg>",
  "drawing": [...]  // Fallback für alte Sessions
}

Client:
1. Prüft ob `svg` vorhanden → ja: rendert SVG
2. Nein: Fallback auf `drawing` (alte JSON-Commands)
3. SVG wird als <image> auf den Canvas gerastert
4. Oder: SVG wird inline gerendert und nach Rasterung auf Canvas gepainted
```

### SVG-Rendering-Pipeline

```
┌─────────────────┐
│ Gemini Response  │
│ { svg: "..." }   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SVG-Validator    │  ← Sanitize: Keine <script>, <foreignObject> nur für Text
│ (DOMParser)      │  ← Größe anpassen: viewBox auf Canvas-Dimensionen
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SVG → Image      │  ← new Image() mit data:image/svg+xml;base64
│ (Rasterisierung) │  ← Auf Background-Canvas zeichnen
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Canvas-Render    │  ← Wie bisher, aber mit gerastertem SVG-Bild
│ (Animation?)     │  ← Optional: SVG-Elemente einzeln einblenden
└─────────────────┘
```

### Server-Seite (`server/ai.js`)

**Neuer Prompt-Teil:**

```
ANTWORT-FORMAT:
Du hast ZWEI Möglichkeiten zu antworten:

OPTION 1 — SVG (bevorzugt für alles außer einfachen Linien):
{
  "text": "Deine Text-Antwort",
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>...</svg>"
}

OPTION 2 — Drawing Commands (nur für einfache Ergänzungen wie einzelne Linien):
{
  "text": "Deine Text-Antwort",
  "drawing": [...]
}

WANN SVG:
- Text mit Word-Wrap, verschiedenen Größen, oder Absätzen
- Komplexe Zeichnungen (Figuren mit Details, Diagramme, Szenen)
- Alles was mehr als 5-6 Drawing-Commands bräuchte
- Sprechblasen, Panels, Infografiken

WANN Drawing Commands:
- Einzelne Linien oder Kreise
- Sehr einfache Ergänzungen zum bestehenden Content
- Wenn du nur 1-2 Elemente hinzufügst

SVG-REGELN:
- IMMER xmlns='http://www.w3.org/2000/svg' Attribut
- viewBox MUSS gesetzt sein (z.B. viewBox='0 0 400 300')
- Für Text: <text> mit font-size, text-anchor, fill
- Für Word-Wrap: <foreignObject> mit HTML <div> (max-width, word-wrap: break-word)
- Farben: #000000, #333333, #666666 (E-ink kompatibel)
- Keine Transparenzen (opacity immer 1)
- Keine <script>-Tags
- Keine externen Ressourcen (Bilder, Fonts)
- Stroke-width: 2px default
- Font: sans-serif (wird vom Client ersetzt)
```

**SVG-Validierung (Server-seitig, `server/svgValidator.js`):**

```javascript
// NEUE DATEI: server/svgValidator.js

/**
 * Validate and sanitize SVG from AI response.
 * - Removes dangerous elements (script, foreignObject with scripts)
 * - Ensures viewBox is set
 * - Limits size
 * - Returns cleaned SVG string or null
 */
function validateSvg(svgString) {
  if (!svgString || typeof svgString !== 'string') return null;

  // Basic size limit (max 100KB)
  if (svgString.length > 100_000) return null;

  // Must start with <svg
  if (!svgString.trim().startsWith('<svg')) return null;

  // Remove script tags
  let cleaned = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Ensure xmlns is present
  if (!cleaned.includes('xmlns=')) {
    cleaned = cleaned.replace('<svg', "<svg xmlns='http://www.w3.org/2000/svg'");
  }

  // Ensure viewBox is present — if not, try to add one
  if (!cleaned.includes('viewBox=')) {
    // Try to extract width/height
    const widthMatch = cleaned.match(/width=['"](\d+)['"]/);
    const heightMatch = cleaned.match(/height=['"](\d+)['"]/);
    if (widthMatch && heightMatch) {
      cleaned = cleaned.replace(
        '<svg',
        `<svg viewBox='0 0 ${widthMatch[1]} ${heightMatch[1]}'`
      );
    } else {
      // Default viewBox
      cleaned = cleaned.replace('<svg', "<svg viewBox='0 0 400 300'");
    }
  }

  return cleaned;
}

module.exports = { validateSvg };
```

### Client-Seite (`client/src/utils/svgRenderer.ts`)

**NEUE DATEI: `client/src/utils/svgRenderer.ts`**

```typescript
/**
 * SVG Renderer — converts AI-generated SVG to canvas image.
 * Handles validation, sizing, and rasterization.
 */

const MAX_SVG_SIZE = 800; // max dimension in CSS pixels
const SVG_PADDING = 20;   // padding around SVG content

export interface SvgRenderResult {
  success: boolean;
  image?: HTMLImageElement;
  error?: string;
}

/**
 * Render an SVG string to an HTMLImageElement that can be drawn on canvas.
 * Handles viewBox parsing, sizing, and E-ink optimization.
 */
export async function renderSvgToImage(
  svgString: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<SvgRenderResult> {
  try {
    // Parse viewBox to get intrinsic size
    const viewBox = parseViewBox(svgString);
    if (!viewBox) {
      return { success: false, error: 'No viewBox found in SVG' };
    }

    // Calculate target size (fit within canvas with padding)
    const maxWidth = canvasWidth - SVG_PADDING * 2;
    const maxHeight = canvasHeight - SVG_PADDING * 2;
    const scale = Math.min(
      maxWidth / viewBox.width,
      maxHeight / viewBox.height,
      1 // don't upscale
    );

    const targetWidth = Math.round(viewBox.width * scale);
    const targetHeight = Math.round(viewBox.height * scale);

    // Inject font-family override for E-ink readability
    let sizedSvg = svgString;

    // Set explicit width/height for rasterization
    sizedSvg = sizedSvg.replace(
      /<svg/,
      `<svg width='${targetWidth}' height='${targetHeight}'`
    );

    // Inject font override into SVG
    sizedSvg = injectFontOverride(sizedSvg);

    // Convert to data URL
    const encoded = btoa(unescape(encodeURIComponent(sizedSvg)));
    const dataUrl = `data:image/svg+xml;base64,${encoded}`;

    // Load as Image
    const image = await loadImage(dataUrl);

    return { success: true, image };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown SVG render error'
    };
  }
}

/**
 * Parse viewBox from SVG string.
 */
function parseViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const match = svg.match(/viewBox=['"]([^'"]+)['"]/);
  if (!match) return null;

  const parts = match[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;

  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/**
 * Inject font-family override for consistent rendering.
 * Replaces all font-family attributes with a web-safe stack.
 */
function injectFontOverride(svg: string): string {
  // Replace font-family in style attributes
  return svg.replace(
    /font-family\s*:\s*[^;'"]+/gi,
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  );
}

/**
 * Load a data URL as an HTMLImageElement.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG image'));
    img.src = url;
  });
}

/**
 * Draw a rendered SVG image onto a canvas context.
 * Handles positioning (relative or absolute).
 */
export function drawSvgOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  options: {
    x?: number;
    y?: number;
    position?: string;
    anchor?: string;
    bgCanvas?: HTMLCanvasElement;
  } = {}
) {
  const { x = 0, y = 0, position, anchor, bgCanvas } = options;

  let drawX = x;
  let drawY = y;

  // If relative positioning requested, calculate from content bounds
  if (position && bgCanvas) {
    const { detectContentBounds } = require('./contentDetector');
    const bounds = detectContentBounds(bgCanvas);
    const { resolvePosition } = require('./drawingRenderer');

    // Create a virtual command for resolvePosition
    const virtualCmd = { position, anchor, x: 0, y: 0 };
    const { offsetX, offsetY } = resolvePosition(virtualCmd, bounds);

    // Center the SVG at the resolved position
    drawX = offsetX - image.width / 2;
    drawY = offsetY - image.height / 2;
  }

  ctx.drawImage(image, drawX, drawY);
}
```

### Integration in bestehende Dateien

**`client/src/utils/drawingRenderer.ts` — Änderungen:**

```typescript
// Neue Imports
import { renderSvgToImage, drawSvgOnCanvas } from './svgRenderer';

// In renderDrawingCommands() und renderDrawingCommandsAnimated():
// Vor dem bestehenden switch-case:

if (commands.svg) {
  // SVG-Modus: Rendere SVG als Bild auf den Canvas
  const result = await renderSvgToImage(commands.svg, bgCanvas?.width || 400, bgCanvas?.height || 300);
  if (result.success && result.image) {
    drawSvgOnCanvas(ctx, result.image, {
      position: commands.position,
      anchor: commands.anchor,
      bgCanvas
    });
  }
  return;
}

// Bestehender Drawing-Command-Code bleibt als Fallback
```

**`client/src/hooks/useSocket.ts` — Response-Type erweitern:**

```typescript
// In der ai:response Handler:
interface AIResponse {
  text: string;
  svg?: string;           // NEU: SVG-Markup
  drawing?: DrawingCommand[];  // Fallback
  interactionId: string;
  isProaktiv?: boolean;
}
```

**`client/src/hooks/useCanvas.ts` — SVG-Rendering:**

```typescript
// renderAIDrawing erweitern:
const renderAIDrawing = useCallback(async (data: { svg?: string; drawing?: any[] }) => {
  if (data.svg) {
    // SVG-Pfad
    const result = await renderSvgToImage(data.svg, canvasWidth, canvasHeight);
    if (result.success && result.image) {
      const ctx = bgCtxRef.current;
      if (ctx) {
        drawSvgOnCanvas(ctx, result.image);
      }
    }
  } else if (data.drawing) {
    // Bestehender Drawing-Command-Pfad (Fallback)
    await renderDrawingCommandsAnimated(ctx, data.drawing, { ... });
  }
}, [canvasWidth, canvasHeight]);
```

**`server/ai.js` — analyzeCanvas() erweitern:**

```javascript
// In analyzeCanvas():
// parseAIResponse() erweitern um SVG-Extraktion:

function parseAIResponse(content) {
  // ... bestehender JSON-Parse-Code ...

  const parsed = JSON.parse(jsonStr);

  return {
    text: parsed.text || 'Keine Text-Antwort',
    svg: parsed.svg || null,                    // NEU
    drawing: Array.isArray(parsed.drawing) ? parsed.drawing : null
  };
}
```

**`server/socket.js` — SVG in Response:**

```javascript
// In stroke:complete Handler:
socket.emit('ai:response', {
  text: aiResponse.text,
  svg: aiResponse.svg,           // NEU
  drawing: aiResponse.drawing,
  interactionId
});
```

**`server/db.js` — SVG speichern:**

```sql
-- Migration: SVG-Feld in interactions
ALTER TABLE interactions ADD COLUMN ai_svg TEXT;
```

```javascript
// addInteraction() erweitert um svg Parameter
function addInteraction(sessionId, canvasSnapshot, aiResponseText, aiDrawingJson, aiSvg = null) {
  // ... existing code ...
  stmt.run(sessionId, canvasSnapshot, aiResponseText, aiDrawingJson, aiSvg, new Date().toISOString());
}
```

### Betroffene Dateien (Säule A)

| Datei | Änderung |
|-------|----------|
| `server/ai.js` | Prompt erweitert (SVG-Format), `parseAIResponse()` liest `svg` Feld |
| `server/svgValidator.js` | **NEU** — SVG-Sanitization |
| `server/socket.js` | `svg` in Response-Events durchreichen |
| `server/db.js` | `ai_svg` Feld + Migration |
| `client/src/utils/svgRenderer.ts` | **NEU** — SVG → Image Pipeline |
| `client/src/utils/drawingRenderer.ts` | SVG-Branch vor Drawing-Commands |
| `client/src/hooks/useCanvas.ts` | `renderAIDrawing()` akzeptiert SVG |
| `client/src/hooks/useSocket.ts` | Response-Type erweitert |

### Aufwand: ~6-8 Stunden

| Task | Stunden |
|------|---------|
| Prompt-Engineering (SVG-Format) | 1.5 |
| `svgValidator.js` | 0.5 |
| `svgRenderer.ts` | 2.0 |
| Integration in drawingRenderer + useCanvas | 1.5 |
| DB-Migration + Socket | 0.5 |
| Testing auf Kindle Scribe | 1.5 |
| Fallback-Handling (alte Sessions) | 0.5 |

---

## Säule B: Text-Rendering-Upgrade

### Problem

Aktuell rendert die KI Text mit `ctx.fillText()` — ein einziger String, keine Formatierung:
- Kein Word-Wrap → langer Text läuft über den Canvas hinaus
- Keine verschiedenen Größen → alles gleich groß
- Kein Alignment → Text startet immer links
- Kein Hintergrund → Text unsichtbar auf dunklem Content
- `font` wird als String übergeben ("24px sans-serif") → keine Kontrolle

### Lösung

Zwei Schritte:
1. **Sofort-Maßnahme:** Besserer `text` Drawing-Command mit mehr Optionen
2. **Langfristig:** Text über SVG-Rendering (Säule A) — dann ist das hier obsolet

Da Säule A SVG mit `<text>` und `<foreignObject>` ohnehin besseren Text bringt, ist Säule B primär ein **Fallback für Drawing-Commands** und ein **Text-Overlay-Upgrade**.

### Neues Text-Command-Format

```json
{
  "type": "text",
  "x": 0, "y": 0,
  "content": "Hallo Welt! Das ist ein längerer Text der automatisch umgebrochen wird.",
  "fontSize": 20,           // NEU: statt font-String
  "fontWeight": "bold",     // NEU: normal | bold
  "maxWidth": 300,          // NEU: Word-Wrap-Breite in px
  "align": "center",        // NEU: left | center | right
  "lineHeight": 1.4,        // NEU: Zeilenhöhe (Multiplikator)
  "background": "#FFFFFF",  // NEU: Hintergrundfarbe (optional)
  "padding": 8,             // NEU: Padding um Text-Block
  "color": "#333333",
  "position": "below",
  "anchor": "center"
}
```

### Text-Renderer (`client/src/utils/textRenderer.ts`)

**NEUE DATEI: `client/src/utils/textRenderer.ts`**

```typescript
/**
 * Advanced text renderer with word-wrap, alignment, and background.
 * Used as fallback when SVG is not available.
 */

interface TextOptions {
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  background?: string;
  padding?: number;
  color?: string;
}

const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Render text with word-wrap, alignment, and optional background.
 * Returns the bounding box of the rendered text.
 */
export function renderText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: TextOptions
): { width: number; height: number } {
  const {
    content,
    fontSize = 20,
    fontWeight = 'normal',
    maxWidth = 300,
    align = 'left',
    lineHeight = 1.4,
    background,
    padding = 8,
    color = '#333333'
  } = options;

  if (!content) return { width: 0, height: 0 };

  // Set font
  ctx.font = `${fontWeight} ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  // Word-wrap
  const lines = wrapText(ctx, content, maxWidth);
  const lineHeightPx = fontSize * lineHeight;
  const totalHeight = lines.length * lineHeightPx;

  // Calculate text block width (widest line)
  let blockWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    if (metrics.width > blockWidth) blockWidth = metrics.width;
  }

  // Draw background if specified
  if (background) {
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(
      x - padding,
      y - padding,
      blockWidth + padding * 2,
      totalHeight + padding * 2
    );
    ctx.restore();
  }

  // Draw text lines
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    let lineX = x;

    // Alignment
    if (align === 'center') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = x + (blockWidth - lineWidth) / 2;
    } else if (align === 'right') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = x + blockWidth - lineWidth;
    }

    ctx.fillText(lines[i], lineX, y + i * lineHeightPx);
  }

  ctx.restore();

  return {
    width: blockWidth + padding * 2,
    height: totalHeight + padding * 2
  };
}

/**
 * Word-wrap text to fit within maxWidth.
 * Splits on spaces, falls back to character-level splitting.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // If a single word is too wide, split it character by character
  const finalLines: string[] = [];
  for (const line of lines) {
    if (ctx.measureText(line).width > maxWidth) {
      // Character-level split
      let charLine = '';
      for (const char of line) {
        const testChar = charLine + char;
        if (ctx.measureText(testChar).width > maxWidth) {
          finalLines.push(charLine);
          charLine = char;
        } else {
          charLine = testChar;
        }
      }
      if (charLine) finalLines.push(charLine);
    } else {
      finalLines.push(line);
    }
  }

  return finalLines.length > 0 ? finalLines : [''];
}
```

### Integration in `drawingRenderer.ts`

```typescript
// In drawText() ersetzen:
import { renderText } from './textRenderer';

function drawText(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, content, font, color, fontSize, fontWeight, maxWidth, align, lineHeight, background, padding } = cmd;

  if (typeof x !== 'number' || typeof y !== 'number' || !content) return;

  // Neues Format (mit fontSize)
  if (fontSize) {
    renderText(ctx, x, y, {
      content: String(content),
      fontSize,
      fontWeight,
      maxWidth,
      align,
      lineHeight,
      background,
      padding,
      color
    });
  } else {
    // Altes Format (Fallback)
    ctx.font = font || '24px sans-serif';
    ctx.fillStyle = color || AI_COLOR;
    ctx.textBaseline = 'top';
    ctx.fillText(String(content), x, y);
  }
}
```

### Text-Overlay-Upgrade (`client/src/components/TextOverlay.tsx`)

Das Text-Overlay zeigt die KI-Text-Antwort als schwebenden Text über dem Canvas. Aktuell vermutlich simpel. Upgrade:

- **Markdown-lite:** Fett, Kursiv, Inline-Code (via simple regex → HTML)
- **Auto-Dismiss:** Nach X Sekunden (konfigurierbar, aktuell 8s)
- **Tap-to-Dismiss:** Tippen schließt das Overlay
- **Max-Width:** Text bricht um, wird nicht abgeschnitten
- **E-ink:** Hoher Kontrast, keine Transparenzen

### Betroffene Dateien (Säule B)

| Datei | Änderung |
|-------|----------|
| `client/src/utils/textRenderer.ts` | **NEU** — Word-Wrap Text-Renderer |
| `client/src/utils/drawingRenderer.ts` | `drawText()` nutzt neuen Renderer |
| `client/src/components/TextOverlay.tsx` | Markdown-lite, Tap-to-Dismiss |
| `server/ai.js` | Prompt: neues Text-Command-Format dokumentieren |

### Aufwand: ~3-4 Stunden

| Task | Stunden |
|------|---------|
| `textRenderer.ts` | 1.5 |
| Integration in drawingRenderer | 0.5 |
| TextOverlay-Upgrade | 1.0 |
| Prompt-Anpassung | 0.5 |

---

## Säule C: Template-Bibliothek

### Konzept

Vorgefertigte SVG-Shapes die die KI per Name referenzieren kann, statt alles selbst zu zeichnen. Garantiert konsistente, hochwertige Darstellung.

### Template-Kategorien

**1. Sprechblasen (Speech Bubbles)**
```
speechbubble-round     — Runde Sprechblase mit Schweif
speechbubble-thought   — Gedankenblase (Wolken-Punkte)
speechbubble-shout     — Zackige Sprechblase (Ausruf)
speechbubble-whisper   — Gestrichelte Sprechblase
```

**2. Panel-Rahmen (Comic Panels)**
```
panel-simple           — Einfaches Rechteck
panel-rounded          — Abgerundetes Rechteck
panel-dramatic         — Diagonale Linie / Split
panel-inset            — Eingerücktes Panel (Schatten)
```

**3. Pfeile & Connectors**
```
arrow-straight         — Gerader Pfeil
arrow-curved           — Geschwungener Pfeil
arrow-double           — Doppelpfeil
connector-line         — Verbindungslinie mit Punkten
```

**4. Standard-Icons**
```
icon-smile             — 🙂
icon-star              — ⭐
icon-heart             — ❤️
icon-check             — ✅
icon-cross             — ❌
icon-question          — ❓
icon-exclamation       — ❗
icon-lightbulb         — 💡
icon-arrow-right       — →
```

**5. Diagramm-Elemente**
```
diagram-box            — Rechteck mit Text
diagram-circle         — Kreis mit Text
diagram-diamond        — Raute mit Text
diagram-flowchart      — Box + Pfeil + Box
diagram-tree           — Baumstruktur
diagram-list           — Nummerierte Liste
```

**6. Hintergrund-Elemente**
```
bg-gradient-light      — Heller Verlauf
bg-grid                — Gitter-Linien
bg-dots                — Punkt-Muster
bg-frame               — Dekorativer Rahmen
```

### Template-Format

Jedes Template ist ein SVG-Snippet mit Platzhaltern:

```xml
<!-- speechbubble-round -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  <rect x="10" y="10" width="180" height="80" rx="20" ry="20"
        fill="white" stroke="#333" stroke-width="2"/>
  <polygon points="60,90 80,90 50,115" fill="white" stroke="#333" stroke-width="2"/>
  <text x="100" y="55" text-anchor="middle" font-size="16" fill="#333">
    {{TEXT}}
  </text>
</svg>
```

### Template-Engine (`server/templates.js`)

**NEUE DATEI: `server/templates.js`**

```javascript
/**
 * Template library for pre-built SVG shapes.
 * Templates are referenced by name in AI prompts.
 */

const TEMPLATES = {
  'speechbubble-round': {
    viewBox: '0 0 200 120',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
      <rect x="10" y="10" width="180" height="80" rx="20" ry="20"
            fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <polygon points="60,90 80,90 50,115" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="100" y="55" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'speechbubble-thought': {
    viewBox: '0 0 200 130',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130">
      <ellipse cx="100" cy="50" rx="90" ry="40" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <circle cx="60" cy="100" r="8" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <circle cx="45" cy="115" r="5" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="100" y="55" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'speechbubble-shout': {
    viewBox: '0 0 220 130',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130">
      <polygon points="110,5 140,25 210,15 180,50 215,75 150,70 130,100 110,75 90,100 70,70 5,75 40,50 10,15 80,25"
               fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="110" y="60" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'diagram-box': {
    viewBox: '0 0 160 60',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60">
      <rect x="5" y="5" width="150" height="50" rx="4" ry="4"
            fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="80" y="35" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'diagram-diamond': {
    viewBox: '0 0 120 120',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <polygon points="60,5 115,60 60,115 5,60" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="60" y="65" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'icon-star': {
    viewBox: '0 0 40 40',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <polygon points="20,2 25,15 39,15 28,24 32,38 20,30 8,38 12,24 1,15 15,15"
               fill="{{FILL}}" stroke="{{COLOR}}" stroke-width="1"/>
    </svg>`,
    params: ['FILL', 'COLOR']
  },

  'arrow-curved': {
    viewBox: '0 0 200 60',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
      <path d="M 10,50 Q 100,10 190,50" fill="none" stroke="{{COLOR}}" stroke-width="2"/>
      <polygon points="190,50 180,40 185,50 180,60" fill="{{COLOR}}"/>
    </svg>`,
    params: ['COLOR']
  }
};

/**
 * Render a template with given parameters.
 * Returns SVG string or null if template not found.
 */
function renderTemplate(name, params = {}) {
  const template = TEMPLATES[name];
  if (!template) return null;

  let svg = template.svg;

  // Replace placeholders
  for (const [key, value] of Object.entries(params)) {
    svg = svg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Set defaults for unreplaced placeholders
  svg = svg.replace(/\{\{TEXT\}\}/g, '...');
  svg = svg.replace(/\{\{COLOR\}\}/g, '#333333');
  svg = svg.replace(/\{\{FONTSIZE\}\}/g, '16');
  svg = svg.replace(/\{\{FILL\}\}/g, 'white');

  return svg;
}

/**
 * Get list of available template names.
 */
function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

/**
 * Get template info (name + description) for AI prompt.
 */
function getTemplateDescriptions() {
  return Object.entries(TEMPLATES).map(([name, tmpl]) => ({
    name,
    viewBox: tmpl.viewBox,
    params: tmpl.params
  }));
}

module.exports = { renderTemplate, getTemplateNames, getTemplateDescriptions, TEMPLATES };
```

### Template-Referenz im AI-Prompt

```
VERFÜGBARE TEMPLATES:
Du kannst vorgefertigte Templates verwenden, indem du im SVG-Response
einen <use>-ähnlichen Command einfügst:

{
  "text": "Ich habe eine Sprechblase hinzugefügt!",
  "templates": [
    {
      "name": "speechbubble-round",
      "params": { "TEXT": "Hallo!", "COLOR": "#333333", "FONTSIZE": "18" },
      "x": 100, "y": 50,
      "position": "above",
      "anchor": "center"
    }
  ]
}

Verfügbare Templates:
- speechbubble-round (TEXT, COLOR, FONTSIZE) — Runde Sprechblase
- speechbubble-thought (TEXT, COLOR, FONTSIZE) — Gedankenblase
- speechbubble-shout (TEXT, COLOR, FONTSIZE) — Ausruf-Blase
- diagram-box (TEXT, COLOR, FONTSIZE) — Rechteck mit Text
- diagram-diamond (TEXT, COLOR, FONTSIZE) — Raute mit Text
- arrow-curved (COLOR) — Geschwungener Pfeil
- icon-star (FILL, COLOR) — Stern-Icon
```

### Template-Rendering-Pipeline

```
Gemini Response
  ├── svg: "..."           → SVG-Renderer (Säule A)
  ├── templates: [...]     → Template-Engine → SVG → SVG-Renderer
  └── drawing: [...]       → Drawing-Command-Renderer (Fallback)
```

**Server-seitig (`server/ai.js`):**

```javascript
// In parseAIResponse():
return {
  text: parsed.text || 'Keine Text-Antwort',
  svg: parsed.svg || null,
  templates: Array.isArray(parsed.templates) ? parsed.templates : null,  // NEU
  drawing: Array.isArray(parsed.drawing) ? parsed.drawing : null
};

// In analyzeCanvas(), nach parseAIResponse():
// Templates → SVG konvertieren
if (aiResponse.templates && aiResponse.templates.length > 0) {
  const templateSvgs = aiResponse.templates.map(t => {
    const svg = templates.renderTemplate(t.name, t.params || {});
    if (!svg) return null;
    return { svg, x: t.x, y: t.y, position: t.position, anchor: t.anchor };
  }).filter(Boolean);

  // Templates als SVG-Gruppe zusammenbauen
  if (templateSvgs.length > 0) {
    aiResponse.templateSvg = templateSvgs;
  }
}
```

**Client-seitig:**

```typescript
// In useSocket.ts:
interface AIResponse {
  text: string;
  svg?: string;
  templateSvg?: Array<{ svg: string; x: number; y: number; position?: string; anchor?: string }>;
  drawing?: DrawingCommand[];
  interactionId: string;
}

// In useCanvas.ts — renderAIDrawing():
if (data.templateSvg) {
  for (const tmpl of data.templateSvg) {
    const result = await renderSvgToImage(tmpl.svg, canvasWidth, canvasHeight);
    if (result.success && result.image) {
      drawSvgOnCanvas(ctx, result.image, {
        x: tmpl.x, y: tmpl.y,
        position: tmpl.position, anchor: tmpl.anchor,
        bgCanvas
      });
    }
  }
}
```

### Betroffene Dateien (Säule C)

| Datei | Änderung |
|-------|----------|
| `server/templates.js` | **NEU** — Template-Bibliothek + Engine |
| `server/ai.js` | Prompt: Template-Referenz, `parseAIResponse()` liest `templates` |
| `server/socket.js` | `templateSvg` in Response |
| `client/src/utils/svgRenderer.ts` | Template-Rendering (nutzt SVG-Pipeline) |
| `client/src/hooks/useCanvas.ts` | `renderAIDrawing()` handhabt Templates |
| `client/src/hooks/useSocket.ts` | Response-Type erweitert |

### Aufwand: ~4-5 Stunden

| Task | Stunden |
|------|---------|
| Template-Design (SVGs) | 1.5 |
| `templates.js` Engine | 1.0 |
| Prompt-Integration | 0.5 |
| Client-Rendering | 1.0 |
| Testing | 1.0 |

---

## Gesamt-Übersicht

### Implementierungs-Reihenfolge

```
Phase 1: Text-Rendering (Säule B)          ~3-4h
  └── Fixt sofort das größte Problem (Text)
  └── Keine Abhängigkeiten

Phase 2: SVG-Generierung (Säule A)          ~6-8h
  └── Game-Changer für visuelle Qualität
  └── Ersetzt langfristig Drawing-Commands

Phase 3: Templates (Säule C)                ~4-5h
  └── Baut auf SVG-Pipeline auf
  └── Konsistente, hochwertige Elemente
```

**Gesamtaufwand: ~13-17 Stunden**

### Dateien-Übersicht

```
NEUE DATEIEN:
├── server/svgValidator.js          — SVG-Sanitization (Säule A)
├── server/templates.js             — Template-Bibliothek (Säule C)
├── client/src/utils/svgRenderer.ts — SVG → Canvas Pipeline (Säule A)
└── client/src/utils/textRenderer.ts — Word-Wrap Text (Säule B)

GEÄNDERTE DATEIEN:
├── server/ai.js                    — Prompt + parseAIResponse (A+B+C)
├── server/socket.js                — Response-Events (A+C)
├── server/db.js                    — ai_svg Feld (A)
├── client/src/utils/drawingRenderer.ts — SVG-Branch + Text-Upgrade (A+B)
├── client/src/hooks/useCanvas.ts   — renderAIDrawing (A+C)
├── client/src/hooks/useSocket.ts   — Response-Type (A+C)
└── client/src/components/TextOverlay.tsx — Markdown-lite (B)
```

### Backwards-Compatibility

- Alte Sessions ohne `svg`-Feld → Fallback auf `drawing`-Commands
- Alte Sessions ohne `templates` → ignoriert
- `parseAIResponse()` gibt IMMER `text` + `drawing` zurück (auch wenn `svg` vorhanden)
- Client prüft: `svg` vorhanden? → SVG-Pfad. Sonst: `drawing`-Pfad.

### Testing-Strategie

**Automatisiert (Backend):**
- [ ] `svgValidator.js` — Test-Cases für bösartiges SVG
- [ ] `templates.js` — Alle Templates rendern korrekt
- [ ] `parseAIResponse()` — Extrahiert svg, templates, drawing korrekt

**Manuell (Kindle Scribe):**
- [ ] SVG wird korrekt gerastert und auf Canvas gezeichnet
- [ ] Text mit Word-Wrap funktioniert
- [ ] Templates werden korrekt positioniert
- [ ] Fallback auf Drawing-Commands bei alten Sessions
- [ ] Performance: SVG-Rendering < 500ms
- [ ] E-ink: SVG-Inhalt sichtbar und scharf

---

_Erstellt: 2026-08-27 21:56. Detaillierter Umsetzungsplan für SVG-Generierung + Text-Rendering + Templates._
