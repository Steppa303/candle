# 🕯️ Candle — Interaktivitäts-Features

**Datum:** 2026-08-27
**Status:** Phase 1+2 implementiert (27.08.2026), Feature 4 (Modi-System) offen
**Features:** 5 (Export ausgeschlossen)

---

## Übersicht

| # | Feature | Aufwand | Abhängigkeiten |
|---|---------|---------|----------------|
| 1 | Conversational Canvas Memory | Gering | — |
| 2 | Animierte KI-Antworten | Mittel | — |
| 3 | KI initiiert manchmal | Mittel | Feature 1 |
| 4 | Modi-System | Mittel-Hoch | — |
| 5 | Tap-Annotation | Gering | — |

---

## Feature 1: Conversational Canvas Memory

### Problem
Die KI kriegt aktuell nur den aktuellen Canvas-PNG + die letzten 3 Interaktionen als *Text* (nur AI-Response-Text). Sie sieht nicht, was sie selbst gezeichnet hat. Ergebnis: "Ich sehe noch nichts" obwohl die KI selbst vor 2 Sekunden ein Gesicht gemalt hat.

### Lösung
Zwei Bilder an Gemini schicken: den aktuellen Canvas *und* den Canvas-Zustand vor der letzten KI-Antwort. Plus eine strukturierte Conversation-History.

### Architektur

**Backend (`server/ai.js`):**

```javascript
// Aktuell: 1 Bild
// Neu: 2 Bilder + strukturierte History

async function analyzeCanvas(canvasPng, previousInteractions = []) {
  const parts = [];

  // System-Prompt mit History-Context
  let contextPrompt = SYSTEM_PROMPT;

  if (previousInteractions.length > 0) {
    const historyText = previousInteractions.slice(-5).map((inter, i) => {
      return `${i + 1}. User malte → KI-Antwort: "${inter.ai_response_text}"`;
    }).join('\n');

    contextPrompt += `\n\nBisherige Interaktionen:\n${historyText}`;
  }

  parts.push({ text: contextPrompt });

  // Vorheriges KI-Bild als Referenz (wenn vorhanden)
  if (previousInteractions.length > 0) {
    const lastInteraction = previousInteractions[previousInteractions.length - 1];
    if (lastInteraction.canvas_snapshot) {
      parts.push({
        text: 'Das ist der Canvas-Zustand VOR der letzten KI-Antwort (zur Referenz):'
      });
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: lastInteraction.canvas_snapshot.replace(/^data:image\/png;base64,/, '')
        }
      });
    }
  }

  // Aktueller Canvas
  parts.push({ text: 'Das ist der aktuelle Canvas-Zustand:' });
  parts.push({
    inlineData: {
      mimeType: 'image/png',
      data: canvasPng.replace(/^data:image\/png;base64,/, '')
    }
  });

  parts.push({ text: 'Analysiere das Bild und antworte im JSON-Format.' });

  // ... Gemini API Call mit parts
}
```

**Datenbank (`server/db.js`):**

Die `interactions`-Tabelle speichert bereits `canvas_snapshot`. Prüfen ob das Feld den *User-Canvas* oder den *gesamten Canvas* speichert. Falls nur User-Canvas: Snapshot muss den gesamten Canvas-Zustand nach KI-Antwort speichern.

```sql
-- Prüfen ob canvas_snapshot den KI-Output enthält
-- Falls nein: Migration nötig
ALTER TABLE interactions ADD COLUMN canvas_after_ai TEXT;
```

**Frontend (`client/src/App.tsx`):**

Keine Änderungen nötig — der Canvas-PNG wird bereits nach dem Rendern der KI-Antwort exportiert.

### Aufwand: ~2-3 Stunden
- Backend-Prompt anpassen: 30 Min
- Zwei-Bilder-Logik: 1 Stunde
- DB-Snapshot prüfen/ggf. Migration: 30 Min
- Testen auf Kindle: 30 Min

---

## Feature 2: Animierte KI-Antworten

### Problem
KI-Zeichnungen poppen instant auf. Kein Gefühl von "die KI malt gerade." Auf dem E-Ink-Screen sieht das besonders unnatürlich aus.

### Lösung
Drawing-Commands nicht sofort rendern, sondern sequentiell mit Delay abspielen. Die KI "malt" live.

### Architektur

**Frontend (`client/src/utils/drawingRenderer.ts`):**

