import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, logInfo } from '../../lib/diagnostics';
import {
  type AuthCallback,
  beginLink,
  fetchLinkStatus,
  type LinkAccount,
  submitCallback,
} from '../../lib/mobile-link/api';
import { onAuthCallback, parseAuthAddress } from '../../lib/mobile-link/deep-link';
import {
  acceptsCallback,
  isFinal,
  LINK_TTL_MS,
  minutesLeft,
  type Phase,
  phaseOfStatus,
  pollDelay,
  reachedStep,
  wasSeen,
} from '../../lib/mobile-link/flow';

export interface MobileLinkView {
  phase: Phase;
  account: LinkAccount | null;
  step: number;
  minutes: number;
  browserFailed: boolean;
  pasteInvalid: boolean;
}

const IDLE: MobileLinkView = {
  phase: 'starting',
  account: null,
  step: 0,
  minutes: 0,
  browserFailed: false,
  pasteInvalid: false,
};

export function useMobileLink(active: boolean, onCompleted: () => void) {
  const [view, setView] = useState<MobileLinkView>(IDLE);
  const attemptRef = useRef(0);
  const linkRef = useRef<{ id: string; url: string; startedAt: number } | null>(null);
  const phaseRef = useRef<Phase>('starting');
  const seenRef = useRef(new Set<string>());
  const pollRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;

  const pausePolling = useCallback(() => {
    pollRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    attemptRef.current++;
    pausePolling();
    linkRef.current = null;
  }, [pausePolling]);

  const move = useCallback((phase: Phase) => {
    phaseRef.current = phase;
    setView((v) => ({ ...v, phase, step: reachedStep(v.step, phase) }));
    if (phase === 'completed') completedRef.current();
  }, []);

  const poll = useCallback(
    (attempt: number) => {
      const turn = ++pollRef.current;
      const live = () => attempt === attemptRef.current && turn === pollRef.current;
      const tick = async () => {
        const link = linkRef.current;
        if (!live() || !link) return;
        const now = Date.now();
        if (now - link.startedAt > LINK_TTL_MS) {
          move('expired');
          return;
        }
        setView((v) => ({ ...v, minutes: minutesLeft(link.startedAt, now) }));
        try {
          const status = await fetchLinkStatus(link.id);
          if (!live()) return;
          move(phaseOfStatus(phaseRef.current, status));
        } catch {}
        if (!live() || isFinal(phaseRef.current)) return;
        timerRef.current = setTimeout(tick, pollDelay(phaseRef.current));
      };
      timerRef.current = setTimeout(tick, pollDelay(phaseRef.current));
    },
    [move],
  );

  const start = useCallback(async () => {
    stop();
    const attempt = attemptRef.current;
    seenRef.current = new Set();
    phaseRef.current = 'starting';
    setView(IDLE);
    try {
      const link = await beginLink();
      if (attempt !== attemptRef.current) return;
      linkRef.current = { id: link.id, url: link.url, startedAt: Date.now() };
      phaseRef.current = 'waiting';
      setView((v) => ({
        ...v,
        phase: 'waiting',
        account: link.account,
        minutes: minutesLeft(Date.now(), Date.now()),
      }));
      openUrl(link.url).catch((e) => {
        logInfo(`[MobileLink] browser did not open: ${describeError(e)}`);
        if (attempt === attemptRef.current) setView((v) => ({ ...v, browserFailed: true }));
      });
      poll(attempt);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      logInfo(`[MobileLink] could not start: ${describeError(e)}`);
      move('failed');
    }
  }, [stop, poll, move]);

  const reopen = useCallback(() => {
    const link = linkRef.current;
    if (!link) return;
    openUrl(link.url).catch(() => setView((v) => ({ ...v, browserFailed: true })));
  }, []);

  const receive = useCallback(
    async (callback: AuthCallback) => {
      const link = linkRef.current;
      if (!link || !acceptsCallback(phaseRef.current)) return;
      if (wasSeen(seenRef.current, callback.state)) return;
      const attempt = attemptRef.current;
      move('received');
      pausePolling();
      try {
        await submitCallback(link.id, callback);
      } catch (e) {
        if (attempt !== attemptRef.current) return;
        logInfo(`[MobileLink] callback rejected: ${describeError(e)}`);
        move('failed');
        return;
      }
      if (attempt === attemptRef.current) poll(attempt);
    },
    [move, poll, pausePolling],
  );

  const paste = useCallback(
    async (text: string) => {
      const callback = await parseAuthAddress(text);
      setView((v) => ({ ...v, pasteInvalid: !callback }));
      if (callback) await receive(callback);
    },
    [receive],
  );

  const clearPasteError = useCallback(() => setView((v) => ({ ...v, pasteInvalid: false })), []);

  useEffect(() => {
    if (!active) return;
    void start();
    const off = onAuthCallback((callback) => void receive(callback));
    return () => {
      off();
      stop();
    };
  }, [active, start, receive, stop]);

  return { view, retry: start, reopen, paste, clearPasteError };
}
