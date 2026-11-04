import { useCallback, useRef, useState } from 'react';
import { getSessionId } from '../../../lib/api';
import { dropChatDevice, type ReloginReason, refreshChatStatus } from '../../../lib/chat/login';
import { describeError, logInfo } from '../../../lib/diagnostics';
import { queryClient } from '../../../lib/query-client';
import { type OAuthFlowOptions, useOAuthFlow } from '../../../lib/use-oauth-flow';
import { useAuthStore } from '../../../stores/auth';

const SEALED_RELOGIN: OAuthFlowOptions = { target: 'current', sealedOnly: true };

async function adoptSession(sessionId: string) {
  const switched = getSessionId() !== sessionId;
  const auth = useAuthStore.getState();
  await auth.setSession(sessionId);
  if (switched) {
    await auth.fetchUser().catch(() => {});
    queryClient.invalidateQueries();
  }
  await refreshChatStatus();
}

export function useRelogin(reason: ReloginReason, onDone?: () => void) {
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback((sessionId: string) => {
    adoptSession(sessionId).then(
      () => {
        setDone(true);
        onDoneRef.current?.();
      },
      (error) =>
        logInfo(`[Chat] sealed relogin could not keep the session: ${describeError(error)}`),
    );
  }, []);

  const flow = useOAuthFlow(finish, undefined, SEALED_RELOGIN);
  const { startLogin } = flow;

  const start = useCallback(async () => {
    setDone(false);
    if (reason === 'bound_other') await dropChatDevice();
    await startLogin();
  }, [reason, startLogin]);

  return { ...flow, start, done };
}
