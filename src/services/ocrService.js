import TextRecognition, {TextRecognitionScript} from '@react-native-ml-kit/text-recognition';

/**
 * Run on-device ML Kit OCR on a photo file path.
 * Returns the recognised text (one OCR line per text line), or null if nothing
 * was detected.
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

  // Keep one OCR line per text line: the label parser uses line structure to
  // find the product name, MRP, weight and nutrition rows.
  const joined = result.blocks
    .flatMap(block => block.lines.map(l => l.text.trim()))
    .filter(l => l.length > 1)
    .map(l => l.replace(/\s{2,}/g, ' '))
    .join('\n');

  console.log('[ocrService] Joined text:', joined);
  return joined || null;
}

// ── Label parser ──────────────────────────────────────────────────────────────

const URL_RE = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|in|org|net|co|io)\b\S*/gi;
const URL_TEST_RE = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|in|org|net|co|io)\b/i;
const LONG_DIGITS_RE = /\b\d{8,}\b/g; // barcodes, phone numbers, licence numbers

// Nutrient label words, tolerant of common OCR slips (Eneray, Enersy, Protien…)
const W_ENERGY = 'ene[rn][a-z]{1,2}|calor[a-z]*';
const W_PROTEIN = 'pr[o0]te[il1]n|protien|protin';
const W_CARBS = 'carb[a-z]*';
const W_SUGAR = 'su[gq]ars?';
const W_FAT = 'f[a4]t';
const W_FIBRE = 'fib(?:re|er)';
const W_SODIUM = 'sod[il1]um';
const NUTRI_WORD_RE = new RegExp(
  String.raw`\b(?:${W_ENERGY}|${W_PROTEIN}|${W_CARBS}|${W_SUGAR}|${W_FAT}|${W_FIBRE}|${W_SODIUM}|kcal|kj|cholesterol)\b`,
  'i',
);
// A bare nutrient label with nothing else ("Protein", "Total Fat", "Energy (kcal)")
const BARE_NUTRI_LABEL_RE = new RegExp(
  String.raw`^(?:total\s+|saturated\s+|trans\s+)?(?:${W_ENERGY}|${W_PROTEIN}|${W_CARBS}|${W_FAT}|${W_FIBRE}|${W_SODIUM}|cholesterol)s?(?:\s*\(?\s*(?:g|gm|mg|kcal|kj)\s*\)?)?$`,
  'i',
);
// Packaging / shelf-life / distributor boilerplate
const PACK_RE = /\b(?:best\s*before|packed(?:\s*on)?|packing|packaging|shelf\s*life|indiamart|distribut\w*|suppl(?:ier|ied)|address|gstin?|phone|tel|mob(?:ile)?|pin\s*code|sourced|date\s*of|mfg\s*date|consume|refrigerat\w*|dry\s*place|typical\s*values|average\s*values|rda|daily\s*value|approx\w*|contact|sold\s*by|imported)\b|\d+\s*months?\b|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/i;

// Lines / tokens that are label boilerplate, never ingredients
const BOILER_RE = /\b(?:mrp|m\.r\.p|batch|b\.?\s*no|lot\s*no|mfd|mfg|pkd|exp(?:iry)?|best\s*before|use\s*by|fssai|lic(?:ence|ense)?|customer\s*care|toll\s*free|net\s*(?:wt|weight|qty|quantity)|incl(?:usive)?\s*of|all\s*taxes|manufactured|marketed|packed|e-?mail|www|http|store\s*in|per\s*100|per\s*serving|nutrition|kcal|kj)\b/i;

const NUTRI_LINE_RE = NUTRI_WORD_RE;
// Nutrient words that can't be ingredients on their own (sugar / fat can)
const NUTRI_STRICT_RE = new RegExp(
  String.raw`\b(?:${W_ENERGY}|${W_PROTEIN}|${W_CARBS}|${W_FIBRE}|${W_SODIUM}|kcal|kj|cholesterol|(?:total|saturated|trans)\s+fat)\b`,
  'i',
);

