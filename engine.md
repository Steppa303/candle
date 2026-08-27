# 🕯️ Candle V2 — Engine.md

**Technische Umsetzung von `candle-v2.md` ausgehend von der aktuellen Codebase.**
**Stand:** 2026-08-27

---

## Übersicht: Was ändert sich

V1 rendert alles client-seitig: Gemini gibt JSON-Drawing-Commands zurück, der Kindle-Canvas zeichnet sie mit Canvas 2D API. V2 verschiebt **die gesamte Rendering-Last auf den Server**. Der Kindle wird zum reinen Thin Client, der nur noch fertige PNGs empfängt und anzeigt.

### Architektur-Vergleich

```
V1 (aktuell):
  Kindle → Pen-Up → PNG an Server → Gemini → JSON Drawing-Commands → Client rendert auf Canvas

V2 (neu):
  Kindle → Pen-Up → Pfade/Rohbild an Server → Gemini → SVG → Server compositet + rastert + dithert → fertiges PNG → Kindle zeigt es an
```

---

## 1. Abhängigkeiten (neu)

```json
// package.json — neue Dependencies
{
  "resvg-js": "^2.6.0",    // SVG → PNG Rasterisierung (Rust-based, schnell)
  "sharp": "^0.33.0"        // Bildbearbeitung: Dithering, Kontrast, E-Ink-Optimierung
}
```

`resvg-js` statt `canvas`/`jsdom` weil: Rust-basiert, 10× schneller, kein native canvas dependency, perfekt für Server-Side SVG-Rendering.

---

## 2. Backend: Neue Dateien

### 2.1 `server/renderer.js` — SVG-Compositing + Rasterisierung + E-Ink

**Zentrale neue Datei.** Nimmt Gemini's SVG-Output, komponiziert ihn mit Templates, rastert, dithert.

```javascript
// server/renderer.js
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

/**
 * Render SVG string → E-Ink-optimiertes PNG (Base64).
 *
 * Pipeline:
 * 1. SVG validieren & normalisieren (viewBox, xmlns)
 * 2. Templates einbetten (falls vorhanden)
 * 3. SVG → PNG via resvg-js (vektor-scharf, kein Aliasing)
 * 4. E-Ink-Optimierung via sharp:
 *    - Konvertierung zu Graustufen
 *    - Dithering (Floyd-Steinberg) für 1-Bit-ähnliche Darstellung
 *    - Kontrastanpassung
 * 5. Rückgabe als Base64-PNG
 */
async function renderToEInkPNG(svgString, options = {}) {
  const {
    width = 1200,           // Zielbreite (Kindle Scribe: 1860×2480, wir rendern CSS-Pixel)
    height = 1600,
    dither = true,          // Floyd-Steinberg Dithering
    grayscale = true,       // Graustufen statt Farbe
    contrast = 1.2          // Kontrast-Multiplikator
  } = options;

  // 1. SVG → PNG (vektor-scharf)
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false },
    logLevel: 'warn'
  });

  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();

  // 2. E-Ink-Optimierung via sharp
  let pipeline = sharp(pngBuffer);

  if (grayscale) {
    pipeline = pipeline.grayscale();
  }

  if (contrast !== 1.0) {
    pipeline = pipeline.linear(contrast, -(128 * contrast) + 128);
  }

  if (dither) {
    // Floyd-Steinberg Dithering → 1-Bit-ähnlich, perfekt für E-Ink
    pipeline = pipeline.png({
      colours: 2,           // Schwarz/Weiß
      dither: 1.0           // Max Dithering
    });
  } else {
    pipeline = pipeline.png({ quality: 90 });
  }

  const finalBuffer = await pipeline.toBuffer();
  return finalBuffer.toString('base64');
}

/**
 * Compose: SVG + Templates → ein zusammengeführtes SVG.
 * Bettet Template-SVGs als <image>-Tags ins Haupt-SVG ein.
 */
function composeSvgWithTemplates(mainSvg, templates = [], canvasWidth = 1200, canvasHeight = 1600) {
  if (!templates || templates.length === 0) return mainSvg;

  // Templates als <image>-Tags einbetten (nach Rasterisierung jedes Templates)
  // Vereinfachte Variante: Templates werden als Inline-SVG-Gruppen eingefügt
  let composed = mainSvg;

  for (const tmpl of templates) {
    if (!tmpl.svg) continue;
    // Position berechnen (relativ zu viewBox)
    const x = tmpl.x || 0;
    const y = tmpl.y || 0;
    // Template als <g>-Gruppe mit transform einfügen
    const wrapped = `<g transform="translate(${x}, ${y})">${tmpl.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}</g>`;
    // Vor </svg> einfügen
    composed = composed.replace('</svg>', wrapped + '</svg>');
  }

  return composed;
}

module.exports = { renderToEInkPNG, composeSvgWithTemplates };
```

