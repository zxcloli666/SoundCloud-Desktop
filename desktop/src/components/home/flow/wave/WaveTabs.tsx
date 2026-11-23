import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../../lib/perf';
import { useLayoutMenu } from '../../../layout/LayoutMenu';
import { revealChip, useChipScroller } from '../../../ui/useChipScroller';

export interface WaveTab {
  id: string;
  label: string;
  pick: () => void;
}

interface Props {
  heads: WaveTab[];
  stations: WaveTab[];
  value: string;
  panelId: string;
}

const HEAD = 'text-[22px] font-bold tracking-[-0.025em]';
const STATION = 'text-[12.5px] font-semibold';
const PARENT = 'text-ink-60 hover:text-ink-80';
const IDLE = 'text-ink-40 hover:text-ink-80';

function walkTabs(event: KeyboardEvent<HTMLElement>) {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(event.target as HTMLElement);
  const steps: Record<string, number> = {
    ArrowLeft: at - 1,
    ArrowRight: at + 1,
    Home: 0,
    End: tabs.length - 1,
  };
  const to = steps[event.key];
  if (at < 0 || to === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  const next = tabs[(to + tabs.length) % tabs.length];
  next.focus({ preventScroll: true });
  next.click();
}

function Tab({
  tab,
  selected,
  panelId,
  look,
  tone = IDLE,
}: {
  tab: WaveTab;
  selected: boolean;
  panelId: string;
  look: string;
  tone?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      data-ui="wave-tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={tab.pick}
      className={`shrink-0 cursor-pointer whitespace-nowrap outline-none transition-colors focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-[6px] ${look} ${
        selected ? 'text-ink' : tone
      }`}
    >
      {tab.label}
    </button>
  );
}

function StationStrip({ active, children }: { active: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const smooth = usePerfMode().mode !== 'light';
  useChipScroller(ref);
  useEffect(() => {
    if (active) revealChip(ref.current, smooth);
  }, [active, smooth]);
  return (
    <div
      ref={ref}
      role="presentation"
      className="station-strip scrollbar-hide relative flex min-w-0 flex-1 items-baseline gap-3.5 overflow-x-auto"
    >
      {children}
    </div>
  );
}

export function WaveTabs({ heads, stations, value, panelId }: Props) {
  const { t } = useTranslation();
  const menu = useLayoutMenu('stations');
  const onStation = stations.some((tab) => tab.id === value);

  if (heads.length + stations.length === 1) {
    return (
      <>
        <h2 onContextMenu={menu.onContextMenu} className={`${HEAD} text-ink`}>
          {heads[0].label}
        </h2>
        {menu.menu}
      </>
    );
  }

  return (
    <>
      <div
        role="tablist"
        data-ui="wave-tabs"
        aria-label={t('flowRedesign.waveTitle')}
        onKeyDown={walkTabs}
        onContextMenu={menu.onContextMenu}
        className="flex items-baseline gap-3.5"
      >
        {heads.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            selected={tab.id === value}
            panelId={panelId}
            look={HEAD}
            tone={onStation && tab.id === 'wave' ? PARENT : IDLE}
          />
        ))}
        {stations.length > 0 && (
          <StationStrip key={stations.map((tab) => tab.id).join()} active={value}>
            {stations.map((tab) => (
              <Tab
                key={tab.id}
                tab={tab}
                selected={tab.id === value}
                panelId={panelId}
                look={STATION}
              />
            ))}
          </StationStrip>
        )}
      </div>
      {menu.menu}
    </>
  );
}
