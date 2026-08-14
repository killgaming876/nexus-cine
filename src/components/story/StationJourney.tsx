'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';

import { CameraRig, type CameraRigHandle } from '../scene/CameraRig';
import { ScrollController, type ScrollControllerHandle, type ScrollControllerProps } from './ScrollController';
import { SubwayStation, type SubwayStationHandle } from '../models/SubwayStation';
import {
  applyStationJourneyProgress,
  createStationJourneyTimeline,
  STATION_CAMERA_WAYPOINTS,
  type StationJourneyTimeline,
} from './StationAnimation';

/**
 * StationJourney
 * ---------------
 * Owns the first cinematic scene: the subway-station camera journey.
 * Composes `SubwayStation`, `CameraRig`, `ScrollController` and wires
 * scroll progress into the GSAP timeline built by `StationAnimation.ts`:
 *
 *   scroll → ScrollController → progress (0…1) → StationAnimation → CameraRig
 *
 * ---------------------------------------------------------------------
 * GENERATION 10 FIX — single-camera / single-station integration:
 * ---------------------------------------------------------------------
 * Earlier generations left this component always mounting its OWN
 * internal `<CameraRig>` (a second `makeDefault` camera) and its OWN
 * internal `<SubwayStation>` (a second mount of the same cached GLTF
 * scene graph `Experience.tsx` already mounts once). That produced two
 * competing default cameras in the same `<Canvas>` and two competing
 * parents fighting over one `THREE.Object3D` scene graph — `WorldTransition`
 * / `ProductShowcase` animate `Experience.tsx`'s camera/groups, while the
 * station journey animated a completely different, invisible-or-random
 * camera.
 *
 * This component now supports an OPTIONAL "externally supplied rig"
 * mode, mirroring the `externalScroll` pattern it already had for
 * scroll:
 *   - Pass `cameraRigRef`/`stationGroupRef`/`subwayStationRef` (all
 *     already-mounted, from the SAME tree `Experience.tsx` owns) and
 *     this component builds its GSAP timeline against those live
 *     objects instead of mounting its own `<CameraRig>` / `<SubwayStation>`.
 *   - Leave them unset and this component mounts its own internal
 *     `<CameraRig>` + `<SubwayStation>`, exactly as before — fully
 *     backward compatible for standalone/drop-in use.
 *
 * SCROLL WIRING — unchanged, two supported modes:
 *   - Standalone (default): leave `externalScroll` unset and
 *     `StationJourney` mounts its own internal `ScrollController`.
 *   - Externally driven: pass an already-mounted `ScrollController`'s
 *     handle as `externalScroll` and `StationJourney` reads progress
 *     from it every frame instead of creating a second ScrollTrigger.
 */

export interface StationJourneyHandle {
  cameraRig: CameraRigHandle;
  station: SubwayStationHandle;
  /** Wrapping group around the station model — attachment point for future lighting/fog. */
  stationGroup: THREE.Group;
  /** The live GSAP scrub timeline, once built. Null before the first effect runs. */
  timeline: StationJourneyTimeline | null;
  /** The internally-mounted ScrollController's handle, or null when `externalScroll` was supplied instead. */
  scrollController: ScrollControllerHandle | null;
}

export interface StationJourneyProps {
  /** Forwarded to the internal SubwayStation (only used when `subwayStationRef` is not supplied). Default: true. */
  castShadow?: boolean;
  /** Forwarded to the internal SubwayStation (only used when `subwayStationRef` is not supplied). Default: true. */
  receiveShadow?: boolean;
  /**
   * Supply an already-mounted ScrollController's handle to have
   * StationJourney read progress from it (polled once per frame) instead
   * of mounting its own. Leave undefined for standalone/drop-in use.
   */
  externalScroll?: ScrollControllerHandle | null;
  /** Only used when `externalScroll` is NOT supplied — forwarded to the internal ScrollController. */
  scrollProps?: Omit<ScrollControllerProps, 'onProgress'>;
  /**
   * Supply an already-mounted `CameraRigHandle` ref (e.g. one rendered by
   * a parent such as `Experience.tsx`) to build the station timeline
   * against THAT rig instead of mounting a second, competing `CameraRig`.
   * When supplied, this component renders no `<CameraRig>` of its own.
   */
  cameraRigRef?: RefObject<CameraRigHandle | null>;
  /**
   * Supply an already-mounted station wrapper group (e.g.
   * `Experience.tsx`'s own `stationGroupRef`) instead of mounting a
   * second `<group>` + `<SubwayStation>`. When supplied together with
   * `subwayStationRef`, this component renders no `<SubwayStation>` of
   * its own — it only animates the camera against the existing model.
   */
  stationGroupRef?: RefObject<THREE.Group | null>;
  /** Companion to `stationGroupRef` — the already-mounted `SubwayStationHandle` ref. Both must be supplied together to skip the internal mount. */
  subwayStationRef?: RefObject<SubwayStationHandle | null>;
  /** Fires once the camera rig, station, and timeline are all ready. */
  onReady?: (handle: StationJourneyHandle) => void;
}

