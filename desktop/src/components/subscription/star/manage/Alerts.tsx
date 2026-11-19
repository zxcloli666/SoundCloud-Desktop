import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { passDate } from '../../../../lib/star-format';
import { SOON_DAYS, useStarStatus } from '../../../../lib/star-status';
import { tileOf } from '../../methods';
import { useFlowApi } from '../flow/derive';
import { useFlow } from '../flow/store';
import { Btn } from '../ui/Btn';
import { Alert } from './Alert';

export const Alerts = memo(function Alerts() {
  const { t } = useTranslation();
  const status = useStarStatus();
  const paying = useFlow((s) => s.paying);
  const api = useFlowApi();
  if (status?.kind === 'confirm') {
    return (
      <Alert
        data-ui="star-confirm-renewal"
        tone="warn"
        title={t('starpass.confirm.renewal')}
        sub={`${t(`starpass.method.${tileOf(status.method).i18n}.title`)} · ${status.charge} · ${passDate(status.at)}`}
      >
        <Btn
          tone="primary"
          size="sm"
          disabled={paying}
          onClick={() => void api.confirmRenewal(status.renewal)}
        >
          {t('starpass.confirm.cta')}
        </Btn>
      </Alert>
    );
  }
  if (status?.kind === 'ends' && status.level !== 'calm' && status.canExtend) {
    return (
      <Alert
        data-ui="star-expiring"
        tone={status.level === 'urgent' ? 'bad' : 'warn'}
        title={t('starMoments.expiry.left', { count: status.days })}
        bar={status.days / SOON_DAYS}
      >
        <Btn tone="primary" size="sm" onClick={api.extend}>
          {t(status.trial ? 'starMoments.getStar' : 'starpass.manage.extend')}
        </Btn>
      </Alert>
    );
  }
  return null;
});
