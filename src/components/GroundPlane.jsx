import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Ground grid -- Tron-style glowing ORANGE/AMBER grid with reflective feel
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
    // Grid lines on xz plane -- Tron-style
    float gridSize = 1.0;
    vec2 g = fract(vWorldPos.xz / gridSize);
    float lw = 0.025;
    float gx = step(1.0 - lw, g.x) + step(g.x, lw);
    float gy = step(1.0 - lw, g.y) + step(g.y, lw);
    float grid = clamp(gx + gy, 0.0, 1.0);

    // Section grid (5m) -- brighter major grid lines
    float sectionSize = 5.0;
    vec2 sg = fract(vWorldPos.xz / sectionSize);
    float slw = 0.015;
    float sgx = step(1.0 - slw, sg.x) + step(sg.x, slw);
    float sgy = step(1.0 - slw, sg.y) + step(sg.y, slw);
    float sectionGrid = clamp(sgx + sgy, 0.0, 1.0);

    // Distance fade -- crisp near, fading far
    float fadeStart = 15.0;
    float fadeEnd   = 45.0;
    float fade = 1.0 - smoothstep(fadeStart, fadeEnd, vDist);

    // Pulse ripple -- energy flowing outward from center
    float ripple = sin(vDist * 0.4 - time * 1.5) * 0.08 + 0.92;

    // ORANGE/AMBER colors -- bright, glowing
    vec3 gridColor    = vec3(1.0, 0.42, 0.0);   // #FF6B00 orange
    vec3 sectionColor = vec3(1.0, 0.65, 0.0);   // #FFA500 amber (brighter for major lines)

    // Subtle ground glow near the building
    float centerGlow = exp(-vDist * 0.08) * 0.03;

    vec3 col = vec3(0.0);
    col = mix(col, gridColor * 0.8,    grid * 1.0);
    col = mix(col, sectionColor * 1.2, sectionGrid * 1.2);
    col *= ripple;

    // Add subtle orange ground glow
    col += vec3(1.0, 0.3, 0.0) * centerGlow;

    float alpha = (grid * 0.5 + sectionGrid * 0.6) * fade * uGridOpacity;
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
