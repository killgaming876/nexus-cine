'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { STORY_PHASES, type StoryPhaseId } from '../story/StoryTimeline';

/**
 * CinematicProgress
 * -------------------
 * Editorial progress indicator for the cinematic story. Reads its state
 * from values already produced by `CinematicStory` (via its
 * `onProgress`/imperative handle) — this component owns no scroll
 * listener, no ScrollTrigger, and no second progress source. It is a
 * thin, controlled display of `STORY_PHASES` (from the existing
 * `StoryTimeline.ts`) against a single incoming progress number.
 *
 * Adjust the import path above if this project's alias/location for
 * `StoryTimeline.ts` differs — it is re-used as-is, not re-implemented.
 */

export interface CinematicProgressProps {
  /** Master story progress, 0…1 — pass straight through from CinematicStory's onProgress/getProgress. */
  progress: number;
  /** Current active phase id — pass straight through from CinematicStory. */
  activePhaseId: StoryPhaseId;
  /** Hide entirely (e.g. on very first paint before the story has mounted). Default: false. */
  hidden?: boolean;
}

/**
 * Short, editorial index labels — NOT the same as StoryTimeline's own
 * narration copy (which CinematicStory already renders as narration).
 * This indicator identifies WHERE the user is structurally; narration
 * says how it feels. Keeping the two separate avoids duplicating text
 * the existing system already displays.
 */
const PHASE_INDEX_LABELS: Record<StoryPhaseId, string> = {
  STATION_INTRO: 'Station',
  STATION_JOURNEY: 'Journey',
  ATMOSPHERE_BUILD: 'Atmosphere',
  TRANSITION: 'Transition',
  PRODUCT_REVEAL: 'Product',
  PRODUCT_CINEMATIC: 'Detail',
  FINAL_HERO: 'Hero',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function CinematicProgress({ progress, activePhaseId, hidden = false }: CinematicProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const p = clamp01(progress);
  const activeIndex = useMemo(
    () => STORY_PHASES.findIndex((phase) => phase.id === activePhaseId),
    [activePhaseId]
  );

  return (
    <motion.div
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
      className="pointer-events-none fixed inset-y-0 right-5 z-40 hidden flex-col items-end justify-center gap-3 lg:flex xl:right-8"
      aria-hidden={hidden}
    >
      {/* Track + fill — the single continuous progress read */}
      <div className="relative h-40 w-px bg-white/12">
        <motion.div
          className="absolute inset-x-0 top-0 w-px bg-white/70"
          style={{ height: `${p * 100}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15, ease: 'linear' }}
        />
      </div>

      {/* Numeric readout + active label — restrained, editorial, not a website scrollbar */}
      <div className="flex flex-col items-end gap-1 pr-0.5 text-right">
        <span className="font-mono text-[10px] font-light tabular-nums tracking-[0.15em] text-white/45">
          {String(activeIndex + 1).padStart(2, '0')} / {String(STORY_PHASES.length).padStart(2, '0')}
        </span>
        <span className="text-[10px] font-light uppercase tracking-[0.28em] text-white/80">
          {PHASE_INDEX_LABELS[activePhaseId]}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * CinematicProgressMobile
 * -------------------------
 * Compact top-edge variant for small viewports: a thin full-width bar
 * beneath the navigation instead of the vertical desktop rail. Same
 * progress input, no second source.
 */
export function CinematicProgressMobile({ progress, hidden = false }: Omit<CinematicProgressProps, 'activePhaseId'>) {
  const prefersReducedMotion = useReducedMotion();
  const p = clamp01(progress);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-white/10 lg:hidden"
      aria-hidden={hidden}
    >
      <motion.div
        className="h-full bg-white/70"
        style={{ width: `${p * 100}%` }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.15, ease: 'linear' }}
      />
    </motion.div>
  );
}
