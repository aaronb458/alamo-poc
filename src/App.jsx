import { useRef, useEffect, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Mobile detection
const isMobile = typeof window !== 'undefined' && (
  window.innerWidth < 768 ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024)
)
const MAX_DPR = isMobile ? 1 : 1.5
const dpr = typeof window !== 'undefined'
  ? [1, Math.min(window.devicePixelRatio, MAX_DPR)]
  : [1, 1]

// ── Loading Screen ───────────────────────────────────────────────────────
function LoadingScreen({ progress }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100vh',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'Oswald', 'Bebas Neue', Impact, sans-serif",
      color: '#FF6B00',
    }}>
      <div style={{
        fontSize: 'clamp(1rem, 2vw, 1.4rem)',
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        marginBottom: '2rem',
        fontWeight: 500,
      }}>
        Loading
      </div>
      <div style={{
        width: '200px',
        height: '2px',
        background: 'rgba(255, 107, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #FF6B00, #FFA500)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// ── Background Layer ────────────────────────────────────────────────────
function BackgroundLayer({ scrollProgress }) {
  // Dark at start, transition to golden hour landscape during wireframe-to-texture phase
  const bgOpacity = Math.max(0, Math.min(1, (scrollProgress - 0.40) / 0.30))

  return (
    <div className="bg-layer">
      <div className="bg-image bg-dark" style={{ opacity: 1 }} />
      <div
        className="bg-image bg-golden-hour"
        style={{
          opacity: bgOpacity * 0.35,
          transform: `scale(${1 + scrollProgress * 0.08}) translateY(${-scrollProgress * 3}%)`,
        }}
      />
      {/* Warm overlay that fades in with the landscape */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `radial-gradient(ellipse 80% 70% at 50% 60%,
          rgba(212, 148, 58, ${bgOpacity * 0.08}) 0%,
          rgba(139, 26, 26, ${bgOpacity * 0.03}) 50%,
          transparent 100%)`,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ── Scroll-triggered text overlay ───────────────────────────────────────
function TextOverlay({ scrollProgress }) {
  const fadeIn = isMobile ? 0.08 : 0.06
  const fadeOut = isMobile ? 0.08 : 0.06

  function phaseOpacity(progress, start, end) {
    if (progress < start) return 0
    if (progress > end) return 0
    if (progress < start + fadeIn) {
      return (progress - start) / fadeIn
    }
    if (progress > end - fadeOut) {
      return (end - progress) / fadeOut
    }
    return 1
  }

  const p = scrollProgress

  // Phase 1: Logo + Title (0.0 - 0.14)
  const phase1 = phaseOpacity(p, 0.0, 0.14)
  // Phase 2: Impact statement (0.16 - 0.28)
  const phase2 = phaseOpacity(p, 0.16, 0.28)
  // Phase 3: Mission statement (0.30 - 0.42)
  const phase3 = phaseOpacity(p, 0.30, 0.42)
  // Phase 4: Question (0.44 - 0.56)
  const phase4 = phaseOpacity(p, 0.44, 0.56)
  // Phase 5: Release info (0.58 - 0.70)
  const phase5 = phaseOpacity(p, 0.58, 0.70)
  // Phase 6: Poster + CTA -- fades in and STAYS (starts at 0.65 to overlap with textured model)
  const phase6 = p < 0.65 ? 0
    : p < 0.76 ? (p - 0.65) / 0.11
    : 1

  const slideUp = (phase, px = 20) => {
    if (isMobile) {
      return `translateY(calc(-50% + ${(1 - phase) * px}px))`
    }
    return `translateY(${(1 - phase) * px}px)`
  }

  return (
    <div className="text-overlay">
      {/* Phase 1: Logo + Title */}
      <div
        className="overlay-phase phase-title"
        style={{
          opacity: phase1,
          transform: slideUp(phase1),
        }}
      >
        <img src="/logo.png" alt="Remember the Alamo" className="logo-image" />
        <p className="title-subtitle">Don't Sharia My Texas</p>
        <div className="title-divider" />
        <p className="title-sub">A Chris Burgard Film</p>
      </div>

      {/* Phase 2: Impact statement */}
      <div
        className="overlay-phase phase-statement"
        style={{
          opacity: phase2,
          transform: slideUp(phase2),
        }}
      >
        <p className="statement-text">The Alamo stood for freedom.</p>
      </div>

      {/* Phase 3: Mission */}
      <div
        className="overlay-phase phase-mission"
        style={{
          opacity: phase3,
          transform: slideUp(phase3),
        }}
      >
        <p className="mission-text">
          A documentary exposing how foreign law<br />
          is quietly replacing American justice.
        </p>
      </div>

      {/* Phase 4: Question */}
      <div
        className="overlay-phase phase-question"
        style={{
          opacity: phase4,
          transform: slideUp(phase4),
        }}
      >
        <p className="question-text">What are we standing for now?</p>
      </div>

      {/* Phase 5: Release info */}
      <div
        className="overlay-phase phase-release"
        style={{
          opacity: phase5,
          transform: slideUp(phase5),
        }}
      >
        <p className="release-year">Coming 2026</p>
        <div className="release-divider" />
        <p className="director-credit">
          From the filmmaker behind<br />
          <span className="director-films">Border</span> and <span className="director-films">Capitol Punishment</span>
        </p>
        <p className="director-name">Directed by Chris Burgard</p>
      </div>

      {/* Phase 6: Poster + CTA -- STAYS VISIBLE */}
      <div
        className="overlay-phase phase-cta"
        style={{
          opacity: phase6,
          transform: slideUp(phase6, 30),
        }}
      >
        <img src="/poster.jpg" alt="Remember the Alamo Poster" className="poster-image" />
        <p className="cta-tagline">The truth does not need your permission.</p>
        <a href="#watch" className="cta-button">
          Watch the Documentary
        </a>
        <p className="cta-credits">
          Remember the Alamo: Don't Sharia My Texas
        </p>
      </div>

      <div className="vignette-overlay" />
    </div>
  )
}

// ── Main App ────────────────────────────────────────────────────────────
export default function App() {
  const containerRef = useRef(null)
  const scrollRef = useRef(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  // Simulate loading progress
  useEffect(() => {
    let p = 0
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5
      if (p >= 100) {
        p = 100
        clearInterval(interval)
        setTimeout(() => setLoaded(true), 400)
      }
      setLoadProgress(p)
    }, 200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loaded) return

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: isMobile ? 0.8 : 1.2,
      onUpdate: (self) => {
        scrollRef.current = self.progress
        setScrollProgress(self.progress)
      },
    })

    return () => trigger.kill()
  }, [loaded])

  if (!loaded) {
    return <LoadingScreen progress={loadProgress} />
  }

  return (
    <div ref={containerRef} id="scroll-container">
      {/* Progress bar */}
      <div className="progress-bar" style={{ width: `${scrollProgress * 100}%` }} />

      {/* Background images layer */}
      <BackgroundLayer scrollProgress={scrollProgress} />

      {/* Fixed 3D canvas */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          zIndex: 1,
        }}
      >
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          dpr={dpr}
          camera={{
            fov: isMobile ? 60 : 50,
            near: 0.1,
            far: 600,
            position: isMobile ? [1.5, 2.0, 7.0] : [2, 2.2, 5.0],
          }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Scene scrollRef={scrollRef} isMobile={isMobile} />
          </Suspense>
        </Canvas>
      </div>

      {/* Fixed text overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <TextOverlay scrollProgress={scrollProgress} />
      </div>

      {/* Scroll indicator */}
      <div
        className="scroll-hint"
        style={{ opacity: scrollProgress < 0.03 ? 1 : 0 }}
      >
        <span>Scroll to explore</span>
        <div className="scroll-arrow" />
      </div>
    </div>
  )
}
