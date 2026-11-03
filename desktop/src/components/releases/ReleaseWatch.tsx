import { memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '../../lib/premium-cache';
import { startReleaseWatch } from '../../lib/release-watch';
import { useAuthStore } from '../../stores/auth';
import { useReleasesSeen } from '../../stores/releases-seen';
import { useSettingsStore } from '../../stores/settings';

export const ReleaseWatch = memo(function ReleaseWatch() {
  const navigate = useNavigate();
  const premium = usePremium();
  const signedIn = useAuthStore((s) => !!s.user);
  const notify = useSettingsStore((s) => s.releaseNotifications);
  const active = premium && signedIn && notify;

  useEffect(() => {
    if (!active) return;
    const stop = startReleaseWatch(() => navigate('/library/releases'));
    return () => {
      stop();
      useReleasesSeen.getState().forget();
    };
  }, [active, navigate]);

  return null;
});
