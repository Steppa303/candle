const fs = require('fs');
const path = require('path');

// Load Gemini API key
try {
  const envPath = path.join('/root/.openclaw/workspace/.secrets', 'google-gemini.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch (e) { /* ignore */ }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VISION_MODEL || 'gemini-2.5-flash';

const STORY_PROMPT = `Du bist ein kreativer Storytelling-Partner auf einem digitalen Canvas.
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
{ "type": "speechbubble", "x": 100, "y": 200, "text": "Hallo!", "tailX": 80, "tailY": 250 }
- tailX/tailY = Punkt auf den die Sprechblase zeigt (die Figur)
- Text kurz halten (max ~20 Wörter pro Blase)

CLEAR-FORMAT (eigene alte Zeichnungen überschreiben):
{ "type": "clear", "x": 100, "y": 200, "width": 150, "height": 200 }
- Löscht einen rechteckigen Bereich (malt ihn weiß)
- NUR für deine eigenen vorherigen Zeichnungen verwenden!

Antwort-Format (JSON):
{
  "text": "Deine Text-Antwort",
  "drawing": [
    { "type": "speechbubble", "x": 0, "y": 0, "text": "Prost!", "tailX": -20, "tailY": 50, "position": "above", "anchor": "center" },
    { "type": "line", "x1": 0, "y1": 0, "x2": 0, "y2": 100, "position": "below", "anchor": "center" },
    { "type": "clear", "x": 0, "y": 0, "width": 100, "height": 100, "position": "center", "anchor": "center" }
  ]
}

Position-Werte: above, below, left_of, right_of, center, top_right, top_left, bottom_right, bottom_left
Anchor-Werte: center (default), top, bottom, left, right

WICHTIG:
- Koordinaten sind RELATIV zum Ankerpunkt (0,0 = Ankerpunkt)
- Nutze IMMER position + anchor für jedes Drawing-Command
- Zeichne mit Farbe #666666 und Strichstärke 2
- Antworte NUR mit dem JSON-Objekt, kein anderer Text`;

const SYSTEM_PROMPT = `Du siehst ein Bild, das ein User auf einem digitalen Canvas gezeichnet hat.

Deine Aufgabe:
1. Analysiere was der User gemalt hat
2. Antworte mit einem kurzen Text (max 2 Sätzen) was du siehst
3. Wenn der User eine Anweisung geschrieben hat (z.B. "gib ihm eine Freundin"), führe sie aus
4. Zeichne deine Antwort auf das Canvas

Antwort-Format (JSON):
{
  "text": "Deine Text-Antwort",
  "drawing": [
    {
      "type": "line",
      "x1": 0, "y1": 0, "x2": 0, "y2": 100,
      "position": "below",
      "anchor": "center"
    },
    {
      "type": "circle",
      "cx": 0, "cy": 0, "r": 25,
      "position": "right_of",
      "anchor": "top"
    },
    {
      "type": "path",
      "points": [[0,0], [10,20], [20,10]],
      "position": "above",
      "anchor": "center"
    },
    {
      "type": "text",
      "x": 0, "y": 0,
      "content": "Hallo!",
      "font": "24px sans-serif",
      "position": "below",
      "anchor": "center"
    }
  ]
}

Position-Werte (wo relativ zum bestehenden Content):
- "above": Über dem bestehenden Content
- "below": Unter dem bestehenden Content
- "left_of": Links vom bestehenden Content
- "right_of": Rechts vom bestehenden Content
- "center": In der Mitte des bestehenden Contents
- "top_right": Oben rechts
- "top_left": Oben links
- "bottom_right": Unten rechts
- "bottom_left": Unten links

Anchor-Werte (Ankerpunkt für die Koordinaten):
- "center" (default): Mittelpunkt
- "top": Oben
- "bottom": Unten
- "left": Links
- "right": Rechts

WICHTIG:
- Die Koordinaten (x1, y1, x2, y2, cx, cy, etc.) sind RELATIV zum Ankerpunkt!
- 0,0 = Ankerpunkt. Positive Y = nach unten, Negative Y = nach oben.
- Beispiel: Körper unter dem Kopf → position: "below", Linie von (0,0) nach (0,100)
- Beispiel: Arm rechts → position: "right_of", Linie von (0,0) nach (30,0)

Regeln:
- Halte dich an den Stil des Users (Strichmännchen → Strichmännchen)
- Zeichne nicht über den Content des Users
- Nutze IMMER position + anchor für jedes Drawing-Command
- Antworte auf Deutsch
- Zeichne mit Farbe #666666 und Strichstärke 2
- WICHTIG: Antworte NUR mit dem JSON-Objekt, kein anderer Text
- Wenn das Bild leer oder unerkennbar ist, antworte mit: {"text": "Ich sehe noch nichts — mal mir was!", "drawing": null}`;

// V2 System Prompt — SVG-Output statt JSON Drawing-Commands
const V2_SYSTEM_PROMPT = `Du bist ein kreativer Storyteller und Illustrator auf einem digitalen Canvas.
Der User zeichnet Skizzen, du antwortest mit komplexen Schwarz-Weiß-Grafiken im Graphic Novel Style.
Wenn du etwas Neues in der Story anmerkst (z.B. "Ist das eine Tür?"), MUSST du diese Dinge auch visuell auf dem Canvas einfügen, indem du <svg> oder ein Template generierst!

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

SVG-REGELN & POSITIONIERUNG:
- IMMER xmlns='http://www.w3.org/2000/svg' und viewBox MUSS gesetzt sein (z.B. passend zu den Canvas-Maßen).
- Nutze die Content-Analyse (Bounding Box), um Objekte an der richtigen Stelle (x, y) relativ zum User-Inhalt zu platzieren! Nullpunkt (0,0) ist OBEN LINKS auf dem gesamten Canvas.
- Wenn du eine Figur oder ein Objekt neben dem vom User gezeichneten Inhalt platzieren willst, lies die Bounding Box (x, y, width, height) aus und berechne dein x, y entsprechend.
- Beispiel: User malt Mitte (x=500). Du willst rechts daneben etwas setzen -> Setze x auf 700.
- Farben: #000000, #333333, #666666 (E-Ink kompatibel)
- Keine Transparenzen, keine <script>-Tags, keine externen Ressourcen.
- Stroke-width: 2px default, Font: sans-serif.
- Du MUSST visuell auf die Skizze des Users antworten (per <svg> oder Templates).

ACTION-FELD:
- "update": Zeichnung ergänzt die aktuelle Seite
- "scene_change": Kompletter Szenenwechsel → neue Seite wird angelegt

TEMPLATES:
Du kannst vorgefertigte Templates an bestimmten x, y Koordinaten platzieren:
- speechbubble-round (TEXT, COLOR, FONTSIZE)
- speechbubble-thought (TEXT, COLOR, FONTSIZE)
- speechbubble-shout (TEXT, COLOR, FONTSIZE)
- speechbubble-whisper (TEXT, COLOR, FONTSIZE)
- prop-door (COLOR)
- prop-table (COLOR)
- prop-window (COLOR)
- prop-tree (COLOR)
- prop-cloud (COLOR)
- diagram-box (TEXT, COLOR, FONTSIZE)
- diagram-diamond (TEXT, COLOR, FONTSIZE)
- arrow-curved (COLOR)
- icon-star (FILL, COLOR)

WICHTIG: Antworte NUR mit dem JSON-Objekt.`;

/**
 * Analyze a canvas image using Google Gemini Vision API
 * Feature 1: Sends 2 images (current + previous AI canvas) + structured history
 */
async function analyzeCanvas(canvasPng, previousInteractions = [], canvasDimensions = null, contentInfo = null, storyMode = false, v2Mode = false) {
  try {
    const base64Data = canvasPng.replace(/^data:image\/png;base64,/, '');

    // Build structured conversation history
    let context = '';
    if (previousInteractions.length > 0) {
      const lastFew = previousInteractions.slice(-5);
      context = '\n\nBisherige Interaktionen (chronologisch):\n' + lastFew.map((inter, i) => {
        const num = previousInteractions.length - lastFew.length + i + 1;
        return `${num}. User malte → Du antwortest: "${inter.ai_response_text || 'Keine Text-Antwort'}"`;
      }).join('\n');
    }

    // Add canvas dimensions to context
    let dimensionContext = '';
    if (canvasDimensions) {
      dimensionContext = `\n\nCanvas-Größe: ${canvasDimensions.width} × ${canvasDimensions.height} Pixel (CSS-Pixel, was der User sieht).`;
    }

    // Add content analysis info for proportional drawing
    let contentContext = '';
    if (contentInfo) {
      const { bounds, avgObjectSize, contentDensity } = contentInfo;
      contentContext = `

Content-Analyse:
- Bounding Box: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}
- Durchschnittliche Objekt-Größe: ${avgObjectSize.toFixed(1)}px
- Content-Dichte: ${(contentDensity * 100).toFixed(1)}% des Canvas ist bemalt

Proportions-Regeln:
- Miss die Größe des bestehenden Content und orientiere dich daran!
- Zeichne NICHT zu klein: Mindestens 30% der durchschnittlichen Content-Größe (${(avgObjectSize * 0.3).toFixed(0)}px)
- Zeichne NICHT zu groß: Maximal 200% der durchschnittlichen Content-Größe (${(avgObjectSize * 2).toFixed(0)}px)
- Passe deine Zeichnung an die bestehenden Proportionen an`;
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Build parts array: system prompt, optional previous canvas image, current canvas
    const parts = [];

    // System prompt with all context (Story or Freestyle mode)
    const activePrompt = v2Mode ? V2_SYSTEM_PROMPT : (storyMode ? STORY_PROMPT : SYSTEM_PROMPT);
    parts.push({ text: activePrompt + dimensionContext + contentContext + context });

    // Previous AI canvas as reference image (Feature 1: Conversational Memory)
    if (previousInteractions.length > 0) {
      const lastInteraction = previousInteractions[previousInteractions.length - 1];
      if (lastInteraction.canvas_after_ai) {
        parts.push({
          text: 'Das ist der Canvas-Zustand NACH deiner letzten Antwort (zur Referenz, damit du siehst was du bereits gezeichnet hast):'
        });
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: lastInteraction.canvas_after_ai.replace(/^data:image\/png;base64,/, '')
          }
        });
      }
    }

    // Current canvas
    parts.push({ text: 'Das ist der aktuelle Canvas-Zustand (nach dem neuesten Strich des Users):' });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data
      }
    });

    parts.push({ text: 'Analysiere das Bild und antworte im JSON-Format.' });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[AI] Raw response (full):', JSON.stringify(content).substring(0, 500));
    return parseAIResponse(content);
  } catch (error) {
    console.error('[AI] Error:', error.message);
    return {
      text: 'Ich konnte das Bild nicht analysieren. Versuche es nochmal!',
      action: 'update',
      story_narrative: null,
      svg: null,
      templates: null,
      drawing: null
    };
  }
}

