import { router } from 'expo-router';

import { buildDemoFrame } from '@/core/demo';
import type { SceneId } from '@/core/scenes';
import type { ThermalFrame } from '@/core/types';
import { hapticSuccess } from '@/lib/haptics';
import { useSession } from '@/store/session';

export function openFrame(frame: ThermalFrame, demoId?: string) {
  useSession.getState().loadFrame(frame, { demoId });
  hapticSuccess();
  router.navigate('/viewer');
}

export function openDemo(id: SceneId) {
  openFrame(buildDemoFrame(id), id);
}
