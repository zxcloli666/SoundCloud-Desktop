import { useTranslation } from 'react-i18next';
import { AlertCircle, Search } from '../../../lib/icons';
import { toggleListening } from '../../../lib/voice/listen';
import { downloadMissing } from '../../../lib/voice/models';
import { micPrivacyUrl, openMicPrivacy } from '../../../lib/voice/privacy';
import type { VoiceErrorCode } from '../../../lib/voice/types';
import { StarCta } from '../../star-moments/StarCta';
import { CircleAlert, SearchX } from '../icons';
import { useOpenVoiceSettings, useSearchFor } from '../nav';
import { CloseX, IconTile, IslandAction, IslandText } from './parts';

export function NotFoundView({ heard, onClose }: { heard: string; onClose: () => void }) {
  const { t } = useTranslation();
  const searchFor = useSearchFor();
  return (
    <>
      <IconTile tone="muted">
        <SearchX size={17} />
      </IconTile>
      <IslandText title={t('voice.hud.notFound')} sub={t('voice.quote', { text: heard })} />
      <IslandAction
        primary
        onClick={() => {
          searchFor(heard);
          onClose();
        }}
      >
        <Search size={13} />
        {t('voice.hud.find')}
      </IslandAction>
      <CloseX onClick={onClose} label={t('common.close')} />
    </>
  );
}

export function FailedView({ display, onClose }: { display: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <IconTile tone="muted">
        <AlertCircle size={17} />
      </IconTile>
      <IslandText title={display} />
      <CloseX onClick={onClose} label={t('common.close')} />
    </>
  );
}

function FixAction({ code, onClose }: { code: VoiceErrorCode; onClose: () => void }) {
  const { t } = useTranslation();
  const openSettings = useOpenVoiceSettings();
  const settings = () => {
    openSettings();
    onClose();
  };
  if (code === 'not_star') return <StarCta size="sm" onOpen={onClose} />;
  if (code === 'mic_denied' && micPrivacyUrl()) {
    return (
      <IslandAction primary onClick={() => openMicPrivacy()}>
        {t('voice.fix.privacy')}
      </IslandAction>
    );
  }
  if (code === 'no_models' || code === 'model_corrupt') {
    return (
      <IslandAction
        primary
        onClick={() => {
          downloadMissing();
          onClose();
        }}
      >
        {t('voice.fix.download')}
      </IslandAction>
    );
  }
  if (code === 'mic_busy' || code === 'network' || code === 'asr_failed') {
    return (
      <IslandAction primary onClick={() => toggleListening('hud')}>
        {t('voice.fix.retry')}
      </IslandAction>
    );
  }
  const key =
    code === 'mic_lost' || code === 'mic_denied'
      ? 'pickMic'
      : code === 'tts_failed'
        ? 'pickVoice'
        : 'settings';
  return (
    <IslandAction primary onClick={settings}>
      {t(`voice.fix.${key}`)}
    </IslandAction>
  );
}

export function ErrorView({ code, onClose }: { code: VoiceErrorCode; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <IconTile tone="bad">
        <CircleAlert size={17} />
      </IconTile>
      <IslandText title={t(`voice.error.${code}`)} />
      <FixAction code={code} onClose={onClose} />
      <CloseX onClick={onClose} label={t('common.close')} />
    </>
  );
}
