import { useTranslation } from 'react-i18next';
import { MessageCircle } from '../../../lib/chat/icons';
import type { ChatSettings, DmPolicy, SettingsPatch } from '../../../lib/chat/types';
import { Card, Segmented } from '../../settings/primitives';

const POLICIES: DmPolicy[] = ['everyone', 'following', 'nobody'];

interface WhoCanWriteCardProps {
  settings: ChatSettings;
  onPatch: (patch: SettingsPatch) => void;
}

export function WhoCanWriteCard({ settings, onPatch }: WhoCanWriteCardProps) {
  const { t } = useTranslation();
  return (
    <Card title={t('chat.settings.whoCanWrite.title')} icon={<MessageCircle size={17} />}>
      <Segmented
        value={settings.dmPolicy}
        options={POLICIES.map((id) => ({ id, label: t(`chat.settings.whoCanWrite.${id}`) }))}
        onChange={(dmPolicy) => onPatch({ dmPolicy })}
      />
      <p className="mt-3 text-[11.5px] leading-snug text-ink-40">
        {t(`chat.settings.whoCanWrite.hint.${settings.dmPolicy}`)}
      </p>
    </Card>
  );
}