// A nutrition-table row: nutrient word + a g / mg / kcal / kJ figure
// (a bare "Sugar" or "Sugar 20%" is an ingredient, not a table row)
const isNutriRow = l =>
  NUTRI_LINE_RE.test(l) && /\d(?:[.,]\d+)?\s*(?:g|gm|gms|mg|kcal|kj|cal)\b/i.test(l);

// Where an ingredients list starts / ends
const ING_HEAD_RE = /\bingredients?\b\s*[:\-–—.]?\s*/i;
const ING_END_RE = new RegExp(
  String.raw`\b(?:contains\s+(?:added|permitted|natural|artificial|nature|no)\b|allergen|may\s+contain|nutri[a-z]*|typical\s+values|per\s*100\s*(?:g|gm|ml)|manufactured|marketed|mfd|mfg|best\s*before|packed|packaging|shelf\s*life|distribut\w*|indiamart|use\s*by|expiry|exp\.?\s*date|batch|b\.?\s*no|fssai|customer\s*care|net\s*(?:wt|weight|qty|quantity)|mrp|store\s+in|storage|address|consume\s+within|barcode)\b|\b(?:${W_ENERGY}|${W_PROTEIN}|${W_CARBS}|total\s+fat|saturated\s+fat|${W_SODIUM})\b\D{0,15}\d|www\.|https?:`,
  'i',
);

const MRP_RE = /\bm\.?\s?r\.?\s?p\.?\b\s*[:-]?\s*(?:rs\.?|₹|inr|\?)?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i;
const PRICE_RE = /(?:₹|\brs\.?|\binr\b)\s*[:-]?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i;

const WT_UNIT = '(kg|gms?|g|ml|ltr|litres?|liters?|l)';
const NET_RE = new RegExp(
  `(?:net\\s*(?:wt|weight|qty|quantity|content)s?|\\bwt|weight|\\bqty|quantity)\\.?\\s*[:.\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*${WT_UNIT}\\b`,
  'i',
);
const PLAIN_WT_RE = new RegExp(`(?:^|[^\\d.])(\\d+(?:\\.\\d+)?)\\s*${WT_UNIT}\\b`, 'i');
const PLAIN_WT_G_RE = new RegExp(`(?:^|[^\\d.])(\\d+(?:\\.\\d+)?)\\s*${WT_UNIT}\\b`, 'gi');

const NAME_STOP_RE = /\b(?:ingredients?|nutrition|manufactured|marketed|packed|mfd|mfg|exp|best\s*before|use\s*by|batch|lot|fssai|lic|customer|care|toll|email|address|net|wt|weight|qty|quantity|per\s*100|serving|incl|inclusive|taxes|tax|veg|non[-\s]?veg|www|contains|allergen|store|keep|date|pin|india|made)\b/i;

function fmtNum(n) {
  return String(parseFloat(Number(n).toFixed(2)));
}

function normUnit(u) {
  const x = u.toLowerCase();
  if (x === 'kg') return 'kg';
  if (x === 'ml') return 'ml';
  if (x === 'g' || x === 'gm' || x === 'gms') return 'g';
  return 'L'; // l / ltr / litre(s) / liter(s)
}

function detectMrp(text) {
  const m = MRP_RE.exec(text) || PRICE_RE.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return isNaN(n) ? null : `₹${fmtNum(n)}`;
}

function detectWeight(text, outsideLines) {
  let m = NET_RE.exec(text);
  if (!m) {
    // Plain "250Gm" on a line that isn't a nutrition / serving row
    for (const line of outsideLines) {
      if (isNutriRow(line) || /per\s*(?:100|serving)/i.test(line)) continue;
      m = PLAIN_WT_RE.exec(line);
      if (m) break;
    }
  }
  if (!m) return null;
  return `${fmtNum(m[1])} ${normUnit(m[2])}`;
}

// Strip price / weight / codes / URLs from a line so only a possible name remains
function cleanNameLine(line) {
  let t = line
    .replace(URL_RE, ' ')
    .replace(NET_RE, ' ')
    .replace(MRP_RE, ' ')
    .replace(PRICE_RE, ' ')
    .replace(PLAIN_WT_G_RE, ' ')
    .replace(LONG_DIGITS_RE, ' ')
    .replace(/\((?:[^)]*(?:incl|tax)[^)]*)\)/gi, ' ')
    .replace(/[^A-Za-z0-9&'’\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^[-\s]+|[-\s]+$/g, '');
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters < 3 || t.length > 50) return null;
  if (letters / t.length < 0.6) return null;
  if (NAME_STOP_RE.test(t) || BOILER_RE.test(t)) return null;
  return t;
}

