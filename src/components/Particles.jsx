import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const EMBER_COUNT = 1500
const FIREFLY_COUNT = 200

// ── Ember/spark shader -- warm ORANGE/AMBER sparks rising ─────────────
const EMBER_FRAG = `
  uniform float time;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = (0.5 - d) * 2.0;
    alpha = alpha * alpha * alpha;

    float flicker = sin(time * 3.0 + gl_FragCoord.x * 0.1 + gl_FragCoord.y * 0.07) * 0.3 + 0.7;

    // Hot orange/amber embers
    vec3 orange = vec3(1.0, 0.42, 0.0);   // #FF6B00
    vec3 amber  = vec3(1.0, 0.65, 0.0);   // #FFA500
    vec3 col = mix(orange, amber, alpha * 0.5);

    gl_FragColor = vec4(col * 1.2, alpha * flicker * 0.6 * uOpacity);
  }
`

const EMBER_VERT = `
  uniform float time;
  attribute float phase;

  void main() {
    vec3 pos = position;
    pos.x += sin(time * 0.5 + phase * 12.56) * 0.15;
    pos.z += cos(time * 0.4 + phase * 9.42) * 0.12;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (2.5 + phase * 3.0) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// ── Firefly shader -- pulsing wandering orange orbs ─────────────────────
const FIREFLY_FRAG = `
  uniform float time;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = (0.5 - d) * 2.0;
    alpha = pow(alpha, 1.5);

    float seed = gl_FragCoord.x * 0.013 + gl_FragCoord.y * 0.017;
    float pulse = sin(time * 1.5 + seed * 6.28) * 0.5 + 0.5;
    pulse = pulse * pulse;

    vec3 orange = vec3(1.0, 0.42, 0.0);
    vec3 amber  = vec3(1.0, 0.65, 0.0);
    vec3 col = mix(orange, amber, pulse);

    gl_FragColor = vec4(col * 1.5, alpha * pulse * 0.7 * uOpacity);
  }
`

const FIREFLY_VERT = `
  uniform float time;
  attribute float phase;
  attribute float speed;

  void main() {
    vec3 pos = position;
    float t = time * speed;
    pos.x += sin(t * 0.7 + phase * 12.56) * 0.4;
    pos.y += sin(t * 0.5 + phase * 8.28) * 0.3 + cos(t * 0.3 + phase * 4.0) * 0.15;
    pos.z += cos(t * 0.6 + phase * 10.14) * 0.35;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (4.5 + phase * 3.5) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export default function Particles({ isMobile = false, scrollRef }) {
  const emberRef = useRef()
  const fireflyRef = useRef()
  const emberMat = useRef()
  const fireflyMat = useRef()

  const emberCount = isMobile ? 300 : EMBER_COUNT
  const fireflyCount = isMobile ? 40 : FIREFLY_COUNT

  const {
    emberPositions, emberVelocities, emberPhases,
    fireflyPositions, fireflyPhases, fireflySpeeds,
  } = useMemo(() => {
    // Embers
    const emberPositions = new Float32Array(emberCount * 3)
    const emberVelocities = new Float32Array(emberCount * 3)
    const emberPhases = new Float32Array(emberCount)
    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3]     = (Math.random() - 0.5) * 35
      emberPositions[i * 3 + 1] = Math.random() * 18
      emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 35

      const riseMult = 0.5 + Math.random() * 1.5
      emberVelocities[i * 3]     = (Math.random() - 0.5) * 0.003
      emberVelocities[i * 3 + 1] = (Math.random() * 0.007 + 0.002) * riseMult
      emberVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003

      emberPhases[i] = Math.random()
    }

    // Fireflies
    const fireflyPositions = new Float32Array(fireflyCount * 3)
    const fireflyPhases = new Float32Array(fireflyCount)
    const fireflySpeeds = new Float32Array(fireflyCount)
    for (let i = 0; i < fireflyCount; i++) {
      const spread = i < fireflyCount * 0.6 ? 16 : 35
      fireflyPositions[i * 3]     = (Math.random() - 0.5) * spread
      fireflyPositions[i * 3 + 1] = Math.random() * 10 + 0.5
      fireflyPositions[i * 3 + 2] = (Math.random() - 0.5) * spread

      fireflyPhases[i] = Math.random()
      fireflySpeeds[i] = 0.3 + Math.random() * 0.8
    }

    return {
      emberPositions, emberVelocities, emberPhases,
      fireflyPositions, fireflyPhases, fireflySpeeds,
    }
  }, [emberCount, fireflyCount])

  // Drift embers upward
  useFrame(() => {
    if (emberRef.current) {
      const pos = emberRef.current.geometry.attributes.position.array
      for (let i = 0; i < emberCount; i++) {
        pos[i * 3]     += emberVelocities[i * 3]
        pos[i * 3 + 1] += emberVelocities[i * 3 + 1]
        pos[i * 3 + 2] += emberVelocities[i * 3 + 2]
        if (pos[i * 3 + 1] > 22) {
          pos[i * 3 + 1] = Math.random() * 0.5
          pos[i * 3]     = (Math.random() - 0.5) * 35
          pos[i * 3 + 2] = (Math.random() - 0.5) * 35
        }
      }
      emberRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  // Update shader time + opacity based on scroll
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const scrollP = scrollRef ? scrollRef.current : 0

    // Particles are bright in wireframe phase, dimmer in textured phase
    const particleOpacity = 1.0 - Math.max(0, Math.min(0.6, (scrollP - 0.3) * 1.5))

    if (emberMat.current) {
      emberMat.current.uniforms.time.value = t
      emberMat.current.uniforms.uOpacity.value = particleOpacity
    }
    if (fireflyMat.current) {
      fireflyMat.current.uniforms.time.value = t
      fireflyMat.current.uniforms.uOpacity.value = particleOpacity
    }
  })

  return (
    <>
      {/* Rising ember particles -- orange sparks */}
      <points ref={emberRef} renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={emberPositions}
            count={emberCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-phase"
            array={emberPhases}
            count={emberCount}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={emberMat}
          vertexShader={EMBER_VERT}
          fragmentShader={EMBER_FRAG}
          uniforms={{
            time: { value: 0 },
            uOpacity: { value: 1.0 },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Firefly particles -- pulsing orange orbs */}
      <points ref={fireflyRef} renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={fireflyPositions}
            count={fireflyCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-phase"
            array={fireflyPhases}
            count={fireflyCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-speed"
            array={fireflySpeeds}
            count={fireflyCount}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={fireflyMat}
          vertexShader={FIREFLY_VERT}
          fragmentShader={FIREFLY_FRAG}
          uniforms={{
            time: { value: 0 },
            uOpacity: { value: 1.0 },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}
