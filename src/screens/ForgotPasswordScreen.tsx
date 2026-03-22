import React, { useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
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

export default function ForgotPasswordScreen({
  navigation,
}: {
  navigation: { navigate: (s: string, p?: { token: string }) => void };
}) {
  const insets = useSafeAreaInsets();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.ok) {
        Alert.alert(
          'Done',
          'If an account exists, you will receive reset instructions by email. Open the link to set a new password.'
        );
        navigation.navigate('Login');
      } else {
        Alert.alert('Error', result.error ?? 'Something went wrong.');
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
        <AppText style={styles.title}>Forgot password</AppText>
        <AppText style={styles.subtitle}>Enter your email to receive a reset link</AppText>
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
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handleSubmit}
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
              <AppText style={styles.buttonText}>Send reset link</AppText>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <AppText style={styles.link}>Back to sign in</AppText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: PAGE_BG },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: TEXT, marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '500', color: TEXT_SECONDARY, marginBottom: 32 },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    color: TEXT,
    marginBottom: 16,
    fontSize: 16,
  },
  gradientWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 24 },
  button: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: PRIMARY, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
