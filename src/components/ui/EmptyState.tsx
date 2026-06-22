import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontWeight: '900',
  },
  detail: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
