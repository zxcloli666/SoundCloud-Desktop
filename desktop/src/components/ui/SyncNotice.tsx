import { openUrl } from '@tauri-apps/plugin-opener';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { askRelogin } from '../../lib/auth-recovery';
import type { CollectionSyncInfo } from '../../lib/collection-sync';
import { helpUrl } from '../../lib/help-url';
import { ExternalLink, Loader2, Lock, RotateCcw } from '../../lib/icons';
import { SyncStarHint } from '../star-moments/SyncStarHint';
import { syncTimeText } from '../sync/useSyncCopy';

export type SyncNoticeKind = 'failed' | 'syncing' | 'stalled' | 'refused';

const DEFAULT_TEXT = {
  failed: 'common.loadFailed',
  syncing: 'common.syncing',
  stalled: 'common.syncQueue',
  refused: 'common.loadFailed',
} as const;

const REFUSED_TEXT: Record<string, string> = {
  auth_required: 'sync.refused.authRequired',
  not_found: 'sync.refused.notFound',
  forbidden: 'sync.refused.forbidden',
  unavailable: 'sync.refused.unavailable',
};

const WAIT_TICK_MS = 60_000;
const STAR_HINT_AFTER_SEC = 120;

const ACTION =
  'inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-white/75 transition-colors hover:border-white/[0.16] hover:bg-white/[0.09] hover:text-white/95';

export interface SyncedQuery {
  isError: boolean;
  syncState?: 'complete' | SyncNoticeKind;
  syncInfo?: CollectionSyncInfo;
}

export function syncNoticeOf(query: SyncedQuery): SyncNoticeKind | null {
  if (query.isError) return 'failed';
  const state = query.syncInfo?.state ?? query.syncState;
  if (!state || state === 'complete') return null;
  return state;
}

export const SyncNotice = React.memo(function SyncNotice({
  kind,
  text,
  info,
  ownedByMe = false,
  onRetry,
}: {
  kind: SyncNoticeKind;
  text?: string;
  info?: CollectionSyncInfo;
  ownedByMe?: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const queuedAt = info?.queuedSince ? Date.parse(info.queuedSince) : Number.NaN;
  const waiting = kind === 'syncing' && !Number.isNaN(queuedAt);
  const unavailable = kind === 'refused' && info?.errorCode === 'unavailable';
  const ticking = waiting || unavailable;

  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), WAIT_TICK_MS);
    return () => clearInterval(timer);
  }, [ticking]);

  if (kind === 'syncing') {
    const waitedSec = (now - queuedAt) / 1000;
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2 text-[13px] text-white/30">
          <Loader2 size={14} className="animate-spin" />
          {waiting
            ? t('common.syncWaiting', { time: syncTimeText(t, waitedSec) })
            : (text ?? t(DEFAULT_TEXT.syncing))}
        </div>
        {ownedByMe && waiting && waitedSec > STAR_HINT_AFTER_SEC && <SyncStarHint />}
      </div>
    );
  }

  if (kind === 'stalled') {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-[13px] text-white/30">
        {text ?? t(DEFAULT_TEXT.stalled)}
        {ownedByMe && <SyncStarHint />}
        <button
          type="button"
          onClick={() => void openUrl(helpUrl('fix/sync', i18n.language)).catch(() => undefined)}
          className={ACTION}
        >
          <ExternalLink size={12} />
          {t('sync.learnMore')}
        </button>
      </div>
    );
  }

  if (kind === 'refused') {
    const code = info?.errorCode ?? '';
    const signIn = code === 'auth_required' && ownedByMe;
    const codeText = code === 'auth_required' && !ownedByMe ? undefined : REFUSED_TEXT[code];
    const message = text ?? t(codeText ?? DEFAULT_TEXT.refused);
    const retryLeft = ((info?.retryAt ?? now) - now) / 1000;
    return (
      <div className="flex flex-col items-center gap-3 text-center text-[13px] text-white/30">
        {unavailable
          ? `${message} · ${t('sync.retryIn', { time: syncTimeText(t, retryLeft) })}`
          : message}
        {signIn && (
          <button type="button" onClick={() => askRelogin('reads')} className={ACTION}>
            <Lock size={12} />
            {t('sync.signIn')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-[13px] text-white/30">
      {text ?? t(DEFAULT_TEXT.failed)}
      <button type="button" onClick={onRetry} className={ACTION}>
        <RotateCcw size={12} />
        {t('common.retry')}
      </button>
    </div>
  );
});
