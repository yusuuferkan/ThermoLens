import { useSession } from '@/store/session';

/** Current colour range [lo, hi] in deg C. */
export function useRange(): [number, number] {
  const map = useSession((s) => s.map);
  const autoRange = useSession((s) => s.autoRange);
  const level = useSession((s) => s.level);
  const span = useSession((s) => s.span);
  if (!map) return [0, 1];
  if (autoRange) return [map.min, Math.max(map.max, map.min + 0.1)];
  return [level - span / 2, level + span / 2];
}
