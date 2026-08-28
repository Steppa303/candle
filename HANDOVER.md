# 🕯️ Candle — HANDOVER

**URL:** `https://candle.steppa.online`
**Port:** 3011
**PM2:** `candle`
**Status:** ✅ Live & Getestet auf Kindle Scribe

---

## Was ist das?

Eine für den Kindle Scribe optimierte Web-App mit einem Full-Screen Zeichen-Canvas. Der User malt mit dem Kindle-Stift, nach jedem Stift-Aufhebung wird ein Screenshot an eine Vision-KI (Google Gemini) geschickt, die das Gezeichnete analysiert und mit Text + eigenen Zeichnungen auf dem Canvas antwortet.

## Stack

- **Frontend:** React 18 + Vite + TailwindCSS + Canvas 2D API
- **Backend:** Express + Socket.io + better-sqlite3 (WAL)
- **KI:** Google Gemini 2.5 Flash (Vision API)
- **V2 Rendering:** `@resvg/resvg-js` (SVG→PNG) + `sharp` (Dithering, E-Ink-Optimierung)
- **Deploy:** PM2 + Caddy + Cloudflare (proxied=true)

## Architektur

```
Kindle Scribe (Browser)
  → Pen-Up Event → debounce (konfigurierbar)
  → Content-Detection (Bounding Box + Objekt-Größe + Dichte)
  → Grid-Overlay auf Canvas (temporär, nur für Export)
  → Canvas als PNG + Canvas-Dimensionen + Content-Info
  → WebSocket (Socket.io) → Backend (Port 3011)
  → Gemini Vision API (Canvas-PNG → Analyse, relative Positionierung)
  → Antwort: Text + Drawing-Commands (mit position/anchor)
  → WebSocket zurück → Position-Resolver → Canvas rendert Antwort
```

**KI kann deaktiviert werden:** AI-Toggle in der Floating Toolbox. Wenn AUS, wird der Strich gezeichnet aber nicht an den Server geschickt. Banner "KI AUS — Nur Zeichnen" wird angezeigt.

## Dateien

```
projects/candle/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx         # Haupt-Canvas (Pointer + Touch Events, V2 PNG-Support)
│   │   │   ├── TextOverlay.tsx    # KI-Text-Antworten
│   │   │   ├── Toolbar.tsx        # Untere Toolbar: Session, Löschen, Neu, Glatt-Toggle, V2-Paging
│   │   │   ├── SessionList.tsx    # Session-Auswahl
│   │   │   ├── DebounceSlider.tsx # Debounce-Konfiguration (200-3000ms)
│   │   │   ├── ErrorBoundary.tsx  # Fehleranzeige
│   │   │   ├── FloatingToolbox.tsx # Floating Toolbox Orchestrator (inkl. V2-Toggle)
│   │   │   ├── FAB.tsx            # Floating Action Button (draggable, schwarzer Kreis)
│   │   │   ├── VerticalToolbar.tsx # Vertikale Toolbar (neben FAB)
│   │   │   ├── SubMenu.tsx        # Horizontales Submenu
│   │   │   ├── BrushSizePicker.tsx # Stift-Dicke (5 Wellenlinien)
│   │   │   ├── SmoothingSlider.tsx # Glättung-Slider (0.0-1.0 Tension)
│   │   │   └── ColorPicker.tsx    # Farbwähler
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts       # Drawing-Logic, Pen-Events, PNG-Export, V2 PNG-Rendering
│   │   │   ├── useSocket.ts       # WebSocket-Client (V2: page:new Event, v2Mode Parameter)
│   │   │   ├── useSession.ts      # Session-Management
│   │   │   └── useDrag.ts         # Drag + Tap Detection (FAB)
│   │   ├── utils/
│   │   │   ├── drawingRenderer.ts # KI-Drawing-Commands Renderer (relativ + absolut)
│   │   │   └── contentDetector.ts # Canvas-Content-Detection (Bounding Box)
│   │   ├── App.tsx
│   │   ├── App.css                # E-ink optimiertes CSS
│   │   └── main.tsx               # Entry Point mit Error-Boundary
│   ├── vite.config.ts             # Build-Target: es2015
│   ├── tailwind.config.js
│   └── package.json
├── server/
│   ├── index.js                   # Express + Socket.io (Port 3011)
│   ├── db.js                      # SQLite (better-sqlite3, WAL, pages-Tabelle)
│   ├── ai.js                      # Gemini Vision API (V1 + V2 Prompts)
│   ├── socket.js                  # WebSocket Event-Handler (V1 + V2 Pfade)
│   ├── renderer.js                # **NEU** SVG → E-Ink PNG Pipeline (resvg-js + sharp)
│   ├── svgValidator.js            # **NEU** SVG-Sanitization
│   └── routes.js                  # REST Endpoints (Sessions CRUD)
├── deploy.sh                      # Build + Deploy Script
├── ecosystem.config.js            # PM2 Config
├── PLAN.md                        # Detaillierter Plan
├── toolbox.md                     # Floating Toolbox Plan
├── candle-v2.md                   # V2 Spezifikation
├── engine.md                      # V2 Rendering-Engine Spezifikation
└── HANDOVER.md                    # Diese Datei
```

