import { useCallback, useEffect, useRef, useState } from 'react';
import { cardNative } from './card-link/native';
import type { RunnerBundle } from './pay-client';

export type ConfirmState = 'opening' | 'open' | 'closed' | 'failed';

export interface ConfirmAction {
  url: string;
  bundle: RunnerBundle;
}

export function useChargeConfirm(action: ConfirmAction | null) {
  const [state, setState] = useState<ConfirmState>('opening');
  const shown = useRef<string | null>(null);
  const latest = useRef(action);
  latest.current = action;

  const open = useCallback(async () => {
    const now = latest.current;
    if (!now) return;
    setState('opening');
    try {
      await cardNative.open(now.bundle, {});
      setState('open');
      const visit = await cardNative.page(now.url);
      if (visit.end !== 'aborted') setState(visit.end === 'refused' ? 'failed' : 'closed');
    } catch {
      setState('failed');
    }
  }, []);

  const url = action?.url ?? null;
  useEffect(() => {
    if (!url || shown.current === url) return;
    shown.current = url;
    void open();
  }, [url, open]);

  useEffect(
    () => () => {
      if (shown.current) void cardNative.close().catch(() => {});
    },
    [],
  );

  return { state, reopen: open };
}
