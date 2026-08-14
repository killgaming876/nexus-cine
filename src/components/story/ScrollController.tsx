'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Guarded at module scope so this never touches the DOM during server
// rendering — 'use client' keeps this file's *code* out of RSC output, but
// the guard is kept explicit anyway per the brief.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * ScrollController
 * -----------------
 * Headless bridge from page scroll to a normalized progress value:
 *
 *   scrollY → ScrollTrigger → progress 0…1 → (future) 3D animation system
 *
 * Renders no DOM and no Three.js objects — it's pure side-effect/logic, so
 * it can be mounted anywhere in the client tree (most naturally once,
 * at the page/layout level, alongside the persistent `<Experience />`
 * Canvas — not inside the Canvas itself).
 *
 * Progress is intentionally NOT stored in React state. Every scroll tick
 * would otherwise trigger a React re-render, which is exactly the kind of
 * per-frame setState the brief calls out to avoid. Instead:
 *   - `onProgress(progress)` fires from GSAP's own ticker, and
 *   - the same value is written to a ref, readable on demand via the
 *     forwarded handle's `getProgress()`.
 * Consumers (e.g. a future master timeline, or a `useFrame` loop) should
 * poll the ref / handle rather than push progress through React props.
 *
 * Smoothing: the raw scroll position is exposed via `getRawProgress()`
 * (updates 1:1 with the scrollbar, no easing). The primary `progress`
 * value (`onProgress` / `getProgress()`) runs through a scrubbed GSAP tween
 * on a proxy object instead, which adds a short catch-up ease so a camera
 * driven by it reads as smooth rather than snapping frame-to-frame with
 * the mouse wheel. Set `scrub={false}` to disable that smoothing and use
 * the raw value's cadence instead.
 *
 * This does not know about the camera, the station, or the shoe — nothing
 * here is subway/shoe-specific. Wiring `onProgress` into `CameraRig`'s
 * `rig`/`head`/`camera` targets is a job for the next generation's master
 * timeline, not this component.
 */

export interface ScrollControllerHandle {
  /** Smoothed progress (0→1), read on demand. A snapshot — poll it (e.g. inside a GSAP ticker or `useFrame`), don't read it during React render. */
  getProgress: () => number;
  /** Raw, unsmoothed progress (0→1) — updates exactly with scroll position, no easing. */
  getRawProgress: () => number;
  /** The underlying ScrollTrigger instance, once created. Null before the client effect runs. */
  scrollTrigger: ScrollTrigger | null;
  /** Force ScrollTrigger to recompute start/end — call after layout-affecting content (e.g. late-loading models) changes page height. */
  refresh: () => void;
}

export interface ScrollControllerProps {
  /** Element (or CSS selector) whose scroll range defines progress 0→1. Defaults to `document.body` — i.e. the whole page. */
  trigger?: string | Element | null;
  /** Scroll container to observe, if not the window. Passed straight through to ScrollTrigger. */
  scroller?: string | Element;
  /** ScrollTrigger `start` position. Default: 'top top'. */
  start?: string;
  /** ScrollTrigger `end` position. Default: 'bottom bottom'. */
  end?: string;
  /**
   * Smoothing applied to the primary progress value. `true` (default) uses
   * a gentle default catch-up ease; a number sets that smoothing duration
   * (seconds) directly; `false` disables smoothing so progress tracks the
   * scrollbar 1:1 (same cadence as `getRawProgress()`).
   */
  scrub?: boolean | number;
  /**
   * Pin the trigger element for the scroll range. Default: false. Only
   * meaningful for a *specific* section element being pinned as the user
   * scrolls past it — leave this false when `trigger` is left at its
   * whole-page default, or the page can't scroll at all.
   */
  pin?: boolean;
  /** Fires on every update with the smoothed progress (0→1). Called from GSAP's ticker — write to a ref/GSAP target here, don't setState. */
  onProgress?: (progress: number) => void;
  /** Fires once after the ScrollTrigger instance is created, for advanced use (`.refresh()`, `.scroll()`, etc.). */
  onReady?: (instance: ScrollTrigger) => void;
  /** Dev-only ScrollTrigger debug markers. Default: false. */
  markers?: boolean;
}

const DEFAULT_START = 'top top';
const DEFAULT_END = 'bottom bottom';
const DEFAULT_SCRUB_SMOOTHING = 0.6;

export const ScrollController = forwardRef<ScrollControllerHandle, ScrollControllerProps>(
  function ScrollController(
    {
      trigger = null,
      scroller,
      start = DEFAULT_START,
      end = DEFAULT_END,
      scrub = true,
      pin = false,
      onProgress,
      onReady,
      markers = false,
    },
    ref
  ) {
    const progressRef = useRef(0);
    const rawProgressRef = useRef(0);
    const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

    // Latest callbacks live in refs so the effect below doesn't need them
    // as dependencies — an inline arrow function passed as `onProgress` on
    // every parent render would otherwise tear down and recreate the
    // ScrollTrigger every render.
    const onProgressRef = useRef(onProgress);
    const onReadyRef = useRef(onReady);
    onProgressRef.current = onProgress;
    onReadyRef.current = onReady;

    useEffect(() => {
      const ctx = gsap.context(() => {
        const proxy = { progress: 0 };

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: trigger ?? document.body,
            scroller,
            start,
            end,
            scrub: scrub === true ? DEFAULT_SCRUB_SMOOTHING : scrub,
            pin,
            markers,
            onUpdate: (self) => {
              rawProgressRef.current = self.progress;
            },
          },
        }).to(proxy, {
          progress: 1,
          ease: 'none',
          onUpdate: () => {
            progressRef.current = proxy.progress;
            onProgressRef.current?.(proxy.progress);
          },
        });

        const instance = timeline.scrollTrigger ?? null;
        scrollTriggerRef.current = instance;
        if (instance) onReadyRef.current?.(instance);
      });

      return () => {
        // Kills the ScrollTrigger + tween created above and removes their
        // listeners — everything created inside `ctx`'s callback.
        ctx.revert();
        scrollTriggerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, scroller, start, end, scrub, pin, markers]);

    useImperativeHandle(
      ref,
      () => ({
        getProgress: () => progressRef.current,
        getRawProgress: () => rawProgressRef.current,
        get scrollTrigger() {
          return scrollTriggerRef.current;
        },
        refresh: () => scrollTriggerRef.current?.refresh(),
      }),
      []
    );

    return null;
  }
);
