import React, {useCallback, useRef} from 'react';
import {useShallow} from 'zustand/shallow';
import {art} from '../../lib/formatters';
import {useLyricsStore} from '../../stores/lyrics';
import {usePlayerStore} from '../../stores/player';
import {useSettingsStore} from '../../stores/settings';
import {LyricsBackdrop, useArtworkColor} from './lyrics/LyricsBackdrop';
import {LyricsHeader} from './lyrics/LyricsHeader';
import {LyricsPane} from './lyrics/LyricsPane';
import {LyricsVisualizer} from './lyrics/LyricsVisualizer';
import {SplitDivider} from './lyrics/SplitDivider';
import {TimedCommentsRail} from './lyrics/TimedComments';
import {TrackColumn} from './lyrics/TrackColumn';

/* ── Lyrics Panel (fullscreen) ────────────────────────────────
 * Thin shell: immersive backdrop (wallpaper-aware) + floating header (close is
 * pinned top-right, never shifts) + the split track/lyrics/comments composition.
 * All the heavy pieces live in ./lyrics/*. */

export const LyricsPanel = React.memo(() => {
  const { tab, rightPanelOpen, splitRatio } = useLyricsStore(
    useShallow((s) => ({
      tab: s.tab,
      rightPanelOpen: s.rightPanelOpen,
      splitRatio: s.splitRatio,
    })),
  );
  const track = usePlayerStore((s) => s.currentTrack);
  const artworkColor = useArtworkColor(track?.artwork_url ?? null);
  const splitLayoutRef = useRef<HTMLDivElement>(null);
  const visualizerEnabled = useSettingsStore((s) => s.lyricsVisualizer);

  const selectTab = useCallback(
    (next: typeof tab) => {
      const lyrics = useLyricsStore.getState();
      lyrics.setTab(next);
      lyrics.setRightPanelOpen(true);
    },
    [],
  );

  if (!track) return null;

  const artwork500 = art(track.artwork_url, 't500x500');
  const splitPercent = splitRatio * 100;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden animate-fade-in-up bg-[#08080a]">
        <LyricsBackdrop artworkSrc={artwork500} color={artworkColor}/>
        {visualizerEnabled && <LyricsVisualizer/>}

        <LyricsHeader
            tab={tab}
            rightPanelOpen={rightPanelOpen}
            onSelectTab={selectTab}
            onTogglePanel={useLyricsStore.getState().toggleRightPanel}
            onClose={useLyricsStore.getState().close}
        />

      {rightPanelOpen ? (
        <div
          ref={splitLayoutRef}
          className="relative z-10 grid flex-1 min-h-0 pt-16"
          style={{
            isolation: 'isolate',
            gridTemplateColumns: `${splitPercent}% ${100 - splitPercent}%`,
          }}
        >
          <div className="min-w-0 min-h-0">
            <TrackColumn track={track} />
          </div>

          <SplitDivider
            splitRatio={splitRatio}
            onChange={useLyricsStore.getState().setSplitRatio}
            layoutRef={splitLayoutRef}
          />

          <div className="min-w-0 min-h-0 flex flex-col relative">
            {tab === 'comments' ? (
              <TimedCommentsRail trackUrn={track.urn} />
            ) : (
              <LyricsPane track={track} />
            )}
          </div>
        </div>
      ) : (
        <div
            className="relative z-10 flex-1 flex items-center justify-center min-h-0 pt-16"
          style={{ isolation: 'isolate' }}
        >
          <TrackColumn track={track} maxArt="max-w-[420px]" />
        </div>
      )}
    </div>
  );
});
