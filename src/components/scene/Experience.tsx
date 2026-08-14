"use client";

import * as THREE from "three";
import {
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";

import { SubwayStation } from "../models/SubwayStation";
import type { SubwayStationHandle } from "../models/SubwayStation";

import { AdidasShoe } from "../models/AdidasShoe";
import type { AdidasShoeHandle } from "../models/AdidasShoe";

import { SceneEnvironment } from "./SceneEnvironment";
import { CameraRig, type CameraRigHandle } from "./CameraRig";

import {
  CinematicStory,
  type CinematicStoryHandle,
} from "../story/CinematicStory";

import { WebGLFallback } from "./WebGLFallback";

export interface ExperienceHandle {
  camera: THREE.PerspectiveCamera;
  stationGroup: THREE.Group;
  shoeGroup: THREE.Group;
  station: SubwayStationHandle | null;
  shoe: AdidasShoeHandle | null;
  story: CinematicStoryHandle | null;
}

export interface ExperienceProps {
  className?: string;
  showNarration?: boolean;
  atmosphereQuality?: "high" | "medium" | "low";
}

const CAMERA_START = {
  position: [0, 1.6, 9] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  fov: 45,
  near: 0.1,
  far: 100,
};

const SHOE_STAGING = {
  position: [6, -2.5, -2] as [number, number, number],
  scale: 0.001,
};

function canCreateWebGLContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");

    const context =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!context) {
      return false;
    }

    const gl = context as WebGLRenderingContext;

    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);

    console.info("[Nexus] WebGL available");
    console.info("[Nexus] Renderer:", renderer);
    console.info("[Nexus] Vendor:", vendor);

    return true;
  } catch (error) {
    console.warn("[Nexus] WebGL unavailable:", error);
    return false;
  }
}

export const Experience = forwardRef<
  ExperienceHandle,
  ExperienceProps
>(function Experience(
  {
    className,
    showNarration = true,
    atmosphereQuality = "high",
  },
  ref
) {
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(
    null
  );

  const cameraRigRef = useRef<CameraRigHandle>(null);
  const stationGroupRef = useRef<THREE.Group>(null);
  const shoeGroupRef = useRef<THREE.Group>(null);
  const stationHandleRef = useRef<SubwayStationHandle>(null);
  const shoeHandleRef = useRef<AdidasShoeHandle>(null);
  const cinematicStoryRef =
    useRef<CinematicStoryHandle>(null);

  useEffect(() => {
    const available = canCreateWebGLContext();

    setWebGLAvailable(available);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      get camera() {
        return cameraRigRef.current?.camera as THREE.PerspectiveCamera;
      },

      get stationGroup() {
        return stationGroupRef.current as THREE.Group;
      },

      get shoeGroup() {
        return shoeGroupRef.current as THREE.Group;
      },

      get station() {
        return stationHandleRef.current;
      },

      get shoe() {
        return shoeHandleRef.current;
      },

      get story() {
        return cinematicStoryRef.current;
      },
    }),
    []
  );

  /*
   * During the first browser render we don't yet know whether WebGL
   * is available. Keep the screen visually stable while checking.
   */
  if (webGLAvailable === null) {
    return (
      <div
        className={className}
        style={{
          position: "fixed",
          inset: 0,
          background: "#050505",
        }}
      />
    );
  }

  /*
   * Older GPUs / drivers can fail before Three.js gets a chance to
   * render anything. In that case we intentionally avoid mounting
   * <Canvas> at all.
   */
  if (!webGLAvailable) {
    return <WebGLFallback />;
  }

  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.25]}
      gl={{
        antialias: true,
        powerPreference: "default",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{
        position: CAMERA_START.position,
        rotation: CAMERA_START.rotation,
        fov: CAMERA_START.fov,
        near: CAMERA_START.near,
        far: CAMERA_START.far,
      }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(
          Math.min(window.devicePixelRatio, 1.25)
        );

        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <CameraRig
        ref={cameraRigRef}
        position={CAMERA_START.position}
        rotation={CAMERA_START.rotation}
        fov={CAMERA_START.fov}
        near={CAMERA_START.near}
        far={CAMERA_START.far}
      />

      <SceneEnvironment />

      <group
        ref={stationGroupRef}
        name="stationGroup"
      >
        <Suspense fallback={null}>
          <SubwayStation
            ref={stationHandleRef}
            name="subwayStationModel"
          />
        </Suspense>
      </group>

      <group
        ref={shoeGroupRef}
        name="shoeGroup"
        position={SHOE_STAGING.position}
        scale={SHOE_STAGING.scale}
      >
        <Suspense fallback={null}>
          <AdidasShoe
            ref={shoeHandleRef}
            name="adidasShoeModel"
          />
        </Suspense>
      </group>

      <CinematicStory
        ref={cinematicStoryRef}
        cameraRigRef={cameraRigRef}
        stationGroupRef={stationGroupRef}
        subwayStationRef={stationHandleRef}
        shoeGroupRef={shoeGroupRef}
        showNarration={showNarration}
        atmosphereQuality={atmosphereQuality}
      />
    </Canvas>
  );
});