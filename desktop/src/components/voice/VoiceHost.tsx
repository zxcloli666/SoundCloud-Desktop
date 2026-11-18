import { useEffect } from 'react';
import { initVoice } from '../../lib/voice';
import { VOICE_KEYFRAMES } from './keyframes';
import { NavBridge } from './nav';
import { VoiceIsland } from './VoiceIsland';

export function VoiceHost() {
  useEffect(initVoice, []);

  return (
    <>
      <style>{VOICE_KEYFRAMES}</style>
      <NavBridge />
      <VoiceIsland />
    </>
  );
}
