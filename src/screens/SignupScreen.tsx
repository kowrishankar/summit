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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import { STRIPE_TRIAL_DAYS } from '../config/trial';

const TRIAL_PREF_KEY = 'summit_subscribe_with_trial';

export default function SignupScreen({ navigation }: { navigation: { navigate: (s: string) => void } }) {
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppText style={styles.title}>Create account</AppText>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
      />
      <AppText style={styles.paymentHint}>
        
      </AppText>
      <AppText style={styles.sectionLabel}>Business details</AppText>
      <TextInput
        style={styles.input}
        placeholder="Business name *"
        value={businessName}
        onChangeText={setBusinessName}
        placeholderTextColor="#64748b"
      />
      <TextInput
        style={styles.input}
        placeholder="Business address"
        value={businessAddress}
        onChangeText={setBusinessAddress}
        placeholderTextColor="#64748b"
      />
      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <AppText style={styles.buttonText}>Sign Up</AppText>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <AppText style={styles.link}>Already have an account? Sign in</AppText>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 8,
  },
  paymentHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trialTextCol: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  trialHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  trialSwitch: {
    marginLeft: 8,
  },
  input: {
    backgroundColor: 'beige',
    borderRadius: 12,
    padding: 16,
    color: 'black',
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#818cf8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