### 2.2 `server/svgValidator.js` — SVG-Sanitization

```javascript
// server/svgValidator.js
// (aus ai-update.md Säule A übernommen, unverändert)

function validateSvg(svgString) {
  if (!svgString || typeof svgString !== 'string') return null;
  if (svgString.length > 100_000) return null;
  if (!svgString.trim().startsWith('<svg')) return null;

  let cleaned = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  if (!cleaned.includes('xmlns=')) {
    cleaned = cleaned.replace('<svg', "<svg xmlns='http://www.w3.org/2000/svg'");
  }

  if (!cleaned.includes('viewBox=')) {
    const widthMatch = cleaned.match(/width=['"](\d+)['"]/);
    const heightMatch = cleaned.match(/height=['"](\d+)['"]/);
    if (widthMatch && heightMatch) {
      cleaned = cleaned.replace('<svg', `<svg viewBox='0 0 ${widthMatch[1]} ${heightMatch[1]}'`);
    } else {
      cleaned = cleaned.replace('<svg', "<svg viewBox='0 0 400 300'");
    }
  }

  return cleaned;
}

module.exports = { validateSvg };
```

### 2.3 `server/templates.js` — Template-Bibliothek

```javascript
// server/templates.js
// (aus ai-update.md Säule C übernommen)

const TEMPLATES = {
  'speechbubble-round': { /* ... */ },
  'speechbubble-thought': { /* ... */ },
  'speechbubble-shout': { /* ... */ },
  'diagram-box': { /* ... */ },
  'diagram-diamond': { /* ... */ },
  'arrow-curved': { /* ... */ },
  'icon-star': { /* ... */ }
  // ... weitere aus ai-update.md
};

function renderTemplate(name, params = {}) { /* ... */ }
function getTemplateNames() { /* ... */ }
function getTemplateDescriptions() { /* ... */ }

module.exports = { renderTemplate, getTemplateNames, getTemplateDescriptions, TEMPLATES };
```

---

## 3. Backend: Bestehende Dateien — Änderungen

### 3.1 `server/ai.js` — Prompt-Wechsel + SVG-Output

**Was sich ändert:**

1. **Neuer System-Prompt** für V2 (SVG-Output statt JSON-Drawing-Commands)
2. `parseAIResponse()` extrahiert jetzt `svg` + `templates` + `action` (update/scene_change)
3. `analyzeCanvas()` gibt `svg`, `templates`, `action` zurück (statt nur `drawing`)

```javascript
// server/ai.js — relevante Änderungen

const V2_SYSTEM_PROMPT = `Du bist ein kreativer Storyteller und Illustrator auf einem digitalen Canvas.
Der User zeichnet Skizzen, du antwortest mit komplexen Schwarz-Weiß-Grafiken im Graphic Novel Style.

ANTWORT-FORMAT (JSON):
{
  "action": "update" | "scene_change",
  "story_narrative": "Interner Gedankengang zur Story (wird nicht angezeigt)",
  "text": "Deine Text-Antwort an den User",
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>...</svg>",
  "templates": [
    { "name": "speechbubble-round", "params": { "TEXT": "Hallo!", "COLOR": "#333333", "FONTSIZE": "18" }, "x": 100, "y": 50 }
  ]
}

