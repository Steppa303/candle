// server/renderer.js — SVG → E-Ink PNG Pipeline
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

/**
 * Render SVG string → E-Ink-optimiertes PNG (Base64).
 *
 * Pipeline:
 * 1. SVG → PNG via resvg-js (vektor-scharf, kein Aliasing)
 * 2. E-Ink-Optimierung via sharp:
 *    - Konvertierung zu Graustufen
 *    - Dithering (Floyd-Steinberg) für 1-Bit-ähnliche Darstellung
 *    - Kontrastanpassung
 * 3. Rückgabe als Base64-PNG
 */
async function renderToEInkPNG(svgString, options = {}) {
  const {
    width = 1200,
    height = 1600,
    dither = true,
    grayscale = true,
    contrast = 1.2
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
      colours: 2,       // Schwarz/Weiß
      dither: 1.0       // Max Dithering
    });
  } else {
    pipeline = pipeline.png({ quality: 90 });
  }

  const finalBuffer = await pipeline.toBuffer();
  return finalBuffer.toString('base64');
}

/**
 * Compose: SVG + Templates → ein zusammengeführtes SVG.
 * Bettet Template-SVGs als <g>-Gruppen ins Haupt-SVG ein.
 */
function composeSvgWithTemplates(mainSvg, templates = [], canvasWidth = 1200, canvasHeight = 1600) {
  if (!templates || templates.length === 0) return mainSvg;

  let composed = mainSvg;

  for (const tmpl of templates) {
    if (!tmpl.svg) continue;
    const x = tmpl.x || 0;
    const y = tmpl.y || 0;
    // Strip outer <svg> tags, wrap inner content in <g> with transform
    const inner = tmpl.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
    const wrapped = `<g transform="translate(${x}, ${y})">${inner}</g>`;
    // Insert before closing </svg>
    composed = composed.replace('</svg>', wrapped + '</svg>');
  }

  return composed;
}

module.exports = { renderToEInkPNG, composeSvgWithTemplates };
