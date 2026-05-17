import type { AviationDisplayCategory } from './aviationCategories';

const PAD = 0;
const STROKE_W = 0;

function createCircleCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const totalSize = size + PAD * 2;
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
  if (STROKE_W > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = STROKE_W;
    ctx.stroke();
  }
  return canvas;
}

function createSquareCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const totalSize = size + PAD * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const half = size / 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  ctx.fillStyle = color;
  ctx.fillRect(cx - half, cy - half, size, size);
  if (STROKE_W > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = STROKE_W;
    ctx.strokeRect(cx - half, cy - half, size, size);
  }
  return canvas;
}

function createDiamondCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const totalSize = size + PAD * 2;
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
  if (STROKE_W > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = STROKE_W;
    ctx.stroke();
  }
  return canvas;
}

function createClosedCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const totalSize = size + PAD * 2;
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
  ctx.strokeStyle = 'rgba(255,77,77,0.5)';
  ctx.lineWidth = 1;
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
  const totalSize = size + PAD * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const center = totalSize / 2;
  const radius = size / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
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

const CATEGORY_DOT_COLORS: Record<AviationDisplayCategory, string> = {
  major: '#00E5FF',
  regional: '#00B2FF',
  local: '#7DEBFF',
  heliport: '#FFB000',
  seaplane: '#00FFD1',
  balloonport: '#C084FC',
  unknown: '#B8F7FF',
  closed: '#6B7280',
};

export function getCategoryDotColor(cat: AviationDisplayCategory): string {
  return CATEGORY_DOT_COLORS[cat] || '#888';
}

export function getAirportSprite(displayCat: AviationDisplayCategory): HTMLCanvasElement {
  return CategoryIcons[displayCat] || CategoryIcons.unknown;
}

export const createMarkerCanvas = (size: number, color: string): HTMLCanvasElement => {
  return createCircleCanvas(size, color);
};
