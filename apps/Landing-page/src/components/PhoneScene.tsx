import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'
import { Model as Phone } from './PhoneModel' // Make sure you have this file in your folder!

// ─── helpers ───────────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 768

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
function getPhoneState(fromBottomVh: number) {
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

  if (fromBottomVh <= 1.2) {
    const t = THREE.MathUtils.clamp(1.2 - fromBottomVh, 0, 1.2) / 1.2
    
    // Adjust final target for mobile to ensure it stays on-screen
    const targetX = mobile ? -0.8 : -2.5
    const targetScale = mobile ? 1.3 : 1.8
    
    return {
      pos: [
        THREE.MathUtils.lerp(-8, targetX, Math.pow(t, 2)),
        THREE.MathUtils.lerp(8, -0.2, t),
        0,
      ] as [number, number, number],
      rot: [BETA_ROT_X, BETA_ROT_Y, BETA_ROT_Z] as [number, number, number],
      scale: THREE.MathUtils.lerp(0.5, targetScale, t),
    }
  }

  return {
    pos: [0, 12, 0] as [number, number, number],
    rot: [HERO_ROT_X, HERO_ROT_Y, HERO_ROT_Z] as [number, number, number],
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
    const maxScroll = document.documentElement.scrollHeight - innerHeight
    
    const footer = document.querySelector('footer')
    const footerHeight = footer ? footer.offsetHeight : 0
    
    const maxScrollBeta = Math.max(0, maxScroll - footerHeight)
    
    let fromBottomVh = (maxScrollBeta - scrollY) / innerHeight
    let footerScrollVh = 0
    
    if (fromBottomVh < 0) {
      footerScrollVh = -fromBottomVh
      fromBottomVh = 0
    }

    const target = getPhoneState(fromBottomVh)
    
    // Apply scroll offset if scrolling into footer
    // In 3D space, moving up is positive Y.
    // 6.627 is roughly the visible height in 3D units for fov 45, z=8
    const visibleHeightUnits = 2 * Math.tan((45 / 2) * (Math.PI / 180)) * 8
    target.pos[1] += footerScrollVh * visibleHeightUnits

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
    <group ref={group} position={[0, 12, 0]} rotation={[-1.42, 0.08, 0.28]} scale={0.5}>
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
export function PhoneScene() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768)

  React.useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
          
          <group visible={!mobile}>
            <PhoneRig />
            <ContactShadows
              position={[0, -2.5, 0]}
              opacity={0.3}
              scale={12}
              blur={2.5}
              far={5}
              color="#FFDE58"
            />
          </group>
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
