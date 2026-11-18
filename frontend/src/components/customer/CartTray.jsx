import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';

import { useDragTilt } from '../../hooks/useDragTilt';
import TrayScene from './TrayScene';

const FILL = { position: 'absolute', inset: 0 };
const CAMERA = { position: [0, 2.1, 3.1], fov: 34 };

export default function CartTray({ lines }) {
  const { tilt, handlers } = useDragTilt();
  const pictured = useMemo(() => lines.filter((line) => line.image_filename), [lines]);

  return (
    <div className="cart-tray" aria-hidden="true" {...handlers}>
      <Canvas
        style={FILL}
        dpr={[1, 2]}
        gl={{ alpha: true }}
        camera={CAMERA}
        onCreated={({ camera }) => camera.lookAt(0, 0.15, 0)}
      >
        <TrayScene lines={pictured} tilt={tilt} />
      </Canvas>
    </div>
  );
}
