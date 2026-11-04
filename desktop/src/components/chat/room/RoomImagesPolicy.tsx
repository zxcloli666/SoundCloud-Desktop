import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomImagesPolicy as Policy } from '../../../lib/chat/media-types';
import { Images } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { setRoomImages } from '../../../lib/together/room-actions';
import type { RoomView } from '../../../lib/together/types';
import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { StarCta } from '../../star-moments/StarCta';
import { PolicyGlyph } from './perks/PolicyGlyph';
import { roomPerks } from './perks/perks';
import { StarMark } from './perks/StarMark';
import { usePending } from './usePending';

const PRIVATE_POLICIES: Policy[] = ['members', 'mods', 'off'];
const PUBLIC_POLICIES: Policy[] = ['mods', 'off'];

function resolved(room: RoomView): Policy {
  const policy = room.roomImages ?? (room.public ? 'mods' : 'members');
  return room.public && policy === 'members' ? 'mods' : policy;
}

export const RoomImagesPolicy = memo(function RoomImagesPolicy({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const premium = usePremium();
  const [policy, change] = usePending(resolved(room));
  if (!host) return null;

  const star = roomPerks(room).starHost;
  const options = room.public ? PUBLIC_POLICIES : PRIVATE_POLICIES;

  return (
    <div data-ui="room-images-policy" className="px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <Images
          size={14}
          className={policy !== 'off' && star ? 'shrink-0 text-accent' : 'shrink-0 text-ink-35'}
        />
        <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">
          {t('chat.room.perks.images.title')}
        </span>
        {!star && <StarMark size={14} />}
      </div>
      <div
        role="radiogroup"
        aria-label={t('chat.room.perks.images.title')}
        className="mt-2 flex gap-0.5 rounded-lg bg-ink/[0.05] p-0.5"
      >
        {options.map((value) => {
          const on = policy === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => change(value, () => setRoomImages(value))}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors duration-200 ${
                on ? 'bg-ink/[0.12]' : 'hover:bg-ink/[0.05]'
              }`}
            >
              <PolicyGlyph policy={value} />
              <span className={`text-[10.5px] font-semibold ${on ? 'text-ink-90' : 'text-ink-45'}`}>
                {t(`chat.room.perks.images.${value}`)}
              </span>
            </button>
          );
        })}
      </div>
      {!star && !premium && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold text-accent">
            {t('chat.room.perks.images.withStar')}
          </span>
          <StarCta size="sm" />
        </div>
      )}
    </div>
  );
});
