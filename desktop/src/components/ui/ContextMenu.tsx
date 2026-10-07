import * as Popover from '@radix-ui/react-popover';
import React, { useMemo, useRef } from 'react';
import { Check } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import {
  type ContextMenuEntry,
  type ContextMenuItem,
  useContextMenuStore,
} from '../../stores/context-menu';

const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

function nextIndex(key: string, current: number, count: number) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowDown' ? 1 : -1;
  if (current < 0) return step > 0 ? 0 : count - 1;
  return (current + step + count) % count;
}

function moveFocus(container: HTMLElement, key: string) {
  const items = Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  items[nextIndex(key, current, items.length)].focus();
}

const MenuItem = React.memo(({ item, onDone }: { item: ContextMenuItem; onDone: () => void }) => (
  <button
    type="button"
    role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked={item.checked}
    disabled={item.disabled}
    onPointerMove={(e) => {
      if (!item.disabled) e.currentTarget.focus({ preventScroll: true });
    }}
    onClick={() => {
      onDone();
      item.onSelect();
    }}
    className="group/ctx flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-left text-[12.5px] font-medium text-white/70 outline-none transition-colors duration-100 focus:bg-white/[0.07] focus:text-white/95 disabled:cursor-default disabled:text-white/25"
  >
    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-white/40 transition-colors group-focus/ctx:text-white/75 group-disabled/ctx:text-white/20">
      {item.icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{item.label}</span>
    {item.checked && <Check size={13} className="shrink-0 text-accent" />}
    {item.hint && (
      <span className="ml-3 shrink-0 font-mono text-[10.5px] tracking-wide text-white/25">
        {item.hint}
      </span>
    )}
  </button>
));

const Separator = () => <div role="separator" className="mx-2 my-1 h-px bg-white/[0.06]" />;

function MenuEntries({ entries, onDone }: { entries: ContextMenuEntry[]; onDone: () => void }) {
  return entries.map((entry, index) =>
    entry === 'separator' ? (
      <Separator key={`sep-${index}`} />
    ) : (
      <MenuItem key={entry.id} item={entry} onDone={onDone} />
    ),
  );
}

export const ContextMenuHost = React.memo(() => {
  const menu = useContextMenuStore((s) => s.menu);
  const close = useContextMenuStore((s) => s.close);
  const blur = usePerfMode().blur(28);
  const contentRef = useRef<HTMLDivElement>(null);

  const anchor = useMemo(() => {
    const x = menu?.x ?? 0;
    const y = menu?.y ?? 0;
    return {
      current: { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) },
    };
  }, [menu?.x, menu?.y]);

  return (
    <Popover.Root open={menu !== null} onOpenChange={(open) => !open && close()}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        {menu && (
          <Popover.Content
            key={`${menu.x}:${menu.y}`}
            ref={contentRef}
            role="menu"
            tabIndex={-1}
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={10}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              contentRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onPointerLeave={() => contentRef.current?.focus({ preventScroll: true })}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                moveFocus(e.currentTarget, e.key);
              }
            }}
            className="ctx-menu z-[300] min-w-[232px] max-w-[300px] select-none rounded-[14px] p-1.5 outline-none"
            style={{
              background: blur > 0 ? 'rgba(18,18,22,0.86)' : 'rgb(20,20,24)',
              backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
              WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {menu.header && (
              <>
                {menu.header}
                <Separator />
              </>
            )}
            <MenuEntries entries={menu.entries} onDone={close} />
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
});
