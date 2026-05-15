// Helper to create a padded circle sprite for individual airports
export const createMarkerCanvas = (size: number, color: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = totalSize / 2;
  const radius = size / 2;

  // Solid core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
};

export const createClusterCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const padding = 10;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = totalSize / 2;
  const radius = size / 2;

  // Outer glow
  const gradient = ctx.createRadialGradient(center, center, radius * 0.7, center, center, center);
  gradient.addColorStop(0, 'rgba(0, 210, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(0, 210, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  // Core background
  ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  // Core border
  ctx.strokeStyle = '#00d2ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
};

// Simple canvas caching to avoid recreating identical clusters
const canvasCache = new Map<number, HTMLCanvasElement>();

export const getClusterCanvas = (size: number): HTMLCanvasElement => {
  const finalSize = Math.floor(size);
  if (!canvasCache.has(finalSize)) {
    canvasCache.set(finalSize, createClusterCanvas(finalSize));
  }
  return canvasCache.get(finalSize)!;
};

export const Icons = {
  largeAirport: createMarkerCanvas(8, '#00d2ff'),
  smallAirport: createMarkerCanvas(5, '#00d2ff'),
};

