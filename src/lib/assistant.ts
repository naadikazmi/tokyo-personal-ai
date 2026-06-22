import { sendChatToApi } from './api';
import { classifySafetyIntent } from './safety';
import type { ChatMessage, Memory, PermissionSettings, UserSettings } from '../types/app';

export type AssistantReply = {
  reply: string;
  mode: 'api' | 'demo';
  reason?: string;
};

export function buildSystemPrompt(settings: UserSettings, memories: Memory[], permissions: PermissionSettings) {
  const assistantName = settings.assistant_name.trim() || 'Tokyo';
  const enabledMemories = permissions.memory_access ? memories : [];
  const memoryBlock = enabledMemories.map((memory) => `- ${memory.title}: ${memory.content}`).join('\n');

  return [
    `You are ${assistantName}, a browser-first personal AI assistant for the user.`,
    `Tone: ${settings.tone}. Personality notes: ${settings.assistant_style}`,
    'Be direct, useful, and honest about uncertainty.',
    'Never claim to control files, devices, browsers, messages, apps, settings, keyboard, mouse, or system commands unless a future permission-gated backend action exists and the user explicitly approves it.',
    'Sensitive actions require visible preview, explicit approval, activity logging, and emergency lock support.',
    enabledMemories.length > 0 ? `Relevant user memories:\n${memoryBlock}` : 'No user memories are available for this reply.',
  ].join('\n\n');
}

export async function sendAssistantMessage(
  messages: ChatMessage[],
  memories: Memory[],
  permissions: PermissionSettings,
  settings: UserSettings,
): Promise<AssistantReply> {
  const assistantName = settings.assistant_name.trim() || 'Tokyo';

  if (!permissions.chat_only) {
    throw new Error('Chat permission is turned off. Enable Chat only in Permissions.');
  }

  const visibleMemories = permissions.memory_access ? memories : [];
  try {
    const { reply, mode } = await sendChatToApi({
      userId: settings.user_id,
      messages,
      memories: visibleMemories,
      assistantName,
      personality: buildSystemPrompt(settings, visibleMemories, permissions),
    });

    return { reply, mode: mode === 'local' ? 'demo' : 'api' };
  } catch (error) {
    console.warn('Using demo assistant fallback because the API/OpenAI path is unavailable:', error);
    return {
      reply: buildDemoAssistantReply(messages, visibleMemories, settings),
      mode: 'demo',
      reason: error instanceof Error ? error.message : 'OpenAI/API is unavailable.',
    };
  }
}

