import { memo, type RefObject } from 'react';
import type { Seq } from '../../../lib/chat/types';

export const GalleryTab = memo(function GalleryTab(_props: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onJump: (seq: Seq) => void;
}) {
  return null;
});
