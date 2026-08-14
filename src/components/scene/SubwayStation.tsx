"use client";

import * as THREE from "three";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Float, useGLTF } from "@react-three/drei";
import type { GLTF } from "three-stdlib";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const MODEL_PATH = "/nexus-cine/models/subway-station.glb";

const DEFAULT_TARGET_HEIGHT = 8;
const DEFAULT_TARGET_WIDTH = 18;

const INTRO_DURATION = 0.18;
const JOURNEY_START = 0.08;
const JOURNEY_END = 0.55;
const TRANSITION_START = 0.42;
const TRANSITION_END = 0.72;

/* ============================================================
   TYPES
   ============================================================ */

type SubwayStationGLTF = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export interface SubwayStationHandle {
  group: THREE.Group;
  scene: THREE.Group;

  center: THREE.Vector3;
  size: THREE.Vector3;

  normalizedScale: number;

  getWorldCenter: () => THREE.Vector3;
  getWorldSize: () => THREE.Vector3;
  getBoundingBox: () => THREE.Box3;

  resetAnimation: () => void;
}

export type Object3DTransformProps = {
  position?: THREE.Vector3 | [number, number, number];
  rotation?: THREE.Euler | [number, number, number];
  scale?: THREE.Vector3 | [number, number, number] | number;
  visible?: boolean;
  name?: string;
};

export type SubwayStationProps = Object3DTransformProps & {
  castShadow?: boolean;
  receiveShadow?: boolean;

  /**
   * Global scroll progress from 0 → 1.
   */
  scrollProgress?: number;

  /**
   * Controls how strongly the station responds
   * to scroll-driven cinematic movement.
   */
  motionIntensity?: number;

  /**
   * Controls idle breathing/floating animation.
   */
  idleIntensity?: number;

  /**
   * Controls automatic normalization of the source GLB.
   */
  normalize?: boolean;

  /**
   * Desired approximate world-space station height.
   */
  targetHeight?: number;

  /**
   * Additional scale applied after normalization.
   */
  modelScale?: number;

  /**
   * Callback after model configuration.
   */
  onReady?: (scene: THREE.Group) => void;

  /**
   * Optional callback whenever the station's
   * normalized dimensions are calculated.
   */
  onBoundsReady?: (
    bounds: THREE.Box3,
    size: THREE.Vector3,
    center: THREE.Vector3,
    scale: number,
  ) => void;

  /**
   * Optional callback when an animation state changes.
   */
  onAnimationStateChange?: (
    state:
      | "intro"
      | "journey"
      | "transition"
      | "exit",
  ) => void;
};

/* ============================================================
   HELPERS
   ============================================================ */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    Math.max(value, min),
    max,
  );
}

function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const x = clamp(
    (value - edge0) /
      Math.max(edge1 - edge0, 0.000001),
    0,
    1,
  );

  return x * x * (3 - 2 * x);
}

function smootherstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const x = clamp(
    (value - edge0) /
      Math.max(edge1 - edge0, 0.000001),
    0,
    1,
  );

  return (
    x *
    x *
    x *
    (x * (x * 6 - 15) + 10)
  );
}

