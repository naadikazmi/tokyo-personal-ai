import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { extractLocalPdfFile, generatePdfNotesApi } from '../lib/api';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import { deleteLocalPdfSession, getLocalPdfSessions, saveLocalNote, saveLocalPdfSession } from '../lib/localDemo';
import {
  answerPdfQuestionLocal,
  exportPdfNotesMarkdown,
  extractPdfFromFile,
  generatePdfNotesLocal,
} from '../lib/pdfNotes';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { colors, spacing } from '../lib/theme';
import type { PdfNotesSession } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  userId: string;
};

export function PdfNotesScreen({ emergencyLocked, userId }: Props) {
  const [sessions, setSessions] = useState<PdfNotesSession[]>([]);
  const [active, setActive] = useState<PdfNotesSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfAllowed, setPdfAllowed] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    summaries: true,
    definitions: true,
    flashcards: true,
    quiz: true,
  });

  useEffect(() => {
    void load();
  }, [userId]);

  const load = async () => {
    const [permissions, nextSessions] = await Promise.all([
      getEffectivePermissionSettings(userId),
      getLocalPdfSessions(userId),
    ]);
    setPdfAllowed(permissions.pdf_processing);
    setSessions(nextSessions);
    setActive((current) => current ?? nextSessions[0] ?? null);
  };

  const importBrowserPdf = async () => {
    if (!pdfAllowed) {
      notifyUser('PDF processing disabled', 'Enable PDF processing in Permissions.');
      return;
    }
    if (typeof document === 'undefined') {
      notifyUser('Browser picker unavailable', 'Use Choose PDF in the desktop app or open Tokyo in a browser.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await importPdfFile(file);
    };
    input.click();
  };

  const importPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      notifyUser('PDF required', 'Choose a .pdf file.');
      return;
    }
    setLoading(true);
    setNotice('Extracting PDF text locally...');
    try {
      const extracted = await extractPdfFromFile(file);
      const session = await saveLocalPdfSession(userId, {
        id: `${Date.now()}-pdf`,
        ...extracted,
        created_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString(),
      });
      setActive(session);
      await logActivity(userId, 'pdf_uploaded', file.name, { pages: session.page_count, size: session.file_size });
      await load();
      setNotice('PDF text extracted locally. Generate notes when ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This PDF may be scanned/image-based. OCR is not available yet.');
    } finally {
      setLoading(false);
    }
  };

  const chooseDesktopPdf = async () => {
    if (!window.tokyoDesktop?.choosePdf) {
      notifyUser('Desktop picker unavailable', 'Use Upload PDF in browser mode, or open the Electron desktop app.');
      return;
    }
    const result = await window.tokyoDesktop.choosePdf();
    if (result.canceled || !result.path) return;
    setLoading(true);
    setNotice('Extracting local PDF through Tokyo API...');
    try {
      const extracted = await extractLocalPdfFile(result.path);
      const session = await saveLocalPdfSession(userId, {
        id: `${Date.now()}-pdf`,
        file_name: extracted.file_name,
        file_size: extracted.file_size,
        file_path: extracted.file_path,
        page_count: extracted.page_count,
        pages: extracted.pages,
        created_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString(),
      });
      setActive(session);
      await logActivity(userId, 'pdf_uploaded', extracted.file_name, { pages: session.page_count, desktop: true });
      await load();
      setNotice('PDF text extracted locally. Generate notes when ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This PDF may be scanned/image-based. OCR is not available yet.');
    } finally {
      setLoading(false);
    }
  };

  const generateNotes = async () => {
    if (!active) {
      notifyUser('PDF required', 'Upload or choose a PDF first.');
      return;
    }
    if (!pdfAllowed) {
      notifyUser('PDF processing disabled', 'Enable PDF processing in Permissions.');
      return;
    }
    setLoading(true);
    setNotice(emergencyLocked ? 'Emergency Lock is active. Generating PDF notes locally only.' : 'Generating PDF notes...');
    let notes = generatePdfNotesLocal(active.pages);
    let mode: 'openai' | 'local' = 'local';
    try {
      if (!emergencyLocked) {
        const response = await generatePdfNotesApi(active.file_name, active.pages);
        notes = response.notes;
        mode = response.mode;
      }
      const next = await saveLocalPdfSession(userId, { ...active, notes, last_opened_at: new Date().toISOString() });
      setActive(next);
      await load();
      await logActivity(userId, 'pdf_notes_generated', active.file_name, { pages: active.page_count, mode });
      setNotice(mode === 'openai' ? 'PDF notes generated with configured OpenAI backend.' : 'PDF notes, flashcards, quiz, glossary, and exam questions generated locally.');
    } catch {
      notes = generatePdfNotesLocal(active.pages);
      const next = await saveLocalPdfSession(userId, { ...active, notes, last_opened_at: new Date().toISOString() });
      setActive(next);
      await load();
      await logActivity(userId, 'pdf_notes_generated', active.file_name, { pages: active.page_count, mode: 'local-fallback' });
      setNotice('PDF notes generated locally because the AI backend was unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!active || !question.trim()) return;
    const localAnswer = answerPdfQuestionLocal(active.pages, question.trim());
    setAnswer(localAnswer);
    await logActivity(userId, 'pdf_qa_asked', question.trim(), { file: active.file_name });
  };

  const saveToNotes = async () => {
    if (!active?.notes) {
      notifyUser('Generate notes first', 'Create PDF notes before saving.');
      return;
    }
    await saveLocalNote(userId, {
      title: `PDF Notes: ${active.file_name}`,
      content: exportPdfNotesMarkdown(active),
      source: 'manual',
      category: 'Study',
      pinned: true,
    });
    await logActivity(userId, 'pdf_notes_saved_to_notes', active.file_name);
    notifyUser('Saved', 'PDF notes saved to Notes.');
  };

  const exportNotes = async () => {
    if (!active) return;
    const markdown = exportPdfNotesMarkdown(active);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
    }
    await logActivity(userId, 'pdf_notes_exported', active.file_name);
    notifyUser('Exported', 'Markdown notes copied to clipboard.');
  };

  const clearSession = async () => {
    if (!active) return;
    const confirmed = await confirmAction('Clear PDF session?', `Remove "${active.file_name}" from local PDF sessions?`, 'Clear');
    if (!confirmed) return;
    await deleteLocalPdfSession(userId, active.id);
    await logActivity(userId, 'pdf_session_cleared', active.file_name);
    setActive(null);
    await load();
  };

  const filteredText = useMemo(() => {
    if (!active || !search.trim()) return [];
    const query = search.trim().toLowerCase();
    return active.pages
      .filter((page) => page.text.toLowerCase().includes(query))
      .slice(0, 8);
  }, [active, search]);

  const notes = active?.notes;

  return (
    <Screen>
      <Text style={styles.heading}>PDF Notes Studio</Text>
      <Text style={styles.help}>
        PDFs are processed locally unless you connect AI/cloud features. If OpenAI is configured, extracted text may be sent to your configured local AI backend for better notes. Text PDFs work now; scanned/image PDFs need future OCR.
      </Text>
      {emergencyLocked ? <Text style={styles.warning}>Emergency Lock is active. Existing notes are readable; cloud/AI PDF processing is paused.</Text> : null}
      {!pdfAllowed ? <Text style={styles.warning}>PDF processing permission is off.</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton disabled={loading || !pdfAllowed} title="Upload PDF" onPress={importBrowserPdf} />
        <PrimaryButton disabled={loading || !pdfAllowed} tone="neutral" title="Choose PDF" onPress={chooseDesktopPdf} />
        <PrimaryButton disabled={loading || !active || !pdfAllowed} title="Generate notes" onPress={generateNotes} />
        <PrimaryButton disabled={!active?.notes} tone="neutral" title="Save to Notes" onPress={saveToNotes} />
        <PrimaryButton disabled={!active} tone="neutral" title="Export notes" onPress={exportNotes} />
        <PrimaryButton disabled={!active} tone="danger" title="Clear PDF session" onPress={clearSession} />
      </View>

      {active ? (
        <View style={styles.fileCard}>
          <Text style={styles.fileTitle}>{active.file_name}</Text>
          <Text style={styles.meta}>{active.page_count} pages | {Math.round(active.file_size / 1024)} KB</Text>
          {active.file_path ? <Text style={styles.meta}>{active.file_path}</Text> : null}
        </View>
      ) : <Text style={styles.empty}>No PDF loaded yet.</Text>}

      {active ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ask about this PDF</Text>
          <TextInput
            placeholder="Ask about this PDF..."
            placeholderTextColor={colors.muted}
            value={question}
            onChangeText={setQuestion}
            style={styles.input}
          />
          <PrimaryButton title="Ask PDF question" onPress={askQuestion} />
          {answer ? <Text style={styles.text}>{answer}</Text> : null}
        </View>
      ) : null}

      {active ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search extracted text</Text>
          <TextInput placeholder="Search within notes/PDF text" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} />
          {filteredText.map((page) => (
            <Text key={page.page} style={styles.text}>From page {page.page}: {page.text.slice(0, 260)}</Text>
          ))}
        </View>
      ) : null}

      {notes ? (
        <View style={styles.notesGrid}>
          <Section title="Easy notes" id="easy" expanded={expanded} setExpanded={setExpanded}>
            {notes.easy_notes.map((item) => <Text key={item} style={styles.bullet}>Important: {item}</Text>)}
          </Section>
          <Section title="Chapter summaries" id="summaries" expanded={expanded} setExpanded={setExpanded}>
            {notes.section_summaries.map((item) => <Text key={item.title} style={styles.bullet}>Exam point: {item.title} — {item.summary} From page {item.pages.join(', ')}</Text>)}
          </Section>
          <Section title="Definitions and glossary" id="definitions" expanded={expanded} setExpanded={setExpanded}>
            {[...notes.definitions, ...notes.glossary.map((item) => ({ term: item.term, definition: item.meaning, page: item.page }))].slice(0, 14).map((item) => (
              <Text key={`${item.term}-${item.page}`} style={styles.definition}>{item.term}: {item.definition} {item.page ? `(from page ${item.page})` : ''}</Text>
            ))}
          </Section>
          <Section title="Flashcards" id="flashcards" expanded={expanded} setExpanded={setExpanded}>
            {notes.flashcards.map((card) => <Text key={card.id} style={styles.flashcard}>Q: {card.question}\nA: {card.answer}</Text>)}
          </Section>
          <Section title="Quiz mode" id="quiz" expanded={expanded} setExpanded={setExpanded}>
            {notes.mcqs.map((mcq) => <Text key={mcq.id} style={styles.bullet}>{mcq.question}\nOptions: {mcq.options.join(', ')}\nAnswer: {mcq.answer}</Text>)}
          </Section>
          <Section title="Revision checklist and questions" id="revision" expanded={expanded} setExpanded={setExpanded}>
            {notes.revision_checklist.map((item) => <Text key={item} style={styles.bullet}>- {item}</Text>)}
            {notes.long_questions.map((item) => <Text key={item} style={styles.bullet}>Long: {item}</Text>)}
            {notes.short_questions.map((item) => <Text key={item} style={styles.bullet}>Short: {item}</Text>)}
          </Section>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Recent PDF notes</Text>
      {sessions.length === 0 ? <Text style={styles.empty}>No saved PDF sessions.</Text> : null}
      {sessions.map((session) => (
        <Pressable key={session.id} onPress={() => setActive(session)} style={styles.historyCard}>
          <Text style={styles.fileTitle}>{session.file_name}</Text>
          <Text style={styles.meta}>{session.page_count} pages | last opened {new Date(session.last_opened_at).toLocaleString()}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

function Section({
  title,
  id,
  expanded,
  setExpanded,
  children,
}: {
  title: string;
  id: string;
  expanded: Record<string, boolean>;
  setExpanded: (value: Record<string, boolean>) => void;
  children: ReactNode;
}) {
  const open = expanded[id] !== false;
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded({ ...expanded, [id]: !open })} style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.badge}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 22, fontWeight: '900' },
  help: { color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 20 },
  warning: { color: colors.warning, marginBottom: spacing.md, fontWeight: '900' },
  notice: { color: colors.primary, marginBottom: spacing.md, lineHeight: 20, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  fileCard: { padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.primaryDark, backgroundColor: colors.surface, marginBottom: spacing.md },
  fileTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  meta: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  card: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  badge: { color: colors.warning, fontWeight: '900' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, backgroundColor: colors.background, color: colors.text },
  text: { color: colors.text, lineHeight: 21, marginTop: spacing.sm },
  bullet: { color: colors.text, lineHeight: 21, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.background, marginTop: spacing.xs },
  definition: { color: colors.text, lineHeight: 21, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.background, marginTop: spacing.xs },
  flashcard: { color: colors.text, lineHeight: 21, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.primaryDark, backgroundColor: colors.background, marginTop: spacing.xs },
  notesGrid: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: spacing.lg, marginBottom: spacing.md },
  historyCard: { padding: spacing.md, marginBottom: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  empty: { color: colors.muted, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, marginBottom: spacing.md },
});
