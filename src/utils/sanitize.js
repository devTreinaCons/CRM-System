/**
 * Sanitizes a string to prevent Cross-Site Scripting (XSS) when injecting into HTML.
 * Escapes special characters <, >, &, ", and '.
 * 
 * @param {string} str - The string to sanitize.
 * @returns {string} The sanitized string safe for innerHTML.
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) {
    return '';
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
