import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export type InferredProjectProfile = {
  signals: Array<{ key: string; detected: boolean; evidence: string[]; confidence: 'alta' | 'media' | 'baja' }>;
  suggestions: { processesPersonalData: boolean; usesProviders: boolean; sellsOnline: boolean; storesSensitiveData: boolean; handlesPayments: boolean; issuesInvoices: boolean; internationalTransfers: boolean; hasEmployees: boolean; hasMinors: boolean };
  disclaimer: string;
};

const files = new Set<string>();
async function collect(root: string, dir = root, depth = 0): Promise<void> {
  if (depth > 4) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(root, path, depth + 1);
    else files.add(relative(root, path).replaceAll('\\', '/'));
  }
}

export async function inferProjectProfile(root: string): Promise<InferredProjectProfile> {
  files.clear();
  await collect(root);
  const evidence: Record<string, string[]> = {};
  const add = (key: string, value: string) => (evidence[key] ??= []).push(value);
  let packageText = '';
  try { packageText = await readFile(join(root, 'package.json'), 'utf8'); } catch { /* non-Node repositories are valid */ }
  const text = `${packageText} ${[...files].filter(file => /\.(ts|tsx|js|jsx|py|java|cs|go|md|json)$/i.test(file)).slice(0, 250).join(' ')}`.toLowerCase();
  if (/supabase|firebase|aws|azure|gcp|stripe|paypal|mercadopago|sendgrid|twilio/.test(text)) add('usesProviders', 'Dependencias o archivos de proveedor detectados');
  if (/auth|login|user|usuario|email|correo|profile|perfil|personal.?data|datos.?personales/.test(text)) add('processesPersonalData', 'Autenticación o referencias a identidad detectadas');
  if (/payment|checkout|stripe|paypal|mercadopago|pago|carrito|cart/.test(text)) add('handlesPayments', 'Pagos o checkout detectados');
  if (/invoice|factura|sri|ruc|comprobante|tribut/.test(text)) add('issuesInvoices', 'Facturación o referencias tributarias detectadas');
  if (/shop|store|tienda|ecommerce|e-commerce|venta|producto|order|pedido/.test(text)) add('sellsOnline', 'Señales de comercio electrónico detectadas');
  if (/health|medical|salud|biometric|biometr|sensitive|sensible/.test(text)) add('storesSensitiveData', 'Datos sensibles o de salud detectados');
  if (/minor|menor|child|niño|school|escuela|student|estudiante/.test(text)) add('hasMinors', 'Referencias a menores o estudiantes detectadas');
  const signals = Object.entries(evidence).map(([key, items]) => ({ key, detected: true, evidence: items, confidence: items.length > 1 ? 'alta' as const : 'media' as const }));
  const suggestions = { processesPersonalData: Boolean(evidence.processesPersonalData), usesProviders: Boolean(evidence.usesProviders), sellsOnline: Boolean(evidence.sellsOnline), storesSensitiveData: Boolean(evidence.storesSensitiveData), handlesPayments: Boolean(evidence.handlesPayments), issuesInvoices: Boolean(evidence.issuesInvoices), internationalTransfers: Boolean(evidence.usesProviders), hasEmployees: false, hasMinors: Boolean(evidence.hasMinors) };
  return { signals, suggestions, disclaimer: 'Inferencias técnicas orientativas; confirme o corrija el perfil antes de usarlo como base de cumplimiento.' };
}
