import React from 'react';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../lib/formatters';
import type { SCUser } from '../../lib/hooks';
import { User, Users } from '../../lib/icons';

export const UserCard = React.memo(({ user }: { user: SCUser }) => {
  const navigate = useNavigate();
  const avatar = art(user.avatar_url, 't300x300');

  return (
    <button
      type="button"
      className="sonveil-user-card"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
    >
      <span className="sonveil-user-card-art">
        {avatar ? (
          <img src={avatar} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="sonveil-art-fallback">
            <User size={28} />
          </span>
        )}
      </span>
      <span className="sonveil-user-card-copy">
        <b>{user.username}</b>
        <small>
          <Users size={10} />
          {fc(user.followers_count)}
        </small>
      </span>
    </button>
  );
});
