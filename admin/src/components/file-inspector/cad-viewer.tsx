import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Spin } from "antd";

interface CADViewerProps {
  fileUrl: string;
  fileExtension: string;
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader as any, url);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#888888" />
    </mesh>
  );
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader as any, url);
  const copiedObj = useMemo(() => obj.clone(), [obj]);
  return <primitive object={copiedObj} />;
}

function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function ModelRenderer({ url, extension }: { url: string; extension: string }) {
  const ext = extension.toLowerCase();
  if (ext === "stl") return <STLModel url={url} />;
  if (ext === "obj") return <OBJModel url={url} />;
  if (ext === "glb" || ext === "gltf") return <GLTFModel url={url} />;
  
  return null;
}

export function CADViewer({ fileUrl, fileExtension }: CADViewerProps) {
  return (
    <div style={{ width: "100%", height: "60vh", background: "#f0f2f5" }}>
      <Suspense
        fallback={
          <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" tip="Loading 3D Model..." />
          </div>
        }
      >
        <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
          <Stage environment="city" intensity={0.6}>
            <ModelRenderer url={fileUrl} extension={fileExtension} />
          </Stage>
          <OrbitControls makeDefault />
        </Canvas>
      </Suspense>
    </div>
  );
}
