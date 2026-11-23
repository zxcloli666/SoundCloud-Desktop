import * as Popover from '@radix-ui/react-popover';
import { type MouseEvent, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Lock, RotateCcw } from '../../lib/icons';
import { isDefaultLayout, isLocked, type LayoutScope } from '../../lib/layout';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';
import { useSettingsStore } from '../../stores/settings';
import { itemMeta } from '../settings/cards/layout-items';

interface Point {
  x: number;
  y: number;
}

const ONE_COLUMN_MAX = 8;
const ITEM =
  'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-[12.5px] font-medium text-ink-70 outline-none transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:bg-ink/[0.06]';

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
        on ? 'border-accent bg-accent text-accent-contrast' : 'border-ink/20'
      }`}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function LayoutMenu({
  scope,
  at,
  onClose,
}: {
  scope: LayoutScope;
  at: Point;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const layout = useLayout(scope);
  const toggle = useToggleLayoutEntry(scope);
  const resetLayout = useSettingsStore((s) => s.resetLayout);
  const pristine = isDefaultLayout(layout, scope);
  const columns = layout.length > ONE_COLUMN_MAX ? 2 : 1;
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => DOMRect.fromRect({ x: at.x, y: at.y, width: 0, height: 0 }),
      },
    }),
    [at.x, at.y],
  );

  return (
    <Popover.Root open onOpenChange={(open) => !open && onClose()}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        <Popover.Content
          role="menu"
          data-ui="context-menu"
          data-menu="layout"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          className={`surface-pop z-[300] flex max-h-[var(--radix-popover-content-available-height)] select-none flex-col overflow-y-auto rounded-xl p-1.5 outline-none ${
            columns === 2 ? 'w-[432px]' : 'w-[216px]'
          }`}
        >
          <div
            className="grid grid-flow-col gap-x-1"
            style={{
              gridTemplateRows: `repeat(${Math.ceil(layout.length / columns)}, auto)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {layout.map((entry) => {
              const meta = itemMeta(scope, entry.id);
              const locked = isLocked(scope, entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitemcheckbox"
                  data-ui="menu-item"
                  aria-checked={!entry.hidden}
                  disabled={locked}
                  title={locked ? t('settings.layoutAlwaysVisible') : undefined}
                  onClick={() => toggle(entry.id)}
                  className={`${ITEM} disabled:cursor-default disabled:hover:bg-transparent`}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-ink-45">
                    {meta.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t(meta.label)}</span>
                  {locked ? (
                    <Lock size={13} className="size-4 shrink-0 p-px text-ink-30" aria-hidden />
                  ) : (
                    <CheckBox on={!entry.hidden} />
                  )}
                </button>
              );
            })}
          </div>
          <div role="separator" className="mx-2 my-1 h-px shrink-0 bg-ink/[0.08]" />
          <button
            type="button"
            role="menuitem"
            data-ui="menu-item"
            disabled={pristine}
            onClick={() => resetLayout(scope)}
            className={`${ITEM} shrink-0 disabled:cursor-default disabled:text-ink-30 disabled:hover:bg-transparent`}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              <RotateCcw size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate">{t('settings.layoutResetDefault')}</span>
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function useLayoutMenu(scope: LayoutScope): {
  onContextMenu: (event: MouseEvent) => void;
  menu: ReactNode;
} {
  const [at, setAt] = useState<Point | null>(null);
  return {
    onContextMenu: (event) => {
      event.preventDefault();
      setAt({ x: event.clientX, y: event.clientY });
    },
    menu: at && (
      <LayoutMenu key={`${at.x}:${at.y}`} scope={scope} at={at} onClose={() => setAt(null)} />
    ),
  };
}
