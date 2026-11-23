import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from '../../../lib/icons';
import { loadLastReport, useNetCheckStore, watchNetCheck } from '../../../lib/net/check';
import { checkedTime } from '../../../lib/net/manual';
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
  const time = !running && settled ? checkedTime(settled.atMs, i18n.language) : null;

  return (
    <Card
      title={t('netCheck.title')}
      desc={t('netCheck.cardDesc')}
      icon={<Activity size={17} />}
      action={
        <ActionButton icon={<Activity size={13} />} label={t('netCheck.run')} onClick={openCheck} />
      }
    >
      <div className="set-row flex min-h-[48px] items-center gap-2.5 py-3">
        {verdict && <VerdictIcon verdict={verdict} size={14} />}
        <span className="min-w-0 truncate text-[13px] text-ink-80">
          {verdict ? verdictTitle(t, verdict) : t('netCheck.never')}
        </span>
        {time && (
          <span className="ml-auto shrink-0 text-[12px] text-ink-40">
            {t('netCheck.checkedAt', { time })}
          </span>
        )}
      </div>
    </Card>
  );
}
