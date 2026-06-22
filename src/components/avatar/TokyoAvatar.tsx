import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../lib/theme';
import type { AvatarState } from '../../types/app';
import { TokyoStatus } from './TokyoStatus';

type Props = {
  state: AvatarState;
  animated?: boolean;
  compact?: boolean;
};

type Mood = {
  aura: string;
  auraSoft: string;
  hair: string;
  face: string;
  suit: string;
  mouth: string;
  browTilt: string;
  leftEye: string;
  rightEye: string;
  mouthShape: 'calm' | 'open' | 'smile' | 'flat' | 'error';
};

export function TokyoAvatar({ state, animated = true, compact = false }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const mood = useMemo(() => getMood(state), [state]);

  useEffect(() => {
    if (!animated) {
      pulse.stopAnimation();
      scan.stopAnimation();
      pulse.setValue(0);
      scan.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: state === 'speaking' ? 320 : 1150, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: state === 'speaking' ? 320 : 1150, useNativeDriver: false }),
      ]),
    );
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 2100, useNativeDriver: false }),
        Animated.timing(scan, { toValue: 0, duration: 1, useNativeDriver: false }),
      ]),
    );
    pulseLoop.start();
    scanLoop.start();
    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [animated, pulse, scan, state]);

  const avatarScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: compact ? [0.32, state === 'speaking' ? 0.34 : 0.33] : [1, state === 'speaking' ? 1.045 : 1.018],
  });
  const floatY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, compact ? -1 : -7] });
  const auraOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, state === 'speaking' ? 0.88 : 0.58] });
  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [compact ? -40 : -120, compact ? 44 : 138] });
  const mouthHeight = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [mouthBaseHeight(mood.mouthShape), state === 'speaking' ? 19 : mouthBaseHeight(mood.mouthShape) + 2],
  });
  const panelWidth = compact ? 78 : 252;
  const panelHeight = compact ? 78 : 306;

  return (
    <View style={[styles.wrap, compact && styles.compactWrap]}>
      <View style={[styles.stage, compact && styles.compactStage, { width: panelWidth, height: panelHeight }]}>
        <Animated.View
          style={[
            styles.aura,
            compact && styles.compactAura,
            { backgroundColor: mood.auraSoft, opacity: auraOpacity, transform: [{ scale: avatarScale }] },
          ]}
        />
        <View style={[styles.holoGrid, compact && styles.compactHoloGrid]}>
          <View style={[styles.gridLine, { backgroundColor: mood.aura }]} />
          <View style={[styles.gridLine, { backgroundColor: mood.aura }]} />
          <View style={[styles.gridLine, { backgroundColor: mood.aura }]} />
        </View>
        <Animated.View
          style={[styles.scanLine, compact && styles.compactScanLine, { backgroundColor: mood.aura, transform: [{ translateY: scanY }] }]}
        />

        <Animated.View
          style={[
            styles.avatar,
            compact && styles.compactAvatar,
            { transform: [{ translateY: floatY }, { scale: avatarScale }] },
          ]}
        >
          <View style={[styles.hairBack, { backgroundColor: mood.hair }]} />
          <View style={[styles.hairShine, { backgroundColor: mood.aura }]} />
          <View style={[styles.hairSweep, { backgroundColor: mood.hair }]} />
          <View style={[styles.hairSide, styles.leftHair, { backgroundColor: mood.hair }]} />
          <View style={[styles.hairSide, styles.rightHair, { backgroundColor: mood.hair }]} />
          <View style={[styles.face, { backgroundColor: mood.face, borderColor: mood.aura }]}>
            <View style={styles.faceHighlight} />
            <View style={styles.browRow}>
              <View style={[styles.brow, { backgroundColor: mood.hair, transform: [{ rotate: mood.browTilt }] }]} />
              <View style={[styles.brow, { backgroundColor: mood.hair, transform: [{ rotate: oppositeTilt(mood.browTilt) }] }]} />
            </View>
            <View style={styles.eyes}>
              <View style={[styles.eye, state === 'happy' && styles.happyEye, (state === 'serious' || state === 'warning') && styles.seriousEye]}>
                <View style={[styles.eyeLight, { backgroundColor: mood.leftEye }]} />
              </View>
              <View style={[styles.eye, state === 'error' && styles.errorEye, state === 'happy' && styles.happyEye, (state === 'serious' || state === 'warning') && styles.seriousEye]}>
                <View style={[styles.eyeLight, { backgroundColor: mood.rightEye }]} />
              </View>
            </View>
            <View style={styles.nose} />
            <View style={styles.noseLight} />
            <Animated.View
              style={[
                styles.mouth,
                mouthStyle(mood.mouthShape),
                { height: mouthHeight, backgroundColor: mood.mouth, borderColor: mood.aura },
              ]}
            />
            <View style={styles.jawShade} />
            <View style={[styles.cheek, styles.leftCheek, { backgroundColor: mood.aura }]} />
            <View style={[styles.cheek, styles.rightCheek, { backgroundColor: mood.aura }]} />
          </View>
          <View style={[styles.neck, { backgroundColor: mood.face }]} />
          <View style={[styles.shoulders, { backgroundColor: mood.suit, borderColor: mood.aura }]}>
            <View style={styles.leftLapel} />
            <View style={styles.rightLapel} />
            <View style={[styles.collar, { borderTopColor: mood.aura }]} />
            <View style={[styles.core, { backgroundColor: mood.aura }]} />
            <VoiceBars active={state === 'speaking' || state === 'thinking' || state === 'listening'} color={mood.aura} pulse={pulse} />
          </View>
          <View style={[styles.baseGlow, { backgroundColor: mood.aura }]} />
        </Animated.View>
      </View>

      {!compact ? (
        <>
          <View style={styles.identity}>
            <Text style={styles.name}>Tokyo</Text>
            <Text style={styles.spec}>Cinematic AI assistant</Text>
          </View>
          <TokyoStatus state={state} />
        </>
      ) : null}
    </View>
  );
}

