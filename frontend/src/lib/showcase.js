import { CanvasTexture, SRGBColorSpace } from 'three';

export const TAU = Math.PI * 2;

const SHADOW_STRENGTH = 0.35;

export function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function seedOf(text) {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000;
  }
  return hash / 100;
}

export function easeOut(progress) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - clamped) ** 5;
}

export function brandColor(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

export function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function shadowTexture() {
  return canvasTexture(128, 128, (context, width, height) => {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, brandColor('--ink'));
    gradient.addColorStop(1, 'transparent');
    context.globalAlpha = SHADOW_STRENGTH;
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}
