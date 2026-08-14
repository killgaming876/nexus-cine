'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';

/** Web-optimized asset this component expects to find at runtime. */
const MODEL_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/models/adidas-shoe.glb`;

/**
 * Friendly names for the shoe's named sub-groups, mapped to the object
 * names found in the source FBX (`source/TillosMalos.fbx`): Cuero,
 * DetalleTrasero2, almohadillas, DetalleMedios2, bordesCordones, Cordones,
 * Cilindro, Adidas, Plantilla, Lengua, Sujetador, Orificios, Suela,
 * MiniCorrea, DetalleCordon, DetalleFrente, Correa, CordonTrasero, Zapato.
 *
 * Only the ones a product-reveal timeline is likely to target individually
 * are listed below. Blender/glTF export generally preserves these names,
 * but verify against the real GLB once it's generated — the lookup below
 * simply omits a key if its name isn't found, rather than throwing.
 */
const SHOE_PART_NAMES = {
  logo: 'Adidas',
  laces: 'Cordones',
  tongue: 'Lengua',
  sole: 'Suela',
  body: 'Zapato',
  strap: 'Correa',
} as const;

export type ShoePartName = keyof typeof SHOE_PART_NAMES;
export type ShoePartRefs = Partial<Record<ShoePartName, THREE.Object3D>>;

type AdidasShoeGLTF = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export interface AdidasShoeHandle {
  /** Wrapping group. Animate position/rotation/scale on this from GSAP/scroll rigs. */
  group: THREE.Group;
  /** The loaded scene graph itself, for arbitrary traversal. */
  scene: THREE.Group;
  /** Best-effort lookup of the named sub-groups in SHOE_PART_NAMES, by friendly key. */
  parts: ShoePartRefs;
}

/**
 * The handful of Object3D transform props this component forwards to its
 * wrapping <group>. Declared explicitly instead of importing a JSX
 * intrinsic-element type from @react-three/fiber, since that type's shape
 * (and even its name — `GroupProps` vs `ThreeElements['group']`) differs
 * between fiber v8 and v9. GSAP timelines will typically animate the
 * forwarded ref's `.group.position` etc. directly rather than through
 * props, so this keeps the declarative surface small and stable.
 */
export type Object3DTransformProps = {
  position?: THREE.Vector3 | [number, number, number];
  rotation?: THREE.Euler | [number, number, number];
  scale?: THREE.Vector3 | [number, number, number] | number;
  visible?: boolean;
  name?: string;
};

export type AdidasShoeProps = Object3DTransformProps & {
  /** Apply castShadow to every mesh in the shoe. Default: true. */
  castShadow?: boolean;
  /** Apply receiveShadow to every mesh in the shoe. Default: true. */
  receiveShadow?: boolean;
  /** Fires once after the model mounts, with the scene graph and resolved part refs. */
  onReady?: (scene: THREE.Group, parts: ShoePartRefs) => void;
};

/**
 * Loads and renders the Adidas shoe as a standalone product-render object.
 *
 * Presentational only: no Canvas, camera, or reveal/rotation timeline lives
 * here. Materials and textures are left exactly as authored (23 named
 * materials across leather, fabric, plastic, and logo surfaces) — nothing
 * here flattens them into a single material.
 */
export const AdidasShoe = forwardRef<AdidasShoeHandle, AdidasShoeProps>(function AdidasShoe(
  { castShadow = true, receiveShadow = true, onReady, ...groupProps },
  ref
) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH) as AdidasShoeGLTF;

  const parts = useMemo(() => {
    const found: ShoePartRefs = {};
    (Object.keys(SHOE_PART_NAMES) as ShoePartName[]).forEach((key) => {
      const object = scene.getObjectByName(SHOE_PART_NAMES[key]);
      if (object) found[key] = object;
    });
    return found;
  }, [scene]);

  useEffect(() => {
    // Single instance in the scene at a time (the product-reveal hero
    // object) — render the cached GLTF scene graph directly rather than
    // cloning a ~35 MB mesh graph with nothing to gain from the copy.
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });
    onReady?.(scene, parts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, parts, castShadow, receiveShadow]);

  useImperativeHandle(
    ref,
    () => ({ group: groupRef.current as THREE.Group, scene, parts }),
    [scene, parts]
  );

  return (
    <group ref={groupRef} {...groupProps}>
      <primitive object={scene} />
    </group>
  );
});

useGLTF.preload(MODEL_PATH);
