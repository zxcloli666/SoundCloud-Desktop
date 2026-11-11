import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bindNavigator, setPage } from '../../lib/voice/chat/navigator';
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

export function NavBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    bindNavigator(navigate);
    return () => bindNavigator(null);
  }, [navigate]);

  useEffect(() => setPage(pathname), [pathname]);

  return null;
}
