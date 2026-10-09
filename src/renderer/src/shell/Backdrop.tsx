import { memo } from 'react'
import './Backdrop.css'

/**
 * Far background: a bathymetric chart. Two families of nested contour lines (a seamount top right,
 * a trench bottom left) under soft azure glows. Static SVG, generated once, never animated.
 */

interface Feature {
  cx: number
  cy: number
  /** Radius of the innermost contour and the step between contours. */
  r0: number
  step: number
  rings: number
  /** Horizontal stretch. */
  squash: number
  phase: number
}

const FEATURES: readonly Feature[] = [
  { cx: 1290, cy: 190, r0: 46, step: 44, rings: 11, squash: 1.32, phase: 0.6 },
  { cx: 250, cy: 900, r0: 60, step: 52, rings: 9, squash: 1.55, phase: 2.4 }
]

const POINTS = 28

/** A closed, smooth, slightly irregular loop: a circle whose radius wobbles with a few harmonics. */
function contour(feature: Feature, ring: number): string {
  const radius = feature.r0 + feature.step * ring
  // Outer contours are calmer than inner ones, as on a real chart.
  const wobble = 0.16 / (1 + ring * 0.12)
  const pts: Array<[number, number]> = []
  for (let i = 0; i < POINTS; i++) {
    const t = (i / POINTS) * Math.PI * 2
    const k = 1 + wobble * (Math.sin(3 * t + feature.phase + ring * 0.35) * 0.6 + Math.sin(5 * t - feature.phase * 1.7 + ring * 0.2) * 0.3 + Math.sin(2 * t + ring * 0.5) * 0.4)
    pts.push([feature.cx + Math.cos(t) * radius * k * feature.squash, feature.cy + Math.sin(t) * radius * k])
  }
  // Catmull-Rom spline through the points, as cubic Béziers.
  const at = (i: number): [number, number] => pts[(i + POINTS) % POINTS]!
  let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`
  for (let i = 0; i < POINTS; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return `${d}Z`
}

const CONTOURS = FEATURES.flatMap((feature, f) =>
  Array.from({ length: feature.rings }, (_, ring) => ({ key: `${f}-${ring}`, d: contour(feature, ring), index: ring % 4 === 3 }))
)

export const Backdrop = memo(function Backdrop() {
  return (
    <div className="shell-backdrop" aria-hidden="true">
      <svg className="shell-backdrop__chart" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none">
        {CONTOURS.map((c) => (
          <path key={c.key} d={c.d} className={c.index ? 'is-index' : undefined} />
        ))}
      </svg>
    </div>
  )
})
