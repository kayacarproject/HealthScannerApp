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
} from 'react-native-vision-camera';
import {useIsFocused, useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import {recogniseIngredients, parseOcrLabel} from '../services/ocrService';
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

// screen states
// 'camera'   → live preview, ready to capture
// 'ocr'      → photo taken, OCR running
// 'empty'    → OCR returned nothing
// 'error'    → OCR threw

// Shown when we arrive from a failed barcode lookup
function NoticeBanner({text, barcode, style}) {
  if (!text) return null;
  return (
    <View style={[styles.notice, style]}>
      <Ionicons name="information-circle" size={20} color={colors.primary} />
      <View style={styles.noticeTextWrap}>
        <Text style={styles.noticeText}>{text}</Text>
        {barcode ? <Text style={styles.noticeSub}>Barcode {barcode}</Text> : null}
      </View>
    </View>
  );
}

export default function IngredientOcrScreen({navigation, route}) {
  // Passed by BarcodeScannerScreen's auto-fallback
  const fallbackBarcode = route?.params?.barcode ?? null;
  const notice = route?.params?.notice ?? null;

  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const isFocused = useIsFocused();
  const {cameraKey, cameraFailed, onCameraError, retryCamera} = useCameraRecovery(isFocused);
  const insets = useSafeAreaInsets();

  const [screenState, setScreenState] = useState('camera');
  const [flash, setFlash] = useState('off');          // 'off' | 'on'
  const [capturing, setCapturing] = useState(false);

  // ── Capture → OCR → straight to ResultScreen ───────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        flash,
        enableShutterSound: false,
      });
      const imageUri = `file://${photo.path}`;

      setScreenState('ocr');
      setCapturing(false);

      const text = await recogniseIngredients(photo.path);
      const trimmed = text ? text.trim() : '';

      if (!trimmed) {
        setScreenState('empty');
        return;
      }

      const parsed = parseOcrLabel(trimmed);
      const product = {
        name: parsed.productName || 'Scanned Ingredient Label',
        ingredients: trimmed,
        parsedIngredients: parsed.ingredients,
        ocr: {
          productName: parsed.productName,
          mrp: parsed.mrp,
          weight: parsed.weight,
          nutrition: parsed.nutrition,
          nutritionBasis: parsed.nutritionBasis,
          ingredientsFound: parsed.ingredientsFound,
        },
        isOcr: true,
        barcode: fallbackBarcode,
        brand: null,
        sugars100g: null,
        energy100g: null,
        nutriscoreGrade: null,
        allergens: null,
        imageUrl: imageUri, // captured label photo (local file)
      };

      saveScanToHistory(product).catch(() => {});
      navigation.navigate('Result', {product});

      // Back on this tab (after Result) the live camera is ready again
      setScreenState('camera');
    } catch (err) {
      console.error('[IngredientOcrScreen] Capture/OCR error:', err);
      setCapturing(false);
      setScreenState('error');
    }
  }, [capturing, flash, navigation, fallbackBarcode]);

  // Clear the fallback params when leaving, so a later visit starts clean
  useFocusEffect(
    useCallback(
      () => () => navigation.setParams({barcode: undefined, notice: undefined}),
      [navigation],
    ),
  );

  const resetToCamera = useCallback(() => {
    setScreenState('camera');
  }, []);

  // ── Permission flow ────────────────────────────────────────────────────────
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
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active' && Camera.getCameraPermissionStatus() === 'granted') {
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
          <NoticeBanner text={notice} barcode={fallbackBarcode} style={styles.noticeInCard} />
          <View style={styles.permIconCircle}>
            <Ionicons name="document-text-outline" size={42} color={colors.primary} />
          </View>
          <Text style={styles.permTitle}>Scan an ingredients label</Text>
          <Text style={styles.permBody}>
            Take a photo of the ingredients list and we'll read it for you,
            then break it down into a clean, easy-to-scan list you can review
            and edit.
          </Text>

          <View style={styles.permPoints}>
            <PermPoint icon="camera-outline" text="Frame the label and tap capture" />
            <PermPoint icon="list-outline" text="Ingredients split into a clear list" />
            <PermPoint icon="create-outline" text="Fix any misread text before continuing" />
            <PermPoint icon="lock-closed-outline" text="Text is read on your device — nothing is uploaded" />
          </View>

          {permDenied && (
            <Text style={styles.permBlockedNote}>
              Camera access is off. Enable it in Settings to scan labels.
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
              style={styles.btnIcon}
            />
            <Text style={styles.btnText}>
              {permDenied ? 'Open Settings' : 'Scan Label'}
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

  // ── Device not ready ───────────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Starting camera…</Text>
      </View>
    );
  }

  // ── OCR running ────────────────────────────────────────────────────────────
  if (screenState === 'ocr') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.ocrTitle}>Reading ingredients…</Text>
        <Text style={styles.ocrSub}>Running on-device text recognition</Text>
      </View>
    );
  }

  // ── OCR empty ─────────────────────────────────────────────────────────────
  if (screenState === 'empty') {
    return (
      <View style={styles.centered}>
        <Ionicons name="document-text-outline" size={56} color={colors.textSecondary} />
        <Text style={styles.permTitle}>No text detected</Text>
        <Text style={styles.permBody}>
          Make sure the ingredient label is well-lit and in focus, then try again.
        </Text>
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={resetToCamera}>
          <Ionicons name="camera-outline" size={16} color="#FFF" style={styles.btnIcon} />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── OCR error ─────────────────────────────────────────────────────────────
  if (screenState === 'error') {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={56} color="#F87171" />
        <Text style={styles.permTitle}>Something went wrong</Text>
        <Text style={styles.permBody}>
          Could not process the photo. Please try again.
        </Text>
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={resetToCamera}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera preview ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Camera only exists while this tab is focused; active only when
          focused + permitted + in capture mode */}
      {cameraFailed ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraFailedView onRetry={retryCamera} />
        </View>
      ) : (
        isFocused && (
          <Camera
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused && cameraGranted && screenState === 'camera'}
            photo={true}
            androidPreviewViewType="texture-view"
            onError={onCameraError}
          />
        )
      )}

      {/* Top controls */}
      <View style={[styles.topBar, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity
          style={styles.flashBtn}
          activeOpacity={0.8}
          onPress={() => setFlash(f => (f === 'off' ? 'on' : 'off'))}>
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      <NoticeBanner
        text={notice}
        barcode={fallbackBarcode}
        style={[styles.noticeOverlay, {top: insets.top + 64}]}
      />

      {/* Aim guide */}
      <View style={styles.aimGuide}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, {paddingBottom: insets.bottom + 16}]}>
        <Text style={styles.cameraHint}>
          Frame the ingredient label inside the guide
        </Text>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          activeOpacity={0.8}
          disabled={capturing}
          onPress={handleCapture}>
          {capturing
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <View style={styles.captureInner} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const GUIDE_W = 300;
const GUIDE_H = 180;
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},

  // ── Shared centered layout (permission / ocr / error states)
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: radius.button,
    padding: 12,
  },
  noticeInCard: {alignSelf: 'stretch', marginBottom: 16},
  noticeOverlay: {position: 'absolute', left: 16, right: 16, zIndex: 10},
  noticeTextWrap: {flex: 1},
  noticeText: {fontSize: 13, fontWeight: '600', color: colors.textPrimary, lineHeight: 18},
  noticeSub: {marginTop: 2, fontSize: 11, color: colors.textSecondary},
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
    marginTop: 12,
  },
  loadingText: {marginTop: 12, fontSize: 14, color: colors.textSecondary},
  ocrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 6,
  },
  ocrSub: {fontSize: 13, color: colors.textSecondary},

  // ── Buttons
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 0,
  },
  btnText: {color: '#FFF', fontWeight: '600', fontSize: 15},
  btnIcon: {marginRight: 8},

  // ── Camera top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  flashBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    padding: 10,
  },

  // ── Aim guide (centred rectangle with corner brackets)
  aimGuide: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -(GUIDE_H / 2),
    width: GUIDE_W,
    height: GUIDE_H,
  },
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

  // ── Camera bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraHint: {color: '#FFF', fontSize: 13, opacity: 0.85, marginBottom: 20},
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureBtnDisabled: {opacity: 0.5},
  captureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
  },
});
