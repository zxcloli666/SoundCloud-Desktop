import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import i18n from '../i18n';
import { logInfo } from '../lib/diagnostics';
import {
  beginLink,
  describeSubmitError,
  fetchLinkStatus,
  MOBILE_ACCESS_KEY,
  submitCallback,
} from '../lib/mobile-link/api';
import { createMobileLink, type MobileLinkState } from '../lib/mobile-link/controller';
import {
  onAuthCallback,
  parseAuthAddress,
  takePendingCallback,
} from '../lib/mobile-link/deep-link';
import type { Phase } from '../lib/mobile-link/flow';
import { clearFlow, loadFlow, saveFlow } from '../lib/mobile-link/storage';
import { queryClient } from '../lib/query-client';

const TOAST_ID = 'mobile-link';

function announce(phase: Phase, dialogOpen: boolean) {
  if (phase === 'completed') void queryClient.invalidateQueries({ queryKey: MOBILE_ACCESS_KEY });
  if (dialogOpen) return;
  const label = i18n.t(`mobileLink.phase.${phase}`);
  if (phase === 'completed') {
    toast.success(label, { id: TOAST_ID });
    return;
  }
  toast.error(label, {
    id: TOAST_ID,
    action: { label: i18n.t('mobileLink.retry'), onClick: () => mobileLink.openDialog() },
  });
}

export const mobileLink = createMobileLink({
  begin: beginLink,
  submit: submitCallback,
  status: fetchLinkStatus,
  describe: describeSubmitError,
  open: openUrl,
  parse: parseAuthAddress,
  takePending: takePendingCallback,
  listen: onAuthCallback,
  load: loadFlow,
  save: saveFlow,
  clear: clearFlow,
  now: Date.now,
  after: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
  finished: announce,
  log: logInfo,
});

export function useMobileLinkState(): MobileLinkState {
  return useStore(mobileLink.store);
}
