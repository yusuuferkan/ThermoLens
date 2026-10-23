import { useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH } from '@/theme';

export function useCanvasWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, MAX_CONTENT_WIDTH);
}
