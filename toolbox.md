# 🕯️ Candle — Floating Toolbox Plan

**Branch:** `feature/floating-toolbox`
**Datum:** 2026-08-27
**Status:** ✅ Deployed (27.08.2026 18:00)

---

## 1. Überblick

Eine frei verschiebare Floating Toolbox im reMarkable-Style für den Kindle Scribe. Ein kleiner runder Button schwebt über der Zeichenfläche und öffnet bei Tap eine vertikale Toolbar mit Werkzeugen und Settings. Die bestehende untere Toolbar bleibt unverändert.

### Referenz-Verhalten (Bilder 1-3)

Die drei Referenzbilder zeigen ausschließlich die **UI-Mechanik**, nicht den Inhalt:

1. **Bild 1 — FAB:** Ein kleiner schwarzer Kreis mit weißem Icon schwebt auf dem Canvas
2. **Bild 2 — Toolbar:** Bei Tap öffnet sich eine vertikale Leiste mit gestapelten Icons, oben ein Collapse-Button
3. **Bild 3 — Submenu:** Bei Klick auf ein Toolbar-Element öffnet sich horizontal ein Untermenü mit spezifischen Optionen (z.B. Pinseldicke als Wellenlinien-Buttons am unteren Rand)

Die konkreten Icons, Tools und Funktionen sind Candle-spezifisch und werden im Laufe der Entwicklung definiert.

---

## 2. Was bleibt (unverändert)

Die **untere Toolbar** (`Toolbar.tsx`) bleibt komplett wie sie ist:

- Session-Name + Session-Wechsel
- Farbwähler (Schwarz/Dunkelgrau/Grau)
- Stift-Dicke (Select 1-5px)
- **Löschen** — Canvas leeren
- **+ Neu** — Neue Session
- **◉ Glatt / ○ Raw** — Glättung Toggle
- Debounce-Slider
- Thinking-Indicator ("KI denkt nach...")

---

## 3. Was neu kommt

### 3.1 Floating Action Button (FAB)

- **Form:** Schwarzer Kreis, ~48px Durchmesser
- **Icon:** Weißes Stift-Icon (SVG, inline)
- **Position:** Frei verschiebbar per Drag (Stift/Touch/Maus)
- **Persistenz:** Position wird in `localStorage` gespeichert (`candle-fab-position: {x, y}`)
- **Startposition:** Rechts oben (oder letzte gespeicherte Position)
- **Tap-Verhalten:** < 5px Bewegung = Tap → Toolbar öffnen/schließen
- **Drag-Verhalten:** ≥ 5px Bewegung = Drag → Button verschieben
- **Canvas-Schutz:** Während Drag werden Canvas-Pointer-Events blockiert

### 3.2 Vertikale Toolbar

Öffnet sich neben dem FAB, wenn dieser getappt wird.

- **Form:** Schmales vertikales Rechteck, abgerundete Ecken (8px radius)
- **Styling:** Weißer Hintergrund, 1px schwarzer Rahmen
- **Breite:** ~56px (passend zu Icon-Größe)
- **Position:** Direkt neben dem FAB (rechts wenn FAB links von der Mitte, links wenn FAB rechts)
- **Collapse:** Oben ein kleiner Kreis mit Pfeil-Icon zum Einklappen
- **Inhalt (initial, erweiterbar):**

| # | Element | Aktion | Icon (Vorschlag) |
|---|---------|--------|------------------|
| 1 | Stift-Dicke | → Submenu öffnen | Horizontale Linien (verschiedene Stärken) |
| 2 | Glättung | → Submenu mit Slider öffnen | Wellenlinie (~) |
| 3 | Farbwähler | → Submenu mit Farbfeldern öffnen | Kreis (aktuelle Farbe gefüllt) |
| — | Trennlinie | — | Dünne horizontale Linie |
| 4 | KI AN/AUS | → Toggle (kein Submenu) | Kreis mit "AI" Text |

- **Aktives Element:** Invertiert dargestellt (weiß auf schwarz)
- **Schließen:** Tap auf Collapse-Button oder Tap außerhalb

### 3.3 Submenu

Öffnet sich horizontal neben der Toolbar, auf Höhe des geklickten Elements.

