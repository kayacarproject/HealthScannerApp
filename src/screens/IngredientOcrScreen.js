import React, {useRef, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import {recogniseIngredients, parseIngredients} from '../services/ocrService';

// screen states
// 'camera'   → live preview, ready to capture
// 'ocr'      → photo taken, OCR running
// 'review'   → OCR done, user edits text
// 'empty'    → OCR returned nothing
// 'error'    → OCR threw

export default function IngredientOcrScreen({navigation}) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [screenState, setScreenState] = useState('camera');
  const [flash, setFlash] = useState('off');          // 'off' | 'on'
  const [editedText, setEditedText] = useState('');
  const [capturing, setCapturing] = useState(false);

  // ── Capture & OCR ──────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        flash,
        enableShutterSound: false,
      });

      setScreenState('ocr');
      setCapturing(false);

      const text = await recogniseIngredients(photo.path);

      if (!text) {
        setScreenState('empty');
      } else {
        setEditedText(text);
        setScreenState('review');
      }
    } catch (err) {
      console.error('[IngredientOcrScreen] Capture/OCR error:', err);
      setCapturing(false);
      setScreenState('error');
    }
  }, [capturing, flash]);

  const resetToCamera = useCallback(() => {
    setEditedText('');
    setScreenState('camera');
  }, []);

  // Derive parsed chips live as the user edits the raw text
  const parsedIngredients = useMemo(() => parseIngredients(editedText), [editedText]);

  const handleContinue = useCallback(() => {
    const trimmed = editedText.trim();
    if (!trimmed) return;
    navigation.navigate('Result', {
      product: {
        name: 'Scanned Ingredient Label',
        ingredients: trimmed,
        parsedIngredients,          // structured array for chip display
        isOcr: true,
        barcode: null,
        brand: null,
        sugars100g: null,
        energy100g: null,
        nutriscoreGrade: null,
        allergens: null,
        imageUrl: null,
      },
    });
  }, [editedText, parsedIngredients, navigation]);

  // ── Permission: loading ────────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Permission: denied ────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={56} color={colors.textSecondary} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Allow camera access to photograph ingredient labels.
        </Text>
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnOutline]}
          activeOpacity={0.8}
          onPress={() => Linking.openSettings()}>
          <Text style={[styles.btnText, styles.btnOutlineText]}>Open Settings</Text>
        </TouchableOpacity>
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

  // ── Review & edit ──────────────────────────────────────────────────────────
  if (screenState === 'review') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.reviewScroll, {paddingBottom: insets.bottom + 16}]}
          keyboardShouldPersistTaps="handled">

          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={styles.reviewHeader}>
            <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
            <Text style={styles.reviewTitle}>Ingredients Found</Text>
          </View>

          {/* ── Ingredient count badge ───────────────────────────────── */}
          <View style={styles.countRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {parsedIngredients.length} ingredient{parsedIngredients.length !== 1 ? 's' : ''} detected
              </Text>
            </View>
          </View>

          {/* ── Parsed ingredient chips ──────────────────────────────── */}
          {parsedIngredients.length > 0 && (
            <View style={styles.chipsCard}>
              {parsedIngredients.map((item, idx) => (
                <View key={idx} style={styles.chip}>
                  <Text style={styles.chipName} numberOfLines={2}>{item.name}</Text>
                  {item.quantity ? (
                    <View style={styles.chipQtyBadge}>
                      <Text style={styles.chipQtyText}>{item.quantity}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* ── Divider ─────────────────────────────────────────────── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>Edit raw text if needed</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Editable raw text ────────────────────────────────────── */}
          <View style={styles.textInputCard}>
            <TextInput
              style={styles.textInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              textAlignVertical="top"
              placeholder="Extracted ingredients will appear here…"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* ── Actions ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.btn, !editedText.trim() && styles.btnDisabled]}
            activeOpacity={0.8}
            disabled={!editedText.trim()}
            onPress={handleContinue}>
            <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFF" style={styles.btnIcon} />
            <Text style={styles.btnText}>Continue to Result</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, {marginTop: 10}]}
            activeOpacity={0.8}
            onPress={resetToCamera}>
            <Ionicons name="camera-outline" size={16} color={colors.primary} style={styles.btnIcon} />
            <Text style={[styles.btnText, styles.btnOutlineText]}>Retake Photo</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Camera preview ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && screenState === 'camera'}
        photo={true}
      />

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
  btnDisabled: {opacity: 0.45},
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnText: {color: '#FFF', fontWeight: '600', fontSize: 15},
  btnOutlineText: {color: colors.primary},
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

  // ── Review screen
  reviewScroll: {
    backgroundColor: colors.background,
    padding: 20,
    flexGrow: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ── Count badge
  countRow: {
    marginBottom: 14,
  },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },

  // ── Ingredient chips
  chipsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
    elevation: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 6,
    gap: 6,
    maxWidth: '100%',
  },
  chipName: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  chipQtyBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipQtyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Divider between chips and raw editor
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Raw text editor
  textInputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 20,
    minHeight: 140,
  },
  textInput: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 21,
    minHeight: 120,
  },
});
