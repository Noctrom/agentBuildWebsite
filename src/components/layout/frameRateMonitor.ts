/**
 * Detects a background animation that runs consistently slow (V0.42), from
 * the real frame cadence: the intervals between the engine's
 * requestAnimationFrame callbacks. A scene's own lower draw rate (the black
 * hole disk draws at 12 fps on purpose) does not matter, because the loop
 * itself still runs every frame.
 *
 * The engine only feeds it "steady" frames: tab visible, animation on, no
 * scene building and no fade running. Anything else calls `reset()`, so a
 * page load, a route change or a tab switch never counts. After a reset the
 * first WARMUP_MS of steady frames are ignored too (caches, JIT, image
 * decode settle), then it needs a full WINDOW_MS of steady frames before it
 * judges.
 *
 * "Slow" is a frame interval longer than 1000 / MIN_FPS ms. Frames land on
 * vsync, so on a 60 Hz screen intervals are 16.7, 33.3, 50 ms and so on:
 * 28 fps (35.7 ms) puts the line between 30 fps and 20 fps frames, so a
 * device capped at 30 fps (e.g. Chrome's battery saver) is not "slow". It
 * trips when at least SLOW_SHARE of the frames in the last WINDOW_MS are
 * slow, i.e. the animation is consistently below ~30 fps. Counting frames
 * rather than averaging time means one long stall (a GC pause, another app)
 * can't trip it on its own.
 */
const MIN_FPS = 28
const SLOW_INTERVAL_MS = 1000 / MIN_FPS
const WARMUP_MS = 1000
const WINDOW_MS = 3000
const SLOW_SHARE = 0.5

interface Sample {
  at: number
  slow: boolean
}

export class FrameRateMonitor {
  private readonly onSlow: () => void
  /** Timestamp of the first steady frame since the last reset, or -1. */
  private steadySince = -1
  private samples: Sample[] = []
  /** Index of the oldest sample still in the window. */
  private head = 0
  private slowCount = 0
  private fired = false

  constructor(onSlow: () => void) {
    this.onSlow = onSlow
  }

  /** Forget everything measured so far (not steady, or something changed). */
  reset() {
    this.steadySince = -1
    this.samples = []
    this.head = 0
    this.slowCount = 0
  }

  /**
   * Record one steady frame: `now` is the rAF timestamp, `interval` the time
   * since the previous frame. Calls `onSlow` once if the window is slow.
   */
  frame(now: number, interval: number) {
    if (this.fired) return
    if (this.steadySince < 0) {
      // The interval into the first steady frame may span unsteady time.
      this.steadySince = now
      return
    }
    const measuredFrom = this.steadySince + WARMUP_MS
    if (now < measuredFrom) return
    const slow = interval > SLOW_INTERVAL_MS
    this.samples.push({ at: now, slow })
    if (slow) this.slowCount++
    while (now - this.samples[this.head].at > WINDOW_MS) {
      if (this.samples[this.head].slow) this.slowCount--
      this.head++
    }
    if (this.head > 512) {
      this.samples = this.samples.slice(this.head)
      this.head = 0
    }
    if (now - measuredFrom < WINDOW_MS) return
    const count = this.samples.length - this.head
    if (this.slowCount >= count * SLOW_SHARE) {
      this.fired = true
      this.onSlow()
    }
  }
}
