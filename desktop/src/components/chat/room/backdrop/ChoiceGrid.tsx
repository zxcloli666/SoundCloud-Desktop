import { type Dispatch, memo, type RefObject, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackdropPresetId } from '../../../../lib/chat/media-types';
import type { Scheme } from '../../../../lib/scheme';
import { type ChoiceKey, orderedPresets } from './choices';
import { moveInGrid } from './grid';
import { NoneTile } from './NoneTile';
import { type PhotoState, PhotoTile } from './PhotoTile';
import type { Focus } from './PickerPreview';
import { PresetTile } from './PresetTile';
import type { ImageGate } from './photo-state';
import { StoredTile } from './StoredTile';

export const ChoiceGrid = memo(function ChoiceGrid({
  gridRef,
  scheme,
  live,
  cover,
  current,
  pending,
  waiting,
  photo,
  gate,
  imageSrc,
  onChoose,
  onPhoto,
  onStored,
  onFocus,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  scheme: Scheme;
  live: boolean;
  cover: string | null;
  current: ChoiceKey;
  pending: ChoiceKey | null;
  waiting: boolean;
  photo: PhotoState;
  gate: ImageGate;
  imageSrc: string | null;
  onChoose: (key: ChoiceKey, preset: BackdropPresetId | null) => void;
  onPhoto: () => void;
  onStored: () => void;
  onFocus: Dispatch<SetStateAction<Focus>>;
}) {
  const { t } = useTranslation();
  return (
    <div
      ref={gridRef}
      role="group"
      aria-label={t('chat.backdrop.title')}
      aria-busy={waiting}
      onKeyDown={moveInGrid}
      className="grid grid-cols-4 gap-2"
    >
      <NoneTile
        cover={cover}
        current={current === 'none'}
        pending={pending === 'none'}
        disabled={waiting}
        onPick={() => onChoose('none', null)}
        onFocus={() => onFocus({ kind: 'none' })}
      />
      <PhotoTile
        state={photo}
        current={current === 'photo'}
        disabled={gate.disabled}
        onPick={onPhoto}
        onFocus={() => onFocus({ kind: 'photo', src: imageSrc })}
      />
      <StoredTile
        state={photo}
        disabled={gate.disabled}
        onPick={onStored}
        onFocus={() =>
          onFocus((now) => (now.kind === 'stored' ? now : { kind: 'stored', src: null }))
        }
      />
      {orderedPresets(scheme).map((preset) => (
        <PresetTile
          key={preset.id}
          preset={preset}
          live={live}
          current={current === preset.id}
          pending={pending === preset.id}
          disabled={waiting}
          onPick={() => {
            onFocus({ kind: 'preset', preset });
            onChoose(preset.id, preset.id);
          }}
          onFocus={() => onFocus({ kind: 'preset', preset })}
        />
      ))}
    </div>
  );
});
