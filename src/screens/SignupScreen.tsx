import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import type { AccountKind } from '../types';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '../theme/design';

const TRIAL_PREF_KEY = 'summit_subscribe_with_trial';

const KIND_OPTIONS: {
  kind: AccountKind;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    kind: 'individual',
    title: 'Just for me',
    body: 'Track personal income and spending.',
    icon: 'person-outline',
  },
  {
    kind: 'business',
    title: 'Business owner',
    body: 'I run a business and want invoices & sales in one place.',
    icon: 'storefront-outline',
  },
  {
    kind: 'practice',
    title: 'Practice (accountant)',
    body: 'I manage multiple clients and hand businesses to owners when ready.',
    icon: 'briefcase-outline',
  },
];

export default function SignupScreen({ navigation }: { navigation: { navigate: (s: string) => void } }) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [accountKind, setAccountKind] = useState<AccountKind>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (accountKind === 'business' && !businessName.trim()) {
      Alert.alert('Error', 'Please enter your business name.');
      return;
    }
    setLoading(true);
    try {
      const result = await signup(email.trim(), password, {
        accountKind,
        businessName: accountKind === 'practice' ? undefined : businessName.trim() || undefined,
        businessAddress: accountKind === 'practice' ? undefined : businessAddress.trim() || undefined,
      });
      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Signup failed.');
      } else {
        await AsyncStorage.setItem(TRIAL_PREF_KEY, 'false');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.title}>Create account</AppText>
        <AppText style={styles.subtitle}>Tell us how you’ll use Summit</AppText>

        <AppText style={styles.sectionLabel}>I’m signing up as</AppText>
        {KIND_OPTIONS.map((opt) => {
          const selected = accountKind === opt.kind;
          return (
            <TouchableOpacity
              key={opt.kind}
              style={[styles.kindCard, selected && styles.kindCardSelected]}
              onPress={() => setAccountKind(opt.kind)}
              activeOpacity={0.88}
            >
              <View style={[styles.kindIconWrap, selected && styles.kindIconWrapSelected]}>
                <Ionicons name={opt.icon} size={22} color={selected ? '#fff' : PRIMARY} />
              </View>
              <View style={styles.kindTextCol}>
                <AppText style={styles.kindTitle}>{opt.title}</AppText>
                <AppText style={styles.kindBody}>{opt.body}</AppText>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
              ) : (
                <View style={styles.kindRadioOuter}>
                  <View style={styles.kindRadioInner} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholderTextColor={TEXT_MUTED}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholderTextColor={TEXT_MUTED}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          placeholderTextColor={TEXT_MUTED}
        />

        {accountKind !== 'practice' && (
          <>
            <AppText style={styles.sectionLabel}>
              {accountKind === 'business' ? 'Business details' : 'Business (optional)'}
            </AppText>
            <TextInput
              style={styles.input}
              placeholder={accountKind === 'business' ? 'Business name *' : 'Business name — optional'}
              value={businessName}
              onChangeText={setBusinessName}
              placeholderTextColor={TEXT_MUTED}
            />
            <TextInput
              style={styles.input}
              placeholder="Business address"
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholderTextColor={TEXT_MUTED}
            />
            {accountKind === 'individual' && (
              <AppText style={styles.fieldHint}>
                You can add a business later from Home → Switch business.
              </AppText>
            )}
          </>
        )}

        {accountKind === 'practice' && (
          <View style={styles.practiceInfo}>
            <Ionicons name="information-circle-outline" size={22} color={PRIMARY} style={styles.practiceInfoIcon} />
            <AppText style={styles.practiceInfoText}>
              After you subscribe, open Switch business → Add client business. You’ll enter each client’s email and
              get a claim code to send them. Once they claim, they become the business owner and you keep access to
              help with tax and books.
            </AppText>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handleSignup}
          disabled={loading}
          style={styles.gradientWrap}
        >
          <LinearGradient
            colors={[PRIMARY, PURPLE_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText style={styles.buttonText}>Sign Up</AppText>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <AppText style={styles.link}>Already have an account? Sign in</AppText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 10,
    marginTop: 8,
  },
  kindCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: BORDER,
  },
  kindCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: MUTED_CARD,
  },
  kindIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: MUTED_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kindIconWrapSelected: {
    backgroundColor: PRIMARY,
  },
  kindTextCol: { flex: 1 },
  kindTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 2 },
  kindBody: { fontSize: 13, fontWeight: '500', color: TEXT_MUTED, lineHeight: 18 },
  kindRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  fieldHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: -6,
    marginBottom: 8,
    lineHeight: 18,
  },
  practiceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  practiceInfoIcon: { marginRight: 10, marginTop: 2 },
  practiceInfoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    color: TEXT,
    marginBottom: 14,
    fontSize: 16,
  },
  gradientWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
