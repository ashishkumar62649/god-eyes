import type { MaritimeVesselObject } from '@god-eyes/contracts';

export const VESSEL_TYPE_COLORS: Record<string, string> = {
  cargo: '#3b82f6',
  tanker: '#f97316',
  passenger: '#a855f7',
  fishing: '#22c55e',
  tug: '#eab308',
  military: '#ef4444',
  pleasure: '#06b6d4',
  sailing: '#06b6d4',
  'high speed craft': '#00e5ff',
  unknown: '#9ca3af',
};

export function getVesselColor(vesselType: string | null): string {
  if (!vesselType) return VESSEL_TYPE_COLORS.unknown;
  const lower = vesselType.toLowerCase();

  if (lower.includes('cargo')) return VESSEL_TYPE_COLORS.cargo;
  if (lower.includes('tanker')) return VESSEL_TYPE_COLORS.tanker;
  if (lower.includes('passenger') || lower.includes('ferry')) return VESSEL_TYPE_COLORS.passenger;
  if (lower.includes('fish')) return VESSEL_TYPE_COLORS.fishing;
  if (lower.includes('tug') || lower.includes('towing') || lower.includes('shifter')) return VESSEL_TYPE_COLORS.tug;
  if (lower.includes('mil') || lower.includes('navy') || lower.includes('patrol') || lower.includes('warship')) return VESSEL_TYPE_COLORS.military;
  if (lower.includes('pleasure') || lower.includes('yacht')) return VESSEL_TYPE_COLORS.pleasure;
  if (lower.includes('sail')) return VESSEL_TYPE_COLORS.sailing;
  if (lower.includes('high speed') || lower.includes('hsc')) return VESSEL_TYPE_COLORS['high speed craft'];

  return VESSEL_TYPE_COLORS.unknown;
}

export function isVesselStale(vessel: MaritimeVesselObject): boolean {
  if (vessel.dataAgeSeconds !== null && vessel.dataAgeSeconds !== undefined) {
    return vessel.dataAgeSeconds > 3600;
  }
  const receivedMs = new Date(vessel.receivedAt).getTime();
  if (isNaN(receivedMs)) return false;
  return Date.now() - receivedMs > 3600 * 1000;
}

export function getVesselHeading(vessel: MaritimeVesselObject): number | null {
  if (typeof vessel.trueHeading === 'number' && !isNaN(vessel.trueHeading)) {
    return vessel.trueHeading;
  }
  if (typeof vessel.courseOverGround === 'number' && !isNaN(vessel.courseOverGround)) {
    return vessel.courseOverGround;
  }
  return null;
}

// Simple in-memory cache for data URLs to avoid DOM thrashing
const spriteCache = new Map<string, string>();

function drawDirectionalVessel(color: string): string {
  const cacheKey = `dir-${color}`;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    // Draw a sleek ship arrowhead pointing UP (North)
    ctx.beginPath();
    ctx.moveTo(8, 2);   // bow
    ctx.lineTo(13, 10);  // starboard bow
    ctx.lineTo(11, 14);  // starboard stern
    ctx.lineTo(5, 14);   // port stern
    ctx.lineTo(3, 10);   // port bow
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const url = canvas.toDataURL();
  spriteCache.set(cacheKey, url);
  return url;
}

function drawDotVessel(color: string): string {
  const cacheKey = `dot-${color}`;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(8, 8, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const url = canvas.toDataURL();
  spriteCache.set(cacheKey, url);
  return url;
}

export function getVesselMarkerImage(vessel: MaritimeVesselObject): string {
  const color = getVesselColor(vessel.vesselType);
  const heading = getVesselHeading(vessel);
  if (heading !== null) {
    return drawDirectionalVessel(color);
  }
  return drawDotVessel(color);
}

// Scale for ship billboards: 16px source -> ~11px on screen
export const VESSEL_BILLBOARD_SCALE = 0.70;
