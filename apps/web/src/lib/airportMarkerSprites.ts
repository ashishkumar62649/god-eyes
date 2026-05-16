import { AviationDisplayCategory } from './aviationCategories';

const MARKER_SIZE = 8;
const CLOSED_SIZE = 6;

function createCircleCanvas(size: number, color: string): HTMLCanvasElement {
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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
}

function createRoundedSquareCanvas(size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const padding = 4;
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = totalSize / 2;
  const s = size / 2;
  const r = size / 5;

  ctx.fillStyle = color;
  const x = center - s;
  const y = center - s;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
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

  ctx.strokeStyle = 'rgba(255, 77, 77, 0.7)';
  ctx.lineWidth = 1.5;
  const off = size * 0.3;
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
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  return canvas;
}

export const CategoryIcons: Record<AviationDisplayCategory, HTMLCanvasElement> = {
  airport: createCircleCanvas(MARKER_SIZE, '#00d2ff'),
  heliport: createRoundedSquareCanvas(MARKER_SIZE, '#00e676'),
  seaplane_base: createDiamondCanvas(MARKER_SIZE, '#ffab00'),
  closed: createClosedCanvas(CLOSED_SIZE, '#666666'),
  unknown: createOutlineCircleCanvas(6, '#999999'),
};

export const createMarkerCanvas = (size: number, color: string): HTMLCanvasElement => {
  return createCircleCanvas(size, color);
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

  const gradient = ctx.createRadialGradient(center, center, radius * 0.7, center, center, center);
  gradient.addColorStop(0, 'rgba(0, 210, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(0, 210, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#00d2ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
};

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
