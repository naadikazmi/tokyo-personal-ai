export type AppTab =
  | 'home'
  | 'chat'
  | 'notes'
  | 'memories'
  | 'research'
  | 'planner'
  | 'study'
  | 'coding'
  | 'workspace'
  | 'clipboard'
  | 'pdfNotes'
  | 'permissions'
  | 'logs'
  | 'settings'
  | 'avatar';

export type AssistantTone = 'Friendly' | 'Professional' | 'Caring' | 'Funny' | 'Strict/productive';

export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'serious'
  | 'warning'
  | 'surprised'
  | 'caring'
  | 'error';

export type ThemeMode = 'System' | 'Dark' | 'Cinematic';

export type Memory = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  action_type: string;
  detail: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type PermissionKey =
  | 'chat_only'
  | 'research_only'
  | 'study_mode'
  | 'coding_helper'
  | 'memory_access'
  | 'open_apps'
  | 'open_websites'
  | 'notes_access'
  | 'planner_actions'
  | 'file_read_access'
  | 'file_write_access'
  | 'clipboard_helper'
  | 'pdf_processing'
  | 'voice_placeholder'
  | 'browser_automation'
  | 'device_control_placeholder'
  | 'system_command_access'
  | 'full_device_control';

export type PermissionRow = {
  id: string;
  user_id: string;
  permission_key: PermissionKey;
  enabled: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  updated_at: string;
};

export type PermissionSettings = Record<PermissionKey, boolean>;

export type UserSettings = {
  id: string;
  user_id: string;
  display_name: string;
  assistant_name: string;
  tone: AssistantTone;
  assistant_style: string;
  avatar_visible?: boolean;
  avatar_animation?: boolean;
  voice_mode_placeholder?: boolean;
  theme_mode?: ThemeMode;
  safe_workspace_folder?: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'action';
  content: string;
  action?: PendingAction;
  action_result?: ActionResult;
  created_at?: string;
};

export type ActionKind =
  | 'open_app'
  | 'open_website'
  | 'create_note'
  | 'save_memory'
  | 'create_task'
  | 'search_notes'
  | 'summarize_notes'
  | 'search_files'
  | 'open_path'
  | 'create_text_file'
  | 'unsupported';

export type PendingAction = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  requires_backend: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  payload: Record<string, string>;
  status: 'pending' | 'approved' | 'cancelled' | 'completed' | 'failed';
};

export type ActionResult = {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export type ResearchSource = {
  title: string;
  url: string;
  snippet?: string;
};

export type ResearchResult = {
  short_summary: string;
  key_points: string[];
  pros: string[];
  cons: string[];
  recommendation: string;
  confidence: 'Low' | 'Medium' | 'High';
  sources: ResearchSource[];
};

export type ResearchReport = {
  id: string;
  user_id: string;
  query: string;
  result: ResearchResult;
  sources: ResearchSource[];
  confidence: 'Low' | 'Medium' | 'High';
  created_at: string;
};

export type AvatarProfile = {
  id: string;
  user_id: string;
  name: string;
  personality: string;
  appearance: {
    visual_style: string;
    accent_color: string;
    role: string;
    hair?: string;
    outfit?: string;
  };
  voice_style: string | null;
  is_active: boolean;
  created_at: string;
};

export type SystemHealth = {
  ai: { connected: boolean; message: string };
  research: { connected: boolean; message: string; provider?: string };
  supabase: { connected: boolean; message: string };
  memory: { mode: 'Supabase' | 'Local'; message: string };
  logs: { working: boolean; message: string };
};

export type PlannerTask = {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type LocalNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  source: 'chat' | 'manual' | 'file';
  category: 'Study' | 'Work' | 'Personal' | 'Ideas' | 'Code' | 'Other';
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type PdfFlashcard = {
  id: string;
  question: string;
  answer: string;
  page?: number;
};

export type PdfQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: string;
  page?: number;
};

export type PdfGeneratedNotes = {
  easy_notes: string[];
  section_summaries: Array<{ title: string; summary: string; pages: number[] }>;
  definitions: Array<{ term: string; definition: string; page?: number }>;
  key_points: Array<{ text: string; page?: number }>;
  exam_answers: string[];
  short_qa: Array<{ question: string; answer: string; page?: number }>;
  mcqs: PdfQuizQuestion[];
  flashcards: PdfFlashcard[];
  mind_map: string[];
  glossary: Array<{ term: string; meaning: string; page?: number }>;
  revision_checklist: string[];
  long_questions: string[];
  short_questions: string[];
};

export type PdfPageText = {
  page: number;
  text: string;
};

export type PdfNotesSession = {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  page_count: number;
  file_path?: string;
  pages: PdfPageText[];
  notes?: PdfGeneratedNotes;
  created_at: string;
  last_opened_at: string;
};
