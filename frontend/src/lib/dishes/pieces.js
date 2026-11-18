import {
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';

import { blend, displace, lathe, memo, merge, paint, tokenColor } from './geometry';
import { between, noise3 } from './random';

const smoothstep = (low, high, value) => {
  const t = Math.min(Math.max((value - low) / (high - low), 0), 1);
  return t * t * (3 - 2 * t);
};

const lumpy = (amount, frequency) => (point) => {
  point.multiplyScalar(1 + noise3(point.x * frequency, point.y * frequency, point.z * frequency) * amount);
};

const segmentsFor = (detail, high, low) => (detail === 'low' ? low : high);

const TAILS = [0.3, 1.9, 3.4, 4.9];

function parcel(detail, wrinkle) {
  const segments = segmentsFor(detail, 22, 12);
  return displace(new SphereGeometry(0.13, segments, Math.round(segments * 0.8)), (point) => {
    const flat = Math.hypot(point.x, point.z) || 1;
    const heading = Math.atan2(point.z, point.x);
    const pull = TAILS.reduce(
      (most, tail) => Math.max(most, Math.max(0, Math.cos(heading - tail)) ** 10),
      0,
    ) * smoothstep(0.13, 0, Math.abs(point.y));
    const reach = flat + pull * 0.13;
    point.x = (point.x / flat) * reach;
    point.z = (point.z / flat) * reach;
    point.y = point.y * (0.75 - pull * 0.45) - pull * 0.03 + 0.07;
    lumpy(wrinkle, 11)(point);
  });
}

export const wonton = memo((detail) => parcel(detail, 0.06));
export const friedWonton = memo((detail) => parcel(detail, 0.16));

export const porkBall = memo((detail) => {
  const segments = segmentsFor(detail, 16, 10);
  return displace(new SphereGeometry(0.11, segments, segments), lumpy(0.09, 16));
});

export const bun = memo((detail) => {
  const pleats = 16;
  const body = lathe(
    [[0, 0], [0.26, 0], [0.3, 0.06], [0.3, 0.14], [0.25, 0.23], [0.15, 0.3], [0.05, 0.335], [0, 0.34]],
    segmentsFor(detail, 64, 32),
  );
  displace(body, (point) => {
    const lift = smoothstep(0.08, 0.32, point.y);
    const angle = Math.atan2(point.z, point.x) + lift * 0.5;
    const ridge = 1 + 0.08 * Math.sin(angle * pleats) * lift;
    point.x *= ridge;
    point.z *= ridge;
  });
  const knot = displace(new SphereGeometry(0.045, 10, 8), (point) => {
    point.y += 0.34;
  });
  return merge([body, knot]);
});

export const crescent = memo((detail) => {
  const segments = segmentsFor(detail, 24, 12);
  return displace(new SphereGeometry(0.15, segments, segments), (point) => {
    point.x *= 1.25;
    point.y = Math.max(point.y, -0.05) * 0.95 + 0.05;
    point.z = point.z * 0.6 + (point.x * point.x) * 1.1;
    const crest = smoothstep(0.08, 0.19, point.y);
    point.z *= 1 - crest * 0.7;
    point.y += crest * 0.025 * Math.sin(point.x * 46);
  });
});

export function noodleNest(random, { strands, radius, thickness, lift, height = 0.06, detail }) {
  const count = detail === 'low' ? Math.ceil(strands / 2) : strands;
  const tubes = Array.from({ length: count }, () => {
    let angle = between(random, 0, Math.PI * 2);
    const points = Array.from({ length: 7 }, () => {
      angle += between(random, 0.6, 1.6);
      const reach = radius * Math.sqrt(between(random, 0.05, 1));
      return new Vector3(Math.cos(angle) * reach, lift + between(random, 0, height), Math.sin(angle) * reach);
    });
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    return new TubeGeometry(curve, detail === 'low' ? 24 : 48, thickness, 5, false);
  });
  return merge(tubes);
}

export const leaf = memo(() => {
  const blade = new PlaneGeometry(0.36, 0.62, 8, 12);
  blade.rotateX(-Math.PI / 2);
  displace(blade, (point) => {
    const along = (0.31 - point.z) / 0.62;
    point.x *= 0.45 + 0.55 * smoothstep(0, 0.45, along) * (1 - smoothstep(0.8, 1, along) * 0.4);
    point.z -= 0.16;
    point.y = (point.x / 0.18) ** 2 * 0.045 + noise3(point.x * 9, 1, point.z * 9) * 0.018;
  });
  const stem = displace(new CapsuleGeometry(0.06, 0.3, 4, 10), (point) => {
    point.x *= 1.5;
    point.y *= 0.45;
  });
  stem.rotateX(Math.PI / 2);
  stem.translate(0, 0.02, 0.24);
  return paint(merge([blade, stem]), (point) =>
    blend('--dish-stem', '--dish-leaf', smoothstep(0.12, -0.02, point.z) * (Math.abs(point.x) < 0.03 ? 0.4 : 1)),
  );
});

export const scallionRing = memo(() => new TorusGeometry(0.03, 0.011, 6, 10));
export const herb = memo(() => displace(new SphereGeometry(0.035, 6, 4), (point) => {
  point.y *= 0.25;
}));
export const shred = memo(() => new CapsuleGeometry(0.012, 0.13, 2, 4));
export const flake = memo(() => displace(new SphereGeometry(0.025, 5, 4), (point) => {
  point.y *= 0.4;
}));

export const bellySlab = memo(() => {
  const geometry = displace(new BoxGeometry(0.36, 0.22, 0.28, 3, 15, 3), (point) => {
    const inset = 0.92 + 0.08 * Math.cos((point.y / 0.11) * Math.PI * 0.5);
    point.x *= inset;
    point.z *= inset;
    lumpy(0.03, 12)(point);
  });
  const bands = ['--dish-glaze', '--dish-fat', '--dish-meat', '--dish-meat', '--dish-fat', '--dish-meat'];
  return paint(geometry, (point) => {
    const band = Math.min(bands.length - 1, Math.floor(((0.11 - point.y) / 0.22) * bands.length));
    return tokenColor(bands[Math.max(band, 0)]);
  });
});

export const trotter = memo(() => {
  const shank = new CapsuleGeometry(0.15, 0.3, 8, 16);
  shank.rotateZ(Math.PI / 2);
  const knuckle = new SphereGeometry(0.2, 18, 14);
  knuckle.translate(0.22, 0.02, 0);
  const toe = new SphereGeometry(0.11, 12, 10);
  toe.translate(-0.3, -0.02, 0.05);
  const geometry = displace(merge([shank, knuckle, toe]), lumpy(0.1, 6));
  return paint(geometry, (point) =>
    blend('--dish-roast', '--dish-glaze', 0.45 + noise3(point.x * 5, point.y * 5, point.z * 5) * 0.5),
  );
});

export const beefChunk = memo(() => displace(new SphereGeometry(0.12, 12, 10), (point) => {
  point.y *= 0.8;
  lumpy(0.3, 11)(point);
}));

export const intestine = memo(() => displace(new TorusGeometry(0.075, 0.035, 8, 14), lumpy(0.12, 18)));

export const drumstick = memo(() => {
  const geometry = lathe(
    [[0, -0.42], [0.035, -0.42], [0.055, -0.38], [0.035, -0.3], [0.045, -0.16], [0.12, -0.02], [0.17, 0.12], [0.16, 0.24], [0.1, 0.33], [0, 0.36]],
    24,
  );
  displace(geometry, (point) => {
    if (point.y > -0.12) {
      lumpy(0.06, 9)(point);
    }
  });
  return paint(geometry, (point) =>
    point.y < -0.17 ? tokenColor('--dish-bone') : blend('--dish-roast', '--dish-glaze', 0.3 + noise3(point.x * 8, point.y * 8, point.z * 8) * 0.4),
  );
});

export const chickenFoot = memo(() => {
  const pad = displace(new SphereGeometry(0.1, 12, 10), (point) => {
    point.y *= 0.6;
  });
  const toes = [-0.5, 0, 0.5, Math.PI].map((angle) => {
    const toe = new CapsuleGeometry(0.05, angle === Math.PI ? 0.06 : 0.16, 4, 8);
    toe.rotateZ(Math.PI / 2);
    toe.translate(angle === Math.PI ? 0.08 : 0.15, 0, 0);
    toe.rotateY(angle);
    return toe;
  });
  const shin = new CapsuleGeometry(0.06, 0.2, 4, 8);
  shin.rotateZ(Math.PI / 2 - 0.4);
  shin.translate(-0.17, 0.05, 0);
  return merge([pad, ...toes, shin]);
});

export const lemonWedge = memo(() => {
  const geometry = new CylinderGeometry(0.3, 0.3, 0.06, 24, 1, false, 0, Math.PI);
  return paint(geometry, (point) =>
    Math.hypot(point.x, point.z) > 0.27 ? blend('--dish-lemon', '--dish-carrot', 0.25) : blend('--dish-lemon', '--dish-bun', 0.45),
  );
});

export const egg = memo(() => displace(new SphereGeometry(0.22, 24, 16), (point) => {
  point.y *= 1.25;
}));

export const eggHalf = memo(() => displace(new SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), (point) => {
  point.y *= 1.25;
}));

export const disc = memo((radius) => new CircleGeometry(radius, 32));

export const riceDome = memo((key) => {
  const [radius, height] = key.split(':').map(Number);
  const geometry = new SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  return displace(geometry, (point) => {
    point.y *= height / radius;
    lumpy(0.05, 10)(point);
  });
});

export const riceGrain = memo(() => new CapsuleGeometry(0.011, 0.028, 2, 4));

export const blob = memo(() => displace(new SphereGeometry(0.08, 12, 8), (point) => {
  point.y *= 0.45;
  lumpy(0.15, 12)(point);
}));

export const saucePool = memo((radius) =>
  displace(new CircleGeometry(radius, 40), (point) => {
    const angle = Math.atan2(point.y, point.x);
    const stretch = 1 + noise3(Math.cos(angle) * 2, Math.sin(angle) * 2, radius) * 0.12;
    point.x *= stretch;
    point.y *= stretch;
  }),
);
