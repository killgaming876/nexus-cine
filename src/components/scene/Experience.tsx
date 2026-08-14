"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  PerspectiveCamera,
  Stars,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";

import {
  SubwayStation,
  type SubwayStationHandle,
} from "./SubwayStation";

import {
  AdidasShoe,
  type AdidasShoeHandle,
} from "./AdidasShoe";

/* ============================================================
   TYPES
   ============================================================ */

type ScrollState = {
  progress: number;
  sectionProgress: number;
};

type ExperienceSceneProps = {
  scroll: ScrollState;
};

/* ============================================================
   UTILITIES
   ============================================================ */

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

/* ============================================================
   GLOBAL SCROLL TRACKER
   ============================================================ */

function usePageScroll(): ScrollState {
  const [scroll, setScroll] = useState<ScrollState>({
    progress: 0,
    sectionProgress: 0,
  });

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      const progress =
        maxScroll > 0
          ? clamp(window.scrollY / maxScroll, 0, 1)
          : 0;

      const sectionHeight = Math.max(window.innerHeight, 1);

      const sectionProgress =
        clamp(
          (window.scrollY % sectionHeight) / sectionHeight,
          0,
          1,
        );

      setScroll({
        progress,
        sectionProgress,
      });
    };

    const onScroll = () => {
      if (!raf) {
        raf = window.requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (raf) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, []);

  return scroll;
}

/* ============================================================
   LOADING SCREEN
   ============================================================ */

