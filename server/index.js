const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

loadEnvFiles();

const PREFERRED_PORT = Number(process.env.API_PORT || 8083);
const HOST = process.env.API_HOST || '127.0.0.1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const RESEARCH_PROVIDER = (process.env.RESEARCH_PROVIDER || '').toLowerCase();
const RESEARCH_API_KEY = process.env.RESEARCH_API_KEY || '';
const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '');
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method || '') ? await readBody(req) : {};

    if (req.method === 'GET' && url.pathname === '/api/settings/status') {
      return json(res, 200, await getHealthStatus());
    }

    if (req.method === 'GET' && url.pathname === '/api/actions/status') {
      return json(res, 200, getActionStatus());
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      return json(res, 200, await handleChat(body));
    }

    if (req.method === 'POST' && url.pathname === '/api/actions/execute') {
      return json(res, 200, await executeAction(body));
    }

    if (req.method === 'POST' && url.pathname === '/api/research') {
      return json(res, 200, await handleResearch(body));
    }

    if (req.method === 'POST' && url.pathname === '/api/pdf/extract-file') {
      return json(res, 200, await extractPdfFile(body));
    }

    if (req.method === 'POST' && url.pathname === '/api/pdf/generate-notes') {
      return json(res, 200, await generatePdfNotes(body));
    }

    if (url.pathname === '/api/memories') {
      return handleCollection(res, 'memories', req.method, body, url);
    }
    if (url.pathname.startsWith('/api/memories/')) {
      return handleItem(res, 'memories', req.method, body, url.pathname.split('/').pop());
    }
    if (url.pathname === '/api/activity-logs') {
      return handleCollection(res, 'activity_logs', req.method, body, url);
    }
    if (url.pathname === '/api/avatars') {
      return handleCollection(res, 'avatars', req.method, body, url);
    }
    if (url.pathname.startsWith('/api/avatars/')) {
      return handleItem(res, 'avatars', req.method, body, url.pathname.split('/').pop());
    }
    if (req.method === 'POST' && url.pathname === '/api/permissions/update') {
      return handlePermissionUpdate(res, body);
    }
    if (req.method === 'POST' && url.pathname === '/api/emergency-lock') {
      return handleEmergencyLock(res, body);
    }

    return json(res, 404, { error: 'API route not found.', code: 'NOT_FOUND' });
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error('Unhandled API error:', error);
    }
    return json(res, error.status || 500, {
      error: error.message || 'Internal server error.',
      code: error.code || 'INTERNAL_ERROR',
    });
  }
});

function startServer({ preferredPort = PREFERRED_PORT, host = HOST } = {}) {
  return listenWithRetry(preferredPort, host);
}

function listenWithRetry(preferredPort, host, attempts = 50) {
  return new Promise((resolve, reject) => {
    let port = Number(preferredPort || 8083);
    const firstPort = port;
    const lastPort = firstPort + attempts - 1;

    const tryListen = () => {
      const onError = (error) => {
        server.off('listening', onListening);
        if (error.code === 'EADDRINUSE' && port < lastPort) {
          console.warn(`API port ${port} is busy, trying ${port + 1}...`);
          port += 1;
          setTimeout(tryListen, 50);
          return;
        }
        if (error.code === 'EADDRINUSE') {
          const noPortError = new Error(`Tokyo API could not find an available local port from ${firstPort} to ${lastPort}.`);
          noPortError.code = 'NO_FREE_PORT';
          noPortError.details = { startPort: firstPort, endPort: lastPort };
          console.error('Tokyo Personal AI API startup failed:', noPortError);
          reject(noPortError);
          return;
        }
        console.error('Tokyo Personal AI API startup failed:', error);
        reject(error);
      };

      const onListening = () => {
        server.off('error', onError);
        process.env.API_PORT = String(port);
        console.log(`Tokyo Personal AI API listening on http://${host}:${port}`);
        resolve({ port, host, server });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    };

    tryListen();
  });
}

if (require.main === module) {
  startServer().catch(() => {
    process.exitCode = 1;
  });
} else {
  module.exports = { startServer };
}

function loadEnvFiles() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : '',
    process.resourcesPath ? path.join(process.resourcesPath, '..', '.env') : '',
    process.execPath ? path.join(path.dirname(process.execPath), '.env') : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    loadEnv(candidate);
  }
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeSupabaseUrl(url) {
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw setupError('Invalid JSON request body.', 'INVALID_JSON', 400);
  }
}

