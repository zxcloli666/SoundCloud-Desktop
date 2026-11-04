import { memo } from 'react';
import type { UploadView } from '../../../../lib/chat/media-types';
import { RotateCcw, Users } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { Avatar } from '../../../ui/Avatar';
import { GroupPhoto } from './GroupPhoto';
import { ProgressRing } from './ProgressRing';
import { uploadFraction } from './progress';
import { UploadThumb } from './UploadThumb';

export const AVATAR_SIZE = 72;

function Placeholder() {
  return (
    <span className="flex size-[72px] items-center justify-center rounded-full bg-ink/[0.07] text-ink-45">
      <Users size={28} />
    </span>
  );
}

function Still({ photo, legacy }: { photo: string | null; legacy: string | null }) {
  if (photo) return <GroupPhoto src={photo} size={AVATAR_SIZE} fallback={<Placeholder />} />;
  if (legacy) return <Avatar src={legacy} size={AVATAR_SIZE} />;
  return <Placeholder />;
}

export const GroupAvatarFace = memo(function GroupAvatarFace({
  upload,
  applying,
  photo,
  legacy,
}: {
  upload: UploadView | null;
  applying: boolean;
  photo: string | null;
  legacy: string | null;
}) {
  const perf = usePerfMode();
  if (!upload && !applying) return <Still photo={photo} legacy={legacy} />;
  const failed = upload?.state === 'failed';
  const waiting = upload?.state === 'queued' || upload?.state === 'reserved';
  return (
    <span className="relative block">
      {upload ? (
        <UploadThumb upload={upload} size={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
      ) : (
        <Still photo={photo} legacy={legacy} />
      )}
      <span
        data-scheme="dark"
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: failed ? 'rgb(var(--shade) / 0.6)' : 'rgb(var(--shade) / 0.35)' }}
      >
        {failed ? (
          <RotateCcw size={20} className="text-ink" />
        ) : (
          <ProgressRing
            value={upload ? uploadFraction(upload) : 1}
            size={AVATAR_SIZE - 8}
            stroke={3}
            waiting={waiting || !upload}
            still={!perf.idleAnim}
            tone="rgb(var(--ink))"
          />
        )}
      </span>
    </span>
  );
});
