import type { AuditReport } from './audit.js';
import { disclaimers, type Language } from './i18n.js';

const rules: Record<string, [string, string]> = {
  'secret-exposed': ['A possible secret or credential is embedded in code or configuration.', 'Move the value to a secret manager or environment variable, rotate the credential and remove it from the repository.'],
  'personal-data-signal': ['This line suggests personal data processing or exposure requiring a legal basis, transparency and minimization.', 'Document purposes, minimize fields, define retention and verify security measures and privacy notices.'],
  'sensitive-log': ['A log refers to sensitive data or credentials.', 'Avoid logging personal data or secrets; filter and mask values before logging.'],
  'insecure-http': ['An apparently non-local URL uses insecure HTTP.', 'Use HTTPS and verify secure transport for services and external dependencies.'],
  'permissive-cors': ['Permissive CORS settings may expose resources to unintended origins.', 'Define an explicit origin allowlist and review allowed methods, credentials and headers.'],
  'insecure-cookie': ['Cookie usage lacks sufficient indications of secure attributes.', 'Apply Secure, HttpOnly and SameSite where appropriate and document cookie usage.'],
  'sensitive-endpoint': ['A sensitive endpoint lacks a clear authentication or authorization signal on the same route.', 'Require authentication, authorization and access logging for administrative or sensitive endpoints.'],
  'docker-root-user': ['The container does not declare an unprivileged user and may run as root.', 'Set USER to an unprivileged account and verify minimum file and process permissions.'],
  'docker-floating-image': ['The Docker base image uses a floating or unpinned reference.', 'Pin the base image to a specific version or digest to reduce drift and supply chain risk.'],
  'docker-exposed-port': ['The container exposes a sensitive port that usually requires additional network controls.', 'Avoid exposing administrative or database ports; restrict them to private networks or authenticated proxies.'],
  'github-actions-secret-exposure': ['A GitHub Actions workflow appears to print a secret through a command.', 'Do not print secrets in run steps; use only necessary environment variables and mask values.'],
  'terraform-public-resource': ['Terraform declares broad public exposure or a publicly accessible resource.', 'Restrict CIDRs, disable public access by default and document exceptions with compensating controls.'],
  'terraform-missing-encryption': ['Terraform explicitly disables encryption at rest for an infrastructure resource.', 'Enable encryption at rest and manage keys with KMS or an equivalent service.'],
  'missing-privacy-docs': ['No visible privacy, data processing or retention documentation was detected.', 'Add privacy, retention, consent and incident documentation reflecting actual processing.'],
};

const controls: Record<string, [string, string]> = {
  'control-revision-fuentes': ['Review official sources and audit scope', 'Validate legal status, technical scope and evidence before concluding compliance or security.'],
  'control-secretos': ['Manage secrets outside the repository', 'Centralize credentials in environment variables or a secret manager, with documented rotation and revocation.'],
  'control-datos-personales': ['Inventory personal data processing', 'Document purposes, data categories, controllers, processors, legal bases and retention periods.'],
  'control-logs': ['Mask sensitive logs', 'Restrict traces containing personal data or credentials and define redaction and retention rules.'],
  'control-transporte': ['Enforce secure transport', 'Ensure HTTPS, validate certificates and remove insecure HTTP integrations in production.'],
  'control-cors': ['Restrict CORS', 'Explicitly define allowed origins and review credentials and exposed headers.'],
  'control-cookies': ['Secure cookies and sessions', 'Apply Secure, HttpOnly and SameSite and document cookie purposes and lifetimes.'],
  'control-endpoints': ['Protect sensitive endpoints', 'Apply authentication, authorization and monitoring to administrative, financial or personal data routes.'],
  'control-infraestructura': ['Strengthen infrastructure and CI/CD', 'Reduce public exposure, avoid privileged execution and protect secrets and encryption in infrastructure definitions.'],
  'control-documentacion': ['Maintain privacy documentation', 'Maintain notices, policies and procedures for privacy, retention, consent and incidents.'],
};

export function localizeAuditReport(report: AuditReport, language: Language): AuditReport {
  if (language === 'es') return report;
  const reference = (ref: AuditReport['references'][number]) => ({
    ...ref,
    rationale: ref.id === 'lopdp'
      ? 'General reference for privacy, security and transparency in personal data processing.'
      : ref.id === 'comercio-electronico'
        ? 'Reference for digital service controls, contracting and secure handling of data messages.'
        : ref.rationale,
  });
  return {
    ...report,
    findings: report.findings.map((finding) => ({
      ...finding,
      explanation: rules[finding.ruleId]?.[0] ?? finding.explanation,
      recommendation: rules[finding.ruleId]?.[1] ?? finding.recommendation,
      reference: reference(finding.reference),
    })),
    controls: report.controls.map((control) => ({
      ...control,
      title: controls[control.id]?.[0] ?? control.title,
      description: controls[control.id]?.[1] ?? control.description,
    })),
    references: report.references.map(reference),
    disclaimer: disclaimers.en,
  };
}

// Translate only authored template segments. Evidence, paths and legal text
// are interpolated separately and must never be rewritten by localization.
const labels: Record<string, string> = {
  'Estado de escaneres de dependencias': 'Dependency scanner status',
  'Advertencias de dependencias': 'Dependency warnings',
  'Hallazgos de dependencias': 'Dependency findings',
  'Hallazgos de auditoria': 'Audit findings',
  'Reporte de auditoria': 'Audit report',
  'Resumen ejecutivo': 'Executive summary',
  'Hallazgos totales': 'Total findings',
  'Archivos escaneados': 'Scanned files',
  'Directorios escaneados': 'Scanned directories',
  'Entradas omitidas': 'Skipped entries',
  'Checks omitidos': 'Skipped checks',
  'Sin hallazgos': 'No findings',
  'Sin referencias.': 'No references.',
  'Ninguno.': 'None.',
  'Generado': 'Generated', 'Riesgo': 'Risk', 'Advertencias': 'Warnings',
  'Escaner': 'Scanner', 'Estado': 'Status', 'Hallazgos': 'Findings',
  'Severidad': 'Severity', 'Regla': 'Rule', 'Archivo': 'File', 'Linea': 'Line',
  'Evidencia': 'Evidence', 'Paquete': 'Package', 'Fija en': 'Fixed in',
  'Controles': 'Controls', 'Categoria': 'Category', 'Referencias': 'References',
  'fuente': 'source', 'verificada': 'checked',
};

const labelPattern = new RegExp(Object.keys(labels).join('|'), 'g');
export function reportTemplate(language: Language = 'es') {
  return (parts: TemplateStringsArray, ...values: unknown[]): string => parts.reduce(
    (result, part, index) => result + (language === 'en' ? part.replace(labelPattern, (match) => labels[match]) : part)
      + (index < values.length ? String(values[index]) : ''), '',
  );
}
