// server/svgValidator.js — SVG-Sanitization (Script-Removal, viewBox-Check, Größenlimit)

/**
 * Validate and sanitize an SVG string.
 * Returns cleaned SVG or null if invalid.
 */
function validateSvg(svgString) {
  if (!svgString || typeof svgString !== 'string') return null;
  if (svgString.length > 100_000) return null;
  if (!svgString.trim().startsWith('<svg')) return null;

  // Remove <script> tags
  let cleaned = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove inline event handlers (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Ensure xmlns is present
  if (!cleaned.includes('xmlns=')) {
    cleaned = cleaned.replace('<svg', "<svg xmlns='http://www.w3.org/2000/svg'");
  }

  // Ensure viewBox is present
  if (!cleaned.includes('viewBox=')) {
    const widthMatch = cleaned.match(/width=['"](\d+)['"]/);
    const heightMatch = cleaned.match(/height=['"](\d+)['"]/);
    if (widthMatch && heightMatch) {
      cleaned = cleaned.replace('<svg', `<svg viewBox='0 0 ${widthMatch[1]} ${heightMatch[1]}'`);
    } else {
      cleaned = cleaned.replace('<svg', "<svg viewBox='0 0 400 300'");
    }
  }

  return cleaned;
}

module.exports = { validateSvg };
