import { PerspectiveCamera, View } from '@react-three/drei';
import { Suspense } from 'react';

import LivingDish from './LivingDish';

export default function DishView({ track, image, depth, steam, tilt, onReady }) {
  return (
    <View className="menu-card-view">
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={30} />
      <Suspense fallback={null}>
        <LivingDish
          image={image}
          depth={depth}
          steam={steam}
          tilt={tilt}
          track={track}
          onReady={onReady}
        />
      </Suspense>
    </View>
  );
}
