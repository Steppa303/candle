# 🕯️ Candle — Position & Proportion Plan

**Branch:** `fix/versatz-koordinaten` (oder neuer Branch)
**Ziel:** Präzision und Größenverhältnisse der KI-Zeichnungen verbessern

---

## Status Quo

- ✅ Relative Positionierung (`position: "below"`, `anchor: "center"`) funktioniert
- ✅ Content-Detection (Bounding Box) funktioniert
- ⚠️ Größenverhältnisse sind noch nicht proportional
- ⚠️ Absolute Präzision könnte besser sein (Gemini schätzt noch)

---

## Drei Maßnahmen (1 + 2 + 4)

### 1. Grid-Overlay (Visuelle Referenzpunkte)

**Was:** Vor dem Senden an Gemini ein subtilen Gitternetz auf das Canvas legen.

**Wie:**
- Vor dem PNG-Export: Referenzpunkte auf das Canvas zeichnen
- Alle 100px ein kleines Kreuz (+) in hellem Grau (#CCCCCC, 1px)
- Optional: Koordinaten-Labels an den Rändern (z.B. "100", "200", "300")
- Nach dem Export: Canvas wiederherstellen (Grid wieder entfernen)

**Vorteil:** Gemini sieht echte Pixel-Referenzpunkte im Bild. Kein Raten mehr.

**Implementation:**
```typescript
// In useCanvas.ts — vor toDataURL()
function drawGridOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 0.5;
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#CCCCCC';
  
  // Vertikale Linien alle 100px
  for (let x = 100; x < width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 10);  // nur kleiner Strich oben
    ctx.stroke();
    ctx.fillText(String(x), x + 2, 8);
  }
  
  // Horizontale Linien alle 100px
  for (let y = 100; y < height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(10, y);  // nur kleiner Strich links
    ctx.stroke();
    ctx.fillText(String(y), 2, y - 2);
  }
  
  ctx.restore();
}
```

**Ablauf:**
1. Canvas-Image sichern (getImageData)
2. Grid zeichnen
3. PNG exportieren (toDataURL)
4. Canvas wiederherstellen (putImageData)
5. PNG an Server senden

---

### 2. Scale-Reference im Prompt (Content-Größen messen)

**Was:** Content-Detection erweitern um Objekt-Größen zu messen und als Referenz an Gemini zu übergeben.

**Wie:**
- Content-Detection misst: Bounding Box, durchschnittliche Objekt-Größe
- Diese Info wird im Prompt angegeben: "Der bestehende Content ist ca. 200×150px groß, durchschnittliche Elemente sind ~50px"

**Implementation:**
```typescript
// contentDetector.ts — erweitert
interface ContentInfo {
  bounds: { x: number, y: number, width: number, height: number };
  avgObjectSize: number;  // durchschnittliche "Dicke" von Objekten
  contentDensity: number; // % des Canvas der Content bedeckt
}

export function analyzeContent(canvas: HTMLCanvasElement): ContentInfo {
  // ... pixel scan ...
  // Berechne durchschnittliche Objekt-Größe:
  // - Horizontale Scan-Linien zählen wo Content wechselt (Kanten)
  // - Abstand zwischen Kanten = Objekt-Größe
}
```

**Prompt-Ergänzung:**
```
Canvas-Größe: 1400 × 1860 Pixel
Bestehender Content: ~200×150px (Bounding Box), Position: Mitte-Links
Durchschnittliche Element-Größe: ~50px
```

---

### 4. Proportionale Anweisungen im Prompt

**Was:** Gemini anweisen, Größenverhältnisse basierend auf bestehendem Content zu wahren.

**Wie:**
- Prompt erweitern mit expliziten Proportions-Regeln
- Gemini soll Größe relativ zu bestehenden Elementen angeben

**Neuer Prompt-Abschnitt:**
```
GRÖSSENVERHÄLTNISSE:
- Miss die Größe des bestehenden Content und orientiere dich daran
- Wenn der User einen Kopf mit ~80px Durchmesser gezeichnet hat, 
  sollte der Körper ~120-150px lang sein (1.5-2× Kopfdurchmesser)
- Arme: ~100px (1.25× Kopfdurchmesser)
- Halte dich an natürliche Proportionen (Kopf:Körper:Beine = 1:2:2)
- Wenn du etwas neben bestehenden Content zeichnest, 
  halte die ähnliche Größe

WICHTIG für Größenverhältnisse:
- Die Canvas-Größe ist {width} × {height} Pixel
- Der bestehende Content ist ca. {contentWidth} × {contentHeight} Pixel groß
- Orientiere deine Zeichnung an dieser Größe
- Zeichne NICHT zu klein (mindestens 30% der Content-Größe) 
  und NICHT zu groß (maximal 200% der Content-Größe)
```

---

## Technischer Ablauf (Gesamt)

```
User zeichnet → Pen-Up → debounce
  ↓
1. Canvas-Image sichern (putImageData)
2. Grid-Overlay zeichnen (Referenzpunkte)
3. PNG exportieren (toDataURL)
4. Canvas wiederherstellen
5. Content analysieren (Bounds + Größe)
  ↓
6. An Server senden: { sessionId, canvasPng, canvasWidth, canvasHeight, contentInfo }
  ↓
7. Server baut Prompt:
   - System-Prompt (relative Positionierung + Proportions-Regeln)
   - Canvas-Größe
   - Content-Info (Bounds, Größe, Dichte)
   - Grid-Referenzpunkte sind im PNG sichtbar
  ↓
8. Gemini antwortet mit: { text, drawing: [{ position, anchor, ... }] }
  ↓
9. Client rendert relativ (Content-Bounds + Position-Resolver)
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `client/src/hooks/useCanvas.ts` | Grid-Overlay vor Export, Content-Info berechnen |
| `client/src/utils/contentDetector.ts` | Erweitert: Objekt-Größen messen |
| `client/src/hooks/useSocket.ts` | Content-Info mitsenden |
| `client/src/App.tsx` | Content-Info durchreichen |
| `server/socket.js` | Content-Info aus Daten extrahieren |
| `server/ai.js` | Prompt erweitern (Proportions-Regeln + Content-Info) |

---

## Offene Fragen

1. **Grid-Sichtbarkeit:** Soll das Grid im finalen Rendering sichtbar sein (als Hilfslinien) oder nur temporär für den Export?
   - ✅ Nur temporär für Export (implemented)

2. **Content-Info Granularität:** Reicht Bounding Box + Größe, oder brauchen wir mehr (z.B. einzelne Objekte)?
   - ✅ Bounding Box + Größe + Dichte (implemented)

3. **Proportions-Prompt:** Soll der Prompt fest Proportionen vorgeben (1:2:2) oder flexibel bleiben?
   - ✅ Flexibel mit Richtlinien (implemented)

---

_Stand: 2026-08-27 18:55. ✅ Alle drei Maßnahmen implementiert & deployed._
