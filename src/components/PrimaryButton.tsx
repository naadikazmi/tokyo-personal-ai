import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../lib/theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
};

export function PrimaryButton({ title, onPress, disabled, tone = 'primary' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' && styles.danger,
        tone === 'neutral' && styles.neutral,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, tone === 'danger' && styles.dangerText, tone === 'neutral' && styles.neutralText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  neutral: {
    backgroundColor: colors.surfaceAlt,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
  text: {
    color: colors.background,
    fontWeight: '700',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  neutralText: {
    color: colors.text,
  },
});
