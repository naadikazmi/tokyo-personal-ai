import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TokyoModelStage } from '../components/avatar/TokyoModelStage';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { activateLocalAvatar, getLocalAvatars, isDemoUserId, saveLocalAvatar } from '../lib/localDemo';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { AvatarProfile, AvatarState } from '../types/app';

type Props = {
  userId: string;
  onAvatarChanged?: (avatar: AvatarProfile) => void;
};

const previewStates: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking', 'happy', 'serious', 'warning'];

export function AvatarModelSettingsScreen({ userId, onAvatarChanged }: Props) {
  const [state, setState] = useState<AvatarState>('idle');
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftStyle, setDraftStyle] = useState('');
  const [draftAccent, setDraftAccent] = useState('');
  const [draftVoice, setDraftVoice] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    loadAvatars();
  }, [userId]);

  const loadAvatars = async () => {
    if (!isSupabaseConfigured || isDemoUserId(userId)) {
      setAvatars(await getLocalAvatars(userId));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setAvatars(await getLocalAvatars(userId));
      return;
    }
    const { data, error } = await supabase.from('avatars').select('*').eq('user_id', userId).order('created_at');
    if (error || !data || data.length === 0) {
      if (error) console.error('Could not load Supabase avatars:', error);
      const local = await getLocalAvatars(userId);
      setAvatars(local);
      setNotice('Local avatar mode active. Run the Supabase avatar migration to store avatars in Supabase.');
      return;
    }
    setNotice('');
    setAvatars(data as AvatarProfile[]);
  };

  const editAvatar = (avatar: AvatarProfile) => {
    setEditingId(avatar.id);
    setDraftName(avatar.name);
    setDraftStyle(avatar.appearance.visual_style);
    setDraftAccent(avatar.appearance.accent_color);
    setDraftVoice(avatar.voice_style ?? '');
  };

  const saveAvatar = async () => {
    const avatar = avatars.find((item) => item.id === editingId);
    if (!avatar) return;
    const patch = {
      name: draftName.trim() || avatar.name,
      appearance: {
        ...avatar.appearance,
        visual_style: draftStyle.trim() || avatar.appearance.visual_style,
        accent_color: draftAccent.trim() || avatar.appearance.accent_color,
      },
      voice_style: draftVoice.trim() || null,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && !isDemoUserId(userId) && supabase) {
      const { error } = await supabase.from('avatars').update(patch).eq('id', avatar.id);
      if (error) {
        console.error('Could not update Supabase avatar:', error);
        setNotice('Avatar saved locally because Supabase avatars are unavailable.');
      }
    }

    const next = await saveLocalAvatar(userId, avatar.id, patch);
    setAvatars(next);
    setEditingId(null);
    logActivity(userId, 'avatar_changed', patch.name);
  };

  const activateAvatar = async (avatar: AvatarProfile) => {
    const supabase = getSupabase();
    if (isSupabaseConfigured && !isDemoUserId(userId) && supabase) {
      const { error: clearError } = await supabase.from('avatars').update({ is_active: false }).eq('user_id', userId);
      const { error: activeError } = await supabase.from('avatars').update({ is_active: true }).eq('id', avatar.id);
      if (clearError || activeError) {
        console.error('Could not activate Supabase avatar:', clearError || activeError);
        setNotice('Avatar activation saved locally because Supabase avatars are unavailable.');
      }
    }
    const next = await activateLocalAvatar(userId, avatar.id);
    setAvatars(next);
    onAvatarChanged?.(next.find((item) => item.id === avatar.id) ?? avatar);
    logActivity(userId, 'avatar_changed', avatar.name, { active: true });
  };

  const activeAvatar = avatars.find((avatar) => avatar.is_active) ?? avatars[0];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.heading}>AI Avatars</Text>
          <Text style={styles.help}>
            Original assistant avatars only. Tokyo uses a general cinematic fearless rebel vibe without copying any
            protected face, outfit, identity, or character.
          </Text>
          {activeAvatar ? <Text style={styles.activeText}>Active avatar: {activeAvatar.name}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
        <TokyoModelStage state={state} animated />
      </View>

      <View style={styles.statePanel}>
        <Text style={styles.sectionTitle}>Expression preview</Text>
        <View style={styles.stateGrid}>
          {previewStates.map((item) => (
            <Pressable key={item} onPress={() => setState(item)} style={[styles.stateButton, state === item && styles.activeStateButton]}>
              <Text style={[styles.stateText, state === item && styles.activeStateText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {avatars.map((avatar) => (
          <View key={avatar.id} style={[styles.card, avatar.is_active && { borderColor: avatar.appearance.accent_color }]}>
            <Text style={styles.cardTitle}>{avatar.name}</Text>
            <Text style={styles.role}>{avatar.appearance.role}</Text>
            <Text style={styles.text}>{avatar.personality}</Text>
            <Text style={styles.meta}>Look: {avatar.appearance.visual_style}</Text>
            <Text style={styles.meta}>Accent: {avatar.appearance.accent_color}</Text>
            <Text style={styles.meta}>Voice: {avatar.voice_style ?? 'Not set'}</Text>
            <View style={styles.actions}>
              <PrimaryButton tone={avatar.is_active ? 'neutral' : 'primary'} title={avatar.is_active ? 'Active' : 'Activate'} onPress={() => activateAvatar(avatar)} />
              <PrimaryButton tone="neutral" title="Edit" onPress={() => editAvatar(avatar)} />
            </View>
          </View>
        ))}
      </View>

      {editingId ? (
        <View style={styles.editor}>
          <Text style={styles.sectionTitle}>Edit avatar</Text>
          <TextInput placeholder="Name" placeholderTextColor={colors.muted} value={draftName} onChangeText={setDraftName} style={styles.input} />
          <TextInput placeholder="Visual style" placeholderTextColor={colors.muted} value={draftStyle} onChangeText={setDraftStyle} style={styles.input} />
          <TextInput placeholder="Accent color" placeholderTextColor={colors.muted} value={draftAccent} onChangeText={setDraftAccent} style={styles.input} />
          <TextInput placeholder="Voice style" placeholderTextColor={colors.muted} value={draftVoice} onChangeText={setDraftVoice} style={styles.input} />
          <PrimaryButton title="Save avatar" onPress={saveAvatar} />
          <PrimaryButton tone="neutral" title="Cancel" onPress={() => setEditingId(null)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 340,
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
    flex: 1,
    gap: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  activeText: {
    color: colors.primary,
    fontWeight: '900',
  },
  notice: {
    color: colors.warning,
    lineHeight: 20,
  },
  statePanel: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceGlass,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stateButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  activeStateButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  stateText: {
    color: colors.muted,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  activeStateText: {
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    minWidth: 250,
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  role: {
    color: colors.primary,
    fontWeight: '900',
  },
  text: {
    color: colors.text,
    lineHeight: 20,
  },
  meta: {
    color: colors.muted,
    lineHeight: 19,
  },
  actions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  editor: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
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
});
