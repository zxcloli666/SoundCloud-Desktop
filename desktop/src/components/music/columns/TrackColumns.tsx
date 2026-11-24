import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TRACK_COLUMN_DEFAULTS, useSettingsStore } from '../../../stores/settings';
import { TrackColumnsHeader } from './TrackColumnsHeader';

const MIN_TITLE = 220;
const RATING_WIDTH = 18;

export interface RowShape {
  fixed: number;
  gap: number;
  actions: number;
  duration: number;
  tail: number;
}

export const THEMED_SHAPE: RowShape = { fixed: 184, gap: 16, actions: 136, duration: 48, tail: 0 };
export const THEMED_OWNER_SHAPE: RowShape = { ...THEMED_SHAPE, actions: 170 };
export const ALBUM_SHAPE: RowShape = { fixed: 176, gap: 16, actions: 134, duration: 48, tail: 0 };
export const LIBRARY_SHAPE: RowShape = { fixed: 172, gap: 16, actions: 168, duration: 48, tail: 0 };
export const LIBRARY_GRIP_SHAPE: RowShape = { ...LIBRARY_SHAPE, fixed: 204 };
export const SEQUENCE_SHAPE: RowShape = {
  fixed: 160,
  gap: 14,
  actions: 100,
  duration: 40,
  tail: 0,
};
export const SEQUENCE_REMOVE_SHAPE: RowShape = { ...SEQUENCE_SHAPE, tail: 42 };
export const SEQUENCE_SORTABLE_SHAPE: RowShape = { ...SEQUENCE_SHAPE, fixed: 180, tail: 42 };

export interface TrackColumnsLayout {
  plays: number;
  likes: number;
  actions: number;
}

const HIDDEN: TrackColumnsLayout = { plays: 0, likes: 0, actions: 0 };

const TrackColumnsContext = createContext<TrackColumnsLayout>(HIDDEN);

export const useTrackColumns = () => useContext(TrackColumnsContext);

export function useColumnWidth(id: keyof typeof TRACK_COLUMN_DEFAULTS): number {
  return useSettingsStore((s) => s.trackColumns[id] ?? TRACK_COLUMN_DEFAULTS[id]);
}

function fit(
  width: number,
  shape: RowShape,
  wanted: { plays: number; likes: number },
): TrackColumnsLayout {
  const { gap } = shape;
  const taken = shape.fixed + shape.actions + shape.duration + shape.tail + RATING_WIDTH + gap;
  let free = width - taken - MIN_TITLE;
  const layout = { ...HIDDEN, actions: shape.actions };
  if (free >= wanted.plays + gap) {
    layout.plays = wanted.plays;
    free -= wanted.plays + gap;
  }
  if (layout.plays > 0 && free >= wanted.likes + gap) {
    layout.likes = wanted.likes;
  }
  return layout;
}

export function TrackColumns({
  shape,
  header = true,
  children,
}: {
  shape: RowShape;
  header?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const stored = useSettingsStore((s) => s.trackColumns);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = fit(width, shape, {
    plays: stored.plays ?? TRACK_COLUMN_DEFAULTS.plays,
    likes: stored.likes ?? TRACK_COLUMN_DEFAULTS.likes,
  });

  return (
    <TrackColumnsContext.Provider value={layout}>
      <div ref={ref}>
        {header && <TrackColumnsHeader layout={layout} shape={shape} />}
        {children}
      </div>
    </TrackColumnsContext.Provider>
  );
}
