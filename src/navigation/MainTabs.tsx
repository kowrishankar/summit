import React, { useState } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AddPreferredProvider } from '../contexts/AddPreferredContext';
import HomeScreen from '../screens/HomeScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import SalesScreen from '../screens/SalesScreen';
import SaleDetailScreen from '../screens/SaleDetailScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddInvoiceScreen from '../screens/AddInvoiceScreen';
import AddSaleScreen from '../screens/AddSaleScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import EditInvoiceScreen from '../screens/EditInvoiceScreen';
import EditSaleScreen from '../screens/EditSaleScreen';
import BusinessSwitchScreen from '../screens/BusinessSwitchScreen';
import DashboardScreen from '../screens/DashboardScreen';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  TEXT,
  TEXT_MUTED,
  headerScreenOptions,
} from '../theme/design';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Floating tab bar — slate icons + center FAB (design reference) */
const NAV_ICON_INACTIVE = '#94a3b8';
const NAV_ICON_ACTIVE = '#1e293b';
const NAV_FAB_BG = '#475569';
const TAB_BAR_PILL_RADIUS = 36;

/** Popup rows — same pastel language as Home quick actions */
const POPUP_DOC_TILE_BG = '#F5F3FF';
const POPUP_DOC_ICON = '#4338CA';
const POPUP_SALE_TILE_BG = '#ECFDF5';
const POPUP_SALE_ICON = '#059669';

const tabScreenOptions = {
  headerStyle: { backgroundColor: PAGE_BG },
  headerTintColor: TEXT,
  headerShadowVisible: false,
  tabBarStyle: { backgroundColor: CARD_BG, borderTopColor: BORDER },
  tabBarActiveTintColor: PRIMARY,
  tabBarInactiveTintColor: '#64748b',
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerScreenOptions}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="BusinessSwitch" component={BusinessSwitchScreen} options={{ title: 'Switch business' }} />
    </Stack.Navigator>
  );
}

function RecordsStack() {
  return (
    <Stack.Navigator screenOptions={headerScreenOptions} initialRouteName="InvoicesList">
      <Stack.Screen name="InvoicesList" component={InvoicesScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="SalesList" component={SalesScreen} options={{ title: 'Sales' }} />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Invoice',
          headerRight: () => {
            const params = route.params as { invoiceId?: string } | undefined;
            if (!params?.invoiceId) return null;
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('EditInvoice', { invoiceId: params.invoiceId })}
                style={{ marginRight: 16 }}
              >
                <AppText style={{ color: PRIMARY, fontWeight: '600', fontSize: 16 }}>Edit</AppText>
              </TouchableOpacity>
            );
          },
        })}
      />
      <Stack.Screen name="EditInvoice" component={EditInvoiceScreen} options={{ title: 'Edit invoice' }} />
      <Stack.Screen
        name="SaleDetail"
        component={SaleDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Sale',
          headerRight: () => {
            const params = route.params as { saleId?: string } | undefined;
            if (!params?.saleId) return null;
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('EditSale', { saleId: params.saleId })}
                style={{ marginRight: 16 }}
              >
                <AppText style={{ color: PRIMARY, fontWeight: '600', fontSize: 16 }}>Edit</AppText>
              </TouchableOpacity>
            );
          },
        })}
      />
      <Stack.Screen name="EditSale" component={EditSaleScreen} options={{ title: 'Edit sale' }} />
    </Stack.Navigator>
  );
}

function AddStack() {
  return (
    <Stack.Navigator initialRouteName="AddInvoiceRoot" screenOptions={headerScreenOptions}>
      <Stack.Screen name="AddInvoiceRoot" component={AddInvoiceScreen} options={{ title: 'Add invoice' }} />
      <Stack.Screen name="AddSaleRoot" component={AddSaleScreen} options={{ title: 'Add sale' }} />
    </Stack.Navigator>
  );
}

const RECORDS_TAB_NAME = 'Records';

