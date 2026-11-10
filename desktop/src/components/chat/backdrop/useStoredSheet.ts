import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { MediaRef, MyMedia } from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import { thumbUrl } from '../storage/thumb-url';
import { PHOTO_TILE } from './PhotoTile';
import type { Focus } from './PickerPreview';
import { STORED_TILE } from './StoredTile';
import type { PhotoActions } from './usePhotoActions';

export interface StoredSheetControl {
  shown: boolean;
  open: () => void;
  back: () => void;
  pick: (source: MediaRef) => void;
  preview: (item: MyMedia) => void;
  photoInstead: () => void;
}

export function useStoredSheet(
  grid: RefObject<HTMLDivElement | null>,
  acts: boolean,
  photos: PhotoActions,
  onPhoto: () => void,
  setFocus: Dispatch<SetStateAction<Focus>>,
): StoredSheetControl {
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!acts) setSheet(false);
  }, [acts]);

  const leave = useCallback(
    (tile: string) => {
      setSheet(false);
      requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(tile)?.focus());
    },
    [grid],
  );

  const open = useCallback(() => {
    setFocus({ kind: 'stored', src: null });
    if (acts) setSheet(true);
  }, [acts, setFocus]);

  const back = useCallback(() => {
    setFocus({ kind: 'stored', src: null });
    leave(STORED_TILE);
  }, [leave, setFocus]);

  const pick = useCallback(
    (source: MediaRef) => {
      const src = chatMediaUrl(source.conversationId, source.mediaId, 'image');
      const forget = (now: Focus): Focus =>
        now.kind === 'stored' && now.src === src ? { kind: 'stored', src: null } : now;
      leave(STORED_TILE);
      setFocus({ kind: 'stored', src });
      void photos.pickStored(source).then((problem) => {
        if (problem?.fix === 'stored') setFocus(forget);
      });
    },
    [leave, photos, setFocus],
  );

  const preview = useCallback(
    (item: MyMedia) => setFocus({ kind: 'stored', src: thumbUrl(item) }),
    [setFocus],
  );

  const photoInstead = useCallback(() => {
    leave(PHOTO_TILE);
    onPhoto();
  }, [leave, onPhoto]);

  return { shown: sheet && acts, open, back, pick, preview, photoInstead };
}
