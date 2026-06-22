import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { apiBaseUrl, getSettingsStatus } from '../lib/api';
import { logActivity } from '../lib/activity';
import { notifyUser } from '../lib/dialogs';
import { getLocalUserSettings, saveLocalUserSettings } from '../lib/localDemo';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { AssistantTone, SystemHealth, ThemeMode, UserSettings } from '../types/app';

type Props = {
  onSettingsSaved?: (settings: UserSettings) => void;
  emergencyLocked: boolean;
  onSignOut: () => void;
  userEmail: string;
  userId: string;
};

const tones: AssistantTone[] = ['Friendly', 'Professional', 'Caring', 'Funny', 'Strict/productive'];
const themeModes: ThemeMode[] = ['Cinematic', 'Dark', 'System'];

export function SettingsScreen({ emergencyLocked, onSettingsSaved, onSignOut, userEmail, userId }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [assistantName, setAssistantName] = useState('Tokyo');
  const [tone, setTone] = useState<AssistantTone>('Friendly');
  const [assistantStyle, setAssistantStyle] = useState('');
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [avatarAnimation, setAvatarAnimation] = useState(true);
  const [voiceModePlaceholder, setVoiceModePlaceholder] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('Cinematic');
  const [safeWorkspaceFolder, setSafeWorkspaceFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    getLocalUserSettings(userId).then((settings) => {
      setDisplayName(settings.display_name);
      setAssistantName(settings.assistant_name);
      setTone(settings.tone);
      setAssistantStyle(settings.assistant_style);
      setAvatarVisible(settings.avatar_visible ?? true);
      setAvatarAnimation(settings.avatar_animation ?? true);
      setVoiceModePlaceholder(settings.voice_mode_placeholder ?? true);
      setThemeMode(settings.theme_mode ?? 'Cinematic');
      setSafeWorkspaceFolder(settings.safe_workspace_folder ?? '');
    });
    getSettingsStatus()
      .then(setHealth)
      .catch((error) => {
        console.error('Could not load settings status:', error);
        setHealth(null);
      });
  }, [userId]);

  const saveSettings = async () => {
    if (!displayName.trim() || !assistantName.trim() || !assistantStyle.trim()) {
      notifyUser('Missing details', 'Add your display name, assistant name, and assistant personality.');
      return;
    }

    setSaving(true);
    const saved = await saveLocalUserSettings(userId, {
      display_name: displayName.trim(),
      assistant_name: assistantName.trim(),
      tone,
      assistant_style: assistantStyle.trim(),
      avatar_visible: avatarVisible,
      avatar_animation: avatarAnimation,
      voice_mode_placeholder: voiceModePlaceholder,
      theme_mode: themeMode,
      safe_workspace_folder: safeWorkspaceFolder.trim(),
    });
    setSaving(false);
    logActivity(userId, 'settings_changed', `${assistantName.trim()} | ${tone}`);
    onSettingsSaved?.(saved);
    notifyUser('Settings saved', 'Your Tokyo settings were saved in this browser.');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{userEmail}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.label}>Assistant name</Text>
          <TextInput
            placeholder="Tokyo"
            placeholderTextColor={colors.muted}
            value={assistantName}
            onChangeText={setAssistantName}
            style={styles.input}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Your display name</Text>
          <TextInput
            placeholder="Display name"
            placeholderTextColor={colors.muted}
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Assistant personality tone</Text>
        <View style={styles.wrap}>
          {tones.map((item) => (
            <Pill key={item} label={item} active={tone === item} onPress={() => setTone(item)} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Assistant personality</Text>
        <TextInput
          multiline
          placeholder="Assistant personality"
          placeholderTextColor={colors.muted}
          value={assistantStyle}
          onChangeText={setAssistantStyle}
          style={[styles.input, styles.textArea]}
        />
      </View>

      <View style={styles.grid}>
        <ToggleCard title="Avatar visibility" value={avatarVisible} onPress={() => setAvatarVisible(!avatarVisible)} />
        <ToggleCard title="Avatar animation" value={avatarAnimation} onPress={() => setAvatarAnimation(!avatarAnimation)} />
        <ToggleCard
          title="Voice mode placeholder"
          value={voiceModePlaceholder}
          onPress={() => setVoiceModePlaceholder(!voiceModePlaceholder)}
          detail="Coming soon: connect a speech service before microphone or speaker output is enabled."
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Theme mode</Text>
        <View style={styles.wrap}>
          {themeModes.map((item) => (
            <Pill key={item} label={item} active={themeMode === item} onPress={() => setThemeMode(item)} />
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.label}>AI connected</Text>
          <Text style={styles.value}>{health?.ai.connected ? 'Connected' : 'Not connected'}</Text>
          <Text style={styles.detail}>{health?.ai.message ?? 'Start the API server to check AI status.'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Research connected</Text>
          <Text style={styles.value}>{health?.research.connected ? 'Connected' : 'Not connected'}</Text>
          <Text style={styles.detail}>{health?.research.message ?? 'Start the API server to check research status.'}</Text>
        </View>
        <View style={[styles.card, emergencyLocked && styles.warningCard]}>
          <Text style={styles.label}>Emergency lock status</Text>
          <Text style={styles.value}>{emergencyLocked ? 'Active' : 'Off'}</Text>
          <Text style={styles.detail}>
            {emergencyLocked ? 'Sensitive permissions are paused until you unlock.' : 'Sensitive permissions are available under your settings.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Backend and secret setup</Text>
        <Text style={styles.value}>API base URL: {apiBaseUrl}</Text>
        <Text style={styles.detail}>OpenAI API key: set OPENAI_API_KEY in .env on the API server only.</Text>
        <Text style={styles.detail}>Model name: set OPENAI_MODEL in .env.</Text>
        <Text style={styles.detail}>Research provider/key: set RESEARCH_PROVIDER and RESEARCH_API_KEY in .env.</Text>
        <Text style={styles.detail}>Supabase URL/anon key: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the browser.</Text>
        <Text style={styles.detail}>Supabase service key: set SUPABASE_SERVICE_ROLE_KEY in .env for the API server only.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Safe file workspace</Text>
        <TextInput
          placeholder="Example: C:\\Users\\hp\\Documents\\Tokyo Workspace"
          placeholderTextColor={colors.muted}
          value={safeWorkspaceFolder}
          onChangeText={setSafeWorkspaceFolder}
          style={styles.input}
        />
        <Text style={styles.detail}>
          File search/open/create actions are disabled until this folder is set, and every file action still requires approval.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Safety scope</Text>
        <Text style={styles.value}>
          This app does not delete files, send messages, run system commands, access private data, or control devices.
          Future powerful actions must require permission gates, visible approval, activity logs, and emergency lock.
        </Text>
      </View>

      <PrimaryButton disabled={saving} title={saving ? 'Saving...' : 'Save settings'} onPress={saveSettings} />
      <View style={styles.gap} />
      <PrimaryButton tone="danger" title={isSupabaseConfigured ? 'Log out' : 'Exit demo mode'} onPress={onSignOut} />
    </Screen>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.activePill]}>
      <Text style={[styles.pillText, active && styles.activePillText]}>{label}</Text>
    </Pressable>
  );
}

function ToggleCard({ title, value, onPress, detail }: { title: string; value: boolean; onPress: () => void; detail?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.value}>{value ? 'On' : 'Off'}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
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
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    minWidth: 240,
    flex: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  warningCard: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    lineHeight: 21,
  },
  detail: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
  },
  textArea: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  activePill: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  pillText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activePillText: {
    color: colors.text,
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
  gap: {
    height: spacing.sm,
  },
});