function setupError(message, code = 'SETUP_REQUIRED', status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function getHealthStatus() {
  const supabaseStatus = await testSupabase();
  const logsStatus = await testLogs();
  return {
    app: {
      id: 'tokyo-personal-ai',
      name: 'Tokyo Personal AI',
      api: 'local',
      port: Number(process.env.API_PORT || PREFERRED_PORT),
    },
    ai: OPENAI_API_KEY
      ? { connected: true, message: `OpenAI key present. Model: ${OPENAI_MODEL}.` }
      : { connected: false, message: 'OpenAI not connected — local fallback active.' },
    research:
      RESEARCH_PROVIDER && RESEARCH_API_KEY
        ? { connected: true, provider: RESEARCH_PROVIDER, message: `${RESEARCH_PROVIDER} search key present.` }
        : {
            connected: false,
            provider: RESEARCH_PROVIDER || undefined,
            message: 'Demo research mode active. Live research is optional.',
          },
    supabase: supabaseStatus,
    memory: {
      mode: supabaseStatus.connected ? 'Supabase' : 'Local',
      message: supabaseStatus.connected ? 'Cloud memory mode can be used.' : 'Memories stored locally.',
    },
    logs: logsStatus,
  };
}

async function testSupabase() {
  if (!supabase) {
    return { connected: false, message: 'Local mode active — cloud sync disabled.' };
  }

  const { error } = await supabase.from('settings').select('id').limit(1);
  if (error) {
    return { connected: false, message: 'Cloud sync disabled until Supabase tables are configured. Local mode is active.' };
  }
  return { connected: true, message: 'Supabase REST connection works and settings table is visible.' };
}

async function testLogs() {
  if (!supabase) return { working: true, message: 'Activity logs stored locally.' };
  const { error } = await supabase.from('activity_logs').select('id').limit(1);
  if (error) {
    return { working: true, message: 'Activity logs stored locally. Cloud activity_logs table is optional.' };
  }
  return { working: true, message: 'activity_logs table is visible.' };
}

async function handleChat(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== 'user' || !String(latest.content || '').trim()) {
    throw setupError('Chat requires a non-empty user message.', 'BAD_CHAT_REQUEST', 400);
  }
  const safety = classifySafetyIntent(String(latest.content || ''));
  if (safety.blocked || safety.educationalReply) {
    return { reply: safety.educationalReply, mode: 'local', safety: safety.reason };
  }

  if (!OPENAI_API_KEY) {
    return {
      reply: buildLocalAssistantReply({
        assistantName: body.assistantName || 'Tokyo',
        latest: String(latest.content || ''),
        memories: Array.isArray(body.memories) ? body.memories : [],
      }),
      mode: 'local',
    };
  }

  const memoryText = Array.isArray(body.memories)
    ? body.memories.map((memory) => `- ${memory.title}: ${memory.content}`).join('\n')
    : '';

  const openAiMessages = [
    {
      role: 'system',
      content: [
        body.personality || `You are ${body.assistantName || 'Tokyo'}, a personal AI assistant.`,
        'Never pretend to have device, file, browser, app, command, or private-data access. Say when a capability is not connected.',
        memoryText ? `Relevant memories:\n${memoryText}` : 'No memories were supplied.',
      ].join('\n\n'),
    },
    ...messages.slice(-16).map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
    })),
  ];

  const data = await callOpenAI(openAiMessages, 0.4);
  return { reply: data, mode: 'openai' };
}

async function handleResearch(body) {
  const query = String(body.query || '').trim();
  if (!query) throw setupError('Research requires a non-empty query.', 'BAD_RESEARCH_REQUEST', 400);
  const safety = classifySafetyIntent(query);
  if (safety.blocked || safety.educationalReply) {
    return { report: buildSafetyResearchReport(body.userId, query, safety.educationalReply) };
  }

  if (!OPENAI_API_KEY) {
    return { report: buildDemoResearchReport(body.userId, query, 'OpenAI is not configured, so this is an offline planning summary without live sources.') };
  }
  if (!RESEARCH_PROVIDER || !RESEARCH_API_KEY) {
    return { report: buildDemoResearchReport(body.userId, query, 'A live search provider is not configured, so this is an offline planning summary without live sources.') };
  }

  const sources = await searchWeb(query);
  if (sources.length === 0) {
    throw setupError('The configured search provider returned no sources for this query.', 'NO_RESEARCH_SOURCES', 502);
  }

  const sourceBlock = sources
    .slice(0, 5)
    .map((source, index) => `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet || ''}`)
    .join('\n\n');

  const content = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'Create source-grounded research only from the supplied sources. Return strict JSON with keys short_summary, key_points, pros, cons, recommendation, confidence. Confidence must be Low, Medium, or High. Do not invent links or facts beyond the snippets.',
      },
      {
        role: 'user',
        content: `Research query: ${query}\n\nSources:\n${sourceBlock}`,
      },
    ],
    0.2,
    true,
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('OpenAI research JSON parse failed:', error, content);
    throw setupError('Research synthesis failed to return valid JSON. Check backend logs.', 'RESEARCH_SYNTHESIS_FAILED', 502);
  }

  const confidence = ['Low', 'Medium', 'High'].includes(parsed.confidence) ? parsed.confidence : 'Medium';
  const report = {
    id: `${Date.now()}-research`,
    user_id: String(body.userId || 'local-user'),
    query,
    result: {
      short_summary: String(parsed.short_summary || ''),
      key_points: normalizeStringArray(parsed.key_points),
      pros: normalizeStringArray(parsed.pros),
      cons: normalizeStringArray(parsed.cons),
      recommendation: String(parsed.recommendation || ''),
      confidence,
      sources,
    },
    sources,
    confidence,
    created_at: new Date().toISOString(),
  };

  if (supabase && body.userId) {
    const { error } = await supabase.from('research_history').insert({
      user_id: String(body.userId),
      query,
      result: report.result,
      sources,
      confidence,
    });
    if (error) console.error('Could not save research_history to Supabase:', error);
  }

  return { report };
}

