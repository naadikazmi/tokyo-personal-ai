import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TokyoAvatar } from '../avatar/TokyoAvatar';
import { colors, spacing } from '../../lib/theme';
import type { AvatarState } from '../../types/app';
import { EmergencyLockCard } from './EmergencyLockCard';

type Props = {
  assistantName: string;
  avatarAnimation: boolean;
  avatarState: AvatarState;
  avatarVisible: boolean;
  emergencyLocked: boolean;
  onToggleEmergencyLock: () => void;
  onSignOut: () => void;
  signOutLabel: string;
};

export function TopBar({
  assistantName,
  avatarAnimation,
  avatarState,
  avatarVisible,
  emergencyLocked,
  onToggleEmergencyLock,
  onSignOut,
  signOutLabel,
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.brandLine}>
        {avatarVisible ? <TokyoAvatar compact state={avatarState} animated={avatarAnimation} /> : null}
        <View>
          <Text style={styles.title}>Tokyo Personal AI</Text>
          <Text style={styles.subtitle}>{assistantName} is your cinematic browser-first AI command center</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <EmergencyLockCard locked={emergencyLocked} onPress={onToggleEmergencyLock} />
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.logout}>
          <Text style={styles.logoutText}>{signOutLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  logout: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  logoutText: {
    color: colors.muted,
    fontWeight: '900',
  },
});
