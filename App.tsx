import 'react-native-url-polyfill/auto';

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { DemoModeBanner } from './src/components/layout/DemoModeBanner';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { TabBar } from './src/components/TabBar';
import { TopBar } from './src/components/layout/TopBar';
import { LoadingState } from './src/components/ui/LoadingState';
import { syncUserProfile } from './src/lib/auth';
import { logActivity } from './src/lib/activity';
import { clearLocalAppSession, demoUser, getLocalAppSession, getLocalEmergencyLock, getLocalUserSettings, saveLocalAppSession } from './src/lib/localDemo';
import { confirmAction, notifyUser } from './src/lib/dialogs';
import { applyEmergencyLockPermissions } from './src/lib/permissions';
import { colors } from './src/lib/theme';
import { getSupabase, isSupabaseConfigured } from './src/lib/supabase';
import { AccessScreen } from './src/screens/AccessScreen';
import { ActivityLogsScreen } from './src/screens/ActivityLogsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AvatarModelSettingsScreen } from './src/screens/AvatarModelSettingsScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ClipboardScreen } from './src/screens/ClipboardScreen';
import { CodingHelperScreen } from './src/screens/CodingHelperScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MemoriesScreen } from './src/screens/MemoriesScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { PdfNotesScreen } from './src/screens/PdfNotesScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ResearchScreen } from './src/screens/ResearchScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StudyModeScreen } from './src/screens/StudyModeScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';
import type { AppTab, AvatarState } from './src/types/app';

const initialTab: AppTab = 'home';

const isResetPasswordPath = () => typeof window !== 'undefined' && window.location.pathname === '/reset-password';

const replaceBrowserPath = (path: string) => {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, '', `${window.location.origin}${path}`);
};

export default function App() {
  return (
    <ErrorBoundary>
      <TokyoApp />
    </ErrorBoundary>
  );
}

function TokyoApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [demoStarted, setDemoStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [emergencyLocked, setEmergencyLocked] = useState(false);
  const [assistantName, setAssistantName] = useState('Tokyo');
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [avatarAnimation, setAvatarAnimation] = useState(true);
  const [liveAvatarState, setLiveAvatarState] = useState<AvatarState>('idle');
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(isResetPasswordPath);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      getLocalAppSession()
        .then((demoSession) => {
          if (demoSession?.mode === 'demo') {
            setDemoStarted(true);
            setActiveTab(demoSession.activeTab);
          }
        })
        .finally(() => setLoadingSession(false));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          console.warn('Could not restore Supabase session:', error.message);
        }
        setSession(data.session);
        if (data.session?.user) {
          void syncUserProfile(data.session.user);
          setActiveTab(initialTab);
          return;
        }

        const demoSession = await getLocalAppSession();
        if (demoSession?.mode === 'demo') {
          setDemoStarted(true);
          setActiveTab(demoSession.activeTab);
        }
      })
      .finally(() => setLoadingSession(false));

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void syncUserProfile(nextSession.user);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryActive(true);
        setDemoStarted(false);
        return;
      }
      if (event === 'SIGNED_IN') {
        setDemoStarted(false);
        setActiveTab(initialTab);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user && !demoStarted) return;
    const activeUser = session?.user && !demoStarted ? session.user : demoUser;
    getLocalEmergencyLock(activeUser.id).then(setEmergencyLocked);
    getLocalUserSettings(activeUser.id).then((settings) => {
      setAssistantName(settings.assistant_name);
      setAvatarVisible(settings.avatar_visible ?? true);
      setAvatarAnimation(settings.avatar_animation ?? true);
    });
    logActivity(activeUser.id, 'app_opened');
  }, [demoStarted, session?.user?.id]);

  useEffect(() => {
    if (!demoStarted) return;
    void saveLocalAppSession({ mode: 'demo', activeTab });
  }, [activeTab, demoStarted]);

  if (loadingSession) {
    return (
      <View style={styles.centered}>
        <LoadingState label="Starting Tokyo..." />
      </View>
    );
  }

  if (passwordRecoveryActive) {
    return (
      <>
        <StatusBar style="dark" />
        <ResetPasswordScreen
          session={session}
          onBackToLogin={() => {
            replaceBrowserPath('/');
            setPasswordRecoveryActive(false);
          }}
          onComplete={() => {
            replaceBrowserPath('/');
            setPasswordRecoveryActive(false);
            setDemoStarted(false);
            setActiveTab(initialTab);
          }}
        />
      </>
    );
  }

  if (!session?.user && !demoStarted) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen
          onDemoContinue={async () => {
            setDemoStarted(true);
            setActiveTab(initialTab);
            await saveLocalAppSession({ mode: 'demo', activeTab: initialTab });
          }}
        />
      </>
    );
  }

  const usingSupabaseSession = Boolean(session?.user && !demoStarted);
  const activeUser = usingSupabaseSession && session?.user ? session.user : demoUser;
  const avatarState: AvatarState = emergencyLocked ? 'warning' : liveAvatarState;

  const signOut = async () => {
    if (!usingSupabaseSession) {
      setDemoStarted(false);
      setActiveTab(initialTab);
      await clearLocalAppSession();
      await logActivity(activeUser.id, 'demo_user_signed_out');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      notifyUser('Could not log out', error.message);
      return;
    }
    setActiveTab(initialTab);
  };

  const toggleEmergencyLock = async () => {
    if (emergencyLocked) {
      const confirmed = await confirmAction(
        'Unlock emergency lock?',
        'Sensitive permissions stay off until you turn them back on manually.',
        'Unlock',
      );
      if (confirmed) {
        setEmergencyLocked(false);
        await applyEmergencyLockPermissions(activeUser.id, false);
        await logActivity(activeUser.id, 'emergency_lock_disabled');
      }
      return;
    }

    const nextValue = !emergencyLocked;
    setEmergencyLocked(nextValue);
    await applyEmergencyLockPermissions(activeUser.id, nextValue);
    await logActivity(activeUser.id, nextValue ? 'emergency_lock_enabled' : 'emergency_lock_disabled');
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            avatarAnimation={avatarAnimation}
            avatarVisible={avatarVisible}
            emergencyLocked={emergencyLocked}
            liveAvatarState={avatarState}
            onNavigate={setActiveTab}
            userId={activeUser.id}
          />
        );
      case 'chat':
        return (
          <ChatScreen
            emergencyLocked={emergencyLocked}
            onAvatarStateChange={setLiveAvatarState}
            onNavigate={setActiveTab}
            userId={activeUser.id}
          />
        );
      case 'memories':
        return <MemoriesScreen userId={activeUser.id} />;
      case 'notes':
        return <NotesScreen userId={activeUser.id} />;
      case 'pdfNotes':
        return <PdfNotesScreen emergencyLocked={emergencyLocked} userId={activeUser.id} />;
      case 'permissions':
        return <AccessScreen emergencyLocked={emergencyLocked} userId={activeUser.id} />;
      case 'logs':
        return <ActivityLogsScreen userId={activeUser.id} />;
      case 'research':
        return <ResearchScreen emergencyLocked={emergencyLocked} userId={activeUser.id} />;
      case 'planner':
        return <PlannerScreen userId={activeUser.id} />;
      case 'study':
        return <StudyModeScreen userId={activeUser.id} />;
      case 'coding':
        return <CodingHelperScreen userId={activeUser.id} />;
      case 'workspace':
        return <WorkspaceScreen emergencyLocked={emergencyLocked} userId={activeUser.id} />;
      case 'clipboard':
        return <ClipboardScreen emergencyLocked={emergencyLocked} onNavigate={setActiveTab} userId={activeUser.id} />;
      case 'settings':
        return (
          <SettingsScreen
            emergencyLocked={emergencyLocked}
            onSettingsSaved={(settings) => {
              setAssistantName(settings.assistant_name);
              setAvatarVisible(settings.avatar_visible ?? true);
              setAvatarAnimation(settings.avatar_animation ?? true);
            }}
            onSignOut={signOut}
            userEmail={activeUser.email ?? 'Signed in'}
            userId={activeUser.id}
          />
        );
      case 'avatar':
        return (
          <AvatarModelSettingsScreen
            userId={activeUser.id}
            onAvatarChanged={(avatar) => setAssistantName(avatar.name)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <View style={styles.main}>
          <TopBar
            assistantName={assistantName}
            avatarState={avatarState}
            avatarAnimation={avatarAnimation}
            avatarVisible={avatarVisible}
            emergencyLocked={emergencyLocked}
            onToggleEmergencyLock={toggleEmergencyLock}
            onSignOut={signOut}
            signOutLabel={usingSupabaseSession ? 'Log out' : 'Exit demo'}
          />
          {!isSupabaseConfigured ? <DemoModeBanner /> : null}
          <View style={styles.content}>{renderScreen()}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 1480,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
});