function classifySafetyIntent(text) {
  const patterns = [
    /\bsieg\s+heil\b/i,
    /\bheil\s+hitler\b/i,
    /\bnazi\s+(power|glory|victory|forever)\b/i,
    /\bwhite\s+power\b/i,
    /\b1488\b/i,
  ];
  const matched = patterns.some((pattern) => pattern.test(text));
  if (!matched) return { blocked: false, reason: '', educationalReply: '' };
  const educationalAllowed = /\b(history|historical|explain|meaning|context|why|danger|harm|study|class|exam)\b/i.test(text);
  const promotional = /\b(praise|glorify|support|promote|celebrate|write slogan|make propaganda|join|recruit)\b/i.test(text) || !educationalAllowed;
  return {
    blocked: promotional,
    reason: promotional ? 'hateful_ideology_promotion' : 'hateful_ideology_educational',
    educationalReply: promotional
      ? 'This phrase is associated with Nazi ideology and hate movements. I can help explain its historical context, harms, or why it is dangerous, but I will not promote, praise, recruit for, or glorify it.'
      : 'This phrase is associated with Nazi ideology and hate movements. I can help explain its historical context, harms, and why it is dangerous, but I will not promote or glorify it.',
  };
}

function buildSafetyResearchReport(userId, query, safetyMessage) {
  return {
    id: `${Date.now()}-safety-research`,
    user_id: String(userId || 'local-user'),
    query,
    result: {
      short_summary: safetyMessage,
      key_points: [
        'The topic is associated with hateful ideology or extremist propaganda.',
        'Tokyo can help with neutral historical context, harm analysis, and educational discussion.',
        'Tokyo will not produce promotional slogans, praise, recruitment, or glorification.',
      ],
      pros: ['Educational framing can support historical understanding and harm prevention.'],
      cons: ['Promotional or glorifying content is not allowed.'],
      recommendation: 'Reframe the request as historical context, critical analysis, or safety education.',
      confidence: 'High',
      sources: [],
    },
    sources: [],
    confidence: 'High',
    created_at: new Date().toISOString(),
  };
}

async function extractPdfFile(body) {
  const filePath = String(body.filePath || '').trim();
  if (!filePath || path.extname(filePath).toLowerCase() !== '.pdf') {
    throw setupError('Choose a valid PDF file.', 'BAD_PDF_FILE', 400);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw setupError('The selected PDF file does not exist.', 'PDF_NOT_FOUND', 404);
  }
  const buffer = fs.readFileSync(resolved);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true });
  const pdf = await task.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: pageNumber, text });
  }
  if (!pages.some((page) => page.text.trim())) {
    throw setupError('This PDF may be scanned/image-based. OCR is not available yet.', 'PDF_TEXT_EMPTY', 422);
  }
  return {
    file_name: path.basename(resolved),
    file_size: buffer.length,
    file_path: resolved,
    page_count: pages.length,
    pages,
  };
}

async function generatePdfNotes(body) {
  const pages = Array.isArray(body.pages) ? body.pages : [];
  if (pages.length === 0) throw setupError('PDF notes require extracted page text.', 'BAD_PDF_NOTES', 400);
  if (!OPENAI_API_KEY) {
    return { notes: buildLocalPdfNotes(pages), mode: 'local' };
  }
  const chunk = pages
    .map((page) => `Page ${page.page}:\n${String(page.text || '').slice(0, 2500)}`)
    .join('\n\n')
    .slice(0, 14000);
  const content = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'Create study notes from the supplied PDF text only. Return strict JSON with keys easy_notes, section_summaries, definitions, key_points, exam_answers, short_qa, mcqs, flashcards, mind_map, glossary, revision_checklist, long_questions, short_questions. Include page numbers where possible. Do not invent facts.',
      },
      { role: 'user', content: `PDF: ${body.fileName || 'PDF'}\n\n${chunk}` },
    ],
    0.25,
    true,
  );
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { notes: buildLocalPdfNotes(pages), mode: 'local' };
  }
  return { notes: normalizePdfNotes(parsed), mode: 'openai' };
}

