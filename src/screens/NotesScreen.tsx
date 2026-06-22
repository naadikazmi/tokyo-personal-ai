import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import { deleteLocalNote, getLocalNotes, saveLocalNote, toggleLocalNotePin } from '../lib/localDemo';
import { colors, spacing } from '../lib/theme';
import type { LocalNote } from '../types/app';

type Props = {
  userId: string;
};

const categories: LocalNote['category'][] = ['Study', 'Work', 'Personal', 'Ideas', 'Code', 'Other'];

export function NotesScreen({ userId }: Props) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<LocalNote['category']>('Study');
  const [pinned, setPinned] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void load();
  }, [userId]);

  const load = async () => {
    setNotes(await getLocalNotes(userId));
  };

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.content} ${note.category}`.toLowerCase().includes(query),
    );
  }, [notes, search]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('Study');
    setPinned(false);
  };

  const saveNote = async () => {
    if (!title.trim() || !content.trim()) {
      notifyUser('Note required', 'Add a title and note content.');
      return;
    }
    await saveLocalNote(
      userId,
      {
        title: title.trim(),
        content: content.trim(),
        source: 'manual',
        category,
        pinned,
      },
      editingId ?? undefined,
    );
    await logActivity(userId, editingId ? 'note_updated' : 'note_created', title.trim(), { category, pinned });
    resetForm();
    await load();
  };

  const editNote = (note: LocalNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setPinned(note.pinned);
  };

  const deleteNote = async (note: LocalNote) => {
    const confirmed = await confirmAction('Delete note?', `Remove "${note.title}" from local notes?`, 'Delete');
    if (!confirmed) return;
    await deleteLocalNote(userId, note.id);
    await logActivity(userId, 'note_deleted', note.title, { category: note.category });
    await load();
  };

  const togglePin = async (note: LocalNote) => {
    await toggleLocalNotePin(userId, note.id);
    await logActivity(userId, 'note_pin_changed', note.title, { pinned: !note.pinned });
    await load();
  };

  return (
    <Screen>
      <Text style={styles.heading}>Notes</Text>
      <Text style={styles.help}>Create, edit, pin, categorize, and search local notes. Chat-created notes appear here too.</Text>

      <View style={styles.form}>
        <TextInput
          placeholder="Search notes"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Note title"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          multiline
          placeholder="Write the note"
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          style={[styles.input, styles.textArea]}
        />
        <View style={styles.segmentRow}>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.segment, category === item && styles.activeSegment]}
            >
              <Text style={[styles.segmentText, category === item && styles.activeSegmentText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setPinned((value) => !value)} style={[styles.pinToggle, pinned && styles.pinToggleActive]}>
          <Text style={styles.pinText}>{pinned ? 'Pinned' : 'Pin important note'}</Text>
        </Pressable>
        <PrimaryButton title={editingId ? 'Update note' : 'Create note'} onPress={saveNote} />
        {editingId ? <PrimaryButton tone="neutral" title="Cancel edit" onPress={resetForm} /> : null}
      </View>

      <Text style={styles.sectionTitle}>Saved notes</Text>
      {filteredNotes.length === 0 ? <Text style={styles.empty}>No notes found.</Text> : null}
      {filteredNotes.map((note) => (
        <View key={note.id} style={[styles.card, note.pinned && styles.pinnedCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{note.pinned ? '[Pinned] ' : ''}{note.title}</Text>
              <Text style={styles.meta}>{note.category} | {note.source} | {new Date(note.updated_at).toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.cardText}>{note.content}</Text>
          <View style={styles.actions}>
            <PrimaryButton tone="neutral" title={note.pinned ? 'Unpin' : 'Pin'} onPress={() => togglePin(note)} />
            <PrimaryButton tone="neutral" title="Edit" onPress={() => editNote(note)} />
            <PrimaryButton tone="danger" title="Delete" onPress={() => deleteNote(note)} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  form: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeSegment: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeSegmentText: {
    color: colors.text,
  },
  pinToggle: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pinToggleActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  pinText: {
    color: colors.text,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.muted,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pinnedCard: {
    borderColor: colors.warning,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 12,
  },
  cardText: {
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
