import { useVoiceStore } from '../../lib/voice/store';
import { type VoiceGender, voiceGender } from '../../lib/voice/voice-ids';

export function useVoiceGender(): VoiceGender {
  return useVoiceStore((s) => voiceGender(s.config.speak.voice));
}