## API

### WebSocket Events (Socket.io)

**Client → Server:**
- `stroke:complete` — `{ sessionId, canvasPng, canvasWidth, canvasHeight, contentInfo }` — Pen-Up nach debounce
- `canvas:after-ai` — `{ interactionId, canvasPng }` — Canvas-Snapshot nach KI-Rendering (Feature 1)
- `tap:response` — `{ sessionId, x, y, canvasPng }` — Tap auf Canvas im Tap-Mode (Feature 5)
- `ki:proaktiv` — `{ sessionId }` — KI initiiert proaktiv nach Inaktivität (Feature 3)
- `session:new` — `{ name? }` — Neue Session erstellen
- `session:switch` — `{ sessionId }` — Session wechseln
- `session:delete` — `{ sessionId }` — Session löschen

**Server → Client:**
- `ai:thinking` — KI analysiert gerade
- `ai:response` — `{ text, drawing, interactionId, isProaktiv? }` — KI-Antwort
- `ai:error` — `{ message }` — Fehler
- `session:created` — `{ session }` — Neue Session erstellt
- `session:history` — `{ interactions }` — Session-Verlauf

### REST Endpoints

- `GET /api/sessions` — Alle Sessions
- `GET /api/sessions/:id` — Session + Interactions
- `POST /api/sessions` — Neue Session
- `DELETE /api/sessions/:id` — Session löschen
- `PATCH /api/sessions/:id` — Session umbenennen

## Konfigurierbare Parameter (Client-Seite)

| Parameter | Default | Range | Beschreibung |
|-----------|---------|-------|--------------|
| Debounce | 500ms | 200-3000ms | Verzögerung nach Pen-Up (untere Toolbar) |
| Stift-Farbe | #000000 | Farbwähler | Farbe des User-Stifts (Floating Toolbox) |
| Stift-Dicke | 2px | 1-5px | Dicke des User-Stifts (Floating Toolbox) |
| Glättung (Strength) | 0.0 | 0.0-1.0 | Point-Reduction Epsilon + Catmull-Rom Spline (Floating Toolbox Slider) |
| Glättung AN/AUS | AN | Toggle | Smoothing ein/aus (untere Toolbar) |
| KI AN/AUS | AN | Toggle | KI-Verarbeitung ein/aus (Floating Toolbox) |
| Text-Overlay Dauer | 8s | 3-15s | Wie lange KI-Text angezeigt wird |
| KI Initiativ Delay | 60s | Aus/15s/30s/60s/120s | Inaktivitäts-Timer für proaktive KI |

Alle Werte werden im `localStorage` gespeichert.

## Floating Toolbox

**Status:** ✅ Deployed (27.08.2026)

Frei verschiebarer FAB (Floating Action Button) öffnet bei Tap eine vertikale Toolbar mit Werkzeugen.

