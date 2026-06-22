import type { PdfGeneratedNotes, PdfNotesSession, PdfPageText } from '../types/app';

export async function extractPdfFromFile(file: File): Promise<Pick<PdfNotesSession, 'file_name' | 'file_size' | 'page_count' | 'pages'>> {
  const arrayBuffer = await file.arrayBuffer();
  const pages = await extractPdfPages(arrayBuffer);
  return {
    file_name: file.name,
    file_size: file.size,
    page_count: pages.length,
    pages,
  };
}

export async function extractPdfPages(arrayBuffer: ArrayBuffer): Promise<PdfPageText[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true } as never);
  const pdf = await loadingTask.promise;
  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => (typeof (item as { str?: unknown }).str === 'string' ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: pageNumber, text });
  }
  if (!pages.some((page) => page.text.trim())) {
    throw new Error('This PDF may be scanned/image-based. OCR is not available yet.');
  }
  return pages;
}

export function generatePdfNotesLocal(pages: PdfPageText[]): PdfGeneratedNotes {
  const text = pages.map((page) => page.text).join('\n');
  const sections = buildSections(pages);
  const terms = extractTerms(text);
  const keySentences = extractImportantSentences(pages);

  return {
    easy_notes: keySentences.slice(0, 8).map((item) => `${item.text} (from page ${item.page})`),
    section_summaries: sections,
    definitions: terms.slice(0, 8).map((term) => ({
      term,
      definition: `Important term from the PDF. Review the nearby explanation and examples for "${term}".`,
      page: findPageForTerm(pages, term),
    })),
    key_points: keySentences.slice(0, 12),
    exam_answers: buildExamAnswers(sections, terms),
    short_qa: terms.slice(0, 8).map((term, index) => ({
      question: `What is ${term}?`,
      answer: `Explain ${term} using the PDF context and mention one example or use case.`,
      page: findPageForTerm(pages, term) || index + 1,
    })),
    mcqs: terms.slice(0, 6).map((term, index) => ({
      id: `${index}-mcq`,
      question: `Which term is important in this PDF section?`,
      options: shuffle([term, ...terms.filter((item) => item !== term).slice(0, 3)]),
      answer: term,
      page: findPageForTerm(pages, term),
    })),
    flashcards: terms.slice(0, 10).map((term, index) => ({
      id: `${index}-card`,
      question: `Define or explain: ${term}`,
      answer: `Use the PDF explanation around page ${findPageForTerm(pages, term) || '?'} and write a concise definition.`,
      page: findPageForTerm(pages, term),
    })),
    mind_map: sections.slice(0, 8).map((section) => `${section.title} -> ${section.summary}`),
    glossary: terms.slice(0, 12).map((term) => ({
      term,
      meaning: `Likely key concept. Search within the notes for "${term}" to review context.`,
      page: findPageForTerm(pages, term),
    })),
    revision_checklist: [
      'Read every highlighted definition once.',
      'Answer all short questions without looking.',
      'Practice MCQs and correct the weak areas.',
      'Write two long answers from memory.',
      'Review pages with the most important terms.',
    ],
    long_questions: sections.slice(0, 5).map((section) => `Explain "${section.title}" in detail with examples and exam points.`),
    short_questions: terms.slice(0, 10).map((term) => `Define ${term}.`),
  };
}

export function answerPdfQuestionLocal(pages: PdfPageText[], question: string) {
  const terms = tokenize(question);
  const matches = pages
    .map((page) => ({
      page: page.page,
      score: terms.reduce((sum, term) => sum + (page.text.toLowerCase().includes(term) ? 1 : 0), 0),
      text: page.text,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (matches.length === 0) {
    return 'I could not find a strong match in the extracted PDF text. Try a keyword from the document title, heading, or definition.';
  }

  return [
    `Local PDF answer for: ${question}`,
    ...matches.map((match) => `From page ${match.page}: ${clip(match.text, 420)}`),
  ].join('\n\n');
}

export function exportPdfNotesMarkdown(session: PdfNotesSession) {
  const notes = session.notes;
  if (!notes) return `# ${session.file_name}\n\nNo generated notes yet.`;
  return [
    `# ${session.file_name}`,
    '',
    '## Easy Notes',
    ...notes.easy_notes.map((item) => `- ${item}`),
    '',
    '## Section Summaries',
    ...notes.section_summaries.map((section) => `### ${section.title}\n${section.summary}\nPages: ${section.pages.join(', ')}`),
    '',
    '## Definitions',
    ...notes.definitions.map((item) => `- **${item.term}**: ${item.definition}${item.page ? ` (page ${item.page})` : ''}`),
    '',
    '## Flashcards',
    ...notes.flashcards.map((card) => `- Q: ${card.question}\n  A: ${card.answer}`),
    '',
    '## Quiz',
    ...notes.mcqs.map((mcq) => `- ${mcq.question}\n  Options: ${mcq.options.join(', ')}\n  Answer: ${mcq.answer}`),
  ].join('\n');
}

function buildSections(pages: PdfPageText[]) {
  return pages
    .filter((page) => page.text.trim())
    .slice(0, 12)
    .map((page) => {
      const sentences = splitSentences(page.text);
      const title = inferTitle(page.text, page.page);
      return {
        title,
        summary: clip(sentences.slice(0, 3).join(' '), 360),
        pages: [page.page],
      };
    });
}

function extractImportantSentences(pages: PdfPageText[]) {
  const important = /\b(define|definition|important|key|therefore|because|used|method|process|advantage|disadvantage|example|exam)\b/i;
  const items = pages.flatMap((page) =>
    splitSentences(page.text)
      .filter((sentence) => sentence.length > 45)
      .map((sentence) => ({ text: sentence, page: page.page })),
  );
  const sorted = items.sort((a, b) => Number(important.test(b.text)) - Number(important.test(a.text)));
  return sorted.slice(0, 18);
}

function extractTerms(text: string) {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were', 'have', 'has', 'will', 'can', 'into', 'which', 'their', 'there', 'these', 'those', 'using', 'between', 'chapter', 'page']);
  const counts = new Map<string, number>();
  const words = text.match(/\b[A-Za-z][A-Za-z0-9+-]{3,}\b/g) || [];
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (stop.has(normalized)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => titleCase(word))
    .filter((word, index, arr) => arr.findIndex((item) => item.toLowerCase() === word.toLowerCase()) === index)
    .slice(0, 24);
}

function buildExamAnswers(sections: Array<{ title: string; summary: string }>, terms: string[]) {
  return sections.slice(0, 4).map((section) =>
    [
      `Exam answer: ${section.title}`,
      `Introduction: ${section.title} is an important part of this PDF topic.`,
      `Explanation: ${section.summary}`,
      terms.length ? `Key terms to include: ${terms.slice(0, 4).join(', ')}.` : 'Add definitions and examples from the PDF.',
      'Conclusion: connect the concept to its purpose, example, and exam relevance.',
    ].join('\n'),
  );
}

function findPageForTerm(pages: PdfPageText[], term: string) {
  return pages.find((page) => page.text.toLowerCase().includes(term.toLowerCase()))?.page;
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function inferTitle(text: string, page: number) {
  const firstLine = text.split(/[.!?]/)[0]?.trim();
  return clip(firstLine && firstLine.length < 90 ? firstLine : `Page ${page} summary`, 80);
}

function tokenize(text: string) {
  return text.toLowerCase().match(/\b[a-z0-9+-]{3,}\b/g) || [];
}

function clip(text: string, limit = 160) {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function titleCase(text: string) {
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => 0.5 - Math.random());
}
