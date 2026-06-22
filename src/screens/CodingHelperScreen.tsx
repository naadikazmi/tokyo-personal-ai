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

type Language = 'C++' | 'JavaScript' | 'TypeScript' | 'Python';
type CodingMode = 'example' | 'explain' | 'debug' | 'plan' | 'exam';

const languages: Language[] = ['C++', 'JavaScript', 'TypeScript', 'Python'];
const modes: Array<{ key: CodingMode; label: string }> = [
  { key: 'example', label: 'Code example' },
  { key: 'explain', label: 'Explain code' },
  { key: 'debug', label: 'Debug error' },
  { key: 'plan', label: 'Project plan' },
  { key: 'exam', label: 'Exam answer' },
];

export function CodingHelperScreen({ userId }: Props) {
  const [language, setLanguage] = useState<Language>('C++');
  const [mode, setMode] = useState<CodingMode>('example');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [codingAllowed, setCodingAllowed] = useState(true);

  useEffect(() => {
    getEffectivePermissionSettings(userId)
      .then((settings) => setCodingAllowed(settings.coding_helper))
      .catch(() => setCodingAllowed(true));
  }, [userId]);

  const generate = async () => {
    if (!codingAllowed) {
      notifyUser('Coding Helper disabled', 'Enable Coding Helper in Permissions to generate code help.');
      return;
    }
    const cleanPrompt = prompt.trim() || 'simple game';
    const nextOutput = buildCodingOutput(language, mode, cleanPrompt);
    setOutput(nextOutput);
    await logActivity(userId, 'coding_helper_generated', cleanPrompt, { language, mode });
  };

  const saveSnippet = async () => {
    if (!codingAllowed) {
      notifyUser('Coding Helper disabled', 'Enable Coding Helper in Permissions to save generated code help.');
      return;
    }
    if (!output.trim()) {
      notifyUser('Nothing to save', 'Generate coding help first.');
      return;
    }
    await saveLocalNote(userId, {
      title: `${language} ${mode}: ${(prompt.trim() || 'snippet').slice(0, 60)}`,
      content: output,
      source: 'manual',
      category: 'Code',
      pinned: false,
    });
    await logActivity(userId, 'code_snippet_saved', prompt.trim() || language, { language, mode });
    notifyUser('Saved', 'Code help was saved to Notes.');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Coding Helper</Text>
      <Text style={styles.help}>Generate templates, explain code, triage pasted errors, and sketch small project plans locally.</Text>
      {!codingAllowed ? <Text style={styles.warning}>Coding Helper permission is off. Saved code notes stay available; generation is paused.</Text> : null}

      <View style={styles.form}>
        <View style={styles.segmentRow}>
          {languages.map((item) => (
            <Pressable
              key={item}
              onPress={() => setLanguage(item)}
              style={[styles.segment, language === item && styles.activeSegment]}
            >
              <Text style={[styles.segmentText, language === item && styles.activeSegmentText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segmentRow}>
          {modes.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setMode(item.key)}
              style={[styles.segment, mode === item.key && styles.activeSegment]}
            >
              <Text style={[styles.segmentText, mode === item.key && styles.activeSegmentText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          multiline
          placeholder="Describe what you need, paste code, or paste an error"
          placeholderTextColor={colors.muted}
          value={prompt}
          onChangeText={setPrompt}
          style={[styles.input, styles.textArea]}
        />
        <View style={styles.actions}>
          <PrimaryButton disabled={!codingAllowed} title="Generate" onPress={generate} />
          <PrimaryButton tone="neutral" title="Copy code" onPress={() => copyText(output)} />
          <PrimaryButton disabled={!codingAllowed} tone="neutral" title="Save to Notes" onPress={saveSnippet} />
        </View>
      </View>

      {output ? (
        <View style={styles.outputCard}>
          <Text style={styles.outputTitle}>{language} help</Text>
          <Text style={styles.output}>{output}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>Pick a language and mode, then generate a local coding draft.</Text>
      )}
    </Screen>
  );
}

function buildCodingOutput(language: Language, mode: CodingMode, prompt: string) {
  if (mode === 'explain') {
    return [
      `How to explain this ${language} code or idea:`,
      '1. Identify inputs, outputs, and data types.',
      '2. Read control flow: sequence, condition, loop, function call.',
      '3. Explain every variable in plain English.',
      '4. Identify where state changes.',
      '5. Mention edge cases and expected output.',
      `Your prompt: ${prompt}`,
    ].join('\n');
  }
  if (mode === 'debug') {
    return [
      `Debug checklist for ${language}:`,
      '- Copy the exact error line and file name.',
      '- Check missing semicolons/brackets/imports first.',
      '- Confirm variable names match exactly.',
      '- Print or log the value before the failing line.',
      '- Reduce the problem to the smallest reproducible snippet.',
      '- Check runtime input format and compiler/interpreter version.',
      `Pasted context: ${prompt}`,
    ].join('\n');
  }
  if (mode === 'plan') {
    return [
      `Small ${language} project plan: ${prompt}`,
      '1. Define the exact input and output.',
      '2. Build the smallest working version first.',
      '3. Add validation and edge cases.',
      '4. Split helper functions after it works.',
      '5. Save one example run as a test case.',
      '6. Add comments only where logic is not obvious.',
    ].join('\n');
  }
  if (mode === 'exam') {
    return [
      `Exam-style coding answer for ${language}: ${prompt}`,
      'Definition: state what the concept/program does.',
      'Algorithm: list clear numbered steps.',
      'Code: write the smallest correct implementation.',
      'Explanation: explain input, processing, output, and edge cases.',
      'Conclusion: mention time complexity or practical use when relevant.',
    ].join('\n');
  }
  if (language === 'C++') {
    return [
      'Simple C++ console game:',
      '```cpp',
      '#include <iostream>',
      '#include <cstdlib>',
      '#include <ctime>',
      '',
      'int main() {',
      '    std::srand(static_cast<unsigned>(std::time(nullptr)));',
      '    int secret = 1 + std::rand() % 10;',
      '    int guess = 0;',
      '',
      '    std::cout << "Guess a number from 1 to 10:\\n";',
      '    while (guess != secret) {',
      '        std::cin >> guess;',
      '        if (guess < secret) std::cout << "Too low\\n";',
      '        else if (guess > secret) std::cout << "Too high\\n";',
      '        else std::cout << "Correct!\\n";',
      '    }',
      '    return 0;',
      '}',
      '```',
      'Compile with `g++ game.cpp -o game`.',
    ].join('\n');
  }
  if (language === 'Python') {
    return [
      'Simple Python example:',
      '```python',
      'import random',
      '',
      'secret = random.randint(1, 10)',
      'guess = None',
      '',
      'while guess != secret:',
      '    guess = int(input("Guess 1-10: "))',
      '    if guess < secret:',
      '        print("Too low")',
      '    elif guess > secret:',
      '        print("Too high")',
      '    else:',
      '        print("Correct!")',
      '```',
    ].join('\n');
  }
  if (language === 'TypeScript') {
    return [
      'Simple TypeScript helper:',
      '```ts',
      'type Task = { title: string; done: boolean };',
      '',
      'function pendingTitles(tasks: Task[]) {',
      '  return tasks.filter((task) => !task.done).map((task) => task.title);',
      '}',
      '',
      'console.log(pendingTitles([{ title: "Study OOP", done: false }]));',
      '```',
    ].join('\n');
  }
  return [
    'Simple JavaScript helper:',
    '```js',
    'const tasks = ["study OOP", "practice DLD", "revise notes"];',
    'const plan = tasks.map((task, index) => `${index + 1}. ${task}`);',
    'console.log(plan.join("\\n"));',
    '```',
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
  textArea: {
    minHeight: 130,
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
    fontFamily: 'monospace',
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
