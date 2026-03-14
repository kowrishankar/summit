import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPasswordScreen({
  navigation,
  route,
}: {
  navigation: { navigate: (s: string) => void };
  route: { params?: { token?: string } };
}) {
  const { resetPassword } = useAuth();
  const token = route.params?.token ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Error', 'Invalid or expired reset link.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const ok = await resetPassword(token, password);
      if (ok) {
        Alert.alert('Success', 'Password updated. You can sign in now.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Error', 'Invalid or expired reset link.');
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
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your new password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Back to sign in</Text>
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
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    color: '#0f172a',
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
