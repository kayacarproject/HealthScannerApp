import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors, radius} from '../theme';

// Shown instead of a blank preview when the camera can't start
export default function CameraFailedView({onRetry}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="videocam-off-outline" size={52} color={colors.textSecondary} />
      <Text style={styles.title}>Camera couldn't start</Text>
      <Text style={styles.body}>
        Close other apps that may be using the camera, then try again.
      </Text>
      <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={onRetry}>
        <Ionicons name="refresh" size={18} color="#FFF" />
        <Text style={styles.btnText}>Retry Camera</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {marginTop: 14, fontSize: 18, fontWeight: '700', color: colors.textPrimary},
  body: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  btnText: {color: '#FFF', fontWeight: '600', fontSize: 15},
});