function buildLocalPdfNotes(pages) {
  const text = pages.map((page) => String(page.text || '')).join(' ');
  const terms = [...new Set((text.match(/\b[A-Za-z][A-Za-z0-9+-]{4,}\b/g) || []).slice(0, 18))];
  const keyPoints = pages.slice(0, 10).map((page) => ({
    text: String(page.text || '').replace(/\s+/g, ' ').slice(0, 220),
    page: Number(page.page || 1),
  }));
  return normalizePdfNotes({
    easy_notes: keyPoints.map((item) => `${item.text} (from page ${item.page})`),
    section_summaries: pages.slice(0, 8).map((page) => ({
      title: `Page ${page.page} summary`,
      summary: String(page.text || '').replace(/\s+/g, ' ').slice(0, 300),
      pages: [Number(page.page || 1)],
    })),
    definitions: terms.slice(0, 8).map((term) => ({ term, definition: `Important term from the PDF: ${term}.`, page: findPdfTermPage(pages, term) })),
    key_points: keyPoints,
    exam_answers: terms.slice(0, 4).map((term) => `Explain ${term} with definition, example, and exam relevance.`),
    short_qa: terms.slice(0, 8).map((term) => ({ question: `What is ${term}?`, answer: `Define ${term} using the PDF context.`, page: findPdfTermPage(pages, term) })),
    mcqs: terms.slice(0, 5).map((term, index) => ({ id: `${index}-mcq`, question: `Which term appears in the PDF?`, options: terms.slice(index, index + 4), answer: term, page: findPdfTermPage(pages, term) })),
    flashcards: terms.slice(0, 8).map((term, index) => ({ id: `${index}-card`, question: `Explain ${term}`, answer: `Review ${term} around page ${findPdfTermPage(pages, term) || '?'}.`, page: findPdfTermPage(pages, term) })),
    mind_map: terms.slice(0, 8).map((term) => `PDF topic -> ${term}`),
    glossary: terms.slice(0, 10).map((term) => ({ term, meaning: `Key PDF term: ${term}`, page: findPdfTermPage(pages, term) })),
    revision_checklist: ['Review definitions', 'Practice flashcards', 'Answer short questions', 'Write long answers'],
    long_questions: terms.slice(0, 5).map((term) => `Discuss ${term} in detail.`),
    short_questions: terms.slice(0, 8).map((term) => `Define ${term}.`),
  });
}

function normalizePdfNotes(value) {
  return {
    easy_notes: normalizeStringArray(value.easy_notes).slice(0, 12),
    section_summaries: Array.isArray(value.section_summaries) ? value.section_summaries.slice(0, 12).map((item) => ({ title: String(item.title || 'Section'), summary: String(item.summary || ''), pages: Array.isArray(item.pages) ? item.pages.map(Number).filter(Boolean) : [] })) : [],
    definitions: normalizeObjectArray(value.definitions, ['term', 'definition']),
    key_points: normalizeObjectArray(value.key_points, ['text']),
    exam_answers: normalizeStringArray(value.exam_answers).slice(0, 8),
    short_qa: normalizeObjectArray(value.short_qa, ['question', 'answer']),
    mcqs: Array.isArray(value.mcqs) ? value.mcqs.slice(0, 10).map((item, index) => ({ id: String(item.id || `${index}-mcq`), question: String(item.question || ''), options: normalizeStringArray(item.options).slice(0, 4), answer: String(item.answer || ''), page: Number(item.page) || undefined })) : [],
    flashcards: Array.isArray(value.flashcards) ? value.flashcards.slice(0, 12).map((item, index) => ({ id: String(item.id || `${index}-card`), question: String(item.question || ''), answer: String(item.answer || ''), page: Number(item.page) || undefined })) : [],
    mind_map: normalizeStringArray(value.mind_map).slice(0, 12),
    glossary: normalizeObjectArray(value.glossary, ['term', 'meaning']),
    revision_checklist: normalizeStringArray(value.revision_checklist).slice(0, 12),
    long_questions: normalizeStringArray(value.long_questions).slice(0, 10),
    short_questions: normalizeStringArray(value.short_questions).slice(0, 12),
  };
}

function normalizeObjectArray(value, keys) {
  return Array.isArray(value)
    ? value.slice(0, 14).map((item) => {
        const next = {};
        for (const key of keys) next[key] = String(item?.[key] || '');
        if (item?.page) next.page = Number(item.page) || undefined;
        return next;
      })
    : [];
}

function findPdfTermPage(pages, term) {
  return pages.find((page) => String(page.text || '').toLowerCase().includes(String(term).toLowerCase()))?.page;
}

async function callOpenAI(messages, temperature, jsonMode = false) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('OpenAI request failed:', data);
    throw setupError(data.error?.message || 'OpenAI request failed. Check API key and model.', 'OPENAI_REQUEST_FAILED', response.status);
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw setupError('OpenAI returned an empty response.', 'OPENAI_EMPTY_RESPONSE', 502);
  return content;
}

