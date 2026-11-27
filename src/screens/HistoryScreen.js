import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';
import ScanThumb from '../components/ScanThumb';
import {
  loadScanHistory,
  normalizeScan,
  deleteScanFromHistory,
  clearScanHistory,
} from '../storage/localStorage';

function formatDate(ts) {
  if (ts == null) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function HistoryScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Same loader as HomeScreen (loadScanHistory); reload on every tab focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadScanHistory()
        .then(list => {
          if (!active) return;
          setScans(list.map(normalizeScan).filter(Boolean));
          setLoading(false);
        })
        .catch(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, []),
  );

  const reload = useCallback(() => {
    loadScanHistory()
      .then(list => setScans(list.map(normalizeScan).filter(Boolean)))
      .catch(() => {});
  }, []);

  // Delete one scan (after confirmation). The list updates immediately; if
  // storage fails we reload the real state.
  const confirmDelete = useCallback(
    item => {
      Alert.alert(
        'Delete this scan?',
        `"${item.title}" will be removed from your history.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setScans(prev => prev.filter(x => x.key !== item.key));
              deleteScanFromHistory(item.product.id ?? item.product.scannedAt).catch(reload);
            },
          },
        ],
      );
    },
    [reload],
  );

  const confirmClearAll = useCallback(() => {
    Alert.alert(
      'Clear all history?',
      'All saved scans will be permanently removed from this device.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setScans([]);
            clearScanHistory().catch(reload);
          },
        },
      ],
    );
  }, [reload]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (scans.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={48} color={colors.primary} />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>
            Barcode and ingredient-label scans will be listed here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 24}]}
      data={scans}
      keyExtractor={item => item.key}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.count}>
            {scans.length} scan{scans.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={styles.clearBtn}
            activeOpacity={0.7}
            onPress={confirmClearAll}>
            <Ionicons name="trash-outline" size={15} color="#DC2626" />
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({item}) => {
        const isOcr = item.source === 'OCR';
        const date = formatDate(item.timestamp);
        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('Result', {product: item.product})}>
            <ScanThumb
              uri={item.imageUrl}
              icon={isOcr ? 'document-text-outline' : 'barcode-outline'}
            />
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.source}</Text>
                </View>
              </View>
              {!!item.meta && <Text style={styles.meta} numberOfLines={1}>{item.meta}</Text>}
              {!!item.snippet && (
                <Text style={styles.snippet} numberOfLines={2}>{item.snippet}</Text>
              )}
              {!!date && <Text style={styles.date}>{date}</Text>}
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.7}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              accessibilityLabel={`Delete ${item.title}`}
              onPress={() => confirmDelete(item)}>
              <Ionicons name="trash-outline" size={19} color="#DC2626" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: colors.background},
  content: {padding: 20},
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  clearText: {fontSize: 12, fontWeight: '700', color: '#DC2626'},
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  body: {flex: 1, marginRight: 8},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary},
  badge: {
    backgroundColor: '#CCFBF1',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {fontSize: 10, fontWeight: '700', color: colors.primary},
  meta: {marginTop: 3, fontSize: 12, fontWeight: '600', color: colors.primary},
  snippet: {marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textSecondary},
  date: {marginTop: 5, fontSize: 11, color: colors.textSecondary},

  emptyCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {marginTop: 12, fontSize: 18, fontWeight: '700', color: colors.textPrimary},
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
