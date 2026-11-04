import { toast } from 'sonner';
import i18n from '../../i18n';
import { useChatStore } from '../../stores/chat';
import { describeError, trackedInvoke as invoke, logInfo } from '../diagnostics';
import { chatBridge } from './bridge';
import { chatError } from './errors';
import type {
  ChatPhase,
  LinkClaimed,
  LinkCreated,
  LinkPoll,
  LoginBegin,
  LoginPoll,
  LoginTarget,
} from './types';

export type ReloginReason = 'unbound' | 'bound_other';

const BOUND_OTHER_TOAST = 'chat-bound-other';

export function busyRetrySec(error: unknown): number | null {
  const chat = chatError(error);
  if (chat?.code !== 'busy') return null;
  return Math.max(1, Math.ceil((chat.retryMs ?? 1_000) / 1_000));
}

export function reloginReason(phase: ChatPhase | null | undefined): ReloginReason | null {
  if (phase === 'unbound') return 'unbound';
  if (phase === 'bound_other') return 'bound_other';
  return null;
}

async function sealedOrPlain<T>(what: string, call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (error) {
    if (busyRetrySec(error) !== null) throw error;
    logInfo(
      `[Auth] sealed ${what} unavailable, plain flow: ${chatError(error)?.code ?? describeError(error)}`,
    );
    return null;
  }
}

async function quietly<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

export function sealedLoginBegin(target: LoginTarget): Promise<LoginBegin | null> {
  return sealedOrPlain('login', () => chatBridge.loginBegin(target));
}

export function sealedLoginPoll(loginRequestId: string): Promise<LoginPoll | null> {
  return quietly(() => chatBridge.loginPoll(loginRequestId));
}

export function sealedLinkCreatePull(): Promise<LinkCreated | null> {
  return sealedOrPlain('link', () => chatBridge.linkCreatePull());
}

export function sealedLinkCreatePush(): Promise<LinkCreated | null> {
  return sealedOrPlain('push link', () => invoke<LinkCreated>('chat_link_create_push'));
}

export function sealedLinkClaimPush(claimToken: string): Promise<LinkClaimed | null> {
  return sealedOrPlain('link claim', () => chatBridge.linkClaimPush(claimToken));
}

export function sealedLinkClaimPull(claimToken: string): Promise<LinkClaimed | null> {
  return sealedOrPlain('pull link claim', () => chatBridge.linkClaimPull(claimToken));
}

export function sealedLinkPoll(linkRequestId: string): Promise<LinkPoll | null> {
  return quietly(() => chatBridge.linkPoll(linkRequestId));
}

export async function dropChatDevice(): Promise<void> {
  try {
    await chatBridge.logout();
  } catch (error) {
    logInfo(`[Chat] local chat wipe failed: ${chatError(error)?.code ?? describeError(error)}`);
  }
}

export async function refreshChatStatus(): Promise<void> {
  const status = await quietly(() => chatBridge.status());
  if (status) useChatStore.getState().setStatus(status);
}

export function watchChatRelogin(): () => void {
  let wiped = false;
  const check = (phase: ChatPhase | null) => {
    if (phase === 'ready') wiped = false;
    if (phase !== 'bound_other' || wiped) return;
    wiped = true;
    toast.warning(i18n.t('chat.relogin.boundOtherTitle'), { id: BOUND_OTHER_TOAST });
    void dropChatDevice();
  };
  check(useChatStore.getState().status?.phase ?? null);
  return useChatStore.subscribe((state) => check(state.status?.phase ?? null));
}
