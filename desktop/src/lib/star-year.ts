import { usePlans } from './binds';
import type { Plan } from './pay-client';

export const YEAR_PLAN_ID = 'm12';

export interface YearOffer {
  plan: Plan;
  savedRub: number;
}

export function useYearOffer(): YearOffer | null {
  const { data } = usePlans();
  const plan = data?.plans.find((p) => p.id === YEAR_PLAN_ID);
  const month = data?.plans.find((p) => p.months === 1);
  if (!plan || !month || plan.savings_pct <= 0) return null;
  return { plan, savedRub: Math.max(0, month.price.RUB * plan.months - plan.price.RUB) };
}
