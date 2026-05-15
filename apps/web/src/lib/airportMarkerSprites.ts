// Helper to create a padded circle sprite
export const createMarkerCanvas = (size: number, color: string, glow: boolean = false): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const padding = glow ? 12 : 8; // Prevent clipping, generously padded
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = totalSize / 2;
  const radius = size / 2;

  if (glow) {
    const gradient = ctx.createRadialGradient(center, center, radius * 0.5, center, center, center);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
};

// Simple canvas caching to avoid recreating identical clusters
const canvasCache = new Map<number, HTMLCanvasElement>();

export const getClusterCanvas = (size: number): HTMLCanvasElement => {
  const finalSize = Math.floor(size);
  if (!canvasCache.has(finalSize)) {
    canvasCache.set(finalSize, createMarkerCanvas(finalSize, '#00d2ff', true));
  }
  return canvasCache.get(finalSize)!;
};

export const Icons = {
  largeAirport: createMarkerCanvas(12, '#00d2ff'),
  smallAirport: createMarkerCanvas(8, '#00d2ff'),
};
