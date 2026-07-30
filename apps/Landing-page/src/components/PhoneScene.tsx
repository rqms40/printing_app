import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Float, Text } from '@react-three/drei'
import * as THREE from 'three'
import { Model as Phone } from './PhoneModel' // Make sure you have this file in your folder!

// ─── helpers ───────────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 768

// ─── GRIDGO text layers (zero-gravity scatter) ───────────────────────────────
function GridTextLayer({ index, isDarkMode }: { index: number, isDarkMode?: boolean }) {
  const mesh = useRef<(THREE.Mesh & { fillOpacity: number; outlineOpacity: number })>(null)

  // Each layer has a fixed offset so the stack looks tight at rest
  const baseZ = -1.2 - (index * 0.18)
  // Staggered opacity — front layer is brightest
  const baseAlpha = 1.0 - index * 0.18
  // Keep the mesh itself moderately sized; per-frame scale handles viewport fit.

  useFrame(() => {
    if (!mesh.current) return
    const vh = window.scrollY / window.innerHeight

    // Animation window: fully visible at vh=0, fully gone by vh=0.75
    const t = THREE.MathUtils.clamp(vh / 0.75, 0, 1)
    // Use a smooth ease-in curve so it starts slowly then accelerates out
    const ease = t * t

    // All layers pull straight back on Z (no X/Y drift)
    const retreatZ = index === 0 ? 1.5 : 2.5 + index * 1.2
    mesh.current.position.z = THREE.MathUtils.lerp(baseZ, baseZ - retreatZ, ease)

    // ── Viewport-responsive scale ─────────────────────────────────────────
    // Camera z=8, vertical fov=45° → visible height = 6.63 units.
    // Visible WIDTH = 6.63 × aspect, which shrinks dramatically on portrait mobile.
    // Keep GRIDGO as a full, readable backdrop while preserving side breathing room.
    // Troika text's rendered width is much wider than the raw letter count, so
    // this uses the measured hero word width rather than the old under-estimate
    // that clipped the first G and last O on both desktop and mobile.
    const aspect = window.innerWidth / window.innerHeight
    const visibleWidth = 2 * Math.tan(Math.PI / 8) * 8 * aspect
    const targetFill = aspect < 0.75 ? 0.76 : 0.78
    const estimatedTextWidth = 18.6
    const responsiveScale = Math.min(0.64, (visibleWidth * targetFill) / estimatedTextWidth)

    const fadeScale = THREE.MathUtils.lerp(1, 0.85, ease)
    mesh.current.scale.setScalar(fadeScale * responsiveScale)

    // Fade to zero opacity
    const alpha = THREE.MathUtils.lerp(baseAlpha, 0, ease)
    mesh.current.fillOpacity = alpha
    mesh.current.outlineOpacity = index === 0 ? 0 : alpha * 0.9

    // Keep rotation absolutely still
    mesh.current.rotation.set(0, 0, 0)
  })

  return (
    <Text
      ref={mesh}
      fontSize={4.15}
      fontWeight={900}
      letterSpacing={0.28}
      color={isDarkMode ? "white" : "#111111"}
      outlineWidth={index === 0 ? 0 : 0.025}
      outlineColor={isDarkMode ? "#ffffff" : "#111111"}
      fillOpacity={baseAlpha}
      position={[0, 0, baseZ]}
    >
      GRIDGO
    </Text>
  )
}

function GridTextLayers({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <group>
      {[0, 1, 2, 3, 4].map(i => (
        <GridTextLayer key={i} index={i} isDarkMode={isDarkMode} />
      ))}
    </group>
  )
}

