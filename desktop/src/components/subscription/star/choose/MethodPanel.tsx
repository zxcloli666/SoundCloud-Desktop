import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MethodId } from '../../../../lib/pay-client';
import { useFlowApi, useSel } from '../flow/derive';
import { optionsOf, pickedOf } from '../flow/select';
import { MethodChoice } from '../ui/MethodChoice';
import { Label, Panel } from '../ui/Panel';
import { RenewRow } from './RenewRow';

export const MethodPanel = memo(function MethodPanel() {
  const { t } = useTranslation();
  const ids = useSel((s, e) =>
    optionsOf(s, e)
      .map((m) => m.id)
      .join(' '),
  );
  const picked = useSel((s, e) => pickedOf(s, e)?.id ?? null);
  const api = useFlowApi();
  return (
    <Panel data-ui="star-method" pad={false} className="overflow-hidden">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <Label>{t('starpass.howToPay')}</Label>
      </div>
      <div className="grid gap-1.5 px-2.5 pb-2.5 sm:grid-cols-2">
        {ids
          .split(' ')
          .filter(Boolean)
          .map((id) => (
            <MethodChoice key={id} id={id as MethodId} on={picked === id} onPick={api.pickMethod} />
          ))}
      </div>
      {picked && (
        <div className="star-in border-t border-ink/[0.07]">
          <RenewRow />
        </div>
      )}
    </Panel>
  );
});
