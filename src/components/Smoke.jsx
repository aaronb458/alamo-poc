import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Particle-based volumetric smoke using noise-driven billboards
// Warm brown/amber tones (#3A2210) drifting left-to-right + rising

const SMOKE_COUNT = 40

const SMOKE_VERT = `
  attribute float size;
  attribute float phase;
  attribute float speed;
  uniform float time;

  varying float vPhase;
  varying float vAlpha;

  void main() {
    vPhase = phase;

    vec3 pos = position;
    // Drift left to right + slight rise
    float t = time * speed;
    pos.x += t * 0.8 + sin(t * 0.3 + phase * 6.28) * 1.5;
    pos.y += t * 0.15 + sin(t * 0.2 + phase * 4.0) * 0.4;
    pos.z += sin(t * 0.15 + phase * 8.0) * 0.8;

    // Wrap around when drifted too far right
    float wrapX = 35.0;
    pos.x = mod(pos.x + wrapX, wrapX * 2.0) - wrapX;

    // Wrap Y
    if (pos.y > 12.0) pos.y -= 12.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Distance-based fade
    float dist = -mvPosition.z;
    vAlpha = smoothstep(60.0, 5.0, dist) * smoothstep(0.0, 3.0, dist);

    gl_PointSize = size * (300.0 / dist);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const SMOKE_FRAG = `
  uniform float time;
  varying float vPhase;
  varying float vAlpha;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = gl_PointCoord;
    float d = length(uv - 0.5) * 2.0;

    // Soft circular falloff
    float circle = 1.0 - smoothstep(0.0, 1.0, d);
    circle = circle * circle;

    // Noise-based wisps within the particle
    float n = noise(uv * 3.0 + vec2(vPhase * 10.0, time * 0.1));
    float n2 = noise(uv * 5.0 - vec2(time * 0.15, vPhase * 8.0));
    float wisp = n * 0.6 + n2 * 0.4;
    wisp = smoothstep(0.25, 0.7, wisp);

    float alpha = circle * wisp * vAlpha * 0.12;
    if (alpha < 0.002) discard;

    // Warm brown/amber smoke color
    vec3 col = vec3(0.227, 0.133, 0.063); // #3A2210
    col = mix(col, vec3(0.30, 0.18, 0.08), wisp * 0.3);

    gl_FragColor = vec4(col, alpha);
  }
`

export default function Smoke({ isMobile = false, scrollRef }) {
  const matRef = useRef()

  const count = isMobile ? 15 : SMOKE_COUNT

  const { positions, sizes, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Spread across the scene, biased toward ground level
      positions[i * 3] = (Math.random() - 0.5) * 50
      positions[i * 3 + 1] = Math.random() * 8 + 0.2
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40

      sizes[i] = 4.0 + Math.random() * 8.0
      phases[i] = Math.random()
      speeds[i] = 0.15 + Math.random() * 0.35
    }

    return { positions, sizes, phases, speeds }
  }, [count])

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.time.value = clock.elapsedTime
    }
  })

  return (
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          array={sizes}
          count={count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-phase"
          array={phases}
          count={count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-speed"
          array={speeds}
          count={count}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={SMOKE_VERT}
        fragmentShader={SMOKE_FRAG}
        uniforms={{
          time: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  )
}
