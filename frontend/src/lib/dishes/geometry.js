import { BufferAttribute, Color, InstancedMesh, LatheGeometry, Mesh, Object3D, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { brandColor } from '../showcase';

export function lathe(profile, segments = 48) {
  return new LatheGeometry(
    profile.map(([radius, height]) => new Vector2(radius, height)),
    segments,
  );
}

export function displace(geometry, move) {
  const position = geometry.attributes.position;
  const point = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    move(point, index);
    position.setXYZ(index, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function paint(geometry, colorAt) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const point = new Vector3();
  const color = new Color();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    color.set(colorAt(point));
    colors.set([color.r, color.g, color.b], index * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

export function tokenColor(token) {
  return new Color(brandColor(token));
}

export function blend(fromToken, toToken, amount) {
  return tokenColor(fromToken).lerp(tokenColor(toToken), Math.min(Math.max(amount, 0), 1));
}

export function merge(geometries) {
  const prepared = geometries.map((geometry) => {
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    ['uv1', 'uv2'].forEach((name) => copy.deleteAttribute(name));
    return copy;
  });
  const names = Object.keys(prepared[0].attributes).filter((name) =>
    prepared.every((geometry) => geometry.attributes[name]),
  );
  prepared.forEach((geometry) => {
    Object.keys(geometry.attributes)
      .filter((name) => !names.includes(name))
      .forEach((name) => geometry.deleteAttribute(name));
  });
  return mergeGeometries(prepared);
}

export function mesh(geometry, material, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = {}) {
  const result = new Mesh(geometry, material);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  return result;
}

export function instanced(geometry, material, placements) {
  const result = new InstancedMesh(geometry, material, placements.length);
  const dummy = new Object3D();
  placements.forEach(({ position, rotation = [0, 0, 0], scale = 1 }, index) => {
    dummy.position.set(...position);
    dummy.rotation.set(...rotation);
    dummy.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
    dummy.updateMatrix();
    result.setMatrixAt(index, dummy.matrix);
  });
  result.instanceMatrix.needsUpdate = true;
  result.computeBoundingSphere();
  return result;
}

export function memo(build) {
  const cache = new Map();
  return (key = 'default', ...rest) => {
    if (!cache.has(key)) {
      cache.set(key, build(key, ...rest));
    }
    return cache.get(key);
  };
}
