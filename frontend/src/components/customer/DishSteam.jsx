import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

const WISPS = [
  { x: -0.18, phase: 0, tilt: -0.08 },
  { x: 0.05, phase: 2.1, tilt: 0.05 },
  { x: 0.2, phase: 4.3, tilt: 0.1 },
];

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  void main() {
    float t = uTime * 0.35 + uPhase;
    vec2 p = vec2(vUv.x + sin(vUv.y * 5.0 + t * 2.0) * 0.08, vUv.y - t * 0.5);
    float n = noise(p * vec2(4.0, 3.0)) * 0.6 + noise(p * vec2(9.0, 6.0)) * 0.4;
    float wisp = smoothstep(0.45, 0.8, n);
    float column = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
    float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
    gl_FragColor = vec4(vec3(1.0), wisp * column * fade * 0.42);
  }
`;

export default function DishSteam({ width, height, y = 0 }) {
  const wisps = useMemo(
    () =>
      WISPS.map((wisp) => ({
        ...wisp,
        uniforms: { uTime: { value: 0 }, uPhase: { value: wisp.phase } },
      })),
    [],
  );

  const materials = useRef([]);

  useFrame((state) => {
    materials.current.forEach((material) => {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    });
  });

  return (
    <group position={[0, y + height / 2, 0.2]}>
      {wisps.map((wisp, index) => (
        <mesh key={wisp.phase} position={[wisp.x * width, 0, 0]} rotation={[0, 0, wisp.tilt]}>
          <planeGeometry args={[width * 0.5, height]} />
          <shaderMaterial
            ref={(material) => {
              materials.current[index] = material;
            }}
            uniforms={wisp.uniforms}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