**Toolbar-Elemente:**
1. **Stift-Dicke** → Submenu mit 5 Wellenlinien-Buttons (1-5px)
2. **Glättung** → Submenu mit Slider (0.0-1.0 Tension)
3. **Farbe** → Submenu mit 3 Farbkreisen (#000, #333, #666)
4. — Trennlinie —
5. **KI AN/AUS** → Toggle (kein Submenu, direkter Klick)

**FAB:** Schwarzer Kreis 48px, weißes Stift-Icon, draggable. Position in `localStorage`.

**Details:** `projects/candle/toolbox.md`

## KI-Integration

- **Modell:** Google Gemini 2.5 Flash
- **API Key:** `/root/.openclaw/workspace/.secrets/google-gemini.env`
- **Prompt:** Analysiert Canvas-Bild, antwortet mit JSON (Text + Drawing-Commands)
- **Drawing-Commands:** line, circle, path, text — relativ oder absolut positioniert
- **Relative Positionierung:** `position` (where) + `anchor` (reference point) + relative coords
- **Canvas-Dimensionen:** Werden im Prompt mitgegeben (CSS-Pixel)
- **KI-Deaktivierung:** Client-seitig — wenn AI AUS, wird `stroke:complete` nicht emittiert

### Relative Positionierung (27.08.2026)

**Branch:** `fix/versatz-koordinaten`
**Status:** ✅ Deployed

**Problem:** Gemini schätzt absolute Koordinaten aus dem PNG → Versatz.

**Lösung:** Gemini gibt relative Positionsbeschreibungen zurück. Client mappt auf echte Koordinaten.

**Neues Response-Format:**
```json
{
  "text": "Ich sehe einen Kopf. Ich zeichne den Körper!",
  "drawing": [
    { "type": "line", "x1": 0, "y1": 0, "x2": 0, "y2": 100, "position": "below", "anchor": "center" }
  ]
}
```

**Position-Werte:** `above`, `below`, `left_of`, `right_of`, `center`, `top_right`, `top_left`, `bottom_right`, `bottom_left`
**Anchor-Werte:** `center` (default), `top`, `bottom`, `left`, `right`
**Koordinaten:** Relativ zum Ankerpunkt (0,0 = Ankerpunkt)

**Content-Detection:**
- `contentDetector.ts` scannt Canvas-Pixel (jeder 4te für Performance)
- Findet Bounding Box des bestehenden Contents
- Gibt `{ x, y, width, height }` zurück
- Leerer Canvas → gesamter Canvas als Bounds

**Position-Resolver:**
- `drawingRenderer.ts` → `resolvePosition()` mappt Position + Anchor auf Offset
- 20px Gap zwischen bestehendem Content und neuer Zeichnung
- Backwards-kompatibel: Commands ohne `position` werden absolut gerendert

**Dateien:**
- `server/ai.js` — Prompt: relative Positionierung + Canvas-Dimensionen
- `client/src/utils/contentDetector.ts` — Content-Bounding-Box Detection
- `client/src/utils/drawingRenderer.ts` — `resolvePosition()`, `applyOffset()`
- `client/src/hooks/useCanvas.ts` — `renderAIDrawing` übergibt `bgCanvas`
- `client/src/hooks/useSocket.ts` — Sendet `canvasWidth`, `canvasHeight`

### Grid-Overlay + Scale-Reference + Proportions (27.08.2026)

**Status:** ✅ Deployed (27.08.2026)
**Plan:** `projects/candle/position.md`

Drei Maßnahmen um Präzision und Größenverhältnisse zu verbessern:

**1. Grid-Overlay (useCanvas.ts):**
- Vor PNG-Export: temporäres Gitter mit Koordinaten-Labels (alle 100px, #CCCCCC, 0.5px)
- Nur an den Rändern (kleine Kreuze + Labels), nicht als Vollgitter
- getImageData sichern → Grid zeichnen → toDataURL → putImageData wiederherstellen
- User sieht nichts, nur Gemini bekommt die Referenzpunkte

**2. Scale-Reference (contentDetector.ts):**
- `analyzeContent(canvas)` → `{ bounds, avgObjectSize, contentDensity }`
- `avgObjectSize`: Horizontale Scan-Linien, Kanten zählen, mittlerer Abstand
- `contentDensity`: Content-Pixel / Gesamt-Pixel (0-1 Ratio)
- Wird in `App.tsx` vor dem Senden berechnet und via Socket mitgegeben

**3. Proportional Prompt (ai.js):**
- Gemini bekommt: Bounding Box, avgObjectSize, contentDensity
- Proportions-Regeln: "Miss die Größe des bestehenden Content"
- Min/Max: 30%-200% der Content-Größe
- Backwards-kompatibel: alte Sessions ohne contentInfo funktionieren weiter

**Dateien:**
- `client/src/utils/contentDetector.ts` — `ContentInfo` Interface + `analyzeContent()`
- `client/src/hooks/useCanvas.ts` — `drawGridOverlay()` vor PNG-Export
- `client/src/hooks/useSocket.ts` — `sendStrokeComplete()` mit contentInfo
- `client/src/App.tsx` — Importiert `analyzeContent`, berechnet vor Senden
- `server/socket.js` — Extrahiert `contentInfo`, übergibt an `ai.analyzeCanvas()`
- `server/ai.js` — `contentContext` im Prompt (Bounds, Größe, Dichte, Proportions)

### Conversational Canvas Memory (27.08.2026)

**Status:** ✅ Deployed (27.08.2026)
**Feature:** 1 aus interactivity.md

**Problem:** KI sah nur den aktuellen Canvas + Text-History. Wusste nicht, was sie selbst gezeichnet hat.

**Lösung:**
- 2 Bilder an Gemini: aktueller Canvas + Canvas nach letzter KI-Antwort
- Strukturierte Conversation-History (letzte 5 Interaktionen)
- Neues DB-Feld `canvas_after_ai` speichert Canvas-Zustand nach KI-Rendering

**Architektur:**
1. KI antwortet → Client rendert Drawing-Commands auf Canvas
2. Nach Rendering: Canvas-PNG wird via `canvas:after-ai` Socket-Event an Server gesendet
3. Server speichert PNG in `interactions.canvas_after_ai`
4. Bei nächster Anfrage: Server schickt 2 Bilder an Gemini (aktuell + vorherige KI-Antwort)

**DB Migration:** `ALTER TABLE interactions ADD COLUMN canvas_after_ai TEXT`

**Dateien:**
- `server/db.js` — `canvas_after_ai` Feld + `updateInteractionCanvasAfterAi()`
- `server/ai.js` — 2-Bilder-Prompt mit strukturierter History
- `server/socket.js` — `canvas:after-ai` Event-Handler
- `client/src/hooks/useSocket.ts` — `sendCanvasAfterAi()`
- `client/src/components/Canvas.tsx` — `onAIDrawingComplete` Callback
- `client/src/App.tsx` — `handleAIDrawingRendered` + `lastInteractionIdRef`

### Tap-Annotation (27.08.2026)

**Status:** ✅ Deployed (27.08.2026)
**Feature:** 5 aus interactivity.md

**Problem:** User kann nicht direkt auf KI-Antworten reagieren.

**Lösung:**
- Nach KI-Antwort: 10s Tap-Mode aktiviert
- User tippt auf Canvas → Koordinaten + PNG an KI
- Visueller Indicator: „👆 Tippe auf die Zeichnung"
- Cursor wird zu Crosshair im Tap-Mode

**Architektur:**
1. KI antwortet → `isTapMode = true` (10s Timer)
2. User tippt → `handleTap` ermittelt Koordinaten + Canvas-PNG
3. `tap:response` Socket-Event an Server
4. Server baut Tap-spezifischen Prompt + sendet an Gemini
5. KI antwortet bezogen auf die getippte Position

**Tap-Prompt:**
- Koordinaten des Taps
- Letzte KI-Antwort als Kontext
- Reaktionsmöglichkeiten: Objekt erkannt, leere Stelle, Text

**Dateien:**
- `server/ai.js` — `analyzeCanvasWithTap()`, `buildTapPrompt()`
- `server/socket.js` — `tap:response` Event-Handler
- `client/src/hooks/useSocket.ts` — `sendTapResponse()`
- `client/src/components/Canvas.tsx` — Tap-Handler, Tap-Mode Indicator
- `client/src/App.tsx` — `isTapMode` State, `handleTapResponse`, 10s Timer

### Animierte KI-Antworten (27.08.2026)

**Status:** ✅ Deployed (27.08.2026)
**Feature:** 2 aus interactivity.md

**Problem:** KI-Zeichnungen poppen instant auf. Kein Gefühl von "die KI malt gerade."

**Lösung:** Drawing-Commands werden sequentiell mit Delay abgespielt. Die KI "malt" live.

**Architektur:**
1. `renderDrawingCommandsAnimated()` in `drawingRenderer.ts` — async, mit AbortSignal
2. `renderAIDrawing` in `useCanvas.ts` — async mit AbortController, E-Ink-Delay (150ms vs 80ms Desktop)
3. `Canvas.tsx` — useEffect wartet auf Animation-Completion bevor `onAIDrawingComplete`
4. Vorherige Animation wird automatisch abgebrochen wenn neue Commands kommen

**E-Ink Spezialbehandlung:**
- Desktop: 80ms pro Command
- Kindle Scribe (E-Ink): 150ms pro Command (langsamer Refresh)
- Detection via User-Agent (Kindle/Silk/KFOT/etc.)

**Dateien:**
- `client/src/utils/drawingRenderer.ts` — `renderDrawingCommandsAnimated()` mit AbortSignal + Progress-Callback
- `client/src/hooks/useCanvas.ts` — async `renderAIDrawing`, `animationAbortRef`, `isAnimating` State
- `client/src/components/Canvas.tsx` — async useEffect, cancelled-flag für Cleanup

### KI initiiert manchmal (27.08.2026)

**Status:** ✅ Deployed (27.08.2026)
**Feature:** 3 aus interactivity.md

**Problem:** Die KI ist passiv. Immer nur Reaktion auf User-Input.

**Lösung:** Nach X Sekunden Inaktivität startet die KI selbst eine Aktion.

**Architektur:**
1. Inaktivitäts-Timer in `App.tsx` (Default 60s, konfigurierbar)
2. Timer reset bei jeder User-Interaktion (drawingCommands, aiText)
3. Bei Timeout: `ki:proaktiv` Socket-Event an Server
4. Backend: proaktiver Prompt (KI zeichnet etwas Interessantes)
5. Response mit `isProaktiv: true` Flag

**Konfiguration:**
- Floating Toolbox → ⚡ KI Initiativ Submenu
- Optionen: Aus / 15s / 30s / 1 Min / 2 Min
- Gespeichert in `localStorage` (`candle_proaktiv_delay`)

**Proaktiv-Prompt:**
- KI macht etwas Interessantes (Doodle, Frage, Mini-Spiel)
- Nutzt Canvas-Referenz wenn vorhanden
- Temperatur 0.9 (kreativer als normal)

**Dateien:**
- `server/ai.js` — `analyzeProaktiv()` mit proaktivem Prompt
- `server/socket.js` — `ki:proaktiv` Event-Handler
- `client/src/hooks/useSocket.ts` — `sendProaktiv()`, `isProaktiv` in Response-Type
- `client/src/App.tsx` — `proaktivDelay` State, `inactivityTimerRef`, `resetInactivityTimer()`, localStorage-Persistenz
- `client/src/components/FloatingToolbox.tsx` — Proaktiv-Config Submenu
- `client/src/components/ProaktivPicker.tsx` — Neuer Component (Aus/15s/30s/1min/2min)

## Deploy

```bash
# Frontend neu bauen & deployen
./deploy.sh

# Server neu starten
pm2 restart candle

# Logs
pm2 logs candle
```

## E-ink Optimierungen

- Keine Animationen/Transitions (CSS `!important`)
- Hoher Kontrast (Schwarz/Weiß/Grau)
- Große Touch-Targets (48px+)
- `touchAction: 'none'` für Pen-Input
- Pointer Events + Touch Events Fallback
- Build-Target: `es2015` (älterer Chromium)
- Loading-Indicator vor React-Init
- Error-Boundary für Fehleranzeige

### Drawing-Performance (27.08.2026)

Optimierungen für minimalen Lag auf dem Kindle Scribe:

1. **rAF-Batching** — `pointermove`-Events sammeln Punkte nur in einem Array. `requestAnimationFrame` zeichnet einmal pro Frame alle gesammelten Punkte.
2. **Single-Path-Drawing** — Pro Frame: 1x `beginPath()`, alle `lineTo()` in einer Schleife, 1x `stroke()`.
3. **Fixed lineWidth** — wird nur bei `pointerdown` gesetzt, nicht bei jedem Punkt.
4. **1:1 Pixel-Mapping auf Kindle** — Erkennt Kindle-User-Agent, setzt DPR auf 1.

### Zwei-Canvas-System mit Post-Processing Smoothing (27.08.2026, gefixt 27.08.2026)

**Architektur:**
- **Background-Canvas** — alle abgeschlossenen Striche (geglättet oder raw)
- **Foreground-Canvas** — aktiver Strich (raw, in Echtzeit, kein Smoothing)

**Workflow:**
1. User zeichnet → raw auf Foreground (kein Lag, lineTo, sofort sichtbar)
2. Pen-Up → Smoothing-Pipeline → auf Background gerendert
3. Foreground wird geleert (kein Ghosting)
4. Toggle-Button `◉ Glatt` / `○ Raw` in der unteren Toolbar

**Smoothing-Pipeline (2-Stufen):**
1. **Point-Reduction** (Ramer-Douglas-Peucker) — reduziert Punkteanzahl
2. **Catmull-Rom Spline** (Hermite-Basis + Tangent-Clamping) — interpoliert glatte Kurve

**Slider steuert `epsilon` (Toleranz):**
- `0.00` → keine Reduktion, Rohpunkte (kein Smoothing)
- `0.50` → moderate Reduktion (~7.5px Toleranz)
- `1.00` → aggressive Reduktion (~15px Toleranz) → deutlich glattere Kurven

**Warum zwei Stufen?** Catmull-Rom allein bringt nix bei dichten Input-Points (Finger/Stylus ~60Hz, alle 2-5px). Die Kurve geht durch JEDE Punkt → glattet nicht. Erst Punkte reduzieren, dann splinen.

**Catmull-Rom Parameter:**
- `TENSION = 0.5` (standard Catmull-Rom)
- `CLAMP_FACTOR = 4.0` (max Tangent-Länge = 4× Segmentlänge)
- `STEPS = 8` (Zwischenpunkte pro Segment)

**Dateien:**
- `client/src/hooks/useCanvas.ts` — Zwei-Canvas-Logik, RDP + Catmull-Rom Smoothing
- `client/src/components/Canvas.tsx` — Rendert zwei übereinanderliegende Canvas-Elemente
- `client/src/components/Toolbar.tsx` — Smoothing Toggle Button (unten)
- `client/src/App.tsx` — `smoothingEnabled` + `smoothingValue` State

## V2 — Server-Side Rendering & Paging (28.08.2026)

**Status:** ✅ Implementiert & Deployed
**Spezifikation:** `candle-v2.md`, `engine.md`
**Session:** `candle-v2-worker-retry` (MiMo V2.5 Pro, 14 Min, $1.24)

### Was V2 ändert

V1: Client rendert KI-Antworten als Canvas-Drawing-Commands (JSON). Limitiert durch Kindle-Browser-Performance.
V2: Server rendert SVG → PNG (E-Ink-optimiert). Client zeigt fertiges PNG an. Kein Rendering-Lag auf dem Kindle.

### V2-Architektur

```
User zeichnet → Pen-Up → PNG an Server
  → Gemini analysiert (V2-Prompt: SVG-Output + action + story_narrative)
  → SVG-Validation (svgValidator.js: Script-Removal, viewBox-Check, Size-Limit)
  → SVG + Templates compositing (renderer.js)
  → SVG → PNG Rasterisierung (resvg-js)
  → E-Ink Dithering (sharp: Floyd-Steinberg, 1-Bit/Graustufen)
  → PNG zurück an Client
  → Client zeigt PNG direkt auf Canvas (kein JSON-Rendering)
```

### V2-Features

**Server-Rendering-Pipeline:**
- `server/renderer.js` — SVG → E-Ink PNG (resvg-js + sharp + Floyd-Steinberg Dithering)
- `server/svgValidator.js` — SVG-Sanitization (Script-Removal, viewBox-Check, 50KB-Limit)
- `composeSvgWithTemplates()` — Templates in SVG einbetten

**DB-Erweiterungen:**
- `ai_svg` Spalte in `interactions` (roher SVG-Output der KI)
- Neue `pages` Tabelle (id, session_id, page_number, png_snapshot, ai_text, story_narrative)
- Funktionen: `addPage()`, `getPages()`, `getCurrentPage()`, `updateCurrentPage()`

**AI-Prompt (V2):**
- `V2_SYSTEM_PROMPT` in `server/ai.js`
- Output-Format: `{ action, svg, templates, story_narrative }`
- `action: "update"` → bestehende Seite aktualisieren
- `action: "scene_change"` → neue Seite anlegen

**Socket-Integration:**
- `stroke:complete` → extrahiert `v2Mode` aus Daten
- V2-Pfad: validateSvg → composeSvgWithTemplates → renderToEInkPNG → Response mit `png` Feld
- V1-Pfad bleibt als Fallback unverändert
- Neues Event: `page:new` bei Szenenwechsel

**Frontend:**
- `v2Mode` State (localStorage: `candle_v2_mode`)
- V2-Toggle in Floating Toolbox (⚡ V2 AN/AUS)
- `renderAIDrawing()` akzeptiert `{ png?, drawing? }` — V2 zeigt PNG, V1 rendert Commands
- Paging: `← Zurück` / `Seite X/Y` / `Vor →` in Toolbar (nur sichtbar bei V2 + mehreren Seiten)
- `pages` Array State, `currentPageIndex`, `goToPage()`
- V2-Modus Indicator Banner: "⚡ V2-Modus (Server-Rendering)"

### V1 ↔ V2 Koexistenz

- V1 und V2 teilen sich den gleichen `stroke:complete` Flow
- `v2Mode` Flag entscheidet welcher Pfad genommen wird
- V1: JSON Drawing-Commands → Client rendert (animiert)
- V2: SVG → Server rendert → PNG → Client zeigt an
- Beide Modi können pro Session umgeschaltet werden
- Story-Modus funktioniert in beiden Pfaden

### Geänderte/Neue Dateien (V2)

| Datei | Status |
|--------|--------|
| `server/renderer.js` | **NEU** — SVG→PNG Pipeline |
| `server/svgValidator.js` | **NEU** — SVG-Sanitization |
| `server/db.js` | Modified — pages-Tabelle, ai_svg |
| `server/ai.js` | Modified — V2_SYSTEM_PROMPT, parseAIResponse (svg/templates/action) |
| `server/socket.js` | Modified — V2-Pfad in stroke:complete |
| `client/src/hooks/useSocket.ts` | Modified — page:new Event, v2Mode Parameter |
| `client/src/hooks/useCanvas.ts` | Modified — PNG-Rendering |
| `client/src/App.tsx` | Modified — v2Mode, pages, Paging |
| `client/src/components/Toolbar.tsx` | Modified — Paging-Buttons |
| `client/src/components/FloatingToolbox.tsx` | Modified — V2-Toggle |
| `client/src/components/Canvas.tsx` | Modified — V2 PNG-Marker |
| `package.json` | Modified — resvg-js, sharp deps |

---

## Bekannte Probleme / TODO

**Siehe `PLAN.md` für aktuelle Prioritäten.**

- [ ] Story-Modus (P1) — Collaborative Storytelling (story.md)
- [x] V2 Server-Side Rendering & Paging → deployed 28.08.2026
- [x] Grid-Overlay + Scale-Reference + Proportions implementieren (position.md) → deployed 27.08.2026
- [x] Conversational Canvas Memory (Feature 1) → deployed 27.08.2026
- [x] Tap-Annotation (Feature 5) → deployed 27.08.2026
- [x] JSON-Fallback Fix (27.08.2026) — Rohe KI-Antworten nicht mehr im Overlay
- [x] Animierte KI-Antworten (Feature 2) → deployed 27.08.2026
- [x] KI initiiert manchmal (Feature 3) → deployed 27.08.2026
- [x] Branch `feature/floating-toolbox` auf `main` mergen ✅ (27.08.2026)
- [x] Branch `fix/versatz-koordinaten` mergen ✅ (27.08.2026)
- [x] Canvas-Größe an Scribe angepasst (dynamisch, DPR 1) ✅
- [x] Smoothing funktioniert, Regler in Toolbox ✅

### JSON-Fallback Fix (27.08.2026)

**Problem:** Gemini antwortet manchmal mit normalem Text statt JSON (z.B. "I see a Tic-Tac-Toe field..."). Der `parseAIResponse`-Fallback in `ai.js` hat den Rohtext direkt als `text` zurückgegeben → hässliche JSON-Roh-Meldungen im TextOverlay.

**Lösung:** `parseAIResponse()` in `server/ai.js` — neuer Fallback-Handler:
1. Versucht `"text"`-Feld aus partiellem JSON zu extrahieren (Regex)
2. Entfernt Markdown-Code-Blöcke und Thinking-Tags
3. Wenn kein JSON erkannt wird (kein `{` am Anfang), wird der saubere Text direkt genommen
4. Letzter Fallback: generische Nachricht "Ich habe das Bild analysiert, aber keine strukturierte Antwort erstellt."

**Dateien:** `server/ai.js` — `parseAIResponse()`

---

_Stand: 2026-08-28 06:40. V2 Server-Side Rendering implementiert & deployed. Story-Modus als nächstes._
