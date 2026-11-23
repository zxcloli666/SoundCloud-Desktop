import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../../../lib/icons';
import { obsOrigin } from '../../../../lib/obs/format';
import type { ObsStatus } from '../../../../stores/obs-status';

export function ServerBadge({ status, port }: { status: ObsStatus | null; port: number }) {
  const { t } = useTranslation();
  const current = status && status.port === port ? status.server : null;

  if (current === 'running') {
    return (
      <div className="flex items-center gap-2 text-[12px] font-medium text-ok">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:animate-none [[data-perf=light]_&]:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-ok" />
        </span>
        {t('settings.obsLive', { address: obsOrigin(port).replace('http://', '') })}
      </div>
    );
  }
  if (current === 'busy' || current === 'failed') {
    return (
      <div className="rounded-[8px] bg-bad/[0.1] px-2.5 py-1.5 text-[12px] text-bad">
        {t(current === 'busy' ? 'settings.obsBusy' : 'settings.obsFailed', { port })}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-40">
      <Loader2 size={12} className="animate-spin" />
      {t('settings.obsStarting')}
    </div>
  );
}
