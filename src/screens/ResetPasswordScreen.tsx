import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../lib/theme';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

type Props = {
  session: Session | null;
  onBackToLogin: () => void;
  onComplete: () => void;
};

export function ResetPasswordScreen({ session, onBackToLogin, onComplete }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    !isSupabaseConfigured ? 'Password reset requires Supabase email auth setup. Demo users do not need a password.' : null,
  );
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'info'>(isSupabaseConfigured ? 'idle' : 'info');

  const hasRecoverySession = Boolean(session?.user);

  const submit = async () => {
    setMessage(null);
    setStatus('idle');

    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) {
      setStatus('info');
      setMessage('Password reset requires Supabase email auth setup. Demo users do not need a password.');
      return;
    }

    if (!hasRecoverySession) {
      setStatus('error');
      setMessage('Reset link expired or invalid. Please request a new password reset email.');
      return;
    }

    if (!password) {
      setStatus('error');
      setMessage('Password is required.');
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords must match.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus('error');
        setMessage(error.message || 'Could not update password. Please request a new password reset email.');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');
      setMessage('Password updated. Continue to Tokyo Personal AI.');
    } catch {
      setStatus('error');
      setMessage('Could not update password. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Secure account recovery</Text>
            <Text style={styles.title}>Create new password</Text>
            <Text style={styles.subtitle}>Choose a strong password for your Tokyo Personal AI account.</Text>
          </View>
        </View>

        {!hasRecoverySession && isSupabaseConfigured ? (
          <View style={[styles.notice, styles.errorNotice]}>
            <Text style={[styles.noticeText, styles.errorText]}>
              Reset link expired or invalid. Please request a new password reset email.
            </Text>
          </View>
        ) : null}

        <TextInput
          editable={!loading && hasRecoverySession && isSupabaseConfigured}
          placeholder="New password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={[styles.input, (!hasRecoverySession || !isSupabaseConfigured) && styles.inputDisabled]}
        />
        <TextInput
          editable={!loading && hasRecoverySession && isSupabaseConfigured}
          placeholder="Confirm new password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={submit}
          style={[styles.input, (!hasRecoverySession || !isSupabaseConfigured) && styles.inputDisabled]}
        />

        {message ? (
          <View
            style={[
              styles.notice,
              status === 'success' && styles.successNotice,
              status === 'error' && styles.errorNotice,
              status === 'info' && styles.infoNotice,
            ]}
          >
            <Text
              style={[
                styles.noticeText,
                status === 'success' && styles.successText,
                status === 'error' && styles.errorText,
              ]}
            >
              {message}
            </Text>
          </View>
        ) : null}

        {status === 'success' ? (
          <PrimaryButton title="Continue to Tokyo" onPress={onComplete} />
        ) : (
          <PrimaryButton
            disabled={loading || !hasRecoverySession || !isSupabaseConfigured}
            title={loading ? 'Updating password...' : 'Update password'}
            onPress={submit}
          />
        )}

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={onBackToLogin}
          style={({ pressed }) => [styles.backButton, pressed && !loading && styles.pressed]}
        >
          <Text style={styles.backText}>Back to login</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputDisabled: {
    opacity: 0.62,
  },
  notice: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  infoNotice: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  successNotice: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  errorNotice: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  noticeText: {
    color: colors.muted,
    lineHeight: 20,
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.danger,
  },
  backButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  backText: {
    color: colors.text,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
