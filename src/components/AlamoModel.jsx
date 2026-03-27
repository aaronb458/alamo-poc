import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ════════════════════════════════════════════════════════════════════════════
// WIREFRAME SHADER -- Tron-style glowing wireframe with ORANGE edges + BLUE surfaces
// Orange/amber glowing edges, blue/cyan data grid on faces, pure black bg
// ════════════════════════════════════════════════════════════════════════════

// Surface shader -- blue/cyan data grid texture on faces
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
    float fresnelEdge = pow(fresnel, 2.5);

    // Blue/cyan data grid on surfaces
    vec3 cyan    = vec3(0.0, 0.75, 1.0);   // #00BFFF
    vec3 blue    = vec3(0.0, 0.53, 1.0);   // #0088FF
    vec3 deepBlue = vec3(0.0, 0.15, 0.35);

    // Create a data grid pattern using world position
    float gridScale = 2.0;
    vec2 grid1 = abs(fract(vWorldPosition.xz * gridScale) - 0.5);
    vec2 grid2 = abs(fract(vWorldPosition.xy * gridScale) - 0.5);
    vec2 grid3 = abs(fract(vWorldPosition.yz * gridScale) - 0.5);

    // Triplanar blending for grid
    vec3 blending = abs(n);
    blending = normalize(max(blending, 0.00001));

    float gx = min(grid1.x, grid1.y) * blending.y;
    float gy = min(grid2.x, grid2.y) * blending.z;
    float gz = min(grid3.x, grid3.y) * blending.x;
    float gridVal = gx + gy + gz;
    float gridLine = 1.0 - smoothstep(0.0, 0.06, gridVal);

    // Scanning line effect
    float scanLine = sin(vWorldPosition.y * 8.0 - time * 2.0) * 0.5 + 0.5;
    scanLine = pow(scanLine, 8.0) * 0.3;

    // Base surface color -- deep blue with grid overlay
    vec3 col = deepBlue * 0.3;
    col += cyan * gridLine * 0.8;
    col += blue * scanLine * 0.2;

    // Fresnel edge glow in orange/amber (transition color between surface and edges)
    vec3 amber = vec3(1.0, 0.42, 0.0);  // #FF6B00
    col += amber * fresnelEdge * 1.0;

    // Subtle pulse
    float pulse = sin(time * 1.2) * 0.1 + 0.9;
    col *= pulse;

    float alpha = (0.25 + gridLine * 0.6 + fresnelEdge * 0.5) * uWireframeOpacity;

    gl_FragColor = vec4(col, alpha);
  }
`

// Edge line shader -- BRIGHT ORANGE/AMBER glowing wireframe lines
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
    float pulse = sin(time * 1.5) * 0.08 + 0.92;
    // Bright orange with extra intensity for bloom to catch
    vec3 col = uLineColor * 3.0 * pulse;
    gl_FragColor = vec4(col, uWireframeOpacity * 0.95);
  }
`

// Outline pass (back-face hull for orange silhouette glow)
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
    vec3 orange = vec3(1.0, 0.42, 0.0);   // #FF6B00
    vec3 amber  = vec3(1.0, 0.65, 0.0);   // #FFA500
    vec3 col = mix(orange, amber, 0.3) * 1.4 * pulse;
    gl_FragColor = vec4(col, uWireframeOpacity * 0.5);
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

  const { mergedGeo, mergedEdgeGeo, groupScale, groupOffset } = useMemo(() => {
    const allGeos = []

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

    // Collect all mesh geometries, deduplicate by bounding box overlap
    const meshData = []
    scene.traverse((child) => {
      if (!child.isMesh) return
      const geo = child.geometry.clone()
      child.updateWorldMatrix(true, false)
      geo.applyMatrix4(child.matrixWorld)
      geo.computeVertexNormals()

      // Check for near-duplicate bounding boxes
      const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position)
      const boxCenter = new THREE.Vector3()
      const boxSize = new THREE.Vector3()
      box.getCenter(boxCenter)
      box.getSize(boxSize)

      let isDuplicate = false
      for (const existing of meshData) {
        const dist = boxCenter.distanceTo(existing.center)
        const sizeDiff = boxSize.distanceTo(existing.size)
        // If centers are within 0.1 and sizes within 0.1, skip as duplicate
        if (dist < 0.1 && sizeDiff < 0.1) {
          isDuplicate = true
          break
        }
      }

      if (!isDuplicate) {
        // Ensure geometry is non-indexed for consistent merging
        const nonIndexedGeo = geo.index ? geo.toNonIndexed() : geo

        // Ensure UVs exist (needed by textured shader)
        if (!nonIndexedGeo.attributes.uv) {
          const posCount = nonIndexedGeo.attributes.position.count
          const uvs = new Float32Array(posCount * 2)
          for (let j = 0; j < posCount; j++) {
            uvs[j * 2] = 0
            uvs[j * 2 + 1] = 0
          }
          nonIndexedGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        }

        nonIndexedGeo.computeVertexNormals()
        meshData.push({ geo: nonIndexedGeo, center: boxCenter, size: boxSize })
        allGeos.push(nonIndexedGeo)
      }
    })

    // Merge all unique geometries into one
    const mergedGeo = mergeGeometries(allGeos)
    if (!mergedGeo) {
      // Fallback: use first geometry if merge fails
      console.warn('Geometry merge failed, using first geometry')
      const fallback = allGeos[0] || new THREE.BufferGeometry()
      fallback.computeVertexNormals()
      return {
        mergedGeo: fallback,
        mergedEdgeGeo: new THREE.EdgesGeometry(fallback, 15),
        groupScale: scale,
        groupOffset: offset,
      }
    }
    mergedGeo.computeVertexNormals()

    // Create single edge geometry from the merged result
    const mergedEdgeGeo = new THREE.EdgesGeometry(mergedGeo, 15)

    return { mergedGeo, mergedEdgeGeo, groupScale: scale, groupOffset: offset }
  }, [scene])

  // Build shader materials
  const {
    wireSurfaceMat, edgeMat, outlineMat, texturedMat
  } = useMemo(() => {
    // BRIGHT ORANGE for wireframe edges
    const lineColor = new THREE.Color(0xFF6B00)

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
    // Wireframe fully visible at 0%, starts fading at 40%, gone by 70%
    // Texture starts at 40%, fully visible by 70%
    const transitionStart = 0.40
    const transitionEnd = 0.70
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
      {/* Layer 1: Blue/cyan data grid surface */}
      <mesh
        geometry={mergedGeo}
        material={wireSurfaceMat}
        renderOrder={2}
      />
      {/* Layer 2: ORANGE edge wireframe lines */}
      <lineSegments
        geometry={mergedEdgeGeo}
        material={edgeMat}
        renderOrder={3}
      />
      {/* Layer 3: Orange back-face outline hull */}
      <mesh
        geometry={mergedGeo}
        material={outlineMat}
        renderOrder={1}
      />
      {/* Layer 4: Textured surface (fades in on scroll) */}
      <mesh
        geometry={mergedGeo}
        material={texturedMat}
        renderOrder={4}
      />
    </group>
  )
}

useGLTF.preload('/alamo-v2.glb')
