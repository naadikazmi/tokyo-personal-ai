import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ActivityLog,
  AvatarProfile,
  ChatMessage,
  AppTab,
  LocalNote,
  Memory,
  PdfNotesSession,
  PermissionSettings,
  PermissionKey,
  PermissionRow,
  PlannerTask,
  ResearchReport,
  UserSettings,
} from '../types/app';

export const demoUser = {
  id: 'local-demo-user',
  email: 'demo@local.browser',
};

export const isDemoUserId = (userId: string) => userId === demoUser.id;

export const permissionDefinitions: Array<{
  key: PermissionKey;
  label: string;
  description: string;
  risk_level: PermissionRow['risk_level'];
  defaultEnabled: boolean;
}> = [
  {
    key: 'chat_only',
    label: 'Chat only',
    description: 'Allows normal text chat with the connected AI model.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'research_only',
    label: 'Research only',
    description: 'Allows source-grounded research through a configured search provider.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'study_mode',
    label: 'Study Mode',
    description: 'Allows Tokyo to generate local explanations, exam answers, quizzes, and flashcards.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'coding_helper',
    label: 'Coding Helper',
    description: 'Allows Tokyo to generate local code examples, explanations, debug checklists, and project plans.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'memory_access',
    label: 'Memory access',
    description: 'Allows chat to read relevant saved memories.',
    risk_level: 'medium',
    defaultEnabled: true,
  },
  {
    key: 'open_apps',
    label: 'Open apps',
    description: 'Allows approved requests to open common Windows apps such as Notepad, Calculator, Paint, Explorer, Chrome, or VS Code.',
    risk_level: 'medium',
    defaultEnabled: true,
  },
  {
    key: 'open_websites',
    label: 'Open websites',
    description: 'Allows approved requests to open websites in the default browser.',
    risk_level: 'medium',
    defaultEnabled: true,
  },
  {
    key: 'notes_access',
    label: 'Notes',
    description: 'Allows chat and the app to create and search local notes on this laptop profile.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'planner_actions',
    label: 'Planner actions',
    description: 'Allows chat to add local planner tasks and reminders inside Tokyo.',
    risk_level: 'low',
    defaultEnabled: true,
  },
  {
    key: 'file_read_access',
    label: 'File read access',
    description: 'Allows approved file-name searches inside one configured safe folder only.',
    risk_level: 'high',
    defaultEnabled: false,
  },
  {
    key: 'file_write_access',
    label: 'File write access',
    description: 'Allows approved text-file creation inside one configured safe folder only.',
    risk_level: 'critical',
    defaultEnabled: false,
  },
  {
    key: 'clipboard_helper',
    label: 'Clipboard helper',
    description: 'Allows user-triggered clipboard paste, summarize, rewrite, and save-as-note helper actions.',
    risk_level: 'medium',
    defaultEnabled: true,
  },
  {
    key: 'pdf_processing',
    label: 'PDF processing',
    description: 'Allows local PDF text extraction, generated study notes, flashcards, quizzes, and saved PDF note sessions.',
    risk_level: 'medium',
    defaultEnabled: true,
  },
  {
    key: 'voice_placeholder',
    label: 'Voice placeholder',
    description: 'Shows future microphone and speaker controls without recording audio yet.',
    risk_level: 'medium',
    defaultEnabled: false,
  },
  {
    key: 'browser_automation',
    label: 'Browser automation',
    description: 'Future permission for controlling browser tabs after visible approval.',
    risk_level: 'high',
    defaultEnabled: false,
  },
  {
    key: 'system_command_access',
    label: 'System command access',
    description: 'Future permission for running system commands after visible approval.',
    risk_level: 'critical',
    defaultEnabled: false,
  },
  {
    key: 'device_control_placeholder',
    label: 'Device control placeholder',
    description: 'Future broad device controls. Disabled until a safer implementation exists.',
    risk_level: 'critical',
    defaultEnabled: false,
  },
  {
    key: 'full_device_control',
    label: 'Full device control',
    description: 'Future permission for broad device control. Disabled by default.',
    risk_level: 'critical',
    defaultEnabled: false,
  },
];

export const defaultPermissionSettings = permissionDefinitions.reduce((acc, item) => {
  acc[item.key] = item.defaultEnabled;
  return acc;
}, {} as PermissionSettings);

