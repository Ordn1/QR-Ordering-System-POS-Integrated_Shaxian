import { PerspectiveCamera, View } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';

import { listItems } from '../../api/menu';
import DishLights from '../../components/customer/DishLights';
import RecipeDish from '../../components/customer/RecipeDish';
import { hasRecipe } from '../../lib/dishes/build';
import { menuImageUrl } from '../../lib/menuImage';

const OVERLAY = { position: 'fixed', inset: 0, pointerEvents: 'none' };
const TURN_SPEED = 0.35;

function Turntable({ recipe }) {
  const spin = useRef(null);
  useFrame((_, delta) => {
    spin.current.rotation.y += delta * TURN_SPEED;
  });
  return (
    <group ref={spin}>
      <RecipeDish recipe={recipe} />
    </group>
  );
}

export default function DishesPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    listItems().then((next) => setItems(next.filter((item) => hasRecipe(item.model_filename))));
  }, []);

  return (
    <main className="dishes-page">
      <h1>Dish kit</h1>
      <div className="dishes-grid">
        {items.map((item) => (
          <figure className="dishes-cell" key={item.item_id}>
            <img className="dishes-photo" src={menuImageUrl(item.image_filename)} alt="" />
            <View className="dishes-view">
              <PerspectiveCamera makeDefault position={[0, 2.3, 3.2]} fov={34} onUpdate={(camera) => camera.lookAt(0, 0.25, 0)} />
              <DishLights />
              <Suspense fallback={null}>
                <Turntable recipe={item.model_filename} />
              </Suspense>
            </View>
            <figcaption>
              {item.name_en} · {item.model_filename}
            </figcaption>
          </figure>
        ))}
      </div>
      <Canvas style={OVERLAY} eventSource={document.body} gl={{ alpha: true }} dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </main>
  );
}
