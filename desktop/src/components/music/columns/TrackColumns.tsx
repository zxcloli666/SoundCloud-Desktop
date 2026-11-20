import { createContext, type ReactNode, useContext, useLayoutEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../stores/auth';
import { TRACK_COLUMN_DEFAULTS, useSettingsStore } from '../../../stores/settings';
import { TrackColumnsHeader } from './TrackColumnsHeader';

const MIN_TITLE = 220;
const BADGES_WIDTH = 100;
const ROW_FIXED = 32 + 40 + 48 + 48 + 64;
const ACTIONS = 136;
const ACTIONS_OWNER = 170;

export interface TrackColumnsLayout {
  plays: number;
  likes: number;
  badges: boolean;
  actions: number;
}

const HIDDEN: TrackColumnsLayout = { plays: 0, likes: 0, badges: false, actions: ACTIONS };

const TrackColumnsContext = createContext<TrackColumnsLayout>(HIDDEN);

export const useTrackColumns = () => useContext(TrackColumnsContext);

function fit(
  width: number,
  actions: number,
  wanted: { plays: number; likes: number },
): TrackColumnsLayout {
  let free = width - ROW_FIXED - actions - MIN_TITLE;
  const layout = { ...HIDDEN, actions };
  if (free >= wanted.plays + 16) {
    layout.plays = wanted.plays;
    free -= wanted.plays + 16;
  }
  if (layout.plays > 0 && free >= wanted.likes + 16) {
    layout.likes = wanted.likes;
    free -= wanted.likes + 16;
  }
  layout.badges = layout.likes > 0 && free >= BADGES_WIDTH + 16;
  return layout;
}

export function TrackColumns({
  ownerUrn,
  header = true,
  children,
}: {
  ownerUrn?: string;
  header?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const stored = useSettingsStore((s) => s.trackColumns);
  const owner = useAuthStore((s) => !!ownerUrn && s.user?.urn === ownerUrn);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = fit(width, owner ? ACTIONS_OWNER : ACTIONS, {
    plays: stored.plays ?? TRACK_COLUMN_DEFAULTS.plays,
    likes: stored.likes ?? TRACK_COLUMN_DEFAULTS.likes,
  });

  return (
    <TrackColumnsContext.Provider value={layout}>
      <div ref={ref}>
        {header && <TrackColumnsHeader layout={layout} />}
        {children}
      </div>
    </TrackColumnsContext.Provider>
  );
}
