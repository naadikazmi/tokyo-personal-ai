import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TokyoModelStage } from '../components/avatar/TokyoModelStage';
import { PrimaryButton } from '../components/PrimaryButton';
import { detectActionIntent, executePendingAction } from '../lib/actions';
import { logActivity } from '../lib/activity';
import { sendAssistantMessage } from '../lib/assistant';
import { confirmAction } from '../lib/dialogs';
import { classifySafetyIntent } from '../lib/safety';
import {
  clearLocalChatMessages,
  defaultPermissionSettings,
  defaultUserSettings,
  getLocalChatMessages,
  getLocalMemories,
  isDemoUserId,
  getLocalUserSettings,
  saveLocalNote,
  saveLocalChatMessages,
} from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { AppTab, AvatarState, ChatMessage, Memory, PendingAction, PermissionSettings, UserSettings } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  onAvatarStateChange?: (state: AvatarState) => void;
  onNavigate: (tab: AppTab) => void;
  userId: string;
};

const quickActions: Array<{ label: string; prompt?: string; tab?: AppTab }> = [
  { label: 'Plan my day', prompt: 'Plan my day with a practical schedule and priorities.' },
  { label: 'Create note', prompt: 'Create a note: ' },
  { label: 'Add task', prompt: 'Add task: ' },
  { label: 'Open Notepad', prompt: 'Open Notepad' },
  { label: 'Open YouTube', prompt: 'Open YouTube' },
  { label: 'Study mode', tab: 'study' },
  { label: 'Coding help', tab: 'coding' },
  { label: 'Search memories', prompt: 'Search my memories for ' },
  { label: 'Workspace', tab: 'workspace' },
  { label: 'Permissions', tab: 'permissions' },
];

const fallbackPermissionsForUser = (userId: string): PermissionSettings => ({
  ...defaultPermissionSettings,
});

const fallbackSettingsForUser = (userId: string): UserSettings => ({
  id: `${userId}-settings`,
  user_id: userId,
  ...defaultUserSettings,
  updated_at: new Date().toISOString(),
});

