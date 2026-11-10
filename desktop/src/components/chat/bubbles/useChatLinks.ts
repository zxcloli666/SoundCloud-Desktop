import { useCallback } from 'react';
import { findSoundCloudLink } from '../../../lib/soundcloudLink';
import { useRichLinks } from '../../ui/useRichLinks';
import { useOpenProfile } from '../profile';
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

  const openUser = useOpenProfile();

  return { openUrl, openUser };
}
