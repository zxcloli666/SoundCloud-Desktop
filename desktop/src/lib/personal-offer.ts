import { useQuery } from '@tanstack/react-query';
import { useEffect, useReducer } from 'react';
import { useAuthStore } from '../stores/auth';
import { useOfferPeak } from '../stores/offer-peak';
import { PayError, type PayOffer, PayShapeError, payApi } from './pay-client';
import { usePremium } from './premium-cache';
import { queryClient } from './query-client';
import { deviceId } from './star-offer';

export const OFFER_KEY = ['pay', 'offer'] as const;

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

async function fetchOffer(): Promise<PayOffer | null> {
  try {
    return (await payApi.offer(await deviceId())).offer;
  } catch (e) {
    if (e instanceof PayShapeError || (e instanceof PayError && e.status === 404)) return null;
    throw e;
  }
}

const expired = (offer: PayOffer) => offer.ends_at !== null && offer.ends_at * 1000 <= Date.now();

export function usePersonalOffer(): PayOffer | null {
  const hasSession = useAuthStore((s) => s.hasSession);
  const premium = usePremium();
  const live = hasSession && !premium;
  const { data } = useQuery({
    queryKey: OFFER_KEY,
    queryFn: fetchOffer,
    enabled: live,
    staleTime: 5 * 60_000,
    refetchInterval: 30 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const offer = live ? (data ?? null) : null;
  const endsAt = offer?.ends_at ?? null;
  const [, wake] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!hasSession) queryClient.removeQueries({ queryKey: OFFER_KEY });
  }, [hasSession]);

  useEffect(() => {
    if (endsAt === null) return;
    const left = endsAt * 1000 - Date.now();
    if (left <= 0) return;
    const id = window.setTimeout(
      () => {
        wake();
        void queryClient.invalidateQueries({ queryKey: OFFER_KEY });
      },
      Math.min(left, MAX_TIMEOUT_MS),
    );
    return () => window.clearTimeout(id);
  }, [endsAt]);

  return offer && !expired(offer) ? offer : null;
}

const started = new Set<string>();

export function useOfferShown(offer: PayOffer | null) {
  const id = offer && offer.ends_at === null ? offer.id : null;
  useEffect(() => {
    if (!id || started.has(id)) return;
    started.add(id);
    void (async () => {
      try {
        const next = await payApi.offerShown(id, await deviceId());
        queryClient.setQueryData(OFFER_KEY, next.offer);
      } catch {
        started.delete(id);
      }
    })();
  }, [id]);
}

export function dismissOffer(id: string) {
  queryClient.setQueryData(OFFER_KEY, null);
  useOfferPeak.getState().clear();
  void payApi.offerDismiss(id).catch(() => {});
}
