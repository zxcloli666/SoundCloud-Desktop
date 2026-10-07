import type { TFunction } from 'i18next';
import type { OAuthFlowError } from '../../lib/use-oauth-flow';

export function oauthErrorText(error: OAuthFlowError, t: TFunction) {
  switch (error.kind) {
    case 'unreachable':
      return { title: t('auth.errorServerTitle'), desc: t('auth.errorServerDesc') };
    case 'limited':
      return {
        title: t('auth.errorLimitedTitle'),
        desc: t('auth.errorLimitedDesc', { seconds: error.retryAfterSec ?? 60 }),
      };
    case 'expired':
      return { title: t('auth.errorExpiredTitle'), desc: error.message };
    default:
      return { title: t('auth.errorFailedTitle'), desc: error.message };
  }
}
