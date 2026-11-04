import { type KeyboardEvent, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomImagesPolicy as Policy } from '../../../lib/chat/media-types';
import { Images, Loader2 } from '../../../lib/icons';
import { setRoomImages } from '../../../lib/together/room-actions';
import type { RoomView } from '../../../lib/together/types';
import { isRoomHost, useTogetherStore } from '../../../stores/together';
import './perks/keyframes';
import { PolicyGlyph } from './perks/PolicyGlyph';
import { StarAction, useStarState } from './perks/StarAction';
import { StarMark } from './perks/StarMark';
import { usePending } from './usePending';

const PRIVATE_POLICIES: Policy[] = ['members', 'mods', 'off'];
const PUBLIC_POLICIES: Policy[] = ['mods', 'off'];
const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function resolved(room: RoomView): Policy {
  const policy = room.roomImages ?? (room.public ? 'mods' : 'members');
  return room.public && policy === 'members' ? 'mods' : policy;
}

export const RoomImagesPolicy = memo(function RoomImagesPolicy({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const star = useStarState(room.perks);
  const [policy, change, busy] = usePending(resolved(room));
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  if (!host || !room.perks) return null;

  const options = room.public ? PUBLIC_POLICIES : PRIVATE_POLICIES;
  const pick = (value: Policy) => {
    if (value !== policy) change(value, () => setRoomImages(value));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const from = Math.max(0, options.indexOf(policy));
    const to = (from + step + options.length) % options.length;
    pick(options[to]);
    radios.current[to]?.focus();
  };

  return (
    <div data-ui="room-images-policy" className="px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <Images
          size={14}
          className={
            policy !== 'off' && star === 'star' ? 'shrink-0 text-accent' : 'shrink-0 text-ink-35'
          }
        />
        <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">
          {t('chat.room.perks.images.title')}
        </span>
        {busy && <Loader2 size={12} className="shrink-0 animate-spin text-ink-40" />}
        {star !== 'star' && <StarMark size={14} lock />}
      </div>
      <div
        role="radiogroup"
        aria-label={t('chat.room.perks.images.title')}
        aria-busy={busy}
        onKeyDown={onKeyDown}
        className="mt-2 flex gap-0.5 rounded-lg bg-ink/[0.05] p-0.5"
      >
        {options.map((value, index) => {
          const on = policy === value;
          return (
            <button
              key={value}
              ref={(node) => {
                radios.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(value)}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-1.5 outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ink ${
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
      {star !== 'star' && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {star === 'free' && (
            <span className="truncate text-[11px] font-semibold text-accent">
              {t('chat.room.perks.images.withStar')}
            </span>
          )}
          <StarAction state={star} />
        </div>
      )}
    </div>
  );
});
