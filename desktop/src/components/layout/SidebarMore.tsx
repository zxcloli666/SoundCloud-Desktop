import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Ellipsis, Pin } from '../../lib/icons';
import { useSuperlikeCount } from '../../lib/superlikes';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';
import { itemMeta } from '../settings/cards/layout-items';
import { NAV_ITEMS } from './nav-items';
import { IconBox, Label, ROW } from './SidebarChrome';
import { SidebarRow } from './SidebarRow';

interface Spare {
  key: string;
  to: string;
  label: string;
  icon: ReactNode;
  pin: () => void;
}

function useSpareRows(shown: readonly string[]): Spare[] {
  const nav = useLayout('sidebar');
  const quick = useLayout('quick');
  const pinNav = useToggleLayoutEntry('sidebar');
  const pinQuick = useToggleLayoutEntry('quick');
  const hasSuperlikes = useSuperlikeCount() > 0;
  return [
    ...nav
      .filter((entry) => !shown.includes(entry.id))
      .map(({ id }) => ({
        key: `nav:${id}`,
        to: NAV_ITEMS[id].to,
        ...itemMeta('sidebar', id),
        pin: () => pinNav(id),
      })),
    ...quick
      .filter((entry) => entry.hidden && (entry.id !== 'superlikes' || hasSuperlikes))
      .map(({ id }) => ({
        key: `quick:${id}`,
        to: `/library/${id}`,
        ...itemMeta('quick', id),
        pin: () => pinQuick(id),
      })),
  ];
}

export function SidebarMore({
  collapsed,
  shown,
}: {
  collapsed: boolean;
  shown: readonly string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = useSpareRows(shown);
  if (rows.length === 0) return null;

  return (
    <div
      data-ui="sidebar-more"
      className={`rounded-lg transition-colors duration-300 ${open ? 'bg-ink/[0.03]' : ''}`}
    >
      <button
        type="button"
        aria-expanded={open}
        title={collapsed ? t('sidebar.more') : undefined}
        onClick={() => setOpen(!open)}
        className={`${ROW} cursor-pointer text-ink-40 hover:bg-ink/[0.05] hover:text-ink`}
      >
        <IconBox>
          <Ellipsis size={17} strokeWidth={1.9} />
        </IconBox>
        <Label collapsed={collapsed} className="text-[12.5px] font-medium">
          {t('sidebar.more')}
        </Label>
        {!collapsed && (
          <ChevronDown
            size={13}
            className={`absolute right-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      <div
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-apple)] ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {rows.map((row) => (
            <SidebarRow
              key={row.key}
              to={row.to}
              title={t(row.label)}
              icon={row.icon}
              collapsed={collapsed}
              actionLabel={t('sidebar.pin')}
              actionIcon={<Pin size={13} />}
              onAction={row.pin}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
