# 🕯️ Candle — Plan & Goals

**Stand:** 2026-08-28
**Status:** Aktiv

---

## Erledigt (Phase 1+2+V2)

- [x] E-Ink Drawing Optimierungen (rAF Batching, EMA Smoothing, 1:1 Pixel)
- [x] Two-Canvas System (Foreground raw + Background geglättet)
- [x] Catmull-Rom Smoothing mit RDP Point-Reduction
- [x] Relative Positionierung für KI-Zeichnungen
- [x] Grid-Overlay + Scale-Reference + Proportions
- [x] Conversational Canvas Memory (2-Bilder-Prompt)
- [x] Tap-Annotation (10s Tap-Mode nach KI-Antwort)
- [x] Animierte KI-Antworten (sequential rendering mit Delay)
- [x] KI initiiert manchmal (Inaktivitäts-Timer, konfigurierbar)
- [x] Floating Toolbox (FAB, Stift-Dicke, Glättung-Slider, Farbwähler, KI-Toggle)
- [x] Canvas-Größe an Scribe angepasst (dynamisch, DPR 1 auf E-Ink)
- [x] JSON-Fallback Fix (rohe KI-Antworten nicht mehr im Overlay)
- [x] **V2 Server-Side Rendering** (28.08.2026) — SVG→PNG Pipeline, E-Ink Dithering, Paging
  - renderer.js (resvg-js + sharp + Floyd-Steinberg)
  - svgValidator.js (SVG-Sanitization)
  - pages-Tabelle + DB-Migration
  - V2_SYSTEM_PROMPT (SVG-Output-Format)
  - V2-Pfad in socket.js (validate → compose → render → PNG)
  - Frontend: v2Mode Toggle, PNG-Display, Paging-Buttons
  - V1/V2 Koexistenz (Fallback)

---

## Offen — Priorisiert

### 🔴 P1 — Story-Modus (Collaborative Storytelling)

**Was:** Einzelner Toggle (Story AN/AUS). KI wird zum aktiven Storytelling-Partner.
User und KI bauen gemeinsam eine visuelle Geschichte auf — Zug um Zug.

**Detaillierter Plan:** `projects/candle/story.md`

**Kern-Features:**
- Story-Prompt statt Analyse-Prompt
- Neuer Drawing-Command: `speechbubble` (Sprechblasen mit Text)
- Neuer Drawing-Command: `clear` (eigene alte Zeichnungen übermalen)
- Toggle in der Floating Toolbox

**Betroffene Dateien:**
- `server/ai.js` — STORY_PROMPT + Prompt-Selection
- `server/socket.js` — storyMode extrahieren
- `client/src/utils/drawingRenderer.ts` — speechbubble + clear Commands
- `client/src/components/FloatingToolbox.tsx` — Story-Toggle
- `client/src/components/StoryToggle.tsx` — **NEU**
- `client/src/App.tsx` — storyMode State + localStorage
- `client/src/hooks/useSocket.ts` — storyMode mitschicken

**Aufwand:** ~4-5 Stunden

**Hinweis:** Erster Versuch (candle-story-worker) failed wegen OpenRouter 402. Nochmal spawnen mit MiMo.

---

## Ausgeschlossen (vorerst nicht geplant)

- ~~Export als PNG/PDF~~ — nicht nötig
- ~~Multi-User Support~~ — nicht nötig
- ~~Smoothing-epsilon feintunen~~ — funktioniert gut, Regler vorhanden
- ~~Radierer~~ — nicht nötig
- ~~Undo/Redo~~ — nicht nötig

---

## Offene Fragen

1. **Story-Toggle: KI-Toggle ersetzen oder ergänzen?** → Empfehlung: ergänzen (beide unabhängig)
2. **Max. Sprechblasen pro Antwort?** → Empfehlung: 2-3

---

_Plan erstellt: 2026-08-27 21:32. Aktualisiert: 2026-08-28 06:40 — V2 implementiert, Story-Modus als nächstes._