```typescript
// Aktuell: synchrones Rendering
// Neu: animiertes Rendering mit Promise

export async function renderDrawingCommandsAnimated(
  ctx: CanvasRenderingContext2D,
  commands: any[],
  options: {
    delayPerCommand?: number;  // ms pro Command (default: 80)
    onProgress?: (current: number, total: number) => void;
    signal?: AbortSignal;      // zum Abbrechen
  } = {}
): Promise<void> {
  const { delayPerCommand = 80, onProgress, signal } = options;

  ctx.save();

  for (let i = 0; i < commands.length; i++) {
    if (signal?.aborted) break;

    const cmd = commands[i];
    renderSingleCommand(ctx, cmd);

    onProgress?.(i + 1, commands.length);

    // Delay zwischen Commands
    if (i < commands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayPerCommand));
    }
  }

  ctx.restore();
}

// Bestehende synchrone Funktion bleibt für Kompatibilität
export function renderDrawingCommands(ctx: CanvasRenderingContext2D, commands: any[]) {
  // ... wie bisher
}
```

**Frontend (`client/src/hooks/useCanvas.ts`):**

```typescript
// renderAIDrawing wird async
const renderAIDrawing = useCallback(async (drawingCommands: any[]) => {
  const ctx = ctxRef.current;
  if (!ctx || !drawingCommands) return;

  // Vorherige Animation abbrechen
  if (animationAbortRef.current) {
    animationAbortRef.current.abort();
  }
  animationAbortRef.current = new AbortController();

  setIsAnimating(true);

  await renderDrawingCommandsAnimated(ctx, drawingCommands, {
    delayPerCommand: 80,
    signal: animationAbortRef.current.signal,
    onProgress: (current, total) => {
      // Optional: Progress-Event an Parent
    }
  });

  setIsAnimating(false);
}, []);
```

**Frontend (`client/src/components/Canvas.tsx`):**

```typescript
// useEffect für drawingCommands wird async
React.useEffect(() => {
  if (drawingCommands && drawingCommands.length > 0) {
    renderAIDrawing(drawingCommands);
  }
}, [drawingCommands, renderAIDrawing]);
```

**E-ink Spezialbehandlung:**

Auf dem Kindle Scribe ist der Refresh langsam (~300ms). Zu schnelle Animationen sehen scheiße aus. Lösung:

```typescript
const isEInk = /* wie bisher */;
const delayPerCommand = isEInk ? 150 : 80; // Langsamer auf E-Ink
```

### Aufwand: ~3-4 Stunden
- `drawingRenderer.ts` Refactor: 1.5 Stunden
- `useCanvas.ts` Async + Abort: 1 Stunde
- E-ink Delay-Tuning: 30 Min
- Testing: 1 Stunde

---

## Feature 3: KI initiiert manchmal

### Problem
Die KI ist passiv. Immer nur Reaktion auf User-Input. Auf dem Kindle, wo man lange starrt, fühlt sich das tot an.

### Lösung
Nach X Sekunden Inaktivität kann die KI *selbst* eine Aktion starten: eine Zeichnung aufs Canvas legen + Text-Overlay zeigen.

### Architektur

**Backend — Neuer Endpoint (`server/socket.js`):**

```javascript
// Neues Event: ki:proaktiv
socket.on('ki:proaktiv', async (data) => {
  const { sessionId } = data;

  // Prüfen ob Session existiert
  const session = db.getSession(sessionId);
  if (!session) return;

  // Letzte Interaktion holen
  const interactions = db.getInteractions(sessionId);
  const lastInteraction = interactions[interactions.length - 1];

  // Proaktiven Prompt generieren
  const proaktivPrompt = buildProaktivPrompt(lastInteraction);

  // KI-Anfrage
  const aiResponse = await ai.analyzeProaktiv(proaktivPrompt, interactions);

  socket.emit('ai:response', {
    text: aiResponse.text,
    drawing: aiResponse.drawing,
    interactionId: null, // proaktiv, keine DB-Speicherung nötig
    isProaktiv: true
  });
});
```

**Backend — Neuer AI-Prompt (`server/ai.js`):**

```javascript
const PROAKTIV_PROMPT = `Du bist auf einem digitalen Canvas. Der User hat sich seit einer Weile nicht gemeldet.

Deine Aufgabe:
1. Mache etwas Interessantes auf dem Canvas
2. Zeichne etwas Kleines, Witziges oder Überraschendes
3. Schreibe einen kurzen Text, der den User neugierig macht

Ideen:
- Male ein kleines Doodle in eine leere Ecke
- Stelle eine Frage ("Was ist das?")
- Starte ein Mini-Spiel ("Tic-Tac-Toe? Ich fange an!")
- Kommentiere was der User gemalt hat

