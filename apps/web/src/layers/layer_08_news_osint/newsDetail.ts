/** Formats an ISO timestamp to a locale string, or em dash if absent. */
export function formatNewsTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

/** Returns a display label for a severity value. */
export function formatNewsSeverity(severity: string | null | undefined): string {
  if (!severity) return '—';
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
}

/** Returns "Country Name (CODE)" or just the code or name if only one is present. */
export function formatNewsCountry(
  name: string | null | undefined,
  code: string | null | undefined
): string {
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return '—';
}

/** Returns a safe display string for a nullable value. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
