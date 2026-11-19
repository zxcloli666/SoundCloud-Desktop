import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { dropCommentFromCache } from '../lib/comments-cache';
import { guardLink, mobileWrite } from '../lib/mobile-actions';
import { queryClient } from '../lib/query-client';

const UNDO_MS = 5_000;

interface Hidden {
  urns: Record<string, true>;
}

export const useHiddenComments = create<Hidden>(() => ({ urns: {} }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

const toastId = (urn: string) => `comment-delete:${urn}`;

function setHidden(urn: string, hidden: boolean) {
  useHiddenComments.setState(({ urns }) => {
    const next = { ...urns };
    if (hidden) next[urn] = true;
    else delete next[urn];
    return { urns: next };
  });
}

export async function deleteComment(trackUrn: string, commentUrn: string) {
  if (timers.has(commentUrn)) return;
  if (!(await guardLink())) return;
  setHidden(commentUrn, true);
  toast(i18n.t('mobileActions.deleted'), {
    id: toastId(commentUrn),
    duration: UNDO_MS,
    action: { label: i18n.t('mobileActions.undo'), onClick: () => undoDelete(commentUrn) },
  });
  timers.set(
    commentUrn,
    setTimeout(() => void sendDelete(trackUrn, commentUrn), UNDO_MS),
  );
}

function undoDelete(commentUrn: string) {
  const timer = timers.get(commentUrn);
  if (!timer) return;
  clearTimeout(timer);
  timers.delete(commentUrn);
  setHidden(commentUrn, false);
}

async function sendDelete(trackUrn: string, commentUrn: string) {
  timers.delete(commentUrn);
  toast.dismiss(toastId(commentUrn));
  const done = await mobileWrite('DELETE', `/comments/${encodeURIComponent(commentUrn)}`);
  if (done) dropCommentFromCache(queryClient, trackUrn, commentUrn);
  setHidden(commentUrn, false);
}

export function cancelPendingDeletes() {
  for (const [commentUrn, timer] of timers) {
    clearTimeout(timer);
    toast.dismiss(toastId(commentUrn));
  }
  timers.clear();
  useHiddenComments.setState({ urns: {} });
}
