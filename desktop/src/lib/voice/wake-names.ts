type Names = Record<string, string[]>;

const COMMON: Record<string, string> = { ru: 'Саунд', en: 'Sound' };

const BY_VOICE: Record<string, Names> = {
  loli: { ru: ['Лоля'], en: ['Loli'] },
  moriarty: { ru: ['Мори', 'Мориарти'], en: ['Mori', 'Moriarty'] },
};

export function wakeNames(language: string, voice: string): string[] {
  const common = COMMON[language] ?? COMMON.en;
  const own = BY_VOICE[voice]?.[language] ?? [];
  return [common, ...own];
}
