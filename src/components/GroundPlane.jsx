import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Ground grid that fades out as wireframe transitions to textured
// Warm amber/gold grid lines instead of cyan
const GRID_VERT = `
  varying vec3 vWorldPos;
  varying float vDist;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vDist = length(worldPos.xz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const GRID_FRAG = `
  uniform float time;
  uniform float uGridOpacity;

  varying vec3 vWorldPos;
  varying float vDist;

  void main() {
    // Grid lines on xz plane -- Tron-style retro-futuristic
    float gridSize = 1.0;
    vec2 g = fract(vWorldPos.xz / gridSize);
    float lw = 0.035;
    float gx = step(1.0 - lw, g.x) + step(g.x, lw);
    float gy = step(1.0 - lw, g.y) + step(g.y, lw);
    float grid = clamp(gx + gy, 0.0, 1.0);

    // Section grid (5m) -- brighter major grid lines
    float sectionSize = 5.0;
    vec2 sg = fract(vWorldPos.xz / sectionSize);
    float slw = 0.018;
    float sgx = step(1.0 - slw, sg.x) + step(sg.x, slw);
    float sgy = step(1.0 - slw, sg.y) + step(sg.y, slw);
    float sectionGrid = clamp(sgx + sgy, 0.0, 1.0);

    // Distance fade -- recede into darkness
    float fadeStart = 20.0;
    float fadeEnd   = 55.0;
    float fade = 1.0 - smoothstep(fadeStart, fadeEnd, vDist);

    // Pulse ripple -- subtle energy flowing through the grid
    float ripple = sin(vDist * 0.35 - time * 1.2) * 0.06 + 0.94;

    // Warm amber/gold -- #C4A265 palette
    vec3 gridColor    = vec3(0.77, 0.64, 0.40);  // #C4A265 gold
    vec3 sectionColor = vec3(0.83, 0.58, 0.23);  // #D4943A amber (brighter for major lines)

    vec3 col = vec3(0.0);
    col = mix(col, gridColor,    grid * 1.0);
    col = mix(col, sectionColor, sectionGrid * 1.2);
    col *= ripple;

    float alpha = (grid * 0.45 + sectionGrid * 0.55) * fade * uGridOpacity;
    if (alpha < 0.005) discard;

    gl_FragColor = vec4(col, alpha);
  }
`

export default function GroundPlane({ scrollRef }) {
  const matRef = useRef()

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.time.value = clock.elapsedTime
      // Grid fades out as we transition to textured
      const scrollP = scrollRef ? scrollRef.current : 0
      const gridFade = 1.0 - Math.max(0, Math.min(1, (scrollP - 0.15) / 0.35))
      matRef.current.uniforms.uGridOpacity.value = gridFade
    }
  })

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      renderOrder={-3}
    >
      <planeGeometry args={[160, 160, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={GRID_VERT}
        fragmentShader={GRID_FRAG}
        uniforms={{
          time: { value: 0 },
          uGridOpacity: { value: 1.0 },
        }}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