function LoadingOverlay() {
  const { progress } = useProgress();

  return (
    <div
      className="nexus-loader"
      style={{
        pointerEvents: progress >= 100 ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "22px",
          textAlign: "center",
        }}
      >
        <div className="nexus-loader__core" />

        <div
          className="nexus-hud"
          style={{
            letterSpacing: "0.24em",
          }}
        >
          INITIALIZING NEXUS
        </div>

        <div
          style={{
            fontFamily:
              '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.42)",
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CINEMATIC PARTICLES
   ============================================================ */

function FloatingParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const count = 900;

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const radius = 8 + Math.random() * 30;
      const angle = Math.random() * Math.PI * 2;

      const x =
        Math.cos(angle) * radius +
        (Math.random() - 0.5) * 8;

      const y =
        (Math.random() - 0.5) * 18;

      const z =
        Math.sin(angle) * radius -
        Math.random() * 20;

      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }

    return array;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const t = state.clock.elapsedTime;

    pointsRef.current.rotation.y = t * 0.012;
    pointsRef.current.rotation.x =
      Math.sin(t * 0.08) * 0.04;

    const material =
      pointsRef.current.material as THREE.PointsMaterial;

    material.opacity =
      0.26 + Math.sin(t * 0.7) * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.045}
        sizeAttenuation
        color="#9cefff"
        transparent
        opacity={0.28}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ============================================================
   MOVING LIGHTS
   ============================================================ */

function CinematicLights() {
  const cyan = useRef<THREE.PointLight>(null);
  const white = useRef<THREE.PointLight>(null);
  const violet = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (cyan.current) {
      cyan.current.position.x =
        Math.sin(t * 0.35) * 5;

      cyan.current.position.z =
        Math.cos(t * 0.27) * 4 + 3;

      cyan.current.intensity =
        20 + Math.sin(t * 1.2) * 4;
    }

    if (white.current) {
      white.current.position.x =
        Math.cos(t * 0.22) * 4;

      white.current.position.y =
        4 + Math.sin(t * 0.4) * 1.2;

      white.current.intensity =
        17 + Math.sin(t * 0.8) * 3;
    }

    if (violet.current) {
      violet.current.position.x =
        Math.cos(t * 0.3) * -6;

      violet.current.position.z =
        Math.sin(t * 0.25) * 3;

      violet.current.intensity =
        14 + Math.sin(t * 0.9) * 3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />

      <directionalLight
        position={[4, 8, 5]}
        intensity={2}
        color="#cfeeff"
        castShadow
      />

      <pointLight
        ref={cyan}
        position={[0, 4, 5]}
        intensity={20}
        distance={30}
        decay={2}
        color="#54e8ff"
      />

      <pointLight
        ref={white}
        position={[3, 6, 4]}
        intensity={17}
        distance={28}
        decay={2}
        color="#ffffff"
      />

      <pointLight
        ref={violet}
        position={[-5, 3, 0]}
        intensity={14}
        distance={30}
        decay={2}
        color="#8a5cff"
      />

      <spotLight
        position={[0, 12, 5]}
        angle={0.35}
        penumbra={1}
        intensity={40}
        distance={45}
        color="#dffaff"
        castShadow
      />
    </>
  );
}

/* ============================================================
   CINEMATIC CAMERA
   ============================================================ */

function CinematicCamera({
  scroll,
}: {
  scroll: ScrollState;
}) {
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const target = useRef(new THREE.Vector3());
  const { set } = useThree();

  useEffect(() => {
    return () => {
      // Camera is owned by the Canvas.
    };
  }, [set]);

  useFrame((state, delta) => {
    const activeCamera =
      camera.current ??
      (state.camera as THREE.PerspectiveCamera);

    const p = scroll.progress;
    const time = state.clock.elapsedTime;

    let desiredX = 0;
    let desiredY = 2.4;
    let desiredZ = 11;

    /* -------------------------------
       0 → 35% : SUBWAY JOURNEY
       ------------------------------- */

    if (p < 0.35) {
      const t = smoothstep(0, 0.35, p);

      desiredX =
        Math.sin(time * 0.16) * 0.65 +
        lerp(0, 1.4, t);

      desiredY =
        lerp(2.7, 1.65, t) +
        Math.sin(time * 0.3) * 0.08;

      desiredZ =
        lerp(12.5, 7.2, t);
    }

    /* -------------------------------
       35 → 55% : TRANSITION
       ------------------------------- */

    else if (p < 0.55) {
      const t = smoothstep(0.35, 0.55, p);

      desiredX =
        lerp(1.4, 0, t);

      desiredY =
        lerp(1.65, 0.7, t);

      desiredZ =
        lerp(7.2, 10.2, t);
    }

    /* -------------------------------
       55 → 82% : SHOE REVEAL
       ------------------------------- */

    else if (p < 0.82) {
      const t = smoothstep(0.55, 0.82, p);

      desiredX =
        Math.sin(time * 0.18) * 1.3;

      desiredY =
        lerp(0.7, 1.45, t);

      desiredZ =
        lerp(10.2, 5.4, t);
    }

    /* -------------------------------
       82 → 100% : HERO
       ------------------------------- */

    else {
      const t = smoothstep(0.82, 1, p);

      desiredX =
        lerp(0.4, 2.8, t);

      desiredY =
        lerp(1.45, 2.4, t);

      desiredZ =
        lerp(5.4, 7.8, t);
    }

    desiredX += Math.sin(time * 0.28) * 0.08;
    desiredY += Math.cos(time * 0.22) * 0.06;

    const smoothing =
      1 - Math.pow(0.0001, delta);

    activeCamera.position.x +=
      (desiredX - activeCamera.position.x) *
      smoothing;

    activeCamera.position.y +=
      (desiredY - activeCamera.position.y) *
      smoothing;

    activeCamera.position.z +=
      (desiredZ - activeCamera.position.z) *
      smoothing;

    let lookX = 0;
    let lookY = 1.5;
    let lookZ = 0;

    if (p >= 0.55) {
      lookY =
        remap(p, 0.55, 1, 0.1, 0.9);
    } else {
      lookY =
        remap(p, 0, 0.55, 1.5, 0.6);
    }

    target.current.set(
      lookX +
        Math.sin(time * 0.17) * 0.15,
      lookY,
      lookZ,
    );

    activeCamera.lookAt(target.current);

    activeCamera.fov =
      p < 0.55
        ? lerp(52, 45, smoothstep(0, 0.55, p))
        : lerp(45, 40, smoothstep(0.55, 1, p));

    activeCamera.updateProjectionMatrix();
  });

  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      position={[0, 2.4, 11]}
      fov={48}
      near={0.1}
      far={500}
    />
  );
}

/* ============================================================
   STATION / SHOE ORCHESTRATOR
   ============================================================ */

function StoryScene({
  scroll,
}: ExperienceSceneProps) {
  const stationRef =
    useRef<SubwayStationHandle>(null);

  const shoeRef =
    useRef<AdidasShoeHandle>(null);

  useFrame((state, delta) => {
    const station =
      stationRef.current?.group;

    const shoe =
      shoeRef.current?.group;

    const p = scroll.progress;
    const t = state.clock.elapsedTime;

    /* ========================================================
       STATION
       ======================================================== */

    if (station) {
      const stationExit =
        smoothstep(0.28, 0.58, p);

      const stationFloat =
        Math.sin(t * 0.35) * 0.035;

      station.visible = p < 0.68;

      station.position.x =
        lerp(
          0,
          -2.4,
          stationExit,
        );

      station.position.y =
        stationFloat +
        lerp(
          0,
          -1.2,
          stationExit,
        );

      station.position.z =
        lerp(
          -1.6,
          -7,
          stationExit,
        );

      station.rotation.y =
        lerp(
          0,
          -0.55,
          stationExit,
        ) +
        Math.sin(t * 0.2) * 0.012;

      station.rotation.x =
        lerp(
          0,
          0.16,
          stationExit,
        );

      const stationScale =
        lerp(
          1,
          0.78,
          stationExit,
        );

      station.scale.setScalar(stationScale);
    }

    /* ========================================================
       SHOE
       ======================================================== */

    if (shoe) {
      const reveal =
        smoothstep(0.46, 0.7, p);

      const finalHero =
        smoothstep(0.78, 1, p);

      shoe.visible = reveal > 0.01;

      shoe.position.x =
        lerp(
          4.5,
          0,
          reveal,
        ) +
        Math.sin(t * 0.32) *
          0.12 *
          reveal;

      shoe.position.y =
        lerp(
          -0.8,
          0,
          reveal,
        ) +
        Math.sin(t * 0.7) *
          0.1 *
          reveal;

      shoe.position.z =
        lerp(
          -3,
          0,
          reveal,
        );

      shoe.rotation.y =
        lerp(
          Math.PI * 0.9,
          Math.PI * 0.15,
          reveal,
        ) +
        t * 0.12 * reveal;

      shoe.rotation.x =
        lerp(
          -0.25,
          0.08,
          reveal,
        );

      shoe.rotation.z =
        Math.sin(t * 0.28) *
        0.035 *
        reveal;

      const baseScale =
        lerp(
          0.42,
          1.15,
          reveal,
        );

      const heroScale =
        lerp(
          baseScale,
          1.28,
          finalHero,
        );

      shoe.scale.setScalar(heroScale);
    }
  });

  return (
    <>
      <group>
        <SubwayStation
          ref={stationRef}
          position={[0, 0, -1.6]}
          scale={1}
          castShadow
          receiveShadow
        />
      </group>

      <group>
        <AdidasShoe
          ref={shoeRef}
          position={[4.5, -0.8, -3]}
          scale={0.42}
          visible={false}
          castShadow
          receiveShadow
        />
      </group>
    </>
  );
}

/* ============================================================
   FLOOR / REFLECTION RECEIVER
   ============================================================ */

function CinematicFloor() {
  return (
    <ContactShadows
      position={[0, -2.7, 0]}
      opacity={0.52}
      scale={25}
      blur={3}
      far={12}
      resolution={1024}
      color="#000000"
    />
  );
}

/* ============================================================
   MAIN R3F SCENE
   ============================================================ */

function Scene({
  scroll,
}: ExperienceSceneProps) {
  return (
    <>
      <CinematicCamera scroll={scroll} />

      <color
        attach="background"
        args={["#020305"]}
      />

      <fog
        attach="fog"
        args={["#020305", 18, 85]}
      />

      <CinematicLights />

      <Stars
        radius={70}
        depth={40}
        count={1200}
        factor={1.4}
        saturation={0}
        fade
        speed={0.2}
      />

      <FloatingParticles />

      <StoryScene scroll={scroll} />

      <CinematicFloor />

      {/* Deep-blue atmospheric backlight */}
      <mesh
        position={[0, 2, -25]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[60, 35]} />

        <meshBasicMaterial
          color="#04131a"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ============================================================
   EXPORTED EXPERIENCE
   ============================================================ */

export default function Experience() {
  const scroll = usePageScroll();

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--scroll-progress",
      String(scroll.progress),
    );
  }, [scroll.progress]);

  return (
    <>
      <div
        className="nexus-webgl"
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <Canvas
          dpr={[1, 1.5]}
          shadows
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{
            position: [0, 2.4, 11],
            fov: 48,
            near: 0.1,
            far: 500,
          }}
        >
          <Suspense fallback={null}>
            <Scene scroll={scroll} />
          </Suspense>
        </Canvas>
      </div>

      <div
        className="nexus-atmosphere"
        aria-hidden="true"
      />

      <div
        className="nexus-grid"
        aria-hidden="true"
      />

      <div
        className="nexus-scanlines"
        aria-hidden="true"
      />

      <div
        className="nexus-cinematic-overlay"
        aria-hidden="true"
      />

      <div
        className="nexus-vignette"
        aria-hidden="true"
      />

      <LoadingOverlay />
    </>
  );
}