export const defaultUserSettings = {
  display_name: 'Demo User',
  assistant_name: 'Tokyo',
  tone: 'Friendly' as const,
  assistant_style:
    'Original female AI assistant: confident, practical, privacy-aware, cinematic, and safety-first. Helpful with study, coding, research, planning, and daily routines.',
  avatar_visible: true,
  avatar_animation: true,
  voice_mode_placeholder: true,
  theme_mode: 'Cinematic' as const,
  safe_workspace_folder: '',
};

export const defaultAvatars: Omit<AvatarProfile, 'id' | 'user_id' | 'created_at'>[] = [
  {
    name: 'Tokyo',
    personality: 'Original cinematic rebel AI assistant: bold, fast, emotional, protective, and safety-aware.',
    appearance: {
      visual_style: 'Dark cinematic cyberpunk console style',
      accent_color: '#FF4D6D',
      role: 'Lead personal AI assistant',
      hair: 'Short dark hair',
      outfit: 'Dark tactical-inspired jacket with red neon accents',
    },
    voice_style: 'Confident, direct, protective',
    is_active: true,
  },
  {
    name: 'Tokyo Research',
    personality: 'Calm analytical Tokyo mode that compares evidence and flags uncertainty.',
    appearance: {
      visual_style: 'Clean futuristic interface',
      accent_color: '#00E5FF',
      role: 'Research assistant mode',
      hair: 'Sleek silver-blue bob',
      outfit: 'White and blue techwear',
    },
    voice_style: 'Calm, precise, evidence-focused',
    is_active: false,
  },
  {
    name: 'Tokyo Planner',
    personality: 'Warm productivity Tokyo mode: organized, friendly, practical, and steady.',
    appearance: {
      visual_style: 'Elegant productivity cockpit',
      accent_color: '#39E58C',
      role: 'Planner assistant mode',
      hair: 'Soft dark waves',
      outfit: 'Modern tailored jacket with warm light accents',
    },
    voice_style: 'Warm, structured, encouraging',
    is_active: false,
  },
  {
    name: 'Tokyo Guard',
    personality: 'Serious safety Tokyo mode: careful, permission-focused, and skeptical.',
    appearance: {
      visual_style: 'Black and green security console',
      accent_color: '#42F57B',
      role: 'Security assistant mode',
      hair: 'Dark undercut style',
      outfit: 'Black security shell jacket with green diagnostic lines',
    },
    voice_style: 'Serious, concise, risk-aware',
    is_active: false,
  },
];

const keyFor = (userId: string, name: string) => `tokyo:${userId}:${name}`;
const now = () => new Date().toISOString();

