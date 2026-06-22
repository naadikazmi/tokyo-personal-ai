import { Pressable, StyleSheet, Text, View } from 'react-native';

import { logActivity } from '../lib/activity';
import { colors, spacing } from '../lib/theme';

type Props = {
  locked: boolean;
  userId: string;
  onToggle: () => void;
};

export function EmergencyLockBanner({ locked, userId, onToggle }: Props) {
  const handleToggle = () => {
    onToggle();
    logActivity(userId, locked ? 'emergency_lock_disabled' : 'emergency_lock_enabled');
  };

  return (
    <View style={[styles.banner, locked && styles.lockedBanner]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{locked ? 'Emergency lock is on' : 'Emergency lock'}</Text>
        <Text style={styles.detail}>
          {locked ? 'AI chat is paused until you unlock it.' : 'Stops assistant chat actions immediately.'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={handleToggle}
        style={[styles.button, locked && styles.unlockButton]}
      >
        <Text style={[styles.buttonText, locked && styles.unlockText]}>{locked ? 'Unlock' : 'Lock'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lockedBanner: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  detail: {
    color: colors.muted,
    marginTop: 2,
  },
  button: {
    minWidth: 78,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  unlockButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  unlockText: {
    color: colors.danger,
  },
});
