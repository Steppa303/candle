# 🕯️ Candle V2 — The Turn-Based Story Engine

**Datum:** 2026-08-27
**Fokus:** Komplexe, SVG-basierte Grafiken, serverseitiges Rendering, E-Ink-Optimierung, turn-based Storytelling mit Paging.

---

## 1. Vision & Konzept

Candle V2 verwandelt den Kindle Scribe in eine Plattform für interaktives, rundenbasiertes Storytelling (Graphic Novel Style).
Die KI (Gemini) agiert als kreativer Storyteller und Illustrator. Basierend auf den Skizzen des Nutzers erkennt sie Handlungsmöglichkeiten, entwickelt die Geschichte weiter und antwortet mit komplexen, hochpräzisen Schwarz-Weiß-Grafiken.

**Kernaspekte:**
- **Turn-Based:** Ein stetiges Ping-Pong zwischen Nutzer-Skizze und KI-Antwort.
- **Visuelle Qualität:** Ohne den Einsatz von Image-Gen-Modellen (wie Stable Diffusion) wird die Qualität über strukturierte SVG-Generierung und serverseitiges Compositing von Templates maximiert.
- **Szenenwechsel & Paging:** Die KI kann den Schauplatz wechseln und den gesamten Canvas überschreiben. Nutzer können in der Geschichte vor- und zurückblättern.
- **Maximale Performance:** Der Kindle Scribe wird als reiner "Thin Client" genutzt. Alle aufwändigen Renderings passieren auf dem Server.

---

## 2. Architektur: Serverseitiges Rendering

Da der Browser des Kindle Scribe leistungsschwach ist und bei vielen Pfaden/Animationen laggt, verschieben wir die **gesamte Rendering-Last auf das Backend**.

### Der neue Flow
1. **Client (Kindle):** Der Nutzer zeichnet. Beim Pen-Up sendet der Client ein rohes Bild/Skizze (oder Pfade) der aktuellen Interaktion an den Server.
2. **KI-Interpretation (Server):** Gemini analysiert die Skizze im Kontext der aktuellen Story-Seite und generiert eine Antwort (Text + SVG).
3. **SVG Compositing (Server):** Das Backend kombiniert Geminis SVG-Output mit hochqualitativen, serverseitigen Templates (Panel-Rahmen, komplexe Sprechblasen, Standard-Elemente).
4. **Rasterisierung & Optimierung (Server):**
   - Das zusammengesetzte SVG wird auf dem Server gerastert (z. B. via `resvg-js` oder `canvas`).
   - Das Bild wird speziell für E-Ink optimiert: Konvertierung in striktes Schwarz/Weiß (1-Bit) oder optimierte Graustufen mittels Dithering (z. B. via `sharp`).
5. **Display (Client):** Der Server sendet das finale, perfekt optimierte und fertig gerenderte PNG an den Client. Der Kindle zeigt dieses Bild instant als neuen Hintergrund/Layer an — **ohne jeglichen Rendering-Lag**.

---

## 3. Paging-System (Szenenwechsel)

Um "komplette Überschreibungen" (z.B. Wechsel des Schauplatzes) zu ermöglichen, wird Candle zu einem Seiten-basierten System.

- **Datenstruktur:** Eine Story-Session besteht aus einem Array von Seiten (`Pages`). Jede Seite beinhaltet den aktuellen, zusammengeführten visuellen Zustand (das vom Server generierte PNG) sowie die Metadaten der Geschichte.
- **Blättern:** Die UI erhält Buttons für `< Zurück` und `Vor >`. Der Nutzer kann durch die vergangenen Szenen blättern.
- **Szenenwechsel:** Gemini entscheidet im Prompt-Output, ob eine Zeichnung eine bestehende Szene ergänzt (`action: "update"`) oder einen kompletten Szenenwechsel erfordert (`action: "scene_change"`). Bei einem Szenenwechsel wird eine neue, leere "Seite" in der Datenbank angelegt und das neue SVG als Basis gerendert.

---

## 4. Die Grafik-Engine (Maximales SVG-Potential)

Da wir keine generativen Bildmodelle nutzen, müssen wir Geminis Fähigkeiten strukturiert kanalisieren, um "komplexe und genaue" Grafiken zu erzielen.

1. **Vektorbasiertes Layout:** Gemini generiert präzise `<svg>` Elemente. Texte werden via `<foreignObject>` oder sauberen `<text>`-Tags inklusive Word-Wrap formatiert.
2. **Template-Bibliothek:** Der Server hält eine Bibliothek von SVG-Templates (z.B. detaillierte Requisiten, dynamische Comic-Panels, ausdrucksstarke Gesichter/Masken). Gemini referenziert diese Templates in seinem JSON-Output und positioniert sie exakt, anstatt jeden Strich selbst "erfinden" zu müssen.
3. **Typografie & Präzision:** Durch das serverseitige Rendering sind Schriftarten, Abstände und Ausrichtungen perfekt. Die Unschärfe und Fehlerhaftigkeit geschätzter Canvas-Koordinaten aus V1 entfällt komplett.

---

## 5. Implementierungs-Roadmap

### Phase 1: Backend-Rendering Pipeline
- **Tools:** Installation von `resvg-js` (für schnelles SVG zu PNG Rendering in Node) und `sharp` (für Bildbearbeitung, Dithering, E-Ink-Kontrast).
- **Logik:** Aufbau des Endpoints, der ein SVG entgegennimmt, rastern lässt, optimiert und als Base64-PNG ausgibt.

### Phase 2: Paging & State Management
- **Datenbank:** Erweiterung der SQLite-Datenbank um ein `pages`-Konzept innerhalb einer Session.
- **Client UI:** Einbau der Paging-Kontrollen (Zurück/Vor). Anpassung der Canvas-Logik, sodass bei Empfang der Server-Antwort das übermittelte PNG als flacher Hintergrund gesetzt wird.

### Phase 3: AI Prompting & Story-Engine
- **Prompt Engineering:** Anpassung des System-Prompts, um die Rolle als "Rundenbasierter Storyteller" zu definieren. Die KI muss lernen, aus Skizzen Handlungsstränge zu spinnen und Szenenwechsel auszulösen.
- **JSON-Struktur:** Das Output-Format wird strikt:
  ```json
  {
    "action": "update" | "scene_change",
    "story_narrative": "Interner Gedankengang zur Story",
    "svg": "<svg>...</svg>",
    "templates": [{ "name": "panel_1", "x": 0, "y": 0 }]
  }
  ```

### Phase 4: Template-Compositing
- Aufbau der in `ai-update.md` (Säule C) beschriebenen Template-Engine, aber exklusiv auf dem Server vor der Rasterisierung.

---

## Fazit
Mit Candle V2 wird die Last vom Scribe genommen und auf den Server verlagert. Das Ergebnis ist eine dramatische Steigerung der visuellen Präzision, garantierte E-Ink-Lesbarkeit durch serverseitiges Dithering und ein tiefgreifendes, interaktives Story-Erlebnis durch Szenen-Management und Paging.