async function searchWeb(query) {
  if (RESEARCH_PROVIDER === 'tavily') return searchTavily(query);
  if (RESEARCH_PROVIDER === 'brave') return searchBrave(query);
  if (RESEARCH_PROVIDER === 'serpapi') return searchSerpApi(query);
  if (RESEARCH_PROVIDER === 'bing') return searchBing(query);
  throw setupError(
    'Unsupported RESEARCH_PROVIDER. Use tavily, brave, serpapi, or bing.',
    'UNSUPPORTED_RESEARCH_PROVIDER',
  );
}

async function searchTavily(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: RESEARCH_API_KEY, query, search_depth: 'basic', max_results: 5 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Tavily search failed:', data);
    throw setupError('Tavily search failed. Check RESEARCH_API_KEY.', 'RESEARCH_PROVIDER_FAILED', response.status);
  }
  return (data.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.content })).filter(validSource);
}

async function searchBrave(query) {
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
    headers: { 'X-Subscription-Token': RESEARCH_API_KEY, Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Brave search failed:', data);
    throw setupError('Brave Search failed. Check RESEARCH_API_KEY.', 'RESEARCH_PROVIDER_FAILED', response.status);
  }
  return (data.web?.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.description })).filter(validSource);
}

async function searchSerpApi(query) {
  const response = await fetch(
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(RESEARCH_API_KEY)}`,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    console.error('SerpAPI search failed:', data);
    throw setupError(data.error || 'SerpAPI failed. Check RESEARCH_API_KEY.', 'RESEARCH_PROVIDER_FAILED', response.status || 502);
  }
  return (data.organic_results || [])
    .slice(0, 5)
    .map((item) => ({ title: item.title, url: item.link, snippet: item.snippet }))
    .filter(validSource);
}

async function searchBing(query) {
  const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`, {
    headers: { 'Ocp-Apim-Subscription-Key': RESEARCH_API_KEY },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Bing search failed:', data);
    throw setupError('Bing Search failed. Check RESEARCH_API_KEY.', 'RESEARCH_PROVIDER_FAILED', response.status);
  }
  return (data.webPages?.value || []).map((item) => ({ title: item.name, url: item.url, snippet: item.snippet })).filter(validSource);
}

function validSource(source) {
  return source.title && source.url && /^https?:\/\//i.test(source.url);
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean).slice(0, 8) : [];
}

