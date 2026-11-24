import type React from 'react';
import { useSyncExternalStore } from 'react';
import { useSettingsStore } from '../../stores/settings';

export const ROW =
  'nav-row group relative w-full flex items-center h-9 rounded-lg transition-colors duration-150';
const LABEL_T = 'max-width 320ms cubic-bezier(0.2,0.8,0.2,1), opacity 240ms ease';

export function sidebarWidth(collapsed: boolean): number {
  return collapsed ? 56 : 196;
}

const NARROW = '(max-width: 899px)';

function watchNarrow(notify: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

export function useNarrowWindow(): boolean {
  return useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches);
}

export function useSidebarCollapsed(): boolean {
  const stored = useSettingsStore((s) => s.sidebarCollapsed);
  return useNarrowWindow() || stored;
}

export function Label({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}
      style={{
        maxWidth: collapsed ? 0 : '142px',
        paddingRight: collapsed ? 0 : undefined,
        opacity: collapsed ? 0 : 1,
        transition: LABEL_T,
      }}
    >
      {children}
    </span>
  );
}

export function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="w-10 shrink-0 flex items-center justify-center">{children}</span>;
}