SVG-REGELN:
- IMMER xmlns='http://www.w3.org/2000/svg'
- viewBox MUSS gesetzt sein
- Farben: #000000, #333333, #666666 (E-Ink kompatibel)
- Keine Transparenzen, keine <script>-Tags, keine externen Ressourcen
- Stroke-width: 2px default
- Font: sans-serif
- Für Text: <text> mit font-size, text-anchor, fill
- Für Word-Wrap: <foreignObject> mit HTML <div>

ACTION-FELD:
- "update": Zeichnung ergänzt die aktuelle Seite
- "scene_change": Kompletter Szenenwechsel → neue Seite wird angelegt

TEMPLATES:
Du kannst vorgefertigte Templates referenzieren. Verfügbare Templates:
- speechbubble-round (TEXT, COLOR, FONTSIZE)
- speechbubble-thought (TEXT, COLOR, FONTSIZE)
- speechbubble-shout (TEXT, COLOR, FONTSIZE)
- diagram-box (TEXT, COLOR, FONTSIZE)
- diagram-diamond (TEXT, COLOR, FONTSIZE)
- arrow-curved (COLOR)
- icon-star (FILL, COLOR)

WICHTIG: Antworte NUR mit dem JSON-Objekt.`;

// parseAIResponse() erweitern:
function parseAIResponse(content) {
  // ... bestehender JSON-Parse-Code ...

  const parsed = JSON.parse(jsonStr);

  return {
    text: parsed.text || 'Keine Text-Antwort',
    action: parsed.action || 'update',                    // NEU
    story_narrative: parsed.story_narrative || null,       // NEU
    svg: parsed.svg || null,                               // NEU
    templates: Array.isArray(parsed.templates) ? parsed.templates : null,  // NEU
    drawing: Array.isArray(parsed.drawing) ? parsed.drawing : null         // Fallback V1
  };
}

// analyzeCanvas() — neuer Parameter + Prompt-Selection:
async function analyzeCanvas(canvasPng, previousInteractions = [], canvasDimensions = null, contentInfo = null, storyMode = false, v2Mode = false) {
  const systemPrompt = v2Mode ? V2_SYSTEM_PROMPT : (storyMode ? STORY_PROMPT : SYSTEM_PROMPT);
  // ... Rest wie bisher, aber mit systemPrompt ...
}
```

### 3.2 `server/socket.js` — Rendering-Pipeline + Paging

**Was sich ändert:**

1. `stroke:complete` Handler: Nach Gemini-Antwort → `renderer.renderToEInkPNG()` aufrufen
2. Response enthält jetzt `png` (fertiges gerastertes Bild) statt `drawing` (JSON-Commands)
3. Neues Event `page:change` für Szenenwechsel
4. `canvas:after-ai` wird vereinfacht (Server hat das PNG schon)