function VoiceBars({ active, color, pulse }: { active: boolean; color: string; pulse: Animated.Value }) {
  const barA = pulse.interpolate({ inputRange: [0, 1], outputRange: [6, active ? 19 : 8] });
  const barB = pulse.interpolate({ inputRange: [0, 1], outputRange: [13, active ? 5 : 12] });
  const barC = pulse.interpolate({ inputRange: [0, 1], outputRange: [8, active ? 24 : 9] });

  return (
    <View style={styles.voiceBars}>
      <Animated.View style={[styles.voiceBar, { height: barA, backgroundColor: color }]} />
      <Animated.View style={[styles.voiceBar, { height: barB, backgroundColor: color }]} />
      <Animated.View style={[styles.voiceBar, { height: barC, backgroundColor: color }]} />
    </View>
  );
}

function getMood(state: AvatarState): Mood {
  if (state === 'error') {
    return {
      aura: colors.danger,
      auraSoft: '#4A1020',
      hair: '#141420',
      face: '#E8B9A5',
      suit: '#241824',
      mouth: colors.danger,
      browTilt: '-15deg',
      leftEye: colors.danger,
      rightEye: colors.warning,
      mouthShape: 'error',
    };
  }
  if (state === 'warning' || state === 'serious') {
    return {
      aura: colors.warning,
      auraSoft: '#4A370D',
      hair: '#111620',
      face: '#EBC2AC',
      suit: '#292417',
      mouth: colors.warning,
      browTilt: '-10deg',
      leftEye: colors.warning,
      rightEye: colors.warning,
      mouthShape: 'flat',
    };
  }
  if (state === 'surprised') {
    return {
      aura: colors.primary,
      auraSoft: '#102A4A',
      hair: '#151024',
      face: '#F0C7B1',
      suit: '#17253A',
      mouth: colors.primary,
      browTilt: '14deg',
      leftEye: '#FFFFFF',
      rightEye: colors.primary,
      mouthShape: 'open',
    };
  }
  if (state === 'caring') {
    return {
      aura: '#F8A7D8',
      auraSoft: '#3D1730',
      hair: '#181221',
      face: '#F2C9B5',
      suit: '#24172D',
      mouth: '#F8A7D8',
      browTilt: '6deg',
      leftEye: '#F8A7D8',
      rightEye: colors.primary,
      mouthShape: 'smile',
    };
  }
  if (state === 'happy') {
    return {
      aura: colors.success,
      auraSoft: '#0E402A',
      hair: '#111827',
      face: '#F2C9B5',
      suit: '#102A22',
      mouth: colors.success,
      browTilt: '8deg',
      leftEye: colors.success,
      rightEye: colors.success,
      mouthShape: 'smile',
    };
  }
  if (state === 'speaking') {
    return {
      aura: colors.accent,
      auraSoft: '#44103C',
      hair: '#15152A',
      face: '#F0C7B1',
      suit: '#1A1D36',
      mouth: colors.accent,
      browTilt: '3deg',
      leftEye: colors.primary,
      rightEye: colors.accent,
      mouthShape: 'open',
    };
  }
  if (state === 'listening' || state === 'thinking') {
    return {
      aura: colors.primary,
      auraSoft: '#073642',
      hair: '#101827',
      face: '#F0C7B1',
      suit: '#132336',
      mouth: colors.primary,
      browTilt: state === 'thinking' ? '-5deg' : '4deg',
      leftEye: colors.primary,
      rightEye: colors.primary,
      mouthShape: 'calm',
    };
  }
  return {
    aura: colors.primary,
    auraSoft: '#092A36',
    hair: '#111827',
    face: '#F0C7B1',
    suit: '#132336',
    mouth: colors.primary,
    browTilt: '0deg',
    leftEye: colors.primary,
    rightEye: colors.primary,
    mouthShape: 'calm',
  };
}

