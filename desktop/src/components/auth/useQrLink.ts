import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import { ApiError } from '../../lib/api';
import { createLinkRequest, getLinkStatus } from '../../lib/qr-link';

interface QrLinkState {
  status: 'idle' | 'creating' | 'pending' | 'claimed' | 'failed' | 'expired';
  claimToken?: string;
  linkRequestId?: string;
  expiresAt?: Date;
  /** sessionId, который пришёл с бэка (только для pull). */
  sessionId?: string;
  error?: string;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Хук для QR-link флоу.
 *
 * pull: текущее устройство НЕ залогинено, ждёт что другое отсканит и пушит сессию.
 *       После status=claimed — sessionId записан в state, его нужно сохранить как
 *       свою сессию. onSuccess сработает автоматически.
 * push: текущее устройство залогинено, генерирует QR для передачи сессии.
 *       После status=claimed — другое устройство залогинено, локально ничего не
 *       меняется.
 */
export function useQrLink(mode: 'pull' | 'push', onSuccess?: (sessionId: string) => void) {
  const [state, setState] = useState<QrLinkState>({ status: 'idle' });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setState({ status: 'idle' });
  }, [stop]);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    setState({ status: 'creating' });
    try {
      const created = await createLinkRequest(mode);
      setState({
        status: 'pending',
        claimToken: created.claimToken,
        linkRequestId: created.linkRequestId,
        expiresAt: new Date(created.expiresAt),
      });

      const poll = async () => {
        try {
          const data = await getLinkStatus(created.linkRequestId);
          if (data.status === 'claimed') {
            setState((s) => ({ ...s, status: 'claimed', sessionId: data.sessionId }));
            if (mode === 'pull' && data.sessionId) {
              onSuccessRef.current?.(data.sessionId);
            }
            return;
          }
          if (data.status === 'failed' || data.status === 'expired') {
            setState((s) => ({
              ...s,
              status: data.status,
              error: data.error || 'QR link failed',
            }));
            return;
          }
        } catch {
          // ignore transient errors
        }
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      };

      pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const needsSession =
        mode === 'push' && err instanceof ApiError && [400, 401, 409].includes(err.status);
      setState({
        status: 'failed',
        error: needsSession ? i18n.t('qrLink.signInRequired') : undefined,
      });
    }
  }, [mode, stop]);

  return { state, start, reset };
}
