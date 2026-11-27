import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius} from '../theme';
import {
  saveHealthProfile,
  loadHealthProfile,
  getMissingProfileFields,
  DEFAULT_PROFILE,
} from '../storage/localStorage';

// Keys are stored in AsyncStorage — keep them stable (older saves use the first five)
const FOCUS_OPTIONS = [
  {key: 'Sugar',     icon: 'water-outline',            title: 'Sugar / Diabetes',          desc: 'Flag added sugar and high-sugar products'},
  {key: 'BP',        icon: 'pulse-outline',            title: 'BP / Low Sodium',           desc: 'Watch salt and sodium-heavy ingredients'},
  {key: 'Heart',     icon: 'heart-outline',            title: 'Heart / Low Saturated Fat', desc: 'Spot saturated fat, palm oil and trans fats'},
  {key: 'Weight',    icon: 'barbell-outline',          title: 'Weight / Calorie Control',  desc: 'Keep an eye on energy and fat per serving'},
  {key: 'Digestion', icon: 'leaf-outline',             title: 'Digestion / Gut Friendly',  desc: 'Notice additives and artificial sweeteners'},
  {key: 'General',   icon: 'shield-checkmark-outline', title: 'General Wellness',          desc: 'A balanced, all-round ingredient check'},
];

const DIET_OPTIONS = [
  {key: 'Vegetarian', icon: 'leaf-outline'},
  {key: 'Vegan',      icon: 'flower-outline'},
  {key: 'Eggetarian', icon: 'egg-outline'},
  {key: 'Jain',       icon: 'sunny-outline'},
  {key: 'Any',        icon: 'restaurant-outline', label: 'Balanced / Any'},
];

const ALLERGEN_OPTIONS = [
  {key: 'Nuts',   icon: 'nutrition-outline'},
  {key: 'Dairy',  icon: 'water-outline'},
  {key: 'Gluten', icon: 'pizza-outline'},
  {key: 'Soy',    icon: 'ellipse-outline'},
  {key: 'Egg',    icon: 'egg-outline'},
];

// ── Small building blocks ─────────────────────────────────────────────────────