function detectProductName(head) {
  const lines = head.split('\n').map(l => l.trim()).filter(Boolean);
  const usable = l => !isNutriRow(l);
  const mrpIdx = lines.findIndex(l => MRP_RE.test(l));

  // 1. the line right after MRP
  if (mrpIdx >= 0 && lines[mrpIdx + 1] && usable(lines[mrpIdx + 1])) {
    const c = cleanNameLine(lines[mrpIdx + 1]);
    if (c) return c;
  }
  // 2. the first line that looks like a product title
  for (let i = 0; i < lines.length; i++) {
    if (i === mrpIdx || !usable(lines[i])) continue;
    const c = cleanNameLine(lines[i]);
    if (c) return c;
  }
  // 3. whatever is left on the MRP line ("MRP 50.0 Parle G 250Gm")
  if (mrpIdx >= 0) return cleanNameLine(lines[mrpIdx]);
  return null;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────
// Read from text that is NOT the ingredients list. Every nutrient label is
// located first (typo tolerant), then its value is read from the text between
// that label and the next one — so a missing value never steals its neighbour's.

const NUTRIENT_KEYS = ['energy', 'protein', 'carbs', 'sugar', 'fat', 'fibre', 'sodium'];
const NUTRIENT_META = {
  energy: {label: 'Energy', unit: 'kcal'},
  protein: {label: 'Protein', unit: 'g'},
  carbs: {label: 'Carbs', unit: 'g'},
  sugar: {label: 'Sugar', unit: 'g'},
  fat: {label: 'Fat', unit: 'g'},
  fibre: {label: 'Fibre', unit: 'g'},
  sodium: {label: 'Sodium', unit: 'mg'},
};
const NUTRIENT_LABEL_RE = new RegExp(
  String.raw`\b(?:(${W_ENERGY})|(${W_PROTEIN})|(${W_CARBS})|(${W_SUGAR})|(${W_FAT})|(${W_FIBRE})|(${W_SODIUM}))\b`,
  'gi',
);
const NUTRIENT_VALUE_RE = /(\d+(?:[.,]\d+)?)\s*(kcal|kj|cal|gms?|mg|g)?\b/i;
const QUALIFIER_BEFORE_RE = /(?:saturated|trans|mono\w*|poly\w*|added|of\s+which)\s*$/i;

function detectNutrition(outside) {
  // Normalise OCR noise: "per 100 g" must never be read as a value, and a
  // letter O before a unit is a zero ("Og" → "0 g").
  const t = outside
    .replace(/per\s*100\s*(?:g|gm|gms|ml)/gi, ' ')
    .replace(/\b100\s*(?:g|gm|gms|ml)\b/gi, ' ')
    .replace(/per\s*serv\w*/gi, ' ')
    .replace(/\b[Oo]\s*(?=(?:g|gm|gms|mg)\b)/g, '0 ');

  // 1. Locate every nutrient label
  const hits = [];
  NUTRIENT_LABEL_RE.lastIndex = 0;
  let m = NUTRIENT_LABEL_RE.exec(t);
  while (m) {
    const idx = m.slice(1).findIndex(Boolean);
    hits.push({key: NUTRIENT_KEYS[idx], start: m.index, end: m.index + m[0].length});
    m = NUTRIENT_LABEL_RE.exec(t);
  }

  // 2. Read the first number after each label (up to the next label)
  const found = {};
  hits.forEach((h, i) => {
    if (found[h.key]) return;
    // "Saturated Fat", "Added Sugars" etc. are different nutrients
    if (
      (h.key === 'fat' || h.key === 'sugar') &&
      QUALIFIER_BEFORE_RE.test(t.slice(Math.max(0, h.start - 14), h.start))
    ) {
      return;
    }
    const limit = Math.min(h.end + 30, hits[i + 1] ? hits[i + 1].start : t.length);
    const v = NUTRIENT_VALUE_RE.exec(t.slice(h.end, limit));
    if (!v) return;
    found[h.key] = {raw: parseFloat(v[1].replace(',', '.')), unit: (v[2] || '').toLowerCase()};
  });

  // Energy: an explicit kcal figure anywhere beats a kJ figure
  const kcal = /(\d+(?:[.,]\d+)?)\s*kcal/i.exec(t);
  if (kcal) {
    found.energy = {raw: parseFloat(kcal[1].replace(',', '.')), unit: 'kcal'};
  }

  const out = [];
  NUTRIENT_KEYS.forEach(key => {
    const f = found[key];
    if (!f || isNaN(f.raw)) return;
    const meta = NUTRIENT_META[key];
    if (key === 'energy') {
      if (f.raw > 5000) return;
      out.push({key, label: meta.label, value: fmtNum(f.raw), unit: f.unit === 'kj' ? 'kJ' : 'kcal'});
      return;
    }
    if (f.raw > 1000) return; // OCR noise
    let unit = meta.unit;
    if (f.unit === 'mg') unit = 'mg';
    else if (f.unit === 'g' || f.unit === 'gm' || f.unit === 'gms') unit = 'g';
    out.push({key, label: meta.label, value: fmtNum(f.raw), unit});
  });

  const basis = /per\s*100\s*(g|gm|gms|ml)/i.exec(outside);
  return {
    items: out,
    basis: basis ? `100 ${basis[1].toLowerCase() === 'ml' ? 'ml' : 'g'}` : null,
  };
}

// ── Ingredient splitting ──────────────────────────────────────────────────────

/** Split on , ; • | that are not inside ( ) [ ] { }. */
function splitRespectingParens(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (depth === 0 && (ch === ',' || ch === ';' || ch === '•' || ch === '·' || ch === '|')) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (depth > 0) {
    // Unclosed bracket (common OCR slip): don't swallow the rest of the list
    current.split(',').forEach(p => parts.push(p));
  } else if (current.trim()) {
    parts.push(current);
  }
  return parts;
}

// Looks like OCR garbage rather than an ingredient?
function looksGarbled(t) {
  const odd = (t.match(/[^A-Za-z0-9\s()%.,&'/-]/g) || []).length;
  if (odd / t.length > 0.12) return true;
  const words = t.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  if (!words.length) return true;
  const letterCount = w => w.replace(/[^A-Za-z]/g, '').length;
  // mostly single-letter fragments ("a k s l")
  if (words.length > 1 && words.filter(w => letterCount(w) === 1).length / words.length > 0.5) {
    return true;
  }
  // long words with no vowels / long consonant runs
  return words.some(w => {
    const a = w.replace(/[^A-Za-z]/g, '');
    return (a.length >= 4 && !/[aeiouy]/i.test(a)) || /[^aeiouy\W\d_]{6,}/i.test(a);
  });
}

const E_NUMBER_RE = /^(?:E|INS)\s?\d{3,4}[a-z]?$/i;

function cleanIngredient(token) {
  // A sentence break ("Salt. Best consumed…") ends the ingredient
  const t = token
    .split(/\.\s+(?=[A-Z])/)[0]
    .replace(URL_RE, ' ')
    .replace(LONG_DIGITS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—•*·.:\s]+/, '')
    .replace(/[;:.\s]+$/, '')
    .replace(/^ingredients?\b\s*[:-]?\s*/i, '')
    .trim();

  if (t.length < 2 || t.length > 100) return null;

  // Not ingredients: price / batch / packaging / shelf-life / distributor text,
  // nutrition labels and values ("Protein", "Energy 450", "Carbohydrate 45 g")
  if (BOILER_RE.test(t) || PACK_RE.test(t)) return null;
  if (BARE_NUTRI_LABEL_RE.test(t) || isNutriRow(t)) return null;
  if (NUTRI_WORD_RE.test(t) && /\d/.test(t) && !/%/.test(t)) return null;

  if (!E_NUMBER_RE.test(t)) {
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    if (letters < 2 || letters / t.length < 0.5) return null;
    if (looksGarbled(t)) return null;
  }

  // Quantity / percentage attached to the ingredient — e.g. "87%", "200mg"
  const qm =
    t.match(/(\d+(?:\.\d+)?)\s*%/) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:mg|mcg|ml|g)\b/i);
  const quantity = qm ? qm[0].replace(/\s+/g, '') : null;

  let name = t;
  if (qm) {
    name = name.replace(qm[0], '');
    name = name.replace(/\(\s*(?:min\.?|max\.?|approx\.?|about)?\s*\)/gi, '');
  }
  name = name
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,\-–]+$/, '')
    .trim();

  if (name.length < 2 || !/[A-Za-z0-9]/.test(name)) return null;
  return {name, quantity};
}

