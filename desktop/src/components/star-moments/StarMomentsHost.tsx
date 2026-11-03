import { memo } from 'react';
import { useAuthStore } from '../../stores/auth';
import { usePreviewEnd } from '../../stores/preview-end';
import { ExpiryNudge, useExpiryMoment } from './ExpiryNudge';
import { PreviewEndCard } from './PreviewEndCard';
import { RecapNudge } from './RecapNudge';
import { WinbackSheet } from './WinbackSheet';

/** One floating STAR moment at a time (preview end, then expiry, then recap) plus the win-back sheet. */
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
  const previewing = usePreviewEnd((s) => s.track !== null);
  const expiry = useExpiryMoment();
  if (previewing) return <PreviewEndCard />;
  if (expiry) return <ExpiryNudge moment={expiry} />;
  return <RecapNudge />;
});