function SectionCard({icon, title, subtitle, children}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Chip({label, icon, active, onPress}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}>
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : colors.primary} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({children}) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const toggle = (list, key) =>
  list.includes(key) ? list.filter(k => k !== key) : [...list, key];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HealthProfileScreen() {
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ageError, setAgeError] = useState(false);

  const dirty = useRef(false);        // unsaved edits — don't overwrite on refocus
  const toastTimer = useRef(null);

  const update = useCallback(patch => {
    dirty.current = true;
    setSaved(false);
    setForm(prev => ({...prev, ...patch}));
  }, []);

  // Reload whenever the screen gains focus (unless the user has unsaved edits)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!dirty.current) {
        loadHealthProfile().then(profile => {
          if (!active) return;
          if (profile) setForm(profile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const handleSave = useCallback(async () => {
    const ageNum = form.age ? parseInt(form.age, 10) : null;
    if (ageNum !== null && (ageNum < 1 || ageNum > 120)) {
      setAgeError(true);
      return;
    }
    setAgeError(false);
    setSaving(true);
    try {
      const clean = await saveHealthProfile(form);
      setForm(clean);
      dirty.current = false;
      setSaved(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Completion banner: name, diet, focus, allergy info
  const missing = getMissingProfileFields(form);
  const doneCount = 4 - missing.length - (form.dietType ? 0 : 1);
  const pct = Math.round((Math.max(0, doneCount) / 4) * 100);
  const firstName = form.name.trim().split(' ')[0];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 32}]}
      keyboardShouldPersistTaps="handled">

      {/* Header banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="person" size={26} color={colors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>
            {firstName ? `${firstName}'s Health Profile` : 'Your Health Profile'}
          </Text>
          <Text style={styles.bannerSub}>
            Personalise how products are checked for you
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${pct}%`}]} />
          </View>
          <Text style={styles.progressLabel}>{pct}% complete</Text>
        </View>
      </View>

      {/* 1 · Basic profile */}
      <SectionCard
        icon="person-circle-outline"
        title="Basic Profile"
        subtitle="Tell us a little about you">
        <FieldLabel>Name</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="e.g. Alex"
          placeholderTextColor={colors.textSecondary}
          value={form.name}
          onChangeText={v => update({name: v})}
          returnKeyType="done"
        />

        <FieldLabel>Age (optional)</FieldLabel>
        <TextInput
          style={[styles.input, styles.inputShort, ageError && styles.inputError]}
          placeholder="e.g. 35"
          placeholderTextColor={colors.textSecondary}
          value={form.age}
          onChangeText={v => {
            setAgeError(false);
            update({age: v.replace(/\D/g, '').slice(0, 3)});
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
        {ageError && <Text style={styles.errorText}>Enter an age between 1 and 120.</Text>}

        <FieldLabel>Diet type (optional)</FieldLabel>
        <View style={styles.chipRow}>
          {DIET_OPTIONS.map(d => (
            <Chip
              key={d.key}
              label={d.label || d.key}
              icon={d.icon}
              active={form.dietType === d.key}
              onPress={() => update({dietType: form.dietType === d.key ? '' : d.key})}
            />
          ))}
        </View>
      </SectionCard>

      {/* 2 · Health & nutrition focus */}
      <SectionCard
        icon="heart-circle-outline"
        title="Health & Nutrition Focus"
        subtitle="Pick everything that matters to you">
        {FOCUS_OPTIONS.map(o => {
          const active = form.focusTags.includes(o.key);
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => update({focusTags: toggle(form.focusTags, o.key)})}
              activeOpacity={0.75}>
              <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                <Ionicons name={o.icon} size={20} color={active ? '#FFFFFF' : colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{o.title}</Text>
                <Text style={styles.optionDesc}>{o.desc}</Text>
              </View>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={active ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </SectionCard>

      {/* 3 · Allergies & avoid list */}
      <SectionCard
        icon="alert-circle-outline"
        title="Allergies & Avoid List"
        subtitle="Ingredients you need to steer clear of">
        <FieldLabel>Common allergens</FieldLabel>
        <View style={styles.chipRow}>
          {ALLERGEN_OPTIONS.map(a => (
            <Chip
              key={a.key}
              label={a.key}
              icon={a.icon}
              active={form.allergenTags.includes(a.key)}
              onPress={() =>
                update({
                  allergenTags: toggle(form.allergenTags, a.key),
                  noAllergies: false,
                })
              }
            />
          ))}
          <Chip
            label="None known"
            icon="checkmark-done-outline"
            active={form.noAllergies}
            onPress={() =>
              update(
                form.noAllergies
                  ? {noAllergies: false}
                  : {noAllergies: true, allergenTags: [], allergies: ''},
              )
            }
          />
        </View>

        <FieldLabel>Other allergies / ingredients to avoid</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="e.g. peanuts, palm oil, MSG"
          placeholderTextColor={colors.textSecondary}
          value={form.allergies}
          onChangeText={v => update({allergies: v, noAllergies: false})}
          returnKeyType="done"
        />

        <FieldLabel>Personal notes</FieldLabel>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Any other dietary preferences or conditions…"
          placeholderTextColor={colors.textSecondary}
          value={form.notes}
          onChangeText={v => update({notes: v})}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </SectionCard>

      {/* Save confirmation */}
      {saved && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={styles.toastText}>Profile saved on this device</Text>
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.8}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons
              name={saved ? 'checkmark-circle' : 'save-outline'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Profile'}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Disclaimer */}
      <View style={styles.disclaimerRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.disclaimer}>
          This information is stored only on your device and is used solely to
          personalise ingredient highlights. It is not medical advice.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.background},
  content: {padding: 20, gap: 16},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: 18,
    gap: 14,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {flex: 1},
  bannerTitle: {fontSize: 18, fontWeight: '700', color: '#FFFFFF'},
  bannerSub: {marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.85)'},
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF'},
  progressLabel: {marginTop: 4, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)'},

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
    elevation: 1,
  },
  cardHead: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4},
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadText: {flex: 1},
  cardTitle: {fontSize: 16, fontWeight: '700', color: colors.textPrimary},
  cardSubtitle: {marginTop: 1, fontSize: 12, color: colors.textSecondary},

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputShort: {width: 110},
  inputMulti: {height: 84, paddingTop: 10},
  inputError: {borderColor: '#DC2626'},
  errorText: {fontSize: 12, color: '#DC2626', marginTop: -4},

  // Chips
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: {backgroundColor: colors.primary},
  chipText: {fontSize: 13, fontWeight: '600', color: colors.primary},
  chipTextActive: {color: '#FFFFFF'},

  // Focus options
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    padding: 12,
    backgroundColor: colors.background,
  },
  optionActive: {borderColor: colors.primary, backgroundColor: '#F0FDFA'},
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {backgroundColor: colors.primary},
  optionText: {flex: 1},
  optionTitle: {fontSize: 14, fontWeight: '700', color: colors.textPrimary},
  optionDesc: {marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textSecondary},

  // Save
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: radius.button,
    paddingVertical: 10,
  },
  toastText: {fontSize: 14, fontWeight: '600', color: colors.primary},
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},

  disclaimerRow: {flexDirection: 'row', gap: 6, paddingHorizontal: 4},
  disclaimer: {flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18},
});
