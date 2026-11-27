import React, {useMemo} from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius} from '../theme';
import {parseOcrLabel} from '../services/ocrService';
import {MetaPills, NutritionPills, IngredientChips} from '../components/OcrBreakdown';

// ── Small helpers ─────────────────────────────────────────────────────────────

function MetricPill({icon, label, value, unit}) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>
        {value !== null && value !== undefined ? `${value}` : '—'}
        {value !== null && value !== undefined && unit ? (
          <Text style={styles.pillUnit}> {unit}</Text>
        ) : null}
      </Text>
    </View>
  );
}

function NutriscoreBadge({grade}) {
  if (!grade) return null;
  const GRADE_COLORS = {
    a: '#1E8F4E',
    b: '#6DB544',
    c: '#F5A623',
    d: '#E07B39',
    e: '#E63E11',
  };
  const bg = GRADE_COLORS[grade.toLowerCase()] ?? colors.textSecondary;
  return (
    <View style={[styles.nutriBadge, {backgroundColor: bg}]}>
      <Text style={styles.nutriBadgeText}>Nutri-Score {grade.toUpperCase()}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ResultScreen({route, navigation}) {
  const insets = useSafeAreaInsets();
  const product = route?.params?.product;

  // OCR scans: always re-parse the saved raw text so older history items also
  // get the structured breakdown (name, MRP, weight, ingredients, nutrition).
  const ocr = useMemo(
    () => (product?.isOcr ? parseOcrLabel(product.ingredients || '') : null),
    [product],
  );

  // Guard: no product passed (shouldn't happen, but safe)
  if (!product) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No product data available.</Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.scanBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    barcode, name, brand, ingredients,
    sugars100g, energy100g, nutriscoreGrade,
    allergens, imageUrl, isOcr,
  } = product;

  return (
    <View style={[styles.root, {paddingBottom: insets.bottom}]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Product Card ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Image */}
          <View style={styles.imageFrame}>
            {imageUrl ? (
              <Image
                source={{uri: imageUrl}}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.imageFallback}>
                <Ionicons name="cube-outline" size={56} color={colors.border} />
              </View>
            )}
          </View>

          {/* Name + brand + barcode */}
          <Text style={styles.productName} numberOfLines={3}>
            {isOcr ? ocr?.productName || name : name}
          </Text>

          {isOcr && (ocr?.mrp || ocr?.weight) ? (
            <View style={styles.ocrMeta}>
              <MetaPills mrp={ocr.mrp} weight={ocr.weight} center />
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {brand ? (
              <View style={styles.brandBadge}>
                <Text style={styles.brandText}>{brand}</Text>
              </View>
            ) : null}
            <NutriscoreBadge grade={nutriscoreGrade} />
          </View>

          {barcode ? (
            <Text style={styles.barcodeText}>
              <Ionicons name="barcode-outline" size={13} color={colors.textSecondary} />
              {'  '}{barcode}
            </Text>
          ) : null}
        </View>

        {/* ── Nutrition Highlights — hide entirely for OCR scans ────────── */}
        {!isOcr && (
          <>
            <Text style={styles.sectionTitle}>Nutrition Highlights</Text>
            <View style={styles.pillRow}>
              <MetricPill
                icon="water-outline"
                label="Sugars"
                value={sugars100g !== null ? Number(sugars100g).toFixed(1) : null}
                unit="g / 100g"
              />
              <MetricPill
                icon="flash-outline"
                label="Energy"
                value={energy100g !== null ? Math.round(energy100g) : null}
                unit="kcal / 100g"
              />
            </View>
          </>
        )}

        {isOcr && ocr?.nutrition?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Nutrition Highlights</Text>
            <View style={styles.card}>
              <NutritionPills items={ocr.nutrition} basis={ocr.nutritionBasis} />
            </View>
          </>
        )}

        {/* ── Ingredients ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.card}>
          {/* OCR path: structured chips from the parsed label */}
          {isOcr && ocr?.ingredients?.length > 0 ? (
            <IngredientChips items={ocr.ingredients} />
          ) : ingredients ? (
            <Text style={styles.ingredientsText}>{ingredients}</Text>
          ) : (
            <Text style={styles.emptyFieldText}>No ingredients data available.</Text>
          )}

          {allergens ? (
            <View style={styles.allergenBox}>
              <Ionicons name="warning-outline" size={15} color="#B45309" />
              <Text style={styles.allergenText}>{allergens}</Text>
            </View>
          ) : null}
        </View>

      </ScrollView>

      {/* ── Scan Another button (fixed at bottom) ────────────────────── */}
      <View style={[styles.footer, {paddingBottom: insets.bottom > 0 ? 8 : 16}]}>
        <TouchableOpacity
          style={styles.scanBtn}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}>
          <Ionicons
            name={isOcr ? 'camera-outline' : 'barcode-outline'}
            size={18}
            color="#FFF"
            style={styles.scanBtnIcon}
          />
          <Text style={styles.scanBtnText}>
            {isOcr ? 'Scan Another Label' : 'Scan Another Product'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},

  scroll: {
    padding: 16,
    paddingBottom: 8,
  },

  // ── Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },

  // ── Product image
  imageFrame: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {width: '100%', height: '100%'},
  imageFallback: {justifyContent: 'center', alignItems: 'center'},

  // ── Product name / meta
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 10,
  },
  ocrMeta: {marginBottom: 10},
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  brandBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  brandText: {fontSize: 12, fontWeight: '600', color: '#1D4ED8'},
  nutriBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  nutriBadgeText: {fontSize: 12, fontWeight: '700', color: '#FFF'},
  barcodeText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
  },

  // ── Nutrition pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    elevation: 1,
  },
  pillLabel: {fontSize: 11, color: colors.textSecondary, fontWeight: '600'},
  pillValue: {fontSize: 18, fontWeight: '700', color: colors.textPrimary},
  pillUnit: {fontSize: 11, fontWeight: '400', color: colors.textSecondary},

  // ── Ingredients
  ingredientsText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  emptyFieldText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  allergenBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
  },
  allergenText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },

  // ── Footer button
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scanBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnIcon: {marginRight: 8},
  scanBtnText: {color: '#FFF', fontSize: 15, fontWeight: '600'},

  // ── Guard state
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 24,
  },
});
