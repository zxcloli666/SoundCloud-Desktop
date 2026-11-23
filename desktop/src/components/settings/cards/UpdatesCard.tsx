import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../../lib/constants';
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles } from '../../../lib/icons';
import { getUpdaterInfo, type UpdaterInfo } from '../../../lib/updater';
import { useAppUpdateStore } from '../../../stores/app-update';
import { Block, Card } from '../primitives';

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
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 text-[12.5px] font-medium text-ink-80">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="truncate">
            {t('settings.updateReady', { version: stripLeadingV(release.tag_name) })}
          </span>
        </div>
        <button type="button" onClick={openModal} className="set-btn" data-tone="accent">
          {t('settings.openUpdate')}
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-2 text-[12px] leading-snug text-ink-55">
        <AlertCircle size={14} className="mt-px shrink-0 text-amber-400" />
        {t('settings.updateCheckFailed')}
      </div>
    );
  }

  if (status === 'upToDate') {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-ink-65">
        <Check size={14} className="text-accent" />
        <span>{t('settings.upToDate')}</span>
        {time && <span className="text-ink-40">· {t('settings.checkedAt', { time })}</span>}
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
      action={
        <button
          type="button"
          onClick={() => void check(true)}
          disabled={checking}
          className="set-btn"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : undefined} />
          {t('settings.checkUpdates')}
        </button>
      }
    >
      <Block className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[12px] text-ink-45">SoundCloud Desktop</p>
          <p className="text-[22px] font-semibold tracking-tight text-ink-90 tabular-nums">
            v{stripLeadingV(APP_VERSION)}
          </p>
        </div>
        {info && (
          <div className="flex min-w-0 flex-col items-end gap-1">
            <span className="set-chip">{t(`update.kind.${info.kind}`)}</span>
            <span className="text-right text-[12px] leading-snug text-ink-50">
              {t(info.selfUpdate ? 'settings.oneClickUpdates' : 'settings.manualUpdates')}
            </span>
          </div>
        )}
      </Block>
      <div className="set-row flex min-h-[48px] items-center py-2.5 empty:hidden">
        <UpdateStatusLine />
      </div>
    </Card>
  );
}
