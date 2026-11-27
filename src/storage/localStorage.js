import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  HEALTH_PROFILE: '@health_profile',
  SCAN_HISTORY:   '@scan_history',
};

// ── Health Profile ────────────────────────────────────────────────────────────
// Shape (all fields optional / backwards-compatible with older saves):
//   name         string
//   age          string   digits only, '' if unset
//   dietType     string   'Vegetarian' | 'Vegan' | 'Eggetarian' | 'Jain' | 'Any' | ''
//   focusTags    string[] 'Sugar' | 'BP' | 'Heart' | 'Weight' | 'Digestion' | 'General'
//   allergenTags string[] 'Nuts' | 'Dairy' | 'Gluten' | 'Soy' | 'Egg'
//   noAllergies  boolean  user confirmed they have none
//   allergies    string   free text: custom allergies / ingredients to avoid
//   notes        string
//   updatedAt    number   ms timestamp of the last save

export const DEFAULT_PROFILE = {
  name: '',
  age: '',
  dietType: '',
  focusTags: [],
  allergenTags: [],
  noAllergies: false,
  allergies: '',
  notes: '',
  updatedAt: null,
};

const str = v => (typeof v === 'string' ? v : '');
const strList = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

// Fill defaults and coerce types so older / partial saves never break the UI
export function normalizeHealthProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    name: str(p.name),
    age: str(p.age ?? '').replace(/\D/g, '').slice(0, 3),
    dietType: str(p.dietType),
    focusTags: strList(p.focusTags),
    allergenTags: strList(p.allergenTags),
    noAllergies: !!p.noAllergies,
    allergies: str(p.allergies),
    notes: str(p.notes),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : null,
  };
}

export async function saveHealthProfile(profile) {
  const clean = normalizeHealthProfile(profile);
  clean.name = clean.name.trim();
  clean.allergies = clean.allergies.trim();
  clean.notes = clean.notes.trim();
  // "No known allergies" and specific allergens are mutually exclusive
  if (clean.allergenTags.length || clean.allergies) clean.noAllergies = false;
  clean.updatedAt = Date.now();
  await AsyncStorage.setItem(KEYS.HEALTH_PROFILE, JSON.stringify(clean));
  return clean;
}

// Returns a normalised profile, or null if nothing has been saved yet
export async function loadHealthProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HEALTH_PROFILE);
    return raw ? normalizeHealthProfile(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

// Which core profile fields are still empty? Drives the Home quick-fill strip.
// Returns a subset of ['name', 'focus', 'allergies'].
export function getMissingProfileFields(profile) {
  const missing = [];
  if (!profile?.name?.trim()) missing.push('name');
  if (!profile?.focusTags?.length) missing.push('focus');
  const hasAllergyInfo =
    profile?.allergenTags?.length ||
    profile?.allergies?.trim() ||
    profile?.noAllergies;
  if (!hasAllergyInfo) missing.push('allergies');
  return missing;
}

// ── Scan History ──────────────────────────────────────────────────────────────
// Entry shape: the full product object passed to ResultScreen, plus
//   { id, scannedAt }. Newest first, deduplicated by id, capped at MAX_HISTORY.

const MAX_HISTORY = 100;

// Barcode scans dedupe by barcode; OCR scans by their normalised label text.
function scanId(product) {
  if (product.barcode) return `barcode:${product.barcode}`;
  const text = (product.ingredients || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `ocr:${text}`;
}

export async function saveScanToHistory(product) {
  if (!product) return;
  const id = scanId(product);
  const history = await loadScanHistory();
  // Keep an earlier image if this re-scan didn't produce one
  const previous = history.find(item => item.id === id);
  const imageUrl = product.imageUrl || previous?.imageUrl || null;
  const next = [
    {...product, imageUrl, id, scannedAt: Date.now()},
    ...history.filter(item => item.id !== id),
  ].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(next));
}

export async function loadScanHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SCAN_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Delete one scan. Accepts the entry's id, or its scannedAt timestamp for
// older entries saved before ids existed.
export async function deleteScanFromHistory(idOrTimestamp) {
  if (idOrTimestamp == null) return;
  const history = await loadScanHistory();
  const next = history.filter(
    item => item.id !== idOrTimestamp && item.scannedAt !== idOrTimestamp,
  );
  await AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(next));
}

export async function clearScanHistory() {
  await AsyncStorage.removeItem(KEYS.SCAN_HISTORY);
}

export async function loadRecentScans(limit = 5) {
  const history = await loadScanHistory();
  return history.slice(0, limit);
}

// Normalise a saved history entry into a display-safe shape so no valid scan
// renders blank. `product` is the raw item, passed untouched to ResultScreen.
export function normalizeScan(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const isOcr = !!item.isOcr || (!item.barcode && !!item.parsedIngredients);
  const ts = item.scannedAt ?? item.timestamp ?? item.date ?? null;
  const ingredients = typeof item.ingredients === 'string' ? item.ingredients.trim() : '';
  const count = item.parsedIngredients?.length;

  const parts = [];
  if (isOcr) {
    if (count) parts.push(`${count} ingredient${count !== 1 ? 's' : ''}`);
    if (item.ocr?.weight) parts.push(item.ocr.weight);
    if (item.ocr?.mrp) parts.push(`MRP ${item.ocr.mrp}`);
  } else {
    if (item.brand) parts.push(String(item.brand).split(',')[0].trim());
    if (item.sugars100g != null && !isNaN(Number(item.sugars100g))) {
      parts.push(`${Number(item.sugars100g).toFixed(1)} g sugar/100g`);
    }
    if (item.nutriscoreGrade) parts.push(`Nutri-Score ${String(item.nutriscoreGrade).toUpperCase()}`);
  }

  return {
    key: item.id ?? `${ts ?? 'scan'}-${index}`,
    title: item.name || item.title || (isOcr ? 'Scanned Ingredient Label' : 'Unnamed product'),
    source: isOcr ? 'OCR' : 'Barcode',
    meta: parts.join(' · '),
    snippet: ingredients || (item.barcode ? `Barcode ${item.barcode}` : ''),
    imageUrl: typeof item.imageUrl === 'string' && item.imageUrl ? item.imageUrl : null,
    timestamp: typeof ts === 'number' || typeof ts === 'string' ? ts : null,
    product: item,
  };
}
