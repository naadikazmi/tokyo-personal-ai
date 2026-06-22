import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../lib/theme';
import { PrimaryButton } from './PrimaryButton';

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Tokyo recovered from a screen error:', error.message, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Tokyo hit a temporary screen error</Text>
          <Text style={styles.message}>
            The app is still running. Try returning to the dashboard, or restart Expo if this keeps happening.
          </Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          <PrimaryButton title="Try again" onPress={this.reset} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  message: {
    color: colors.muted,
    lineHeight: 21,
  },
  detail: {
    color: colors.warning,
    lineHeight: 20,
  },
});
