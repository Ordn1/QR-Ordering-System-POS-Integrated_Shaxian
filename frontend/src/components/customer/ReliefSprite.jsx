import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';

import { markPhoto, reliefFragmentShader, reliefUniforms, reliefVertexShader } from '../../lib/relief';

const SEGMENTS = 64;
const RELIEF = 0.12;
const LEAN = -0.3;

export default function ReliefSprite({ image, depth, size }) {
  const [map, depthMap] = useTexture([image, depth], markPhoto);
  const height = size / (map.image.width / map.image.height);
  const uniforms = useMemo(
    () => reliefUniforms(map, depthMap, size, height, RELIEF),
    [map, depthMap, size, height],
  );

  return (
    <mesh position={[0, height / 2, 0]} rotation={[LEAN, 0, 0]}>
      <planeGeometry args={[size, height, SEGMENTS, SEGMENTS]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={reliefVertexShader}
        fragmentShader={reliefFragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
