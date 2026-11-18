import { Group } from 'three';

import { instanced, mesh } from './geometry';
import { material } from './materials';
import * as piece from './pieces';
import { between, spiral } from './random';
import { FILL, liquid, spoon, steamer, vessel } from './vessels';

const TAU = Math.PI * 2;

function domeGrains(random, count, center, radii) {
  return Array.from({ length: count }, () => {
    const angle = between(random, 0, TAU);
    const tilt = Math.acos(between(random, 0.15, 1));
    return {
      position: [
        center[0] + Math.sin(tilt) * Math.cos(angle) * radii[0],
        center[1] + Math.cos(tilt) * radii[1],
        center[2] + Math.sin(tilt) * Math.sin(angle) * radii[2],
      ],
      rotation: [between(random, 0, TAU), between(random, 0, TAU), 0],
      scale: between(random, 0.9, 1.3),
    };
  });
}

function scatter(random, spots, y, { tilt = 0.25, scale = [0.9, 1.1], lift = 0 } = {}) {
  return spots.map(({ x, z }) => ({
    position: [x, y + between(random, 0, lift), z],
    rotation: [between(random, -tilt, tilt), between(random, 0, TAU), between(random, -tilt, tilt)],
    scale: between(random, scale[0], scale[1]),
  }));
}

function sprinkle(group, random, geometry, finish, count, radius, y, options) {
  group.add(instanced(geometry, material(finish), scatter(random, spiral(count, radius, random, 1), y, options)));
}

function greens(group, random, spots, y) {
  spots.forEach(({ x, z, angle }) => {
    group.add(
      mesh(piece.leaf(), material('painted'), {
        position: [x, y, z],
        rotation: [between(random, -0.15, 0.1), angle ?? between(random, 0, TAU), between(random, -0.15, 0.15)],
        scale: between(random, 0.85, 1.1),
      }),
    );
  });
}

function scallions(group, random, count, radius, y) {
  sprinkle(group, random, piece.scallionRing(), 'scallion', count, radius, y, { tilt: 1.2, scale: [0.8, 1.2] });
}

function soupBowl(broth = 'broth') {
  const group = new Group();
  group.add(vessel('bowl'), liquid(FILL.bowl, broth));
  return group;
}

function noodles(group, random, detail, { y, radius = 0.62, thickness = 0.022, strands = 34, finish = 'noodle', height = 0.12 }) {
  group.add(
    mesh(piece.noodleNest(random, { strands, radius, thickness, lift: y, height, detail }), material(finish)),
  );
}

function noodleSoup(random, detail, broth, top) {
  const group = soupBowl(broth);
  noodles(group, random, detail, { y: FILL.bowl.y - 0.02 });
  top(group);
  return group;
}

function riceSet(random, detail, protein) {
  const group = new Group();
  group.add(vessel('squarePlate'));
  group.add(mesh(piece.riceDome('0.5:0.3'), material('rice'), { position: [-0.1, FILL.plate.y, -0.3], scale: [1.4, 1, 0.9] }));
  if (detail !== 'low') {
    group.add(instanced(piece.riceGrain(), material('rice'), domeGrains(random, 260, [-0.1, FILL.plate.y, -0.3], [0.7, 0.3, 0.45])));
  }
  greens(group, random, [{ x: 0.52, z: 0.12, angle: 0.4 }, { x: 0.62, z: 0.34, angle: 0.9 }], FILL.plate.y + 0.05);
  protein(group);
  return group;
}

function beefPile(group, random, count, center, spread, finish = 'beef') {
  const spots = spiral(count, spread, random).map(({ x, z }) => ({ x: x + center[0], z: z + center[1] }));
  group.add(instanced(piece.beefChunk(), material(finish), scatter(random, spots, FILL.plate.y + 0.07, { tilt: 1, lift: 0.08 })));
}

