import { SRGBColorSpace } from 'three';

export const reliefVertexShader = `
  uniform sampler2D uDepth;
  uniform float uRelief;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 displaced = position;
    displaced.z += texture2D(uDepth, uv).r * uRelief;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const reliefFragmentShader = `
  uniform mat3 normalMatrix;
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform vec2 uTexel;
  uniform vec2 uSize;
  uniform float uRelief;
  uniform float uOpacity;
  uniform vec3 uLight;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(uMap, vUv);
    if (color.a < 0.02) discard;
    float left = texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r;
    float right = texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r;
    float down = texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r;
    float up = texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r;
    vec3 local = normalize(vec3(
      -(right - left) * uRelief / (2.0 * uTexel.x * uSize.x),
      -(up - down) * uRelief / (2.0 * uTexel.y * uSize.y),
      1.0
    ));
    vec3 normal = normalize(normalMatrix * local);
    vec3 light = normalize(uLight);
    float diffuse = clamp(dot(normal, light), 0.0, 1.0);
    vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
    float sheen = pow(clamp(dot(normal, halfway), 0.0, 1.0), 48.0) * 0.16;
    gl_FragColor = vec4(color.rgb * (0.8 + 0.3 * diffuse) + sheen, color.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

const KEY_LIGHT = [-0.45, 0.65, 0.75];

export function reliefUniforms(map, depthMap, width, height, relief = 0) {
  return {
    uMap: { value: map },
    uDepth: { value: depthMap },
    uTexel: { value: [1 / depthMap.image.width, 1 / depthMap.image.height] },
    uSize: { value: [width, height] },
    uRelief: { value: relief },
    uOpacity: { value: relief ? 1 : 0 },
    uLight: { value: KEY_LIGHT },
  };
}

export function markPhoto([photo]) {
  photo.colorSpace = SRGBColorSpace;
}
