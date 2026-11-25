import TextRecognition, {TextRecognitionScript} from '@react-native-ml-kit/text-recognition';

/**
 * Run on-device ML Kit OCR on a photo file path.
 * Returns the raw joined text string, or null if nothing detected.
 *
 * @param {string} photoPath  - absolute file path from vision-camera takePhoto()
 * @returns {Promise<string|null>}
 */
export async function recogniseIngredients(photoPath) {
  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
  console.log('[ocrService] Running OCR on:', uri);

  const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
  console.log('[ocrService] Raw OCR text:', result.text);

  if (!result.text || result.text.trim().length === 0) return null;

  // Join all lines into one continuous string, preserving commas that are
  // already present so parseIngredients() can split on them correctly.
  const joined = result.blocks
    .flatMap(block => block.lines.map(l => l.text.trim()))
    .filter(l => l.length > 1)
    .map(l => l.replace(/\s{2,}/g, ' '))
    .join(' ');

  console.log('[ocrService] Joined text:', joined);
  return joined || null;
}

/**
 * Parse a raw ingredients string into structured items.
 *
 * Strategy:
 *  - Split on commas that are NOT inside parentheses  (handles "Wheat (87%), Sugar")
 *  - For each token, extract a trailing quantity/percentage if present
 *  - Drop tokens that are too short or pure punctuation
 *
 * @param {string} raw  - comma-separated ingredients string
 * @returns {Array<{name: string, quantity: string|null}>}
 */
export function parseIngredients(raw) {
  if (!raw || !raw.trim()) return [];

  // Split on commas that have zero open parentheses before them
  const tokens = splitRespectingParens(raw);

  return tokens
    .map(token => {
      let t = token
        .trim()
        // Remove leading bullets / dashes / asterisks
        .replace(/^[\-•*·]+\s*/, '')
        // Collapse internal whitespace
        .replace(/\s{2,}/g, ' ')
        // Remove trailing punctuation except ) % and digits
        .replace(/[;:.]+$/, '')
        .trim();

      if (t.length < 2) return null;

      // Extract quantity: a number (with optional decimal) followed by % or g/mg/ml
      // e.g. "87%", "1.5%", "200mg"  — may appear anywhere in the token
      const qtyMatch = t.match(/([\d.]+\s*(?:%|mg|ml|g|mcg))/);
      const quantity = qtyMatch ? qtyMatch[1].replace(/\s+/, '') : null;

      // Clean the name: remove the extracted quantity from the display name
      // but keep parenthetical sub-ingredient lists intact
      let name = t;
      if (quantity) {
        // Remove standalone quantity that isn't part of a word
        name = name.replace(new RegExp(`\\s*\\(?\\s*${escapeRegex(quantity)}\\s*\\)?`), '').trim();
      }
      // Final cleanup of empty parens
      name = name.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

      if (name.length < 2) return null;
      return {name, quantity};
    })
    .filter(Boolean);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split a string on commas that are not inside parentheses. */
function splitRespectingParens(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
