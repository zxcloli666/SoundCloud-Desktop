import { useQuery } from '@tanstack/react-query';
import { type Plan, payApi } from './pay-client';

export const YEAR_PLAN_ID = 'm12';

export interface YearOffer {
  plan: Plan;
  savedRub: number;
}

export function useYearOffer(): YearOffer | null {
  const { data } = useQuery({
    queryKey: ['pay', 'plans'],
    queryFn: payApi.plans,
    staleTime: 300_000,
  });
  const plan = data?.plans.find((p) => p.id === YEAR_PLAN_ID);
  if (!data || !plan || plan.savings_pct <= 0) return null;
  return { plan, savedRub: Math.max(0, data.monthly_rub * plan.months - plan.price_rub) };
}
