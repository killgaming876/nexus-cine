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
   NEXUS / ADIDAS PRODUCT CINEMATIC
   ============================================================ */

/**
 * IMPORTANT:
 *
 * This project is deployed under GitHub Pages:
 *
 *   https://killgaming876.github.io/nexus-cine/
 *
 * Therefore the GLB must include the repository base path.
 */
const MODEL_PATH =
  "/nexus-cine/models/adidas-shoe.glb";

/* Product framing target.
 * These values are intentionally larger than the station's
 * normalization because the shoe is supposed to become the
 * visual hero during the product-reveal chapter.
 */
const DEFAULT_TARGET_LENGTH = 4.8;
const DEFAULT_TARGET_HEIGHT = 2.2;

/* Scroll chapters */
const REVEAL_START = 0.43;
const REVEAL_PEAK = 0.66;
const CINEMATIC_START = 0.62;
const CINEMATIC_END = 0.9;
const FINAL_HERO_START = 0.86;

/* ============================================================
   TYPES
   ============================================================ */

type AdidasShoeGLTF = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

const SHOE_PART_NAMES = {
  logo: "Adidas",
  laces: "Cordones",
  tongue: "Lengua",
  sole: "Suela",
  body: "Zapato",
  strap: "Correa",
} as const;

export type ShoePartName =
  keyof typeof SHOE_PART_NAMES;

export type ShoePartRefs =
  Partial<
    Record<
      ShoePartName,
      THREE.Object3D
    >
  >;

export interface AdidasShoeHandle {
  group: THREE.Group;
  scene: THREE.Group;

  parts: ShoePartRefs;

  center: THREE.Vector3;
  size: THREE.Vector3;

  normalizedScale: number;

  getBoundingBox: () => THREE.Box3;
  getWorldCenter: () => THREE.Vector3;
  getWorldSize: () => THREE.Vector3;

  setReveal: (value: number) => void;
  resetAnimation: () => void;
}

export type Object3DTransformProps = {
  position?:
    | THREE.Vector3
    | [number, number, number];

  rotation?:
    | THREE.Euler
    | [number, number, number];

  scale?:
    | THREE.Vector3
    | [number, number, number]
    | number;

  visible?: boolean;
  name?: string;
};

export type AdidasShoeProps =
  Object3DTransformProps & {
    castShadow?: boolean;
    receiveShadow?: boolean;

    /**
     * Global page scroll progress 0 → 1.
     */
    scrollProgress?: number;

    /**
     * Product reveal intensity.
     */
    revealIntensity?: number;

    /**
     * Idle floating / breathing intensity.
     */
    idleIntensity?: number;

    /**
     * Automatically normalize the source model.
     */
    normalize?: boolean;

    /**
     * Approximate desired shoe length in world units.
     */
    targetLength?: number;

    /**
     * Additional scale after normalization.
     */
    modelScale?: number;

    /**
     * Optional dynamic input to create a
     * pointer-follow / showroom effect.
     *
     * Values are generally -1 → 1.
     */
    pointerX?: number;
    pointerY?: number;

    /**
     * Allows an external component to temporarily
     * force the reveal amount.
     */
    externalReveal?: number | null;

    onReady?: (
      scene: THREE.Group,
      parts: ShoePartRefs,
    ) => void;

    onBoundsReady?: (
      bounds: THREE.Box3,
      size: THREE.Vector3,
      center: THREE.Vector3,
      scale: number,
    ) => void;

    onAnimationStateChange?: (
      state:
        | "hidden"
        | "enter"
        | "reveal"
        | "cinematic"
        | "hero",
    ) => void;
  };

/* ============================================================
   HELPERS
   ============================================================ */

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    Math.max(value, min),
    max,
  );
}

function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
) {
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
) {
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
) {
  return a + (b - a) * t;
}

function damp(
  current: number,
  target: number,
  lambda: number,
  delta: number,
) {
  return THREE.MathUtils.damp(
    current,
    target,
    lambda,
    delta,
  );
}

/* ============================================================
   COMPONENT
   ============================================================ */

export const AdidasShoe = forwardRef<
  AdidasShoeHandle,
  AdidasShoeProps
