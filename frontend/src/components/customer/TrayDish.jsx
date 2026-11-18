import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

import { hasRecipe } from '../../lib/dishes/build';
import { menuDepthUrl, menuImageUrl } from '../../lib/menuImage';
import { damp, easeOut } from '../../lib/showcase';
import RecipeDish from './RecipeDish';
import ReliefSprite from './ReliefSprite';

const DROP_HEIGHT = 0.9;
const DROP_SECONDS = 0.55;
const LIFT_HEIGHT = 0.7;
const LIFT_SECONDS = 0.4;
const STACK_MAX = 3;
const STACK_STEP = [0.06, 0.04, -0.12];
const SOLID_SPAN = 2;

export default function TrayDish({ dish, slot, size, quantity = 1, leaving = false, onGone }) {
  const group = useRef(null);
  const timing = useRef({ born: null, left: null, gone: false });
  const solid = hasRecipe(dish.model_filename);
  const copies = Math.min(quantity, STACK_MAX);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    const clock = timing.current;
    if (clock.born === null) {
      clock.born = now;
    }
    const enter = easeOut((now - clock.born) / DROP_SECONDS);
    let lift = 0;
    if (leaving) {
      if (clock.left === null) {
        clock.left = now;
      }
      lift = easeOut((now - clock.left) / LIFT_SECONDS);
      if (lift >= 1 && !clock.gone) {
        clock.gone = true;
        onGone?.();
      }
    }
    const node = group.current;
    node.position.x = damp(node.position.x, slot[0], 10, delta);
    node.position.z = damp(node.position.z, slot[1], 10, delta);
    node.position.y = (1 - enter) * DROP_HEIGHT + lift * LIFT_HEIGHT;
    node.scale.setScalar(Math.max(0.001, Math.min(1, enter * 1.5) * (1 - lift)));
  });

  return (
    <group ref={group} position={[slot[0], DROP_HEIGHT, slot[1]]}>
      {Array.from({ length: copies }, (_, index) => (
        <group
          key={index}
          position={STACK_STEP.map((step) => step * index * (solid ? size : 1))}
        >
          {solid ? (
            <RecipeDish
              recipe={dish.model_filename}
              detail="low"
              shadow={index === 0}
              scale={size / SOLID_SPAN}
            />
          ) : (
            <ReliefSprite
              image={menuImageUrl(dish.image_filename)}
              depth={menuDepthUrl(dish.image_filename)}
              size={size}
            />
          )}
        </group>
      ))}
    </group>
  );
}
