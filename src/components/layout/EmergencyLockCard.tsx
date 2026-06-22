import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';

type Props = {
  locked: boolean;
  onPress: () => void;
};

export function EmergencyLockCard({ locked, onPress }: Props) {
  return (
    <View style={[styles.card, locked && styles.locked]}>
      <View>
        <Text style={styles.label}>{locked ? 'Emergency lock active' : 'Emergency lock off'}</Text>
        <Text style={styles.detail}>{locked ? 'Sensitive systems are paused.' : 'Permissions follow your settings.'}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, locked && styles.unlock]}>
        <Text style={[styles.buttonText, locked && styles.unlockText]}>{locked ? 'Unlock' : 'Lock'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 220,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceGlass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  locked: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  label: {
    color: colors.text,
    fontWeight: '900',
  },
  detail: {
    color: colors.muted,
    marginTop: 2,
  },
  button: {
    minWidth: 74,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  unlock: {
    backgroundColor: colors.surfaceAlt,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  unlockText: {
    color: colors.text,
  },
});
