import type { LegalSource } from './domain.js';
import { disclaimers, localized, type Language } from './i18n.js';

export function consultObligations(source: LegalSource, language: Language) {
  const obligations = (source.obligations ?? []).map(item => ({
    id: item.id, article: item.article, sourceUrl: item.sourceUrl,
    requirement: item.requirement[language], appliesWhen: item.appliesWhen[language],
    evidence: item.evidence.map(text => text[language]), documentaryReviewedAt: item.documentaryReviewedAt,
  }));
  return {
    source, language, obligations, coverage: obligations.length ? 'parcial' : 'pendiente',
    warning: localized(language,
      'Selección documental no exhaustiva. Confirme vigencia, reformas y aplicación al caso antes de concluir una obligación legal.',
      'Non-exhaustive documentary selection. Confirm legal status, amendments and applicability before concluding a legal obligation.'),
    disclaimer: disclaimers[language],
  };
}
export function legalVerification(source: LegalSource, language: Language) {
  return {
    id: source.id, title: source.title, status: source.status, verifiedAt: source.verifiedAt,
    url: source.url, language, verification: source.verification ?? {},
    legalStatusConfirmed: Boolean(source.verification?.legalReviewedAt && source.verification?.reviewer),
    history: source.history ?? [], relatedSourceIds: source.relatedSourceIds ?? [],
    warning: localized(language, 'Consulta del registro local; no verifica vigencia en tiempo real.', 'Local catalog lookup; does not verify legal status in real time.'),
    disclaimer: disclaimers[language],
  };
}
