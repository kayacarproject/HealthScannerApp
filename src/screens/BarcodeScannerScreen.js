import React, {useRef, useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useIsFocused} from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import {fetchProductByBarcode} from '../services/openFoodFactsService';

const MOUNT_COOLDOWN_MS = 700;  // ignore scans for this long after screen gains focus
const STABILITY_HOLD_MS = 350;  // same barcode must be seen for this long before committing

export default function BarcodeScannerScreen({navigation}) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');

  const isFocused = useIsFocused();

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
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'fetching' | 'notfound' | 'error'
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
      if (product) {
        console.log('[BarcodeScannerScreen] Product found:', product.name);
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

  // ── useCodeScanner — v4 built-in barcode engine (no frame processor needed)
  const codeScanner = useCodeScanner({
    codeTypes: [
      'ean-13', 'ean-8', 'upc-a', 'upc-e',
      'code-128', 'code-39', 'qr',
    ],
    onCodeScanned: handleCodeScanned,
  });

  // ── Permission loading ─────────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={56} color={colors.textSecondary} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Allow camera access so the app can scan barcodes.
        </Text>
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          activeOpacity={0.8}
          onPress={() => Linking.openSettings()}>
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Open Settings</Text>
        </TouchableOpacity>
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
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanState === 'idle'}
        codeScanner={codeScanner}
      />

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

          {scanState === 'notfound' && (
            <View style={styles.statusBox}>
              <Ionicons name="search" size={20} color="#FBBF24" />
              <Text style={styles.statusText}>Product not found for{`\n`}{lastBarcode}</Text>
              <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
                <Text style={styles.scanAgainText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanState === 'error' && (
            <View style={styles.statusBox}>
              <Ionicons name="alert-circle" size={20} color="#F87171" />
              <Text style={styles.statusText}>Fetch failed — check logs</Text>
              <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
                <Text style={styles.scanAgainText}>Try Again</Text>
              </TouchableOpacity>
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
  permTitle: {
    fontSize: 18,
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
    marginBottom: 24,
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
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnText: {color: '#FFF', fontWeight: '600', fontSize: 15},
  btnTextSecondary: {color: colors.primary},

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


