import { Alert } from 'react-native';

const browserMessage = (title: string, message?: string) => (message ? `${title}\n\n${message}` : title);

export function notifyUser(title: string, message?: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(browserMessage(title, message));
    return;
  }

  Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel = 'Confirm') {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(browserMessage(title, message)));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
