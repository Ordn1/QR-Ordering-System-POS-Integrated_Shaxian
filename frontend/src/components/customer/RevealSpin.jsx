import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { TAU, easeOut } from '../../lib/showcase';

const REVEAL_SECONDS = 1.4;

export default function RevealSpin({ onReady, children }) {
  const spin = useRef(null);
  const born = useRef(null);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useFrame((state) => {
    if (born.current === null) {
      born.current = state.clock.elapsedTime;
    }
    const progress = easeOut((state.clock.elapsedTime - born.current) / REVEAL_SECONDS);
    spin.current.rotation.y = -TAU * (1 - progress);
  });

  return <group ref={spin}>{children}</group>;
}
