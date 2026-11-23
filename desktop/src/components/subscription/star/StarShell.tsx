import { memo } from 'react';
import { usePageGlow } from '../../../lib/page-glow';
import { usePremium } from '../../../lib/premium-cache';
import { ChooseView } from './choose/ChooseView';
import { useBuying } from './flow/derive';
import { useFlow } from './flow/store';
import { Header } from './Header';
import { ManageView } from './manage/ManageView';
import { PassSummary } from './manage/PassSummary';
import { PayStage } from './pay/PayStage';
import { Receipt } from './receipt/Receipt';
import { DeepStep } from './steps/DeepStep';
import { Success } from './steps/Success';
import { Panel } from './ui/Panel';

export const StarShell = memo(function StarShell() {
  usePageGlow([], 'page');
  return (
    <div data-ui="page" data-page="star" className="relative w-full">
      <div className="relative mx-auto w-full max-w-[1080px] px-4 pb-4 md:px-8">
        <Header />
        <div className="grid items-start gap-4 min-[1080px]:grid-cols-[minmax(0,1fr)_340px]">
          <Main />
          <div className="min-[1080px]:sticky min-[1080px]:top-4">
            <Aside />
          </div>
        </div>
      </div>
    </div>
  );
});

const Main = memo(function Main() {
  const view = useFlow((s) => (s.step === 'overview' || s.step === 'method' ? 'choose' : s.step));
  return (
    <div key={view} className="star-stagger flex min-w-0 flex-col gap-3">
      {view === 'choose' && <ChooseView />}
      {view === 'pay' && (
        <Panel data-ui="star-pay" className="py-8 sm:px-8">
          <PayStage />
        </Panel>
      )}
      {view === 'success' && <Success />}
      {view === 'manage' && <ManageView />}
      {view !== 'choose' && view !== 'pay' && view !== 'success' && view !== 'manage' && (
        <DeepStep step={view} />
      )}
    </div>
  );
});

const Aside = memo(function Aside() {
  const buying = useBuying();
  const premium = usePremium();
  return buying || !premium ? <Receipt /> : <PassSummary />;
});
