import type { AviationDisplayCategory } from './aviationCategories';

function createCircleCanvas(size: number, color: string, stroke?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const center = totalSize / 2;
  const radius = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke || 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return canvas;
}

function createSquareCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const half = size / 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  ctx.fillStyle = color;
  ctx.fillRect(cx - half, cy - half, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - half, cy - half, size, size);
  return canvas;
}

function createDiamondCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const center = totalSize / 2;
  const s = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(center, center - s);
  ctx.lineTo(center + s, center);
  ctx.lineTo(center, center + s);
  ctx.lineTo(center - s, center);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return canvas;
}

function createClosedCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const center = totalSize / 2;
  const radius = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,77,77,0.7)';
  ctx.lineWidth = 1.5;
  const off = size * 0.32;
  ctx.beginPath();
  ctx.moveTo(center - off, center - off);
  ctx.lineTo(center + off, center + off);
  ctx.moveTo(center + off, center - off);
  ctx.lineTo(center - off, center + off);
  ctx.stroke();
  return canvas;
}

function createOutlineCircleCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const center = totalSize / 2;
  const radius = size / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
}

export const CategoryIcons: Record<AviationDisplayCategory, HTMLCanvasElement> = {
  major: createCircleCanvas(10, '#00E5FF'),
  regional: createCircleCanvas(8, '#00B2FF'),
  local: createCircleCanvas(6, '#7DEBFF'),
  heliport: createSquareCanvas(8, '#FFB000'),
  seaplane: createDiamondCanvas(8, '#00FFD1'),
  balloonport: createDiamondCanvas(7, '#C084FC'),
  unknown: createOutlineCircleCanvas(6, '#B8F7FF'),
  closed: createClosedCanvas(6, '#6B7280'),
};

export function getAirportSprite(displayCat: AviationDisplayCategory): HTMLCanvasElement {
  return CategoryIcons[displayCat] || CategoryIcons.unknown;
}

export const createMarkerCanvas = (size: number, color: string): HTMLCanvasElement => {
  return createCircleCanvas(size, color);
};
