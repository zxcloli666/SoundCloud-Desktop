import { useShallow } from 'zustand/shallow';
import { useChatEmbedsStore } from '../../../stores/chat/embeds';
import { SharePicker } from './SharePicker';

export function SharePickerHost() {
  const { open, embed, close } = useChatEmbedsStore(
    useShallow((s) => ({ open: s.shareOpen, embed: s.shareEmbed, close: s.closeShare })),
  );
  return <SharePicker open={open} embed={embed} onClose={close} />;
}
