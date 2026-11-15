import { type BindStep, PayError, payApi } from '../pay-client';
import { type CardPhase, cardNative } from './native';
import { type FailReason, stepEnd } from './reasons';

const POLL_MS = 2_500;
const LINK_WAIT_MS = 60_000;
const PAGE_WAIT_MS = 8 * 60_000;
const CLOSED_GRACE_MS = 15_000;
const ERRORS_IN_A_ROW = 5;

export type Phase = CardPhase | 'linking';

type PageState = 'none' | 'open' | 'done' | 'closed' | 'failed';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function follow(
  id: number,
  first: BindStep | null,
  pageUrl: string | null,
  alive: () => boolean,
  phase: (phase: Phase) => void,
): Promise<BindStep | FailReason> {
  const page = { state: 'none' as PageState, closedAt: 0 };
  let step = first;
  let until = Date.now() + LINK_WAIT_MS;
  let errors = 0;
  const show = (url: string) => {
    page.state = 'open';
    until = Date.now() + PAGE_WAIT_MS;
    phase('confirm');
    cardNative.page(url).then(
      (visit) => {
        if (visit.end === 'refused') {
          page.state = 'failed';
          return;
        }
        page.state = visit.end === 'result' ? 'done' : 'closed';
        page.closedAt = Date.now();
        until = Date.now() + LINK_WAIT_MS;
        phase('linking');
      },
      () => {
        page.state = 'failed';
      },
    );
  };
  try {
    if (pageUrl) show(pageUrl);
    while (alive()) {
      if (step) {
        const end = stepEnd(step);
        if (end === 'linked') return step;
        if (end) return end;
        if (step.page_url && page.state === 'none') show(step.page_url);
        if (page.state === 'none') phase('checking');
      }
      if (page.state === 'failed') return 'page';
      if (page.state === 'closed' && Date.now() - page.closedAt > CLOSED_GRACE_MS) return 'closed';
      if (Date.now() > until) return 'timeout';
      await pause(POLL_MS);
      try {
        step = await payApi.bindStep(id);
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