export function ChatScreen({ emergencyLocked, onAvatarStateChange, onNavigate, userId }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [permissions, setPermissions] = useState<PermissionSettings>(() => fallbackPermissionsForUser(userId));
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => fallbackSettingsForUser(userId));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryReady, setChatHistoryReady] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [memoryFallbackActive, setMemoryFallbackActive] = useState(false);
  const [demoAiActive, setDemoAiActive] = useState(false);
  const [chatWarning, setChatWarning] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const sendInFlightRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    setPermissionsReady(false);
    setChatHistoryReady(false);
    setPermissions(fallbackPermissionsForUser(userId));
    setSettings(fallbackSettingsForUser(userId));
    setMemoryFallbackActive(false);
    setDemoAiActive(false);
    setChatWarning('');
    setValidationMessage('');
    loadContext();
  }, [userId]);

  useEffect(() => {
    if (emergencyLocked) {
      updateAvatarState('warning');
      return;
    }
    if (avatarState === 'warning') {
      updateAvatarState('idle');
    }
  }, [emergencyLocked]);

  useEffect(() => {
    if (!emergencyLocked && input.trim() && !loading) {
      updateAvatarState('listening');
    }
    if (!emergencyLocked && !input.trim() && avatarState === 'listening') {
      updateAvatarState('idle');
    }
  }, [input, loading]);

  useEffect(() => {
    if (!chatHistoryReady) return;
    const timeout = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 30);
    return () => clearTimeout(timeout);
  }, [chatHistoryReady, messages.length, loading]);

  const updateAvatarState = (state: AvatarState) => {
    setAvatarState(state);
    onAvatarStateChange?.(state);
  };

  const loadContext = async () => {
    const localSettings = await getLocalUserSettings(userId);
    setSettings(localSettings);

    if (!isSupabaseConfigured || isDemoUserId(userId)) {
      setMemoryFallbackActive(true);
      setMemories((await getLocalMemories(userId)).filter((memory) => memory.enabled !== false));
      setPermissions(await getEffectivePermissionSettings(userId));
      setPermissionsReady(true);
      const savedMessages = await getLocalChatMessages(userId);
      setMessages(savedMessages.length > 0 ? savedMessages : welcomeMessages(localSettings.assistant_name));
      setChatHistoryReady(true);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMemoryFallbackActive(true);
      setMemories((await getLocalMemories(userId)).filter((memory) => memory.enabled !== false));
      setPermissions(await getEffectivePermissionSettings(userId));
      setPermissionsReady(true);
      const savedMessages = await getLocalChatMessages(userId);
      setMessages(savedMessages.length > 0 ? savedMessages : welcomeMessages(localSettings.assistant_name));
      setChatHistoryReady(true);
      return;
    }
    const [{ data: memoryData, error: memoryError }, savedMessages, effectivePermissions] = await Promise.all([
      supabase.from('memories').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      getLocalChatMessages(userId),
      getEffectivePermissionSettings(userId),
    ]);

    if (memoryError) {
      console.warn('Could not load Supabase memories for chat, using local fallback:', memoryError);
      setMemories((await getLocalMemories(userId)).filter((memory) => memory.enabled !== false));
      setMemoryFallbackActive(true);
    } else {
      setMemories(memoryData ?? []);
      setMemoryFallbackActive(false);
    }
    setPermissions(effectivePermissions);
    setPermissionsReady(true);
    setMessages(savedMessages.length > 0 ? savedMessages : welcomeMessages(localSettings.assistant_name));
    setChatHistoryReady(true);
  };

  const sendBlockedReason = emergencyLocked
    ? null
    : permissions?.chat_only === false
      ? 'Chat permission is turned off. Open Permissions to enable it.'
      : !permissionsReady
        ? 'Chat permissions are loading.'
      : null;
  const draftMessage = input.trim();
  const isEmptyMessage = draftMessage.length === 0;
  const chatPermissionEnabled = permissions.chat_only !== false;
  const canEditComposer = chatPermissionEnabled && !loading;

  const persistMessages = async (nextMessages: ChatMessage[]) => {
    setMessages(nextMessages);
    await saveLocalChatMessages(userId, nextMessages);
  };

  const saveMessageToSupabase = async (message: ChatMessage) => {
    if (message.role === 'action') return;
    if (!isSupabaseConfigured || isDemoUserId(userId)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      role: message.role,
      content: message.content,
    });
    if (error) {
      console.warn('Could not save chat message to Supabase. Local chat history is still saved:', error);
    }
  };

  const send = async () => {
    if (sendInFlightRef.current) return;
    if (sendBlockedReason) {
      setChatWarning(sendBlockedReason);
      updateAvatarState('warning');
      return;
    }
    if (isEmptyMessage) {
      setValidationMessage('Type a message before sending.');
      updateAvatarState('serious');
      return;
    }
    if (!chatHistoryReady) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: draftMessage,
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    await persistMessages(nextMessages);
    await saveMessageToSupabase(userMessage);
    setInput('');
    setValidationMessage('');

    const safety = classifySafetyIntent(userMessage.content);
    if (safety.blocked || safety.educationalReply) {
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-safety`,
        role: 'assistant',
        content: safety.educationalReply,
        created_at: new Date().toISOString(),
      };
      await persistMessages([...nextMessages, assistantMessage]);
      await logActivity(userId, 'safety_filtered', safety.reason || 'educational_framing');
      updateAvatarState('serious');
      setTimeout(() => updateAvatarState(emergencyLocked ? 'warning' : 'idle'), 1400);
      return;
    }

    const action = detectActionIntent({
      emergencyLocked,
      permissions,
      text: userMessage.content,
    });
    if (action) {
      if (messages.some((message) => message.action && actionSignature(message.action) === actionSignature(action) && message.action.status === 'completed')) {
        const assistantMessage: ChatMessage = {
          id: `${Date.now()}-action-duplicate`,
          role: 'assistant',
          content: `That action was already completed recently: ${action.title}. Send a more specific request if you want to run a different action.`,
          created_at: new Date().toISOString(),
        };
        await persistMessages([...nextMessages, assistantMessage]);
        return;
      }
      const actionMessage: ChatMessage = {
        id: action.id,
        role: 'action',
        content: action.description,
        action,
        created_at: new Date().toISOString(),
      };
      await persistMessages([...nextMessages, actionMessage]);
      await logActivity(userId, 'action_requested', action.title, { kind: action.kind, risk_level: action.risk_level });
      updateAvatarState(action.kind === 'unsupported' ? 'warning' : 'serious');
      setTimeout(() => updateAvatarState(emergencyLocked ? 'warning' : 'idle'), 1200);
      return;
    }

    sendInFlightRef.current = true;
    setLoading(true);
    setChatWarning('');
    updateAvatarState('thinking');

    try {
      const { reply, mode } = await sendAssistantMessage(nextMessages, memories, permissions, settings);
      setDemoAiActive(mode === 'demo');
      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: reply,
        created_at: new Date().toISOString(),
      };
      const finalMessages = [
        ...nextMessages,
        assistantMessage,
      ];
      await persistMessages(finalMessages);
      await saveMessageToSupabase(assistantMessage);
      updateAvatarState('speaking');
      setTimeout(() => updateAvatarState('idle'), 1600);
      void logActivity(userId, 'chat_message_sent', userMessage.content.slice(0, 140));
      void logActivity(userId, 'ai_response_generated', reply.slice(0, 140));
    } catch (error) {
      updateAvatarState('error');
      const message = error instanceof Error ? error.message : 'Assistant request failed. Check backend logs.';
      setChatWarning(message);
      console.error('Assistant request failed:', error);
    } finally {
      sendInFlightRef.current = false;
      setLoading(false);
    }
  };

  const updateActionMessage = async (actionId: string, patch: Partial<PendingAction>, resultMessage?: ChatMessage) => {
    const nextMessages = messages.map((message) => {
      if (message.action?.id !== actionId) return message;
      const nextAction = { ...message.action, ...patch };
      return {
        ...message,
        action: nextAction,
        action_result: resultMessage?.action_result ?? message.action_result,
      };
    });
    const withResult = resultMessage ? [...nextMessages, resultMessage] : nextMessages;
    await persistMessages(withResult);
  };

  const approveAction = async (action: PendingAction) => {
    if (action.status !== 'pending') return;
    if (action.kind === 'unsupported') {
      await cancelAction(action, 'Dismissed blocked action.');
      return;
    }

    await updateActionMessage(action.id, { status: 'approved' });
    updateAvatarState('thinking');

    try {
      const actionWithSafeFolder: PendingAction = settings.safe_workspace_folder
        ? { ...action, payload: { ...action.payload, safeFolder: settings.safe_workspace_folder } }
        : action;
      const result = await executePendingAction(userId, actionWithSafeFolder);
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-action-result`,
        role: 'assistant',
        content: result.message,
        action_result: result,
        created_at: new Date().toISOString(),
      };
      await updateActionMessage(action.id, { status: result.ok ? 'completed' : 'failed' }, assistantMessage);
      if (action.kind === 'save_memory') {
        setMemories((await getLocalMemories(userId)).filter((memory) => memory.enabled !== false));
      }
      updateAvatarState(result.ok ? 'happy' : 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-action-failed`,
        role: 'assistant',
        content: message,
        action_result: { ok: false, message },
        created_at: new Date().toISOString(),
      };
      await updateActionMessage(action.id, { status: 'failed' }, assistantMessage);
      await logActivity(userId, 'action_failed', message, { kind: action.kind });
      updateAvatarState('error');
    } finally {
      setTimeout(() => updateAvatarState(emergencyLocked ? 'warning' : 'idle'), 1300);
    }
  };

  const cancelAction = async (action: PendingAction, detail = 'User cancelled action.') => {
    await updateActionMessage(action.id, { status: 'cancelled' });
    await logActivity(userId, 'action_cancelled', detail, { kind: action.kind });
    updateAvatarState('idle');
  };

  const clearChat = async () => {
    const confirmed = await confirmAction('Clear chat?', 'This will remove the local conversation history on this device.', 'Clear');
    if (!confirmed) return;

    const nextMessages: ChatMessage[] = [
      {
        id: 'welcome-cleared',
        role: 'assistant',
        content: `${settings?.assistant_name ?? 'Tokyo'} is ready. Chat history was cleared locally.`,
        created_at: new Date().toISOString(),
      },
    ];
    await clearLocalChatMessages(userId);
    await saveLocalChatMessages(userId, nextMessages);
    setMessages(nextMessages);
    setValidationMessage('');
    setChatWarning('');
    updateAvatarState('happy');
    setTimeout(() => updateAvatarState('idle'), 1300);
    logActivity(userId, 'chat_cleared');
  };

  const activateVoicePlaceholder = (mode: 'microphone' | 'speaker') => {
    updateAvatarState(mode === 'microphone' ? 'listening' : 'speaking');
    setVoiceNotice('Voice mode coming soon. Microphone and speaker buttons are placeholders for future STT/TTS.');
    setTimeout(() => updateAvatarState(emergencyLocked ? 'warning' : 'idle'), 1400);
  };

  const handleQuickAction = (label: string, prompt?: string, tab?: AppTab) => {
    if (tab) {
      onNavigate(tab);
      return;
    }
    if (prompt) {
      setInput(prompt);
      updateAvatarState('listening');
      logActivity(userId, 'quick_action_selected', label);
    }
  };

  const webEnterSubmitProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: { key?: string; shiftKey?: boolean; preventDefault?: () => void }) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault?.();
              void send();
            }
          },
        }
      : {};

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.workspace}>
        <View style={styles.avatarRail}>
          {(settings?.avatar_visible ?? true) ? (
            <TokyoModelStage state={avatarState} animated={settings?.avatar_animation ?? true} />
          ) : null}
          <View style={styles.chatIntro}>
            <Text style={styles.heading}>{settings?.assistant_name ?? 'Tokyo'} Chat</Text>
            <Text style={styles.subheading}>{settings?.tone ?? 'Friendly'} mode with voice structure ready</Text>
            <View style={styles.voiceRow}>
              <Pressable onPress={() => activateVoicePlaceholder('microphone')} style={styles.iconButton}>
                <Text style={styles.iconText}>Mic</Text>
              </Pressable>
              <Pressable onPress={() => activateVoicePlaceholder('speaker')} style={styles.iconButton}>
                <Text style={styles.iconText}>Speak</Text>
              </Pressable>
              <Text style={styles.voiceText}>Voice mode coming soon</Text>
            </View>
            {voiceNotice ? <Text style={styles.notice}>{voiceNotice}</Text> : null}
          </View>
          <View style={styles.quickActions}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => handleQuickAction(action.label, action.prompt, action.tab)}
                style={styles.quickButton}
              >
                <Text style={styles.quickText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton tone="neutral" title="Clear chat" onPress={clearChat} />
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Conversation</Text>
              <Text style={styles.panelSubtitle}>Local history is saved in this browser.</Text>
            </View>
            <Text style={styles.historyCount}>{messages.length} messages</Text>
          </View>

          {memoryFallbackActive ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Local memory mode active — Supabase cloud memory is not connected.</Text>
            </View>
          ) : null}

          {demoAiActive ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Local AI fallback active — OpenAI is optional and can be added later.</Text>
            </View>
          ) : null}

          {chatWarning ? (
            <View style={styles.warningBanner}>
              <Text style={styles.warningTitle}>Chat notice</Text>
              <Text style={styles.warningText}>{chatWarning}</Text>
            </View>
          ) : null}

          {sendBlockedReason ? <Text style={styles.lockText}>{sendBlockedReason}</Text> : null}
          {emergencyLocked ? (
            <Text style={styles.lockText}>Emergency lock is active. Chat still works, but app launches, websites, clipboard, automation, and file actions are paused.</Text>
          ) : null}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              item.role === 'action' && item.action ? (
                <ActionBubble action={item.action} onApprove={approveAction} onCancel={cancelAction} />
              ) : (
                <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={styles.role}>{item.role === 'user' ? 'You' : settings?.assistant_name ?? 'Tokyo'}</Text>
                  <Text style={styles.message}>{item.content}</Text>
                  {item.role === 'assistant' ? (
                    <MessageTools
                      content={item.content}
                      onExplain={() => setInput(`Explain this more simply:\n\n${item.content}`)}
                      onSave={async () => {
                        await saveLocalNote(userId, {
                          title: `Chat note ${new Date().toLocaleTimeString()}`,
                          content: item.content,
                          source: 'chat',
                          category: item.content.includes('```') ? 'Code' : 'Other',
                          pinned: false,
                        });
                        await logActivity(userId, 'chat_reply_saved_to_note', item.content.slice(0, 120));
                      }}
                    />
                  ) : null}
                </View>
              )
            )}
          />

          {loading ? (
            <View style={styles.thinkingBar}>
              <Text style={styles.statusText}>{settings?.assistant_name ?? 'Tokyo'} is thinking</Text>
              <Text style={styles.typingDots}>...</Text>
            </View>
          ) : null}

          {validationMessage ? <Text style={styles.validationText}>{validationMessage}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              {...webEnterSubmitProps}
              multiline
              placeholder="Message Tokyo..."
              placeholderTextColor={colors.muted}
              value={input}
              editable={canEditComposer && permissionsReady && chatHistoryReady}
              onChangeText={(text) => {
                setInput(text);
                if (validationMessage && text.trim()) {
                  setValidationMessage('');
                }
              }}
              onKeyPress={(event) => {
                if (Platform.OS !== 'web') return;

                const webEvent = event as unknown as {
                  nativeEvent?: { key?: string; shiftKey?: boolean };
                  preventDefault?: () => void;
                };

                if (webEvent.nativeEvent?.key === 'Enter' && !webEvent.nativeEvent.shiftKey) {
                  webEvent.preventDefault?.();
                  void send();
                }
              }}
              submitBehavior="newline"
              style={styles.input}
            />
            <PrimaryButton
              disabled={loading || !permissionsReady || !chatHistoryReady || !chatPermissionEnabled}
              title={loading ? 'Sending...' : 'Send'}
              onPress={send}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ActionBubble({
  action,
  onApprove,
  onCancel,
}: {
  action: PendingAction;
  onApprove: (action: PendingAction) => void;
  onCancel: (action: PendingAction) => void;
}) {
  const finished = ['completed', 'cancelled', 'failed'].includes(action.status);
  const blocked = action.kind === 'unsupported';

  return (
    <View style={[styles.actionCard, blocked && styles.actionCardBlocked]}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={[styles.actionRisk, action.risk_level === 'critical' && styles.actionRiskCritical]}>
          {action.risk_level}
        </Text>
      </View>
      <Text style={styles.actionDescription}>{action.description}</Text>
      <Text style={styles.actionStatus}>Status: {action.status === 'approved' ? 'Approved/running' : action.status}</Text>
      {!finished ? (
        <View style={styles.actionButtons}>
          {!blocked ? <PrimaryButton disabled={action.status !== 'pending'} title={action.status === 'approved' ? 'Running...' : 'Approve'} onPress={() => onApprove(action)} /> : null}
          <PrimaryButton tone={blocked ? 'neutral' : 'danger'} title={blocked ? 'Dismiss' : 'Cancel'} onPress={() => onCancel(action)} />
        </View>
      ) : null}
    </View>
  );
}

function MessageTools({
  content,
  onExplain,
  onSave,
}: {
  content: string;
  onExplain: () => void;
  onSave: () => Promise<void>;
}) {
  const copy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
    }
  };
  return (
    <View style={styles.messageTools}>
      <Pressable onPress={copy} style={styles.toolButton}>
        <Text style={styles.toolText}>Copy</Text>
      </Pressable>
      <Pressable onPress={onSave} style={styles.toolButton}>
        <Text style={styles.toolText}>Save to Notes</Text>
      </Pressable>
      <Pressable onPress={onExplain} style={styles.toolButton}>
        <Text style={styles.toolText}>Explain</Text>
      </Pressable>
    </View>
  );
}

