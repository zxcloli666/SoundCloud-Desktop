import { memo } from 'react';
import { useAuthStore } from '../../stores/auth';
import { ExpiryNudge, useExpiryMoment } from './ExpiryNudge';
import { RecapNudge } from './RecapNudge';
import { TenureMoment, useTenureMoment } from './TenureMoment';
import { WinbackSheet } from './WinbackSheet';

/** One floating STAR moment at a time (expiry, then tenure, then recap) plus the win-back sheet. */
export const StarMomentsHost = memo(function StarMomentsHost() {
  const hasSession = useAuthStore((s) => s.hasSession);
  if (!hasSession) return null;
  return (
    <>
      <FloatingMoment />
      <WinbackSheet />
    </>
  );
});

const FloatingMoment = memo(function FloatingMoment() {
  const expiry = useExpiryMoment();
  const tenure = useTenureMoment();
  if (expiry) return <ExpiryNudge moment={expiry} />;
  if (tenure) return <TenureMoment moment={tenure} />;
  return <RecapNudge />;
});
