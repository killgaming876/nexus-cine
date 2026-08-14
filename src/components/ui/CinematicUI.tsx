'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CinematicStoryHandle } from '../story/CinematicStory';
import type { StoryPhaseId } from '../story/StoryTimeline';
import { CinematicNavigation } from './CinematicNavigation';
import { CinematicProgress, CinematicProgressMobile } from './CinematicProgress';
import { ProductInterface } from './ProductInterface';

/**
 * CinematicUI
 * -------------
 * The UI composition layer for Generation 9. Orchestrates
 * `CinematicNavigation`, `CinematicProgress`, and `ProductInterface` as a
 * plain DOM overlay that sits ABOVE the existing `<Canvas>` — it does not
 * render, own, or reach into the 3D scene itself.
 *
 * ---------------------------------------------------------------------
 * HOW THIS READS STORY STATE WITHOUT A SECOND PROGRESS SOURCE:
 * ---------------------------------------------------------------------
 * `CinematicStory` already exposes a `CinematicStoryHandle` with
 * `getProgress()` / `getPhase()` / `getDirection()`, all backed by the
 * ONE existing `ScrollController` instance that `StationJourney` mounts
 * internally. `Experience.tsx` mounts `<CinematicStory>` itself (inside
 * its own `<Canvas>`) and forwards that handle as `.story` on its own
 * imperative handle — so the host page passes
 * `experienceRef.current?.story` (read once `Experience` has mounted) or
 * a ref populated via `Experience`'s own `onReady`-style wiring as this
 * component's `storyRef`. This component polls that handle via
 * `requestAnimationFrame`, entirely OUTSIDE the R3F render loop (this is
 * plain DOM, not a Canvas child, so `useFrame` isn't available here
 * regardless).
 *
 * This is a deliberately lightweight poll, not a new scroll listener:
 *   - It never touches `window.scroll*` or ScrollTrigger.
 *   - It only calls `.getProgress()` / `.getPhase()` on the SAME handle
 *     `CinematicStory` already maintains.
 *   - React state is only written when the rendered value actually
 *     changes by a meaningful amount (progress rounded to 3 decimal
 *     places, phase by identity), matching the throttling approach
 *     `CinematicStory` itself already uses for its narration text —
 *     so this does not become a 60fps setState source.
 *
 * If this project already has (or later grows) a context/store that
 * exposes the same three values, swap the polling effect below for a
 * subscription to that instead — the three child components only need
 * `{ progress, phase, direction }`, however they arrive.
 *
 * ---------------------------------------------------------------------
 * MOUNT LOCATION:
 * ---------------------------------------------------------------------
 * Render `<CinematicUI />` as a SIBLING of `<Experience />` (which owns
 * the `<Canvas>` and mounts `<CinematicStory>` internally), not inside
 * it — e.g. in whatever page/layout component composes both:
 *
 *   const experienceRef = useRef<ExperienceHandle>(null);
 *   const storyRef = useRef<CinematicStoryHandle>(null);
 *   // ...
 *   <main>
 *     <Experience ref={experienceRef} />
 *     <CinematicUI storyRef={storyRef} />
 *   </main>
 *
 * Since `ExperienceHandle.story` is only populated after Experience's own
 * effects run, the simplest correct wiring is to poll
 * `experienceRef.current?.story` the same way this component already
 * polls `storyRef.current` — or pass a small wrapper ref whose `.current`
 * getter reads `experienceRef.current?.story ?? null`, mirroring the
 * adapter pattern `CinematicStory.tsx` itself uses for its own camera
 * ref. Either approach avoids a second progress source.
 */

export interface CinematicUIProps {
  /** Ref to the mounted CinematicStory instance — the single source of truth for progress/phase/direction. */
  storyRef: RefObject<CinematicStoryHandle>;
  /** Forwarded to CinematicNavigation. */
  brand?: string;
  navCtaLabel?: string;
  onNavCtaClick?: () => void;
  onNavLinkClick?: (index: number) => void;
  /** Forwarded to ProductInterface. */
  productName?: string;
  productLine?: string;
  productDescription?: string;
  productMetadata?: { label: string; value: string }[];
  productCtaLabel?: string;
  onProductCtaClick?: () => void;
  productSecondaryLabel?: string;
  onProductSecondaryClick?: () => void;
}

interface StoryReadout {
  progress: number;
  phase: StoryPhaseId;
}

const PHASES_HIDING_NAV: StoryPhaseId[] = ['FINAL_HERO'];

export function CinematicUI({
  storyRef,
  brand,
  navCtaLabel,
  onNavCtaClick,
  onNavLinkClick,
  productName,
  productLine,
  productDescription,
  productMetadata,
  productCtaLabel,
  onProductCtaClick,
  productSecondaryLabel,
  onProductSecondaryClick,
}: CinematicUIProps) {
  const [readout, setReadout] = useState<StoryReadout>({ progress: 0, phase: 'STATION_INTRO' });
  const lastProgressRef = useRef(0);
  const lastPhaseRef = useRef<StoryPhaseId>('STATION_INTRO');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const handle = storyRef.current;
      if (handle) {
        const progress = handle.getProgress();
        const phase = handle.getPhase();
        const roundedProgress = Math.round(progress * 1000) / 1000;
        if (roundedProgress !== lastProgressRef.current || phase !== lastPhaseRef.current) {
          lastProgressRef.current = roundedProgress;
          lastPhaseRef.current = phase;
          setReadout({ progress: roundedProgress, phase });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // storyRef itself is a stable RefObject identity — intentionally not
    // re-running this effect if consumers pass a fresh-looking ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navHidden = PHASES_HIDING_NAV.includes(readout.phase);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <CinematicNavigation
        brand={brand}
        ctaLabel={navCtaLabel}
        onCtaClick={onNavCtaClick}
        onLinkClick={onNavLinkClick}
        activePhaseId={readout.phase}
        hidden={navHidden}
      />

      <CinematicProgress progress={readout.progress} activePhaseId={readout.phase} />
      <CinematicProgressMobile progress={readout.progress} />

      <ProductInterface
        activePhaseId={readout.phase}
        productName={productName}
        productLine={productLine}
        description={productDescription}
        metadata={productMetadata}
        ctaLabel={productCtaLabel}
        onCtaClick={onProductCtaClick}
        secondaryLabel={productSecondaryLabel}
        onSecondaryClick={onProductSecondaryClick}
      />
    </div>
  );
}