```javascript
// server/socket.js — relevante Änderungen

const { renderToEInkPNG, composeSvgWithTemplates } = require('./renderer');
const { validateSvg } = require('./svgValidator');
const templates = require('./templates');

// In stroke:complete Handler:
socket.on('stroke:complete', async (data) => {
  const { sessionId, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode, v2Mode } = data;

  // ... Session-Validierung wie bisher ...

  socket.emit('ai:thinking', {});

  const previousInteractions = db.getInteractions(sessionId);
  const aiResponse = await ai.analyzeCanvas(canvasPng, previousInteractions, canvasDimensions, contentInfo, storyMode, v2Mode);

  if (v2Mode && aiResponse.svg) {
    // === V2 PFAD: Server-Side Rendering ===

    // 1. SVG validieren
    const validSvg = validateSvg(aiResponse.svg);
    if (!validSvg) {
      socket.emit('ai:error', { message: 'Ungültiges SVG von der KI.' });
      return;
    }

    // 2. Templates componieren (falls vorhanden)
    let composedSvg = validSvg;
    if (aiResponse.templates && aiResponse.templates.length > 0) {
      const templateSvgs = aiResponse.templates.map(t => {
        const svg = templates.renderTemplate(t.name, t.params || {});
        return svg ? { svg, x: t.x, y: t.y } : null;
      }).filter(Boolean);
      composedSvg = composeSvgWithTemplates(validSvg, templateSvgs, canvasWidth, canvasHeight);
    }

    // 3. SVG → E-Ink PNG rendern
    const pngBase64 = await renderToEInkPNG(composedSvg, {
      width: canvasWidth || 1200,
      height: canvasHeight || 1600,
      dither: true,
      grayscale: true,
      contrast: 1.2
    });

    // 4. Szenenwechsel?
    if (aiResponse.action === 'scene_change') {
      const pageId = db.addPage(sessionId, pngBase64, aiResponse.text, aiResponse.story_narrative);
      socket.emit('page:new', { pageId, png: pngBase64, text: aiResponse.text });
    } else {
      // Update aktuelle Seite
      db.updateCurrentPage(sessionId, pngBase64, aiResponse.text);
      socket.emit('ai:response', {
        text: aiResponse.text,
        png: pngBase64,           // NEU: fertiges PNG
        interactionId: null       // wird durch page-System ersetzt
      });
    }

    // 5. Interaction speichern (mit SVG für History)
    db.addInteraction(sessionId, canvasPng, aiResponse.text, null, null, aiResponse.svg);

  } else {
    // === V1 PFAD (Fallback, unverändert) ===
    const interactionId = db.addInteraction(sessionId, canvasPng, aiResponse.text, aiResponse.drawing ? JSON.stringify(aiResponse.drawing) : null);

    socket.emit('ai:response', {
      text: aiResponse.text,
      drawing: aiResponse.drawing,
      interactionId
    });
  }
});
```

### 3.3 `server/db.js` — Pages-Tabelle + SVG-Feld

**Neue Tabelle `pages`** für das Paging-System:

```sql
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  png_snapshot TEXT NOT NULL,           -- Das gerenderte PNG der Seite
  ai_text TEXT,                         -- Letzter KI-Text auf dieser Seite
  story_narrative TEXT,                 -- KI-interner Gedankengang
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_session ON pages(session_id);
```

**Migration: `interactions` Tabelle erweitern:**

```sql
ALTER TABLE interactions ADD COLUMN ai_svg TEXT;  -- SVG-Output der KI
```

**Neue Funktionen:**

```javascript
function addPage(sessionId, pngSnapshot, aiText = null, storyNarrative = null) {
  // Nächste Seitennummer ermitteln
  const maxPage = db.prepare('SELECT MAX(page_number) as max FROM pages WHERE session_id = ?').get(sessionId);
  const nextPage = (maxPage?.max || 0) + 1;

  const stmt = db.prepare(`
    INSERT INTO pages (session_id, page_number, png_snapshot, ai_text, story_narrative)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sessionId, nextPage, pngSnapshot, aiText, storyNarrative);
  return result.lastInsertRowid;
}

function getPages(sessionId) {
  return db.prepare('SELECT * FROM pages WHERE session_id = ? ORDER BY page_number ASC').all(sessionId);
}

function getCurrentPage(sessionId) {
  return db.prepare('SELECT * FROM pages WHERE session_id = ? ORDER BY page_number DESC LIMIT 1').get(sessionId);
}

function updateCurrentPage(sessionId, pngSnapshot, aiText) {
  const page = getCurrentPage(sessionId);
  if (page) {
    db.prepare('UPDATE pages SET png_snapshot = ?, ai_text = ? WHERE id = ?').run(pngSnapshot, aiText, page.id);
  }
}
```

---

## 4. Frontend: Bestehende Dateien — Änderungen

### 4.1 `client/src/hooks/useSocket.ts` — PNG-Response + Paging-Events

**Was sich ändert:**

1. `onResponse` Callback: empfängt jetzt `png` (Base64) statt `drawing` (JSON)
2. Neues Event `page:new` für Szenenwechsel
3. `sendStrokeComplete()` sendet `v2Mode: true`

```typescript
// useSocket.ts — relevante Änderungen