function mouthBaseHeight(shape: Mood['mouthShape']) {
  if (shape === 'open') return 8;
  if (shape === 'smile') return 7;
  if (shape === 'flat') return 4;
  if (shape === 'error') return 10;
  return 5;
}

function oppositeTilt(tilt: string) {
  return tilt.startsWith('-') ? tilt.slice(1) : `-${tilt}`;
}

function mouthStyle(shape: Mood['mouthShape']) {
  if (shape === 'smile') return styles.smileMouth;
  if (shape === 'flat') return styles.flatMouth;
  if (shape === 'error') return styles.errorMouth;
  if (shape === 'open') return styles.openMouth;
  return styles.calmMouth;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  compactWrap: {
    gap: 0,
  },
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  compactStage: {
    borderRadius: 8,
  },
  aura: {
    position: 'absolute',
    width: 202,
    height: 202,
    borderRadius: 101,
    bottom: 42,
  },
  compactAura: {
    width: 64,
    height: 64,
    borderRadius: 32,
    bottom: 8,
  },
  holoGrid: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 24,
    height: 76,
    opacity: 0.16,
    justifyContent: 'space-between',
  },
  compactHoloGrid: {
    left: 8,
    right: 8,
    bottom: 8,
    height: 30,
  },
  gridLine: {
    height: 1,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.5,
  },
  compactScanLine: {
    height: 1,
  },
  avatar: {
    width: 184,
    height: 262,
    alignItems: 'center',
  },
  compactAvatar: {
    width: 176,
    height: 262,
  },
  hairBack: {
    position: 'absolute',
    top: 8,
    width: 142,
    height: 154,
    borderTopLeftRadius: 76,
    borderTopRightRadius: 76,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
  },
  hairShine: {
    position: 'absolute',
    top: 26,
    left: 72,
    width: 46,
    height: 118,
    borderRadius: 28,
    opacity: 0.14,
    transform: [{ rotate: '16deg' }],
  },
  hairSweep: {
    position: 'absolute',
    top: 24,
    left: 36,
    width: 92,
    height: 48,
    borderTopLeftRadius: 54,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 18,
    transform: [{ rotate: '-13deg' }],
  },
  hairSide: {
    position: 'absolute',
    top: 70,
    width: 34,
    height: 106,
    borderRadius: 24,
  },
  leftHair: {
    left: 18,
    transform: [{ rotate: '6deg' }],
  },
  rightHair: {
    right: 18,
    transform: [{ rotate: '-6deg' }],
  },
  face: {
    marginTop: 34,
    width: 98,
    height: 120,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  faceHighlight: {
    position: 'absolute',
    top: 9,
    left: 16,
    width: 28,
    height: 86,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    opacity: 0.09,
  },
  browRow: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 20,
  },
  brow: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  eyes: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 21,
  },
  eye: {
    width: 15,
    height: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05070E',
    borderWidth: 1,
    borderColor: '#263247',
  },
  happyEye: {
    height: 6,
    borderRadius: 4,
  },
  seriousEye: {
    height: 5,
    borderRadius: 3,
  },
  errorEye: {
    transform: [{ rotate: '24deg' }],
  },
  eyeLight: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nose: {
    marginTop: 12,
    width: 8,
    height: 16,
    borderRadius: 5,
    backgroundColor: '#DDAA96',
    opacity: 0.58,
  },
  noseLight: {
    marginTop: -13,
    marginLeft: 8,
    width: 2,
    height: 11,
    borderRadius: 2,
    backgroundColor: '#FFE0D2',
    opacity: 0.55,
  },
  mouth: {
    marginTop: 15,
    width: 30,
    borderWidth: 1,
  },
  calmMouth: {
    borderRadius: 8,
  },
  openMouth: {
    borderRadius: 12,
  },
  smileMouth: {
    borderTopWidth: 0,
    borderRadius: 14,
  },
  flatMouth: {
    borderRadius: 3,
  },
  errorMouth: {
    width: 20,
    borderRadius: 4,
    transform: [{ rotate: '-10deg' }],
  },
  cheek: {
    position: 'absolute',
    bottom: 34,
    width: 12,
    height: 7,
    borderRadius: 6,
    opacity: 0.24,
  },
  leftCheek: {
    left: 16,
  },
  rightCheek: {
    right: 16,
  },
  jawShade: {
    position: 'absolute',
    bottom: 0,
    width: 72,
    height: 18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#C98F7F',
    opacity: 0.12,
  },
  neck: {
    width: 32,
    height: 22,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  shoulders: {
    width: 156,
    height: 90,
    borderTopLeftRadius: 52,
    borderTopRightRadius: 52,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 16,
    overflow: 'hidden',
  },
  leftLapel: {
    position: 'absolute',
    top: 18,
    left: 35,
    width: 34,
    height: 68,
    backgroundColor: '#05070E',
    opacity: 0.34,
    transform: [{ rotate: '18deg' }],
  },
  rightLapel: {
    position: 'absolute',
    top: 18,
    right: 35,
    width: 34,
    height: 68,
    backgroundColor: '#05070E',
    opacity: 0.34,
    transform: [{ rotate: '-18deg' }],
  },
  collar: {
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.75,
  },
  core: {
    marginTop: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  voiceBars: {
    marginTop: 10,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voiceBar: {
    width: 4,
    borderRadius: 2,
    opacity: 0.86,
  },
  baseGlow: {
    position: 'absolute',
    bottom: -2,
    width: 154,
    height: 8,
    borderRadius: 8,
    opacity: 0.45,
  },
  identity: {
    alignItems: 'center',
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  spec: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
