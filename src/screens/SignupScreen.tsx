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
    title: 'Personal',
    body: 'Track your own income and spending. After sign-up you’ll subscribe to Summit. No inviting others or joining teams.',
    icon: 'person-outline',
  },
  {
    kind: 'business',
    title: 'Business',
    body: 'Invoices and sales for your business. After sign-up you’ll subscribe to Summit. Solo account—no invites or joining teams.',
    icon: 'storefront-outline',
  },
  {
    kind: 'practice',
    title: 'Practice',
    body: 'Accountants: add client businesses at no extra fee on your plan; clients claim with a code. You subscribe for your practice workspace.',
    icon: 'briefcase-outline',
  },
];

type SignupPath = 'standard' | 'claim';

export default function SignupScreen({ navigation }: { navigation: { navigate: (s: string) => void } }) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [signupPath, setSignupPath] = useState<SignupPath>('standard');
  const [accountKind, setAccountKind] = useState<AccountKind>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [claimCode, setClaimCode] = useState('');
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
    if (signupPath === 'claim') {
      if (!claimCode.trim()) {
        Alert.alert('Error', 'Enter the claim code your accountant sent you.');
        return;
      }
    } else if (accountKind === 'business' && !businessName.trim()) {
      Alert.alert('Error', 'Please enter your business name.');
      return;
    }
    setLoading(true);
    try {
      const result = await signup(email.trim(), password, {
        accountKind: signupPath === 'claim' ? 'business' : accountKind,
        businessName:
          signupPath === 'claim' ? undefined : accountKind === 'practice' ? undefined : businessName.trim() || undefined,
        businessAddress:
          signupPath === 'claim' ? undefined : accountKind === 'practice' ? undefined : businessAddress.trim() || undefined,
        claimHandoffToken: signupPath === 'claim' ? claimCode.trim() : undefined,
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
        <AppText style={styles.subtitle}>
          {signupPath === 'claim'
            ? 'Claim the workspace your accountant set up — no separate Summit payment.'
            : 'Tell us how you’ll use Summit'}
        </AppText>

        <AppText style={styles.sectionLabel}>How are you joining?</AppText>
        <TouchableOpacity
          style={[styles.pathCard, signupPath === 'standard' && styles.pathCardSelected]}
          onPress={() => setSignupPath('standard')}
          activeOpacity={0.88}
        >
          <View style={[styles.kindIconWrap, signupPath === 'standard' && styles.kindIconWrapSelected]}>
            <Ionicons name="person-add-outline" size={22} color={signupPath === 'standard' ? '#fff' : PRIMARY} />
          </View>
          <View style={styles.kindTextCol}>
            <AppText style={styles.kindTitle}>New Account</AppText>
            <AppText style={styles.kindBody}>Personal, business, or practice—then subscribe (except claim path)</AppText>
          </View>
          {signupPath === 'standard' ? (
            <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
          ) : (
            <View style={styles.kindRadioOuter}>
              <View style={styles.kindRadioInner} />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pathCard, signupPath === 'claim' && styles.pathCardSelected]}
          onPress={() => setSignupPath('claim')}
          activeOpacity={0.88}
        >
          <View style={[styles.kindIconWrap, signupPath === 'claim' && styles.kindIconWrapSelected]}>
            <Ionicons name="ribbon-outline" size={22} color={signupPath === 'claim' ? '#fff' : PRIMARY} />
          </View>
          <View style={styles.kindTextCol}>
            <AppText style={styles.kindTitle}>Invited by Practice</AppText>
            <AppText style={styles.kindBody}>
              Your accountant already pays for your workspace on their practice plan. Use the email they used for you
              and the claim code they sent.
            </AppText>
          </View>
          {signupPath === 'claim' ? (
            <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
          ) : (
            <View style={styles.kindRadioOuter}>
              <View style={styles.kindRadioInner} />
            </View>
          )}
        </TouchableOpacity>

        {signupPath === 'standard' && (
          <>
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
          </>
        )}

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

        {signupPath === 'claim' && (
          <>
            <AppText style={styles.sectionLabel}>Claim code</AppText>
            <TextInput
              style={styles.input}
              placeholder="Paste claim code from your accountant"
              value={claimCode}
              onChangeText={setClaimCode}
              placeholderTextColor={TEXT_MUTED}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.practiceInfo}>
              <Ionicons name="information-circle-outline" size={22} color={PRIMARY} style={styles.practiceInfoIcon} />
              <AppText style={styles.practiceInfoText}>
                Your sign-up email must match the one your accountant entered for you. After you create your account,
                we’ll claim the business in one step — you won’t be asked to pay for Summit yourself.
              </AppText>
            </View>
          </>
        )}

        {signupPath === 'standard' && accountKind !== 'practice' && (
          <>
            <AppText style={styles.sectionLabel}>
              {accountKind === 'business' ? 'Business details' : 'Business (optional for personal)'}
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

        {signupPath === 'standard' && accountKind === 'practice' && (
          <View style={styles.practiceInfo}>
            <Ionicons name="information-circle-outline" size={22} color={PRIMARY} style={styles.practiceInfoIcon} />
            <AppText style={styles.practiceInfoText}>
              After you subscribe, add client businesses from Switch business (no extra fee per client on your plan).
              Each client gets a claim code to sign up without paying for Summit themselves. You can edit their
              workspace name and address anytime.
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
              <AppText style={styles.buttonText}>{signupPath === 'claim' ? 'Create account & claim' : 'Sign Up'}</AppText>
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
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: BORDER,
  },
  pathCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: MUTED_CARD,
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