function buildLocalAssistantReply({ assistantName, latest, memories }) {
  const prompt = latest.trim();
  const lower = prompt.toLowerCase();
  const memoryHint = memories.length
    ? `\n\nLocal memory I can use: ${memories.slice(0, 3).map((memory) => memory.title).join(', ')}.`
    : '';

  if (/\b(c\+\+|cpp|game|code|program|script|html|javascript|typescript|python|debug|error)\b/.test(lower)) {
    if (/\bhello\s+world\b/.test(lower)) {
      const lang = lower.includes('python') ? 'python' : lower.includes('javascript') ? 'javascript' : lower.includes('typescript') ? 'typescript' : 'cpp';
      const snippets = {
        python: '```python\nprint("Hello, world!")\n```',
        javascript: '```js\nconsole.log("Hello, world!");\n```',
        typescript: '```ts\nconst message: string = "Hello, world!";\nconsole.log(message);\n```',
        cpp: '```cpp\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}\n```',
      };
      return [`${assistantName} local mode: here is a working Hello World example:`, snippets[lang], 'Use the Copy or Save to Notes button in chat if you want to keep it.'].join('\n\n');
    }
    return [
      `${assistantName} local mode: here is a simple working C++ console game you can compile with g++ or Visual Studio.`,
      '```cpp\n#include <iostream>\n#include <cstdlib>\n#include <ctime>\n\nint main() {\n    std::srand(static_cast<unsigned>(std::time(nullptr)));\n    int secret = 1 + std::rand() % 20;\n    int guess = 0;\n    int tries = 0;\n\n    std::cout << \"Guess the number from 1 to 20.\\\\n\";\n    while (guess != secret) {\n        std::cout << \"Your guess: \";\n        std::cin >> guess;\n        tries++;\n\n        if (guess < secret) std::cout << \"Too low.\\\\n\";\n        else if (guess > secret) std::cout << \"Too high.\\\\n\";\n        else std::cout << \"Correct in \" << tries << \" tries!\\\\n\";\n    }\n    return 0;\n}\n```',
      'Compile: `g++ game.cpp -o game` then run `./game`. Tell me the language or game idea and I can adapt it.',
    ].join('\n\n');
  }

  if (/\b(plan|schedule|day|routine|study)\b/.test(lower)) {
    return [
      `${assistantName} local mode plan:`,
      '1. Top priority: choose the one outcome that matters most today.',
      '2. Deep work: block 60-90 minutes for that outcome.',
      '3. Study/practice: use 45 minutes solving, 10 minutes recall, 5 minutes break.',
      '4. Admin: batch two small tasks in one 25 minute block.',
      '5. Review: write what is done, what is blocked, and the next action.',
      'Say “add task study DLD at 8pm” and I can save it in Planner after approval.',
      memoryHint,
    ].join('\n');
  }

  if (/\b(oop|dld|exam|quiz|flashcard|explain topic|study mode)\b/.test(lower)) {
    return [
      `${assistantName} local mode study draft for: ${prompt}`,
      'Simple explanation: define the topic, explain why it matters, then attach one small example.',
      'Key terms: definition, purpose, components, example, advantage, limitation.',
      'Short notes: definition, purpose, key terms, example, common mistake.',
      'Exam answer shape: introduction, definition, explanation, example, conclusion.',
      'Flashcards: definition, purpose, example, common mistake, exam point.',
      'Quiz yourself: What is it? Why is it used? Give one example. What mistake should I avoid?',
      'Open Study Mode for saved notes, quizzes, and flashcards.',
      memoryHint,
    ].join('\n\n');
  }

  if (/\b(research|summarize|compare|explain)\b/.test(lower)) {
    return [
      `${assistantName} local mode research structure for: ${prompt}`,
      'Summary: define the topic, list what is known, identify tradeoffs, then decide what evidence would change the answer.',
      'What to verify later: dates, names, statistics, legal/medical/financial claims, and current events.',
      'Key points: separate facts from assumptions, compare at least two options, and note risks or uncertainty.',
      'Output: finish with a recommendation plus what evidence would change it.',
      'Live web sources are not connected in local fallback. Use Research mode for an offline summary, or add OpenAI/search keys for live synthesis.',
    ].join('\n\n');
  }

  if (/\b(pdf|document|notes studio|flashcards|mcq)\b/.test(lower)) {
    return [
      `${assistantName} local mode PDF guidance: open PDF Notes Studio from the sidebar.`,
      'It can extract text from text-based PDFs, generate easy notes, summaries, definitions, flashcards, MCQs, revision checklists, and page-referenced Q&A.',
      'Scanned/image-only PDFs show a friendly OCR-not-available message instead of crashing.',
    ].join('\n\n');
  }

  if (/\b(clipboard|rewrite|grammar|translate|shorten|summarize this)\b/.test(lower)) {
    return [
      `${assistantName} local mode clipboard guidance: use Clipboard Helper for controlled text work.`,
      'It only reads clipboard text when you press Paste, then can summarize, rewrite professionally, shorten, make friendly, fix grammar, translate to Urdu/Roman Urdu, save to Notes, or send to Chat.',
    ].join('\n\n');
  }

  if (/\b(open|notepad|calculator|paint|youtube|chrome|browser|explorer|folder|file)\b/.test(lower)) {
    return [
      `${assistantName} can help with laptop actions through approval cards in chat.`,
      'Try: “Open Notepad”, “Open calculator”, “Open YouTube”, “Search files for report”, or “Create a text file named notes.txt saying ...”.',
      'Every action needs your approval first and is blocked by Emergency Lock.',
    ].join('\n\n');
  }

  if (/\b(remember|memory|note|task|remind)\b/.test(lower)) {
    return [
      `${assistantName} local mode can save useful local context.`,
      'Say “remember that ...” to save a memory, “create a note that ...” to save a note, or “add task ...” to create a planner item.',
      memoryHint,
    ].join('\n\n');
  }

  return [
    `${assistantName} local mode reply: ${prompt || 'I am ready.'}`,
    'I can help draft code, explain study topics, plan your day, create local notes, save memories, add planner tasks, and prepare safe laptop actions.',
    'For a direct action, say something like “Open Notepad” or “Create a note that I have class tomorrow”.',
    memoryHint,
  ].join('\n\n');
}

function buildDemoResearchReport(userId, query, reason) {
  const trimmedQuery = String(query || 'this topic').trim();
  const terms = trimmedQuery
    .split(/[\s,.;:!?()]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3)
    .slice(0, 5);
  return {
    id: `${Date.now()}-offline-research`,
    user_id: String(userId || 'local-user'),
    query,
    result: {
      short_summary: `${reason} Topic: ${trimmedQuery}. This is an offline research brief for planning and study, not live source-grounded research.`,
      key_points: [
        `Core question: what does "${trimmedQuery}" mean, why does it matter, and what decision or exam answer should it support?`,
        terms.length ? `Important terms to define: ${terms.join(', ')}.` : 'Important terms: define the main keywords before writing the final answer.',
        'Separate stable background knowledge from facts that need live verification.',
        'Compare at least two viewpoints, benefits, risks, and unknowns before deciding.',
        'For study use: convert the brief into definitions, short questions, long questions, and flashcards.',
      ],
      pros: ['Works offline.', 'Useful for planning the research path.', 'Does not invent source links.', 'Good for turning a topic into notes or exam prompts.'],
      cons: ['No live web lookup.', 'No source-grounded claims.', 'Current facts must be verified separately.', 'Needs OpenAI plus a search provider for real synthesis.'],
      recommendation: `Use this as a local first draft for "${trimmedQuery}". Verify current claims with live sources before relying on it for final research.`,
      confidence: 'Low',
      sources: [],
    },
    sources: [],
    confidence: 'Low',
    created_at: new Date().toISOString(),
  };
}