function extractIngredients(tokensText) {
  const seen = new Set();
  return splitRespectingParens(tokensText)
    .map(cleanIngredient)
    .filter(item => {
      if (!item) return false;
      const k = item.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// Lines wrap on a label; they only separate items when the list has no
// commas / semicolons at all (one ingredient per line).
function joinSection(section) {
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
  const hasDelims = /[,;•·|]/.test(section);
  return lines.join(hasDelims ? ' ' : ' , ');
}

/**
 * Parse raw OCR text of a product label into structured data.
 *
 * @param {string} raw
 * @returns {{
 *   productName: string|null,
 *   mrp: string|null,          // e.g. "₹50"
 *   weight: string|null,       // e.g. "250 g"
 *   ingredients: Array<{name: string, quantity: string|null}>,
 *   ingredientsFound: boolean, // true when an "Ingredients" heading was found
 *   nutrition: Array<{key: string, label: string, value: string, unit: string}>,
 *   nutritionBasis: string|null,
 * }}
 */
export function parseOcrLabel(raw) {
  const empty = {
    productName: null,
    mrp: null,
    weight: null,
    ingredients: [],
    ingredientsFound: false,
    nutrition: [],
    nutritionBasis: null,
  };
  if (!raw || !raw.trim()) return empty;

  const text = raw.replace(/\r/g, '\n');
  const heading = ING_HEAD_RE.exec(text);

  let headText; // text before the ingredients heading
  let section = ''; // the ingredients list
  let outside; // everything that is not the ingredients list
  if (heading) {
    headText = text.slice(0, heading.index);
    const rest = text.slice(heading.index + heading[0].length);
    const end = ING_END_RE.exec(rest);
    section = end ? rest.slice(0, end.index) : rest;
    outside = `${headText}\n${rest.slice(section.length)}`;
  } else {
    headText = text;
    outside = text;
  }

  const outsideLines = outside.split('\n').map(l => l.trim()).filter(Boolean);
  const mrp = detectMrp(outside);
  const weight = detectWeight(outside, outsideLines);
  const productName = detectProductName(headText);
  const {items: nutrition, basis: nutritionBasis} = detectNutrition(outside);

  let ingredients;
  if (heading) {
    ingredients = extractIngredients(joinSection(section));
  } else {
    // No heading: best guess from lines that aren't price / weight / name / nutrition
    const guess = outsideLines.filter(
      l =>
        !BOILER_RE.test(l) &&
        !PACK_RE.test(l) &&
        !isNutriRow(l) &&
        !BARE_NUTRI_LABEL_RE.test(l) &&
        !NUTRI_STRICT_RE.test(l) &&
        !/^[\d\s.,%()/-]*(?:g|gm|gms|mg|kcal|kj)?[\d\s.,%()/-]*$/i.test(l) &&
        !URL_TEST_RE.test(l) &&
        !(productName && l.toLowerCase().includes(productName.toLowerCase())),
    );
    ingredients = extractIngredients(joinSection(guess.join('\n')));
  }

  return {
    productName,
    mrp,
    weight,
    ingredients,
    ingredientsFound: !!heading,
    nutrition,
    nutritionBasis,
  };
}

/**
 * Back-compat helper: just the ingredient items.
 * @param {string} raw
 * @returns {Array<{name: string, quantity: string|null}>}
 */
export function parseIngredients(raw) {
  return parseOcrLabel(raw).ingredients;
}