function actionSignature(action: PendingAction) {
  return `${action.kind}:${JSON.stringify(action.payload)}`;
}

function welcomeMessages(assistantName: string): ChatMessage[] {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi, I'm ${assistantName}. Chat is ready. If OpenAI/API is not connected, I will answer with a local demo fallback and keep the conversation saved in this browser.`,
      created_at: new Date().toISOString(),
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  avatarRail: {
    width: 340,
    minWidth: 320,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceGlass,
    gap: spacing.sm,
  },
  chatIntro: {
    gap: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  subheading: {
    color: colors.muted,
    marginTop: 2,
  },
  voiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  iconText: {
    color: colors.primary,
    fontWeight: '900',
  },
  voiceText: {
    color: colors.muted,
    fontWeight: '800',
  },
  notice: {
    color: colors.warning,
    lineHeight: 19,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
  },
  quickText: {
    color: colors.text,
    fontWeight: '800',
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  panelHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: colors.muted,
    marginTop: 2,
  },
  historyCount: {
    color: colors.primary,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  messageList: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  messages: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubble: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '92%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.primaryDark,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  role: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  message: {
    color: colors.text,
    lineHeight: 21,
  },
  messageTools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toolButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  toolText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  actionCard: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceGlass,
    gap: spacing.sm,
  },
  actionCardBlocked: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  actionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  actionRisk: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.warning,
    borderWidth: 1,
    borderColor: colors.warning,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  actionRiskCritical: {
    color: colors.danger,
    borderColor: colors.danger,
  },
  actionDescription: {
    color: colors.text,
    lineHeight: 20,
  },
  actionStatus: {
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thinkingBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surfaceGlass,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusText: {
    color: colors.muted,
    fontWeight: '800',
  },
  typingDots: {
    color: colors.primary,
    fontWeight: '900',
  },
  lockText: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    color: colors.warning,
    fontWeight: '800',
  },
  infoBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surfaceGlass,
  },
  infoText: {
    color: colors.text,
    lineHeight: 20,
    fontWeight: '800',
  },
  warningBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
    gap: spacing.xs,
  },
  warningTitle: {
    color: colors.warning,
    fontWeight: '900',
  },
  warningText: {
    color: colors.text,
    lineHeight: 20,
  },
  validationText: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    color: colors.warning,
    fontWeight: '900',
  },
  composer: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  input: {
    flex: 1,
    minHeight: 64,
    maxHeight: 112,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
