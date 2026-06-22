import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { notifyUser } from '../lib/dialogs';
import { defaultPermissionSettings, permissionDefinitions } from '../lib/localDemo';
import { getEffectivePermissionSettings, riskyPermissionKeys, updateEffectivePermissionSetting } from '../lib/permissions';
import { colors, spacing } from '../lib/theme';
import type { PermissionKey, PermissionSettings } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  userId: string;
};

export function AccessScreen({ emergencyLocked, userId }: Props) {
  const [settings, setSettings] = useState<PermissionSettings>({ ...defaultPermissionSettings });

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    setSettings(await getEffectivePermissionSettings(userId));
  };

  const toggle = async (key: PermissionKey) => {
    if (emergencyLocked && riskyPermissionKeys.includes(key)) {
      notifyUser('Emergency lock active', 'Unlock emergency lock before enabling sensitive permissions.');
      return;
    }

    const definition = permissionDefinitions.find((item) => item.key === key);
    const nextValue = !settings[key];
    if (nextValue && (definition?.risk_level === 'high' || definition?.risk_level === 'critical')) {
      notifyUser(
        'Explicit approval required',
        `${definition.label} is high risk. Tokyo still requires a visible approval card before any matching action runs.`,
      );
    }

    setSettings({ ...settings, [key]: nextValue });

    try {
      setSettings(await updateEffectivePermissionSetting(userId, settings, key, nextValue));
      logActivity(userId, 'permission_changed', `${key}: ${nextValue ? 'on' : 'off'}`, {
        risk_level: definition?.risk_level,
      });
    } catch (error) {
      console.error('Could not update permission:', error);
      notifyUser('Could not update permission', error instanceof Error ? error.message : 'Try again later.');
      loadSettings();
    }
  };

  const activePermissions = permissionDefinitions.filter((definition) => settings[definition.key]).map((definition) => definition.label);

  return (
    <Screen>
      <Text style={styles.heading}>Permission Control</Text>
      <Text style={styles.help}>
        Laptop actions pass these gates plus a visible chat approval step. Tokyo can open allowlisted apps/websites and
        use local notes/planner safely; file access is limited to a safe folder.
      </Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Active permissions</Text>
        <Text style={styles.statusText}>{activePermissions.join(', ') || 'None'}</Text>
      </View>
      {emergencyLocked ? (
        <View style={styles.lockCard}>
          <Text style={styles.lockTitle}>Emergency lock is active</Text>
          <Text style={styles.lockText}>Risky permissions are forced off until you unlock.</Text>
        </View>
      ) : null}

      {permissionDefinitions.map((row) => (
        <ToggleRow
          key={row.key}
          label={row.label}
          description={row.description}
          risk={row.risk_level}
          value={Boolean(settings[row.key])}
          onPress={() => toggle(row.key)}
        />
      ))}
    </Screen>
  );
}

function ToggleRow({
  label,
  description,
  risk,
  value,
  onPress,
}: {
  label: string;
  description: string;
  risk: string;
  value: boolean;
  onPress: () => void;
}) {
  const dangerous = risk === 'high' || risk === 'critical';
  return (
    <Pressable onPress={onPress} style={[styles.row, dangerous && styles.dangerRow]}>
      <View style={styles.rowCopy}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowText}>{label}</Text>
          <Text style={[styles.risk, dangerous && styles.riskDanger]}>{risk}</Text>
        </View>
        <Text style={styles.description}>{description}</Text>
        {dangerous ? <Text style={styles.warningLabel}>Requires visible approval before any action can run.</Text> : null}
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  help: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: colors.muted,
    lineHeight: 20,
  },
  statusCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  statusTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusText: {
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  lockCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  lockTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  lockText: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  row: {
    minHeight: 74,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dangerRow: {
    borderColor: colors.warning,
  },
  rowCopy: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: {
    color: colors.text,
    fontWeight: '800',
  },
  risk: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  riskDanger: {
    color: colors.warning,
  },
  description: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  warningLabel: {
    color: colors.warning,
    marginTop: spacing.xs,
    fontWeight: '800',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: colors.border,
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
  },
  knobOn: {
    marginLeft: 22,
  },
});