function getActionStatus() {
  return {
    desktop: Boolean(process.versions?.electron),
    platform: process.platform,
    safeWorkspace: defaultSafeWorkspace(),
  };
}

async function executeAction(body) {
  const type = String(body.type || '');
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

  if (type === 'open_app') return openApp(String(payload.app || ''));
  if (type === 'open_website') return openWebsite(String(payload.url || payload.website || ''));
  if (type === 'search_files') return searchFileNames(payload);
  if (type === 'list_files') return listWorkspaceFiles(payload);
  if (type === 'test_workspace') return testWorkspace(payload);
  if (type === 'open_path') return openSafePath(payload);
  if (type === 'create_text_file') return createTextFile(payload);

  throw setupError('This action is not supported by the local backend.', 'UNSUPPORTED_ACTION', 400);
}

function openApp(appName) {
  const normalized = appName.trim().toLowerCase();
  const commands = {
    notepad: ['notepad.exe', []],
    calculator: ['calc.exe', []],
    calc: ['calc.exe', []],
    paint: ['mspaint.exe', []],
    explorer: ['explorer.exe', []],
    'file explorer': ['explorer.exe', []],
    chrome: ['cmd.exe', ['/c', 'start', '""', 'chrome']],
    browser: ['cmd.exe', ['/c', 'start', '""', 'https://www.google.com']],
    vscode: ['cmd.exe', ['/c', 'start', '""', 'code']],
    'vs code': ['cmd.exe', ['/c', 'start', '""', 'code']],
  };
  const command = commands[normalized];
  if (!command) {
    throw setupError('Only Notepad, Calculator, Paint, Chrome/default browser, VS Code, and File Explorer are allowlisted.', 'APP_NOT_ALLOWED', 400);
  }
  spawnDetached(command[0], command[1]);
  return { ok: true, message: `Opened ${appName}.` };
}

function openWebsite(rawUrl) {
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) throw setupError('A valid http or https website is required.', 'BAD_WEBSITE_URL', 400);
  spawnDetached('cmd.exe', ['/c', 'start', '""', url]);
  return { ok: true, message: `Opened ${url} in the default browser.`, data: { url } };
}

function searchFileNames(payload) {
  const safeFolder = resolveSafeWorkspace(payload.safeFolder);
  const query = String(payload.query || '').trim().toLowerCase();
  if (!query) throw setupError('File search requires a filename query.', 'BAD_FILE_SEARCH', 400);
  const results = [];
  walkFileNames(safeFolder, query, results, 0);
  return {
    ok: true,
    message: results.length ? `Found ${results.length} matching file name(s).` : 'No matching file names found in the safe folder.',
    data: { safeFolder, results },
  };
}

function testWorkspace(payload) {
  const safeFolder = resolveSafeWorkspace(payload.safeFolder);
  return { ok: true, message: `Workspace access works: ${safeFolder}`, data: { safeFolder } };
}

function listWorkspaceFiles(payload) {
  const safeFolder = resolveSafeWorkspace(payload.safeFolder);
  const entries = fs.readdirSync(safeFolder, { withFileTypes: true }).slice(0, 40).map((entry) => ({
    name: entry.name,
    path: path.join(safeFolder, entry.name),
    type: entry.isDirectory() ? 'folder' : 'file',
  }));
  return {
    ok: true,
    message: entries.length ? `Found ${entries.length} item(s) in the safe workspace.` : 'Safe workspace is empty.',
    data: { safeFolder, results: entries },
  };
}

function openSafePath(payload) {
  const target = resolveInsideSafeWorkspace(payload.safeFolder, payload.target || '');
  if (!fs.existsSync(target)) throw setupError('The requested file or folder does not exist in the safe folder.', 'PATH_NOT_FOUND', 404);
  spawnDetached('explorer.exe', [target]);
  return { ok: true, message: `Opened ${target}.`, data: { path: target } };
}

function createTextFile(payload) {
  const filename = sanitizeFilename(String(payload.filename || 'tokyo-note.txt'));
  const target = resolveInsideSafeWorkspace(payload.safeFolder, filename);
  const content = String(payload.content || '');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return { ok: true, message: `Created ${target}.`, data: { path: target } };
}

function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });
  child.unref();
}

