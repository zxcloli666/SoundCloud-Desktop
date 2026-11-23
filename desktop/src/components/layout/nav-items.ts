import type React from 'react';
import { MessagesSquare } from '../../lib/chat/icons';
import { Compass, Download, GalleryVerticalEnd, Home, Library, Search } from '../../lib/icons';
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
  moments: { to: '/moments', icon: GalleryVerticalEnd, label: 'nav.moments' },
  search: { to: '/search', icon: Search, label: 'nav.search' },
  discover: { to: '/discover', icon: Compass, label: 'nav.discover' },
  library: { to: '/library', icon: Library, label: 'nav.library' },
  chats: { to: '/chats', icon: MessagesSquare, label: 'chat.nav.title' },
  offline: { to: '/offline', icon: Download, label: 'nav.offline' },
};
