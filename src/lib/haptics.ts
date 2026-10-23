import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettings } from '@/store/settings';

const enabled = () => Platform.OS !== 'web' && useSettings.getState().haptics;

export const hapticSelect = () => {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
};
export const hapticTap = () => {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
export const hapticSuccess = () => {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
export const hapticWarn = () => {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};
