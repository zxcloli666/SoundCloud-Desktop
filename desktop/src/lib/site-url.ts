const SITE = 'https://getsoundcloud.app';

export function siteUrl(page: string, language: string): string {
  return language.startsWith('ru') ? `${SITE}/${page}` : `${SITE}/en/${page}`;
}
