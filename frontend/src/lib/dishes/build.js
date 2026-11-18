import { Box3, Group, Vector3 } from 'three';

import { seedOf } from '../showcase';
import { rng } from './random';
import { RECIPES } from './recipes';

const SPAN = 2;
const templates = new Map();

export function hasRecipe(key) {
  return Boolean(key && Object.hasOwn(RECIPES, key));
}

function template(key, detail) {
  const dish = RECIPES[key](rng(seedOf(key)), detail);
  const box = new Box3().setFromObject(dish);
  const size = box.getSize(new Vector3());
  dish.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const holder = new Group();
  holder.add(dish);
  const scale = SPAN / Math.max(size.x, size.z);
  holder.scale.setScalar(scale);
  holder.userData.height = size.y * scale;
  return holder;
}

export function buildDish(key, detail = 'high') {
  const id = `${key}:${detail}`;
  if (!templates.has(id)) {
    templates.set(id, template(key, detail));
  }
  const dish = templates.get(id).clone();
  dish.userData.height = templates.get(id).userData.height;
  return dish;
}
