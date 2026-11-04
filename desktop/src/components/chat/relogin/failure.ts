import type { TFunction } from 'i18next';
import type { OAuthFlowError } from '../../../lib/use-oauth-flow';

export function reloginFailure(error: OAuthFlowError, t: TFunction) {
  switch (error.kind) {
    case 'unreachable':
      return {
        title: t('chat.relogin.errors.unreachable'),
        desc: t('chat.relogin.errors.unreachableDesc'),
      };
    case 'limited':
      return {
        title: t('chat.relogin.errors.limited'),
        desc: t('chat.relogin.errors.limitedDesc', { seconds: error.retryAfterSec ?? 60 }),
      };
    case 'expired':
      return { title: t('chat.relogin.errors.expired'), desc: error.message };
    default:
      return { title: t('chat.relogin.errors.failed'), desc: error.message };
  }
}
