import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';

export function LoadingState({ label = 'Loading Tokyo workspace...' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    color: colors.muted,
  },
});
