// Shared motion-v springs.
//
// One module so every spring in the app shares the same physics instead of
// each component inventing numbers, and so the OS "reduce motion" switch is
// honoured in a single place: when it is on, springs are replaced by short
// timing-based transitions rather than the animation being dropped (feedback
// stays, the bounce goes).
//
// `useReducedMotion` comes from motion-v and tracks the media query live, so
// toggling the OS setting does not need a reload.
import { computed, type ComputedRef } from 'vue'
import { useReducedMotion } from 'motion-v'

/** Tap feedback: fast, barely overshooting. */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }
/** Panels, expanding cards: visible travel, settles quickly. */
export const SPRING_SOFT = { type: 'spring', stiffness: 280, damping: 30 }
/** Enter reveals: slower and calmer than SOFT. */
export const SPRING_GENTLE = { type: 'spring', stiffness: 180, damping: 26 }

/** Used instead of a spring when the user asked for reduced motion. */
const REDUCED_TRANSITION = { duration: 0.14, ease: [0.16, 1, 0.3, 1] }

export function useMotionPresets(): {
  reduced: ComputedRef<boolean>
  springSnappy: ComputedRef<typeof SPRING_SNAPPY | typeof REDUCED_TRANSITION>
  springSoft: ComputedRef<typeof SPRING_SOFT | typeof REDUCED_TRANSITION>
  springGentle: ComputedRef<typeof SPRING_GENTLE | typeof REDUCED_TRANSITION>
} {
  const prefersReduced = useReducedMotion()
  const reduced = computed(() => prefersReduced.value === true)
  const pick = <T>(spring: T) => computed(() => (reduced.value ? REDUCED_TRANSITION : spring))

  return {
    reduced,
    springSnappy: pick(SPRING_SNAPPY),
    springSoft: pick(SPRING_SOFT),
    springGentle: pick(SPRING_GENTLE),
  }
}
