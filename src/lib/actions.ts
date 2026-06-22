import { executeBackendAction } from './api';
import { logActivity } from './activity';
import {
  getLocalMemories,
  saveLocalMemory,
  saveLocalNote,
  saveLocalPlannerTask,
  searchLocalNotes,
} from './localDemo';
import type { ActionResult, LocalNote, PendingAction, PermissionSettings } from '../types/app';

type DetectParams = {
  emergencyLocked: boolean;
  permissions: PermissionSettings;
  text: string;
};

const nowId = (suffix: string) => `${Date.now()}-${suffix}`;

export function detectActionIntent({ emergencyLocked, permissions, text }: DetectParams): PendingAction | null {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;

  const unsupported = detectUnsupported(lower);
  if (unsupported) return unsupported;

  const action = buildAction(raw, lower);
  if (!action) return null;

  if (emergencyLocked && isEmergencyLockedAction(action.kind)) {
    return {
      ...action,
      kind: 'unsupported',
      title: 'Action blocked by Emergency Lock',
      description: 'Emergency Lock is active. Chat, notes, and planner viewing still work, but laptop, website, workspace, and automation actions are paused.',
      requires_backend: false,
      payload: { reason: 'Emergency Lock is active.' },
      status: 'pending',
    };
  }

  const missingPermission = permissionRequired(action, permissions);
  if (missingPermission) {
    return {
      ...action,
      kind: 'unsupported',
      title: 'Permission required',
      description: missingPermission,
      requires_backend: false,
      payload: { reason: missingPermission },
      status: 'pending',
    };
  }

  return action;
}

function isEmergencyLockedAction(kind: PendingAction['kind']) {
  return ['open_app', 'open_website', 'search_files', 'open_path', 'create_text_file'].includes(kind);
}

function buildAction(raw: string, lower: string): PendingAction | null {
  const appMatch = lower.match(/\bopen\s+(notepad|calculator|calc|paint|chrome|browser|vs code|vscode|file explorer|explorer)\b/);
  if (appMatch) {
    const app = appMatch[1] === 'calc' ? 'calculator' : appMatch[1];
    return pending('open_app', `Open ${app}`, `Tokyo will open ${app} on this laptop.`, true, 'medium', { app });
  }

  const websiteMatch = lower.match(/\bopen\s+((?:https?:\/\/)?[\w.-]+\.[a-z]{2,}[^\s]*|youtube|google|github|gmail|chatgpt|supabase)\b/);
  if (websiteMatch) {
    const website = websiteMatch[1];
    return pending('open_website', `Open ${website}`, `Tokyo will open ${website} in your default browser.`, true, 'medium', { url: website });
  }

  const note = extractAfter(raw, [/^create\s+(?:a\s+)?note\s*:?\s*/i, /^create\s+(?:a\s+)?note\s+(?:about|saying|that)\s+/i, /^note\s+(?:that\s+)?/i]);
  if (note) {
    return pending('create_note', 'Create local note', `Tokyo will save this in local notes: "${clip(note)}".`, false, 'low', {
      title: titleFromText(note),
      content: note,
      category: inferNoteCategory(note),
    });
  }

  const memory = extractAfter(raw, [/^remember\s+(?:that\s+)?/i, /^save\s+(?:this\s+)?memory\s+(?:that\s+)?/i]);
  if (memory) {
    return pending('save_memory', 'Save memory', `Tokyo will add this to local memory: "${clip(memory)}".`, false, 'medium', {
      title: titleFromText(memory),
      content: memory,
    });
  }

  const task = extractAfter(raw, [/^add\s+task\s*:?\s*/i, /^create\s+task\s*:?\s*/i, /^remind\s+me\s+to\s+/i]);
  if (task) {
    const parsed = parseTask(task);
    return pending('create_task', 'Add planner task', `Tokyo will add this task: "${clip(parsed.title)}".`, false, 'low', parsed);
  }

  const notesSearch = lower.match(/\bsearch\s+(?:my\s+)?(notes|memories)(?:\s+for\s+(.+))?$/);
  if (notesSearch) {
    const query = notesSearch[2] || '';
    return pending('search_notes', `Search ${notesSearch[1]}`, query ? `Tokyo will search local ${notesSearch[1]} for "${clip(query)}".` : `Tokyo will show recent local ${notesSearch[1]}.`, false, 'low', {
      area: notesSearch[1],
      query,
    });
  }

  const notesFind = lower.match(/\b(?:find|show)\s+(?:my\s+)?(notes|memories)\s+(?:about|for)\s+(.+)$/);
  if (notesFind) {
    return pending('search_notes', `Search ${notesFind[1]}`, `Tokyo will search local ${notesFind[1]} for "${clip(notesFind[2])}".`, false, 'low', {
      area: notesFind[1],
      query: notesFind[2],
    });
  }

  const summarizeNotes = lower.match(/\bsummarize\s+(?:my\s+)?notes(?:\s+(?:about|for)\s+(.+))?/);
  if (summarizeNotes) {
    return pending('summarize_notes', 'Summarize local notes', `Tokyo will summarize matching local notes${summarizeNotes[1] ? ` for "${clip(summarizeNotes[1])}"` : ''}.`, false, 'low', {
      query: summarizeNotes[1] || '',
    });
  }

  const fileSearch = lower.match(/\bsearch\s+(?:file\s+names|files)\s+(?:for\s+)?(.+)$/);
  if (fileSearch) {
    return pending('search_files', 'Search safe folder filenames', `Tokyo will search filenames in the configured safe folder for "${clip(fileSearch[1])}".`, true, 'high', {
      query: fileSearch[1],
    });
  }

  if (/\bopen\s+(?:my\s+)?(?:project|workspace|safe)\s+folder\b/.test(lower)) {
    return pending('open_path', 'Open safe workspace folder', 'Tokyo will open the configured safe workspace folder.', true, 'high', {
      target: '.',
    });
  }

  const fileMatch = raw.match(/^create\s+(?:a\s+)?(?:text\s+)?file\s+(?:named\s+)?([^\s]+)(?:\s+(?:saying|with)\s+([\s\S]+))?/i);
  if (fileMatch) {
    return pending('create_text_file', `Create ${fileMatch[1]}`, 'Tokyo will create this text file inside the configured safe folder only.', true, 'critical', {
      filename: fileMatch[1],
      content: fileMatch[2] || '',
    });
  }

  return null;
}

