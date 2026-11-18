import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState } from 'react';

import { brandColor, damp } from '../../lib/showcase';
import DishLights from './DishLights';
import TrayDish from './TrayDish';

const TRAY = [2.6, 0.1, 1.7];
const COLUMNS = 3;
const SPACING = [0.78, 0.6];
const DISH_SIZE = 0.66;
const DRAG_TURN = 0.6;

function slotsFor(count) {
  const columns = Math.min(COLUMNS, Math.max(count, 1));
  const rows = Math.ceil(count / columns);
  const shrink = rows > 2 ? 2 / rows : 1;
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return [
      (column - (columns - 1) / 2) * SPACING[0] * shrink,
      (row - (rows - 1) / 2) * SPACING[1] * shrink + 0.1,
      DISH_SIZE * shrink,
    ];
  });
}

function merge(entries, lines) {
  const current = new Map(lines.map((line) => [line.item_id, line]));
  const staying = entries.filter((entry) => !entry.leaving);
  const slots = slotsFor(staying.length);
  const next = entries.map((entry) => {
    if (current.has(entry.line.item_id)) {
      return { line: current.get(entry.line.item_id), leaving: false };
    }
    return entry.leaving ? entry : { ...entry, leaving: true, slot: slots[staying.indexOf(entry)] };
  });
  const known = new Set(entries.map((entry) => entry.line.item_id));
  lines.forEach((line) => {
    if (!known.has(line.item_id)) {
      next.push({ line, leaving: false });
    }
  });
  return next;
}

export default function TrayScene({ lines, tilt }) {
  const tray = useRef(null);
  const [entries, setEntries] = useState(() => lines.map((line) => ({ line, leaving: false })));
  const [seenLines, setSeenLines] = useState(lines);
  const colors = useMemo(
    () => ({ lacquer: brandColor('--red-deep'), liner: brandColor('--cream') }),
    [],
  );

  if (lines !== seenLines) {
    setSeenLines(lines);
    setEntries((previous) => merge(previous, lines));
  }

  const staying = entries.filter((entry) => !entry.leaving);
  const slots = slotsFor(staying.length);

  useFrame((_, delta) => {
    tray.current.rotation.y = damp(tray.current.rotation.y, tilt.current.x * DRAG_TURN, 6, delta);
  });

  return (
    <group ref={tray}>
      <DishLights />
      <RoundedBox args={TRAY} radius={0.05} smoothness={4} position={[0, -TRAY[1] / 2, 0]}>
        <meshPhysicalMaterial
          color={colors.lacquer}
          roughness={0.35}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[TRAY[0] - 0.18, TRAY[2] - 0.18]} />
        <meshBasicMaterial color={colors.liner} toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        {entries.map((entry) => {
          const slot = entry.leaving ? entry.slot : slots[staying.indexOf(entry)];
          return (
            <TrayDish
              key={entry.line.item_id}
              dish={entry.line}
              slot={slot}
              size={slot[2]}
              quantity={entry.line.quantity}
              leaving={entry.leaving}
              onGone={() =>
                setEntries((previous) =>
                  previous.filter((other) => other.line.item_id !== entry.line.item_id),
                )
              }
            />
          );
        })}
      </Suspense>
    </group>
  );
}