interface UseSocketOptions {
  onThinking?: () => void;
  onResponse?: (data: {
    text: string;
    png?: string;              // NEU: V2 — fertiges PNG
    drawing?: any[] | null;    // V1 Fallback
    interactionId: number;
    isProaktiv?: boolean;
  }) => void;
  onPageNew?: (data: {        // NEU: Szenenwechsel
    pageId: number;
    png: string;
    text: string;
  }) => void;
  onError?: (data: { message: string }) => void;
  // ... rest wie bisher ...
}

// In useEffect:
socket.on('page:new', (data) => {
  optionsRef.current.onPageNew?.(data);
});

// sendStrokeComplete erweitern:
const sendStrokeComplete = useCallback((
  sessionId: string,
  canvasPng: string,
  canvasWidth: number,
  canvasHeight: number,
  contentInfo?: any,
  storyMode?: boolean,
  v2Mode?: boolean          // NEU
) => {
  socketRef.current?.emit('stroke:complete', {
    sessionId, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode, v2Mode
  });
}, []);
```

### 4.2 `client/src/hooks/useCanvas.ts` — PNG-Display statt Drawing-Commands

**Was sich ändert:**

1. `renderAIDrawing()` akzeptiert jetzt `png` (Base64-String) als Alternative zu `drawingCommands`
2. Wenn `png` vorhanden → als Bild auf den Background-Canvas zeichnen (kein JSON-Rendering mehr)
3. Grid-Overlay-Export bleibt für V1-Kompatibilität

```typescript
// useCanvas.ts — relevante Änderungen

// renderAIDrawing erweitern:
const renderAIDrawing = useCallback(async (data: { png?: string; drawing?: any[] }) => {
  const bgCtx = bgCtxRef.current;
  const bgCanvas = bgCanvasRef.current;
  if (!bgCtx || !bgCanvas) return;

  if (data.png) {
    // === V2 PFAD: Fertiges PNG vom Server ===
    const img = new Image();
    img.onload = () => {
      bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
      // Canvas-after-ai Snapshot senden
      const snapshot = bgCanvas.toDataURL('image/png');
      // Callback an App.tsx
    };
    img.src = `data:image/png;base64,${data.png}`;
  } else if (data.drawing) {
    // === V1 PFAD: Drawing-Commands rendern (Fallback) ===
    // ... bestehender Code mit renderDrawingCommandsAnimated ...
  }
}, []);
```

### 4.3 `client/src/App.tsx` — V2-Mode + Paging-UI

**Was sich ändert:**

1. Neuer State: `v2Mode` (Toggle), `pages` Array, `currentPageIndex`
2. `handleStrokeComplete()` sendet `v2Mode` mit
3. `onResponse` Handler: wenn `png` vorhanden → Canvas direkt aktualisieren
4. `onPageNew` Handler: neue Seite in `pages` Array pushen
5. Paging-Buttons: `< Zurück` / `Vor >` in der Toolbar

```typescript
// App.tsx — relevante Änderungen

const [v2Mode, setV2Mode] = useState(() => localStorage.getItem('candle_v2_mode') === 'true');
const [pages, setPages] = useState<Array<{ id: number; png: string; text: string }>>([]);
const [currentPageIndex, setCurrentPageIndex] = useState(0);

// handleResponse erweitern:
const handleResponse = useCallback((data: { text: string; png?: string; drawing?: any[] | null; interactionId: number }) => {
  setIsThinking(false);
  setAiText(data.text);

  if (data.png) {
    // V2: PNG direkt auf Canvas anzeigen
    // useCanvas.renderAIDrawing({ png: data.png })
    // Seite in pages-Array aktualisieren
    setPages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], png: data.png, text: data.text };
      }
      return updated;
    });
  } else if (data.drawing) {
    setDrawingCommands(data.drawing);
  }
}, []);

// Szenenwechsel:
const handlePageNew = useCallback((data: { pageId: number; png: string; text: string }) => {
  setPages(prev => [...prev, { id: data.pageId, png: data.png, text: data.text }]);
  setCurrentPageIndex(prev => prev + 1);
}, []);

// Paging:
const goToPage = useCallback((index: number) => {
  if (index >= 0 && index < pages.length) {
    setCurrentPageIndex(index);
    // Canvas mit dem PNG der Seite neu laden
  }
}, [pages.length]);

