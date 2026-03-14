import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Modal, Pressable } from 'react-native';
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
import AddChoiceScreen from '../screens/AddChoiceScreen';
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
                <Text style={{ color: '#6366f1', fontWeight: '600', fontSize: 16 }}>Edit</Text>
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
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#0f172a' }}>
      <Stack.Screen name="AddChoice" component={AddChoiceScreen} options={{ title: 'Add' }} />
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
          <TouchableOpacity
            style={popupStyles.option}
            onPress={() => {
              onSelectInvoices();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color="#818cf8" />
            <Text style={popupStyles.optionText}>Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={popupStyles.option}
            onPress={() => {
              onSelectSales();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trending-up-outline" size={20} color="#22c55e" />
            <Text style={popupStyles.optionText}>Sales</Text>
          </TouchableOpacity>
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
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});

function CustomTabBar(props: React.ComponentProps<ReturnType<typeof Tab>['Navigator']>['tabBar']) {
  const [recordsPopupVisible, setRecordsPopupVisible] = useState(false);
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

  return (
    <>
      <View style={[tabBarStyles.tabBarContainer, { paddingBottom: Math.max(8, insets.bottom) }]}>
        {state.routeNames.map((name, index) => {
          const isRecords = name === RECORDS_TAB_NAME;
          const isFocused = state.index === index;
          const label = name === 'Dashboard' ? 'Home' : name === RECORDS_TAB_NAME ? 'Invoices & Sales' : name;
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
            <TouchableOpacity
              key={name}
              style={tabBarStyles.tab}
              onPress={() => {
                if (isRecords) {
                  setRecordsPopupVisible(true);
                } else {
                  navigation.navigate(name);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={iconName as 'home'} size={name === 'Add' ? 28 : 24} color={color} />
              <Text style={[tabBarStyles.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <RecordsTabBarPopup
        visible={recordsPopupVisible}
        onClose={() => setRecordsPopupVisible(false)}
        onSelectInvoices={selectInvoices}
        onSelectSales={selectSales}
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