- **Form:** Rechteck, abgerundete Ecken, gleiche Styling-Sprache wie Toolbar
- **Position:** Dockt an die Toolbar an (rechts oder links, je nach Toolbar-Ausrichtung)
- **Schließen:** Tap außerhalb, oder Tap auf ein anderes Toolbar-Element (wechselt Submenu)

#### Submenu: Stift-Dicke

- 5 quadratische Buttons in einer Reihe
- Jeder Button zeigt eine Wellenlinie in unterschiedlicher Stärke:
  - Button 1: Sehr feine Linie (1px)
  - Button 2: Dünn (2px)
  - Button 3: Mittel (3px)
  - Button 4: Dick (4px)
  - Button 5: Sehr dick (5px)
- Aktive Stärke: Invertiert (schwarzer Hintergrund, weiße Linie)
- Klick → setzt `strokeWidth` und schließt Submenu

#### Submenu: Glättung-Slider

- **Slider:** Horizontaler Slider
- **Wertebereich:** 0.0 (keine Glättung) bis 1.0 (maximale Glättung)
- **Schritte:** 0.05er Schritte
- **Aktueller Wert:** Wird numerisch angezeigt (z.B. "0.40")
- **Vorschau:** Aktueller Glättungswert wird sofort angewendet (Live-Preview)
- **E-ink freundlich:** Großer Slider-Griff, klare Markierungen, hoher Kontrast
- **Integration:** Steuert den `smoothingValue` Parameter (Tension des Catmull-Rom Splines)

#### Submenu: Farbwähler

- Farbfelder als Kreise
- Aktuell: Schwarz #000000, Dunkelgrau #333333, Grau #666666
- Aktive Farbe: invertierter Rahmen

---

## 4. Drag vs. Tap — Logik

```
pointerdown auf FAB:
  → startX, startY merken
  → pointer-events: none auf Canvas (Schutz)

pointermove:
  → deltaX, deltaY berechnen
  → wenn |delta| ≥ 5px:
      → DRAG-Modus: FAB-Position aktualisieren
  → sonst:
      → ignorieren (warten auf pointerup)

pointerup:
  → wenn DRAG-Modus:
      → Position in localStorage speichern
      → Canvas pointer-events wiederherstellen
  → wenn KEIN DRAG (< 5px):
      → TAP: Toolbar öffnen/schließen
      → Canvas pointer-events wiederherstellen
```

---

## 5. Architektur

### Neue Dateien (implementiert)

```
client/src/
├── components/
│   ├── FloatingToolbox.tsx    — Orchestrator (State: open/closed, active submenu)
│   ├── FAB.tsx                — Floating Action Button (draggable)
│   ├── VerticalToolbar.tsx    — Vertikale Toolbar mit Icons
│   ├── SubMenu.tsx            — Container für Submenu-Content
│   ├── BrushSizePicker.tsx    — 5 Wellenlinien-Buttons
│   ├── SmoothingSlider.tsx    — Glättung-Slider (0.0–1.0)
│   └── ColorPicker.tsx        — Farbwähler-Kreise
└── hooks/
    └── useDrag.ts             — Drag + Tap Detection Logik
```

### Geänderte Dateien

```
client/src/
├── App.tsx                    — FloatingToolbox einbinden, smoothingValue State
├── App.css                    — FAB/Toolbar/Submenu Styles
├── hooks/useCanvas.ts         — TENSION dynamisch (smoothingValue prop)
└── components/Canvas.tsx      — smoothingValue Prop durchgereicht
```

### Props-Kommunikation

```
App.tsx
├── FloatingToolbox
│   ├── strokeColor
│   ├── onColorChange
│   ├── strokeWidth
│   ├── onWidthChange
│   ├── smoothingValue
│   ├── onSmoothingValueChange
│   ├── aiEnabled (neu!)
│   └── onAiToggle (neu!)
├── Toolbar (unten, unverändert)
│   ├── sessionName, onSessionClick
│   ├── strokeColor, onColorChange
│   ├── strokeWidth, onWidthChange
│   ├── onClear, onNewSession
│   ├── isThinking
│   ├── smoothingEnabled, onSmoothingChange
│   └── DebounceSlider
└── Canvas
    └── smoothingValue → wird an useCanvas übergeben
```

### State-Management

