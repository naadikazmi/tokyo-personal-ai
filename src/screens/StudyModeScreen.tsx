import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { notifyUser } from '../lib/dialogs';
import { saveLocalNote } from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { colors, spacing } from '../lib/theme';

type Props = {
  userId: string;
};

type StudyMode = 'explain' | 'notes' | 'exam' | 'quiz' | 'flashcards' | 'steps';

const modes: Array<{ key: StudyMode; label: string }> = [
  { key: 'explain', label: 'Explain' },
  { key: 'notes', label: 'Short notes' },
  { key: 'exam', label: 'Exam answer' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'steps', label: 'Step by step' },
];

export function StudyModeScreen({ userId }: Props) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<StudyMode>('explain');
  const [output, setOutput] = useState('');
  const [studyAllowed, setStudyAllowed] = useState(true);

  useEffect(() => {
    getEffectivePermissionSettings(userId)
      .then((settings) => setStudyAllowed(settings.study_mode))
      .catch(() => setStudyAllowed(true));
  }, [userId]);

  const generate = async () => {
    if (!studyAllowed) {
      notifyUser('Study Mode disabled', 'Enable Study Mode in Permissions to generate study help.');
      return;
    }
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      notifyUser('Topic required', 'Enter the topic you want Tokyo to help with.');
      return;
    }
    const nextOutput = buildStudyOutput(cleanTopic, mode);
    setOutput(nextOutput);
    await logActivity(userId, 'study_mode_generated', cleanTopic, { mode });
  };

  const saveAsNote = async () => {
    if (!studyAllowed) {
      notifyUser('Study Mode disabled', 'Enable Study Mode in Permissions to save generated study help.');
      return;
    }
    if (!output.trim()) {
      notifyUser('Nothing to save', 'Generate study content first.');
      return;
    }
    await saveLocalNote(userId, {
      title: `Study: ${topic.trim() || 'Untitled'}`.slice(0, 90),
      content: output,
      source: 'manual',
      category: 'Study',
      pinned: false,
    });
    await logActivity(userId, 'study_note_saved', topic.trim(), { mode });
    notifyUser('Saved', 'Study content was saved to Notes.');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Study Mode</Text>
      <Text style={styles.help}>Generate simple explanations, exam answers, quizzes, and flashcards locally.</Text>
      {!studyAllowed ? <Text style={styles.warning}>Study Mode permission is off. Existing notes stay available; generation is paused.</Text> : null}

      <View style={styles.form}>
        <TextInput
          placeholder="Topic, e.g. OOP inheritance, DLD counters, operating systems"
          placeholderTextColor={colors.muted}
          value={topic}
          onChangeText={setTopic}
          style={styles.input}
        />
        <View style={styles.modeRow}>
          {modes.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setMode(item.key)}
              style={[styles.modeButton, mode === item.key && styles.activeModeButton]}
            >
              <Text style={[styles.modeText, mode === item.key && styles.activeModeText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actions}>
          <PrimaryButton disabled={!studyAllowed} title="Generate" onPress={generate} />
          <PrimaryButton tone="neutral" title="Copy" onPress={() => copyText(output)} />
          <PrimaryButton disabled={!studyAllowed} tone="neutral" title="Save to Notes" onPress={saveAsNote} />
          <PrimaryButton disabled={!studyAllowed} tone="neutral" title="Create Flashcards" onPress={() => { setMode('flashcards'); if (topic.trim()) setOutput(buildStudyOutput(topic.trim(), 'flashcards')); }} />
          <PrimaryButton disabled={!studyAllowed} tone="neutral" title="Generate Quiz" onPress={() => { setMode('quiz'); if (topic.trim()) setOutput(buildStudyOutput(topic.trim(), 'quiz')); }} />
          <PrimaryButton disabled={!studyAllowed} tone="neutral" title="Explain Easier" onPress={() => { setMode('explain'); if (topic.trim()) setOutput(buildStudyOutput(topic.trim(), 'explain')); }} />
        </View>
      </View>

      {output ? (
        <View style={styles.outputCard}>
          <Text style={styles.outputTitle}>Generated study help</Text>
          <Text style={styles.output}>{output}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>Choose a mode and generate a local study draft.</Text>
      )}
    </Screen>
  );
}

