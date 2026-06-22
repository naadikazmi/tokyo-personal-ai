import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '../lib/theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: Props) {
  if (!scroll) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
