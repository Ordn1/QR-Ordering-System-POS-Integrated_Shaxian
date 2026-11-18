import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo, useState } from 'react';

import { hasRecipe } from '../../lib/dishes/build';
import { brandColor } from '../../lib/showcase';
import DishLights from './DishLights';
import DishSteam from './DishSteam';
import LivingDish from './LivingDish';
import RecipeDish from './RecipeDish';
import RevealSpin from './RevealSpin';

const PHOTO_SWING = 0.55;
const SOLID_CAMERA = [0, 1.7, 2.7];
const SOLID_TARGET = [0, 0.25, 0];
const PHOTO_CAMERA = [0, 0, 2.6];
const FILL = { position: 'absolute', inset: 0 };

export default function DishStage({ image, depth, recipe, steam, onReady }) {
  const [touched, setTouched] = useState(false);
  const solid = hasRecipe(recipe);
  const backdrop = useMemo(() => brandColor('--cream'), []);

  return (
    <Canvas
      className="item-detail-stage"
      style={FILL}
      dpr={[1, 2]}
      gl={{ alpha: true }}
      camera={{ position: solid ? SOLID_CAMERA : PHOTO_CAMERA, fov: 32 }}
    >
      {solid ? <color attach="background" args={[backdrop]} /> : null}
      <Suspense fallback={null}>
        {solid ? (
          <>
            <DishLights />
            <RevealSpin onReady={onReady}>
              <RecipeDish recipe={recipe} />
            </RevealSpin>
            {steam ? <DishSteam width={1.2} height={1.4} y={0.3} /> : null}
          </>
        ) : (
          <LivingDish image={image} depth={depth} steam={steam} fit={0.86} onReady={onReady} />
        )}
      </Suspense>
      <OrbitControls
        target={solid ? SOLID_TARGET : undefined}
        enableZoom={false}
        enablePan={false}
        autoRotate={solid && !touched}
        autoRotateSpeed={1.2}
        minPolarAngle={solid ? 0.45 : Math.PI / 2 - PHOTO_SWING}
        maxPolarAngle={solid ? 1.1 : Math.PI / 2 + PHOTO_SWING}
        minAzimuthAngle={solid ? -Infinity : -PHOTO_SWING}
        maxAzimuthAngle={solid ? Infinity : PHOTO_SWING}
        onStart={() => setTouched(true)}
      />
    </Canvas>
  );
}