function lerp(
  a: number,
  b: number,
  t: number,
): number {
  return a + (b - a) * t;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export const SubwayStation = forwardRef<
  SubwayStationHandle,
  SubwayStationProps
>(
  function SubwayStation(
    {
      castShadow = false,
      receiveShadow = false,

      scrollProgress = 0,

      motionIntensity = 1,
      idleIntensity = 1,

      normalize = true,
      targetHeight = DEFAULT_TARGET_HEIGHT,
      modelScale = 1,

      onReady,
      onBoundsReady,
      onAnimationStateChange,

      ...groupProps
    },
    ref,
  ) {
    /* ========================================================
       REFS
       ======================================================== */

    const groupRef =
      useRef<THREE.Group>(null);

    const pivotRef =
      useRef<THREE.Group>(null);

    const contentRef =
      useRef<THREE.Group>(null);

    const { scene } =
      useGLTF(MODEL_PATH) as SubwayStationGLTF;

    /* ========================================================
       STATE / BOUNDS
       ======================================================== */

    const sourceBounds = useMemo(() => {
      const box =
        new THREE.Box3().setFromObject(scene);

      return box;
    }, [scene]);

    const sourceSize = useMemo(() => {
      const size =
        sourceBounds.getSize(
          new THREE.Vector3(),
        );

      return size;
    }, [sourceBounds]);

    const sourceCenter = useMemo(() => {
      const center =
        sourceBounds.getCenter(
          new THREE.Vector3(),
        );

      return center;
    }, [sourceBounds]);

    const normalizedScale = useMemo(() => {
      if (!normalize) {
        return modelScale;
      }

      const currentHeight =
        Math.max(sourceSize.y, 0.0001);

      return (
        targetHeight /
        currentHeight *
        modelScale
      );
    }, [
      normalize,
      sourceSize.y,
      targetHeight,
      modelScale,
    ]);

    const normalizedSize = useMemo(() => {
      return sourceSize
        .clone()
        .multiplyScalar(
          normalizedScale,
        );
    }, [
      sourceSize,
      normalizedScale,
    ]);

    const normalizedCenter = useMemo(() => {
      return sourceCenter
        .clone()
        .multiplyScalar(
          normalizedScale,
        );
    }, [
      sourceCenter,
      normalizedScale,
    ]);

    /* ========================================================
       MATERIAL REGISTRY
       ======================================================== */

    const meshes = useMemo(() => {
      const list: THREE.Mesh[] = [];

      scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh
        ) {
          list.push(child);
        }
      });

      return list;
    }, [scene]);

    /* ========================================================
       INITIAL MODEL PREPARATION
       ======================================================== */

    useEffect(() => {
      scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh
        ) {
          child.castShadow =
            castShadow;

          child.receiveShadow =
            receiveShadow;

          child.frustumCulled = true;

          const material =
            child.material;

          const materials = Array.isArray(
            material,
          )
            ? material
            : [material];

          materials.forEach((mat) => {
            mat.transparent =
              mat.transparent;

            mat.needsUpdate = true;
          });
        }
      });

      /* --------------------------------------------------------
         Re-center source scene around its bounding-box origin.
         This makes camera/station movement much easier to control.
         -------------------------------------------------------- */

      scene.position.set(
        -sourceCenter.x,
        -sourceCenter.y,
        -sourceCenter.z,
      );

      /* --------------------------------------------------------
         Normalize the actual model scale.
         -------------------------------------------------------- */

      scene.scale.setScalar(
        normalizedScale,
      );

      onReady?.(scene);

      onBoundsReady?.(
        sourceBounds,
        normalizedSize,
        normalizedCenter,
        normalizedScale,
      );
    }, [
      scene,
      castShadow,
      receiveShadow,
      sourceCenter,
      sourceBounds,
      normalizedScale,
      normalizedSize,
      normalizedCenter,
      onReady,
      onBoundsReady,
    ]);

    /* ========================================================
       EXTERNAL HANDLE
       ======================================================== */

    const getWorldCenter =
      useCallback(() => {
        const object =
          groupRef.current;

        if (!object) {
          return new THREE.Vector3();
        }

        const result =
          new THREE.Vector3();

        object.getWorldPosition(
          result,
        );

        return result;
      }, []);

    const getBoundingBox =
      useCallback(() => {
        if (!groupRef.current) {
          return new THREE.Box3();
        }

        return new THREE.Box3().setFromObject(
          groupRef.current,
        );
      }, []);

    const getWorldSize =
      useCallback(() => {
        const box =
          getBoundingBox();

        return box.getSize(
          new THREE.Vector3(),
        );
      }, [getBoundingBox]);

    const resetAnimation =
      useCallback(() => {
        if (!groupRef.current) {
          return;
        }

        groupRef.current.position.set(
          0,
          0,
          0,
        );

        groupRef.current.rotation.set(
          0,
          0,
          0,
        );

        groupRef.current.scale.setScalar(
          1,
        );

        if (pivotRef.current) {
          pivotRef.current.position.set(
            0,
            0,
            0,
          );

          pivotRef.current.rotation.set(
            0,
            0,
            0,
          );
        }

        if (contentRef.current) {
          contentRef.current.position.set(
            0,
            0,
            0,
          );

          contentRef.current.rotation.set(
            0,
            0,
            0,
          );
        }
      }, []);

    useImperativeHandle(
      ref,
      () => ({
        group:
          groupRef.current as THREE.Group,

        scene,

        center:
          normalizedCenter.clone(),

        size:
          normalizedSize.clone(),

        normalizedScale,

        getWorldCenter,

        getWorldSize,

        getBoundingBox,

        resetAnimation,
      }),
      [
        scene,
        normalizedCenter,
        normalizedSize,
        normalizedScale,
        getWorldCenter,
        getWorldSize,
        getBoundingBox,
        resetAnimation,
      ],
    );

    /* ========================================================
       ANIMATION MEMORY
       ======================================================== */

    const previousScroll =
      useRef(scrollProgress);

    const previousState =
      useRef<
        | "intro"
        | "journey"
        | "transition"
        | "exit"
      >("intro");

    const smoothedScroll =
      useRef(scrollProgress);

    const velocity =
      useRef(0);

    /* ========================================================
       ANIMATION LOOP
       ======================================================== */

    useFrame(
      (state, delta) => {
        const group =
          groupRef.current;

        const pivot =
          pivotRef.current;

        const content =
          contentRef.current;

        if (!group || !pivot || !content) {
          return;
        }

        const elapsed =
          state.clock.elapsedTime;

        /* ----------------------------------------------------
           SCROLL SMOOTHING
           ---------------------------------------------------- */

        const targetScroll =
          clamp(
            scrollProgress,
            0,
            1,
          );

        const scrollDelta =
          targetScroll -
          previousScroll.current;

        previousScroll.current =
          targetScroll;

        const normalizedDelta =
          clamp(
            scrollDelta /
              Math.max(delta, 1 / 120),
            -5,
            5,
          );

        velocity.current =
          lerp(
            velocity.current,
            normalizedDelta,
            clamp(
              delta * 10,
              0,
              1,
            ),
          );

        smoothedScroll.current =
          lerp(
            smoothedScroll.current,
            targetScroll,
            clamp(
              delta * 5.5,
              0,
              1,
            ),
          );

        const p =
          smoothedScroll.current;

        const intensity =
          motionIntensity;

        const idle =
          idleIntensity;

        /* ----------------------------------------------------
           ANIMATION STATE
           ---------------------------------------------------- */

        let animationState:
          | "intro"
          | "journey"
          | "transition"
          | "exit";

        if (p < JOURNEY_START) {
          animationState = "intro";
        } else if (
          p < TRANSITION_START
        ) {
          animationState = "journey";
        } else if (
          p < TRANSITION_END
        ) {
          animationState = "transition";
        } else {
          animationState = "exit";
        }

        if (
          animationState !==
          previousState.current
        ) {
          previousState.current =
            animationState;

          onAnimationStateChange?.(
            animationState,
          );
        }

        /* ====================================================
           INTRO
           ==================================================== */

        const intro =
          1 -
          smootherstep(
            0,
            INTRO_DURATION,
            p,
          );

        /* ====================================================
           JOURNEY
           ==================================================== */

        const journey =
          smoothstep(
            JOURNEY_START,
            JOURNEY_END,
            p,
          );

        /* ====================================================
           TRANSITION
           ==================================================== */

        const transition =
          smoothstep(
            TRANSITION_START,
            TRANSITION_END,
            p,
          );

        /* ====================================================
           EXIT
           ==================================================== */

        const exit =
          smoothstep(
            0.64,
            0.96,
            p,
          );

        /* ====================================================
           IDLE BREATHING
           ==================================================== */

        const breathing =
          Math.sin(
            elapsed * 0.7,
          ) *
          0.035 *
          idle;

        const slowBreathing =
          Math.sin(
            elapsed * 0.42,
          ) *
          0.05 *
          idle;

        /* ====================================================
           CAMERA-FRIENDLY PIVOT MOTION
           ==================================================== */

        pivot.position.x =
          Math.sin(
            elapsed * 0.18,
          ) *
          0.035 *
          idle;

        pivot.position.y =
          breathing;

        pivot.position.z =
          slowBreathing;

        /* ====================================================
           STATION ROLL
           ==================================================== */

        pivot.rotation.x =
          Math.sin(
            elapsed * 0.22,
          ) *
          0.006 *
          idle;

        pivot.rotation.y =
          Math.sin(
            elapsed * 0.16,
          ) *
          0.008 *
          idle;

        pivot.rotation.z =
          Math.sin(
            elapsed * 0.2,
          ) *
          0.004 *
          idle;

        /* ====================================================
           SCROLL PARALLAX
           ==================================================== */

        const parallaxX =
          Math.sin(
            p * Math.PI * 2,
          ) *
          0.85 *
          intensity;

        const parallaxY =
          Math.cos(
            p * Math.PI * 1.7,
          ) *
          0.3 *
          intensity;

        const parallaxZ =
          -p *
          1.8 *
          intensity;

        content.position.x =
          parallaxX;

        content.position.y =
          parallaxY;

        content.position.z =
          parallaxZ;

        /* ====================================================
           JOURNEY TRANSLATION
           ==================================================== */

        const journeyTravel =
          journey *
          intensity;

        content.position.x +=
          lerp(
            0,
            -2.4,
            journeyTravel,
          );

        content.position.y +=
          lerp(
            0,
            -0.45,
            journeyTravel,
          );

        content.position.z +=
          lerp(
            0,
            -5.5,
            journeyTravel,
          );

        /* ====================================================
           SCROLL ROTATION
           ==================================================== */

        content.rotation.y =
          lerp(
            0,
            -0.48,
            journey,
          ) +
          Math.sin(
            elapsed * 0.23,
          ) *
          0.015 *
          idle;

        content.rotation.x =
          lerp(
            0,
            0.1,
            journey,
          );

        content.rotation.z =
          lerp(
            0,
            -0.035,
            journey,
          ) +
          velocity.current *
          0.004 *
          intensity;

        /* ====================================================
           TRANSITION MOTION
           ==================================================== */

        const transitionX =
          lerp(
            0,
            -3.8,
            transition,
          );

        const transitionY =
          lerp(
            0,
            -1.7,
            transition,
          );

        const transitionZ =
          lerp(
            0,
            -9,
            transition,
          );

        content.position.x +=
          transitionX *
          intensity;

        content.position.y +=
          transitionY *
          intensity;

        content.position.z +=
          transitionZ *
          intensity;

        content.rotation.y +=
          lerp(
            0,
            -0.4,
            transition,
          );

        content.rotation.x +=
          lerp(
            0,
            0.22,
            transition,
          );

        /* ====================================================
           TRANSITION SCALE
           ==================================================== */

        const transitionScale =
          lerp(
            1,
            0.72,
            transition,
          );

        content.scale.lerp(
          new THREE.Vector3(
            transitionScale,
            transitionScale,
            transitionScale,
          ),
          clamp(
            delta * 5,
            0,
            1,
          ),
        );

        /* ====================================================
           INTRO SCALE / REVEAL
           ==================================================== */

        const introScale =
          lerp(
            0.78,
            1,
            1 - intro,
          );

        const finalScale =
          introScale *
          transitionScale;

        const targetScale =
          new THREE.Vector3(
            finalScale,
            finalScale,
            finalScale,
          );

        content.scale.lerp(
          targetScale,
          clamp(
            delta * 7,
            0,
            1,
          ),
        );

        /* ====================================================
           EXIT MOTION
           ==================================================== */

        if (exit > 0) {
          content.position.z +=
            lerp(
              0,
              -4,
              exit,
            );

          content.position.y +=
            lerp(
              0,
              1.4,
              exit,
            );

          content.position.x +=
            lerp(
              0,
              -1.6,
              exit,
            );

          content.rotation.y +=
            lerp(
              0,
              -0.6,
              exit,
            );

          content.rotation.x +=
            lerp(
              0,
              0.16,
              exit,
            );

          const exitScale =
            lerp(
              1,
              0.64,
              exit,
            );

          content.scale.lerp(
            new THREE.Vector3(
              exitScale,
              exitScale,
              exitScale,
            ),
            clamp(
              delta * 5,
              0,
              1,
            ),
          );
        }

        /* ====================================================
           SCROLL VELOCITY KICK
           ==================================================== */

        const velocityKick =
          clamp(
            Math.abs(
              velocity.current,
            ),
            0,
            2.5,
          );

        content.rotation.z +=
          Math.sin(
            velocity.current *
              Math.PI *
              0.5,
          ) *
          0.018 *
          velocityKick *
          intensity;

        content.position.y +=
          velocity.current *
          0.035 *
          intensity;

        /* ====================================================
           MICRO CAMERA-LIKE MOVEMENT
           ==================================================== */

        content.position.x +=
          Math.sin(
            elapsed * 0.37,
          ) *
          0.025 *
          idle;

        content.position.y +=
          Math.cos(
            elapsed * 0.31,
          ) *
          0.02 *
          idle;

        /* ====================================================
           FINAL GROUP EASING
           ==================================================== */

        group.rotation.x =
          lerp(
            group.rotation.x,
            0,
            clamp(
              delta * 4,
              0,
              1,
            ),
          );

        group.rotation.z =
          lerp(
            group.rotation.z,
            0,
            clamp(
              delta * 4,
              0,
              1,
            ),
          );
      },
    );

    /* ========================================================
       MATERIAL OPTIMIZATION / VISUAL PREP
       ======================================================== */

    useEffect(() => {
      meshes.forEach((mesh) => {
        const materials =
          Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

        materials.forEach(
          (material) => {
            if (
              material instanceof
              THREE.MeshStandardMaterial
            ) {
              material.envMapIntensity =
                1.05;

              material.needsUpdate =
                true;
            }

            if (
              material instanceof
              THREE.MeshPhysicalMaterial
            ) {
              material.envMapIntensity =
                1.2;

              material.roughness =
                clamp(
                  material.roughness,
                  0.22,
                  0.9,
                );

              material.needsUpdate =
                true;
            }
          },
        );
      });
    }, [meshes]);

    /* ========================================================
       RENDER
       ======================================================== */

    return (
      <group
        ref={groupRef}
        {...groupProps}
      >
        <group ref={pivotRef}>
          <group ref={contentRef}>
            <Float
              speed={0.35}
              rotationIntensity={0.08}
              floatIntensity={0.12}
              floatingRange={[
                -0.08,
                0.08,
              ]}
            >
              <primitive
                object={scene}
              />
            </Float>
          </group>
        </group>
      </group>
    );
  },
);

SubwayStation.displayName =
  "SubwayStation";

useGLTF.preload(MODEL_PATH);
