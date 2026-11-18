import { CapsuleGeometry, CircleGeometry, CylinderGeometry, Group, SphereGeometry, TorusGeometry } from 'three';

import { displace, lathe, memo, mesh } from './geometry';
import { material } from './materials';

const HOUSE_BOWL = [
  [0, 0.02], [0.44, 0.02], [0.46, 0], [0.5, 0.03], [0.64, 0.07], [0.86, 0.16],
  [0.98, 0.26], [1, 0.29], [0.97, 0.3], [0.86, 0.21], [0.63, 0.12], [0.3, 0.085], [0, 0.08],
];

const PLATE = [
  [0, 0.02], [0.52, 0.02], [0.54, 0], [0.58, 0.03], [0.8, 0.055], [0.94, 0.12],
  [1, 0.17], [0.97, 0.18], [0.91, 0.14], [0.78, 0.085], [0, 0.075],
];

const RICE_BOWL = [
  [0, 0], [0.3, 0], [0.32, 0.06], [0.37, 0.08], [0.56, 0.2], [0.73, 0.44], [0.8, 0.7],
  [0.82, 0.73], [0.78, 0.73], [0.71, 0.47], [0.53, 0.24], [0.3, 0.14], [0, 0.13],
];

const CLAY_JAR = [
  [0, 0], [0.4, 0], [0.48, 0.06], [0.54, 0.3], [0.52, 0.56], [0.45, 0.68], [0.47, 0.74],
  [0.45, 0.77], [0.41, 0.75], [0.4, 0.69], [0.46, 0.55], [0.47, 0.3], [0.4, 0.1], [0, 0.08],
];

const DIP_DISH = [
  [0, 0], [0.16, 0], [0.18, 0.02], [0.24, 0.1], [0.26, 0.13], [0.24, 0.135], [0.2, 0.06], [0, 0.04],
];

export const FILL = {
  bowl: { y: 0.2, radius: 0.84 },
  plate: { y: 0.09, radius: 0.78 },
  riceBowl: { y: 0.6, radius: 0.74 },
  clayJar: { y: 0.62, radius: 0.43 },
  dipDish: { y: 0.09, radius: 0.2 },
  steamer: { y: 0.06, radius: 0.92 },
};

const SQUIRCLE = 4;

function squircle(geometry, reach = 0.9) {
  return displace(geometry, (point) => {
    const angle = Math.atan2(point.z, point.x);
    const factor =
      (Math.abs(Math.cos(angle)) ** SQUIRCLE + Math.abs(Math.sin(angle)) ** SQUIRCLE) ** (-1 / SQUIRCLE);
    point.x *= 1 + (factor - 1) * reach;
    point.z *= 1 + (factor - 1) * reach;
  });
}

const geometryFor = memo((name) => {
  switch (name) {
    case 'bowl':
      return lathe(HOUSE_BOWL, 64);
    case 'plate':
      return lathe(PLATE, 64);
    case 'squarePlate':
      return squircle(lathe(PLATE, 96));
    case 'riceBowl':
      return lathe(RICE_BOWL, 64);
    case 'clayJar':
      return lathe(CLAY_JAR, 48);
    case 'dipDish':
      return lathe(DIP_DISH, 32);
    default:
      throw new Error(`Unknown vessel ${name}`);
  }
});

export function vessel(name, finish = 'ceramic') {
  return mesh(geometryFor(name), material(finish));
}

export function steamer() {
  const group = new Group();
  group.add(
    mesh(new CylinderGeometry(1, 0.94, 0.26, 64, 1, true), material('steel'), { position: [0, 0.13, 0] }),
    mesh(new TorusGeometry(1, 0.02, 8, 64), material('steel'), {
      position: [0, 0.26, 0],
      rotation: [Math.PI / 2, 0, 0],
    }),
    mesh(new CircleGeometry(0.94, 64), material('steamerMesh'), {
      position: [0, 0.04, 0],
      rotation: [-Math.PI / 2, 0, 0],
    }),
  );
  [-1, 1].forEach((side) => {
    group.add(
      mesh(new TorusGeometry(0.16, 0.025, 8, 24, Math.PI), material('steel'), {
        position: [side * 1.02, 0.2, 0],
        rotation: [Math.PI / 2, 0, side * Math.PI / 2],
      }),
    );
  });
  return group;
}

export function spoon() {
  const group = new Group();
  const bowl = displace(new SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), (point) => {
    point.x *= 1.35;
  });
  group.add(
    mesh(bowl, material('porcelain'), { position: [0, 0.07, 0] }),
    mesh(new CapsuleGeometry(0.035, 0.42, 4, 8), material('porcelain'), {
      position: [0.36, 0.14, 0],
      rotation: [0, 0, Math.PI / 2 - 0.35],
    }),
  );
  return group;
}

export function liquid(fill, finish) {
  return mesh(new CircleGeometry(fill.radius, 48), material(finish), {
    position: [0, fill.y, 0],
    rotation: [-Math.PI / 2, 0, 0],
  });
}
