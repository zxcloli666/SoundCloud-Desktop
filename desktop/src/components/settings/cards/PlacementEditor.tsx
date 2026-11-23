import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Play, SkipBack, SkipForward } from '../../../lib/icons';
import { type Placed, SURFACE_ZONES, type Surface, type Zone } from '../../../lib/player-zones';
import { useReducedMotion } from '../../../lib/reduced-motion';
import { usePlacement } from '../../../lib/use-layout';
import { useZoneDrag, zoneKey } from '../../../lib/use-zone-drag';
import { useSettingsStore } from '../../../stores/settings';
import { Segmented } from '../primitives';
import { SubHeading } from './LayoutExtras';
import { type LayoutListItem, LayoutRow, LiftedRow, RowIconButton } from './LayoutList';
import { itemMeta } from './layout-items';

const MEASURE = { droppable: { strategy: MeasuringStrategy.Always } };
const DROP = { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

const ZONE_LABELS: Record<Zone, string> = {
  title: 'settings.zoneTitle',
  left: 'settings.zoneLeft',
  before: 'settings.zoneBefore',
  after: 'settings.zoneAfter',
  right: 'settings.zoneRight',
};

function useRows(surface: Surface, entries: Placed[]) {
  const { t } = useTranslation();
  const setLayout = useSettingsStore((s) => s.setLayout);
  const toggle = (id: string) =>
    setLayout(
      surface,
      entries.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
    );
  return new Map<string, LayoutListItem>(
    entries.map((entry) => {
      const meta = itemMeta(surface, entry.id);
      return [
        entry.id,
        {
          id: entry.id,
          icon: meta.icon,
          label: t(meta.label),
          dimmed: entry.hidden,
          trailing: (
            <RowIconButton
              label={entry.hidden ? t('settings.layoutShow') : t('settings.layoutHide')}
              active={!entry.hidden}
              onClick={() => toggle(entry.id)}
            >
              {entry.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </RowIconButton>
          ),
        },
      ];
    }),
  );
}

function ZoneList({
  zone,
  ids,
  rows,
  drop,
}: {
  zone: Zone;
  ids: string[];
  rows: Map<string, LayoutListItem>;
  drop: 'open' | 'over' | undefined;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: zoneKey(zone) });
  return (
    <section data-zone={zone} className="zone-cell flex min-w-0 flex-col gap-1.5">
      <h4 className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-40">
        {t(ZONE_LABELS[zone])}
      </h4>
      <div ref={setNodeRef} data-drop={drop} className="zone-list flex flex-col gap-1">
        <SortableContext id={zone} items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const row = rows.get(id);
            return row ? <LayoutRow key={id} item={row} ghost /> : null;
          })}
        </SortableContext>
        {ids.length === 0 && <div aria-hidden className="zone-empty" />}
      </div>
    </section>
  );
}

function TransportChip() {
  const { t } = useTranslation();
  return (
    <div className="zone-cell zone-core" data-zone="core">
      <div
        title={t('settings.zoneFixed')}
        aria-label={t('settings.zoneFixed')}
        className="flex items-center gap-2 rounded-full border border-[color:var(--set-line)] bg-[var(--set-well)] py-1 pr-2.5 pl-2.5 text-ink-60"
      >
        <SkipBack size={13} fill="currentColor" />
        <span className="flex size-7 items-center justify-center rounded-full bg-ink text-paper">
          <Play size={12} fill="currentColor" strokeWidth={0} className="ml-px" />
        </span>
        <SkipForward size={13} fill="currentColor" />
      </div>
    </div>
  );
}

export function PlacementEditor({
  surface,
  onSurface,
}: {
  surface: Surface;
  onSurface: (surface: Surface) => void;
}) {
  const { t } = useTranslation();
  const entries = usePlacement(surface);
  const drag = useZoneDrag(surface, entries, 'y', true);
  const rows = useRows(surface, entries);
  const reduced = useReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const lifted = drag.active ? rows.get(drag.active) : undefined;
  const dropOf = (zone: Zone) => (drag.active ? (drag.over === zone ? 'over' : 'open') : undefined);

  return (
    <div data-ui="settings-row" className="set-row space-y-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SubHeading title={t('settings.layoutPlacement')} />
        <Segmented
          value={surface}
          onChange={onSurface}
          options={[
            { id: 'player', label: t('settings.layoutBar') },
            { id: 'deck', label: t('settings.layoutDeck') },
          ]}
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={drag.collide}
        measuring={MEASURE}
        onDragStart={drag.onDragStart}
        onDragOver={drag.onDragOver}
        onDragEnd={drag.onDragEnd}
        onDragCancel={drag.onDragCancel}
      >
        <div className="zone-map-wrap">
          <div data-ui="player-zones" data-surface={surface} className="zone-map">
            {SURFACE_ZONES[surface].map((zone) => (
              <ZoneList
                key={zone}
                zone={zone}
                ids={drag.ids[zone]}
                rows={rows}
                drop={dropOf(zone)}
              />
            ))}
            <TransportChip />
          </div>
        </div>
        {createPortal(
          <DragOverlay dropAnimation={reduced ? null : DROP}>
            {lifted ? <LiftedRow item={lifted} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );
}
