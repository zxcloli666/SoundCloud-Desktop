import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api-client';
import { resolveLink } from '../../lib/search';
import { findSoundCloudLink, linkRoute } from '../../lib/soundcloudLink';

function isMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

async function resolvedRoute(url: string): Promise<string | null> {
  const entity = await resolveLink(url);
  return linkRoute(entity.urn);
}

export function useRichLinks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  const openMention = useCallback(
    async (permalink: string) => {
      const name = `@${permalink}`;
      setPending(name);
      let route: string | null = null;
      let missing = true;
      try {
        route = await resolvedRoute(`https://soundcloud.com/${permalink}`);
      } catch (error) {
        missing = isMissing(error);
      } finally {
        setPending(null);
      }
      if (route) return navigate(route);
      if (missing) {
        toast.error(t('richText.mentionNotFound', { name }), {
          description: t('richText.mentionNotFoundBody'),
        });
      } else {
        toast.error(t('search.link.unreachableTitle'), {
          description: t('search.link.unreachableBody'),
        });
      }
    },
    [navigate, t],
  );

  const openLink = useCallback(
    async (href: string) => {
      const link = findSoundCloudLink(href);
      if (link?.kind === 'urn') {
        const route = linkRoute(link.urn);
        if (route) return navigate(route);
      }
      if (link?.kind === 'url') {
        setPending(href);
        const route = await resolvedRoute(link.url).catch(() => null);
        setPending(null);
        if (route) return navigate(route);
      }
      await openUrl(href).catch(() => {});
    },
    [navigate],
  );

  return { pending, openMention, openLink };
}
