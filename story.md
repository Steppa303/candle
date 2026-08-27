# 🕯️ Candle — Story-Modus (Collaborative Storytelling)

**Datum:** 2026-08-27
**Status:** Planung

---

## Konzept

Ein einzelner Toggle in der Floating Toolbox: **Story AN/AUS**.

Wenn AN: Die KI wird vom passiven Analytiker zum aktiven Storytelling-Partner. User und KI bauen gemeinsam eine visuelle Geschichte auf dem Canvas auf — Zug um Zug, jeder interpretiert und ergänzt was der andere malt.

**Beispiel-Flow:**
1. KI malt ein Strichmännchen (lächelnd, winkend)
2. User malt einen Tisch mit einem Bier darauf
3. KI: "Ah, ein Bier! Moment..." → malt das Männchen NEU am Tisch sitzend, Bier in der Hand. Das alte Männchen wird dabei übermalt.
4. User malt ein zweites Männchen mit Sprechblase "Hey!"
5. KI malt an der ersten Figur eine Sprechblase: "Prost! 🍺" — passend, lustig, kontextuell.

---

## Was sich ändert

### System-Prompt (Kernstück)

Der aktuelle SYSTEM_PROMPT in `server/ai.js` wird durch einen Story-Prompt ersetzt wenn der Modus aktiv ist.

**Aktuell (Freestyle):**
```
Du siehst ein Bild, das ein User auf einem digitalen Canvas gezeichnet hat.
Deine Aufgabe:
1. Analysiere was der User gemalt hat
2. Antworte mit einem kurzen Text (max 2 Sätzen) was du siehst
3. Wenn der User eine Anweisung geschrieben hat, führe sie aus
4. Zeichne deine Antwort direkt auf das Canvas
```

**Story-Modus:**
```
Du bist ein kreativer Storytelling-Partner auf einem digitalen Canvas.
Der User und du bauen gemeinsam eine visuelle Geschichte auf — Zug um Zug.

DEINE ROLLE:
- Du bist Co-Erzähler, nicht Analytiker
- Du interpretierst was der User malt und baust darauf auf
- Du darfst deine eigenen vorherigen Zeichnungen überschreiben/verschieben
- Dialoge kommen in Sprechblasen (speechbubble)
- Humor, Wortwitz und Cleverness sind erwünscht
- Antworte auf Deutsch

WIE DU ZEICHNEST:
- Figuren: Strichmännchen, einfach aber ausdrucksvoll (Gesichter, Posen)
- Dialoge: Sprechblasen mit Text, Pfeil zur Figur
- Szenerie: Requisiten, Hintergrund-Elemente wenn passend
- Stil: Konsistent mit dem was der User zeichnet

STORY-REGELN:
- Basiere IMMER auf dem was auf dem Canvas ist
- Wenn du eine Figur "verschieben" willst: male sie an der neuen Position neu
  und nutze den "clear"-Command um den alten Bereich zu übermalen
- Jede Antwort sollte die Geschichte voranbringen
- Übertreibe nicht — lass dem User Raum für seinen Beitrag
- Wenn der User etwas Unerwartetes malt: überrasche mit einer kreativen Reaktion
- Halte Zeichnungen proportional zum bestehenden Content

SPEECHBUBBLE-FORMAT:
- { "type": "speechbubble", "x": 100, "y": 200, "text": "Hallo!", "tailX": 80, "tailY": 250 }
- tailX/tailY = Punkt auf den die Sprechblase zeigt (die Figur)
- Text kurz halten (max ~20 Wörter pro Blase)

CLEAR-FORMAT (eigene alte Zeichnungen überschreiben):
- { "type": "clear", "x": 100, "y": 200, "width": 150, "height": 200 }
- Löscht einen rechteckigen Bereich (malt ihn weiß)
- NUR für deine eigenen vorherigen Zeichnungen verwenden!
```

### Neuer Drawing-Command: `speechbubble`

```json
{
  "type": "speechbubble",
  "x": 300,
  "y": 200,
  "text": "Prost! 🍺",
  "tailX": 280,
  "tailY": 280,
  "color": "#333333",
  "width": 2,
  "fontSize": 16
}
```

**Rendering in `drawingRenderer.ts`:**
1. Abgerundetes Rechteck zeichnen (weißer Hintergrund, schwarzer Rand)
2. Text darin rendern (Word-Wrap bei Bedarf)
3. Dreieck/Sechwanz von der Blase zum tailX/tailY Punkt
4. E-ink optimiert: hoher Kontrast, klare Schrift

### Neuer Drawing-Command: `clear`

```json
{
  "type": "clear",
  "x": 100,
  "y": 200,
  "width": 150,
  "height": 200
}
```

**Rendering in `drawingRenderer.ts`:**
1. `ctx.fillStyle = '#FFFFFF'`
2. `ctx.fillRect(x, y, width, height)`
3. Bereich wird weiß übermalt

