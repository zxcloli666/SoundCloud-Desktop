import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../../../lib/formatters';
import type { SCUser } from '../../../../lib/hooks';
import { ShelfCard } from './ShelfCard';
import { ShelfScroll } from './ShelfScroll';

export function ArtistPanel({ users, onEnd }: { users: SCUser[]; onEnd?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ShelfScroll
      items={users}
      keyOf={(user) => user.urn}
      onEnd={onEnd}
      renderItem={(user) => (
        <ShelfCard
          scrollKey={user.urn}
          round
          cover={art(user.avatar_url, 't300x300')}
          title={user.username}
          subtitle={t('flowRedesign.followers', { count: fc(user.followers_count) })}
          coverLabel={user.username}
          onOpen={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
        />
      )}
    />
  );
}
