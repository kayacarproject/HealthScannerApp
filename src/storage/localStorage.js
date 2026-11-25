import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  HEALTH_PROFILE: '@health_profile',
  SCAN_HISTORY:   '@scan_history',
};

// ── Health Profile ────────────────────────────────────────────────────────────
// Shape: { name, focusTags: string[], allergies, notes }

export async function saveHealthProfile(profile) {
  await AsyncStorage.setItem(KEYS.HEALTH_PROFILE, JSON.stringify(profile));
}

export async function loadHealthProfile() {
  const raw = await AsyncStorage.getItem(KEYS.HEALTH_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

// ── Scan History ──────────────────────────────────────────────────────────────
// Stub — will be fully implemented in the History step.

export async function saveScanToHistory(product) {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_HISTORY);
  const history = raw ? JSON.parse(raw) : [];
  history.unshift({...product, scannedAt: Date.now()});
  await AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(history.slice(0, 100)));
}

export async function loadScanHistory() {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_HISTORY);
  return raw ? JSON.parse(raw) : [];
}
