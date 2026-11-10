import type { MediaUsage } from '../../../lib/chat/media-types';
import { useChatStore } from '../../../stores/chat';
import { useChatMediaStore } from '../../../stores/chat/media';

export function syncUsed(used: number, quota: number, usage: MediaUsage | null) {
  const config = useChatStore.getState().config;
  if (config?.media && (config.media.used !== used || config.media.quota !== quota)) {
    useChatStore.getState().setConfig({ ...config, media: { ...config.media, used, quota } });
  }
  if (usage) {
    useChatMediaStore.setState({
      usage: { ...usage, bytes: Math.max(0, used - usage.reserved), quota },
      usageLoad: 'ready',
    });
  }
}
