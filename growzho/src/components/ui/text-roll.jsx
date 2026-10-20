import { Fragment } from 'react'

// Hover "roll" for text: every letter slides up and out while a copy slides in from below.
// Same behaviour as the framer-motion TextRoll (easeInOut, 0.3s, stagger rippling out
// from the centre), but driven by CSS transitions so it needs no extra dependency.
// The styles live in styles.css under "text roll".

const STAGGER = 0.035 // seconds between neighbouring letters
const MAX_SPREAD = 0.4 // never let one text take longer than this to ripple across

function Layer({ letters, delays, className }) {
  return (
    <span className={className} aria-hidden="true">
      {letters.map((l, i) => (
        <span className="l" style={{ transitionDelay: `${delays[i]}s` }} key={i}>
          {l === ' ' ? '\u00A0' : l}
        </span>
      ))}
    </span>
  )
}

/**
 * <TextRoll>Scroll to Explore</TextRoll>
 *  - center: ripple outward from the middle of the text (default) instead of left → right
 */
export function TextRoll({ children, center = true }) {
  const text = String(children)
  const letters = Array.from(text)
  const n = letters.length
  const mid = (n - 1) / 2
  const step = Math.min(STAGGER, MAX_SPREAD / Math.max(center ? n / 2 : n, 1))
  const delays = letters.map((_, i) => +(step * (center ? Math.abs(i - mid) : i)).toFixed(3))

  return (
    <span className="roll">
      <span className="sr">{text}</span>
      <Layer className="roll-a" letters={letters} delays={delays} />
      <Layer className="roll-b" letters={letters} delays={delays} />
    </span>
  )
}

/**
 * For sentences: each word rolls on its own when hovered, so a long paragraph stays
 * readable and wraps exactly as normal text would.
 */
export function TextRollWords({ children, center = true }) {
  const words = String(children).trim().split(/\s+/)
  return words.map((w, i) => (
    <Fragment key={i}>
      <TextRoll center={center}>{w}</TextRoll>
      {i < words.length - 1 ? ' ' : null}
    </Fragment>
  ))
}

export default TextRoll