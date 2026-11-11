export const VOICE_IDS = ['loli', 'moriarty', 'af_heart', 'am_michael'] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export const DEFAULT_VOICE: VoiceId = 'loli';

export function knownVoice(id: unknown): VoiceId {
  return VOICE_IDS.find((known) => known === id) ?? DEFAULT_VOICE;
}
