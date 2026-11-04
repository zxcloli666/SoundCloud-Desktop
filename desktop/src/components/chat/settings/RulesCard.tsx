import { useTranslation } from 'react-i18next';
import { Shield } from '../../../lib/icons';
import { Card } from '../../settings/primitives';
import { ForbiddenGrid, PolicyLadder, PrivacyNote } from './ModerationPolicy';

export function RulesCard() {
  const { t } = useTranslation();
  return (
    <Card title={t('chat.settings.policy.title')} icon={<Shield size={17} />}>
      <div className="flex flex-col gap-4">
        <ForbiddenGrid />
        <PolicyLadder />
        <div className="h-px bg-ink/[0.05]" />
        <PrivacyNote />
      </div>
    </Card>
  );
}
