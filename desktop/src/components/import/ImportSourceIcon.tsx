import { Disc3, FileText, Heart, Music, Youtube } from '../../lib/icons';
import type { ImportKind } from '../../stores/import';

export function ImportSourceIcon({ kind, size = 16 }: { kind: ImportKind | null; size?: number }) {
  switch (kind) {
    case 'ym_likes':
      return <Heart size={size} />;
    case 'youtube':
      return <Youtube size={size} />;
    case 'spotify':
      return <Music size={size} />;
    case 'text':
      return <FileText size={size} />;
    default:
      return <Disc3 size={size} />;
  }
}
