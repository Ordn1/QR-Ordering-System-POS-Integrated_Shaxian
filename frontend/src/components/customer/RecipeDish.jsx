import { useMemo } from 'react';

import { buildDish } from '../../lib/dishes/build';
import { shadowTexture } from '../../lib/showcase';

const SHADOW_SPAN = 2.5;

export default function RecipeDish({ recipe, detail = 'high', shadow = true, ...props }) {
  const dish = useMemo(() => buildDish(recipe, detail), [recipe, detail]);
  const blob = useMemo(() => (shadow ? shadowTexture() : null), [shadow]);

  return (
    <group {...props}>
      {blob ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <planeGeometry args={[SHADOW_SPAN, SHADOW_SPAN]} />
          <meshBasicMaterial map={blob} transparent depthWrite={false} />
        </mesh>
      ) : null}
      <primitive object={dish} />
    </group>
  );
}
