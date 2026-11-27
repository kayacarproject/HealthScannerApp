import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import {colors} from '../theme';

import HomeScreen from '../screens/HomeScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import IngredientOcrScreen from '../screens/IngredientOcrScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HealthProfileScreen from '../screens/HealthProfileScreen';
import ResultScreen from '../screens/ResultScreen';

// ── Shared header style ──────────────────────────────────────────────────────
const headerOpts = {
  headerStyle: {backgroundColor: colors.primary},
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {fontWeight: '700', fontSize: 17},
  contentStyle: {backgroundColor: colors.background},
};

// Active / inactive tab tint
const TAB_ACTIVE = colors.primary; // Teal #0F766E
const TAB_INACTIVE = '#64748B';    // Slate

// React Navigation 7 tells a custom tabBarButton whether it is selected via
// `aria-selected` (accessibilityState is no longer passed).
const isSelected = props =>
  !!(props['aria-selected'] ?? props.accessibilityState?.selected);

// ── Tab icon map (non-center tabs only) ──────────────────────────────────────
const TAB_ICONS = {
  Home:         {active: 'home',         inactive: 'home-outline'},
  History:      {active: 'time',         inactive: 'time-outline'},
  IngredientOcr:{active: 'camera',       inactive: 'camera-outline'},
  Profile:      {active: 'person-circle',inactive: 'person-circle-outline'},
};

// ── Standard tab button ──────────────────────────────────────────────────────
// Draws its own icon AND label, so the four surrounding tabs always show their
// text no matter which tab (including the raised center one) is active.
const TAB_LABELS = {
  Home: 'Home',
  History: 'History',
  IngredientOcr: 'OCR',
  Profile: 'Profile',
};

function TabButton({name, ...props}) {
  const {onPress, onLongPress, testID} = props;
  const focused = isSelected(props);
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE;
  const icon = TAB_ICONS[name];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{selected: focused}}
      accessibilityLabel={TAB_LABELS[name]}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={styles.tabBtn}>
      <Ionicons name={focused ? icon.active : icon.inactive} size={24} color={color} />
      <Text style={[styles.tabLabel, {color}]} numberOfLines={1}>
        {TAB_LABELS[name]}
      </Text>
    </TouchableOpacity>
  );
}

const HomeTabButton = props => <TabButton name="Home" {...props} />;
const HistoryTabButton = props => <TabButton name="History" {...props} />;
const OcrTabButton = props => <TabButton name="IngredientOcr" {...props} />;
const ProfileTabButton = props => <TabButton name="Profile" {...props} />;
const ScanTabButton = props => <CenterTabButton {...props} />;

// ── Center tab button ────────────────────────────────────────────────────────
// Sits in normal flex flow (no position:absolute) so siblings stay evenly
// spaced. marginTop lifts the circle above the tab bar line; the white border
// ring visually separates it from the bar surface.
function CenterTabButton(props) {
  const {onPress} = props;
  const focused = isSelected(props);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{selected: focused}}
      accessibilityLabel="Scan barcode"
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.centerOuter}>
      <View style={[styles.centerCircle, focused && styles.centerCircleFocused]}>
        <Ionicons name="barcode" size={28} color="#FFFFFF" />
      </View>
      <Text style={[styles.centerLabel, {color: focused ? TAB_ACTIVE : TAB_INACTIVE}]}>
        Scan
      </Text>
    </TouchableOpacity>
  );
}

// ── Bottom Tab Navigator ─────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={() => ({
        ...headerOpts,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          // Must be visible so the raised circle is not clipped by the bar
          overflow: 'visible',
          // Always paint above screen content (e.g. a live camera preview)
          elevation: 8,
          zIndex: 10,
        },
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
      })}>

      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'Home', tabBarLabel: 'Home', tabBarButton: HomeTabButton}}
      />
      <Tab.Screen
        name="IngredientOcr"
        component={IngredientOcrScreen}
        options={{title: 'Ingredient OCR', tabBarLabel: 'OCR', tabBarButton: OcrTabButton}}
      />
      <Tab.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{
          title: 'Barcode Scanner',
          tabBarShowLabel: false,
          tabBarButton: ScanTabButton,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{title: 'History', tabBarLabel: 'History', tabBarButton: HistoryTabButton}}
      />
      <Tab.Screen
        name="Profile"
        component={HealthProfileScreen}
        options={{title: 'Health Profile', tabBarLabel: 'Profile', tabBarButton: ProfileTabButton}}
      />
    </Tab.Navigator>
  );
}

// ── Root Stack ───────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={headerOpts}>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{headerShown: false}}
        />
        {/* Kept so HomeScreen's navigate('HealthProfile') still resolves */}
        <Stack.Screen
          name="HealthProfile"
          component={HealthProfileScreen}
          options={{title: 'Health Profile'}}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{title: 'Scan Result'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const CIRCLE = 58;

const styles = StyleSheet.create({
  // Standard (non-center) tab: icon over label, fills its 1/5th slot
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  tabLabel: {fontSize: 11, fontWeight: '600'},

  // Outer touchable fills the 1/5th slot; flex column centres circle + label
  centerOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // Circle lifted above the bar with marginTop; white border ring separates it
  centerCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.surface,
    ...Platform.select({
      android: {elevation: 6},
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: {width: 0, height: 3},
      },
    }),
  },

  // Slightly brighter teal ring when the tab is active
  centerCircleFocused: {
    backgroundColor: '#0D6B63',
    borderColor: colors.surface,
  },

  centerLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
