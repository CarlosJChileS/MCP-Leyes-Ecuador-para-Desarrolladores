/** Best-effort redaction for all evidence paths, not just secret findings. */
export function redactSensitiveText(text: string): string {
  return text
    .replace(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )?PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk_(?:live|test)_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]')
    .replace(/(https?:\/\/)[^\s/]+@/gi, '$1[REDACTED]@')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret|email|correo|cedula|dni|telefono|phone)\b["']?\s*[:=]\s*)(["'`])[^\r\n]*?\2/gi, '$1$2[REDACTED]$2')
    .replace(/(\b(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*)[^\s"'`,;&)]+/gi, '$1[REDACTED]');
}
