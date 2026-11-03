import { useEffect } from 'react';
import { usePremium } from '../../lib/premium-cache';
import { initVoice } from '../../lib/voice';
import { syncRemote } from '../../lib/voice/remote';
import { useVoiceStore } from '../../lib/voice/store';
import { VOICE_KEYFRAMES } from './keyframes';
import { VoiceIsland } from './VoiceIsland';

export function VoiceHost() {
  const premium = usePremium();
  const enabled = useVoiceStore((s) => s.config.enabled);

  useEffect(initVoice, []);

  useEffect(() => {
    syncRemote(premium && enabled);
    return () => syncRemote(false);
  }, [premium, enabled]);

  return (
    <>
      <style>{VOICE_KEYFRAMES}</style>
      <VoiceIsland />
    </>
  );
}