export const RECIPES = {
  wonton: (random, detail) => {
    const group = soupBowl();
    group.add(instanced(piece.wonton(detail), material('wrapper'), scatter(random, spiral(10, 0.6, random), FILL.bowl.y + 0.02)));
    scallions(group, random, 16, 0.7, FILL.bowl.y + 0.06);
    return group;
  },
  'steamed-rice': (random, detail) => {
    const group = new Group();
    group.add(vessel('riceBowl', 'porcelain'));
    group.add(mesh(piece.riceDome('0.72:0.46'), material('rice'), { position: [0, FILL.riceBowl.y, 0] }));
    if (detail !== 'low') {
      group.add(instanced(piece.riceGrain(), material('rice'), domeGrains(random, 320, [0, FILL.riceBowl.y, 0], [0.72, 0.46, 0.72])));
    }
    return group;
  },
  'skinless-wonton': (random, detail) => {
    const group = soupBowl();
    group.add(instanced(piece.porkBall(detail), material('pork'), scatter(random, spiral(13, 0.58, random), FILL.bowl.y + 0.05)));
    sprinkle(group, random, piece.herb(), 'scallion', 30, 0.55, FILL.bowl.y + 0.14, { tilt: 0.6 });
    const ladle = spoon();
    ladle.position.set(0.48, FILL.bowl.y + 0.02, -0.3);
    ladle.rotation.set(0, 0.6, 0.25);
    group.add(ladle);
    return group;
  },
  xiaolongbao: (random, detail) => {
    const group = steamer();
    const spots = [{ x: 0, z: 0 }, ...Array.from({ length: 6 }, (_, index) => ({ x: Math.cos((index * TAU) / 6) * 0.6, z: Math.sin((index * TAU) / 6) * 0.6 }))];
    group.add(instanced(piece.bun(detail), material('bun'), scatter(random, spots, FILL.steamer.y, { tilt: 0.05, scale: [0.84, 0.92] })));
    return group;
  },
  'boiled-dumplings': (random, detail) => {
    const group = soupBowl();
    group.add(instanced(piece.crescent(detail), material('wrapper'), scatter(random, spiral(8, 0.55, random), FILL.bowl.y + 0.02, { tilt: 0.2 })));
    scallions(group, random, 12, 0.65, FILL.bowl.y + 0.08);
    return group;
  },
  'fried-wonton': (random, detail) => {
    const group = new Group();
    group.add(vessel('plate'));
    group.add(instanced(piece.friedWonton(detail), material('fried'), [
      ...scatter(random, spiral(7, 0.5, random), FILL.plate.y + 0.04, { tilt: 0.5 }),
      ...scatter(random, spiral(3, 0.22, random), FILL.plate.y + 0.14, { tilt: 0.6 }),
    ]));
    return group;
  },
  'wonton-noodle-soup': (random, detail) =>
    noodleSoup(random, detail, 'broth', (group) => {
      group.add(instanced(piece.wonton(detail), material('wrapper'), scatter(random, spiral(6, 0.45, random).map(({ x, z }) => ({ x: x - 0.15, z })), FILL.bowl.y + 0.06)));
      greens(group, random, [{ x: 0.42, z: -0.2, angle: 2.2 }, { x: 0.5, z: 0.05, angle: 2.6 }], FILL.bowl.y + 0.08);
    }),
  'pork-feet-noodle-soup': (random, detail) =>
    noodleSoup(random, detail, 'brothDark', (group) => {
      group.add(instanced(piece.trotter(), material('paintedGlaze'), scatter(random, [{ x: -0.05, z: -0.1 }, { x: 0.2, z: 0.12 }], FILL.bowl.y + 0.12, { scale: [0.6, 0.7], tilt: 1.3 })));
      greens(group, random, [{ x: -0.35, z: -0.35, angle: 0.8 }, { x: -0.45, z: -0.1, angle: 1.2 }], FILL.bowl.y + 0.08);
    }),
  'shuangcai-noodle-soup': (random, detail) =>
    noodleSoup(random, detail, 'brothDark', (group) => {
      sprinkle(group, random, piece.shred(), 'fried', 40, 0.3, FILL.bowl.y + 0.1, { tilt: 1.4 });
      sprinkle(group, random, piece.flake(), 'mustard', 40, 0.32, FILL.bowl.y + 0.12, { tilt: 0.4 });
      scallions(group, random, 14, 0.5, FILL.bowl.y + 0.12);
    }),
  'intestine-noodle-soup': (random, detail) =>
    noodleSoup(random, detail, 'brothDark', (group) => {
      group.add(instanced(piece.intestine(), material('glaze'), scatter(random, spiral(7, 0.4, random), FILL.bowl.y + 0.1, { tilt: 1.2 })));
      greens(group, random, [{ x: 0.45, z: 0.25, angle: 2.4 }], FILL.bowl.y + 0.08);
      scallions(group, random, 16, 0.5, FILL.bowl.y + 0.13);
    }),
  'peanut-butter-noodles': (random, detail) => {
    const group = new Group();
    group.add(vessel('bowl'), liquid({ ...FILL.bowl, y: FILL.bowl.y - 0.05 }, 'chiliOil'));
    noodles(group, random, detail, { y: FILL.bowl.y - 0.04, radius: 0.48, height: 0.12, strands: 40 });
    sprinkle(group, random, piece.blob(), 'peanut', 6, 0.3, FILL.bowl.y + 0.08, { tilt: 0.3 });
    sprinkle(group, random, piece.flake(), 'mustard', 24, 0.25, FILL.bowl.y + 0.12, { tilt: 0.4 });
    scallions(group, random, 18, 0.3, FILL.bowl.y + 0.14);
    return group;
  },
  'fried-noodles': (random, detail) => {
    const group = new Group();
    group.add(vessel('squarePlate'));
    noodles(group, random, detail, { y: FILL.plate.y + 0.02, radius: 0.62, height: 0.16, strands: 46, finish: 'soyNoodle' });
    sprinkle(group, random, piece.shred(), 'cabbage', 30, 0.55, FILL.plate.y + 0.14, { tilt: 1.5 });
    sprinkle(group, random, piece.shred(), 'carrot', 16, 0.5, FILL.plate.y + 0.15, { tilt: 1.5 });
    scallions(group, random, 10, 0.5, FILL.plate.y + 0.18);
    return group;
  },
  'fried-bihon': (random, detail) => {
    const group = new Group();
    group.add(vessel('squarePlate'));
    noodles(group, random, detail, { y: FILL.plate.y + 0.02, radius: 0.64, height: 0.18, strands: 90, thickness: 0.009, finish: 'bihon' });
    sprinkle(group, random, piece.shred(), 'fried', 26, 0.5, FILL.plate.y + 0.16, { tilt: 1.5 });
    sprinkle(group, random, piece.shred(), 'cabbage', 20, 0.55, FILL.plate.y + 0.15, { tilt: 1.5 });
    scallions(group, random, 10, 0.5, FILL.plate.y + 0.2);
    return group;
  },
  'black-pepper-beef-set': (random, detail) =>
    riceSet(random, detail, (group) => {
      beefPile(group, random, 14, [-0.22, 0.22], 0.32);
      sprinkle(group, random, piece.flake(), 'beef', 20, 0.3, FILL.plate.y + 0.2, { tilt: 0.6, scale: [0.4, 0.6] });
    }),
  'meicai-pork-set': (random, detail) =>
    riceSet(random, detail, (group) => {
      group.add(instanced(piece.bellySlab(), material('paintedGlaze'), [
        { position: [-0.32, FILL.plate.y + 0.1, 0.22], rotation: [0, 0.5, 0.1], scale: 1.1 },
        { position: [-0.08, FILL.plate.y + 0.1, 0.3], rotation: [0, 0.2, -0.08], scale: 1.05 },
      ]));
      sprinkle(group, random, piece.flake(), 'mustard', 40, 0.3, FILL.plate.y + 0.23, { tilt: 0.4, scale: [1, 1.6] });
    }),
  'braised-pork-set': (random) =>
    riceSet(random, 'high', (group) => {
      [0, 1, 2].forEach((index) => {
        group.add(mesh(piece.bellySlab(), material('paintedGlaze'), {
          position: [-0.38 + index * 0.24, FILL.plate.y + 0.11, 0.24 + index * 0.02],
          rotation: [0, 0.3 + index * 0.08, 0.15],
        }));
      });
    }),
  'braised-pork-feet-set': (random) =>
    riceSet(random, 'high', (group) => {
      group.add(mesh(piece.trotter(), material('paintedGlaze'), { position: [-0.2, FILL.plate.y + 0.13, 0.22], rotation: [Math.PI / 2, 0, 0.9], scale: 1.1 }));
    }),
  'braised-beef-set': (random, detail) =>
    riceSet(random, detail, (group) => {
      beefPile(group, random, 13, [-0.2, 0.22], 0.34);
    }),
  'chicken-leg-set': (random) =>
    riceSet(random, 'high', (group) => {
      group.add(mesh(piece.drumstick(), material('paintedGlaze'), { position: [-0.12, FILL.plate.y + 0.2, 0.24], rotation: [Math.PI / 2, 0, 2.2], scale: [1.9, 1.7, 1.5] }));
    }),
  'braised-pork-feet': (random) => {
    const group = new Group();
    group.add(vessel('plate'));
    group.add(mesh(piece.saucePool(0.55), material('glaze'), { position: [0, FILL.plate.y + 0.005, 0], rotation: [-Math.PI / 2, 0, 0] }));
    group.add(mesh(piece.trotter(), material('paintedGlaze'), { position: [-0.1, FILL.plate.y + 0.16, -0.05], rotation: [Math.PI / 2, 0, 0.7], scale: 1.45 }));
    const dip = new Group();
    dip.add(vessel('dipDish', 'porcelain'));
    sprinkle(dip, random, piece.flake(), 'chili', 26, 0.17, FILL.dipDish.y, { tilt: 0.5, scale: [0.6, 0.9] });
    dip.position.set(0.48, FILL.plate.y, 0.42);
    group.add(dip);
    return group;
  },
  'braised-pork': (random) => {
    const group = new Group();
    group.add(vessel('plate'));
    group.add(mesh(piece.saucePool(0.5), material('glaze'), { position: [0, FILL.plate.y + 0.005, 0], rotation: [-Math.PI / 2, 0, 0] }));
    group.add(instanced(piece.bellySlab(), material('paintedGlaze'), scatter(random, spiral(9, 0.45, random), FILL.plate.y + 0.11, { tilt: 0.3, scale: [0.72, 0.85] })));
    scallions(group, random, 14, 0.45, FILL.plate.y + 0.2);
    return group;
  },
  'pickled-chicken-feet': (random) => {
    const group = new Group();
    group.add(vessel('plate', 'redware'));
    group.add(mesh(piece.saucePool(0.6), material('chiliOil'), { position: [0, FILL.plate.y + 0.005, 0], rotation: [-Math.PI / 2, 0, 0] }));
    group.add(instanced(piece.chickenFoot(), material('feet'), scatter(random, spiral(6, 0.45, random), FILL.plate.y + 0.05, { tilt: 0.3, scale: [1.1, 1.3] })));
    group.add(mesh(piece.lemonWedge(), material('painted'), { position: [0.35, FILL.plate.y + 0.1, 0.2], rotation: [0.4, 0.5, 0] }));
    sprinkle(group, random, piece.flake(), 'chili', 16, 0.5, FILL.plate.y + 0.12, { tilt: 0.6 });
    sprinkle(group, random, piece.herb(), 'scallion', 8, 0.2, FILL.plate.y + 0.18, { tilt: 0.6 });
    return group;
  },
  'chicken-soup': (random) => {
    const group = new Group();
    [[-0.5, -0.3], [0.5, -0.3], [0, 0.45]].forEach(([x, z]) => {
      const jar = new Group();
      jar.add(vessel('clayJar', 'clay'), liquid(FILL.clayJar, 'brothDark'));
      sprinkle(jar, random, piece.shred(), 'cordyceps', 10, 0.3, FILL.clayJar.y + 0.01, { tilt: 1.5 });
      jar.position.set(x, 0, z);
      group.add(jar);
    });
    return group;
  },
  'tea-eggs': () => {
    const group = new Group();
    const plate = vessel('plate', 'slate');
    plate.scale.set(1, 1, 0.7);
    group.add(plate);
    group.add(mesh(piece.egg(), material('egg'), { position: [-0.28, FILL.plate.y + 0.42, -0.02], rotation: [0, 0, 0.2], scale: 1.55 }));
    const half = new Group();
    half.add(
      mesh(piece.eggHalf(), material('egg'), { rotation: [Math.PI, 0, 0] }),
      mesh(piece.disc(0.215), material('eggWhite'), { rotation: [-Math.PI / 2, 0, 0], scale: [1, 1.24, 1], position: [0, 0.002, 0] }),
      mesh(piece.disc(0.1), material('yolk'), { rotation: [-Math.PI / 2, 0, 0], scale: [1, 1.2, 1], position: [0, 0.006, 0] }),
    );
    half.position.set(0.36, FILL.plate.y + 0.26, 0.06);
    half.rotation.set(0.5, 0.4, 0);
    half.scale.setScalar(1.45);
    group.add(half);
    return group;
  },
};
