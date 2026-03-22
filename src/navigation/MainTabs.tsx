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
import BusinessSwitchScreen from '../screens/BusinessSwitchScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabScreenOptions = {
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#0f172a',
  tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
  tabBarActiveTintColor: '#6366f1',
  tabBarInactiveTintColor: '#64748b',
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#0f172a' }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="BusinessSwitch" component={BusinessSwitchScreen} options={{ title: 'Switch business' }} />
    </Stack.Navigator>
  );
}

function RecordsStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#0f172a' }}
      initialRouteName="InvoicesList"
    >
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
                <AppText style={{ color: '#6366f1', fontWeight: '600', fontSize: 16 }}>Edit</AppText>
              </TouchableOpacity>
            );
          },
        })}
      />
      <Stack.Screen name="EditInvoice" component={EditInvoiceScreen} options={{ title: 'Edit invoice' }} />
      <Stack.Screen name="SaleDetail" component={SaleDetailScreen} options={{ title: 'Sale' }} />
    </Stack.Navigator>
  );
}

function AddStack() {
  return (
    <Stack.Navigator
      initialRouteName="AddInvoiceRoot"
      screenOptions={{ headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#0f172a' }}
    >
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
}: {
  visible: boolean;
  onClose: () => void;
  onSelectInvoices: () => void;
  onSelectSales: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={popupStyles.backdrop} onPress={onClose}>
        <View style={popupStyles.popup} onStartShouldSetResponder={() => true}>
          <Pressable
            style={({ pressed }) => [popupStyles.option, pressed && popupStyles.optionPressed]}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.2)' }}
            onPress={() => {
              onSelectInvoices();
              onClose();
            }}
          >
            <Ionicons name="document-text-outline" size={20} color="#818cf8" />
            <AppText style={popupStyles.optionText}>Invoices</AppText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [popupStyles.option, pressed && popupStyles.optionPressed]}
            android_ripple={{ color: 'rgba(34, 197, 94, 0.22)' }}
            onPress={() => {
              onSelectSales();
              onClose();
            }}
          >
            <Ionicons name="trending-up-outline" size={20} color="#22c55e" />
            <AppText style={popupStyles.optionText}>Sales</AppText>
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
}: {
  visible: boolean;
  onClose: () => void;
  onSelectInvoice: () => void;
  onSelectSale: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={popupStyles.backdrop} onPress={onClose}>
        <View style={popupStyles.popup} onStartShouldSetResponder={() => true}>
          <Pressable
            style={({ pressed }) => [popupStyles.option, pressed && popupStyles.optionPressed]}
            android_ripple={{ color: 'rgba(99, 102, 241, 0.2)' }}
            onPress={() => {
              onSelectInvoice();
              onClose();
            }}
          >
            <Ionicons name="document-text-outline" size={20} color="#818cf8" />
            <AppText style={popupStyles.optionText}>Add invoice</AppText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [popupStyles.option, pressed && popupStyles.optionPressed]}
            android_ripple={{ color: 'rgba(34, 197, 94, 0.22)' }}
            onPress={() => {
              onSelectSale();
              onClose();
            }}
          >
            <Ionicons name="trending-up-outline" size={20} color="#22c55e" />
            <AppText style={popupStyles.optionText}>Add sale</AppText>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  popup: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 12,
    marginBottom: 70,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  optionPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});

function CustomTabBar(props: React.ComponentProps<ReturnType<typeof Tab>['Navigator']>['tabBar']) {
  const [recordsPopupVisible, setRecordsPopupVisible] = useState(false);
  const [addPopupVisible, setAddPopupVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { state, navigation, descriptors } = props as {
    state: { index: number; routeNames: string[] };
    navigation: { navigate: (name: string, params?: { screen: string }) => void };
    descriptors: Record<string, { options: { tabBarButton?: (p: unknown) => React.ReactNode } }>;
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

  return (
    <>
      <View style={[tabBarStyles.tabBarContainer, { paddingBottom: Math.max(8, insets.bottom) }]}>
        {state.routeNames.map((name, index) => {
          const isRecords = name === RECORDS_TAB_NAME;
          const isAdd = name === 'Add';
          const isFocused = state.index === index;
          const label =
            name === 'Dashboard'
              ? 'Home'
              : name === RECORDS_TAB_NAME
                ? 'View records'
                : name === 'Add'
                  ? 'Add'
                  : name;
          const iconName =
            name === 'Dashboard'
              ? 'home'
              : name === RECORDS_TAB_NAME
                ? 'folder-open'
                : name === 'Add'
                  ? 'add-circle'
                  : name === 'Reports'
                    ? 'bar-chart'
                    : name === 'Settings'
                      ? 'settings'
                      : 'ellipse';
          const color = isFocused ? '#818cf8' : '#64748b';

          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              hitSlop={8}
              style={({ pressed }) => [
                tabBarStyles.tab,
                (Platform.OS === 'ios' || Platform.OS === 'web') && pressed && tabBarStyles.tabPressed,
              ]}
              android_ripple={{ color: 'rgba(99, 102, 241, 0.22)', foreground: true }}
              onPress={() => {
                if (isRecords) {
                  setRecordsPopupVisible(true);
                } else if (isAdd) {
                  setAddPopupVisible(true);
                } else {
                  navigation.navigate(name);
                }
              }}
            >
              <Ionicons name={iconName as 'home'} size={name === 'Add' ? 28 : 24} color={color} />
              <AppText style={[tabBarStyles.label, { color }]}>{label}</AppText>
            </Pressable>
          );
        })}
      </View>
      <RecordsTabBarPopup
        visible={recordsPopupVisible}
        onClose={() => setRecordsPopupVisible(false)}
        onSelectInvoices={selectInvoices}
        onSelectSales={selectSales}
      />
      <AddTabBarPopup
        visible={addPopupVisible}
        onClose={() => setAddPopupVisible(false)}
        onSelectInvoice={selectAddInvoice}
        onSelectSale={selectAddSale}
      />
    </>
  );
}

const tabBarStyles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingBottom: 24,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabPressed: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  label: {
    fontSize: 11,
    marginTop: 4,
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
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
    </AddPreferredProvider>
  );
}