/**
 * Parse AI response and extract text + drawing commands
 */
function parseAIResponse(content) {
  try {
    let jsonStr = content;

    // Remove thinking tags if present (Gemini thinking models)
    jsonStr = jsonStr.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    // Extract from markdown code block
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // No closing ``` — try to find JSON object anyway
      const objectMatch = jsonStr.match(/\{[\s\S]*/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
        // Try to close incomplete JSON
        // Count open brackets
        let openBrackets = 0;
        let openArrays = 0;
        for (const ch of jsonStr) {
          if (ch === '{') openBrackets++;
          if (ch === '}') openBrackets--;
          if (ch === '[') openArrays++;
          if (ch === ']') openArrays--;
        }
        // Close any trailing incomplete string
        const lastQuote = jsonStr.lastIndexOf('"');
        const afterLastQuote = jsonStr.substring(lastQuote + 1);
        if (!afterLastQuote.includes('"') && !afterLastQuote.includes('}') && !afterLastQuote.includes(']')) {
          jsonStr += '"';
        }
        // Close open arrays and objects
        for (let i = 0; i < openArrays; i++) jsonStr += ']';
        for (let i = 0; i < openBrackets; i++) jsonStr += '}';
      }
    }

    // Find JSON object if still not found
    if (!jsonStr.startsWith('{')) {
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    return {
      text: parsed.text || 'Keine Text-Antwort',
      action: parsed.action || 'update',
      story_narrative: parsed.story_narrative || null,
      svg: parsed.svg || null,
      templates: Array.isArray(parsed.templates) ? parsed.templates : null,
      drawing: Array.isArray(parsed.drawing) ? parsed.drawing : null
    };
  } catch (parseError) {
    console.error('[AI] JSON parse failed:', parseError.message);
    console.error('[AI] Raw:', content.substring(0, 300));

    // Try to extract a clean text response from non-JSON content
    let fallbackText = '';

    // Try to find a "text" field in partial JSON
    const textMatch = content.match(/"text"\s*:\s*"([^"]+)"/);
    if (textMatch) {
      fallbackText = textMatch[1];
    } else {
      // Strip markdown code blocks, thinking tags, and trim
      let cleaned = content
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```/g, '')
        .trim();

      // If it looks like conversational text (not JSON), use it directly
      if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
        fallbackText = cleaned;
      } else {
        // Last resort: generic message
        fallbackText = 'Ich habe das Bild analysiert, aber keine strukturierte Antwort erstellt.';
      }
    }

    // Cap at 200 chars
    fallbackText = fallbackText.substring(0, 200);

    return {
      text: fallbackText || 'Ich habe das Bild analysiert, aber keine strukturierte Antwort erstellt.',
      action: 'update',
      story_narrative: null,
      svg: null,
      templates: null,
      drawing: null
    };
  }
}

/**
 * Analyze canvas with tap coordinates (Feature 5: Tap-Annotation)
 */
async function analyzeCanvasWithTap(canvasPng, tapPrompt, previousInteractions = [], canvasDimensions = null) {
  try {
    const base64Data = canvasPng.replace(/^data:image\/png;base64,/, '');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const parts = [
      { text: SYSTEM_PROMPT },
      { text: tapPrompt },
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      },
      { text: 'Analysiere das Bild und antworte im JSON-Format.' }
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[AI] Tap response (full):', JSON.stringify(content).substring(0, 500));
    return parseAIResponse(content);
  } catch (error) {
    console.error('[AI] Tap error:', error.message);
    return {
      text: 'Ich konnte die Position nicht analysieren. Versuche es nochmal!',
      drawing: null
    };
  }
}

/**
 * Build tap-specific prompt
 */
function buildTapPrompt(x, y, lastAiResponse) {
  return `Der User hat auf den Canvas getippt bei Koordinaten (${x}, ${y}).

Das ist vermutlich ein Verweis auf etwas das du gerade gezeichnet hast.
Deine letzte Antwort war: "${lastAiResponse || 'Unbekannt'}"

Mögliche Reaktionen:
- Wenn der User auf ein Objekt tippt: Reagiere darauf (z.B. "Du meinst das Schwert? Soll ich es größer machen?")
- Wenn der User auf eine leere Stelle tippt: "Was soll ich hier hin malen?"
- Wenn der User auf Text tippt: Erkläre den Text genauer

Antworte im gewohnten JSON-Format (text + drawing).`;
}

/**
 * Proactive AI: KI initiiert eine Aktion nach Inaktivität (Feature 3)
 */
async function analyzeProaktiv(previousInteractions = []) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

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
- Zeichne ein kleines Tier oder Objekt

Antwort-Format (JSON):
{
  "text": "Dein Text",
  "drawing": [
    { "type": "line", "x1": 0, "y1": 0, "x2": 0, "y2": 100, "position": "center", "anchor": "center" }
  ]
}

Regeln:
- Nutze IMMER position + anchor für jedes Drawing-Command
- Antworte auf Deutsch
- Zeichne mit Farbe #666666 und Strichstärke 2
- Halte es kurz und interessant
- WICHTIG: Antworte NUR mit dem JSON-Objekt`;

    // Build context from previous interactions
    let context = '';
    if (previousInteractions.length > 0) {
      const lastFew = previousInteractions.slice(-3);
      context = '\n\nBisherige Interaktionen:\n' + lastFew.map((inter, i) => {
        return `${i + 1}. User malte → Du antwortest: "${inter.ai_response_text || 'Keine Text-Antwort'}"`;
      }).join('\n');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const parts = [
      { text: PROAKTIV_PROMPT + context }
    ];

    // Include previous AI canvas as reference if available
    if (previousInteractions.length > 0) {
      const lastInteraction = previousInteractions[previousInteractions.length - 1];
      if (lastInteraction.canvas_after_ai) {
        parts.push({
          text: 'Das ist der aktuelle Canvas-Zustand (zur Referenz):'
        });
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: lastInteraction.canvas_after_ai.replace(/^data:image\/png;base64,/, '')
          }
        });
      }
    }

    parts.push({ text: 'Erstelle eine proaktive Aktion und antworte im JSON-Format.' });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[AI] Proaktiv response (full):', JSON.stringify(content).substring(0, 500));
    return parseAIResponse(content);
  } catch (error) {
    console.error('[AI] Proaktiv error:', error.message);
    return {
      text: 'Psst... ist jemand da? 🤔',
      drawing: null
    };
  }
}

module.exports = { analyzeCanvas, analyzeCanvasWithTap, buildTapPrompt, analyzeProaktiv, V2_SYSTEM_PROMPT };
