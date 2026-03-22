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
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import {
  BORDER,
  CARD_BG,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '../theme/design';

const TRIAL_PREF_KEY = 'summit_subscribe_with_trial';

export default function SignupScreen({ navigation }: { navigation: { navigate: (s: string) => void } }) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [startWithTrial, setStartWithTrial] = useState(false);

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
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter your business name.');
      return;
    }
    setLoading(true);
    try {
      const result = await signup(email.trim(), password, businessName.trim(), businessAddress.trim());
      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Signup failed.');
      } else {
        await AsyncStorage.setItem(TRIAL_PREF_KEY, startWithTrial ? 'true' : 'false');
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
        <AppText style={styles.subtitle}>Start tracking invoices and sales</AppText>
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
        <AppText style={styles.sectionLabel}>Business details</AppText>
        <TextInput
          style={styles.input}
          placeholder="Business name *"
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
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 10,
    marginTop: 8,
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
