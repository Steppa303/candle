/**
 * Template library for pre-built SVG shapes.
 * Templates are referenced by name in AI prompts.
 */

const TEMPLATES = {
  // --- Speech Bubbles ---
  'speechbubble-round': {
    viewBox: '0 0 200 120',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
      <rect x="10" y="10" width="180" height="80" rx="20" ry="20"
            fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <polygon points="60,90 80,90 50,115" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="100" y="55" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'speechbubble-thought': {
    viewBox: '0 0 200 130',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130">
      <ellipse cx="100" cy="50" rx="90" ry="40" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <circle cx="60" cy="100" r="8" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <circle cx="45" cy="115" r="5" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="100" y="55" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'speechbubble-shout': {
    viewBox: '0 0 220 130',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130">
      <polygon points="110,5 140,25 210,15 180,50 215,75 150,70 130,100 110,75 90,100 70,70 5,75 40,50 10,15 80,25"
               fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="110" y="60" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'speechbubble-whisper': {
    viewBox: '0 0 200 120',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
      <rect x="10" y="10" width="180" height="80" rx="20" ry="20"
            fill="white" stroke="{{COLOR}}" stroke-width="2" stroke-dasharray="5,5"/>
      <polygon points="60,90 80,90 50,115" fill="white" stroke="{{COLOR}}" stroke-width="2" stroke-dasharray="5,5"/>
      <text x="100" y="55" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif" font-style="italic">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  // --- Story Props (Requisiten) ---
  'prop-door': {
    viewBox: '0 0 100 200',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
      <rect x="10" y="10" width="80" height="180" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
      <rect x="20" y="20" width="60" height="70" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <rect x="20" y="100" width="60" height="80" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <circle cx="80" cy="110" r="5" fill="{{COLOR}}"/>
    </svg>`,
    params: ['COLOR']
  },

  'prop-table': {
    viewBox: '0 0 200 100',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <rect x="10" y="20" width="180" height="15" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
      <rect x="25" y="35" width="10" height="60" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
      <rect x="165" y="35" width="10" height="60" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
    </svg>`,
    params: ['COLOR']
  },

  'prop-window': {
    viewBox: '0 0 120 160',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
      <rect x="10" y="10" width="100" height="140" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
      <line x1="10" y1="80" x2="110" y2="80" stroke="{{COLOR}}" stroke-width="3"/>
      <line x1="60" y1="10" x2="60" y2="150" stroke="{{COLOR}}" stroke-width="3"/>
      <rect x="5" y="150" width="110" height="10" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
    </svg>`,
    params: ['COLOR']
  },

  'prop-tree': {
    viewBox: '0 0 150 200',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 200">
      <rect x="65" y="120" width="20" height="80" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
      <path d="M 75 10 C 20 10 10 70 40 100 C 10 120 30 160 75 150 C 120 160 140 120 110 100 C 140 70 130 10 75 10 Z" fill="white" stroke="{{COLOR}}" stroke-width="3"/>
    </svg>`,
    params: ['COLOR']
  },

  'prop-cloud': {
    viewBox: '0 0 150 100',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100">
      <path d="M 40 80 A 25 25 0 0 1 40 30 A 35 35 0 0 1 110 30 A 25 25 0 0 1 110 80 Z" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
    </svg>`,
    params: ['COLOR']
  },

  // --- Diagram & Other ---
  'diagram-box': {
    viewBox: '0 0 160 60',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60">
      <rect x="5" y="5" width="150" height="50" rx="4" ry="4"
            fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="80" y="35" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'diagram-diamond': {
    viewBox: '0 0 120 120',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <polygon points="60,5 115,60 60,115 5,60" fill="white" stroke="{{COLOR}}" stroke-width="2"/>
      <text x="60" y="65" text-anchor="middle" font-size="{{FONTSIZE}}" fill="{{COLOR}}" font-family="sans-serif">
        {{TEXT}}
      </text>
    </svg>`,
    params: ['TEXT', 'COLOR', 'FONTSIZE']
  },

  'icon-star': {
    viewBox: '0 0 40 40',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <polygon points="20,2 25,15 39,15 28,24 32,38 20,30 8,38 12,24 1,15 15,15"
               fill="{{FILL}}" stroke="{{COLOR}}" stroke-width="1"/>
    </svg>`,
    params: ['FILL', 'COLOR']
  },

  'arrow-curved': {
    viewBox: '0 0 200 60',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
      <path d="M 10,50 Q 100,10 190,50" fill="none" stroke="{{COLOR}}" stroke-width="2"/>
      <polygon points="190,50 180,40 185,50 180,60" fill="{{COLOR}}"/>
    </svg>`,
    params: ['COLOR']
  }
};

/**
 * Render a template with given parameters.
 * Returns SVG string or null if template not found.
 */
function renderTemplate(name, params = {}) {
  const template = TEMPLATES[name];
  if (!template) return null;

  let svg = template.svg;

  // Replace placeholders based on params provided
  for (const [key, value] of Object.entries(params)) {
    svg = svg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Set defaults for unreplaced placeholders
  svg = svg.replace(/\{\{TEXT\}\}/g, '');
  svg = svg.replace(/\{\{COLOR\}\}/g, '#333333');
  svg = svg.replace(/\{\{FONTSIZE\}\}/g, '18');
  svg = svg.replace(/\{\{FILL\}\}/g, 'white');

  return svg;
}

/**
 * Get list of available template names.
 */
function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

/**
 * Get template info (name + description) for AI prompt.
 */
function getTemplateDescriptions() {
  return Object.entries(TEMPLATES).map(([name, tmpl]) => ({
    name,
    viewBox: tmpl.viewBox,
    params: tmpl.params
  }));
}

module.exports = { renderTemplate, getTemplateNames, getTemplateDescriptions, TEMPLATES };
