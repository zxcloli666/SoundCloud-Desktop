import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from '../../../../lib/icons';
import { useAuthStore } from '../../../../stores/auth';
import { StarBadge } from '../../../layout/StarBadge';
import { useChoosing } from '../flow/derive';
import { isGift, useFlow } from '../flow/store';
import { LegalNote } from '../LegalNote';
import { Actions } from './Actions';
import { ExtraLinks } from './ExtraLinks';
import { Lines } from './Lines';
import { OfferSlot } from './OfferSlot';
import { Total } from './Total';
import { TrialLines, TrialTotal } from './TrialSummary';

const NOTCH = 'absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-paper';

export const Receipt = memo(function Receipt() {
  const choosing = useChoosing();
  const trial = useFlow((s) => s.step === 'trial');
  return (
    <aside
      data-ui="star-receipt"
      className="relative rounded-[22px] border border-ink/[0.08] bg-surface"
      style={{ boxShadow: '0 30px 70px -40px rgb(var(--shade) / calc(1 * var(--shade-alpha)))' }}
    >
      <Head />
      <div className="flex flex-col gap-2.5 px-5 pb-4 pt-4">
        <OfferSlot />
        {trial ? <TrialLines /> : <Lines />}
      </div>
      <div className="relative border-t border-dashed border-ink/15">
        <span className={`${NOTCH} -left-2`} />
        <span className={`${NOTCH} -right-2`} />
      </div>
      <div className="px-5 pb-5 pt-4">
        {trial ? <TrialTotal /> : <Total />}
        <div className="mt-4 flex flex-col gap-2">
          <Actions />
        </div>
        {choosing && (
          <div className="mt-3">
            <ExtraLinks />
          </div>
        )}
        <LegalNote />
      </div>
    </aside>
  );
});

const Head = memo(function Head() {
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.user?.username);
  const gift = useFlow(isGift);
  return (
    <div className="flex items-center gap-3 px-5 pt-5">
      <StarBadge size="lg" />
      <span className="min-w-0 truncate text-[14px] font-bold text-ink-90">
        {username ? `@${username}` : t('starpass.guestHandle')}
      </span>
      {gift && <Gift size={15} className="ml-auto shrink-0 text-accent" />}
    </div>
  );
});
