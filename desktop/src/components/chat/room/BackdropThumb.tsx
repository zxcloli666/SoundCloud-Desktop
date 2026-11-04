import { memo } from 'react';
import type { PublicBackdrop } from '../../../lib/chat/media-types';

export const BackdropThumb = memo(function BackdropThumb(_props: {
  backdrop: PublicBackdrop | null;
}) {
  return null;
});