// handleStrokeComplete erweitern:
const handleStrokeComplete = useCallback((canvasPng: string, canvasWidth: number, canvasHeight: number) => {
  // ... bestehender Code ...
  sendStrokeComplete(session.id, canvasPng, canvasWidth, canvasHeight, contentInfo, storyMode, v2Mode);
}, [/* ... */ v2Mode, storyMode]);
```

### 4.4 `client/src/components/Canvas.tsx` — Vereinfachung

**Was sich ändert:**

1. Im V2-Modus: Canvas zeigt nur noch empfangene PNGs an (kein Drawing mehr)
2. Pen-Events bleiben (User zeichnet Skizzen → werden an Server gesendet)
3. `onAIDrawingComplete` Callback wird nach PNG-Display gefeuert

### 4.5 `client/src/components/Toolbar.tsx` — Paging-Buttons

**Neue UI-Elemente:**

```
[< Zurück]  [Seite 3/7]  [Vor >]
```

Nur sichtbar wenn `v2Mode === true` und `pages.length > 1`.

### 4.6 `client/src/utils/drawingRenderer.ts` — V1 Fallback

Bleibt größtenteils unverändert. Wird nur noch im V1-Modus oder als Fallback genutzt. Die `speechbubble` und `clear` Commands aus `story.md` werden hier implementiert (gilt für beide Modi).

---

## 5. Datenfluss: V2 Komplett

```
1. User zeichnet auf Kindle (Pen-Events → Canvas)
2. Pen-Up → debounce (500ms)
3. Canvas als PNG + contentInfo → Socket.io → Server
4. Server: Gemini analysiert PNG + History + 2-Bilder-Memory
5. Gemini antwortet: { action, text, svg, templates }
6. Server: validateSvg() → Sanitization
7. Server: composeSvgWithTemplates() → Templates einbetten
8. Server: renderToEInkPNG() → SVG → PNG (resvg-js) → Dithering (sharp)
9. Server: addPage() oder updateCurrentPage() in SQLite
10. Socket.io → Client: { text, png }
11. Client: PNG als Image auf Background-Canvas zeichnen
12. Canvas-after-ai Snapshot → Server (für Conversational Memory)
13. Fertig. User sieht gerendertes, E-Ink-optimiertes Bild.
```

---

## 6. Paging-System

### Datenstruktur

```
Session
  └── Pages[] (Array, chronologisch)
       └── Page { id, page_number, png_snapshot, ai_text, story_narrative }
  └── Interactions[] (für Conversational Memory, unverändert)
```

### Szenenwechsel

- Gemini setzt `action: "scene_change"` im Response
- Server: `addPage()` → neue Seite in DB
- Server: `page:new` Event an Client
- Client: neue Seite in `pages` Array, `currentPageIndex`++
- Canvas zeigt neue leere Seite (oder das neue PNG)

### Blättern

- Client-seitig: `pages` Array + `currentPageIndex`
- `< Zurück` → `currentPageIndex--`, Canvas zeigt `pages[currentPageIndex].png`
- `Vor >` → `currentPageIndex++`, Canvas zeigt `pages[currentPageIndex].png`
- Kein Server-Request nötig (PNGs sind im Client-State)

---

## 7. DB-Migration (automatisch)

```javascript
// server/db.js — Migration-Block (beim Server-Start)

// 1. SVG-Feld in interactions
try {
  db.prepare('SELECT ai_svg FROM interactions LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE interactions ADD COLUMN ai_svg TEXT');
  console.log('[DB] Migration: added ai_svg column');
}

// 2. Pages-Tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    png_snapshot TEXT NOT NULL,
    ai_text TEXT,
    story_narrative TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_pages_session ON pages(session_id);
`);
```

---

