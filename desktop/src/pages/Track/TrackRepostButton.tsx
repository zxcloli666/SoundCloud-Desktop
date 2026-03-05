import React, { useState } from 'react';
import { api } from '../../lib/api.ts';
import { Repeat2 } from 'lucide-react';
import { toCompactCount } from '../../lib/utils.ts';

const TrackRepostButtonBase = ({ trackUrn, count }: { trackUrn: string; count?: number }) => {
  const [reposted, setReposted] = useState(false);
  const [localCount, setLocalCount] = useState(count ?? 0);

  const toggle = async () => {
    const next = !reposted;
    setReposted(next);
    setLocalCount((c) => c + (next ? 1 : -1));
    try {
      await api(`/reposts/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
    } catch {
      setReposted(!next);
      setLocalCount((c) => c + (next ? -1 : 1));
    }
  };

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
