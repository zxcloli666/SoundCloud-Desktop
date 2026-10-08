import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from '../../../lib/icons';
import { loadLastReport, useNetCheckStore, watchNetCheck } from '../../../lib/net/check';
import { VerdictIcon, verdictTitle } from '../../net-check/VerdictIcon';
import { ActionButton } from '../ActionButton';
import { Card } from '../primitives';

export function NetCheckCard() {
  const { t, i18n } = useTranslation();
  const report = useNetCheckStore((s) => s.report);
  const running = useNetCheckStore((s) => s.running);
  const openCheck = useNetCheckStore((s) => s.openCheck);

  useEffect(() => {
    watchNetCheck();
    void loadLastReport();
  }, []);

  const settled = report !== null && report.verdict !== 'checking' ? report : null;
  const verdict = running ? 'checking' : settled?.verdict;
  const time =
    !running && settled
      ? new Date(settled.atMs).toLocaleTimeString(i18n.language, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return (
    <Card title={t('netCheck.title')} desc={t('netCheck.cardDesc')} icon={<Activity size={17} />}>
      <div className="flex items-center gap-3">
        {verdict && <VerdictIcon verdict={verdict} size={14} />}
        <span className="min-w-0 truncate text-[12.5px] text-white/70">
          {verdict ? verdictTitle(t, verdict) : t('netCheck.never')}
        </span>
        {time && (
          <span className="shrink-0 text-[11px] text-white/30">
            {t('netCheck.checkedAt', { time })}
          </span>
        )}
        <div className="ml-auto shrink-0">
          <ActionButton
            icon={<Activity size={12} />}
            label={t('netCheck.run')}
            onClick={openCheck}
          />
        </div>
      </div>
    </Card>
  );
}