## 8. Dateien-Übersicht

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `server/renderer.js` | SVG → PNG Pipeline (resvg-js + sharp + E-Ink Dithering) |
| `server/svgValidator.js` | SVG-Sanitization (Script-Removal, viewBox-Check) |
| `server/templates.js` | Template-Bibliothek (Sprechblasen, Diagramme, Icons) |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `server/ai.js` | V2-Prompt (SVG-Output), `parseAIResponse()` liest svg/action/templates |
| `server/socket.js` | Rendering-Pipeline nach Gemini-Response, `page:new` Event |
| `server/db.js` | `pages`-Tabelle, `ai_svg` Feld, neue CRUD-Funktionen |
| `client/src/hooks/useSocket.ts` | `png` in Response-Type, `page:new` Event, `v2Mode` Parameter |
| `client/src/hooks/useCanvas.ts` | `renderAIDrawing()` akzeptiert `png` als Alternative |
| `client/src/App.tsx` | V2-Mode Toggle, Paging-State, `onPageNew` Handler |
| `client/src/components/Toolbar.tsx` | Paging-Buttons (Zurück/Vor) |
| `client/src/components/FloatingToolbox.tsx` | V2-Mode Toggle |
| `package.json` | `resvg-js`, `sharp` Dependencies |

### Unveränderte Dateien

| Datei | Grund |
|-------|-------|
| `server/index.js` | Keine Änderung nötig (Socket.io Setup bleibt gleich) |
| `server/routes.js` | REST-Endpoints bleiben gleich |
| `client/src/components/Canvas.tsx` | Pen-Events bleiben, nur AI-Display ändert sich |
| `client/src/utils/contentDetector.ts` | Wird weiterhin für contentInfo genutzt |
| `client/src/utils/drawingRenderer.ts` | V1 Fallback + speechbubble/clear Commands |

---

## 9. Implementierungs-Reihenfolge

### Phase 1: Backend-Rendering-Pipeline (~3h)
1. `npm install resvg-js sharp`
2. `server/renderer.js` erstellen (renderToEInkPNG + composeSvgWithTemplates)
3. `server/svgValidator.js` erstellen
4. Test: SVG-String → PNG-Output auf Console/Datei

### Phase 2: DB + Socket Integration (~2h)
1. `server/db.js`: Migration (pages-Tabelle + ai_svg Feld)
2. `server/socket.js`: V2-Pfad in stroke:complete Handler
3. `server/ai.js`: V2-Prompt + parseAIResponse-Erweiterung
4. Test: Socket-Event → Gemini → gerastertes PNG zurück

### Phase 3: Frontend V2-Display (~2h)
1. `useSocket.ts`: png in Response-Type, v2Mode Parameter
2. `useCanvas.ts`: renderAIDrawing mit png-Support
3. `App.tsx`: V2-Mode State + handleResponse-Anpassung
4. Test: Kompletter Flow auf Desktop-Browser

### Phase 4: Paging (~1.5h)
1. `App.tsx`: pages State, currentPageIndex, goToPage
2. `Toolbar.tsx`: Paging-Buttons
3. `socket.js`: page:new Event bei scene_change
4. Test: Szenenwechsel + Blättern

### Phase 5: Templates + E-Ink Testing (~2.5h)
1. `server/templates.js` erstellen
2. Template-Compositing in renderer.js
3. Prompt: Template-Referenzen dokumentieren
4. Test auf Kindle Scribe: Dithering, Kontrast, Lesbarkeit

---

## 10. Risiken & Fallbacks

| Risiko | Fallback |
|--------|----------|
| Gemini generiert kein valides SVG | `parseAIResponse()` Fallback → Text-only Antwort |
| SVG zu groß (>100KB) | `svgValidator.js` lehnt ab → Fallback |
| resvg-js rendert Fonts falsch | Font-Override in `injectFontOverride()` |
| Dithering sieht auf Kindle schlecht aus | `dither: false` Option, Graustufen-Modus |
| V2-Prompt produziert schlechte Ergebnisse | V1-Prompt + Drawing-Commands als Fallback |
| Performance: Rendering zu langsam | SVG-Caching, kleinere viewBox, Templates bevorzugen |

**Backwards-Compatibility:** Alte Sessions ohne `svg`-Feld → Client nutzt automatisch den V1-Pfad (`drawing`-Commands). V1 und V2 können koexistieren.

---

_Erstellt: 2026-08-27 23:10. Technische Umsetzung von candle-v2.md._
