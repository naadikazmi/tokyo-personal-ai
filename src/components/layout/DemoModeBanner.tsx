import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';

export function DemoModeBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Local mode active — cloud sync disabled.</Text>
      <Text style={styles.text}>
        Supabase is not connected. Tokyo stores memories, settings, permissions, planner tasks, research history, logs,
        and chat in this browser.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceGlass,
  },
  title: {
    color: colors.text,
    fontWeight: '900',
  },
  text: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
