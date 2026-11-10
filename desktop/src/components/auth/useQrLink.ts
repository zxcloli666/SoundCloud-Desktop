import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import { ApiError } from '../../lib/api';
import { useChecking } from '../../lib/chat/checking';
import { keychainReasonOf } from '../../lib/chat/errors';
import type { KeychainReason } from '../../lib/chat/gate';
import type { LinkMode } from '../../lib/chat/types';
import { createLinkRequest, getLinkStatus } from '../../lib/qr-link';

interface QrLinkState {
  status: 'idle' | 'creating' | 'keychain' | 'pending' | 'claimed' | 'failed' | 'expired';
  keychain?: KeychainReason;
  claimToken?: string;
  linkRequestId?: string;
  expiresAt?: Date;
  sessionId?: string;
  error?: string;
}

const POLL_INTERVAL_MS = 2000;

export function useQrLink(mode: LinkMode, onSuccess?: (sessionId: string) => void) {
  const [state, setState] = useState<QrLinkState>({ status: 'idle' });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowRef = useRef(0);
  const onSuccessRef = useRef(onSuccess);
  const { checking, cancelChecking } = useChecking();
  onSuccessRef.current = onSuccess;

  const stop = useCallback(() => {
    cancelChecking();
    flowRef.current++;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, [cancelChecking]);

  const reset = useCallback(() => {
    stop();
    setState({ status: 'idle' });
  }, [stop]);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (plain = false) => {
      stop();
      const flow = flowRef.current;
      const stale = () => flow !== flowRef.current;
      setState({ status: 'creating' });
      try {
        const created = await createLinkRequest(mode, plain);
        if (stale()) return;
        setState({
          status: 'pending',
          claimToken: created.claimToken,
          linkRequestId: created.linkRequestId,
          expiresAt: new Date(created.expiresAt),
        });

        const poll = async () => {
          const data = await getLinkStatus(created).catch(() => null);
          if (stale()) return;
          if (data?.status === 'claimed') {
            const sessionId = data.sessionId ?? undefined;
            if (mode === 'pull' && !sessionId) {
              setState((s) => ({ ...s, status: 'failed' }));
              return;
            }
            setState((s) => ({ ...s, status: 'claimed', sessionId }));
            if (mode === 'pull' && sessionId) onSuccessRef.current?.(sessionId);
            return;
          }
          if (data?.status === 'failed' || data?.status === 'expired') {
            const { status, error } = data;
            setState((s) => ({ ...s, status, error: error || 'QR link failed' }));
            return;
          }
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        };

        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err: unknown) {
        if (stale()) return;
        const refused = keychainReasonOf(err);
        if (refused) {
          setState({ status: 'keychain', keychain: refused });
          return;
        }
        const needsSession =
          mode === 'push' && err instanceof ApiError && [400, 401, 409].includes(err.status);
        setState({
          status: 'failed',
          error: needsSession ? i18n.t('qrLink.signInRequired') : undefined,
        });
      }
    },
    [mode, stop],
  );

  return { state, start, reset, checking };
}
