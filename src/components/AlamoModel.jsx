import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ════════════════════════════════════════════════════════════════════════════
// WIREFRAME SHADER -- Tron-style glowing wireframe using EdgesGeometry overlay
// The wireframe layer sits on top of the model and fades out as user scrolls.
// The textured layer fades IN simultaneously.
// ════════════════════════════════════════════════════════════════════════════

// Surface shader -- holographic skin with fresnel edge glow
// This represents the "wireframe phase" of the model
const WIRE_SURFACE_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const WIRE_SURFACE_FRAG = `
  uniform float time;
  uniform float uWireframeOpacity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 n = normalize(vNormal);
    float fresnel = 1.0 - abs(dot(n, viewDir));
    float fresnelEdge = pow(fresnel, 2.0);

    // Warm amber/gold colors from the palette
    vec3 base   = vec3(0.005, 0.004, 0.002);
    vec3 amber  = vec3(0.83, 0.58, 0.23);  // #D4943A
    vec3 gold   = vec3(0.77, 0.64, 0.40);  // #C4A265

    vec3 col = base;

    // Amber fresnel edge glow -- pulsing
    float pulse = sin(time * 1.2) * 0.15 + 0.85;
    col += amber * fresnelEdge * 2.2 * pulse;

    // Gold accent
    col += gold * pow(fresnel, 3.0) * 0.5;

    // Height gradient
    float heightGrad = smoothstep(-0.5, 5.0, vWorldPosition.y) * 0.02;
    col += gold * heightGrad;

    float alpha = (0.08 + fresnelEdge * 0.7) * uWireframeOpacity;

    gl_FragColor = vec4(col, alpha);
  }
`

// Edge line shader -- the glowing wireframe lines
const EDGE_VERT = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const EDGE_FRAG = `
  uniform float time;
  uniform float uWireframeOpacity;
  uniform vec3 uLineColor;

  void main() {
    float pulse = sin(time * 1.5) * 0.10 + 0.90;
    vec3 col = uLineColor * 1.2 * pulse;
    gl_FragColor = vec4(col, uWireframeOpacity * 0.85);
  }
`

// Outline pass (back-face hull for silhouette)
const OUTLINE_VERT = `
  uniform float outlineWidth;

  void main() {
    vec3 pos = position + normal * outlineWidth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const OUTLINE_FRAG = `
  uniform float time;
  uniform float uWireframeOpacity;

  void main() {
    float pulse = sin(time * 0.8) * 0.06 + 0.94;
    vec3 amber = vec3(0.83, 0.58, 0.23);
    vec3 gold  = vec3(0.77, 0.64, 0.40);
    vec3 col = mix(amber, gold, 0.3) * 1.2 * pulse;
    gl_FragColor = vec4(col, uWireframeOpacity * 0.6);
  }
`

// Textured surface shader -- the "revealed" limestone/stone look
const TEXTURED_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const TEXTURED_FRAG = `
  uniform float time;
  uniform float uTextureOpacity;
  uniform sampler2D uLimestone;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 n = normalize(vNormal);

    // Sample limestone texture
    vec2 texCoord = vUv;
    // Triplanar fallback for meshes without good UVs
    vec3 blending = abs(n);
    blending = normalize(max(blending, 0.00001));
    float b = blending.x + blending.y + blending.z;
    blending /= vec3(b, b, b);

    vec3 xaxis = texture2D(uLimestone, vWorldPosition.yz * 0.15).rgb;
    vec3 yaxis = texture2D(uLimestone, vWorldPosition.xz * 0.15).rgb;
    vec3 zaxis = texture2D(uLimestone, vWorldPosition.xy * 0.15).rgb;
    vec3 texColor = xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;

    // Warm it up to match the palette
    texColor = mix(texColor, vec3(0.91, 0.86, 0.78), 0.3); // #E8DCC8

    // Subtle directional lighting
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diffuse = max(dot(n, lightDir), 0.0) * 0.6 + 0.4;

    // Fresnel rim for depth
    float fresnel = 1.0 - abs(dot(n, viewDir));
    float rim = pow(fresnel, 3.0) * 0.2;

    vec3 col = texColor * diffuse;
    col += vec3(0.77, 0.64, 0.40) * rim; // gold rim

    // Height-based darkening at base
    float heightFade = smoothstep(-0.5, 2.0, vWorldPosition.y);
    col *= 0.7 + heightFade * 0.3;

    float alpha = uTextureOpacity;

    gl_FragColor = vec4(col, alpha);
  }
