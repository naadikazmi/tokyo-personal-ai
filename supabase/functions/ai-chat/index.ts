const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IncomingMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type IncomingMemory = {
  title: string;
  content: string;
  category?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini';

    if (!openAiKey) {
      return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const body = await request.json();
    const messages = sanitizeMessages(body.messages ?? []);
    const memories = sanitizeMemories(body.memories ?? []);
    const systemPrompt =
      typeof body.systemPrompt === 'string'
        ? body.systemPrompt.slice(0, 8000)
        : 'You are Tokyo, a female personal AI assistant. Be calm, concise, practical, privacy-aware, and safety-first. Do not claim to control devices, execute dangerous actions, or bypass permissions. Ask for clarification when needed.';

    const memoryText = memories.length
      ? memories.map((memory) => `- [${memory.category ?? 'Memory'}] ${memory.title}: ${memory.content}`).join('\n')
      : 'No saved memories yet.';

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'system',
            content: `Saved user memories:\n${memoryText}`,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({ error: errorText }, response.status);
    }

    const data = await response.json();
    const reply = extractText(data);
    return json({ reply });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function sanitizeMessages(messages: unknown): IncomingMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is IncomingMessage => {
      return (
        typeof message === 'object' &&
        message !== null &&
        ((message as IncomingMessage).role === 'user' || (message as IncomingMessage).role === 'assistant') &&
        typeof (message as IncomingMessage).content === 'string'
      );
    })
    .slice(-12);
}

function sanitizeMemories(memories: unknown): IncomingMemory[] {
  if (!Array.isArray(memories)) return [];
  return memories
    .filter((memory): memory is IncomingMemory => {
      return (
        typeof memory === 'object' &&
        memory !== null &&
        typeof (memory as IncomingMemory).title === 'string' &&
        typeof (memory as IncomingMemory).content === 'string'
      );
    })
    .slice(0, 20);
}

function extractText(data: any): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const firstText = data.output
    ?.flatMap((item: any) => item.content ?? [])
    ?.find((content: any) => content.type === 'output_text')?.text;

  return firstText ?? 'I could not produce a response this time.';
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
