import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackedInvoke as invoke } from '../diagnostics';

const EVENT = 'chat:auth-checking';
const SHOW_AFTER_MS = 1_000;

export function useChecking() {
  const [checking, setChecking] = useState(false);
  const solving = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stopped = listen<boolean>(EVENT, (event) => {
      solving.current = event.payload;
      if (timer) clearTimeout(timer);
      timer = null;
      if (event.payload) timer = setTimeout(() => setChecking(true), SHOW_AFTER_MS);
      else setChecking(false);
    });
    return () => {
      if (timer) clearTimeout(timer);
      void stopped.then((stop) => stop());
    };
  }, []);

  const cancelChecking = useCallback(() => {
    if (!solving.current) return;
    solving.current = false;
    setChecking(false);
    invoke('chat_auth_cancel').catch(() => {});
  }, []);

  return { checking, cancelChecking };
}
