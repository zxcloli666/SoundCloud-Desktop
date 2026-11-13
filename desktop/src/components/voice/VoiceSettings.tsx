import { useEffect } from 'react';
import { usePremium } from '../../lib/premium-cache';
import { initVoice } from '../../lib/voice';
import { modelsReady, useVoiceRuntime } from '../../lib/voice/runtime';
import { useVoiceStore } from '../../lib/voice/store';
import { refreshEngine } from '../../lib/voice/sync';
import { VOICE_KEYFRAMES } from './keyframes';
import { ActivationCard } from './settings/ActivationCard';
import { ChatCard } from './settings/ChatCard';
import { CreditsCard } from './settings/CreditsCard';
import { HeroCard } from './settings/HeroCard';
import { HistoryCard } from './settings/HistoryCard';
import { MicrophonesCard } from './settings/MicrophonesCard';
import { ModelsCard } from './settings/ModelsCard';
import { SpeakersCard } from './settings/SpeakersCard';
import { VoiceLocked } from './settings/VoiceLocked';
import { VoicePickerCard } from './settings/VoicePickerCard';

export function VoiceSettings() {
  const premium = usePremium();
  const enabled = useVoiceStore((s) => s.config.enabled);
  const ready = useVoiceRuntime((s) => s.models.length === 0 || modelsReady(s.models));

  useEffect(() => {
    initVoice();
    refreshEngine();
    useVoiceRuntime.setState({ settingsOpen: true });
    return () => useVoiceRuntime.setState({ settingsOpen: false });
  }, []);

  return (
    <>
      <style>{VOICE_KEYFRAMES}</style>
      {premium ? (
        <>
          <HeroCard />
          <ActivationCard />
          <MicrophonesCard />
          <VoicePickerCard />
          <ChatCard />
          <SpeakersCard />
          <ModelsCard />
          <HistoryCard canTalk={enabled && ready} />
          <CreditsCard />
        </>
      ) : (
        <VoiceLocked />
      )}
    </>
  );
}