export async function executePendingAction(userId: string, action: PendingAction): Promise<ActionResult> {
  await logActivity(userId, 'action_approved', action.title, { kind: action.kind });

  if (action.kind === 'create_note') {
    await saveLocalNote(userId, {
      title: action.payload.title || 'Chat note',
      content: action.payload.content || '',
      source: 'chat',
      category: (action.payload.category as LocalNote['category']) || 'Other',
    });
    await logActivity(userId, 'action_completed', action.title, { kind: action.kind });
    return { ok: true, message: 'Saved note locally.' };
  }

  if (action.kind === 'save_memory') {
    await saveLocalMemory(userId, {
      title: action.payload.title || 'Chat memory',
      content: action.payload.content || '',
      tags: ['chat'],
      source: 'chat',
    });
    await logActivity(userId, 'memory_added', action.payload.title || 'Chat memory');
    await logActivity(userId, 'action_completed', action.title, { kind: action.kind });
    return { ok: true, message: 'Saved memory locally.' };
  }

  if (action.kind === 'create_task') {
    await saveLocalPlannerTask(userId, {
      title: action.payload.title || 'New task',
      notes: action.payload.notes || 'Created from chat.',
      priority: (action.payload.priority as 'low' | 'medium' | 'high') || 'medium',
      deadline: action.payload.deadline || '',
    });
    await logActivity(userId, 'task_added', action.payload.title || 'New task');
    await logActivity(userId, 'action_completed', action.title, { kind: action.kind });
    return { ok: true, message: 'Added task to Planner.' };
  }

  if (action.kind === 'search_notes') {
    const query = action.payload.query || '';
    if (action.payload.area === 'memories') {
      const memories = (await getLocalMemories(userId)).filter((memory) =>
        `${memory.title} ${memory.content}`.toLowerCase().includes(query.toLowerCase()),
      );
      return {
        ok: true,
        message: memories.length
          ? memories.slice(0, 6).map((memory) => `- ${memory.title}: ${memory.content}`).join('\n')
          : 'No matching memories found.',
      };
    }
    const notes = await searchLocalNotes(userId, query);
    return {
      ok: true,
      message: notes.length
        ? notes.map((note) => `- ${note.title}: ${note.content}`).join('\n')
        : 'No matching local notes found.',
    };
  }

  if (action.kind === 'summarize_notes') {
    const query = action.payload.query || '';
    const notes = await searchLocalNotes(userId, query);
    if (notes.length === 0) {
      return { ok: true, message: query ? `No local notes found for "${query}".` : 'No local notes found to summarize.' };
    }
    const lines = notes.slice(0, 6).map((note, index) => `${index + 1}. ${note.title} (${note.category}): ${clip(note.content, 140)}`);
    return {
      ok: true,
      message: [`Local notes summary${query ? ` for "${query}"` : ''}:`, ...lines, 'Next step: ask me to turn these into exam notes, a checklist, or tasks.'].join('\n'),
    };
  }

  if (action.requires_backend) {
    const result = await executeBackendAction(action.kind, action.payload);
    await logActivity(userId, result.ok ? 'action_completed' : 'action_failed', result.message, { kind: action.kind });
    return result;
  }

  return { ok: false, message: action.payload.reason || 'This action is not available yet.' };
}

