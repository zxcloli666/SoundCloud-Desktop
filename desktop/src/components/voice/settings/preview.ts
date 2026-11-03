import { voiceIpc } from '../../../lib/voice/ipc';
import { useVoiceRuntime } from '../../../lib/voice/runtime';

const PREVIEW_MAX_MS = 6000;

let timer: ReturnType<typeof setTimeout> | null = null;

export function playPreview(id: string) {
  const runtime = useVoiceRuntime.getState();
  if (timer) clearTimeout(timer);
  if (runtime.previewing === id) {
    useVoiceRuntime.setState({ previewing: null });
    void voiceIpc.cancel().catch(() => {});
    return;
  }
  useVoiceRuntime.setState({ previewing: id });
  timer = setTimeout(() => useVoiceRuntime.setState({ previewing: null }), PREVIEW_MAX_MS);
  voiceIpc.preview(id).catch(() => useVoiceRuntime.setState({ previewing: null }));
}
