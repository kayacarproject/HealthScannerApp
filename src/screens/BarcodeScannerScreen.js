import React, {useRef, useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useIsFocused} from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import {fetchProductByBarcode} from '../services/openFoodFactsService';
import {saveScanToHistory} from '../storage/localStorage';
import useCameraRecovery from '../components/useCameraRecovery';
import CameraFailedView from '../components/CameraFailedView';

function PermPoint({icon, text}) {
  return (
    <View style={styles.permPointRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.permPointText}>{text}</Text>
    </View>
  );
}

// Barcode lookups that can't give us usable data fall back to the OCR screen
const FALLBACK_DELAY_MS = 1500; // time to read the message before auto-opening OCR
const FALLBACK_INFO = {
  notfound: {
    icon: 'search',
    color: '#FBBF24',
    message: 'Product not found in database — scan label with OCR',
  },
  incomplete: {
    icon: 'document-text',
    color: '#FBBF24',
    message: 'Ingredient details missing for this product — scan label with OCR',
  },
  error: {
    icon: 'cloud-offline',
    color: '#F87171',
    message: "Couldn't reach the product database — scan label with OCR",
  },
};

const MOUNT_COOLDOWN_MS = 700; // ignore scans for this long after screen gains focus
const STABILITY_HOLD_MS = 350;  // same barcode must be seen for this long before committing

