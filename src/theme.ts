import { Platform } from 'react-native';

export const colors = {
  bg: '#0A0C0F',
  surface: '#13171C',
  surface2: '#1B2027',
  border: '#272E37',
  text: '#EAEEF3',
  muted: '#8995A4',
  accent: '#FF7A1A',
  accentSoft: 'rgba(255,122,26,0.14)',
  hot: '#FF3B6B',
  cold: '#4DA3FF',
  good: '#3DDC97',
};

export const radius = { sm: 8, md: 14, lg: 20 };

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' }) as string,
};

export const MAX_CONTENT_WIDTH = 560;