function detectUnsupported(lower: string): PendingAction | null {
  if (/\b(delete|format|shutdown|restart|registry|powershell|cmd|terminal|run command|execute command)\b/.test(lower)) {
    return pending(
      'unsupported',
      'High-risk action blocked',
      'Tokyo does not run arbitrary system commands or destructive actions. This would require a future high-risk permission and explicit approval.',
      false,
      'critical',
      { reason: 'Arbitrary or destructive system action requested.' },
    );
  }

  if (/\b(rename|move)\s+.+\bfile\b/.test(lower)) {
    return pending(
      'unsupported',
      'File rename/move preview only',
      'Rename and move are intentionally disabled until a safe preview-and-confirm implementation is completed.',
      false,
      'high',
      { reason: 'Rename/move is disabled.' },
    );
  }

  return null;
}

function pending(
  kind: PendingAction['kind'],
  title: string,
  description: string,
  requires_backend: boolean,
  risk_level: PendingAction['risk_level'],
  payload: Record<string, string>,
): PendingAction {
  return {
    id: nowId('action'),
    kind,
    title,
    description,
    requires_backend,
    risk_level,
    payload,
    status: 'pending',
  };
}

function permissionRequired(action: PendingAction, permissions: PermissionSettings) {
  if (action.kind === 'open_app' && !permissions.open_apps) return 'Open apps permission is off.';
  if (action.kind === 'open_website' && !permissions.open_websites) return 'Open websites permission is off.';
  if (action.kind === 'search_notes' && action.payload.area === 'memories') {
    return permissions.memory_access ? '' : 'Memory access permission is off.';
  }
  if ((action.kind === 'create_note' || action.kind === 'summarize_notes' || action.kind === 'search_notes') && !permissions.notes_access) return 'Notes permission is off.';
  if (action.kind === 'save_memory' && !permissions.memory_access) return 'Memory access permission is off.';
  if (action.kind === 'create_task' && !permissions.planner_actions) return 'Planner actions permission is off.';
  if ((action.kind === 'search_files' || action.kind === 'open_path') && !permissions.file_read_access) return 'Safe-folder file read permission is off.';
  if (action.kind === 'create_text_file' && !permissions.file_write_access) return 'Safe-folder file write permission is off.';
  return '';
}

function inferNoteCategory(text: string) {
  const lower = text.toLowerCase();
  if (/\b(oop|dld|exam|class|study|paper|quiz|assignment)\b/.test(lower)) return 'Study';
  if (/\b(work|client|meeting|office|internship)\b/.test(lower)) return 'Work';
  if (/\b(code|bug|function|typescript|javascript|python|c\+\+|cpp)\b/.test(lower)) return 'Code';
  if (/\bidea|project|startup|build\b/.test(lower)) return 'Ideas';
  if (/\bhome|family|personal\b/.test(lower)) return 'Personal';
  return 'Other';
}

function extractAfter(raw: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = raw.replace(pattern, '').trim();
    if (value !== raw.trim() && value) return value;
  }
  return '';
}

function titleFromText(text: string) {
  return clip(text).replace(/[.?!]+$/, '') || 'Chat item';
}

function clip(text: string, limit = 80) {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function parseTask(text: string): Record<string, string> {
  const deadlineMatch = text.match(/\s+(?:at|by|on)\s+(.+)$/i);
  const title = deadlineMatch ? text.slice(0, deadlineMatch.index).trim() : text.trim();
  const priority = /\b(urgent|important|high priority)\b/i.test(text) ? 'high' : 'medium';
  return {
    title: title || text.trim(),
    notes: 'Created from chat.',
    priority,
    deadline: deadlineMatch?.[1]?.trim() || '',
  };
}