function RecordsTabBarPopup({
  visible,
  onClose,
  onSelectInvoices,
  onSelectSales,
  bottomOffset,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectInvoices: () => void;
  onSelectSales: () => void;
  bottomOffset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={popupStyles.backdrop} onPress={onClose}>
        <View
          style={[popupStyles.sheet, { marginBottom: bottomOffset }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={popupStyles.sheetHandle} />
          <AppText style={popupStyles.sheetTitle}>Records</AppText>
          <AppText style={popupStyles.sheetSubtitle}>Choose where to go</AppText>

          <Pressable
            style={({ pressed }) => [
              popupStyles.optionCard,
              pressed && popupStyles.optionCardPressed,
            ]}
            android_ripple={{ color: 'rgba(15, 23, 42, 0.06)' }}
            onPress={() => {
              onSelectInvoices();
              onClose();
            }}
          >
            <View style={[popupStyles.iconBlob, { backgroundColor: POPUP_DOC_TILE_BG }]}>
              <Ionicons name="document-text-outline" size={24} color={POPUP_DOC_ICON} />
            </View>
            <View style={popupStyles.optionTextCol}>
              <AppText style={popupStyles.optionTitle}>Invoices</AppText>
              <AppText style={popupStyles.optionDesc}>Receipts & expenses</AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              popupStyles.optionCard,
              popupStyles.optionCardLast,
              pressed && popupStyles.optionCardPressed,
            ]}
            android_ripple={{ color: 'rgba(15, 23, 42, 0.06)' }}
            onPress={() => {
              onSelectSales();
              onClose();
            }}
          >
            <View style={[popupStyles.iconBlob, { backgroundColor: POPUP_SALE_TILE_BG }]}>
              <Ionicons name="trending-up-outline" size={24} color={POPUP_SALE_ICON} />
            </View>
            <View style={popupStyles.optionTextCol}>
              <AppText style={popupStyles.optionTitle}>Sales</AppText>
              <AppText style={popupStyles.optionDesc}>Income & sales</AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function AddTabBarPopup({
  visible,
  onClose,
  onSelectInvoice,
  onSelectSale,
  bottomOffset,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectInvoice: () => void;
  onSelectSale: () => void;
  bottomOffset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={popupStyles.backdrop} onPress={onClose}>
        <View
          style={[popupStyles.sheet, { marginBottom: bottomOffset }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={popupStyles.sheetHandle} />
          <AppText style={popupStyles.sheetTitle}>Add</AppText>
          <AppText style={popupStyles.sheetSubtitle}>Create something new</AppText>

          <Pressable
            style={({ pressed }) => [
              popupStyles.optionCard,
              pressed && popupStyles.optionCardPressed,
            ]}
            android_ripple={{ color: 'rgba(15, 23, 42, 0.06)' }}
            onPress={() => {
              onSelectInvoice();
              onClose();
            }}
          >
            <View style={[popupStyles.iconBlob, { backgroundColor: POPUP_DOC_TILE_BG }]}>
              <Ionicons name="document-text-outline" size={24} color={POPUP_DOC_ICON} />
            </View>
            <View style={popupStyles.optionTextCol}>
              <AppText style={popupStyles.optionTitle}>Add invoice</AppText>
              <AppText style={popupStyles.optionDesc}>Scan or enter a receipt</AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              popupStyles.optionCard,
              popupStyles.optionCardLast,
              pressed && popupStyles.optionCardPressed,
            ]}
            android_ripple={{ color: 'rgba(15, 23, 42, 0.06)' }}
            onPress={() => {
              onSelectSale();
              onClose();
            }}
          >
            <View style={[popupStyles.iconBlob, { backgroundColor: POPUP_SALE_TILE_BG }]}>
              <Ionicons name="trending-up-outline" size={24} color={POPUP_SALE_ICON} />
            </View>
            <View style={popupStyles.optionTextCol}>
              <AppText style={popupStyles.optionTitle}>Add sale</AppText>
              <AppText style={popupStyles.optionDesc}>Record income or a sale</AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const popupStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    marginHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED_CARD,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionCardLast: {
    marginBottom: 0,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  iconBlob: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  optionDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginTop: 3,
    lineHeight: 18,
  },
});

function tabIconName(
  name: string,
  focused: boolean
): 'home' | 'home-outline' | 'folder' | 'folder-outline' | 'bar-chart' | 'bar-chart-outline' | 'settings' | 'settings-outline' | 'ellipse' {
  if (name === 'Dashboard') return focused ? 'home' : 'home-outline';
  if (name === RECORDS_TAB_NAME) return focused ? 'folder' : 'folder-outline';
  if (name === 'Reports') return focused ? 'bar-chart' : 'bar-chart-outline';
  if (name === 'Settings') return focused ? 'settings' : 'settings-outline';
  return 'ellipse';
}

function CustomTabBar(props: React.ComponentProps<ReturnType<typeof Tab>['Navigator']>['tabBar']) {
  const [recordsPopupVisible, setRecordsPopupVisible] = useState(false);
  const [addPopupVisible, setAddPopupVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { state, navigation } = props as {
    state: { index: number; routeNames: string[] };
    navigation: { navigate: (name: string, params?: { screen: string }) => void };
  };

  const selectInvoices = () => {
    navigation.navigate(RECORDS_TAB_NAME, { screen: 'InvoicesList' });
  };
  const selectSales = () => {
    navigation.navigate(RECORDS_TAB_NAME, { screen: 'SalesList' });
  };

  const selectAddInvoice = () => {
    navigation.navigate('Add', { screen: 'AddInvoiceRoot' });
  };
  const selectAddSale = () => {
    navigation.navigate('Add', { screen: 'AddSaleRoot' });
  };

  const bottomPad = Math.max(12, insets.bottom);
  /** Clear floating tab pill + safe area so sheets sit just above the bar */
  const popupBottomOffset = Math.max(96, bottomPad + 76);

  return (
    <>
      <View style={[tabBarStyles.tabBarOuter, { paddingBottom: bottomPad }]}>
        <View style={tabBarStyles.tabBarPill}>
          {state.routeNames.map((name, index) => {
            const isRecords = name === RECORDS_TAB_NAME;
            const isAdd = name === 'Add';
            const isFocused = state.index === index;
            const label =
              name === 'Dashboard'
                ? 'Home'
                : name === RECORDS_TAB_NAME
                  ? 'Records'
                  : name === 'Add'
                    ? ''
                    : name;
            const iconColor = isFocused ? NAV_ICON_ACTIVE : NAV_ICON_INACTIVE;

            if (isAdd) {
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel="Add"
                  style={({ pressed }) => [
                    tabBarStyles.tabFabSlot,
                    pressed && tabBarStyles.tabFabSlotPressed,
                  ]}
                  android_ripple={{ color: 'rgba(71, 85, 105, 0.2)', borderless: true }}
                  onPress={() => setAddPopupVisible(true)}
                >
                  <View style={tabBarStyles.fabCircle}>
                    <Ionicons name="add" size={30} color="#ffffff" />
                  </View>
                </Pressable>
              );
            }

            const iconName = tabIconName(name, isFocused);

            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label || name}
                style={({ pressed }) => [
                  tabBarStyles.tab,
                  (Platform.OS === 'ios' || Platform.OS === 'web') && pressed && tabBarStyles.tabPressed,
                ]}
                android_ripple={{ color: 'rgba(30, 41, 59, 0.08)', foreground: true }}
                onPress={() => {
                  if (isRecords) {
                    setRecordsPopupVisible(true);
                  } else {
                    navigation.navigate(name);
                  }
                }}
              >
                <Ionicons name={iconName} size={22} color={iconColor} />
                <AppText style={[tabBarStyles.label, { color: iconColor }]} numberOfLines={1}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <RecordsTabBarPopup
        visible={recordsPopupVisible}
        onClose={() => setRecordsPopupVisible(false)}
        onSelectInvoices={selectInvoices}
        onSelectSales={selectSales}
        bottomOffset={popupBottomOffset}
      />
      <AddTabBarPopup
        visible={addPopupVisible}
        onClose={() => setAddPopupVisible(false)}
        onSelectInvoice={selectAddInvoice}
        onSelectSale={selectAddSale}
        bottomOffset={popupBottomOffset}
      />
    </>
  );
}

const tabBarStyles = StyleSheet.create({
  tabBarOuter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: PAGE_BG,
  },
  tabBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: TAB_BAR_PILL_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 52,
  },
  tabPressed: {
    opacity: 0.85,
  },
  tabFabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  tabFabSlotPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  fabCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAV_FAB_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: -2,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.2,
  },
});

export default function MainTabs() {
  return (
    <AddPreferredProvider>
    <Tab.Navigator
      screenOptions={tabScreenOptions}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name={RECORDS_TAB_NAME}
        component={RecordsStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Add"
        component={AddStack}
        options={{
          tabBarLabel: 'Add',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size + 4} color={color} />,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
    </AddPreferredProvider>
  );
}
