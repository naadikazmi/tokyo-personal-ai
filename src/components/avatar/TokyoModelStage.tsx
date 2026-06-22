import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';
import type { AvatarState } from '../../types/app';
import { TokyoAvatar } from './TokyoAvatar';

type Props = {
  state: AvatarState;
  animated?: boolean;
  compact?: boolean;
};

export function TokyoModelStage({ state, animated = true, compact = false }: Props) {
  return (
    <View style={[styles.stage, compact && styles.compactStage]}>
      <View style={styles.depthPlaneBack} />
      <View style={styles.depthPlaneMid} />
      <View style={styles.depthPlaneFront} />
      <TokyoAvatar state={state} animated={animated} compact={compact} />
      {!compact ? (
        <View style={styles.modelMeta}>
          <Text style={styles.metaTitle}>Original Tokyo AI model</Text>
          <Text style={styles.metaText}>Premium browser-safe avatar fallback</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    minWidth: 286,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  compactStage: {
    minWidth: 78,
    padding: 0,
  },
  depthPlaneBack: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    opacity: 0.7,
    transform: [{ rotate: '8deg' }, { scale: 0.94 }],
  },
  depthPlaneMid: {
    position: 'absolute',
    width: 256,
    height: 256,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    opacity: 0.25,
    transform: [{ rotate: '-5deg' }, { scale: 0.98 }],
  },
  depthPlaneFront: {
    position: 'absolute',
    width: 276,
    height: 276,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    opacity: 0.14,
    transform: [{ rotate: '2deg' }],
  },
  modelMeta: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  metaTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  metaText: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 12,
  },
});
