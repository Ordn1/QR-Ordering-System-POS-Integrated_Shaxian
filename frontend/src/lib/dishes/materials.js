import { DoubleSide, MeshPhysicalMaterial, RepeatWrapping } from 'three';

import { brandColor, canvasTexture } from '../showcase';
import { between, rng } from './random';
import { memo } from './geometry';

const TEXTURES = {
  speckle: () =>
    canvasTexture(1024, 256, (context, width, height) => {
      const random = rng(7);
      context.fillStyle = brandColor('--dish-ceramic');
      context.fillRect(0, 0, width, height);
      context.fillStyle = brandColor('--dish-speckle');
      for (let index = 0; index < 5200; index += 1) {
        const y = between(random, 0, height);
        const rim = Math.abs(y / height - 0.5) < 0.16;
        if (!rim && random() > 0.35) {
          continue;
        }
        context.globalAlpha = between(random, 0.35, 0.95);
        context.beginPath();
        context.arc(between(random, 0, width), y, between(random, 0.8, rim ? 3.4 : 1.6), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 0.85;
      context.strokeStyle = brandColor('--dish-ink');
      context.lineCap = 'round';
      for (let stroke = 0; stroke < 22; stroke += 1) {
        const x = 60 + (stroke % 11) * 16 + between(random, -3, 3);
        const y = height * (0.6 + Math.floor(stroke / 11) * 0.07);
        context.lineWidth = between(random, 1.5, 3.2);
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + between(random, -5, 5), y + 6, x + between(random, -4, 4), y + 11);
        context.stroke();
      }
      context.globalAlpha = 1;
    }),
  clay: () =>
    canvasTexture(512, 256, (context, width, height) => {
      context.fillStyle = brandColor('--dish-clay');
      context.fillRect(0, 0, width, height);
      context.strokeStyle = brandColor('--dish-ceramic');
      context.globalAlpha = 0.55;
      context.lineWidth = 4;
      for (let row = 0; row < 2; row += 1) {
        const y = height * (0.3 + row * 0.12);
        context.beginPath();
        for (let x = 0; x <= width; x += 32) {
          context.moveTo(x, y);
          context.arc(x + 16, y, 9, Math.PI, Math.PI * 2.6);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    }),
  crackle: () =>
    canvasTexture(512, 256, (context, width, height) => {
      const random = rng(11);
      context.fillStyle = brandColor('--dish-egg-shell');
      context.fillRect(0, 0, width, height);
      context.strokeStyle = brandColor('--dish-beef');
      context.globalAlpha = 0.7;
      for (let crack = 0; crack < 90; crack += 1) {
        let x = between(random, 0, width);
        let y = between(random, 0, height);
        context.lineWidth = between(random, 0.8, 2.2);
        context.beginPath();
        context.moveTo(x, y);
        for (let step = 0; step < 5; step += 1) {
          x += between(random, -26, 26);
          y += between(random, -16, 16);
          context.lineTo(x, y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    }),
  mesh: () =>
    canvasTexture(256, 256, (context, width, height) => {
      context.fillStyle = brandColor('--dish-steel');
      context.fillRect(0, 0, width, height);
      context.strokeStyle = brandColor('--dish-slate');
      context.globalAlpha = 0.35;
      context.lineWidth = 2;
      for (let line = 0; line < width; line += 8) {
        context.beginPath();
        context.moveTo(line, 0);
        context.lineTo(line, height);
        context.moveTo(0, line);
        context.lineTo(width, line);
        context.stroke();
      }
      context.globalAlpha = 1;
    }),
};

const texture = memo((name) => {
  const map = TEXTURES[name]();
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.anisotropy = 4;
  return map;
});

const FINISHES = {
  ceramic: { map: 'speckle', roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.22, side: DoubleSide },
  porcelain: { token: '--dish-porcelain', roughness: 0.25, clearcoat: 1, side: DoubleSide },
  steel: { token: '--dish-steel', roughness: 0.32, metalness: 0.55, side: DoubleSide },
  steamerMesh: { map: 'mesh', roughness: 0.6, metalness: 0.5 },
  clay: { map: 'clay', roughness: 0.55, clearcoat: 0.5, side: DoubleSide },
  slate: { token: '--dish-slate', roughness: 0.35, clearcoat: 0.7, side: DoubleSide },
  redware: { token: '--dish-redware', roughness: 0.3, clearcoat: 1, side: DoubleSide },
  broth: { token: '--dish-broth', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 },
  brothDark: { token: '--dish-broth-dark', roughness: 0.05, clearcoat: 1 },
  chiliOil: { token: '--dish-chili-oil', roughness: 0.08, clearcoat: 1 },
  wrapper: { token: '--dish-wrapper', roughness: 0.4, sheen: 1, sheenRoughness: 0.4, clearcoat: 0.5, transparent: true, opacity: 0.94, side: DoubleSide },
  pork: { token: '--dish-pork', roughness: 0.75 },
  bun: { token: '--dish-bun', roughness: 0.7, sheen: 1, sheenRoughness: 0.6 },
  fried: { token: '--dish-fried', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.3 },
  noodle: { token: '--dish-noodle', roughness: 0.35, clearcoat: 0.6 },
  soyNoodle: { token: '--dish-soy-noodle', roughness: 0.35, clearcoat: 0.7 },
  bihon: { token: '--dish-bihon', roughness: 0.5, clearcoat: 0.3 },
  scallion: { token: '--dish-scallion', roughness: 0.45, side: DoubleSide },
  glaze: { token: '--dish-glaze', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 },
  beef: { token: '--dish-beef', roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.25 },
  rice: { token: '--dish-rice', roughness: 0.6, sheen: 0.6, sheenRoughness: 0.5 },
  peanut: { token: '--dish-peanut', roughness: 0.25, clearcoat: 1 },
  chili: { token: '--dish-chili', roughness: 0.3, clearcoat: 0.8 },
  carrot: { token: '--dish-carrot', roughness: 0.5 },
  cabbage: { token: '--dish-cabbage', roughness: 0.6, side: DoubleSide },
  mustard: { token: '--dish-mustard', roughness: 0.5 },
  cordyceps: { token: '--dish-cordyceps', roughness: 0.4 },
  feet: { token: '--dish-feet', roughness: 0.25, clearcoat: 1 },
  egg: { map: 'crackle', roughness: 0.35, clearcoat: 0.8 },
  eggWhite: { token: '--dish-egg-white', roughness: 0.4 },
  yolk: { token: '--dish-yolk', roughness: 0.5 },
  painted: { vertexColors: true, roughness: 0.4, clearcoat: 0.6, side: DoubleSide },
  paintedGlaze: { vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 },
};

export const material = memo((name) => {
  const { token, map, ...finish } = FINISHES[name];
  const result = new MeshPhysicalMaterial(finish);
  if (map) {
    result.map = texture(map);
  } else if (token) {
    result.color.set(brandColor(token));
  }
  return result;
});