`

// ════════════════════════════════════════════════════════════════════════════

export default function AlamoModel({ scrollRef }) {
  const { scene } = useGLTF('/alamo-v2.glb')
  const materialsRef = useRef([])
  const limestoneTexRef = useRef(null)

  // Load limestone texture
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load('/limestone.jpg', (tex) => {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      limestoneTexRef.current = tex
    })
  }, [])

  const { geos, edgeGeos, groupScale, groupOffset } = useMemo(() => {
    const geos = []
    const edgeGeos = []

    // Compute world-space bounding box
    const worldBox = new THREE.Box3()
    scene.traverse((child) => {
      if (child.isMesh) {
        child.updateWorldMatrix(true, false)
        const childBox = new THREE.Box3().setFromObject(child)
        worldBox.union(childBox)
      }
    })

    const size = new THREE.Vector3()
    worldBox.getSize(size)
    const center = new THREE.Vector3()
    worldBox.getCenter(center)

    // Scale so the model is ~10 units wide
    const targetWidth = 10
    const scale = targetWidth / Math.max(size.x, size.z, 0.001)

    const offset = new THREE.Vector3(
      -center.x * scale,
      -worldBox.min.y * scale,
      -center.z * scale,
    )

    scene.traverse((child) => {
      if (!child.isMesh) return
      const geo = child.geometry.clone()
      child.updateWorldMatrix(true, false)
      geo.applyMatrix4(child.matrixWorld)
      geo.computeVertexNormals()
      geos.push(geo)

      // Create edge geometry for wireframe lines
      const edges = new THREE.EdgesGeometry(geo, 15) // 15 degree threshold
      edgeGeos.push(edges)
    })

    return { geos, edgeGeos, groupScale: scale, groupOffset: offset }
  }, [scene])

  // Build shader materials
  const {
    wireSurfaceMat, edgeMat, outlineMat, texturedMat
  } = useMemo(() => {
    const lineColor = new THREE.Color(0xC4A265)

    const wireSurfaceMat = new THREE.ShaderMaterial({
      vertexShader: WIRE_SURFACE_VERT,
      fragmentShader: WIRE_SURFACE_FRAG,
      uniforms: {
        time: { value: 0 },
        uWireframeOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const edgeMat = new THREE.ShaderMaterial({
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
      uniforms: {
        time: { value: 0 },
        uWireframeOpacity: { value: 1.0 },
        uLineColor: { value: lineColor },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const outlineMat = new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      uniforms: {
        time: { value: 0 },
        outlineWidth: { value: 0.12 },
        uWireframeOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })

    // Placeholder white texture until limestone loads
    const placeholderTex = new THREE.DataTexture(
      new Uint8Array([232, 220, 200, 255]),
      1, 1, THREE.RGBAFormat
    )
    placeholderTex.needsUpdate = true

    const texturedMat = new THREE.ShaderMaterial({
      vertexShader: TEXTURED_VERT,
      fragmentShader: TEXTURED_FRAG,
      uniforms: {
        time: { value: 0 },
        uTextureOpacity: { value: 0.0 },
        uLimestone: { value: placeholderTex },
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: true,
    })

    materialsRef.current = [wireSurfaceMat, edgeMat, outlineMat, texturedMat]
    return { wireSurfaceMat, edgeMat, outlineMat, texturedMat }
  }, [])

  // Drive uniforms per frame
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const scrollP = scrollRef.current

    // Wireframe-to-texture transition mapped to scroll
    // Wireframe fully visible at 0%, starts fading at 20%, gone by 55%
    // Texture starts at 20%, fully visible by 55%
    const transitionStart = 0.20
    const transitionEnd = 0.55
    const rawT = Math.max(0, Math.min(1, (scrollP - transitionStart) / (transitionEnd - transitionStart)))
    // Smooth it
    const transition = rawT * rawT * (3 - 2 * rawT)

    const wireOpacity = 1.0 - transition
    const texOpacity = transition

    // Update limestone texture if loaded
    if (limestoneTexRef.current && texturedMat.uniforms.uLimestone.value !== limestoneTexRef.current) {
      texturedMat.uniforms.uLimestone.value = limestoneTexRef.current
    }

    materialsRef.current.forEach((m) => {
      m.uniforms.time.value = t
    })

    wireSurfaceMat.uniforms.uWireframeOpacity.value = wireOpacity
    edgeMat.uniforms.uWireframeOpacity.value = wireOpacity
    outlineMat.uniforms.uWireframeOpacity.value = wireOpacity
    texturedMat.uniforms.uTextureOpacity.value = texOpacity

    // Toggle visibility for performance
    wireSurfaceMat.visible = wireOpacity > 0.01
    edgeMat.visible = wireOpacity > 0.01
    outlineMat.visible = wireOpacity > 0.01
    texturedMat.visible = texOpacity > 0.01
  })

  return (
    <group scale={groupScale} position={groupOffset}>
      {geos.map((geo, i) => (
        <group key={i}>
          {/* Layer 1: Wireframe holographic surface */}
          <mesh
            geometry={geo}
            material={wireSurfaceMat}
            renderOrder={2}
          />
          {/* Layer 2: Edge wireframe lines */}
          <lineSegments
            geometry={edgeGeos[i]}
            material={edgeMat}
            renderOrder={3}
          />
          {/* Layer 3: Back-face outline hull */}
          <mesh
            geometry={geo}
            material={outlineMat}
            renderOrder={1}
          />
          {/* Layer 4: Textured surface (fades in on scroll) */}
          <mesh
            geometry={geo}
            material={texturedMat}
            renderOrder={4}
          />
        </group>
      ))}
    </group>
  )
}

useGLTF.preload('/alamo-v2.glb')
