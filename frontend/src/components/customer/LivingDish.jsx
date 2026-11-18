import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';

import { markPhoto, reliefFragmentShader, reliefUniforms, reliefVertexShader } from '../../lib/relief';
import { damp, easeOut, seedOf } from '../../lib/showcase';
import DishSteam from './DishSteam';

const SEGMENTS = 128;
const RELIEF = 0.22;
const RISE_SECONDS = 0.9;
const FIT = 0.92;
const DRAG_TURN = 0.45;
const SCROLL_TILT = 0.28;
const IDLE_SWAY = 0.035;

export default function LivingDish({
  image,
  depth,
  steam = false,
  tilt,
  track,
  fit = FIT,
  onReady,
}) {
  const [map, depthMap] = useTexture([image, depth], markPhoto);
  const group = useRef(null);
  const material = useRef(null);
  const born = useRef(null);
  const seed = seedOf(image);
  const { camera, size, viewport } = useThree();
  const visible = viewport.getCurrentViewport(camera, [0, 0, 0], size);

  const aspect = map.image.width / map.image.height;
  const width = 1;
  const height = width / aspect;
  const scale = Math.min(visible.width / width, visible.height / height) * fit;

  const uniforms = useMemo(() => reliefUniforms(map, depthMap, width, height), [map, depthMap, height]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useFrame((state, delta) => {
    if (born.current === null) {
      born.current = state.clock.elapsedTime;
    }
    const rise = easeOut((state.clock.elapsedTime - born.current) / RISE_SECONDS);
    material.current.uniforms.uRelief.value = RELIEF * rise;
    material.current.uniforms.uOpacity.value = Math.min(1, rise * 3);

    let scroll = 0;
    const rect = track?.current?.getBoundingClientRect();
    if (rect) {
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      scroll = Math.max(-1, Math.min(1, offset));
    }
    const drag = tilt?.current ?? { x: 0, y: 0 };
    const time = state.clock.elapsedTime + seed;
    const turnY = drag.x * DRAG_TURN + Math.sin(time * 0.6) * IDLE_SWAY;
    const turnX = scroll * SCROLL_TILT + drag.y * DRAG_TURN * 0.6 + Math.cos(time * 0.5) * IDLE_SWAY;

    group.current.rotation.y = damp(group.current.rotation.y, turnY, 8, delta);
    group.current.rotation.x = damp(group.current.rotation.x, turnX, 8, delta);
  });

  return (
    <group scale={scale}>
      <group ref={group}>
        <mesh>
          <planeGeometry args={[width, height, SEGMENTS, SEGMENTS]} />
          <shaderMaterial
            ref={material}
            uniforms={uniforms}
            vertexShader={reliefVertexShader}
            fragmentShader={reliefFragmentShader}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>
      {steam ? <DishSteam width={width * 0.6} height={height * 0.9} y={height * 0.25} /> : null}
    </group>
  );
}
