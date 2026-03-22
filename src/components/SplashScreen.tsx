import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AppText from './AppText';
import { PAGE_BG, PRIMARY, TEXT, TEXT_SECONDARY } from '../theme/design';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <AppText style={styles.appName}>Summit</AppText>
      <AppText style={styles.tagline}>Your finances, one view.</AppText>
      <ActivityIndicator size="large" color={PRIMARY} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PAGE_BG,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginTop: 8,
  },
  spinner: {
    marginTop: 48,
  },
});
