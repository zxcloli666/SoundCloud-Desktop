import { useTranslation } from 'react-i18next';
import { answerLink } from '../../../lib/voice/remote';
import type { SpeakerProvider } from '../../../lib/voice/remote-types';
import { LinkHint } from '../settings/LinkHint';
import { ProviderGlyph } from '../settings/ProviderGlyph';
import { IslandAction, IslandText } from './parts';

export function LinkConfirmView({
  id,
  provider,
  hint,
}: {
  id: string;
  provider: SpeakerProvider;
  hint?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ProviderGlyph provider={provider} size={40} />
      <IslandText
        title={t(`voice.speakers.confirm.${provider}`)}
        sub={t(hint ? 'voice.speakers.confirmHint' : 'voice.speakers.confirmSub')}
      />
      {hint && <LinkHint hint={hint} />}
      <IslandAction onClick={() => answerLink(id, false)}>{t('voice.speakers.no')}</IslandAction>
      <IslandAction primary onClick={() => answerLink(id, true)}>
        {t('voice.speakers.yes')}
      </IslandAction>
    </>
  );
}
