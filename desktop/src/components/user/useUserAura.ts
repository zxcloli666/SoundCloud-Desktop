import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import {
  type Aura,
  auraFromHex,
  DEFAULT_AURA,
  DEFAULT_CUSTOM_HEX,
  resolveAura,
} from '../../lib/aura';
import { useViewerAura } from '../../lib/useViewerAura';

type AuraResponse = {
  aura_id: string | null;
  custom_hex: string | null;
};

const STALE_MS = 5 * 60 * 1000;
const GC_MS = 10 * 60 * 1000;

const auraKey = (urn: string | undefined) => ['user', urn, 'aura'] as const;

export function useUserAura(urn: string | undefined, hasStar: boolean) {
  const query = useQuery({
    queryKey: auraKey(urn),
    queryFn: ({ signal }) =>
      api<AuraResponse>(`/users/${encodeURIComponent(urn!)}/aura`, { signal }),
    enabled: !!urn && hasStar,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });

  const viewerAura = useViewerAura();
  const aura = useMemo(
    () => (hasStar ? resolveAura(query.data?.aura_id, query.data?.custom_hex) : viewerAura),
    [hasStar, query.data?.aura_id, query.data?.custom_hex, viewerAura],
  );

  const initialCustomHex = query.data?.custom_hex ?? DEFAULT_CUSTOM_HEX;
  return { aura, customHex: initialCustomHex, isLoading: query.isLoading };
}

const SAVE_DEBOUNCE_MS = 500;

export function useEditableUserAura(urn: string | undefined, enabled: boolean) {
  const qc = useQueryClient();
  const remote = useQuery({
    queryKey: auraKey(urn),
    queryFn: ({ signal }) =>
      api<AuraResponse>(`/users/${encodeURIComponent(urn!)}/aura`, { signal }),
    enabled: !!urn && enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });

  const viewerAura = useViewerAura();
  const [aura, setAura] = useState<Aura>(DEFAULT_AURA);
  const [customHex, setCustomHex] = useState<string>(DEFAULT_CUSTOM_HEX);
  const initRef = useRef(false);

  useEffect(() => {
    if (!enabled || initRef.current || !remote.data) return;
    setAura(resolveAura(remote.data.aura_id, remote.data.custom_hex));
    if (remote.data.custom_hex) setCustomHex(remote.data.custom_hex);
    initRef.current = true;
  }, [enabled, remote.data]);

  const mutation = useMutation({
    mutationFn: (payload: { aura_id: string; custom_hex?: string | null }) =>
      api<AuraResponse>('/me/aura', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      if (urn) qc.setQueryData(auraKey(urn), data);
    },
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback(
    (next: Aura, hex: string) => {
      if (!enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        mutation.mutate({
          aura_id: next.id,
          custom_hex: next.id === 'custom' ? hex : null,
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [enabled, mutation],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const onPickAura = useCallback(
    (next: Aura) => {
      setAura(next);
      queueSave(next, customHex);
    },
    [customHex, queueSave],
  );

  const onPickCustom = useCallback(
    (hex: string) => {
      setCustomHex(hex);
      const next = auraFromHex(hex);
      if (next) {
        setAura(next);
        queueSave(next, hex);
      }
    },
    [queueSave],
  );

  // Без «звезды» кастомизация недоступна — отдаём ауру по теме смотрящего.
  return { aura: enabled ? aura : viewerAura, customHex, onPickAura, onPickCustom };
}
