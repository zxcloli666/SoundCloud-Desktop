import { type BoostyStep, PayError, payApi } from '../pay-client';
import { type CardPhase, cardNative } from './native';
import { type FailReason, stepEnd } from './reasons';

const POLL_MS = 2_500;
const LINK_WAIT_MS = 60_000;
const PAGE_WAIT_MS = 8 * 60_000;
const CLOSED_GRACE_MS = 8_000;
const ERRORS_IN_A_ROW = 5;

type PageState = 'none' | 'open' | 'closed' | 'failed';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function linkByToken(
  id: number,
  token: string,
  alive: () => boolean,
  phase: (phase: CardPhase | 'linking') => void,
): Promise<BoostyStep | FailReason> {
  let step: BoostyStep;
  try {
    step = await payApi.boostyToken(id, token);
  } catch {
    return 'network';
  }
  const page = { state: 'none' as PageState, closedAt: 0, passed: false };
  let polled = false;
  let until = Date.now() + LINK_WAIT_MS;
  let errors = 0;
  try {
    while (alive()) {
      const end = stepEnd(step);
      if (end === 'bound') return step;
      if (end) return end;
      if (step.url && page.state === 'none') {
        page.state = 'open';
        until = Date.now() + PAGE_WAIT_MS;
        phase('confirm');
        cardNative.page(step.url).then(
          (how) => {
            if (how !== 'closed') return;
            page.state = 'closed';
            page.closedAt = Date.now();
          },
          () => {
            page.state = 'failed';
          },
        );
      }
      if (page.state === 'failed') return 'page';
      if (!step.url && page.state === 'none' && polled) phase('checking');
      if (!step.url && page.state !== 'none' && !page.passed) {
        page.passed = true;
        until = Date.now() + LINK_WAIT_MS;
        phase('linking');
      }
      const abandoned = page.state === 'closed' && Date.now() - page.closedAt > CLOSED_GRACE_MS;
      if (step.url && abandoned) return 'closed';
      if (Date.now() > until) return 'timeout';
      await pause(POLL_MS);
      try {
        step = await payApi.boostyStep(id);
        polled = true;
        errors = 0;
      } catch (error) {
        if (error instanceof PayError && error.status === 409) return 'busy';
        errors += 1;
        if (errors >= ERRORS_IN_A_ROW) return 'network';
      }
    }
    return 'closed';
  } finally {
    if (page.state === 'open') void cardNative.abort().catch(() => {});
  }
}
