import { Crown, Shield } from '../../../lib/icons';
import { MicOff } from './icons';

const BADGE =
  'absolute flex size-[17px] items-center justify-center rounded-full border-2 border-chat-cutout';

export function RoleBadge({ host, moderator }: { host: boolean; moderator: boolean }) {
  if (host) {
    return (
      <span className={`${BADGE} -right-1 -bottom-1 bg-amber-300 text-amber-950`}>
        <Crown size={9} strokeWidth={2.8} />
      </span>
    );
  }
  if (!moderator) return null;
  return (
    <span className={`${BADGE} -right-1 -bottom-1 bg-sky-300 text-sky-950`}>
      <Shield size={9} strokeWidth={2.8} />
    </span>
  );
}

export function MuteBadge() {
  return (
    <span className={`${BADGE} -top-1 -right-1 bg-rose-300 text-rose-950`}>
      <MicOff size={9} strokeWidth={2.8} />
    </span>
  );
}
