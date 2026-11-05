import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { findSoundCloudLink, linkRoute } from '../../../lib/soundcloudLink';
import { useRichLinks } from '../../ui/useRichLinks';
import { useThread } from '../thread/context';
import { useThreadDialogs } from '../thread/dialogs';

function onSoundCloud(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'soundcloud.com' || host.endsWith('.soundcloud.com');
  } catch {
    return false;
  }
}

export function useChatLinks() {
  const navigate = useNavigate();
  const { openLink } = useRichLinks();
  const { conversation } = useThread();

  const openUrl = useCallback(
    (url: string) => {
      if (onSoundCloud(url) && findSoundCloudLink(url)) {
        void openLink(url);
        return;
      }
      useThreadDialogs.getState().open({ kind: 'link', conversationId: conversation.id, url });
    },
    [openLink, conversation.id],
  );

  const openUser = useCallback(
    (userId: string) => {
      const route = linkRoute(`soundcloud:users:${userId}`);
      if (route) navigate(route);
    },
    [navigate],
  );

  return { openUrl, openUser };
}
