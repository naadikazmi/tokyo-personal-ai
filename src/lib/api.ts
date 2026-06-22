import type { ActionResult, ChatMessage, Memory, PdfGeneratedNotes, PdfPageText, ResearchReport, SystemHealth } from '../types/app';

const defaultApiBaseUrl =
  typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8083` : 'http://localhost:8083';

const runtimeApiBaseUrl =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('apiBaseUrl')?.trim() || ''
    : '';

export const apiBaseUrl = (runtimeApiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  config: { suppressConsoleError?: boolean } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    if (!config.suppressConsoleError) {
      console.error(`API request failed before response: ${path}`, error);
    }
    throw new ApiError('Local API server is not reachable. Start it with npm run api or npm run dev.', 0, 'API_UNREACHABLE');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : `Request failed with HTTP ${response.status}.`;
    if (!config.suppressConsoleError) {
      console.error(`API request failed: ${path}`, payload);
    }
    throw new ApiError(message, response.status, payload.code);
  }

  return payload as T;
}

export async function getSettingsStatus() {
  return request<SystemHealth>('/api/settings/status');
}

export async function sendChatToApi(params: {
  userId: string;
  messages: ChatMessage[];
  memories: Memory[];
  assistantName: string;
  personality: string;
}) {
  return request<{ reply: string; mode?: 'openai' | 'local' }>(
    '/api/chat',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { suppressConsoleError: true },
  );
}

export async function runResearchApi(userId: string, query: string) {
  return request<{ report: ResearchReport }>('/api/research', {
    method: 'POST',
    body: JSON.stringify({ userId, query }),
  });
}

export async function testSupabaseApi(userId: string) {
  return request<{ ok: boolean; message: string }>('/api/activity-logs', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, action_type: 'health_check', detail: 'Supabase activity log test' }),
  });
}

export async function executeBackendAction(type: string, payload: Record<string, string>) {
  return request<ActionResult>('/api/actions/execute', {
    method: 'POST',
    body: JSON.stringify({ type, payload }),
  });
}

export async function getBackendActionStatus() {
  return request<{ desktop: boolean; platform: string; safeWorkspace: string }>('/api/actions/status');
}

export async function extractLocalPdfFile(filePath: string) {
  return request<{
    file_name: string;
    file_size: number;
    file_path: string;
    page_count: number;
    pages: PdfPageText[];
  }>('/api/pdf/extract-file', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
}

export async function generatePdfNotesApi(fileName: string, pages: PdfPageText[]) {
  return request<{ notes: PdfGeneratedNotes; mode: 'openai' | 'local' }>('/api/pdf/generate-notes', {
    method: 'POST',
    body: JSON.stringify({ fileName, pages }),
  });
}
