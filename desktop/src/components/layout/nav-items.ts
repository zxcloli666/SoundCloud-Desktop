import type React from 'react';
import { Compass, Download, Home, Library, Search, Star } from '../../lib/icons';
import type { LayoutId } from '../../lib/layout';

export type IconCmp = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export const NAV_ITEMS: Record<
  LayoutId<'sidebar'>,
  { to: string; icon: IconCmp; label: string }
> = {
  home: { to: '/home', icon: Home, label: 'nav.home' },
  search: { to: '/search', icon: Search, label: 'nav.search' },
  discover: { to: '/discover', icon: Compass, label: 'nav.discover' },
  library: { to: '/library', icon: Library, label: 'nav.library' },
  star: { to: '/star', icon: Star, label: 'nav.star' },
  offline: { to: '/offline', icon: Download, label: 'nav.offline' },
};
