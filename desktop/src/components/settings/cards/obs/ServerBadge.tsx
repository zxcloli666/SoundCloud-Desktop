import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../../../lib/icons';
import { obsOrigin } from '../../../../lib/obs/format';
import type { ObsStatus } from '../../../../stores/obs-status';

export function ServerBadge({ status, port }: { status: ObsStatus | null; port: number }) {
  const { t } = useTranslation();
  const current = status && status.port === port ? status.server : null;

  if (current === 'running') {
    return (
      <div className="flex items-center gap-2 text-[12px] font-medium text-[#3ddc84]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#23a55a] opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-[#23a55a]" />
        </span>
        {t('settings.obsLive', { address: obsOrigin(port).replace('http://', '') })}
      </div>
    );
  }
  if (current === 'busy' || current === 'failed') {
    return (
      <div className="rounded-lg border border-[#ff453a]/20 bg-[#ff453a]/[0.08] px-2.5 py-1.5 text-[12px] text-[#ff8a80]">
        {t(current === 'busy' ? 'settings.obsBusy' : 'settings.obsFailed', { port })}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-white/40">
      <Loader2 size={12} className="animate-spin" />
      {t('settings.obsStarting')}
    </div>
  );
}
