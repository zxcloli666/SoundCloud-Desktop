import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../lib/icons';
import { userUrn } from '../../lib/ids';
import { linkRoute } from '../../lib/soundcloudLink';
import type { ContextMenuEntry } from '../../stores/context-menu';

export type OpenProfile = (userId: string) => void;

export function profileRoute(userId: string): string | null {
  const urn = userUrn(userId);
  return urn ? linkRoute(urn) : null;
}

export function useOpenProfile(): OpenProfile {
  const navigate = useNavigate();
  return useCallback(
    (userId: string) => {
      const route = profileRoute(userId);
      if (route) navigate(route);
    },
    [navigate],
  );
}

export function profileEntry(userId: string, t: TFunction, open: OpenProfile): ContextMenuEntry {
  return {
    id: 'profile',
    label: t('chat.thread.actions.profile'),
    icon: <User size={14} />,
    onSelect: () => open(userId),
  };
}
