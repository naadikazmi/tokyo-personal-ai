import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';
import type { AvatarState } from '../../types/app';

const stateCopy: Record<AvatarState, { label: string; detail: string }> = {
  idle: { label: 'Tokyo online', detail: 'Calm, ready, and watching context.' },
  listening: { label: 'Tokyo listening', detail: 'Input detected. Preparing context.' },
  thinking: { label: 'Tokyo is thinking', detail: 'Reasoning through the next reply.' },
  speaking: { label: 'Tokyo speaking', detail: 'Voice and mouth animation placeholder active.' },
  happy: { label: 'Task completed', detail: 'Tokyo marked the last action complete.' },
  serious: { label: 'Serious mode', detail: 'Emergency safety posture is active.' },
  warning: { label: 'Emergency lock active', detail: 'Sensitive capabilities are paused.' },
  surprised: { label: 'Tokyo surprised', detail: 'New context or an unexpected result needs attention.' },
  caring: { label: 'Tokyo caring', detail: 'Gentle support mode for sensitive or personal work.' },
  error: { label: 'Tokyo needs attention', detail: 'An error or unavailable service was detected.' },
};

type Props = {
  state: AvatarState;
};

export function TokyoStatus({ state }: Props) {
  const copy = stateCopy[state];

  return (
    <View style={[styles.card, (state === 'warning' || state === 'serious') && styles.warning, state === 'error' && styles.error]}>
      <Text style={styles.label}>{copy.label}</Text>
      <Text style={styles.detail}>{copy.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceGlass,
  },
  warning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  error: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  detail: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
});