function buildStudyOutput(topic: string, mode: StudyMode) {
  const programming = /\b(code|program|python|javascript|typescript|c\+\+|cpp|function|class|oop|algorithm)\b/i.test(topic);
  if (mode === 'explain') {
    return [
      `Simple explanation: ${topic}`,
      `Meaning: ${topic} is a concept to learn through definition, purpose, example, and exam use.`,
      'Key terms: definition, purpose, components, example, advantage, limitation.',
      'Real-world example: connect it to one practical case from class, coding, electronics, or daily work.',
      'Common mistake: memorizing wording without knowing when to apply it.',
      programming ? 'Code example:\n```cpp\n#include <iostream>\nint main() {\n    std::cout << "Hello, study topic!\\n";\n    return 0;\n}\n```' : '',
      'Step-by-step: read definition -> make example -> solve one question -> explain aloud -> write exam answer.',
    ].filter(Boolean).join('\n\n');
  }
  if (mode === 'notes') {
    return [
      `Short notes on ${topic}:`,
      '- Definition: write the exact meaning in one or two lines.',
      '- Purpose: why this topic matters and where it is used.',
      '- Key points: list 3-5 terms, rules, or steps.',
      '- Example: solve one small example from class.',
      '- Exam point: definition + key terms + example + conclusion.',
      '- Common mistake: confusing the definition with an example.',
    ].join('\n');
  }
  if (mode === 'exam') {
    return [
      `Exam-style answer: ${topic}`,
      `Introduction: ${topic} is important because it explains a core idea used in practical and exam problems.`,
      'Definition: write the exact meaning first.',
      'Explanation: break it into components, rules, or steps.',
      'Example: add one clean example, diagram, or code snippet if relevant.',
      'Advantages/limitations: mention one benefit and one common issue.',
      'Conclusion: summarize how it is used and why it matters.',
    ].join('\n\n');
  }
  if (mode === 'quiz') {
    return [
      `Quiz for ${topic}:`,
      '1. Define the topic in your own words.',
      '2. List three key terms connected to it.',
      '3. Give one practical example.',
      '4. What is one common mistake students make?',
      '5. Write a short exam answer in 6-8 lines.',
      '6. Give one real-world use.',
      '7. What keyword would appear in an MCQ about this topic?',
    ].join('\n');
  }
  if (mode === 'flashcards') {
    return [
      `Flashcards for ${topic}:`,
      'Q: What is the basic definition?',
      'A: Write the one-line definition from your lecture notes.',
      '',
      'Q: Why is it useful?',
      'A: It helps solve, organize, or explain a recurring problem.',
      '',
      'Q: What example should I remember?',
      'A: Use the smallest class/example problem your teacher gave.',
      '',
      'Q: What is the exam point?',
      'A: Definition + key terms + example + conclusion.',
    ].join('\n');
  }
  return [
    `Step-by-step study path for ${topic}:`,
    '1. Read the definition once.',
    '2. Rewrite it in your own words.',
    '3. Make a tiny example.',
    '4. Solve one practice question.',
    '5. Teach the concept out loud in 60 seconds.',
    '6. Save weak points as planner tasks.',
    '7. Convert the topic into 5 flashcards.',
    '8. Attempt one long question and two short questions.',
  ].join('\n');
}

async function copyText(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && text.trim()) {
    await navigator.clipboard.writeText(text);
  }
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
  warning: {
    color: colors.warning,
    marginBottom: spacing.md,
    fontWeight: '900',
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
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeModeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  modeText: {
    color: colors.muted,
    fontWeight: '800',
  },
  activeModeText: {
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  outputCard: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  outputTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  output: {
    color: colors.text,
    lineHeight: 22,
  },
  empty: {
    color: colors.muted,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
