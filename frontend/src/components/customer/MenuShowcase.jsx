import { PerformanceMonitor, View } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import { useUiStore } from '../../store/uiStore';

const FPS_FLOOR = 24;
const FPS_CEILING = 60;
const OVERLAY = { position: 'fixed', inset: 0, pointerEvents: 'none' };

export default function MenuShowcase() {
  const declineShowcase = useUiStore((state) => state.declineShowcase);

  return (
    <Canvas className="menu-showcase" style={OVERLAY} flat dpr={[1, 2]} gl={{ alpha: true }}>
      <PerformanceMonitor bounds={() => [FPS_FLOOR, FPS_CEILING]} onDecline={declineShowcase} />
      <View.Port />
    </Canvas>
  );
}
