'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';

/**
 * Web-optimized asset this component expects to find at runtime.
 *
 * NOTE: the source ZIP for this model does not contain an FBX. It contains
 * a Blender source file (`source/station.blend`, ~9.8 MB) plus a loose
 * `textures/` folder. That `.blend` still needs to be exported to glTF/GLB
 * (directly from Blender, which has a first-party glTF exporter — no FBX
 * hop required) before anything can load from this path. See the chat
 * response for the full list of issues found in the source file.
 */
import { assetPath } from '@/lib/assetPath';

const MODEL_PATH = assetPath('/models/subway-station.glb');

type SubwayStationGLTF = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export interface SubwayStationHandle {
  /** Wrapping group. Animate position/rotation/scale on this from GSAP/scroll rigs. */
  group: THREE.Group;
  /** The loaded scene graph itself, for traversal or targeting nodes by name. */
  scene: THREE.Group;
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

export type SubwayStationProps = Object3DTransformProps & {
  /** Apply castShadow to every mesh in the station. Default: true. */
  castShadow?: boolean;
  /** Apply receiveShadow to every mesh in the station. Default: true. */
  receiveShadow?: boolean;
  /**
   * Fires once after the model mounts, with the loaded scene graph.
   * Once the real GLB exists, use this to grab specific named nodes
   * (platform, columns, ceiling, ad panels, etc.) for GSAP timelines or
   * camera-path targets, without this component needing to hardcode names
   * it can't currently verify. Blender's glTF exporter preserves object
   * names from the .blend file, so the names visible in Blender's outliner
   * are the ones to target here.
   */
  onReady?: (scene: THREE.Group) => void;
};

/**
 * Loads and renders the subway station environment.
 *
 * Presentational only: no Canvas, camera, lighting rig, fog, post-processing,
 * or scroll system lives here. Compose this inside whatever owns the
 * cinematic timeline, and drive it via props / the forwarded ref / `onReady`.
 */
export const SubwayStation = forwardRef<SubwayStationHandle, SubwayStationProps>(
  function SubwayStation(
    { castShadow = true, receiveShadow = true, onReady, ...groupProps },
    ref
  ) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF(MODEL_PATH) as SubwayStationGLTF;

    useEffect(() => {
      // The station is only ever instanced once in the scene, so we mutate
      // and render the cached GLTF scene graph directly rather than cloning
      // it — cloning a ~10 MB mesh graph for a single instance would just
      // duplicate geometry/material references for no benefit.
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });
      onReady?.(scene);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, castShadow, receiveShadow]);

    useImperativeHandle(ref, () => ({ group: groupRef.current as THREE.Group, scene }), [
      scene,
    ]);

    return (
      <group ref={groupRef} {...groupProps}>
        <primitive object={scene} />
      </group>
    );
  }
);

useGLTF.preload(MODEL_PATH);
