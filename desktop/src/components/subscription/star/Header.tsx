import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Star } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { useFlowApi } from './flow/derive';
import { type FlowState, useFlow } from './flow/store';
import type { Step } from './meta';

const SIDE: Step[] = ['redeem', 'invite', 'gifts', 'plan'];

function backOf(s: FlowState, premium: boolean): Step | null {
  const linking = s.step === 'card' || s.step === 'sbp' ? s.linking : null;
  if (linking) return linking.trial ? 'trial' : 'manage';
  if (s.step === 'pay' || s.step === 'card' || s.step === 'sbp') return 'method';
  if (s.step === 'trial') return 'overview';
  if (SIDE.includes(s.step)) return premium ? 'manage' : 'overview';
  if ((s.step === 'overview' || s.step === 'method') && premium) return 'manage';
  return null;
}

export const Header = memo(function Header() {
  const { t } = useTranslation();
  const premium = usePremium();
  const back = useFlow((s) => backOf(s, premium));
  const api = useFlowApi();
  return (
    <header data-ui="star-header" className="flex h-16 items-center gap-2.5">
      {back ? (
        <button
          type="button"
          aria-label={t('starpass.back')}
          onClick={() => api.setStep(back)}
          className="star-in -ml-1.5 grid size-9 cursor-pointer place-items-center rounded-full text-ink-60 transition-colors hover:bg-ink/[0.07] hover:text-ink"
        >
          <ChevronLeft size={20} />
        </button>
      ) : (
        <Star size={20} fill="currentColor" className="text-accent" />
      )}
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink">STAR</h1>
    </header>
  );
});
