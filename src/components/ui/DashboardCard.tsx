import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';

type Props = PropsWithChildren<{
  title: string;
  value: string;
  detail?: string;
  accent?: 'cyan' | 'pink' | 'green' | 'yellow' | 'red';
  onPress?: () => void;
}>;

export function DashboardCard({ title, value, detail, accent = 'cyan', onPress, children }: Props) {
  const content = (
    <>
      <View style={[styles.accent, styles[accent]]} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={(state) => {
          const hovered = 'hovered' in state && Boolean(state.hovered);
          return [styles.card, hovered && styles.hovered, state.pressed && styles.pressed];
        }}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    minWidth: 220,
    flex: 1,
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceGlass,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.82,
  },
  hovered: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  accent: {
    width: 34,
    height: 3,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  cyan: {
    backgroundColor: colors.primary,
  },
  pink: {
    backgroundColor: colors.accent,
  },
  green: {
    backgroundColor: colors.success,
  },
  yellow: {
    backgroundColor: colors.warning,
  },
  red: {
    backgroundColor: colors.danger,
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  detail: {
    color: colors.muted,
    lineHeight: 20,
  },
});
