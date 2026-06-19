// Pure type / date / number conversion helpers shared across API mappers.
//
// Behavior is preserved exactly from the previous local duplicates in:
//   - apps/api/src/routes/weather/mapper.ts
//   - apps/api/src/routes/maritime/mapper.ts
//   - apps/api/src/routes/news/mapper.ts
//   - apps/api/src/routes/energy/infrastructure/mapper.ts
//   - apps/api/src/routes/aviation-aircraft.ts
//   - apps/api/src/routes/earth-events.ts
//
// These helpers are pure conversions only. They do not throw, do not call
// any I/O, and do not consult request validation context. They are
// behavior-preserving replacements for the local `function toIsoString`,
// `function toIsoStringOrNull`, `function toNumber`, `function toNumberOrNull`,
// `function toInteger`, and `function toIntegerOrNull` definitions that
// existed in those mapper / route files before WO-3-1.
//
// Out of scope (intentionally not centralized here):
//   - `parseBbox` / `parseBBox` / `parseLimit` / `parseOffset` /
//     `isValidIsoDatetime` (request validation; deferred to WO-3-2).
//   - `validateCategory` / `validateMode` (request validation; out of scope).
//   - `toDate(value: Date | string | null): string | null` in
//     airport-intelligence/service.ts and public-profile/repository.ts:
//     typed signature, `!value` falsy check, no String() fallback —
//     different behavior from `toIsoStringOrNull` above; not safe to merge
//     without a behavior change. Left local in those two files.
//   - `toNumber(value: unknown): number | null` in airport-intelligence/service.ts:
//     returns null for null/undefined (different fallback than `toNumber`
//     above). Left local to preserve behavior.

export function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

export function toIsoStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

export function toInteger(value: unknown): number {
  return Math.round(toNumber(value));
}

export function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  return n === null ? null : Math.round(n);
}
