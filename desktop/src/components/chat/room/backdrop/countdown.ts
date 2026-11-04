import { useServerNow } from '../useRoom';

export function useLeftMs(until: number | null | undefined): number {
  const active = !!until;
  const now = useServerNow(1000, active);
  return until ? Math.max(0, until - now) : 0;
}

export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
