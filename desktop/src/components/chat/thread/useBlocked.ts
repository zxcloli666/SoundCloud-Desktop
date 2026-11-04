import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import type { UserId } from '../../../lib/chat/types';

const SETTINGS_KEY = ['chat', 'settings'];
const SETTINGS_STALE_MS = 60_000;
const NONE: ReadonlySet<UserId> = new Set();

export function useBlocked(enabled: boolean): ReadonlySet<UserId> {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => chatBridge.settingsGet(),
    staleTime: SETTINGS_STALE_MS,
    enabled,
  });
  const blocked = query.data?.blocked;
  return useMemo(
    () => (enabled && blocked ? new Set(blocked.map((user) => user.id)) : NONE),
    [enabled, blocked],
  );
}
