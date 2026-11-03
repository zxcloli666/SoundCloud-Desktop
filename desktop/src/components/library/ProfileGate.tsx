import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { HardDrive, RotateCcw, WifiOff } from '../../lib/icons';
import { useAppMode } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { Skeleton } from '../ui/Skeleton';

const SLOW_PROFILE_MS = 4_000;

const ACTION =
  'inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/10 bg-ink/[0.05] px-4 py-2 text-[12.5px] font-semibold text-ink-75 transition-colors hover:border-ink/[0.16] hover:bg-ink/[0.09] hover:text-ink-95 disabled:cursor-default disabled:opacity-50';

export const ProfileGate = memo(function ProfileGate() {
  const { t } = useTranslation();
  const online = useAppMode() === 'online';
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_PROFILE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!online) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <WifiOff size={28} className="text-ink-25" />
        <p className="max-w-[340px] text-[13px] text-ink-45">{t('library.offlineGate')}</p>
        <NavLink to="/offline" className={ACTION}>
          <HardDrive size={13} />
          {t('library.openOffline')}
        </NavLink>
      </div>
    );
  }

  const retry = () => {
    setBusy(true);
    fetchUser()
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5 rounded-[2rem] border border-ink/[0.06] bg-ink/[0.02] p-6">
        <Skeleton rounded="full" className="h-20 w-20 shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton rounded="lg" className="h-8 w-2/3" />
        </div>
      </div>
      {slow && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-[13px] text-ink-45">{t('library.profileFailed')}</p>
          <button type="button" onClick={retry} disabled={busy} className={ACTION}>
            <RotateCcw size={13} className={busy ? 'animate-spin' : undefined} />
            {t('common.retry')}
          </button>
        </div>
      )}
    </div>
  );
});
