import { Repeat2 } from 'lucide-react';
import React from 'react';
import { useRepostTrack } from '../../components/track/useRepostTrack.ts';
import { toCompactCount } from '../../lib/utils.ts';

const TrackRepostButtonBase = ({ trackUrn, count }: { trackUrn: string; count?: number }) => {
  const { reposted, count: localCount, toggle } = useRepostTrack(trackUrn, count ?? 0);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        reposted
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
      }`}
    >
      <Repeat2 size={16} />
      <span className="tabular-nums">{toCompactCount(localCount)}</span>
    </button>
  );
};
export const TrackRepostButton = React.memo(TrackRepostButtonBase);
