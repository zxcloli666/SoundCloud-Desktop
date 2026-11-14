export type VoiceGender = 'female' | 'male';

const VOICES = [
  { id: 'loli', gender: 'female', server: true },
  { id: 'moriarty', gender: 'male', server: true },
  { id: 'af_heart', gender: 'female', server: false },
  { id: 'am_michael', gender: 'male', server: false },
] as const satisfies { id: string; gender: VoiceGender; server: boolean }[];

export type VoiceId = (typeof VOICES)[number]['id'];

export const VOICE_IDS: VoiceId[] = VOICES.map((voice) => voice.id);

export const DEFAULT_VOICE: VoiceId = VOICES[0].id;

function declared(id: unknown) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}

export function knownVoice(id: unknown): VoiceId {
  return declared(id).id;
}

export function voiceGender(id: unknown): VoiceGender {
  return declared(id).gender;
}

export function hasServerVoice(id: unknown): boolean {
  return declared(id).server;
}