```
FloatingToolbox (internal state):
├── isOpen: boolean              — Toolbar sichtbar?
├── activeSubmenu: string|null   — 'brush' | 'smoothing' | 'color' | null
└── fabPosition: {x, y}          — Aus localStorage

App.tsx (erweitert):
├── smoothingValue: number       — 0.0 bis 1.0 (Default: 0.4)
├── smoothingEnabled: boolean    — Toggle (bestehend)
└── aiEnabled: boolean           — KI AN/AUS (Default: true)
```

---

## 6. Glättung-Integration

### Aktuell

- `smoothingEnabled` (boolean) → Toggle in unterer Toolbar
- `smoothingValue` (number, 0.0–1.0) → Slider in Floating Toolbox
- Catmull-Rom Smoothing mit dynamischem `TENSION`

### Verhalten

- `smoothingEnabled = false` → keine Glättung (egal welcher Wert)
- `smoothingEnabled = true` → Glättung mit `TENSION = smoothingValue`

### Änderung in `useCanvas.ts`

```typescript
// Vorher:
const TENSION = 0.4;

// Nachher:
const TENSION = smoothingValue; // Props aus App.tsx, Default 0.4
```

---

## 7. E-ink Optimierungen

- **Keine Animationen** — Show/Hide, kein Slide/Fade
- **Hoher Kontrast** — Schwarz/Weiß, keine Transparenzen
- **Große Touch-Targets** — Mindestens 48px für alle interaktiven Elemente
- **touch-action: none** — Am FAB, verhindert Browser-Gesten
- **Will-change: transform** — Am FAB für GPU-beschleunigtes Dragging
- **requestAnimationFrame** — Position-Updates während Drag für smooth Bewegung

---

## 8. Implementierungs-Reihenfolge

- [x] Branch erstellen — `feature/floating-toolbox` von `main`
- [x] useDrag.ts — Drag + Tap Detection Hook
- [x] FAB.tsx — Floating Action Button mit Drag
- [x] VerticalToolbar.tsx — Leere Toolbar mit Collapse
- [x] SubMenu.tsx — Submenu-Container
- [x] BrushSizePicker.tsx — Stift-Dicke Auswahl
- [x] SmoothingSlider.tsx — Glättung-Slider
- [x] ColorPicker.tsx — Farbwähler
- [x] FloatingToolbox.tsx — Alles zusammenbauen
- [x] App.tsx — Integration, smoothingValue State
- [x] useCanvas.ts — TENSION dynamisch machen
- [x] App.css — Styles für FAB/Toolbar/Submenu
- [x] Build testen — `cd client && npm run build` ✅
- [x] Deploy — `./deploy.sh` ✅ (27.08.2026 18:00)
- [x] FAB-Background fix (schwarzer Kreis) ✅ (27.08.2026 18:28)
- [x] AI-Toggle Button ✅ (27.08.2026 18:33)
- [x] SmoothingSlider → TENSION-Steuerung ✅ (27.08.2026 18:25)
- [ ] Kindle Scribe testen

---

## 9. AI-Toggle (27.08.2026)

**Status:** ✅ Deployed

In der Floating Toolbox gibt es einen AI-Button als letztes Element (durch Trennlinie abgetrennt).

**Verhalten:**
- **AI AN** (schwarz/aktiv) → Striche werden an Server geschickt, KI antwortet
- **AI AUS** (weiß) → Strich wird nur gezeichnet, kein `stroke:complete` an Server
- Banner "KI AUS — Nur Zeichnen" wird oben angezeigt wenn deaktiviert
- Toggle bei Klick (kein Submenu)

**Implementation:**
- `aiEnabled` State in App.tsx (Default: true)
- `handleStrokeComplete` prüft `aiEnabled` vor `sendStrokeComplete`
- FloatingToolbox: `aiEnabled` + `onAiToggle` Props
- `handleSelect` in FloatingToolbox: bei id='ai' → `onAiToggle()` statt Submenu

**Icon:** Kreis mit "AI" Text (SVG)

## 10. Offene Fragen

- [ ] Welche weiteren Tools sollen in die Toolbar? (Radierer? Formen? Lasso?)
- [ ] Soll die Toolbar bei FAB-Drag mitwandern oder schließen?
- [ ] Max-Anzahl an Toolbar-Elementen bevor es unübersichtlich wird?
- [ ] Branch auf `main` mergen?

---

_Plan erstellt: 2026-08-27 17:22. Deployed: 2026-08-27 18:00. AI-Toggle + Smoothing-Fix: 2026-08-27 18:33._
