import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../../lib/constants';
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles } from '../../../lib/icons';
import { getUpdaterInfo, type UpdaterInfo } from '../../../lib/updater';
import { useAppUpdateStore } from '../../../stores/app-update';
import { Card } from '../primitives';

function stripLeadingV(version: string) {
  return version.replace(/^v/, '');
}

function UpdateStatusLine() {
  const { t, i18n } = useTranslation();
  const status = useAppUpdateStore((s) => s.status);
  const release = useAppUpdateStore((s) => s.release);
  const checkedAt = useAppUpdateStore((s) => s.checkedAt);
  const openModal = useAppUpdateStore((s) => s.openModal);

  const time = checkedAt
    ? new Date(checkedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : null;

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-ink-55">
        <Loader2 size={14} className="animate-spin text-accent" />
        {t('settings.checkingUpdates')}
      </div>
    );
  }

  if (status === 'available' && release) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 text-[12.5px] font-medium text-ink-80">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="truncate">
            {t('settings.updateReady', { version: stripLeadingV(release.tag_name) })}
          </span>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="shrink-0 px-4 py-2 rounded-xl text-[12px] font-semibold bg-accent hover:bg-accent-hover text-accent-contrast transition-colors cursor-pointer shadow-[0_0_18px_var(--color-accent-glow)]"
        >
          {t('settings.openUpdate')}
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-2 text-[12px] leading-snug text-ink-55">
        <AlertCircle size={14} className="mt-px shrink-0 text-amber-300/90" />
        {t('settings.updateCheckFailed')}
      </div>
    );
  }

  if (status === 'upToDate') {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-ink-65">
        <Check size={14} className="text-accent" />
        <span>{t('settings.upToDate')}</span>
        {time && <span className="text-ink-30">· {t('settings.checkedAt', { time })}</span>}
      </div>
    );
  }

  return null;
}

export function UpdatesCard() {
  const { t } = useTranslation();
  const status = useAppUpdateStore((s) => s.status);
  const check = useAppUpdateStore((s) => s.check);
  const [info, setInfo] = useState<UpdaterInfo | null>(null);
  const checking = status === 'checking';

  useEffect(() => {
    getUpdaterInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <Card
      title={t('settings.updates')}
      desc={t('settings.updatesDesc')}
      icon={<RefreshCw size={17} />}
    >
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-shade-20 border border-ink/[0.06] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-30">
            SoundCloud Desktop
          </p>
          <p className="mt-0.5 text-[20px] font-bold tracking-tight text-ink-90 tabular-nums">
            v{stripLeadingV(APP_VERSION)}
          </p>
        </div>
        {info && (
          <div className="flex flex-col items-end gap-1.5 min-w-0">
            <span className="rounded-full border border-ink/[0.08] bg-ink/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-ink-60">
              {t(`update.kind.${info.kind}`)}
            </span>
            <span
              className={`text-right text-[11px] leading-snug ${
                info.selfUpdate ? 'text-[var(--color-accent)]' : 'text-ink-35'
              }`}
            >
              {t(info.selfUpdate ? 'settings.oneClickUpdates' : 'settings.manualUpdates')}
            </span>
          </div>
        )}
      </div>
      <div className="mt-4 min-h-[20px] px-1">
        <UpdateStatusLine />
      </div>
      <div className="flex mt-4">
        <button
          type="button"
          onClick={() => void check(true)}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-ink/[0.06] text-ink-75 hover:bg-ink/[0.1] border border-ink/[0.06] hover:border-ink/[0.12] transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={checking ? 'animate-spin' : undefined} />
          {t('settings.checkUpdates')}
        </button>
      </div>
    </Card>
  );
}
