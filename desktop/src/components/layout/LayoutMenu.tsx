import * as Popover from '@radix-ui/react-popover';
import { type MouseEvent, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../lib/icons';
import type { LayoutScope } from '../../lib/layout';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';
import { itemMeta } from '../settings/cards/layout-items';

interface Point {
  x: number;
  y: number;
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
          className="surface-pop z-[300] w-[216px] select-none rounded-xl p-1.5 outline-none"
        >
          {layout.map((entry) => {
            const meta = itemMeta(scope, entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitemcheckbox"
                data-ui="menu-item"
                aria-checked={!entry.hidden}
                onClick={() => toggle(entry.id)}
                className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-[12.5px] font-medium text-ink-70 outline-none transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:bg-ink/[0.06]"
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-ink-45">
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{t(meta.label)}</span>
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    entry.hidden ? 'border-ink/20' : 'border-accent bg-accent text-accent-contrast'
                  }`}
                >
                  {!entry.hidden && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
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
