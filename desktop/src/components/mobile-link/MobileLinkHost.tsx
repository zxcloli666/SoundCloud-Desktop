import { useEffect } from 'react';
import { mobileLink } from '../../stores/mobile-link';
import { MobileLinkDialog } from './MobileLinkDialog';
import { MobileLinkIsland } from './MobileLinkIsland';

export function MobileLinkHost() {
  useEffect(() => mobileLink.init(), []);

  return (
    <>
      <MobileLinkIsland />
      <MobileLinkDialog />
    </>
  );
}
