import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render errors so release builds don’t stay on a blank white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>{this.state.error.message}</Text>
          <Text style={styles.hint}>
            If this is a store / preview build, confirm EXPO_PUBLIC_* variables are set in Expo (EAS) and rebuild.
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  hint: { fontSize: 13, color: '#94a3b8', lineHeight: 20 },
});
