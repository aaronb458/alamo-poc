import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Volumetric haze planes -- warm amber/brown tones matching the palette

const HAZE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HAZE_FRAG = `
  uniform float time;
  uniform float opacity;
  uniform vec3 color;
  varying vec2 vUv;

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

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      val += noise(p) * amp;
      p *= 2.1;
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;
    float radial = 1.0 - smoothstep(0.0, 1.0, dist);
    radial = radial * radial;

    float n = fbm(vUv * 3.0 + time * 0.08);
    float n2 = fbm(vUv * 5.0 - time * 0.12);
    float noiseVal = n * 0.6 + n2 * 0.4;

    float alpha = radial * noiseVal * opacity;
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

const GROUND_FOG_FRAG = `
  uniform float time;
  uniform float opacity;
  uniform vec3 color;
  varying vec2 vUv;

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

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      val += noise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;
    float radial = 1.0 - smoothstep(0.0, 1.2, dist);
    radial = radial * radial * radial;

    float n = fbm(vUv * 2.0 + vec2(time * 0.04, time * 0.02));
    float n2 = fbm(vUv * 4.0 - vec2(time * 0.06, time * 0.03));
    float noiseVal = n * 0.7 + n2 * 0.3;

    float wisps = smoothstep(0.35, 0.65, noiseVal);

    float alpha = radial * wisps * opacity;
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

function HazePlane({ position, rotation, scale, color, opacity, speed }) {
  const matRef = useRef()
  const meshRef = useRef()
  const baseY = position[1]
  const baseX = position[0]

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (matRef.current) {
      matRef.current.uniforms.time.value = t * speed
    }
    if (meshRef.current) {
      meshRef.current.position.y = baseY + Math.sin(t * 0.15 * speed) * 0.4
      meshRef.current.position.x = baseX + Math.sin(t * 0.08 * speed + 1.5) * 0.3
    }
  })

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    opacity: { value: opacity },
    color: { value: new THREE.Color(color) },
  }), [opacity, color])

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[scale, scale, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={HAZE_VERT}
        fragmentShader={HAZE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        renderOrder={-1}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function GroundFogPlane({ position, rotation, scale, color, opacity, speed }) {
  const matRef = useRef()
  const meshRef = useRef()
  const baseX = position[0]
  const baseZ = position[2]

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (matRef.current) {
      matRef.current.uniforms.time.value = t * speed
    }
    if (meshRef.current) {
      meshRef.current.position.x = baseX + Math.sin(t * 0.06 * speed) * 0.5
      meshRef.current.position.z = baseZ + Math.cos(t * 0.04 * speed) * 0.3
    }
  })

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    opacity: { value: opacity },
    color: { value: new THREE.Color(color) },
  }), [opacity, color])

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[scale, scale, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={HAZE_VERT}
        fragmentShader={GROUND_FOG_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        renderOrder={-1}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function AtmosphericHaze({ isMobile = false }) {
  if (isMobile) {
    return (
      <>
        <GroundFogPlane position={[0, 0.05, 0]} rotation={[-1.57, 0, 0]} scale={28} color="#1a1208" opacity={0.10} speed={0.5} />
        <HazePlane position={[0, 0.3, 2]} rotation={[-0.3, 0, 0]} scale={20} color="#1a1208" opacity={0.08} speed={1} />
        <HazePlane position={[0, 0.5, -3]} rotation={[-0.2, 0.4, 0]} scale={24} color="#140e06" opacity={0.06} speed={0.7} />
        <HazePlane position={[0, 4, -8]} rotation={[0, 0, 0]} scale={40} color="#0a0806" opacity={0.05} speed={0.25} />
      </>
    )
  }

  return (
    <>
      {/* Ground fog -- warm brown/amber tones */}
      <GroundFogPlane position={[0, 0.02, 0]} rotation={[-1.57, 0, 0]} scale={32} color="#1a1208" opacity={0.16} speed={0.4} />
      <GroundFogPlane position={[-2, 0.04, 1]} rotation={[-1.57, 0, 0.3]} scale={26} color="#1c1409" opacity={0.14} speed={0.5} />
      <GroundFogPlane position={[3, 0.03, -1]} rotation={[-1.57, 0, -0.2]} scale={28} color="#18100a" opacity={0.12} speed={0.6} />

      {/* Low smoke */}
      <HazePlane position={[0, 0.15, 0]} rotation={[-1.5, 0, 0]} scale={28} color="#1a1208" opacity={0.12} speed={0.6} />
      <HazePlane position={[0, 0.25, 3]} rotation={[-0.4, 0, 0]} scale={22} color="#1a1208" opacity={0.14} speed={1} />
      <HazePlane position={[-3, 0.35, -2]} rotation={[-0.2, 0.6, 0.1]} scale={20} color="#1c160e" opacity={0.10} speed={0.8} />
      <HazePlane position={[4, 0.35, 1]} rotation={[-0.3, -0.4, -0.1]} scale={22} color="#181008" opacity={0.12} speed={1.2} />

      {/* Warm smoke -- amber tinted */}
      <HazePlane position={[-2, 0.5, 2]} rotation={[-0.3, 0.2, 0]} scale={18} color="#2a1a08" opacity={0.08} speed={0.9} />
      <HazePlane position={[3, 0.8, -1]} rotation={[-0.1, -0.5, 0]} scale={16} color="#2a1806" opacity={0.07} speed={1.1} />
      <HazePlane position={[0, 0.4, 4]} rotation={[-0.5, 0, 0.1]} scale={22} color="#281604" opacity={0.06} speed={0.7} />

      {/* Mid-level fog banks */}
      <HazePlane position={[0, 2, -4]} rotation={[0.1, 0, 0]} scale={36} color="#120e08" opacity={0.10} speed={0.5} />
      <HazePlane position={[-5, 3, 5]} rotation={[0, 0.8, 0]} scale={28} color="#1a140a" opacity={0.08} speed={0.6} />
      <HazePlane position={[5, 2.5, -2]} rotation={[0.2, -0.6, 0]} scale={32} color="#161008" opacity={0.09} speed={0.4} />

      {/* High atmosphere */}
      <HazePlane position={[0, 6, -6]} rotation={[0, 0, 0]} scale={48} color="#0e0a06" opacity={0.06} speed={0.3} />
      <HazePlane position={[-4, 7, 2]} rotation={[0.1, 0.5, 0]} scale={40} color="#0a0806" opacity={0.05} speed={0.25} />
      <HazePlane position={[0, 10, 0]} rotation={[0, 0, 0.1]} scale={55} color="#0c0a06" opacity={0.04} speed={0.2} />

      {/* Background depth */}
      <HazePlane position={[0, 4, -14]} rotation={[0, 0, 0]} scale={60} color="#0a0806" opacity={0.06} speed={0.2} />
      <HazePlane position={[0, 1, -18]} rotation={[0.1, 0, 0]} scale={70} color="#0e0c08" opacity={0.05} speed={0.15} />
    </>
  )
}
