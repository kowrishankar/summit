import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

export default function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.uppercase, style]} />;
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
  lowercase: { textTransform: 'lowercase' },
});
