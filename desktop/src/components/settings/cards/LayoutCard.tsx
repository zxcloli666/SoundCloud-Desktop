import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, LayoutDashboard, Lock, RotateCcw } from '../../../lib/icons';
import { isDefaultLayout, type LayoutScope, LOCKED_VISIBLE, moveEntry } from '../../../lib/layout';
import type { Surface } from '../../../lib/player-zones';
import { useLayout, useToggleLayoutEntry } from '../../../lib/use-layout';
import { useSettingsStore } from '../../../stores/settings';
import { Block, Card, Segmented } from '../primitives';
import { PinnedEditor, RiverSections, SubHeading } from './LayoutExtras';
import { LayoutList, RowIconButton } from './LayoutList';
import { itemMeta } from './layout-items';
import { PlacementEditor } from './PlacementEditor';

const SCOPES: Array<{ id: LayoutScope; labelKey: string }> = [
  { id: 'sidebar', labelKey: 'settings.layoutSidebar' },
  { id: 'library', labelKey: 'settings.layoutLibrary' },
  { id: 'home', labelKey: 'settings.layoutHome' },
  { id: 'player', labelKey: 'settings.layoutPlayer' },
];

const TAB_ROWS: Partial<Record<LayoutScope, readonly string[]>> = {
  sidebar: ['sidebar.quickAccess', 'settings.layoutPinned'],
  home: ['settings.layoutRiverSections'],
  player: ['settings.layoutPlacement'],
};

const HINTS: Record<LayoutScope, string> = {
  sidebar: 'settings.layoutSidebarHint',
  quick: 'settings.layoutSidebarHint',
  library: 'settings.layoutPageHint',
  home: 'settings.layoutPageHint',
  player: 'settings.layoutPlayerHint',
  deck: 'settings.layoutPlayerHint',
};

function BlocksEditor({ scope }: { scope: LayoutScope }) {
  const { t } = useTranslation();
  const layout = useLayout(scope);
  const setLayout = useSettingsStore((s) => s.setLayout);
  const toggle = useToggleLayoutEntry(scope);

  const items = layout.map((entry) => {
    const meta = itemMeta(scope, entry.id);
    const locked = LOCKED_VISIBLE.has(`${scope}:${entry.id}`);
    const offlineHint = scope === 'sidebar' && entry.id === 'offline' && entry.hidden;
    return {
      id: entry.id,
      icon: meta.icon,
      label: t(meta.label),
      hint: offlineHint ? t('settings.layoutOfflineAuto') : undefined,
      dimmed: entry.hidden,
      trailing: locked ? (
        <span
          title={t('settings.layoutAlwaysVisible')}
          className="flex h-8 w-8 items-center justify-center text-ink-30"
        >
          <Lock size={14} />
        </span>
      ) : (
        <RowIconButton
          label={entry.hidden ? t('settings.layoutShow') : t('settings.layoutHide')}
          active={!entry.hidden}
          onClick={() => toggle(entry.id)}
        >
          {entry.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </RowIconButton>
      ),
    };
  });

  return (
    <LayoutList
      items={items}
      onMove={(from, to) => setLayout(scope, moveEntry(layout, from, to))}
    />
  );
}

export function LayoutCard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LayoutScope>('sidebar');
  const [surface, setSurface] = useState<Surface>('player');
  const scope = tab === 'player' ? surface : tab;
  const layout = useLayout(scope);
  const quick = useLayout('quick');
  const riverHidden = useSettingsStore((s) => s.riverHidden);
  const resetLayout = useSettingsStore((s) => s.resetLayout);
  const pristine =
    isDefaultLayout(layout, scope) &&
    (scope !== 'home' || riverHidden.length === 0) &&
    (scope !== 'sidebar' || isDefaultLayout(quick, 'quick'));
  const reset = () => {
    resetLayout(scope);
    if (scope === 'sidebar') resetLayout('quick');
  };

  return (
    <Card
      title={t('settings.layoutTitle')}
      desc={t('settings.layoutDesc')}
      icon={<LayoutDashboard size={17} />}
      action={
        <button
          type="button"
          disabled={pristine}
          onClick={reset}
          className="set-btn"
          data-tone="quiet"
        >
          <RotateCcw size={13} />
          {t('settings.layoutReset')}
        </button>
      }
    >
      <Block className="space-y-3">
        <Segmented
          value={tab}
          onChange={setTab}
          full
          options={SCOPES.map((s) => ({
            id: s.id,
            label: t(s.labelKey),
            holds: TAB_ROWS[s.id]?.map((key) => t(key)),
          }))}
        />
        <p className="px-0.5 text-[12px] leading-snug text-ink-45">{t(HINTS[scope])}</p>
        {tab !== 'player' && <BlocksEditor key={scope} scope={scope} />}
      </Block>
      {tab === 'player' && <PlacementEditor surface={surface} onSurface={setSurface} />}
      {scope === 'sidebar' && (
        <div data-ui="settings-row" className="set-row space-y-2.5 py-3">
          <SubHeading title={t('sidebar.quickAccess')} />
          <BlocksEditor scope="quick" />
        </div>
      )}
      {scope === 'sidebar' && <PinnedEditor />}
      {scope === 'home' && <RiverSections />}
    </Card>
  );
}