**WICHTIG:** `clear` wirkt auf den Background-Canvas. Der KI wird im Prompt gesagt, sie soll NUR eigene vorherige Zeichnungen clearen, nicht User-Content. Technisch kann sie aber alles clearen — Vertrauenssache.

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `server/ai.js` | `STORY_PROMPT` Konstante + Prompt-Selection in `analyzeCanvas()` |
| `server/socket.js` | `storyMode` aus Event-Daten extrahieren, an `analyzeCanvas()` übergeben |
| `client/src/utils/drawingRenderer.ts` | `speechbubble` + `clear` Commands implementieren |
| `client/src/components/FloatingToolbox.tsx` | Story-Toggle (neues Toolbar-Element) |
| `client/src/components/StoryToggle.tsx` | **NEU** — Toggle-Button (AN/AUS) |
| `client/src/App.tsx` | `storyMode` State + localStorage + Props |
| `client/src/hooks/useSocket.ts` | `storyMode` in `sendStrokeComplete()` |

---

## Implementierungs-Reihenfolge

### Schritt 1: Backend — Story-Prompt
- `server/ai.js`: `STORY_PROMPT` Konstante definieren
- `analyzeCanvas()` bekommt `storyMode` Parameter
- Wenn `storyMode === true` → STORY_PROMPT statt SYSTEM_PROMPT

### Schritt 2: Backend — Socket
- `server/socket.js`: `storyMode` aus `stroke:complete` Daten extrahieren
- An `ai.analyzeCanvas()` durchreichen

### Schritt 3: Frontend — Drawing Commands
- `client/src/utils/drawingRenderer.ts`:
  - `renderSpeechbubble(ctx, cmd)` — Rechteck + Text + Tail
  - `renderClear(ctx, cmd)` — weißes Rechteck
  - In `renderSingleCommand()` die neuen Typen einbinden
  - Auch in `renderDrawingCommandsAnimated()` berücksichtigen

### Schritt 4: Frontend — UI
- `client/src/components/StoryToggle.tsx` — Toggle-Button
- `client/src/components/FloatingToolbox.tsx` — neues Element (zwischen Farbwähler und Trennlinie)
- `client/src/App.tsx` — `storyMode` State, localStorage, Props an FloatingToolbox + useSocket

### Schritt 5: Frontend — Socket
- `client/src/hooks/useSocket.ts` — `storyMode` in `sendStrokeComplete()` mitschicken

### Schritt 6: Build + Deploy + Test

---

## Technische Details

### Speechbubble-Rendering (Pseudo-Code)

```typescript
function renderSpeechbubble(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, text, tailX, tailY, color = '#333', fontSize = 16 } = cmd;

  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Text messen
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const padding = 12;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = fontSize + padding * 2;

  // Abgerundetes Rechteck
  const bx = x - bubbleWidth / 2;
  const by = y - bubbleHeight / 2;
  roundRect(ctx, bx, by, bubbleWidth, bubbleHeight, 8);
  ctx.fill();
  ctx.stroke();

  // Tail (Dreieck zur Figur)
  ctx.beginPath();
  ctx.moveTo(x - 6, by + bubbleHeight);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(x + 6, by + bubbleHeight);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);

  ctx.restore();
}
```

### Clear-Rendering

```typescript
function renderClear(ctx: CanvasRenderingContext2D, cmd: any) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
  ctx.restore();
}
```

### Prompt-Selection in `analyzeCanvas()`

```javascript
async function analyzeCanvas(canvasPng, previousInteractions = [], canvasDimensions = null, contentInfo = null, storyMode = false) {
  const systemPrompt = storyMode ? STORY_PROMPT : SYSTEM_PROMPT;
  // ... rest wie bisher
}
```

---

## Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|----------------|------------|
| KI überschreibt User-Content mit clear | Mittel | Prompt: "NUR eigene Zeichnungen clearen" |
| Sprechblasen-Text zu lang | Hoch | Prompt: "max 20 Wörter", Rendering: Word-Wrap |
| KI versteht clear-Command nicht | Niedrig | Fallback: KI zeichnet einfach dazu (wie bisher) |
| Story wird inkohärent | Mittel | Conversational Memory (2 Bilder + History) hilft |
| E-ink: Sprechblasen zu klein | Niedrig | fontSize 16px minimum, hoher Kontrast |

---

## Offene Fragen

1. **Soll der Story-Toggle den KI-Toggle ersetzen oder ergänzen?** → Ergänzen (beide können unabhängig AN/AUS sein)
2. **Soll `clear` auch auf dem Foreground-Canvas wirken?** → Nur Background (abgeschlossene Striche)
3. **Max. Anzahl Sprechblasen pro Antwort?** → Empfehlung: max 2-3

---

_Plan erstellt: 2026-08-27 21:46._
