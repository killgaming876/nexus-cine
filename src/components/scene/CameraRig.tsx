'use client';

import * as THREE from 'three';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';

/**
 * CameraRig
 * ---------
 * Structural camera infrastructure for the cinematic subway → shoe-reveal
 * experience. This component owns NO animation of its own — it exists so a
 * future GSAP/ScrollTrigger timeline has stable, three-tier handles to
 * animate against:
 *
 *   Camera  →  CameraRig (rig → head → camera)  →  future cinematic timeline
 *
 *   rig    (THREE.Group)  — macro movement. Primary GSAP target for the
 *                            camera's position/rotation as it travels
 *                            through the station and toward the shoe (the
 *                            "dolly").
 *   head   (THREE.Group)  — nested inside `rig`. Reserved for secondary,
 *                            finer movement (subtle sway, look-at nudges,
 *                            parallax) layered on top of — not fighting —
 *                            the macro `rig` timeline. Intentionally idle
 *                            by default; nothing animates it yet.
 *   camera (PerspectiveCamera) — sits at the local origin of `head`. Tween
 *                            `.fov` / `.near` / `.far` directly (call
 *                            `camera.updateProjectionMatrix()` after any
 *                            fov change) for lens-language beats, e.g.
 *                            tightening focal length into the shoe reveal.
 *
 * GSAP tweens plain numeric object properties, so a later timeline can
 * target `rig.position`, `rig.rotation`, `head.rotation`, etc. directly —
 * no special adapter is needed between this component and GSAP.
 *
 * This does NOT read scroll, GSAP, or any timeline. See
 * ScrollController.tsx for the scroll → normalized-progress side of the
 * pipeline; wiring the two together is a job for the next generation (a
 * master timeline component), not this one.
 *
 * Usage: render this INSIDE a react-three-fiber <Canvas>, in place of a
 * bare <PerspectiveCamera>. It is not currently wired into Experience.tsx —
 * see the chat response for the exact integration change required there.
 */

export interface CameraRigHandle {
  /** The active R3F camera (`makeDefault`). Tween `.fov`/`.near`/`.far` directly; call `camera.updateProjectionMatrix()` after changing fov. */
  camera: THREE.PerspectiveCamera;
  /** Outer group — primary GSAP target for macro camera travel (position + big rotations along the station → shoe path). */
  rig: THREE.Group;
  /** Inner group, nested in `rig` — secondary GSAP target for fine/subtle movement layered on top of the macro path. Idle by default. */
  head: THREE.Group;
  /**
   * One-shot imperative orientation helper: rotates `head` so the camera
   * faces `target` from its *current* world position, correctly composed
   * against whatever transform `rig` currently has. This sets rotation
   * immediately — it is not a tween. For an eased look-at, read
   * `head.rotation` before/after and drive a GSAP tween between the two.
   *
   * Note: relies on the scene's world matrices being up to date, so it's
   * meant to be called after at least one render frame (e.g. from an
   * event handler or a running timeline), not synchronously on mount.
   */
  lookAt: (target: THREE.Vector3 | [number, number, number]) => void;
}

export interface CameraRigProps {
  /** Initial world position of the rig (i.e. the camera's starting point). */
  position?: [number, number, number];
  /** Initial rig rotation, in radians, as [x, y, z] Euler angles. */
  rotation?: [number, number, number];
  /**
   * Vertical field of view, in degrees. Kept restrained/cinematic by
   * default — pushing this much past ~50 starts to read as a wide-angle
   * / fisheye lens rather than a human-scale architectural shot.
   */
  fov?: number;
  near?: number;
  far?: number;
  /** Whether this becomes the scene's default/active camera. Default: true. */
  makeDefault?: boolean;
}

/**
 * Matches Experience.tsx's current `CAMERA_START` placeholder exactly, so
 * swapping the bare `<PerspectiveCamera>` there for `<CameraRig>` is a
 * no-op for the initial frame. The station's real-world scale is still
 * unknown (no real GLB yet — see Experience.tsx's header comment) so this
 * remains a placeholder to retune once real geometry exists, not a final
 * composition.
 */
const DEFAULT_POSITION: [number, number, number] = [0, 1.6, 9];
const DEFAULT_ROTATION: [number, number, number] = [0, 0, 0];
const DEFAULT_FOV = 45;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100;

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  {
    position = DEFAULT_POSITION,
    rotation = DEFAULT_ROTATION,
    fov = DEFAULT_FOV,
    near = DEFAULT_NEAR,
    far = DEFAULT_FAR,
    makeDefault = true,
  },
  ref
) {
  const rigRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useImperativeHandle(
    ref,
    () => ({
      camera: cameraRef.current as THREE.PerspectiveCamera,
      rig: rigRef.current as THREE.Group,
      head: headRef.current as THREE.Group,
      lookAt: (target) => {
        const head = headRef.current;
        const camera = cameraRef.current;
        if (!head || !camera) return;

        const point = target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target);

        const worldPosition = new THREE.Vector3();
        camera.getWorldPosition(worldPosition);

        const lookMatrix = new THREE.Matrix4().lookAt(worldPosition, point, camera.up);
        const worldQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

        // Convert the desired world orientation into a local rotation for
        // `head`, relative to `rig`'s current world orientation, so this
        // composes correctly instead of fighting whatever the macro
        // timeline has done to `rig`.
        const parentQuaternion = new THREE.Quaternion();
        head.parent?.getWorldQuaternion(parentQuaternion);

        head.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
      },
    }),
    []
  );

  return (
    <group ref={rigRef} name="cameraRig" position={position} rotation={rotation}>
      <group ref={headRef} name="cameraHead">
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault={makeDefault}
          fov={fov}
          near={near}
          far={far}
          position={[0, 0, 0]}
        />
      </group>
    </group>
  );
});
