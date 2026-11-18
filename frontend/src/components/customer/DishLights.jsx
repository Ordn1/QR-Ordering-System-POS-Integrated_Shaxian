import { Environment, Lightformer } from '@react-three/drei';
import { useMemo } from 'react';

import { brandColor } from '../../lib/showcase';

export default function DishLights() {
  const colors = useMemo(() => ({ sky: brandColor('--cream'), ground: brandColor('--dish-clay') }), []);

  return (
    <>
      <hemisphereLight args={[colors.sky, colors.ground, 0.55]} />
      <directionalLight position={[3, 6, 4]} intensity={1.7} />
      <Environment resolution={64} environmentIntensity={0.7}>
        <Lightformer intensity={1.6} position={[-3, 4, 2]} scale={[4, 4, 1]} />
        <Lightformer intensity={0.7} position={[4, 2, -2]} scale={[3, 3, 1]} />
        <Lightformer intensity={0.5} position={[0, -2, 3]} scale={[6, 1, 1]} />
      </Environment>
    </>
  );
}
