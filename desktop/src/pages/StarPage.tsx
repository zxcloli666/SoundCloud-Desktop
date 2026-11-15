import { memo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createFlowStore, FlowContext } from '../components/subscription/star/flow/store';
import { StarShell } from '../components/subscription/star/StarShell';
import { usePremium } from '../lib/premium-cache';
import type { StarIntent } from '../lib/star-offer';

interface StarState {
  intent?: StarIntent;
  plan?: string;
  offer?: string;
}

export const StarPage = memo(function StarPage() {
  const location = useLocation();
  const state = location.state as StarState | null;
  return (
    <StarFlow
      key={location.key}
      intent={state?.intent ?? null}
      plan={state?.plan ?? null}
      offerId={state?.offer ?? null}
    />
  );
});

const StarFlow = memo(function StarFlow({
  intent,
  plan,
  offerId,
}: {
  intent: StarIntent | null;
  plan: string | null;
  offerId: string | null;
}) {
  const premium = usePremium();
  const [store] = useState(() => createFlowStore({ intent, plan, offerId, premium }));
  return (
    <FlowContext.Provider value={store}>
      <StarShell />
    </FlowContext.Provider>
  );
});

export default StarPage;