export default function BarcodeScannerScreen({navigation}) {
  const device = useCameraDevice('back');

  const isFocused = useIsFocused();
  const {cameraKey, cameraFailed, onCameraError, retryCamera} = useCameraRecovery(isFocused);

  // ── Cooldown: block scans for MOUNT_COOLDOWN_MS after screen gains focus ──
  const readyRef = useRef(false);
  const cooldownTimer = useRef(null);

  useEffect(() => {
    if (isFocused) {
      readyRef.current = false;
      cooldownTimer.current = setTimeout(() => {
        readyRef.current = true;
      }, MOUNT_COOLDOWN_MS);
    } else {
      // Screen lost focus — clear timer and mark not-ready
      clearTimeout(cooldownTimer.current);
      readyRef.current = false;
    }
    return () => clearTimeout(cooldownTimer.current);
  }, [isFocused]);

  // ── Scan lock: prevents firing the API call on every frame ────────────────
  const isScanning = useRef(false);
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'fetching' | 'notfound' | 'incomplete' | 'error'
  const [lastBarcode, setLastBarcode] = useState(null);

  // ── Stability tracking: same value must persist for STABILITY_HOLD_MS ─────
  const candidateValue = useRef(null);   // barcode string being evaluated
  const candidateFirst = useRef(null);   // Date.now() when candidate was first seen

  const handleCodeScanned = useCallback(async codes => {
    // 1. Hard gates — cooldown not elapsed or scan already committed
    if (!readyRef.current) return;
    if (isScanning.current) return;

    const code = codes.find(c => c.value);
    if (!code?.value) {
      // No code in frame — reset candidate
      candidateValue.current = null;
      candidateFirst.current = null;
      return;
    }

    const value = code.value;
    const now = Date.now();

    // 2. Stability check — require the same value for STABILITY_HOLD_MS
    if (value !== candidateValue.current) {
      // New or different barcode — start fresh window
      candidateValue.current = value;
      candidateFirst.current = now;
      return;
    }

    // Same value seen before — check if hold time has elapsed
    if (now - candidateFirst.current < STABILITY_HOLD_MS) return;

    // 3. Commit — lock and call API
    isScanning.current = true;
    candidateValue.current = null;
    candidateFirst.current = null;

    const barcode = value;
    setLastBarcode(barcode);
    setScanState('fetching');

    console.log('[BarcodeScannerScreen] Stable barcode committed:', barcode, '| type:', code.type);

    try {
      const product = await fetchProductByBarcode(barcode);
      if (product && !product.ingredients?.trim()) {
        // Found, but nothing useful to evaluate — let OCR fill the gap
        console.log('[BarcodeScannerScreen] Incomplete product data for:', barcode);
        setScanState('incomplete');
      } else if (product) {
        console.log('[BarcodeScannerScreen] Product found:', product.name);
        saveScanToHistory(product).catch(() => {});
        navigation.navigate('Result', {product});
        isScanning.current = false;
        setScanState('idle');
      } else {
        console.log('[BarcodeScannerScreen] No product found for:', barcode);
        setScanState('notfound');
      }
    } catch (err) {
      console.error('[BarcodeScannerScreen] Fetch error:', err);
      setScanState('error');
    }
  }, [navigation]);

  // Reset so the user can scan again
  const resetScan = useCallback(() => {
    isScanning.current = false;
    candidateValue.current = null;
    candidateFirst.current = null;
    setLastBarcode(null);
    setScanState('idle');
  }, []);

  // ── Fallback: open OCR with the barcode + a notice ─────────────────────────
  const fallbackTimer = useRef(null);
  const leftForOcr = useRef(false);

  const openOcrFallback = useCallback(
    (barcode, state) => {
      clearTimeout(fallbackTimer.current);
      navigation.navigate('IngredientOcr', {
        barcode,
        notice: FALLBACK_INFO[state].message,
      });
      // Stop scanning (camera goes inactive) while we're away; the scanner is
      // reset when this screen regains focus.
      leftForOcr.current = true;
    },
    [navigation],
  );

  // Show the message briefly, then open OCR automatically
  useEffect(() => {
    if (!isFocused || !FALLBACK_INFO[scanState]) return undefined;
    fallbackTimer.current = setTimeout(
      () => openOcrFallback(lastBarcode, scanState),
      FALLBACK_DELAY_MS,
    );
    return () => clearTimeout(fallbackTimer.current);
  }, [isFocused, scanState, lastBarcode, openOcrFallback]);

  // Back from OCR: clear the fallback state so scanning is live again
  useEffect(() => {
    if (isFocused && leftForOcr.current) {
      leftForOcr.current = false;
      resetScan();
    }
  }, [isFocused, resetScan]);

  // ── useCodeScanner — v4 built-in barcode engine (no frame processor needed)
  const codeScanner = useCodeScanner({
    codeTypes: [
      'ean-13', 'ean-8', 'upc-a', 'upc-e',
      'code-128', 'code-39', 'qr',
    ],
    onCodeScanned: handleCodeScanned,
  });

  // ── Permission flow ────────────────────────────────────────────────────────
  // cameraGranted drives the switch from the pre-camera card to the live camera.
  const [cameraGranted, setCameraGranted] = useState(
    () => Camera.getCameraPermissionStatus() === 'granted',
  );
  const [permDenied, setPermDenied] = useState(false);

  // CTA: 'granted' opens the live camera immediately; 'denied' (including
  // Android suppressing the system dialog) shows a note and sends the user to
  // Settings. Once denied, the same CTA becomes "Open Settings".
  const handleScanPress = useCallback(async () => {
    if (permDenied) {
      Linking.openSettings();
      return;
    }
    const status = await Camera.requestCameraPermission();
    if (status === 'granted') {
      setPermDenied(false);
      setCameraGranted(true);
    } else {
      setPermDenied(true);
      Linking.openSettings();
    }
  }, [permDenied]);

  // Re-check when returning from Settings so the camera opens if enabled
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && Camera.getCameraPermissionStatus() === 'granted') {
        setPermDenied(false);
        setCameraGranted(true);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Pre-camera card: friendly text + single CTA ────────────────────────────
  if (!cameraGranted) {
    return (
      <View style={styles.centered}>
        <View style={styles.permCard}>
          <View style={styles.permIconCircle}>
            <Ionicons name="barcode-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.permTitle}>Scan a product barcode</Text>
          <Text style={styles.permBody}>
            Point your camera at a barcode and we'll look up the product's
            ingredients and sugar content to help you check its details.
          </Text>

          <View style={styles.permPoints}>
            <PermPoint icon="scan-outline" text="Scans happen live on your device" />
            <PermPoint icon="nutrition-outline" text="See sugar & ingredient details" />
            <PermPoint icon="lock-closed-outline" text="No photos are saved or uploaded" />
          </View>

          {permDenied && (
            <Text style={styles.permBlockedNote}>
              Camera access is off. Enable it in Settings to scan barcodes.
            </Text>
          )}

          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.8}
            onPress={handleScanPress}>
            <Ionicons
              name={permDenied ? 'settings-outline' : 'scan-outline'}
              size={18}
              color="#FFF"
            />
            <Text style={styles.btnText}>
              {permDenied ? 'Open Settings' : 'Scan a Barcode'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.permDisclaimer}>
            Informational only — not medical advice. Consult a healthcare
            professional for dietary decisions.
          </Text>
        </View>
      </View>
    );
  }

  // ── Camera device not ready ────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Starting camera…</Text>
      </View>
    );
  }

  // ── Live scanner ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Camera only exists while this tab is focused, and is active only when
          focused + permitted + idle — so it never competes with the OCR camera */}
      {cameraFailed ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraFailedView onRetry={retryCamera} />
        </View>
      ) : (
        isFocused && (
          <Camera
            key={cameraKey}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused && cameraGranted && scanState === 'idle'}
            codeScanner={codeScanner}
            androidPreviewViewType="texture-view"
            onError={onCameraError}
          />
        )
      )}

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        <View style={styles.topShade} />

        <View style={styles.middleRow}>
          <View style={styles.sideShade} />
          <View style={styles.scanWindow}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.sideShade} />
        </View>

        <View style={styles.bottomShade}>
          {scanState === 'idle' && (
            <Text style={styles.hintText}>Point at a product barcode</Text>
          )}

          {scanState === 'fetching' && (
            <View style={styles.statusBox}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.statusText}>Looking up {lastBarcode}…</Text>
            </View>
          )}

          {FALLBACK_INFO[scanState] && (
            <View style={styles.statusBox}>
              <Ionicons
                name={FALLBACK_INFO[scanState].icon}
                size={22}
                color={FALLBACK_INFO[scanState].color}
              />
              <Text style={styles.statusText}>{FALLBACK_INFO[scanState].message}</Text>
              <Text style={styles.statusSub}>
                {lastBarcode ? `Barcode ${lastBarcode} · ` : ''}opening label scanner…
              </Text>
              <View style={styles.fallbackBtns}>
                <TouchableOpacity
                  style={styles.ocrNowBtn}
                  onPress={() => openOcrFallback(lastBarcode, scanState)}>
                  <Ionicons name="scan-outline" size={16} color={colors.primary} />
                  <Text style={styles.ocrNowText}>Scan Label Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
                  <Text style={styles.scanAgainText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const WINDOW_SIZE = 240;
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const SHADE = 'rgba(0,0,0,0.55)';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},

  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  permIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  permPoints: {alignSelf: 'stretch', gap: 10, marginBottom: 20},
  permPointRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  permPointText: {fontSize: 13, color: colors.textPrimary, flexShrink: 1},
  permBlockedNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  permDisclaimer: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {color: '#FFF', fontWeight: '600', fontSize: 15},

  // ── Overlay
  overlay: {flex: 1},
  topShade: {flex: 1, backgroundColor: SHADE},
  middleRow: {flexDirection: 'row', height: WINDOW_SIZE},
  sideShade: {flex: 1, backgroundColor: SHADE},
  scanWindow: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    backgroundColor: 'transparent',
  },
  bottomShade: {
    flex: 1,
    backgroundColor: SHADE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hintText: {color: '#FFF', fontSize: 14, opacity: 0.85},
  statusBox: {alignItems: 'center', gap: 10},
  statusText: {color: '#FFF', fontSize: 14, textAlign: 'center'},
  statusSub: {color: '#FFF', fontSize: 12, opacity: 0.75, textAlign: 'center'},
  fallbackBtns: {flexDirection: 'row', gap: 10, marginTop: 2},
  ocrNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: radius.button,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  ocrNowText: {color: colors.primary, fontWeight: '700', fontSize: 14},
  scanAgainBtn: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#FFF',
    borderRadius: radius.button,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  scanAgainText: {color: '#FFF', fontWeight: '600', fontSize: 14},

  // ── Corner brackets
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#FFF',
  },
  cornerTL: {top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS},
  cornerTR: {top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS},
  cornerBL: {bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS},
  cornerBR: {bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS},
});