Antwort-Format: wie immer (JSON mit text + drawing)`;

async function analyzeProaktiv(prompt, interactions) {
  // ... wie analyzeCanvas, aber ohne Bild
  // Nur Text-Prompt + History
}
```

**Frontend — Timer (`client/src/App.tsx`):**

```typescript
// Inaktivitäts-Timer
const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const PROAKTIV_DELAY = 30000; // 30 Sekunden

// Timer zurücksetzen bei jeder Interaktion
const resetInactivityTimer = useCallback(() => {
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current);
  }

  inactivityTimerRef.current = setTimeout(() => {
    if (currentSession) {
      sendProaktiv(currentSession.id);
    }
  }, PROAKTIV_DELAY);
}, [currentSession, sendProaktiv]);

// Bei jeder User-Interaktion: Timer resetten
useEffect(() => {
  resetInactivityTimer();
  return () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };
}, [drawingCommands, aiText, resetInactivityTimer]);
```

**Frontend — Proaktiv-Handler:**

```typescript
const handleProaktivResponse = useCallback((data: any) => {
  // KI hat proaktiv gezeichnet
  setAiText(data.text);
  if (data.drawing) {
    setDrawingCommands(data.drawing);
  }
  // Timer neu starten
  resetInactivityTimer();
}, [resetInactivityTimer]);
```

**Config:**

```typescript
// In Toolbar oder Settings
const PROAKTIV_DELAY_OPTIONS = [
  { value: 0, label: 'Aus' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1 Min' },
  { value: 120000, label: '2 Min' },
];
```

### Aufwand: ~4-5 Stunden
- Backend proaktiver Prompt: 1 Stunde
- Backend Socket-Handler: 1 Stunde
- Frontend Timer + Config: 1.5 Stunden
- Testing + Tuning: 1.5 Stunden

---

## Feature 4: Modi-System

### Problem
Es gibt nur einen Modus: Freestyle. Keine Struktur, keineGuides, keine Spiele.

### Lösung
4 Modi mit unterschiedlichen System-Prompts und Verhaltensweisen.

### Modi

| Modus | Icon | Beschreibung |
|-------|------|--------------|
| Freestyle | 💬 | Wie bisher, aber mit Conversational Memory |
| Spiel | 🎮 | KI schlägt Spiele vor, interaktive Elemente |
| Story | 📖 | Gemeinsame Graphic Novel erstellen |
| Lern | 🎓 | KI annotiert und erklärt |

### Architektur

**Frontend — Modus-Selector (`client/src/components/ModeSelector.tsx`):**

```typescript
export type CanvasMode = 'freestyle' | 'spiel' | 'story' | 'lernen';

interface ModeSelectorProps {
  currentMode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  const modes: { key: CanvasMode; icon: string; label: string }[] = [
    { key: 'freestyle', icon: '💬', label: 'Freestyle' },
    { key: 'spiel', icon: '🎮', label: 'Spiel' },
    { key: 'story', icon: '📖', label: 'Story' },
    { key: 'lernen', icon: '🎓', label: 'Lernen' },
  ];

  return (
    <div className="flex gap-1">
      {modes.map(mode => (
        <button
          key={mode.key}
          onClick={() => onModeChange(mode.key)}
          className={`px-2 py-1 text-sm border-2 border-black ${
            currentMode === mode.key ? 'bg-black text-white' : 'bg-white'
          }`}
          title={mode.label}
        >
          {mode.icon}
        </button>
      ))}
    </div>
  );
}
```

**Backend — Modus-spezifische Prompts (`server/ai.js`):**

```javascript
const MODE_PROMPTS = {
  freestyle: SYSTEM_PROMPT, // wie bisher

  spiel: `Du bist ein spielerischer Assistent auf einem digitalen Canvas.
Der User möchte mit dir spielen.

Deine Aufgabe:
1. Schlage Spiele vor (Tic-Tac-Toe, Hangman, Pictionary, Schach, etc.)
2. Wenn der User ein Spiel beginnt, spiele mit
3. Zeichne Spielfelder, Figuren, etc.
4. Halte den Spielstand auf dem Canvas fest

Spiele die du anbieten kannst:
- Tic-Tac-Toe (3x3 Grid)
- Hangman (Strichmännchen)
- Pictionary (du malst, User rät)
- Dots and Boxes (Punkte-Grid)
- Schach (einfach)

Regeln:
- Antworte auf Deutsch
- Zeichne Spielfelder klar und strukturiert
- Nutze den gesamten Canvas
- Wenn das Spiel vorbei ist, schlage ein neues vor`,

  story: `Du bist ein Geschichtenerzähler auf einem digitalen Canvas.
