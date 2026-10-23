import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/data/db';
import type { Lang } from '@/i18n';
import type { TempUnit } from '@/core/units';

interface SettingsState {
  unit: TempUnit;
  language: Lang;
  haptics: boolean;
  setUnit: (u: TempUnit) => void;
  setLanguage: (l: Lang) => void;
  setHaptics: (h: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      unit: 'C',
      language: 'en',
      haptics: true,
      setUnit: (unit) => set({ unit }),
      setLanguage: (language) => set({ language }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    { name: 'thermolens.settings', storage: createJSONStorage(() => kvStorage) },
  ),
);
