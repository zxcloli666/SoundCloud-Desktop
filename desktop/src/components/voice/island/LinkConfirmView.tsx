import { useTranslation } from 'react-i18next';
import { answerLink } from '../../../lib/voice/remote';
import type { SpeakerProvider } from '../../../lib/voice/remote-types';
import { ProviderGlyph } from '../settings/ProviderGlyph';
import { IslandAction, IslandText } from './parts';

export function LinkConfirmView({ id, provider }: { id: string; provider: SpeakerProvider }) {
  const { t } = useTranslation();
  return (
    <>
      <ProviderGlyph provider={provider} size={40} />
      <IslandText
        title={t(`voice.speakers.confirm.${provider}`)}
        sub={t('voice.speakers.confirmSub')}
      />
      <IslandAction onClick={() => answerLink(id, false)}>{t('voice.speakers.no')}</IslandAction>
      <IslandAction primary onClick={() => answerLink(id, true)}>
        {t('voice.speakers.yes')}
      </IslandAction>
    </>
  );
}