Gemeinsam mit dem User erstellst du eine visuelle Geschichte.

Deine Aufgabe:
1. Beginne eine Geschichte mit einer Zeichnung
2. Wenn der User weiterschreibt, baue darauf auf
3. Erzähle die Geschichte in Panels (wie ein Comic)
4. Jede Interaktion ist ein neues Panel

Regeln:
- Nummeriere die Panels (1, 2, 3...)
- Zeichne Szenen, nicht nur Objekte
- Nutze Text-Bubbles für Dialoge
- Halte den Stil konsistent
- Antworte auf Deutsch
- Wenn die Geschichte zu Ende ist, fange eine neue an`,

  lernen: `Du bist ein Lehrer auf einem digitalen Canvas.
Der User möchte etwas lernen. Du erklärst mit Diagrammen und Annotationen.

Deine Aufgabe:
1. Analysiere was der User fragt oderzeichnet
2. Erkläre es mit beschrifteten Diagrammen
3. Nutze Pfeile, Labels, Nummerierungen
4. Mache komplexe Dinge einfach

Regeln:
- Beschrifte alles klar
- Nutze Pfeile für Zusammenhänge
- Erkläre Schritt für Schritt
- Antworte auf Deutsch
- Frage nach ob der User mehr wissen möchte`
};
```

**Backend — Modus im Socket-Handler:**

```javascript
socket.on('stroke:complete', async (data) => {
  const { sessionId, canvasPng, mode = 'freestyle' } = data;

  // Modus-spezifischen Prompt verwenden
  const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.freestyle;

  const aiResponse = await ai.analyzeCanvas(canvasPng, previousInteractions, systemPrompt);
  // ...
});
```

**Frontend — Modus-State in App.tsx:**

```typescript
const [canvasMode, setCanvasMode] = useState<CanvasMode>('freestyle');

// Modus an stroke:complete mitschicken
const handleStrokeComplete = useCallback((canvasPng: string) => {
  if (!currentSession) {
    createSession().then((session) => {
      if (session) {
        sendStrokeComplete(session.id, canvasPng, canvasMode);
      }
    });
    return;
  }
  sendStrokeComplete(currentSession.id, canvasPng, canvasMode);
}, [currentSession, sendStrokeComplete, createSession, canvasMode]);
```

**Toolbar-Integration:**

```typescript
// In Toolbar.tsx
<ModeSelector
  currentMode={canvasMode}
  onModeChange={setCanvasMode}
/>
```

### Aufwand: ~6-8 Stunden
- ModeSelector Component: 1 Stunde
- Modus-Prompts schreiben: 2 Stunden
- Backend Modus-Handling: 1.5 Stunden
- Frontend State-Management: 1 Stunde
- Testing alle Modi: 2 Stunden

---

## Feature 5: Tap-Annotation

### Problem
User kann nicht direkt auf der KI-Antwort interagieren. Wenn die KI ein Schwert malt und der User es größer haben will, muss er es selbst zeichnen.

### Lösung
Nach einer KI-Antwort kurzzeitig einen "Antwort-Modus" aktivieren. User kann auf die KI-Zeichnung tippen. Die Tap-Position wird an die KI geschickt.

### Architektur

**Frontend — Tap-Handler (`client/src/components/Canvas.tsx`):**

```typescript
interface CanvasProps {
  // ... existing props
  onTapResponse?: (x: number, y: number, canvasPng: string) => void;
  isTapMode?: boolean;
}

export function Canvas({ /* ... */, onTapResponse, isTapMode }: CanvasProps) {
  // Tap-Handler
  const handleTap = useCallback((e: React.PointerEvent) => {
    if (!isTapMode || !onTapResponse) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Canvas als PNG
    const png = canvas.toDataURL('image/png');
    onTapResponse(x, y, png);
  }, [isTapMode, onTapResponse]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        touchAction: 'none',
        cursor: isTapMode ? 'crosshair' : 'default'
      }}
      onPointerDown={isTapMode ? handleTap : startStroke}
      onPointerMove={isTapMode ? undefined : continueStroke}
      onPointerUp={isTapMode ? undefined : endStroke}
      // ... touch handlers
    />
  );
}
```

**Frontend — Tap-Mode State (`client/src/App.tsx`):**

