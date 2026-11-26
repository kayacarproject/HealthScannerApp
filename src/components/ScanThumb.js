import React, {useState, useEffect} from 'react';
import {View, Image, StyleSheet} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors} from '../theme';

// Rounded thumbnail for a saved scan. Falls back to the teal vector icon when
// there is no image or it fails to load.
export default function ScanThumb({uri, icon, size = 44, iconSize = 22}) {
  const [failed, setFailed] = useState(false);

  // A different image should get a fresh chance to load
  useEffect(() => setFailed(false), [uri]);

  const box = {width: size, height: size, borderRadius: size * 0.27};

  return (
    <View style={[styles.box, box]}>
      {uri && !failed ? (
        <Image
          source={{uri}}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name={icon} size={iconSize} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {width: '100%', height: '100%'},
});
