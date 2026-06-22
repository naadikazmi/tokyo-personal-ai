import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { getOAuthRedirectUrl, getPasswordResetRedirectUrl } from '../lib/auth';
import { colors, spacing } from '../lib/theme';
import { getSupabase, isSupabaseConfigured, missingSupabaseEnvVars } from '../lib/supabase';

type Props = {
  onDemoContinue?: () => void;
};

export function AuthScreen({ onDemoContinue }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error' | 'info'>('idle');

  const friendlyAuthError = (raw: string | undefined) => {
    if (!raw) return 'Login failed. Please check your details and try again.';
    if (/invalid login credentials/i.test(raw)) return `Wrong email or password. Supabase said: ${raw}`;
    if (/email not confirmed/i.test(raw)) return `Please confirm your email before logging in. Supabase said: ${raw}`;
    return raw;
  };

  const submit = async () => {
    setMessage(null);

    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Demo Mode: Supabase not connected. Continue as Demo User to use the app locally.');
      return;
    }

    if (!email.trim() || password.length < 6) {
      setMessage('Use a valid email and a password with at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      const result =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });

      if (result.error) {
        setMessage(friendlyAuthError(result.error.message));
        return;
      }

      if (mode === 'signup') {
        setMessage('Account created. If email confirmation is enabled, confirm your email before logging in.');
      }
    } catch {
      setMessage('Login failed. Check your internet connection and Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setMessage(null);

    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Google login requires Supabase Google OAuth setup.');
      return;
    }

    if (process.env.EXPO_PUBLIC_ENABLE_GOOGLE_OAUTH !== 'true') {
      setMessage('Google login requires Supabase Google OAuth setup.');
      return;
    }

    const redirectTo = getOAuthRedirectUrl();
    if (!redirectTo) {
      setMessage('Google login is configured for browser web first. Open the app in a browser and try again.');
      return;
    }

    try {
      setGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        setGoogleLoading(false);
        setMessage(error.message || 'Google login failed. Check your Supabase Google provider settings.');
      }
    } catch {
      setGoogleLoading(false);
      setMessage('Google login failed. Check your internet connection and Supabase Google provider settings.');
    }
  };

  const openPasswordReset = () => {
    setResetEmail(email.trim());
    setResetStatus(isSupabaseConfigured ? 'idle' : 'info');
    setResetMessage(
      isSupabaseConfigured
        ? null
        : 'Password reset requires Supabase email auth setup. Demo users do not need a password.',
    );
    setResetVisible(true);
  };

  const closePasswordReset = () => {
    if (resetLoading) return;
    setResetVisible(false);
    setResetMessage(null);
    setResetStatus('idle');
  };

  const sendPasswordReset = async () => {
    setResetMessage(null);
    setResetStatus('idle');

    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) {
      setResetStatus('info');
      setResetMessage('Password reset requires Supabase email auth setup. Demo users do not need a password.');
      return;
    }

    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setResetStatus('error');
      setResetMessage('Enter the email address for your Tokyo Personal AI account.');
      return;
    }

    const redirectTo = getPasswordResetRedirectUrl();
    if (!redirectTo) {
      setResetStatus('error');
      setResetMessage('Password reset is available in the browser app. Open Tokyo in a browser and try again.');
      return;
    }

    try {
      setResetLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
      if (error) {
        setResetStatus('error');
        setResetMessage(error.message || 'Could not send reset email. Check Supabase email auth settings.');
        return;
      }

      setResetStatus('success');
      setResetMessage('If an account exists for this email, a reset link has been sent.');
    } catch {
      setResetStatus('error');
      setResetMessage('Could not send reset email. Check your connection and Supabase email auth settings.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.eyebrow}>Browser-first assistant dashboard</Text>
            <Text style={styles.title}>Tokyo Personal AI</Text>
            <Text style={styles.subtitle}>
              Sign in to sync with Supabase. Tokyo is a female personal AI assistant for planning, memory, research,
              and daily focus.
            </Text>
          </View>
        </View>

        {!isSupabaseConfigured ? (
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo Mode: Supabase not connected</Text>
            <Text style={styles.demoText}>
              Missing setup: {missingSupabaseEnvVars.join(', ')}. Your demo memories, tasks, chat, permissions,
              research, settings, and logs will stay in local browser storage.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={googleLoading}
          onPress={continueWithGoogle}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && !googleLoading && styles.pressed,
            googleLoading && styles.disabled,
          ]}
        >
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleText}>{googleLoading ? 'Starting Google login...' : 'Continue with Google'}</Text>
        </Pressable>
        {!isSupabaseConfigured ? (
          <Text style={styles.helperText}>Connect Supabase to enable Google login.</Text>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <View style={styles.forgotRow}>
          <Pressable accessibilityRole="link" onPress={openPasswordReset} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        <PrimaryButton
          disabled={loading || googleLoading}
          title={loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          onPress={submit}
        />
        <PrimaryButton
          disabled={loading || googleLoading}
          tone="neutral"
          title={mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
          onPress={() => setMode((value) => (value === 'login' ? 'signup' : 'login'))}
        />
        <PrimaryButton
          disabled={loading || googleLoading}
          tone="neutral"
          title="Continue as Demo User"
          onPress={() => onDemoContinue?.()}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <Modal animationType="fade" transparent visible={resetVisible} onRequestClose={closePasswordReset}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Account recovery</Text>
                <Text style={styles.modalTitle}>Reset your password</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={resetLoading}
                onPress={closePasswordReset}
                style={({ pressed }) => [styles.closeButton, pressed && !resetLoading && styles.pressed]}
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.modalCopy}>
              Enter your account email and Tokyo will send a secure reset link when Supabase email auth is connected.
            </Text>

            <TextInput
              autoCapitalize="none"
              editable={!resetLoading && isSupabaseConfigured}
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              value={resetEmail}
              onChangeText={setResetEmail}
              onSubmitEditing={sendPasswordReset}
              style={[styles.input, !isSupabaseConfigured && styles.inputDisabled]}
            />

            {resetMessage ? (
              <View
                style={[
                  styles.resetNotice,
                  resetStatus === 'success' && styles.resetSuccess,
                  resetStatus === 'error' && styles.resetError,
                  resetStatus === 'info' && styles.resetInfo,
                ]}
              >
                <Text
                  style={[
                    styles.resetNoticeText,
                    resetStatus === 'success' && styles.resetSuccessText,
                    resetStatus === 'error' && styles.resetErrorText,
                  ]}
                >
                  {resetMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <PrimaryButton
                disabled={resetLoading || !isSupabaseConfigured}
                title={resetLoading ? 'Sending reset link...' : 'Send reset link'}
                onPress={sendPasswordReset}
              />
              {!isSupabaseConfigured ? (
                <PrimaryButton
                  tone="neutral"
                  title="Continue as Demo User"
                  onPress={() => {
                    closePasswordReset();
                    onDemoContinue?.();
                  }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
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
  brandCopy: {
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
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginBottom: spacing.sm,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  googleButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 24,
  },
  googleText: {
    color: '#172033',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  helperText: {
    color: colors.warning,
    lineHeight: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  forgotLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  demoBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.background,
  },
  demoTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  demoText: {
    color: colors.muted,
    lineHeight: 20,
  },
  message: {
    color: colors.warning,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(7, 10, 18, 0.78)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  closeButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  closeText: {
    color: colors.text,
    fontWeight: '800',
  },
  modalCopy: {
    color: colors.muted,
    lineHeight: 21,
  },
  modalActions: {
    gap: spacing.sm,
  },
  resetNotice: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  resetInfo: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  resetSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  resetError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  resetNoticeText: {
    color: colors.muted,
    lineHeight: 20,
  },
  resetSuccessText: {
    color: colors.success,
  },
  resetErrorText: {
    color: colors.danger,
  },
});