export type LocalAppSession = {
  mode: 'demo';
  activeTab: AppTab;
  updated_at: string;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getLocalAppSession() {
  return readJson<LocalAppSession | null>('tokyo:app-session', null);
}

export async function saveLocalAppSession(session: Pick<LocalAppSession, 'mode' | 'activeTab'>) {
  const nextSession: LocalAppSession = { ...session, updated_at: now() };
  await writeJson('tokyo:app-session', nextSession);
  return nextSession;
}

export async function clearLocalAppSession() {
  await AsyncStorage.removeItem('tokyo:app-session');
}

export async function getLocalMemories(userId: string) {
  const memories = await readJson<Memory[]>(keyFor(userId, 'memories'), []);
  return memories
    .map((memory) => ({
      ...memory,
      tags: Array.isArray(memory.tags) ? memory.tags : [((memory as unknown as { category?: string }).category ?? 'Personal')],
      source: memory.source ?? 'local',
      enabled: memory.enabled !== false,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveLocalMemory(
  userId: string,
  memory: Pick<Memory, 'title' | 'content' | 'tags' | 'source'>,
  editingId?: string,
) {
  const memories = await getLocalMemories(userId);
  const timestamp = now();

  const nextMemories = editingId
    ? memories.map((item) =>
        item.id === editingId
          ? { ...item, ...memory, updated_at: timestamp }
          : item,
      )
    : [
        {
          id: `${Date.now()}-memory`,
          user_id: userId,
          ...memory,
          created_at: timestamp,
          updated_at: timestamp,
        },
        ...memories,
      ];

  await writeJson(keyFor(userId, 'memories'), nextMemories);
  return nextMemories;
}

export async function toggleLocalMemory(userId: string, memoryId: string) {
  const memories = await getLocalMemories(userId);
  const nextMemories = memories.map((memory) =>
    memory.id === memoryId ? { ...memory, enabled: memory.enabled === false, updated_at: now() } : memory,
  );
  await writeJson(keyFor(userId, 'memories'), nextMemories);
  return nextMemories;
}

export async function deleteLocalMemory(userId: string, memoryId: string) {
  const memories = await getLocalMemories(userId);
  const nextMemories = memories.filter((memory) => memory.id !== memoryId);
  await writeJson(keyFor(userId, 'memories'), nextMemories);
  return nextMemories;
}

export async function getLocalPermissionSettings(userId: string): Promise<PermissionSettings> {
  const fallback = defaultPermissionSettings;
  const settings = await readJson<PermissionSettings>(keyFor(userId, 'permissions'), fallback);
  const normalized = { ...fallback, ...settings };
  await writeJson(keyFor(userId, 'permissions'), normalized);
  return normalized;
}

export async function saveLocalPermissionSettings(userId: string, settings: PermissionSettings) {
  const nextSettings = { ...defaultPermissionSettings, ...settings };
  await writeJson(keyFor(userId, 'permissions'), nextSettings);
  return nextSettings;
}

export async function updateLocalPermissionSetting(
  userId: string,
  key: PermissionKey,
  value: boolean,
) {
  const settings = await getLocalPermissionSettings(userId);
  return saveLocalPermissionSettings(userId, { ...settings, [key]: value });
}

export async function applyLocalEmergencyLock(userId: string, locked: boolean) {
  await writeJson(keyFor(userId, 'emergency_lock'), locked);
  if (!locked) return getLocalPermissionSettings(userId);

  const settings = await getLocalPermissionSettings(userId);
  return saveLocalPermissionSettings(userId, {
    ...settings,
    open_apps: false,
    open_websites: false,
    file_read_access: false,
    file_write_access: false,
    clipboard_helper: false,
    browser_automation: false,
    device_control_placeholder: false,
    system_command_access: false,
    full_device_control: false,
  });
}

export async function getLocalEmergencyLock(userId: string) {
  return readJson<boolean>(keyFor(userId, 'emergency_lock'), false);
}

export async function addLocalActivityLog(
  userId: string,
  actionType: string,
  detail?: string,
  metadata?: Record<string, unknown>,
) {
  const logs = await getLocalActivityLogs(userId);
  const nextLogs = [
    {
      id: `${Date.now()}-log`,
      user_id: userId,
      action_type: actionType,
      detail: detail ?? null,
      metadata: metadata ?? null,
      created_at: now(),
    },
    ...logs,
  ].slice(0, 100);

  await writeJson(keyFor(userId, 'activity_logs'), nextLogs);
}

export async function getLocalActivityLogs(userId: string) {
  const logs = await readJson<ActivityLog[]>(keyFor(userId, 'activity_logs'), []);
  return logs
    .map((log) => ({
      ...log,
      action_type: log.action_type ?? (log as unknown as { action?: string }).action ?? 'unknown',
      detail: log.detail ?? (log as unknown as { details?: string | null }).details ?? null,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);
}

export async function clearLocalActivityLogs(userId: string) {
  await writeJson(keyFor(userId, 'activity_logs'), []);
}

export async function getLocalUserSettings(userId: string): Promise<UserSettings> {
  const fallback: UserSettings = {
    id: `${userId}-settings`,
    user_id: userId,
    ...defaultUserSettings,
    updated_at: now(),
  };

  const settings = await readJson<UserSettings>(keyFor(userId, 'settings'), fallback);
  const normalized = { ...fallback, ...settings };
  await writeJson(keyFor(userId, 'settings'), normalized);
  return normalized;
}

export async function saveLocalUserSettings(
  userId: string,
  settings: Pick<
    UserSettings,
    | 'display_name'
    | 'assistant_name'
    | 'tone'
    | 'assistant_style'
    | 'avatar_visible'
    | 'avatar_animation'
    | 'voice_mode_placeholder'
    | 'theme_mode'
    | 'safe_workspace_folder'
  >,
) {
  const nextSettings: UserSettings = {
    id: `${userId}-settings`,
    user_id: userId,
    ...settings,
    updated_at: now(),
  };

  await writeJson(keyFor(userId, 'settings'), nextSettings);
  return nextSettings;
}

export async function getLocalChatMessages(userId: string) {
  return readJson<ChatMessage[]>(keyFor(userId, 'chat_messages'), []);
}

export async function saveLocalChatMessages(userId: string, messages: ChatMessage[]) {
  await writeJson(keyFor(userId, 'chat_messages'), messages.slice(-80));
}

export async function clearLocalChatMessages(userId: string) {
  await writeJson(keyFor(userId, 'chat_messages'), []);
}

export async function getLocalNotes(userId: string) {
  const notes = await readJson<LocalNote[]>(keyFor(userId, 'notes'), []);
  const normalized = notes.map((note) => ({
    ...note,
    category: normalizeNoteCategory((note as LocalNote).category),
    pinned: Boolean((note as LocalNote).pinned),
  }));
  return normalized.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
}

export async function saveLocalNote(
  userId: string,
  note: Pick<LocalNote, 'title' | 'content' | 'source'> & Partial<Pick<LocalNote, 'category' | 'pinned'>>,
  editingId?: string,
) {
  const notes = await getLocalNotes(userId);
  const timestamp = now();
  const normalizedNote = {
    ...note,
    category: normalizeNoteCategory(note.category),
    pinned: Boolean(note.pinned),
  };
  const nextNotes = editingId
    ? notes.map((item) => (item.id === editingId ? { ...item, ...normalizedNote, updated_at: timestamp } : item))
    : [
        {
          id: `${Date.now()}-note`,
          user_id: userId,
          ...normalizedNote,
          created_at: timestamp,
          updated_at: timestamp,
        },
        ...notes,
      ];

  await writeJson(keyFor(userId, 'notes'), nextNotes);
  return nextNotes;
}

export async function toggleLocalNotePin(userId: string, noteId: string) {
  const notes = await getLocalNotes(userId);
  const nextNotes = notes.map((note) =>
    note.id === noteId ? { ...note, pinned: !note.pinned, updated_at: now() } : note,
  );
  await writeJson(keyFor(userId, 'notes'), nextNotes);
  return nextNotes;
}

export async function deleteLocalNote(userId: string, noteId: string) {
  const notes = await getLocalNotes(userId);
  const nextNotes = notes.filter((note) => note.id !== noteId);
  await writeJson(keyFor(userId, 'notes'), nextNotes);
  return nextNotes;
}

export async function searchLocalNotes(userId: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const notes = await getLocalNotes(userId);
  if (!normalizedQuery) return notes.slice(0, 8);
  return notes
    .filter((note) => `${note.title} ${note.content} ${note.category}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);
}

function normalizeNoteCategory(category?: string): LocalNote['category'] {
  const allowed: LocalNote['category'][] = ['Study', 'Work', 'Personal', 'Ideas', 'Code', 'Other'];
  const match = allowed.find((item) => item.toLowerCase() === String(category || '').toLowerCase());
  return match || 'Other';
}

export async function getLocalResearchHistory(userId: string) {
  const reports = await readJson<ResearchReport[]>(keyFor(userId, 'research_history'), []);
  return reports
    .filter((report) => report.result && report.query && Array.isArray(report.sources))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLocalPdfSessions(userId: string) {
  const sessions = await readJson<PdfNotesSession[]>(keyFor(userId, 'pdf_sessions'), []);
  return sessions
    .filter((session) => session.id && session.file_name && Array.isArray(session.pages))
    .sort((a, b) => b.last_opened_at.localeCompare(a.last_opened_at))
    .slice(0, 20);
}

export async function saveLocalPdfSession(userId: string, session: Omit<PdfNotesSession, 'user_id'>) {
  const sessions = await getLocalPdfSessions(userId);
  const timestamp = now();
  const nextSession: PdfNotesSession = {
    ...session,
    user_id: userId,
    last_opened_at: timestamp,
  };
  const nextSessions = [nextSession, ...sessions.filter((item) => item.id !== session.id)].slice(0, 20);
  await writeJson(keyFor(userId, 'pdf_sessions'), nextSessions);
  return nextSession;
}

export async function deleteLocalPdfSession(userId: string, sessionId: string) {
  const sessions = await getLocalPdfSessions(userId);
  const nextSessions = sessions.filter((session) => session.id !== sessionId);
  await writeJson(keyFor(userId, 'pdf_sessions'), nextSessions);
  return nextSessions;
}

export async function clearLocalResearchHistory(userId: string) {
  await writeJson(keyFor(userId, 'research_history'), []);
}

export async function saveLocalResearchReport(userId: string, report: ResearchReport) {
  const history = await getLocalResearchHistory(userId);
  await writeJson(keyFor(userId, 'research_history'), [report, ...history].slice(0, 50));
  return report;
}

export async function getLocalAvatars(userId: string) {
  const seeded = defaultAvatars.map((avatar, index) => ({
    id: `${userId}-avatar-${avatar.name.toLowerCase()}`,
    user_id: userId,
    ...avatar,
    is_active: index === 0,
    created_at: now(),
  }));
  const avatars = await readJson<AvatarProfile[]>(keyFor(userId, 'avatars'), seeded);
  const normalized = avatars.map(normalizeAvatarBranding);
  if (avatars.length === 0) {
    await writeJson(keyFor(userId, 'avatars'), seeded);
    return seeded;
  }
  await writeJson(keyFor(userId, 'avatars'), normalized);
  return normalized;
}

function normalizeAvatarBranding(avatar: AvatarProfile): AvatarProfile {
  const legacyNames = [
    { value: String.fromCharCode(78, 111, 118, 97), next: 'Tokyo Research' },
    { value: String.fromCharCode(90, 97, 114, 97), next: 'Tokyo Planner' },
    { value: String.fromCharCode(82, 97, 118, 101, 110), next: 'Tokyo Guard' },
    { value: String.fromCharCode(65, 115, 116, 114, 97), next: 'Tokyo' },
    { value: String.fromCharCode(65, 83, 116, 82, 65), next: 'Tokyo' },
  ];
  const replacements = Object.fromEntries(legacyNames.map((item) => [item.value, item.next]));
  const legacyPattern = new RegExp(`\\b(${legacyNames.map((item) => item.value).join('|')})\\b`, 'g');
  const nextName = replacements[avatar.name] || avatar.name;
  return {
    ...avatar,
    name: nextName,
    personality: avatar.personality.replace(legacyPattern, 'Tokyo'),
    appearance: {
      ...avatar.appearance,
      role: avatar.appearance.role.replace(legacyPattern, 'Tokyo'),
    },
  };
}

export async function saveLocalAvatar(userId: string, avatarId: string, patch: Partial<AvatarProfile>) {
  const avatars = await getLocalAvatars(userId);
  const nextAvatars = avatars.map((avatar) => (avatar.id === avatarId ? { ...avatar, ...patch } : avatar));
  await writeJson(keyFor(userId, 'avatars'), nextAvatars);
  return nextAvatars;
}

export async function activateLocalAvatar(userId: string, avatarId: string) {
  const avatars = await getLocalAvatars(userId);
  const nextAvatars = avatars.map((avatar) => ({ ...avatar, is_active: avatar.id === avatarId }));
  await writeJson(keyFor(userId, 'avatars'), nextAvatars);
  return nextAvatars;
}

export async function getLocalPlannerTasks(userId: string) {
  const tasks = await readJson<PlannerTask[]>(keyFor(userId, 'planner_tasks'), []);
  return tasks.sort((a, b) => Number(a.completed) - Number(b.completed) || b.updated_at.localeCompare(a.updated_at));
}

export async function saveLocalPlannerTask(
  userId: string,
  task: Pick<PlannerTask, 'title' | 'notes' | 'priority' | 'deadline'>,
  editingId?: string,
) {
  const tasks = await getLocalPlannerTasks(userId);
  const timestamp = now();
  const nextTasks = editingId
    ? tasks.map((item) => (item.id === editingId ? { ...item, ...task, updated_at: timestamp } : item))
    : [
        {
          id: `${Date.now()}-task`,
          user_id: userId,
          ...task,
          completed: false,
          created_at: timestamp,
          updated_at: timestamp,
        },
        ...tasks,
      ];

  await writeJson(keyFor(userId, 'planner_tasks'), nextTasks);
  return nextTasks;
}

export async function toggleLocalPlannerTask(userId: string, taskId: string) {
  const tasks = await getLocalPlannerTasks(userId);
  const nextTasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed, updated_at: now() } : task,
  );
  await writeJson(keyFor(userId, 'planner_tasks'), nextTasks);
  return nextTasks;
}

export async function deleteLocalPlannerTask(userId: string, taskId: string) {
  const tasks = await getLocalPlannerTasks(userId);
  const nextTasks = tasks.filter((task) => task.id !== taskId);
  await writeJson(keyFor(userId, 'planner_tasks'), nextTasks);
  return nextTasks;
}
