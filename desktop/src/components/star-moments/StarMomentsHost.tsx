import { memo } from 'react';
import { useAuthStore } from '../../stores/auth';
import { ChargeNudge, useChargeMoment } from './ChargeNudge';
import { ExpiryNudge, useExpiryMoment } from './ExpiryNudge';
import { OfferMoment, useOfferMoment } from './OfferMoment';
import { RecapNudge } from './RecapNudge';
import { TenureMoment, useTenureMoment } from './TenureMoment';
import { useStarReminder } from './useStarReminder';
import { WinbackSheet } from './WinbackSheet';

/** One floating STAR moment at a time (expiry, charge, offer, tenure, recap) plus the win-back sheet. */
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
  const charge = useChargeMoment();
  const offer = useOfferMoment();
  const tenure = useTenureMoment();
  useStarReminder();
  if (expiry) return <ExpiryNudge moment={expiry} />;
  if (charge) return <ChargeNudge moment={charge} />;
  if (offer) return <OfferMoment offer={offer} />;
  if (tenure) return <TenureMoment moment={tenure} />;
  return <RecapNudge />;
});
