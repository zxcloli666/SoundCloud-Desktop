import React from 'react';
import {useNavigate} from 'react-router-dom';

/** Inline list of clickable artist names (feat. / remix / prod. rows). */
export const ArtistLinks = React.memo(function ArtistLinks({
                                                               artists,
                                                           }: {
    artists: { id: string; name: string }[];
}) {
    const navigate = useNavigate();
    return (
        <>
            {artists.map((a, i) => (
                <React.Fragment key={a.id || a.name}>
                    {i > 0 && ', '}
                    <span
                        className={
                            a.id
                                ? 'text-ink-55 hover:text-ink-85 cursor-pointer transition-colors'
                                : undefined
                        }
                        onClick={a.id ? () => navigate(`/artist/${encodeURIComponent(a.id)}`) : undefined}
                    >
            {a.name}
          </span>
                </React.Fragment>
            ))}
        </>
    );
});
