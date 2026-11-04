import { type ComponentType, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Timer } from '../../../lib/chat/icons';
import { LinkIcon, Settings } from '../../../lib/icons';
import { setRoomChat, setRoomLinks, setSlowMode } from '../../../lib/together/room-actions';
import { SLOW_MODE_SECONDS } from '../../../lib/together/room-rules';
import type { RoomView } from '../../../lib/together/types';
import { RoomCover } from './RoomCover';
import { RoomImagesPolicy } from './RoomImagesPolicy';
import { RoomPopover } from './RoomPopover';
import { usePending } from './usePending';

type IconType = ComponentType<{ size?: number; className?: string }>;

function RuleSwitch({
  icon: Icon,
  label,
  on,
  onChange,
}: {
  icon: IconType;
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.05]"
    >
      <Icon size={14} className={on ? 'shrink-0 text-accent' : 'shrink-0 text-ink-35'} />
      <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">{label}</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
          on ? 'bg-accent' : 'bg-ink/10'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full shadow-md transition-[left] duration-200 ${
            on ? 'left-[18px] bg-accent-contrast' : 'left-0.5 bg-white'
          }`}
        />
      </span>
    </button>
  );
}

function SlowMode({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <Timer
          size={14}
          className={seconds > 0 ? 'shrink-0 text-accent' : 'shrink-0 text-ink-35'}
        />
        <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">
          {t('chat.room.rules.slow')}
        </span>
      </div>
      <div role="radiogroup" className="mt-2 flex rounded-lg bg-ink/[0.05] p-0.5">
        {SLOW_MODE_SECONDS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={seconds === value}
            onClick={() => onChange(value)}
            className={`h-7 flex-1 cursor-pointer rounded-md text-[11.5px] font-semibold tabular-nums transition-colors duration-200 ${
              seconds === value ? 'bg-ink/[0.14] text-white' : 'text-ink-45 hover:text-ink-75'
            }`}
          >
            {value === 0 ? t('chat.room.rules.slowOff') : t('chat.room.rules.seconds', { value })}
          </button>
        ))}
      </div>
    </div>
  );
}

export const RoomRulesPanel = memo(function RoomRulesPanel({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const [chat, changeChat] = usePending(room.chatEnabled !== false);
  const [links, changeLinks] = usePending(room.links !== false);
  const [slow, changeSlow] = usePending(room.slowModeS ?? 0);

  return (
    <div className="flex flex-col">
      <RuleSwitch
        icon={MessageCircle}
        label={t('chat.room.rules.chat')}
        on={chat}
        onChange={(on) => changeChat(on, () => setRoomChat(on))}
      />
      {chat && (
        <>
          <RuleSwitch
            icon={LinkIcon}
            label={t('chat.room.rules.links')}
            on={links}
            onChange={(on) => changeLinks(on, () => setRoomLinks(on))}
          />
          <SlowMode
            seconds={slow}
            onChange={(value) => changeSlow(value, () => setSlowMode(value))}
          />
        </>
      )}
      <RoomImagesPolicy room={room} />
      <RoomCover room={room} />
    </div>
  );
});

export const RoomRules = memo(function RoomRules({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={260}
      trigger={
        <button
          type="button"
          data-ui="room-rules"
          title={t('chat.room.rules.title')}
          aria-label={t('chat.room.rules.title')}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-90"
        >
          <Settings size={13} />
        </button>
      }
    >
      <RoomRulesPanel room={room} />
    </RoomPopover>
  );
});