export const StationJourney = forwardRef<StationJourneyHandle, StationJourneyProps>(
  function StationJourney(
    {
      castShadow = true,
      receiveShadow = true,
      externalScroll = null,
      scrollProps,
      cameraRigRef: externalCameraRigRef,
      stationGroupRef: externalStationGroupRef,
      subwayStationRef: externalSubwayStationRef,
      onReady,
    },
    ref
  ) {
    const usingExternalRig = Boolean(externalCameraRigRef);
    const usingExternalStation = Boolean(externalStationGroupRef && externalSubwayStationRef);

    // Internal fallbacks — only ever rendered/used when the matching
    // external ref was not supplied (standalone/drop-in mode).
    const internalCameraRigRef = useRef<CameraRigHandle>(null);
    const internalStationGroupRef = useRef<THREE.Group>(null);
    const internalSubwayStationRef = useRef<SubwayStationHandle>(null);

    const cameraRigRef = externalCameraRigRef ?? internalCameraRigRef;
    const stationGroupRef = externalStationGroupRef ?? internalStationGroupRef;
    const subwayStationRef = externalSubwayStationRef ?? internalSubwayStationRef;

    const scrollControllerRef = useRef<ScrollControllerHandle>(null);
    const timelineRef = useRef<StationJourneyTimeline | null>(null);
    const lastAppliedProgressRef = useRef<number>(-1);

    // Build the scrub timeline once, against the live rig/head/camera
    // objects CameraRig exposes — whether that CameraRig is the one this
    // component mounts itself, or one supplied externally.
    useEffect(() => {
      const cameraRig = cameraRigRef.current;
      if (!cameraRig) return;

      const ctx = gsap.context(() => {
        timelineRef.current = createStationJourneyTimeline({
          rig: cameraRig.rig,
          head: cameraRig.head,
          camera: cameraRig.camera,
        });
      });

      onReady?.({
        cameraRig,
        station: subwayStationRef.current as SubwayStationHandle,
        stationGroup: stationGroupRef.current as THREE.Group,
        timeline: timelineRef.current,
        scrollController: externalScroll ? null : scrollControllerRef.current,
      });

      return () => {
        ctx.revert(); // kills the timeline and any tweens it created
        timelineRef.current = null;
      };
      // Intentionally runs once on mount only — externalScroll swapping
      // mid-life is handled by the useFrame poll below, not a rebuild.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Standalone mode: internal ScrollController pushes progress straight
    // into the timeline from GSAP's own ticker (no extra rAF loop needed).
    const handleInternalProgress = (progress: number) => {
      if (timelineRef.current) applyStationJourneyProgress(timelineRef.current, progress);
    };

    // Externally-driven mode: poll the supplied handle once per frame
    // instead of mounting a second ScrollTrigger instance.
    useFrame(() => {
      if (!externalScroll || !timelineRef.current) return;
      const progress = externalScroll.getProgress();
      if (progress !== lastAppliedProgressRef.current) {
        applyStationJourneyProgress(timelineRef.current, progress);
        lastAppliedProgressRef.current = progress;
      }
    });

    useImperativeHandle(
      ref,
      () => ({
        cameraRig: cameraRigRef.current as CameraRigHandle,
        station: subwayStationRef.current as SubwayStationHandle,
        stationGroup: stationGroupRef.current as THREE.Group,
        timeline: timelineRef.current,
        scrollController: externalScroll ? null : scrollControllerRef.current,
      }),
      [externalScroll]
    );

    const startWaypoint = STATION_CAMERA_WAYPOINTS[0];

    return (
      <>
        {/* Only mount a CameraRig here when no external one was supplied —
            avoids a second `makeDefault` camera fighting Experience.tsx's
            own PerspectiveCamera for control of the scene's active camera. */}
        {!usingExternalRig && (
          <CameraRig
            ref={internalCameraRigRef}
            position={startWaypoint.position}
            rotation={[0, startWaypoint.rotationY, 0]}
          />
        )}

        {/* Only mount SubwayStation here when no external station group was
            supplied — avoids double-mounting the same cached GLTF scene
            graph under two different parents. */}
        {!usingExternalStation && (
          <group ref={internalStationGroupRef} name="stationJourneyGroup">
            <SubwayStation
              ref={internalSubwayStationRef}
              castShadow={castShadow}
              receiveShadow={receiveShadow}
            />
          </group>
        )}

        {externalScroll == null && (
          <ScrollController ref={scrollControllerRef} onProgress={handleInternalProgress} {...scrollProps} />
        )}
      </>
    );
  }
);
