import { GROWZHO_MARK } from './preloader/glyphs.js'

/**
 * The Growzho mark exactly as the preloader draws it: the hairline logo on its rounded tile
 * (solid edge, dashed inner frame, edge ticks). Static, no animation.
 * Pass frame={false} for the line-drawn mark alone.
 */
export default function GrowzhoMark({ frame = true, className = '' }) {
  const [cx, cy] = GROWZHO_MARK.c
  const scale = 0.8 // same scale the preloader uses for this mark
  return (
    <svg className={`gz-mark ${className}`.trim()} viewBox="0 0 100 100" role="img" aria-label="Growzho logo">
      {frame && (
        <>
          <rect className="gz-edge" x="0.6" y="0.6" width="98.8" height="98.8" rx="20" />
          <rect className="gz-dash" x="9" y="9" width="82" height="82" rx="13" />
          <path className="gz-tick" d="M50 .6V6M99.4 50H94M50 99.4V94M.6 50H6" />
        </>
      )}
      <g transform={`translate(50 50) scale(${scale}) translate(${-cx} ${-cy})`}>
        <path className="gz-ink" d={GROWZHO_MARK.d} />
      </g>
    </svg>
  )
}