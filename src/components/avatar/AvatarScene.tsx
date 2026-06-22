import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';
import type { AvatarState } from '../../types/app';
import { TokyoModelStage } from './TokyoModelStage';

type Props = {
  state: AvatarState;
  animationEnabled?: boolean;
  onOpenChat?: () => void;
};

const signals = ['Neural link stable', 'Voice layer staged', 'Memory-aware', 'Local safe mode'];

export function AvatarScene({ state, animationEnabled = true, onOpenChat }: Props) {
  return (
    <View style={styles.scene}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Tokyo live interface</Text>
        <Text style={styles.title}>A living AI presence for your browser workspace</Text>
        <Text style={styles.body}>
          Tokyo reacts to typing, replies, emergency lock, task completion, and errors with visible expression changes,
          voice-level motion, and a holographic avatar stage.
        </Text>
        <View style={styles.signalGrid}>
          {signals.map((signal) => (
            <View key={signal} style={styles.signal}>
              <View style={styles.signalDot} />
              <Text style={styles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
        {onOpenChat ? (
          <Pressable onPress={onOpenChat} style={styles.cta}>
            <Text style={styles.ctaText}>Open live chat</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.avatarColumn}>
        <TokyoModelStage state={state} animated={animationEnabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    minHeight: 380,
    padding: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  copy: {
    minWidth: 300,
    flex: 1.15,
    gap: spacing.md,
  },
  avatarColumn: {
    minWidth: 280,
    flex: 0.85,
    alignItems: 'center',
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  body: {
    maxWidth: 620,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  signal: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  signalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  signalText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  ctaText: {
    color: colors.background,
    fontWeight: '900',
  },
});