function normalizeWebsiteUrl(rawUrl) {
  let value = rawUrl.trim();
  const shortcuts = {
    youtube: 'https://www.youtube.com',
    google: 'https://www.google.com',
    github: 'https://github.com',
    gmail: 'https://mail.google.com',
    chatgpt: 'https://chatgpt.com',
    supabase: 'https://supabase.com',
  };
  value = shortcuts[value.toLowerCase()] || value;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function defaultSafeWorkspace() {
  return path.join(os.homedir(), 'Documents', 'Tokyo Personal AI Workspace');
}

function resolveSafeWorkspace(rawSafeFolder) {
  if (!String(rawSafeFolder || '').trim()) {
    throw setupError(
      'Set a safe workspace folder in Tokyo before running file actions.',
      'SAFE_WORKSPACE_REQUIRED',
      400,
    );
  }
  const safeFolder = path.resolve(String(rawSafeFolder));
  fs.mkdirSync(safeFolder, { recursive: true });
  return safeFolder;
}

function resolveInsideSafeWorkspace(rawSafeFolder, relativeTarget) {
  const safeFolder = resolveSafeWorkspace(rawSafeFolder);
  const target = path.resolve(safeFolder, String(relativeTarget || '').replace(/^[/\\]+/, ''));
  if (target !== safeFolder && !target.startsWith(`${safeFolder}${path.sep}`)) {
    throw setupError('Path is outside the configured safe folder.', 'PATH_OUTSIDE_SAFE_FOLDER', 400);
  }
  return target;
}

function sanitizeFilename(filename) {
  const clean = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim();
  return clean || 'tokyo-note.txt';
}

function walkFileNames(folder, query, results, depth) {
  if (results.length >= 30 || depth > 4) return;
  let entries = [];
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (results.length >= 30) return;
    const fullPath = path.join(folder, entry.name);
    if (entry.name.toLowerCase().includes(query)) {
      results.push({ name: entry.name, path: fullPath, type: entry.isDirectory() ? 'folder' : 'file' });
    }
    if (entry.isDirectory()) {
      walkFileNames(fullPath, query, results, depth + 1);
    }
  }
}

async function requireSupabase() {
  if (!supabase) {
    throw setupError('Supabase is not connected on the API server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 'SUPABASE_NOT_CONFIGURED');
  }
  return supabase;
}

async function handleCollection(res, table, method, body, url) {
  const client = await requireSupabase();
  if (method === 'GET') {
    const userId = url.searchParams.get('user_id');
    let query = client.from(table).select('*').limit(100);
    if (userId) query = query.eq('user_id', userId);
    query = query.order(table === 'activity_logs' ? 'created_at' : 'created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw setupError(error.message, 'SUPABASE_QUERY_FAILED', 500);
    return json(res, 200, { data });
  }
  if (method === 'POST') {
    const { data, error } = await client.from(table).insert(body).select().single();
    if (error) throw setupError(error.message, 'SUPABASE_INSERT_FAILED', 500);
    return json(res, 200, { ok: true, data, message: `${table} saved.` });
  }
  return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

async function handleItem(res, table, method, body, id) {
  const client = await requireSupabase();
  if (!id) return json(res, 400, { error: 'Missing item id.', code: 'BAD_REQUEST' });
  if (method === 'PUT') {
    const { data, error } = await client.from(table).update(body).eq('id', id).select().single();
    if (error) throw setupError(error.message, 'SUPABASE_UPDATE_FAILED', 500);
    return json(res, 200, { ok: true, data });
  }
  if (method === 'DELETE') {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw setupError(error.message, 'SUPABASE_DELETE_FAILED', 500);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

async function handlePermissionUpdate(res, body) {
  const client = await requireSupabase();
  const { user_id, permission_key, enabled, risk_level } = body;
  if (!user_id || !permission_key) return json(res, 400, { error: 'user_id and permission_key are required.', code: 'BAD_REQUEST' });
  const { data, error } = await client
    .from('permissions')
    .upsert({ user_id, permission_key, enabled: Boolean(enabled), risk_level: risk_level || 'high' }, { onConflict: 'user_id,permission_key' })
    .select()
    .single();
  if (error) throw setupError(error.message, 'SUPABASE_PERMISSION_FAILED', 500);
  return json(res, 200, { ok: true, data });
}

async function handleEmergencyLock(res, body) {
  const client = await requireSupabase();
  const userId = body.user_id;
  if (!userId) return json(res, 400, { error: 'user_id is required.', code: 'BAD_REQUEST' });
  const riskyKeys = [
    'open_apps',
    'open_websites',
    'file_read_access',
    'file_write_access',
    'clipboard_helper',
    'browser_automation',
    'device_control_placeholder',
    'system_command_access',
    'full_device_control',
  ];
  const rows = riskyKeys.map((permission_key) => ({ user_id: userId, permission_key, enabled: false, risk_level: 'critical' }));
  const { error } = await client.from('permissions').upsert(rows, { onConflict: 'user_id,permission_key' });
  if (error) throw setupError(error.message, 'SUPABASE_LOCK_FAILED', 500);
  await client.from('activity_logs').insert({
    user_id: userId,
    action_type: 'emergency_lock_enabled',
    detail: 'Risky permissions disabled by emergency lock.',
    metadata: { risky_permissions_disabled: riskyKeys },
  });
  return json(res, 200, { ok: true, disabled: riskyKeys });
}
