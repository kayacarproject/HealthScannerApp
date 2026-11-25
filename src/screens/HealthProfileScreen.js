import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius} from '../theme';
import {saveHealthProfile, loadHealthProfile} from '../storage/localStorage';

const FOCUS_TAGS = [
  {key: 'Sugar',   icon: 'water-outline'},
  {key: 'BP',      icon: 'pulse-outline'},
  {key: 'Heart',   icon: 'heart-outline'},
  {key: 'Weight',  icon: 'barbell-outline'},
  {key: 'General', icon: 'shield-checkmark-outline'},
];

export default function HealthProfileScreen() {
  const insets = useSafeAreaInsets();

  const [name,      setName]      = useState('');
  const [focusTags, setFocusTags] = useState([]);
  const [allergies, setAllergies] = useState('');
  const [notes,     setNotes]     = useState('');

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  // ── Load saved profile on mount ───────────────────────────────────────────
  useEffect(() => {
    loadHealthProfile().then(profile => {
      if (profile) {
        setName(profile.name      ?? '');
        setFocusTags(profile.focusTags ?? []);
        setAllergies(profile.allergies ?? '');
        setNotes(profile.notes    ?? '');
      }
      setLoading(false);
    });
  }, []);

  // ── Toggle a focus tag ────────────────────────────────────────────────────
  const toggleTag = useCallback(key => {
    setFocusTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    );
    setSaved(false);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    await saveHealthProfile({name: name.trim(), focusTags, allergies: allergies.trim(), notes: notes.trim()});
    setSaving(false);
    setSaved(true);
  }, [name, focusTags, allergies, notes]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 32}]}
      keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={44} color={colors.primary} />
        <Text style={styles.heading}>Health Profile</Text>
        <Text style={styles.subheading}>Personalise your scan experience</Text>
      </View>

      {/* Name */}
      <View style={styles.card}>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Alex"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={v => { setName(v); setSaved(false); }}
          returnKeyType="done"
        />
      </View>

      {/* Health focus tags */}
      <View style={styles.card}>
        <Text style={styles.label}>Health focus</Text>
        <Text style={styles.hint}>Select all that apply</Text>
        <View style={styles.tagRow}>
          {FOCUS_TAGS.map(({key, icon}) => {
            const active = focusTags.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tag, active && styles.tagActive]}
                onPress={() => toggleTag(key)}
                activeOpacity={0.75}>
                <Ionicons
                  name={icon}
                  size={16}
                  color={active ? '#FFFFFF' : colors.primary}
                  style={styles.tagIcon}
                />
                <Text style={[styles.tagText, active && styles.tagTextActive]}>
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Allergies */}
      <View style={styles.card}>
        <Text style={styles.label}>Allergies / intolerances</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. peanuts, gluten, lactose"
          placeholderTextColor={colors.textSecondary}
          value={allergies}
          onChangeText={v => { setAllergies(v); setSaved(false); }}
          returnKeyType="done"
        />
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.label}>Additional notes</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Any other dietary preferences or conditions…"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={v => { setNotes(v); setSaved(false); }}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

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
              style={styles.saveBtnIcon}
            />
            <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Profile'}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        ℹ️ This information is stored only on your device and is used solely to
        personalise ingredient highlights. It is not medical advice.
      </Text>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.background},
  content: {padding: 20, gap: 14},

  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background},

  header: {alignItems: 'center', paddingVertical: 8, gap: 4},
  heading: {fontSize: 22, fontWeight: '700', color: colors.textPrimary},
  subheading: {fontSize: 13, color: colors.textSecondary},

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 8,
  },
  label: {fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5},
  hint:  {fontSize: 12, color: colors.textSecondary, marginTop: -4},

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
  inputMulti: {height: 80, paddingTop: 10},

  // Tags
  tagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  tagActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  tagIcon: {},
  tagText: {fontSize: 13, fontWeight: '600', color: colors.primary},
  tagTextActive: {color: '#FFFFFF'},

  // Save
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnIcon: {},
  saveBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},

  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