function buildDemoAssistantReply(messages: ChatMessage[], memories: Memory[], settings: UserSettings) {
  const assistantName = settings.assistant_name.trim() || 'Tokyo';
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
  const lowerPrompt = lastUserMessage.toLowerCase();
  const safety = classifySafetyIntent(lastUserMessage);
  if (safety.blocked || safety.educationalReply) {
    return safety.educationalReply;
  }
  const memoryLine =
    memories.length > 0
      ? `I can also keep local context in mind, including: ${memories.slice(0, 2).map((memory) => memory.title).join(', ')}.`
      : 'Local memory is available when you add memories in this browser.';

  if (/\b(c\+\+|cpp|game|code|program|script|html|javascript|typescript|python|debug|error)\b/.test(lowerPrompt)) {
    if (/\bhello\s+world\b/.test(lowerPrompt)) {
      const lang = lowerPrompt.includes('python') ? 'python' : lowerPrompt.includes('javascript') ? 'javascript' : lowerPrompt.includes('typescript') ? 'typescript' : 'cpp';
      const snippets = {
        python: '```python\nprint("Hello, world!")\n```',
        javascript: '```js\nconsole.log("Hello, world!");\n```',
        typescript: '```ts\nconst message: string = "Hello, world!";\nconsole.log(message);\n```',
        cpp: '```cpp\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}\n```',
      };
      return [`I am ${assistantName} in local fallback mode. Here is a working Hello World example:`, snippets[lang], 'Use the Copy or Save to Notes buttons under this reply if you want to keep it.'].join('\n\n');
    }
    return [
      `I am ${assistantName} using the local fallback because the backend/OpenAI path is unreachable. Here is a simple C++ guessing game:`,
      '```cpp\n#include <iostream>\n#include <cstdlib>\n#include <ctime>\n\nint main() {\n    std::srand(static_cast<unsigned>(std::time(nullptr)));\n    int secret = 1 + std::rand() % 20;\n    int guess = 0;\n\n    std::cout << "Guess a number from 1 to 20.\\n";\n    while (guess != secret) {\n        std::cout << "Guess: ";\n        std::cin >> guess;\n        if (guess < secret) std::cout << "Too low.\\n";\n        else if (guess > secret) std::cout << "Too high.\\n";\n        else std::cout << "Correct!\\n";\n    }\n}\n```',
      'Compile with `g++ game.cpp -o game` and run it. Tell me the exact game idea if you want a larger version.',
    ].join('\n\n');
  }

  if (lowerPrompt.includes('plan') || lowerPrompt.includes('schedule') || lowerPrompt.includes('day')) {
    return [
      `I am ${assistantName} running in Demo AI mode, so I will keep this practical and local.`,
      'Daily plan template:',
      '1. Top priority: pick the one result that would make today successful.',
      '2. Deep work: block 60-90 minutes with phone/browser distractions closed.',
      '3. Study/practice: spend 45 minutes solving, then 10 minutes recalling from memory.',
      '4. Admin: handle two small tasks in one 25 minute batch.',
      '5. Review: write what is done, what is blocked, and the next action.',
      'Say `Add task study DLD at 8pm` or `Create a note: today plan ...` and I can save it locally.',
    ].join('\n\n');
  }

  if (/\b(oop|dld|exam|study|explain|quiz|flashcard|topic)\b/.test(lowerPrompt)) {
    return [
      `I am ${assistantName} in Demo AI mode. Study helper draft for: ${lastUserMessage}`,
      'Simple explanation: define the topic, say why it matters, then connect it to one small example.',
      'Key points: definition, purpose, components, example, common mistake.',
      'Exam answer: introduction -> definition -> explanation -> example -> conclusion.',
      'Flashcards:',
      'Q: What is the definition?',
      'A: Write the one-line meaning from your notes.',
      'Q: What mistake should I avoid?',
      'A: Do not memorize wording without knowing when to apply it.',
      'Quiz: explain it in 60 seconds, then solve one short question.',
      memoryLine,
    ].join('\n');
  }

  if (lowerPrompt.includes('research') || lowerPrompt.includes('compare') || lowerPrompt.includes('find')) {
    return [
      `I am ${assistantName} in Demo AI mode. I cannot fetch live sources until the API/research backend is connected, but I can still help structure the work.`,
      `Offline research outline for: ${lastUserMessage}`,
      'Summary: define the topic and the exact question being answered.',
      'What to verify later: dates, names, statistics, legal/medical/financial claims, and any current events.',
      'Comparison: list two or three viewpoints, benefits, risks, and uncertainty.',
      'Output: finish with a recommendation plus what evidence would change it.',
      'I will not invent live source links in local mode.',
    ].join('\n\n');
  }

  if (lowerPrompt.includes('remember') || lowerPrompt.includes('memory')) {
    return [
      `I am ${assistantName} in local mode. Supabase cloud memory is optional, so memories can still be managed in this browser.`,
      'Use the Memories tab to save the exact item, then I can refer to local memories during demo replies when memory access is enabled.',
      memoryLine,
    ].join('\n\n');
  }

  if (/\b(note|task|remind|planner|todo)\b/.test(lowerPrompt)) {
    return [
      `I am ${assistantName} in local mode. I can turn this into app data through chat commands:`,
      '- `Create a note: ...` saves a local note.',
      '- `Remember that ...` saves a local memory.',
      '- `Add task: ...` creates a planner item.',
      'These work without Supabase or OpenAI.',
    ].join('\n');
  }

  if (/\b(pdf|document|notes studio|flashcards|mcq)\b/.test(lowerPrompt)) {
    return [
      `I am ${assistantName} in local mode. For PDFs, open PDF Notes Studio.`,
      'What it can do locally: extract text from text-based PDFs, generate easy notes, summaries, definitions, flashcards, MCQs, revision checklists, and page-referenced Q&A.',
      'If a PDF is scanned/image-only, it will show a friendly OCR-not-available message instead of crashing.',
    ].join('\n\n');
  }

  if (/\b(clipboard|rewrite|grammar|translate|shorten|summarize this)\b/.test(lowerPrompt)) {
    return [
      `I am ${assistantName} in local mode. Use Clipboard Helper when you want controlled clipboard work.`,
      'It only reads clipboard text when you press Paste, then can summarize, rewrite professionally, shorten, make friendly, fix grammar, translate to Urdu/Roman Urdu, save to Notes, or send to Chat.',
    ].join('\n\n');
  }

  return [
    `I am ${assistantName}, currently answering with a professional Demo AI fallback because the OpenAI/API path is not connected.`,
    `Your message was: "${lastUserMessage || 'No message provided.'}"`,
    'I can still help draft, plan, organize, and reason locally. Connect the API/OpenAI server when you want live model-generated replies.',
    memoryLine,
  ].join('\n\n');
}