```typescript
const [isTapMode, setIsTapMode] = useState(false);
const [tapModeTimer, setTapModeTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

// Nach KI-Antwort: Tap-Mode aktivieren
const handleResponse = useCallback((data: any) => {
  setIsThinking(false);
  setAiText(data.text);
  if (data.drawing) {
    setDrawingCommands(data.drawing);
  }

  // Tap-Mode für 10 Sekunden aktivieren
  setIsTapMode(true);
  if (tapModeTimer) clearTimeout(tapModeTimer);
  const timer = setTimeout(() => setIsTapMode(false), 10000);
  setTapModeTimer(timer);
}, [tapModeTimer]);

// Tap-Response Handler
const handleTapResponse = useCallback((x: number, y: number, canvasPng: string) => {
  setIsTapMode(false);
  if (tapModeTimer) clearTimeout(tapModeTimer);

  // An KI schicken
  sendTapResponse(currentSession?.id, x, y, canvasPng);
}, [currentSession, tapModeTimer]);
```

**Backend — Tap-Handler (`server/socket.js`):**

```javascript
socket.on('tap:response', async (data) => {
  const { sessionId, x, y, canvasPng } = data;

  const session = db.getSession(sessionId);
  if (!session) return;

  socket.emit('ai:thinking', {});

  const previousInteractions = db.getInteractions(sessionId);

  // Tap-spezifischen Prompt verwenden
  const tapPrompt = buildTapPrompt(x, y, previousInteractions);
  const aiResponse = await ai.analyzeCanvasWithTap(canvasPng, tapPrompt, previousInteractions);

  socket.emit('ai:response', {
    text: aiResponse.text,
    drawing: aiResponse.drawing,
    interactionId: null
  });
});
```

**Backend — Tap-Prompt (`server/ai.js`):**

```javascript
function buildTapPrompt(x, y, interactions) {
  const lastResponse = interactions[interactions.length - 1];

  return `Der User hat auf den Canvas getippt bei Koordinaten (${x}, ${y}).

Das ist vermutlich ein Verweis auf etwas das du gerade gezeichnet hast.
Deine letzte Antwort war: "${lastResponse?.ai_response_text || 'Unbekannt'}"

Mögliche Reaktionen:
- Wenn der User auf ein Objekt tippt: "Du meinst das Schwert? Soll ich es größer machen?"
- Wenn der User auf eine leere Stelle tippt: "Was soll ich hier hin malen?"
- Wenn der User auf Text tippt: Erkläre den Text genauer

Antworte im gewohnten JSON-Format (text + drawing).`;
}
```

**Visuelles Feedback:**

```typescript
// Tap-Mode Indicator
{isTapMode && (
  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 text-sm z-50">
    👆 Tippe auf die Zeichnung um zu antworten
  </div>
)}
```

### Aufwand: ~3-4 Stunden
- Frontend Tap-Handler: 1 Stunde
- Backend Tap-Prompt: 1 Stunde
- Tap-Mode UI/UX: 1 Stunde
- Testing: 1 Stunde

---

## Implementierungsreihenfolge

### Phase 1 (Grundlagen, ~1 Tag)
1. **Conversational Memory** — Verbessert sofort alle Interaktionen
2. **Tap-Annotation** — Geringer Aufwand, hoher Impact

### Phase 2 (Interaktivität, ~1-2 Tage)
3. **Animierte KI-Antworten** — Macht die KI "lebendig"
4. **KI initiiert manchmal** — Braucht Feature 1 als Basis

### Phase 3 (Modi, ~1-2 Tage)
5. **Modi-System** — Umfangreichste Änderung, aber unabhängig

### Gesamtaufwand: ~3-5 Tage

---

## Technische Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Gemini API zu langsam für Animationen | Mittel | Hoch | Fallback auf instant-Rendering |
| E-ink Refresh zu langsam für Animationen | Niedrig | Mittel | Delay anpassen, Fallback |
| Proaktive KI nervt User | Mittel | Mittel | Config-Option, konservativer Timer |
| Tap-Koordinaten ungenau auf Kindle | Niedrig | Gering | Toleranz-Bereich implementieren |
| Modus-Prompts zu lang für Gemini | Niedrig | Gering | Prompt-Länge testen |

---

## Testing-Strategie

### Manuell (Kindle Scribe)
- [ ] Conversational Memory: KI erinnert sich an vorherige Zeichnungen
- [ ] Animationen: KI malt flüssig, kein Lag
- [ ] Proaktiv: KI initiiert nach Inaktivität
- [ ] Modi: Wechsel funktioniert, Prompts sind korrekt
- [ ] Tap: Tippen erkennt Objekte korrekt

### Automatisiert (Backend)
- [ ] Unit Tests für AI-Prompts
- [ ] Unit Tests für Modus-Handling
- [ ] Integration Tests für Socket-Events

---

_Stand: 2026-08-27. Planung._
