import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import ScanThumb from '../components/ScanThumb';
import {
  loadHealthProfile,
  loadRecentScans,
  getMissingProfileFields,
} from '../storage/localStorage';

// Quick-fill pills — shown only for fields still missing from the profile
const QUICK_FILL = {
  name:      {icon: 'person-outline',          label: 'Add your name'},
  focus:     {icon: 'heart-outline',           label: 'Pick health focus'},
  allergies: {icon: 'alert-circle-outline',    label: 'Add allergies'},
};

const RECENT_LIMIT = 5;

function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// One-line summary of a saved scan
function scanSummary(item) {
  if (item.isOcr) {
    const n = item.parsedIngredients?.length;
    return n ? `Label scan · ${n} ingredient${n !== 1 ? 's' : ''}` : 'Ingredient label scan';
  }
  const parts = [];
  if (item.brand) parts.push(item.brand.split(',')[0]);
  if (item.sugars100g != null) parts.push(`${Number(item.sugars100g).toFixed(1)} g sugar/100g`);
  return parts.length ? parts.join(' · ') : 'Barcode scan';
}

function ActionCard({icon, title, body, onPress, filled}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, filled && styles.actionCardFilled]}
      activeOpacity={0.8}
      onPress={onPress}>
      <View style={[styles.actionIcon, filled && styles.actionIconFilled]}>
        <Ionicons name={icon} size={26} color={filled ? '#FFFFFF' : colors.primary} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, filled && styles.actionTitleFilled]}>{title}</Text>
        <Text style={[styles.actionBody, filled && styles.actionBodyFilled]}>{body}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={filled ? '#FFFFFF' : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

export default function HomeScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [recent, setRecent] = useState([]);

  // Refresh profile + history every time Home gains focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([loadHealthProfile(), loadRecentScans(RECENT_LIMIT)])
        .then(([p, scans]) => {
          if (!active) return;
          setProfile(p);
          setRecent(scans);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  const missing = getMissingProfileFields(profile);
  const firstName = profile?.name?.trim()?.split(' ')[0];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 24}]}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="leaf" size={26} color="#FFFFFF" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {firstName ? `Hi, ${firstName}` : 'Health Scanner'}
          </Text>
          <Text style={styles.subtitle}>Scan products. Know what you eat.</Text>
        </View>
      </View>

      {/* Missing profile strip — only unfilled fields; disappears when complete */}
      {missing.length > 0 && (
        <View style={styles.stripWrap}>
          <Text style={styles.sectionLabel}>Complete your profile</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}>
            {missing.map(key => (
              <TouchableOpacity
                key={key}
                style={styles.pill}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('HealthProfile')}>
                <Ionicons name={QUICK_FILL[key].icon} size={14} color={colors.primary} />
                <Text style={styles.pillText}>{QUICK_FILL[key].label}</Text>
                <Ionicons name="add-circle" size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main actions */}
      <Text style={styles.sectionLabel}>Start a scan</Text>
      <ActionCard
        filled
        icon="barcode-outline"
        title="Scan a Barcode"
        body="Point at a packaged product to see its ingredients and sugar content."
        onPress={() => navigation.navigate('BarcodeScanner')}
      />
      <ActionCard
        icon="document-text-outline"
        title="Scan Ingredients (OCR)"
        body="Photograph a label and get a clean, editable ingredient breakdown."
        onPress={() => navigation.navigate('IngredientOcr')}
      />

      {/* Recent scans */}
      <View style={styles.recentHeader}>
        <Text style={[styles.sectionLabel, styles.noMargin]}>Recent scans</Text>
        {recent.length > 0 && (
          <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>
            Products you scan will show up here so you can review them later.
          </Text>
        </View>
      ) : (
        <View style={styles.recentCard}>
          {recent.map((item, idx) => (
            <TouchableOpacity
              key={item.id ?? `${item.scannedAt}-${idx}`}
              style={[styles.recentRow, idx > 0 && styles.recentRowBorder]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Result', {product: item})}>
              <ScanThumb
                uri={item.imageUrl}
                icon={item.isOcr ? 'document-text-outline' : 'barcode-outline'}
                size={40}
                iconSize={20}
              />
              <View style={styles.recentText}>
                <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{scanSummary(item)}</Text>
              </View>
              <Text style={styles.recentTime}>{timeAgo(item.scannedAt)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 20, paddingTop: 20},

  // Header
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerText: {flex: 1},
  title: {fontSize: 24, fontWeight: '700', color: colors.textPrimary},
  subtitle: {marginTop: 2, fontSize: 14, color: colors.textSecondary},

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  noMargin: {marginBottom: 0},

  // Missing-profile strip
  stripWrap: {marginBottom: 20},
  stripRow: {gap: 8, paddingRight: 8},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pillText: {fontSize: 13, fontWeight: '600', color: colors.primary},

  // Action cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
  },
  actionCardFilled: {backgroundColor: colors.primary, borderColor: colors.primary},
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIconFilled: {backgroundColor: 'rgba(255,255,255,0.2)'},
  actionText: {flex: 1, marginRight: 8},
  actionTitle: {fontSize: 16, fontWeight: '700', color: colors.textPrimary},
  actionTitleFilled: {color: '#FFFFFF'},
  actionBody: {marginTop: 3, fontSize: 13, lineHeight: 18, color: colors.textSecondary},
  actionBodyFilled: {color: 'rgba(255,255,255,0.88)'},

  // Recent scans
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  seeAll: {fontSize: 13, fontWeight: '600', color: colors.primary},
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recentRow: {flexDirection: 'row', alignItems: 'center', padding: 14},
  recentRowBorder: {borderTopWidth: 1, borderTopColor: colors.border},
  recentText: {flex: 1, marginRight: 8},
  recentName: {fontSize: 15, fontWeight: '600', color: colors.textPrimary},
  recentSub: {marginTop: 2, fontSize: 12, color: colors.textSecondary},
  recentTime: {fontSize: 11, color: colors.textSecondary},

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {marginTop: 8, fontSize: 15, fontWeight: '700', color: colors.textPrimary},
  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
