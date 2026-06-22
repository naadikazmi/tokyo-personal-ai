import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarScene } from '../components/avatar/AvatarScene';
import { Screen } from '../components/Screen';
import { DashboardCard } from '../components/ui/DashboardCard';
import { getSettingsStatus, runResearchApi, sendChatToApi, testSupabaseApi } from '../lib/api';
import { logActivity } from '../lib/activity';
import {
  getLocalActivityLogs,
  getLocalMemories,
  getLocalNotes,
  getLocalPdfSessions,
  getLocalPlannerTasks,
  getLocalResearchHistory,
  getLocalUserSettings,
  isDemoUserId,
  saveLocalMemory,
} from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { ActivityLog, AppTab, AvatarState, LocalNote, PermissionSettings, PlannerTask, SystemHealth, UserSettings } from '../types/app';

type Props = {
  avatarAnimation: boolean;
  avatarVisible: boolean;
  emergencyLocked: boolean;
  liveAvatarState: AvatarState;
  onNavigate: (tab: AppTab) => void;
  userId: string;
};

export function HomeScreen({ avatarAnimation, avatarVisible, emergencyLocked, liveAvatarState, onNavigate, userId }: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionSettings | null>(null);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [counts, setCounts] = useState({ memories: 0, research: 0, pdf: 0 });
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    load();
  }, [userId, emergencyLocked]);

  const load = async () => {
    const [nextSettings, nextPermissions, memories, nextTasks, nextNotes, research, pdfSessions, nextLogs] = await Promise.all([
      getLocalUserSettings(userId),
      getEffectivePermissionSettings(userId),
      getLocalMemories(userId),
      getLocalPlannerTasks(userId),
      getLocalNotes(userId),
      getLocalResearchHistory(userId),
      getLocalPdfSessions(userId),
      getLocalActivityLogs(userId),
    ]);

    setSettings(nextSettings);
    setPermissions(nextPermissions);
    setTasks(nextTasks);
    setNotes(nextNotes);
    setLogs(nextLogs);
    setCounts({ memories: memories.length, research: research.length, pdf: pdfSessions.length });

    try {
      setHealth(await getSettingsStatus());
    } catch (error) {
      console.error('System health check failed:', error);
      setHealth({
        ai: { connected: false, message: error instanceof Error ? error.message : 'API health check failed.' },
        research: { connected: false, message: 'API health check failed.' },
        supabase: { connected: false, message: 'API health check failed.' },
        memory: { mode: 'Local', message: 'Local memory fallback active.' },
        logs: { working: false, message: 'API health check failed.' },
      });
    }
  };

  const runTest = async (name: string, fn: () => Promise<string>) => {
    setTestResult(`${name}: running...`);
    try {
      const message = await fn();
      setTestResult(`${name}: ${message}`);
      await logActivity(userId, 'safe_test_completed', name, { result: message });
      await load();
    } catch (error) {
      console.error(`${name} failed:`, error);
      setTestResult(`${name}: ${error instanceof Error ? error.message : 'failed. Check console logs.'}`);
    }
  };

  const testAiReply = () =>
    runTest('Test AI reply', async () => {
      const response = await sendChatToApi({
        userId,
        assistantName: settings?.assistant_name ?? 'Tokyo',
        personality: 'Reply with one short sentence confirming the AI connection.',
        memories: [],
        messages: [{ id: 'health-user', role: 'user', content: 'Health check. Reply briefly.', created_at: new Date().toISOString() }],
      });
      return response.reply.slice(0, 160);
    });

  const testResearch = () =>
    runTest('Test research', async () => {
      const response = await runResearchApi(userId, 'latest Expo SDK documentation');
      return `received ${response.report.sources.length} source(s) for "${response.report.query}"`;
    });

  const testSupabase = () =>
    runTest('Test Supabase connection', async () => {
      const result = await testSupabaseApi(userId);
      return result.message;
    });

  const testMemorySave = () =>
    runTest('Test memory save', async () => {
      const title = `Health check ${new Date().toLocaleTimeString()}`;
      if (isSupabaseConfigured && !isDemoUserId(userId)) {
        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('memories').insert({
            user_id: userId,
            title,
            content: 'Memory health check entry.',
            tags: ['health-check'],
            source: 'system-health',
          });
          if (!error) return 'saved to Supabase memories.';
          console.warn('Cloud memory test was unavailable. Local memory mode is still active:', error);
        }
      }
      await saveLocalMemory(userId, {
        title,
        content: 'Memory health check entry.',
        tags: ['health-check'],
        source: 'system-health-local',
      });
      return 'saved to local memory fallback.';
    });

  const testActivityLog = () =>
    runTest('Test activity log save', async () => {
      await logActivity(userId, 'activity_log_test', 'System Health test button');
      return 'activity log write requested.';
    });

  const openTasks = tasks.filter((task) => !task.completed);
  const todayText = new Date().toLocaleDateString();
  const todaysTasks = openTasks.filter((task) => {
    const deadline = task.deadline.toLowerCase();
    return !deadline || deadline.includes('today') || deadline.includes(todayText);
  });
  const avatarState: AvatarState = emergencyLocked
    ? 'serious'
    : liveAvatarState !== 'idle'
      ? liveAvatarState
      : openTasks.length === 0 && tasks.length > 0
        ? 'happy'
        : 'idle';
  const supabaseConnected = Boolean(health?.supabase.connected);
  const appMode = supabaseConnected && !isDemoUserId(userId)
    ? 'Cloud Sync Mode Active'
    : isSupabaseConfigured && !isDemoUserId(userId)
      ? 'Hybrid Mode Active'
      : 'Local Desktop Mode Active';
  const aiStatus = health?.ai.connected ? 'OpenAI active' : 'Local fallback active';
  const researchStatus = health?.research.connected ? 'Live research ready' : 'Demo research mode';

  return (
    <Screen>
      {avatarVisible ? (
        <AvatarScene state={avatarState} animationEnabled={avatarAnimation} onOpenChat={() => onNavigate('chat')} />
      ) : null}

      <View style={styles.heroCopy}>
        <Text style={styles.heading}>Tokyo Command Center</Text>
        <Text style={styles.help}>
          A premium local-first AI assistant workspace for chat, memory, planning, research, permissions, and safety.
        </Text>
      </View>

      <View style={styles.grid}>
        <DashboardCard
          title="App mode"
          value={appMode}
          detail={supabaseConnected ? 'Cloud sync is connected.' : 'Local mode active — cloud sync disabled.'}
          accent={supabaseConnected ? 'green' : 'yellow'}
          onPress={() => onNavigate('settings')}
        />
        <DashboardCard
          title="AI mode"
          value={aiStatus}
          detail={health?.ai.connected ? health.ai.message : 'OpenAI not connected — local fallback active.'}
          accent={health?.ai.connected ? 'green' : 'cyan'}
          onPress={() => onNavigate('chat')}
        />
        <DashboardCard
          title="Tokyo status"
          value={emergencyLocked ? 'Serious safety mode' : `${settings?.assistant_name ?? 'Tokyo'} is online`}
          detail={`Tone: ${settings?.tone ?? 'Friendly'}`}
          accent={emergencyLocked ? 'yellow' : 'cyan'}
          onPress={() => onNavigate('chat')}
        />
        <DashboardCard
          title="Memory status"
          value={`${counts.memories} memories`}
          detail={supabaseConnected ? 'Cloud memory sync active.' : 'Memories stored locally.'}
          accent="pink"
          onPress={() => onNavigate('memories')}
        />
        <DashboardCard
          title="Permissions status"
          value={permissions?.chat_only ? 'Chat enabled' : 'Chat disabled'}
          detail={`Research ${permissions?.research_only ? 'on' : 'off'} | Full device ${permissions?.full_device_control ? 'on' : 'off'}`}
          accent="green"
          onPress={() => onNavigate('permissions')}
        />
        <DashboardCard
          title="Emergency lock status"
          value={emergencyLocked ? 'Active' : 'Off'}
          detail={emergencyLocked ? 'Sensitive access is disabled.' : 'Sensitive access follows your permission settings.'}
          accent={emergencyLocked ? 'red' : 'cyan'}
          onPress={() => onNavigate('permissions')}
        />
        <DashboardCard
          title="Today's tasks"
          value={`${todaysTasks.length} today / ${openTasks.length} open`}
          detail={todaysTasks.slice(0, 2).map((task) => task.title).join(' | ') || 'No active tasks yet.'}
          accent="yellow"
          onPress={() => onNavigate('planner')}
        />
        <DashboardCard
          title="Recent notes"
          value={`${notes.length} notes`}
          detail={notes.slice(0, 2).map((note) => note.title).join(' | ') || 'No notes yet.'}
          accent="cyan"
          onPress={() => onNavigate('notes')}
        />
        <DashboardCard
          title="Recent activity"
          value={`${logs.length} log entries`}
          detail={logs[0]?.action_type ?? 'No activity logged yet.'}
          accent="green"
          onPress={() => onNavigate('logs')}
        />
        <DashboardCard
          title="Research shortcut"
          value={researchStatus}
          detail={`${counts.research} saved drafts. ${health?.research.connected ? 'Live source provider connected.' : 'Demo mode creates offline outlines.'}`}
          accent="pink"
          onPress={() => onNavigate('research')}
        />
        <DashboardCard
          title="PDF Notes"
          value={`${counts.pdf} sessions`}
          detail="Extract local PDF text and generate study notes, flashcards, and quizzes."
          accent="green"
          onPress={() => onNavigate('pdfNotes')}
        />
        <DashboardCard
          title="Chat shortcut"
          value="Open Tokyo chat"
          detail="Works with OpenAI when configured, otherwise uses local fallback and action cards."
          accent="cyan"
          onPress={() => onNavigate('chat')}
        />
        <DashboardCard
          title="Study mode"
          value="Explain and quiz"
          detail="Create study notes, exam answers, quizzes, and flashcards."
          accent="green"
          onPress={() => onNavigate('study')}
        />
        <DashboardCard
          title="Coding helper"
          value="Code templates"
          detail="Generate examples, debug checklists, and small project plans."
          accent="yellow"
          onPress={() => onNavigate('coding')}
        />
        <DashboardCard
          title="File workspace"
          value={permissions?.file_read_access ? 'Read enabled' : 'Read disabled'}
          detail={settings?.safe_workspace_folder || 'Set a safe folder before file actions can run.'}
          accent={permissions?.file_read_access ? 'green' : 'red'}
          onPress={() => onNavigate('workspace')}
        />
        <DashboardCard
          title="Clipboard helper"
          value={permissions?.clipboard_helper ? 'Enabled' : 'Disabled'}
          detail="Paste only on button press, then summarize, rewrite, or save."
          accent={permissions?.clipboard_helper ? 'green' : 'red'}
          onPress={() => onNavigate('clipboard')}
        />
        <DashboardCard
          title="AI model settings"
          value="Avatar stage"
          detail="Preview expressions and prepare a future GLB, GLTF, or VRM model."
          accent="pink"
          onPress={() => onNavigate('avatar')}
        />
      </View>

      <View style={styles.healthPanel}>
        <Text style={styles.sectionTitle}>Local System Status</Text>
        <View style={styles.grid}>
          <DashboardCard title="Supabase" value={supabaseConnected ? 'Connected' : 'Optional cloud sync disabled'} detail={supabaseConnected ? health?.supabase.message ?? 'Cloud sync connected.' : 'Supabase is optional. Local storage is active.'} accent={supabaseConnected ? 'green' : 'yellow'} />
          <DashboardCard title="Memory" value={supabaseConnected ? 'Cloud memory' : 'Local memory'} detail={supabaseConnected ? 'Memories can sync when tables are configured.' : 'Memories stored locally.'} accent={supabaseConnected ? 'green' : 'yellow'} />
          <DashboardCard title="Activity logs" value={supabaseConnected ? 'Cloud/local logs' : 'Local logs active'} detail={supabaseConnected ? health?.logs.message ?? 'Logs available.' : 'Activity logs stored locally.'} accent="green" />
          <DashboardCard title="Research" value={researchStatus} detail={health?.research.connected ? health.research.message : 'Live search is optional. Demo research is active.'} accent={health?.research.connected ? 'green' : 'cyan'} />
        </View>
        <View style={styles.testRow}>
          <DashboardCard title="Safe tests" value="Manual checks" detail={testResult || 'Run a test to see exact success or setup errors.'} accent="cyan" />
          <View style={styles.buttonStack}>
            <TestButton label="Test AI reply" onPress={testAiReply} />
            <TestButton label="Test research" onPress={testResearch} />
            <TestButton label="Test Supabase connection" onPress={testSupabase} />
            <TestButton label="Test memory save" onPress={testMemorySave} />
            <TestButton label="Test activity log save" onPress={testActivityLog} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function TestButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={styles.testButton}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  heroCopy: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  healthPanel: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  testRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  buttonStack: {
    minWidth: 240,
    flex: 1,
    gap: spacing.sm,
  },
  testButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
    color: colors.text,
    fontWeight: '900',
  },
});
