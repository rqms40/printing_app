import { useGLTF, Center } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'

export function Model(props: ThreeElements['group']) {
  const { scene } = useGLTF('/smartphone.glb')

  return (
    <group {...props} dispose={null}>
      {/*
        1. <Center> auto-computes the bounding box and moves the model to [0,0,0]
           regardless of any baked-in translations in the GLB.
        2. The inner group counteracts the baked-in -90° X rotation so the phone
           stands upright, then scales it to a usable world size (~2 units tall).
      */}
      <Center>
        <group rotation={[Math.PI / 2, 0, 0]} scale={15}>
          <primitive object={scene} />
        </group>
      </Center>
    </group>
  )
}

useGLTF.preload('/smartphone.glb')
