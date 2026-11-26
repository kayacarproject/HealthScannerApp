import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors} from '../theme';

// Price + pack weight pills (renders nothing if neither was detected)
export function MetaPills({mrp, weight, center}) {
  if (!mrp && !weight) return null;
  return (
    <View style={[styles.row, center && styles.center]}>
      {mrp ? (
        <View style={styles.metaPill}>
          <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
          <Text style={styles.metaText}>MRP {mrp}</Text>
        </View>
      ) : null}
      {weight ? (
        <View style={styles.metaPill}>
          <Ionicons name="scale-outline" size={14} color={colors.primary} />
          <Text style={styles.metaText}>{weight}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Compact nutrition pills: "Protein 12.5 g"
const CORE_NUTRIENTS = [
  {key: 'energy', label: 'Energy'},
  {key: 'protein', label: 'Protein'},
  {key: 'carbs', label: 'Carbs'},
  {key: 'sugar', label: 'Sugar'},
  {key: 'fat', label: 'Fat'},
];

// Always lists Energy, Protein, Carbs, Sugar and Fat once anything was read
// (a "—" means that value wasn't readable on the photo), plus any extras
// such as Fibre or Sodium.
export function NutritionPills({items, basis}) {
  if (!items?.length) return null;
  const byKey = {};
  items.forEach(n => {
    byKey[n.key] = n;
  });
  const extras = items.filter(n => !CORE_NUTRIENTS.some(c => c.key === n.key));
  const slots = [
    ...CORE_NUTRIENTS.map(c => byKey[c.key] || {key: c.key, label: c.label, value: null}),
    ...extras,
  ];
  return (
    <View>
      {basis ? <Text style={styles.basis}>Per {basis}</Text> : null}
      <View style={styles.row}>
        {slots.map(n => (
          <View key={n.key} style={[styles.nutriPill, n.value === null && styles.nutriPillMissing]}>
            <Text style={styles.nutriLabel}>{n.label}</Text>
            {n.value === null ? (
              <Text style={styles.nutriMissing}>—</Text>
            ) : (
              <Text style={styles.nutriValue}>
                {n.value}
                <Text style={styles.nutriUnit}> {n.unit}</Text>
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// Count badge + one chip per ingredient (name + optional quantity badge)
export function IngredientChips({items}) {
  if (!items?.length) return null;
  return (
    <View>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {items.length} ingredient{items.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.chipsWrap}>
        {items.map((item, idx) => (
          <View key={`${item.name}-${idx}`} style={styles.chip}>
            <Text style={styles.chipName}>{item.name}</Text>
            {item.quantity ? (
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{item.quantity}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  center: {justifyContent: 'center'},

  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  metaText: {fontSize: 13, fontWeight: '700', color: colors.primary},

  basis: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  nutriPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 78,
  },
  nutriPillMissing: {backgroundColor: colors.surface, borderStyle: 'dashed'},
  nutriMissing: {marginTop: 1, fontSize: 15, fontWeight: '700', color: colors.textSecondary},
  nutriLabel: {fontSize: 11, fontWeight: '600', color: colors.textSecondary},
  nutriValue: {marginTop: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary},
  nutriUnit: {fontSize: 11, fontWeight: '600', color: colors.textSecondary},

  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 12,
  },
  countText: {fontSize: 12, fontWeight: '700', color: colors.primary},

  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
    maxWidth: '100%',
  },
  chipName: {fontSize: 13, color: colors.textPrimary, fontWeight: '500', flexShrink: 1},
  qtyBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  qtyText: {fontSize: 11, fontWeight: '700', color: '#FFF'},
});
