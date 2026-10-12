/**
 * Replaces each secret with [REDACTED] in its raw, JSON-escaped and XML-escaped forms,
 * so the same value is removed from plain text, JSON and XML reports.
 */
export function scrubSecrets(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const variants = new Set([
      secret,
      JSON.stringify(secret).slice(1, -1),
      secret
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;'),
    ]);
    for (const variant of variants) result = result.split(variant).join('[REDACTED]');
  }
  return result;
}
