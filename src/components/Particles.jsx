import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const DUST_COUNT = 4000
const EMBER_COUNT = 1200
const FIREFLY_COUNT = 150

// ── Ember/spark shader -- warm orange dots that rise slowly ─────────────
const EMBER_FRAG = `
  uniform float time;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = (0.5 - d) * 2.0;
    alpha = alpha * alpha * alpha;

    float flicker = sin(time * 3.0 + gl_FragCoord.x * 0.1 + gl_FragCoord.y * 0.07) * 0.3 + 0.7;

    // Warm amber from palette
    vec3 amber = vec3(0.83, 0.58, 0.23);
    vec3 gold  = vec3(0.77, 0.64, 0.40);
    vec3 col = mix(amber, gold, alpha * 0.5);

    gl_FragColor = vec4(col, alpha * flicker * 0.5 * uOpacity);
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
    gl_PointSize = (2.0 + phase * 2.5) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// ── Firefly shader -- pulsing wandering golden orbs ─────────────────────
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

    vec3 gold = vec3(0.77, 0.64, 0.40);
    vec3 amber = vec3(0.83, 0.58, 0.23);
    vec3 col = mix(amber, gold, pulse);

    gl_FragColor = vec4(col * 1.3, alpha * pulse * 0.7 * uOpacity);
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
    gl_PointSize = (4.0 + phase * 3.0) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export default function Particles({ isMobile = false, scrollRef }) {
  const dustRef = useRef()
  const emberRef = useRef()
  const fireflyRef = useRef()
  const emberMat = useRef()
  const fireflyMat = useRef()

  const dustCount = isMobile ? 600 : DUST_COUNT
  const emberCount = isMobile ? 200 : EMBER_COUNT
  const fireflyCount = isMobile ? 30 : FIREFLY_COUNT

  const {
    dustPositions, dustVelocities,
    emberPositions, emberVelocities, emberPhases,
    fireflyPositions, fireflyPhases, fireflySpeeds,
  } = useMemo(() => {
    // Dust particles -- tiny, drifting, subtle
    const dustPositions = new Float32Array(dustCount * 3)
    const dustVelocities = new Float32Array(dustCount * 3)

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3]     = (Math.random() - 0.5) * 60
      dustPositions[i * 3 + 1] = Math.random() * 25 + 0.3
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 60

      const speedMult = 0.3 + Math.random() * 1.5
      dustVelocities[i * 3]     = (Math.random() - 0.5) * 0.003 * speedMult
      dustVelocities[i * 3 + 1] = (Math.random() * 0.003 + 0.0003) * speedMult
      dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003 * speedMult
    }

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
      dustPositions, dustVelocities,
      emberPositions, emberVelocities, emberPhases,
      fireflyPositions, fireflyPhases, fireflySpeeds,
    }
  }, [dustCount, emberCount, fireflyCount])

  // Drift dust and embers
  useFrame(() => {
    if (dustRef.current) {
      const pos = dustRef.current.geometry.attributes.position.array
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3]     += dustVelocities[i * 3]
        pos[i * 3 + 1] += dustVelocities[i * 3 + 1]
        pos[i * 3 + 2] += dustVelocities[i * 3 + 2]
        if (pos[i * 3 + 1] > 28) {
          pos[i * 3 + 1] = 0.3
          pos[i * 3]     = (Math.random() - 0.5) * 60
          pos[i * 3 + 2] = (Math.random() - 0.5) * 60
        }
      }
      dustRef.current.geometry.attributes.position.needsUpdate = true
    }

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

  // Dust color transitions from cool to warm based on scroll
  const dustColor = useMemo(() => new THREE.Color('#C4A265'), [])

  return (
    <>
      {/* Dust particles -- tiny warm dots */}
      <points ref={dustRef} renderOrder={-2}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={dustPositions}
            count={dustCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={dustColor}
          size={0.025}
          sizeAttenuation
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Rising ember particles */}
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

      {/* Firefly particles -- golden wandering orbs */}
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
