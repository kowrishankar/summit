import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AppText from './AppText';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <AppText style={styles.appName}>Summit</AppText>
      <AppText style={styles.tagline}>Your finances, one view.</AppText>
      <ActivityIndicator size="large" color="#818cf8" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 8,
  },
  spinner: {
    marginTop: 48,
  },
});
