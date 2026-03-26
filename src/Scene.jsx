import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import AlamoModel from './components/AlamoModel'
import GroundPlane from './components/GroundPlane'
import Particles from './components/Particles'
import Smoke from './components/Smoke'

// smoothstep easing
function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

// Desktop camera keyframes: [x, y, z, lookY]
const CAM_START_D   = [2, 2.2, 5.0, 1.8]
const CAM_PHASE1_D  = [3.5, 2.8, 7.0, 1.6]
const CAM_PHASE2_D  = [-1.5, 3.5, 10.0, 1.5]
const CAM_PHASE3_D  = [-3.0, 4.5, 13.0, 1.3]
const CAM_PHASE4_D  = [0, 4.0, 16.0, 1.2]

// Mobile keyframes
const CAM_START_M   = [1.5, 2.0, 7.0, 1.6]
const CAM_PHASE1_M  = [2.0, 2.6, 9.0, 1.5]
const CAM_PHASE2_M  = [-0.5, 3.2, 12.0, 1.4]
const CAM_PHASE3_M  = [-1.5, 4.0, 14.0, 1.3]
const CAM_PHASE4_M  = [0, 3.8, 16.0, 1.2]

function lerp4(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]
}

function CameraController({ scrollRef, isMobile }) {
  useFrame(({ camera }) => {
    const p = scrollRef.current

    const S  = isMobile ? CAM_START_M  : CAM_START_D
    const P1 = isMobile ? CAM_PHASE1_M : CAM_PHASE1_D
    const P2 = isMobile ? CAM_PHASE2_M : CAM_PHASE2_D
    const P3 = isMobile ? CAM_PHASE3_M : CAM_PHASE3_D
    const P4 = isMobile ? CAM_PHASE4_M : CAM_PHASE4_D

    let cam
    if (p <= 0.25) {
      cam = lerp4(S, P1, smoothstep(p / 0.25))
    } else if (p <= 0.50) {
      cam = lerp4(P1, P2, smoothstep((p - 0.25) / 0.25))
    } else if (p <= 0.75) {
      cam = lerp4(P2, P3, smoothstep((p - 0.50) / 0.25))
    } else {
      cam = lerp4(P3, P4, smoothstep((p - 0.75) / 0.25))
    }

    camera.position.set(cam[0], cam[1], cam[2])
    camera.lookAt(0, cam[3], 0)
  })

  return null
}

export default function Scene({ scrollRef, isMobile = false }) {
  return (
    <>
      {/* Pure black background -- crisp, high contrast Tron look */}
      <color attach="background" args={['#000000']} />
      {/* NO fog -- clean, sharp, high contrast */}

      <CameraController scrollRef={scrollRef} isMobile={isMobile} />
      <AlamoModel scrollRef={scrollRef} />
      <GroundPlane scrollRef={scrollRef} />
      <Particles isMobile={isMobile} scrollRef={scrollRef} />
      <Smoke isMobile={isMobile} scrollRef={scrollRef} />

      <EffectComposer>
        <Bloom
          intensity={isMobile ? 1.5 : 2.5}
          luminanceThreshold={isMobile ? 0.12 : 0.08}
          luminanceSmoothing={0.4}
          mipmapBlur={!isMobile}
          radius={isMobile ? 0.5 : 0.8}
        />
        <Vignette
          eskil={false}
          offset={0.3}
          darkness={0.3}
        />
      </EffectComposer>
    </>
  )
}