// ─── Camera parallax arc ────────────────────────────────────────────────────
function CameraRig() {
  useFrame(state => {
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, 0, 0.05)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 0, 0.05)
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

// ─── Phone state machine ────────────────────────────────────────────────────
function getPhoneState(vh: number, fromBottomVh: number) {
  const mobile = isMobile()

  // ╔══════════════════════════════════════════════╗
  // ║           YOUR TWEAK VALUES HERE             ║
  // ╠══════════════════════════════════════════════╣
  // ║  HERO section (first screen)                 ║
  const HERO_ROT_X = -1.42  // + = top toward you,  - = top away
  const HERO_ROT_Y = 0.08    // + = shows left side, - = shows right side
  const HERO_ROT_Z = 0.28 // + = leans left,      - = leans right

  // ║  BETA section (last screen)                  ║
  const BETA_ROT_X = -1.5      // + = top toward you,  - = top away
  const BETA_ROT_Y = -0.02      // + = shows left side, - = shows right side
  const BETA_ROT_Z = 0.4       // + = leans left,      - = leans right
  // ╚══════════════════════════════════════════════╝

  if (vh <= 1.0) {
    const t = THREE.MathUtils.clamp(vh, 0, 1)
    const x = mobile ? THREE.MathUtils.lerp(-0.08, 0.04, t) : 0.02
    const y = mobile
      ? THREE.MathUtils.lerp(0, 1.5, t)
      : THREE.MathUtils.lerp(0, 1.2, t)
    const scale = mobile
      ? THREE.MathUtils.lerp(0.92, 0.96, t)
      : THREE.MathUtils.lerp(1.16, 1.16, t)

    return {
      pos: [x, y, 0.35] as [number, number, number],
      rot: [HERO_ROT_X, HERO_ROT_Y, HERO_ROT_Z] as [number, number, number],
      scale,
    }
  }

  if (fromBottomVh <= 1.2) {
    const t = THREE.MathUtils.clamp(1.2 - fromBottomVh, 0, 1.2) / 1.2
    return {
      pos: [
        THREE.MathUtils.lerp(-8, -2.5, Math.pow(t, 2)),
        THREE.MathUtils.lerp(8, -0.2, t),
        0,
      ] as [number, number, number],
      rot: [BETA_ROT_X, BETA_ROT_Y, BETA_ROT_Z] as [number, number, number],
      scale: THREE.MathUtils.lerp(0.5, 1.8, t),
    }
  }

  if (vh > 1.0 && vh <= 2.0) {
    const t = THREE.MathUtils.clamp(vh - 1.0, 0, 1)
    const startY = mobile ? 4.0 : 1.5
    const startScale = mobile ? 0.9 : 1.4
    return {
      pos: [0, THREE.MathUtils.lerp(startY, 12, t), 0] as [number, number, number],
      rot: [0, THREE.MathUtils.lerp(0, Math.PI, t), 0] as [number, number, number],
      scale: THREE.MathUtils.lerp(startScale, 0.5, t),
    }
  }

  return {
    pos: [0, 12, 0] as [number, number, number],
    rot: [0, Math.PI, 0] as [number, number, number],
    scale: 0.5,
  }
}

// ─── Phone rig ──────────────────────────────────────────────────────────────
function PhoneRig() {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!group.current) return

    const scrollY = window.scrollY
    const innerHeight = window.innerHeight
    const vh = scrollY / innerHeight
    const maxScroll = document.documentElement.scrollHeight - innerHeight
    const fromBottomVh = Math.max(0, (maxScroll - scrollY) / innerHeight)

    const target = getPhoneState(vh, fromBottomVh)
    const lf = 0.08 // lerp factor

    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, target.pos[0], lf)
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, target.pos[1], lf)
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, target.pos[2], lf)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, target.rot[0], lf)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, target.rot[1], lf)
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, target.rot[2], lf)
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, target.scale, lf))
  })

  return (
    <group ref={group} scale={1.8}>
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.2}>
        <Phone />
      </Float>
    </group>
  )
}

// ─── Error boundary ─────────────────────────────────────────────────────────
type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: unknown
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', zIndex: 9999, position: 'absolute' }}>
          Canvas Error: {String(this.state.error)}
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Scene export ────────────────────────────────────────────────────────────
export function PhoneScene({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      <ErrorBoundary>
        <Canvas style={{ pointerEvents: 'none' }} camera={{ position: [0, 0, 8.0], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.3} color="#ffffff" />
          <spotLight
            position={[5, 8, 5]}
            angle={0.25}
            penumbra={1}
            intensity={2.5}
            color="#ffffff"
            castShadow
          />
          <pointLight position={[-4, -4, 3]} intensity={0.8} color="#FFDE58" />

          <Environment preset="city" />

          <CameraRig />
          <GridTextLayers isDarkMode={isDarkMode} />
          <PhoneRig />

          <ContactShadows
            position={[0, -2.5, 0]}
            opacity={0.3}
            scale={12}
            blur={2.5}
            far={5}
            color="#FFDE58"
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