>(
  function AdidasShoe(
    {
      castShadow = false,
      receiveShadow = false,

      scrollProgress = 0,

      revealIntensity = 1,
      idleIntensity = 1,

      normalize = true,
      targetLength =
        DEFAULT_TARGET_LENGTH,

      modelScale = 1,

      pointerX = 0,
      pointerY = 0,

      externalReveal = null,

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

    const productRef =
      useRef<THREE.Group>(null);

    const visualRef =
      useRef<THREE.Group>(null);

    const { scene } =
      useGLTF(MODEL_PATH) as AdidasShoeGLTF;

    /* ========================================================
       SOURCE BOUNDS
       ======================================================== */

    const sourceBounds = useMemo(() => {
      return new THREE.Box3().setFromObject(
        scene,
      );
    }, [scene]);

    const sourceSize = useMemo(() => {
      return sourceBounds.getSize(
        new THREE.Vector3(),
      );
    }, [sourceBounds]);

    const sourceCenter = useMemo(() => {
      return sourceBounds.getCenter(
        new THREE.Vector3(),
      );
    }, [sourceBounds]);

    /**
     * Shoe length can be either X or Z depending on
     * the original authoring orientation.
     *
     * We use the larger horizontal axis.
     */
    const dominantLength = useMemo(() => {
      return Math.max(
        sourceSize.x,
        sourceSize.z,
        0.0001,
      );
    }, [sourceSize]);

    const normalizedScale = useMemo(() => {
      if (!normalize) {
        return modelScale;
      }

      return (
        targetLength /
        dominantLength *
        modelScale
      );
    }, [
      normalize,
      dominantLength,
      targetLength,
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
       NAMED PARTS
       ======================================================== */

    const parts = useMemo(() => {
      const found: ShoePartRefs = {};

      (
        Object.keys(
          SHOE_PART_NAMES,
        ) as ShoePartName[]
      ).forEach((key) => {
        const object =
          scene.getObjectByName(
            SHOE_PART_NAMES[key],
          );

        if (object) {
          found[key] = object;
        }
      });

      return found;
    }, [scene]);

    /* ========================================================
       ALL MESHES
       ======================================================== */

    const meshes = useMemo(() => {
      const found: THREE.Mesh[] = [];

      scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh
        ) {
          found.push(child);
        }
      });

      return found;
    }, [scene]);

    /* ========================================================
       MODEL PREPARATION
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

          const materials =
            Array.isArray(
              child.material,
            )
              ? child.material
              : [child.material];

          materials.forEach(
            (material) => {
              material.needsUpdate = true;
            },
          );
        }
      });

      /**
       * Recenter around bounding-box center
       * so rotations happen around the shoe itself.
       */
      scene.position.set(
        -sourceCenter.x,
        -sourceCenter.y,
        -sourceCenter.z,
      );

      scene.scale.setScalar(
        normalizedScale,
      );

      onReady?.(
        scene,
        parts,
      );

      onBoundsReady?.(
        sourceBounds,
        normalizedSize,
        normalizedCenter,
        normalizedScale,
      );
    }, [
      scene,
      parts,
      sourceCenter,
      sourceBounds,
      normalizedScale,
      normalizedSize,
      normalizedCenter,
      castShadow,
      receiveShadow,
      onReady,
      onBoundsReady,
    ]);

    /* ========================================================
       MATERIAL PREPARATION
       ======================================================== */

    useEffect(() => {
      meshes.forEach((mesh) => {
        const materials =
          Array.isArray(
            mesh.material,
          )
            ? mesh.material
            : [mesh.material];

        materials.forEach(
          (material) => {
            if (
              material instanceof
              THREE.MeshStandardMaterial
            ) {
              material.envMapIntensity =
                1.15;

              material.needsUpdate =
                true;
            }

            if (
              material instanceof
              THREE.MeshPhysicalMaterial
            ) {
              material.envMapIntensity =
                1.25;

              material.clearcoat =
                Math.max(
                  material.clearcoat,
                  0.18,
                );

              material.clearcoatRoughness =
                Math.min(
                  material.clearcoatRoughness,
                  0.35,
                );

              material.needsUpdate =
                true;
            }
          },
        );
      });
    }, [meshes]);

    /* ========================================================
       EXTERNAL HANDLE
       ======================================================== */

    const getBoundingBox =
      useCallback(() => {
        if (!groupRef.current) {
          return new THREE.Box3();
        }

        return new THREE.Box3().setFromObject(
          groupRef.current,
        );
      }, []);

    const getWorldCenter =
      useCallback(() => {
        if (!groupRef.current) {
          return new THREE.Vector3();
        }

        const result =
          new THREE.Vector3();

        groupRef.current.getWorldPosition(
          result,
        );

        return result;
      }, []);

    const getWorldSize =
      useCallback(() => {
        return getBoundingBox().getSize(
          new THREE.Vector3(),
        );
      }, [getBoundingBox]);

    const setReveal =
      useCallback((value: number) => {
        const reveal =
          clamp(value, 0, 1);

        if (!groupRef.current) {
          return;
        }

        groupRef.current.visible =
          reveal > 0.005;

        if (visualRef.current) {
          const scale = lerp(
            0.25,
            1,
            reveal,
          );

          visualRef.current.scale.setScalar(
            scale,
          );

          visualRef.current.position.z =
            lerp(
              -4,
              0,
              reveal,
            );
        }
      }, []);

    const resetAnimation =
      useCallback(() => {
        const group =
          groupRef.current;

        const pivot =
          pivotRef.current;

        const product =
          productRef.current;

        const visual =
          visualRef.current;

        if (!group) {
          return;
        }

        group.visible = false;

        group.position.set(
          0,
          0,
          0,
        );

        group.rotation.set(
          0,
          0,
          0,
        );

        group.scale.setScalar(
          1,
        );

        if (pivot) {
          pivot.position.set(
            0,
            0,
            0,
          );

          pivot.rotation.set(
            0,
            0,
            0,
          );
        }

        if (product) {
          product.position.set(
            0,
            0,
            0,
          );

          product.rotation.set(
            0,
            0,
            0,
          );

          product.scale.setScalar(
            1,
          );
        }

        if (visual) {
          visual.position.set(
            0,
            0,
            0,
          );

          visual.rotation.set(
            0,
            0,
            0,
          );

          visual.scale.setScalar(
            1,
          );
        }
      }, []);

    useImperativeHandle(
      ref,
      () => ({
        group:
          groupRef.current as THREE.Group,

        scene,

        parts,

        center:
          normalizedCenter.clone(),

        size:
          normalizedSize.clone(),

        normalizedScale,

        getBoundingBox,

        getWorldCenter,

        getWorldSize,

        setReveal,

        resetAnimation,
      }),
      [
        scene,
        parts,
        normalizedCenter,
        normalizedSize,
        normalizedScale,
        getBoundingBox,
        getWorldCenter,
        getWorldSize,
        setReveal,
        resetAnimation,
      ],
    );

    /* ========================================================
       ANIMATION STATE
       ======================================================== */

    const smoothedScroll =
      useRef(scrollProgress);

    const previousScroll =
      useRef(scrollProgress);

    const velocity =
      useRef(0);

    const currentReveal =
      useRef(0);

    const previousState =
      useRef<
        | "hidden"
        | "enter"
        | "reveal"
        | "cinematic"
        | "hero"
      >("hidden");

    /* ========================================================
       FRAME LOOP
       ======================================================== */

    useFrame(
      (state, delta) => {
        const group =
          groupRef.current;

        const pivot =
          pivotRef.current;

        const product =
          productRef.current;

        const visual =
          visualRef.current;

        if (
          !group ||
          !pivot ||
          !product ||
          !visual
        ) {
          return;
        }

        const elapsed =
          state.clock.elapsedTime;

        /* ----------------------------------------------------
           SMOOTH SCROLL
           ---------------------------------------------------- */

        const rawScroll =
          clamp(
            scrollProgress,
            0,
            1,
          );

        smoothedScroll.current =
          damp(
            smoothedScroll.current,
            rawScroll,
            7,
            delta,
          );

        const p =
          smoothedScroll.current;

        /* ----------------------------------------------------
           SCROLL VELOCITY
           ---------------------------------------------------- */

        const rawVelocity =
          (rawScroll -
            previousScroll.current) /
          Math.max(
            delta,
            1 / 120,
          );

        previousScroll.current =
          rawScroll;

        velocity.current =
          damp(
            velocity.current,
            clamp(
              rawVelocity,
              -5,
              5,
            ),
            8,
            delta,
          );

        /* ====================================================
           REVEAL CURVES
           ==================================================== */

        const enter =
          smoothstep(
            REVEAL_START,
            0.52,
            p,
          );

        const reveal =
          smootherstep(
            REVEAL_START,
            REVEAL_PEAK,
            p,
          );

        const cinematic =
          smoothstep(
            CINEMATIC_START,
            CINEMATIC_END,
            p,
          );

        const hero =
          smootherstep(
            FINAL_HERO_START,
            1,
            p,
          );

        /* ====================================================
           EXTERNAL OVERRIDE
           ==================================================== */

        const external =
          externalReveal === null ||
          externalReveal === undefined
            ? null
            : clamp(
                externalReveal,
                0,
                1,
              );

        const targetReveal =
          external ??
          reveal;

        currentReveal.current =
          damp(
            currentReveal.current,
            targetReveal,
            8,
            delta,
          );

        const r =
          currentReveal.current;

        /* ====================================================
           STATE
           ==================================================== */

        let animationState:
          | "hidden"
          | "enter"
          | "reveal"
          | "cinematic"
          | "hero";

        if (r < 0.03) {
          animationState = "hidden";
        } else if (
          p < REVEAL_START + 0.05
        ) {
          animationState = "enter";
        } else if (
          p < CINEMATIC_START
        ) {
          animationState = "reveal";
        } else if (
          p < FINAL_HERO_START
        ) {
          animationState = "cinematic";
        } else {
          animationState = "hero";
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
           VISIBILITY
           ==================================================== */

        group.visible =
          r > 0.005;

        /* ====================================================
           PRODUCT SCALE
           ==================================================== */

        const introScale =
          lerp(
            0.18,
            1,
            smootherstep(
              0,
              1,
              enter,
            ),
          );

        const overshoot =
          Math.sin(
            Math.min(
              enter,
              1,
            ) *
              Math.PI,
          ) *
          0.08;

        const heroScale =
          lerp(
            1,
            1.14,
            hero,
          );

        const cinematicScale =
          introScale +
          overshoot;

        const targetProductScale =
          cinematicScale *
          heroScale *
          revealIntensity;

        product.scale.lerp(
          new THREE.Vector3(
            targetProductScale,
            targetProductScale,
            targetProductScale,
          ),
          clamp(
            delta * 8,
            0,
            1,
          ),
        );

        /* ====================================================
           Z AXIS REVEAL
           ==================================================== */

        visual.position.z =
          lerp(
            -6.5,
            0,
            r,
          );

        /* ====================================================
           MAIN PRODUCT ENTRANCE
           ==================================================== */

        visual.position.x =
          lerp(
            4.8,
            0,
            smootherstep(
              0,
              1,
              r,
            ),
          );

        visual.position.y =
          lerp(
            -2.2,
            0,
            smootherstep(
              0,
              1,
              r,
            ),
          );

        /* ====================================================
           DRAMATIC REVEAL ROTATION
           ==================================================== */

        const entranceRotation =
          lerp(
            Math.PI * 0.95,
            0.12,
            r,
          );

        product.rotation.y =
          entranceRotation;

        product.rotation.x =
          lerp(
            -0.32,
            0.04,
            r,
          );

        product.rotation.z =
          lerp(
            0.18,
            -0.02,
            r,
          );

        /* ====================================================
           CINEMATIC ORBIT
           ==================================================== */

        const orbit =
          cinematic *
          Math.PI *
          0.72;

        product.rotation.y +=
          orbit;

        product.rotation.x +=
          Math.sin(
            elapsed * 0.45,
          ) *
          0.025 *
          idleIntensity;

        product.rotation.z +=
          Math.cos(
            elapsed * 0.34,
          ) *
          0.018 *
          idleIntensity;

        /* ====================================================
           HERO CONTINUOUS ROTATION
           ==================================================== */

        product.rotation.y +=
          hero *
          elapsed *
          0.12;

        /* ====================================================
           IDLE FLOAT
           ==================================================== */

        const floatY =
          Math.sin(
            elapsed * 0.9,
          ) *
          0.08 *
          idleIntensity *
          r;

        const floatX =
          Math.sin(
            elapsed * 0.46,
          ) *
          0.04 *
          idleIntensity *
          r;

        const floatZ =
          Math.cos(
            elapsed * 0.58,
          ) *
          0.045 *
          idleIntensity *
          r;

        pivot.position.y =
          damp(
            pivot.position.y,
            floatY,
            6,
            delta,
          );

        pivot.position.x =
          damp(
            pivot.position.x,
            floatX,
            6,
            delta,
          );

        pivot.position.z =
          damp(
            pivot.position.z,
            floatZ,
            6,
            delta,
          );

        /* ====================================================
           POINTER / SHOWROOM TILT
           ==================================================== */

        pivot.rotation.x =
          damp(
            pivot.rotation.x,
            -pointerY *
              0.1 *
              r,
            7,
            delta,
          );

        pivot.rotation.y =
          damp(
            pivot.rotation.y,
            pointerX *
              0.14 *
              r,
            7,
            delta,
          );

        /* ====================================================
           SCROLL VELOCITY REACTION
           ==================================================== */

        const speed =
          clamp(
            velocity.current,
            -2.5,
            2.5,
          );

        product.rotation.z +=
          speed *
          0.018 *
          revealIntensity;

        visual.position.y +=
          speed *
          0.035 *
          revealIntensity;

        /* ====================================================
           DEEP PRODUCT PARALLAX
           ==================================================== */

        product.position.x =
          damp(
            product.position.x,
            Math.sin(
              p * Math.PI * 2,
            ) *
              0.28 *
              cinematic,
            5,
            delta,
          );

        product.position.y =
          damp(
            product.position.y,
            Math.cos(
              p * Math.PI * 1.8,
            ) *
              0.14 *
              cinematic,
            5,
            delta,
          );

        /* ====================================================
           HERO LIFT
           ==================================================== */

        if (hero > 0) {
          visual.position.y +=
            lerp(
              0,
              0.28,
              hero,
            );

          visual.position.z +=
            lerp(
              0,
              0.55,
              hero,
            );
        }

        /* ====================================================
           PART-SPECIFIC ANIMATION
           ==================================================== */

        if (parts.logo) {
          parts.logo.rotation.y =
            Math.sin(
              elapsed * 1.2,
            ) *
            0.035 *
            r;

          parts.logo.position.y =
            Math.sin(
              elapsed * 1.4,
            ) *
            0.006 *
            r;
        }

        if (parts.laces) {
          parts.laces.rotation.x =
            Math.sin(
              elapsed * 1.7,
            ) *
            0.02 *
            r;

          parts.laces.rotation.z =
            Math.cos(
              elapsed * 1.3,
            ) *
            0.018 *
            r;
        }

        if (parts.tongue) {
          parts.tongue.rotation.x =
            Math.sin(
              elapsed * 0.75,
            ) *
            0.025 *
            r;
        }

        if (parts.sole) {
          parts.sole.rotation.y =
            Math.sin(
              elapsed * 0.8,
            ) *
            0.009 *
            r;
        }

        /* ====================================================
           MICRO JITTER DURING FAST SCROLL
           ==================================================== */

        const motionEnergy =
          clamp(
            Math.abs(
              velocity.current,
            ),
            0,
            2,
          );

        visual.rotation.z +=
          Math.sin(
            elapsed * 24,
          ) *
          0.0015 *
          motionEnergy;

        visual.position.x +=
          Math.sin(
            elapsed * 19,
          ) *
          0.004 *
          motionEnergy;

        /* ====================================================
           FINAL HERO CINEMATIC
           ==================================================== */

        if (hero > 0.01) {
          const heroBreath =
            Math.sin(
              elapsed * 0.65,
            ) *
            0.035;

          product.position.y =
            damp(
              product.position.y,
              heroBreath,
              4,
              delta,
            );

          product.rotation.x =
            damp(
              product.rotation.x,
              heroBreath * 0.7,
              4,
              delta,
            );
        }

        /* ====================================================
           EXTRA PRODUCT SWEEP
           ==================================================== */

        const sweep =
          Math.sin(
            p * Math.PI,
          );

        visual.position.x +=
          sweep *
          0.28 *
          cinematic;

        visual.position.z +=
          sweep *
          0.42 *
          cinematic;

        /* ====================================================
           RESET TRANSFORM ACCUMULATION
           ==================================================== */

        group.rotation.x =
          damp(
            group.rotation.x,
            0,
            5,
            delta,
          );

        group.rotation.z =
          damp(
            group.rotation.z,
            0,
            5,
            delta,
          );
      },
    );

    /* ========================================================
       RENDER
       ======================================================== */

    return (
      <group
        ref={groupRef}
        {...groupProps}
      >
        <group ref={pivotRef}>
          <group ref={productRef}>
            <group ref={visualRef}>
              <Float
                speed={0.3}
                rotationIntensity={0.045}
                floatIntensity={0.055}
                floatingRange={[
                  -0.025,
                  0.025,
                ]}
              >
                <primitive
                  object={scene}
                />
              </Float>
            </group>
          </group>
        </group>
      </group>
    );
  },
);

AdidasShoe.displayName =
  "AdidasShoe";

/* ============================================================
   PRELOAD
   ============================================================ */

useGLTF.preload(
  MODEL_PATH,
);
