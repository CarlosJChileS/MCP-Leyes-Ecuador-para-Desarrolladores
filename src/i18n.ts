export type Language = 'es' | 'en';

export function normalizeLanguage(value: unknown): Language {
  return typeof value === 'string' && value.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function localized(language: Language, spanish: string, english: string) {
  return language === 'en' ? english : spanish;
}

export const disclaimers = {
  es: 'Orientación preliminar; no constituye dictamen ni certificación jurídica. Verifique siempre la fuente oficial.',
  en: 'Preliminary guidance; this is not a legal opinion or certification. Always verify the official source.',
} satisfies Record<Language, string>;
