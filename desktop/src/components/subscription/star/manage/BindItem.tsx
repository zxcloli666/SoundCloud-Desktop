import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BindView } from '../../../../lib/pay-client';
import { Btn } from '../ui/Btn';
import { MethodBadge } from '../ui/MethodBadge';
import { Row } from '../ui/Row';

export const BindItem = memo(function BindItem({
  bind,
  used,
  removing,
  onRemove,
  onLink,
}: {
  bind: BindView;
  used: boolean;
  removing: boolean;
  onRemove: () => void;
  onLink?: () => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const badge = <MethodBadge kind={bind.method} linked={bind.state !== 'none'} />;
  if (bind.state === 'none') {
    if (!bind.can_link || !onLink) return null;
    return (
      <Row ui="star-bind" icon={badge} title={t(`starpass.bind.${bind.method}.link`)}>
        <Btn size="sm" onClick={onLink}>
          {t('starpass.bind.link')}
        </Btn>
      </Row>
    );
  }
  const rebind = bind.state === 'rebind';
  return (
    <Row
      ui="star-bind"
      icon={badge}
      title={t(`starpass.bind.${bind.method}.linked`)}
      tone={rebind && !asking ? 'bad' : 'plain'}
      sub={t(
        asking && bind.flow === 'qr'
          ? 'starpass.bind.sbp.cancelInBank'
          : rebind
            ? 'starpass.bind.rebind'
            : used
              ? 'starpass.bind.linkedSub'
              : 'starpass.bind.linkedIdle',
      )}
    >
      {asking && !removing && (
        <Btn size="sm" tone="quiet" onClick={() => setAsking(false)}>
          {t('starpass.bind.keep')}
        </Btn>
      )}
      {rebind && bind.can_link && onLink && !asking && (
        <Btn size="sm" tone="primary" onClick={onLink}>
          {t('starpass.bind.relink')}
        </Btn>
      )}
      <Btn
        size="sm"
        tone={asking ? 'bad' : 'quiet'}
        disabled={removing}
        onClick={() => (asking ? onRemove() : setAsking(true))}
      >
        {asking ? t(`starpass.bind.${bind.method}.removeYes`) : t('starpass.bind.remove')}
      </Btn>
    </Row>
  );
});
