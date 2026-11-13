import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyOs } from '../../lib/notify';
import { type StarStatus, URGENT_DAYS, useStarStatus } from '../../lib/star-status';
import { useStarMoments } from '../../stores/star-moments';

function reminderKey(status: StarStatus | null): string | null {
  if (!status || status.kind === 'open') return null;
  if (status.days < 1 || status.days > URGENT_DAYS) return null;
  const step = status.days <= 1 ? 1 : URGENT_DAYS;
  return `os:${status.kind}:${status.at}:${step}`;
}

export function useStarReminder() {
  const { t } = useTranslation();
  const status = useStarStatus();
  const key = reminderKey(status);
  const due = useStarMoments((s) => key !== null && !s.seen.includes(key));
  const mark = useStarMoments((s) => s.mark);

  useEffect(() => {
    if (!due || !key || !status || status.kind === 'open') return;
    mark(key);
    const body =
      status.kind === 'renews'
        ? t('starMoments.os.charge', { count: status.days, charge: status.charge })
        : t('starMoments.os.ends', { count: status.days });
    void notifyOs(t('star.title'), body);
  }, [due, key, status, mark, t]);
}
