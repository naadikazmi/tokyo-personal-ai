import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { notifyUser } from '../lib/dialogs';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { getLocalChatMessages, saveLocalChatMessages, saveLocalNote } from '../lib/localDemo';
import { colors, spacing } from '../lib/theme';
import type { AppTab } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  onNavigate: (tab: AppTab) => void;
  userId: string;
};

export function ClipboardScreen({ emergencyLocked, onNavigate, userId }: Props) {
  const [clipboardAllowed, setClipboardAllowed] = useState(false);
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');

  useEffect(() => {
    getEffectivePermissionSettings(userId).then((settings) => setClipboardAllowed(settings.clipboard_helper));
  }, [userId]);

  const blocked = emergencyLocked || !clipboardAllowed;

  const pasteClipboard = async () => {
    if (blocked) {
      notifyUser('Clipboard blocked', emergencyLocked ? 'Emergency Lock is active.' : 'Enable Clipboard helper in Permissions first.');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      notifyUser('Clipboard unavailable', 'This browser/runtime does not expose clipboard read access.');
      return;
    }
    try {
      const value = await navigator.clipboard.readText();
      setText(value);
      setOutput('');
      await logActivity(userId, 'clipboard_pasted_by_user', `${value.length} characters`, { risk_level: 'medium' });
    } catch (error) {
      notifyUser('Clipboard read failed', error instanceof Error ? error.message : 'The runtime blocked clipboard access.');
    }
  };

  const transform = async (mode: 'summarize' | 'professional' | 'shorter' | 'friendly' | 'grammar' | 'urdu' | 'romanUrdu') => {
    if (!text.trim()) {
      notifyUser('Text required', 'Paste or type clipboard text first.');
      return;
    }
    const value = applyClipboardMode(text, mode);
    setOutput(value);
    await logActivity(userId, `clipboard_${mode}`, `${text.trim().length} characters`);
  };

  const saveAsNote = async () => {
    const value = output.trim() || text.trim();
    if (!value) {
      notifyUser('Nothing to save', 'Paste clipboard text or generate output first.');
      return;
    }
    await saveLocalNote(userId, {
      title: `Clipboard ${new Date().toLocaleString()}`,
      content: value,
      source: 'manual',
      category: 'Other',
      pinned: false,
    });
    await logActivity(userId, 'clipboard_saved_to_note', `${value.length} characters`);
    notifyUser('Saved', 'Clipboard text was saved to Notes.');
  };

  const sendToChat = async () => {
    const value = output.trim() || text.trim();
    if (!value) {
      notifyUser('Nothing to send', 'Paste clipboard text or generate output first.');
      return;
    }
    const messages = await getLocalChatMessages(userId);
    await saveLocalChatMessages(userId, [
      ...messages,
      {
        id: `${Date.now()}-clipboard-chat`,
        role: 'user',
        content: `Use this clipboard text:\n\n${value}`,
        created_at: new Date().toISOString(),
      },
    ]);
    await logActivity(userId, 'clipboard_sent_to_chat', `${value.length} characters`);
    onNavigate('chat');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Clipboard Helper</Text>
      <Text style={styles.help}>Tokyo reads clipboard text only when you press Paste. It never polls clipboard automatically.</Text>
      {blocked ? (
        <Text style={styles.warning}>
          {emergencyLocked ? 'Emergency Lock is active. Clipboard helper is disabled.' : 'Clipboard helper permission is off.'}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton disabled={blocked} title="Paste clipboard text" onPress={pasteClipboard} />
        <PrimaryButton tone="neutral" title="Summarize" onPress={() => transform('summarize')} />
        <PrimaryButton tone="neutral" title="Rewrite professionally" onPress={() => transform('professional')} />
        <PrimaryButton tone="neutral" title="Make shorter" onPress={() => transform('shorter')} />
        <PrimaryButton tone="neutral" title="Make friendly" onPress={() => transform('friendly')} />
        <PrimaryButton tone="neutral" title="Fix grammar" onPress={() => transform('grammar')} />
        <PrimaryButton tone="neutral" title="Translate to Urdu" onPress={() => transform('urdu')} />
        <PrimaryButton tone="neutral" title="Roman Urdu" onPress={() => transform('romanUrdu')} />
        <PrimaryButton tone="neutral" title="Save to Notes" onPress={saveAsNote} />
        <PrimaryButton tone="neutral" title="Send to Chat" onPress={sendToChat} />
      </View>

      <TextInput
        multiline
        placeholder="Clipboard text appears here, or type/paste manually."
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        style={[styles.input, styles.textArea]}
      />

      {output ? (
        <View style={styles.outputCard}>
          <Text style={styles.outputTitle}>Result</Text>
          <Text style={styles.output}>{output}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function applyClipboardMode(text: string, mode: 'summarize' | 'professional' | 'shorter' | 'friendly' | 'grammar' | 'urdu' | 'romanUrdu') {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (mode === 'summarize') {
    return `Summary:\n${clean.split(/[.!?]\s+/).filter(Boolean).slice(0, 3).join('. ') || clean.slice(0, 280)}`;
  }
  if (mode === 'professional') return `Professional rewrite:\n${clean.replace(/^./, (char) => char.toUpperCase())}`;
  if (mode === 'shorter') return `Shorter version:\n${clean.length > 220 ? `${clean.slice(0, 217)}...` : clean}`;
  if (mode === 'friendly') return `Friendly version:\nHi, ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
  if (mode === 'grammar') return `Grammar-fixed draft:\n${clean.replace(/\bi\b/g, 'I').replace(/\s+([,.!?])/g, '$1')}`;
  if (mode === 'urdu') return 'Urdu translation helper:\nLocal mode cannot perform full translation reliably yet. Paste this into Chat with OpenAI enabled for high-quality Urdu translation, or ask Tokyo to translate key phrases.';
  return `Roman Urdu helper:\nLocal mode suggestion: rewrite the message in simple spoken Urdu using English letters. For accurate translation, enable OpenAI and ask Chat to translate:\n\n${clean}`;
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  warning: {
    color: colors.warning,
    marginBottom: spacing.md,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textArea: {
    minHeight: 180,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  outputCard: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  outputTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  output: {
    color: colors.text,
    lineHeight: 22,
  },
});
