import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchQueryStore } from '../../stores/searchQuery';

export const VOICE_CATEGORY = 'voice';

export function useOpenVoiceSettings() {
  const navigate = useNavigate();
  return useCallback(
    () => navigate('/settings', { state: { category: VOICE_CATEGORY } }),
    [navigate],
  );
}

export function useSearchFor() {
  const navigate = useNavigate();
  return useCallback(
    (text: string) => {
      useSearchQueryStore.getState().setQ(text);
      navigate('/search');
    },
    [navigate],
  );
}
