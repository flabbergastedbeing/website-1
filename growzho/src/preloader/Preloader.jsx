import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GLYPHS, GROWZHO_MARK } from './glyphs.js'
import './preloader.css'

/**
 * Hairline preloader.
 *
 *   load    six social-media tiles orbit a centre point and are drawn in one by one as the page really loads
 *   forge   the tiles converge and a seventh tile turns to show the Growzho mark, drawn as a line
 *   reveal  the wordmark and tagline come in under it
 *   lift    the mark flies at the camera and the whole stage fades away onto the hero
 *
 * Progress is REAL: it follows fonts, the window load event and a first paint, but never runs faster than a smooth
 * time curve (MIN_LOAD_MS) so the animation is always seen, and never waits longer than MAX_LOAD_MS.
 * While it plays, <html> carries the class "preloading": the page cannot scroll and the hero's entrance animations are
 * held (see preloader.css), then released the moment the stage starts to lift.
 */

const WORD = 'Growzho.in'
const CAPTION = 'Scale your story'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// timings (ms). Shorter when the visitor prefers reduced motion.
const T = () => reduced()
  ? { min: 900, max: 6000, forge: 500, reveal: 700, lift: 400 }
  : { min: 1800, max: 6000, forge: 900, reveal: 800, lift: 600 }

// each tile sits at a slightly different angle, as if scattered on a table
const TILE_ROTATIONS = [[18, -24, -12], [-12, 28, 9], [22, 16, -4], [-20, -18, 14], [12, 24, -16], [-10, -14, 7]]
const SLOT_LAYERS = 8
const HERO_LAYERS = 12
const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v)

// a time curve with two short stalls, so the bar breathes like real loading instead of ticking evenly
const CURVE = [[0, 0], [0.24, 0.31], [0.34, 0.34], [0.62, 0.72], [0.71, 0.74], [1, 1]]
function curve(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [x1, y1] = CURVE[i], [x2, y2] = CURVE[i + 1]
    if (t <= x2) return y1 + (y2 - y1) * (1 - Math.pow(1 - (t - x1) / (x2 - x1), 3))
  }
  return 1
}

const ringXY = (i, n) => {
  const a = ((-90 + (360 / n) * i) * Math.PI) / 180
  return [Math.round(Math.cos(a) * 1e4) / 1e4, Math.round(Math.sin(a) * 1e4) / 1e4]
}

/** the real things the page is waiting on, each worth a share of the bar */
function trackReal(onChange) {
  const w = { fonts: 0.25, load: 0.5, paint: 0.25 }
  const done = { fonts: false, load: false, paint: false }
  let alive = true
  const mark = (k) => { if (alive && !done[k]) { done[k] = true; onChange(Object.keys(w).reduce((s, key) => s + (done[key] ? w[key] : 0), 0)) } }

  const fonts = document.fonts
  if (fonts?.load) {
    Promise.all([fonts.load('400 15px "Space Mono"'), fonts.load('700 15px "Space Mono"'), fonts.ready]).then(() => mark('fonts'), () => mark('fonts'))
  } else mark('fonts')

  const onLoad = () => {
    mark('load')
    requestAnimationFrame(() => requestAnimationFrame(() => mark('paint'))) // the page has had a chance to paint
  }
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad, { once: true })

  return () => { alive = false; window.removeEventListener('load', onLoad) }
}

/** one hairline tile face. `lit` (0..1, a CSS variable set per frame) draws the glyph in and brightens the edge. */
function Face({ glyph, scale = 0.6, hero = false }) {
  const [cx, cy] = glyph.c
  const place = `translate(50 50) scale(${scale}) translate(${-cx} ${-cy})`
  return (
    <svg className="pl-svg" viewBox="0 0 100 100" aria-hidden="true">
      <rect className="pl-edge dim" x="0.6" y="0.6" width="98.8" height="98.8" rx="20" />
      <rect className="pl-edge bright" x="0.6" y="0.6" width="98.8" height="98.8" rx="20" />
      <rect className="pl-dash" x="9" y="9" width="82" height="82" rx="13" />
      <path className="pl-tick" d="M50 .6V6M99.4 50H94M50 99.4V94M.6 50H6" />
      <g transform={place}>
        <path className="pl-ghost" d={glyph.d} />
        <path className={`pl-ink${hero ? ' hero' : ''}`} d={glyph.d} pathLength="1" />
      </g>
    </svg>
  )
}

/** the plate's thickness: a stack of outlined slabs behind the face */
const Layers = ({ n }) =>
  Array.from({ length: n }, (_, i) => <span key={i} className="pl-layer" style={{ '--k': ((i + 1) / n).toFixed(3) }} />)

export default function Preloader() {
  const [phase, setPhase] = useState('load')            // load | forge | reveal | lift | done
  const [pct, setPct] = useState(0)
  const rootRef = useRef(null)
  const rigRef = useRef(null)
  const tiles = useRef([])
  const n = GLYPHS.length
  const idx = Math.min(n, Math.floor(clamp01(pct / 100) * n + 1e-9))

  // hold the page: no scrolling and the hero's entrance animations wait, from before the first paint until the lift starts
  useLayoutEffect(() => {
    document.documentElement.classList.add('preloading')
    return () => document.documentElement.classList.remove('preloading')
  }, [])
  useEffect(() => {
    if (phase === 'lift' || phase === 'done') document.documentElement.classList.remove('preloading')
  }, [phase])

  // loading: real progress, paced by the time curve
  useEffect(() => {
    if (phase !== 'load') return
    const t = T()
    const el = rootRef.current
    let real = 0, shown = 0, last = -1, raf = 0
    const t0 = performance.now(), prev = { t: t0 }
    const stopReal = trackReal((v) => { real = v })

    const apply = (v) => {
      el.style.setProperty('--pl-p', v.toFixed(4))
      tiles.current.forEach((tile, i) => {
        if (!tile) return
        const lit = clamp01(v * n - i)
        tile.style.setProperty('--lit', (1 - Math.pow(1 - lit, 2)).toFixed(3))
        tile.dataset.lit = lit >= 1 ? '1' : '0'
      })
      const p = Math.round(v * 100)
      if (p !== last) { last = p; setPct(p) }
    }
    const step = (now) => {
      const dt = Math.min(64, now - prev.t); prev.t = now
      const elapsed = now - t0
      const forced = elapsed > t.max
      const target = forced ? 1 : Math.min(curve(elapsed / t.min), real + 0.08)
      shown += (target - shown) * Math.min(1, 0.14 * (dt / 16.7))
      if (target - shown < 0.002) shown = target
      apply(shown)
      if (shown >= 1) { setPhase('forge'); return }
      raf = requestAnimationFrame(step)
    }
    apply(0)
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); stopReal() }
  }, [phase, n])

  // forge -> reveal -> lift -> done
  useEffect(() => {
    const t = T()
    const next = { forge: ['reveal', t.forge], reveal: ['lift', t.reveal], lift: ['done', t.lift] }[phase]
    if (!next) return
    const id = setTimeout(() => setPhase(next[0]), next[1])
    return () => clearTimeout(id)
  }, [phase])

  // the camera sways on its own and leans toward the pointer (one rAF loop, one element touched)
  useEffect(() => {
    const rig = rigRef.current
    if (!rig || phase === 'done') return
    const calm = reduced()
    let mx = 0, my = 0, tx = 0, ty = 0, raf = 0, hand = false
    const t0 = performance.now()
    const move = (e) => {
      if (e.pointerType === 'touch') return
      hand = true
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    const tick = (now) => {
      if (!hand && !calm) { const s = (now - t0) / 1000; tx = Math.sin(s * 0.45) * 0.5; ty = Math.sin(s * 0.31 + 1.2) * 0.32 }
      mx += (tx - mx) * 0.07; my += (ty - my) * 0.07
      rig.style.setProperty('--pl-mx', mx.toFixed(4))
      rig.style.setProperty('--pl-my', my.toFixed(4))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move) }
  }, [phase === 'done'])

  if (phase === 'done') return null

  const loading = phase === 'load'
  const status = loading ? 'Assembling' : phase === 'forge' ? 'Forging' : 'Ready'

  return (
    <div
      ref={rootRef}
      className="pl"
      data-phase={phase}
      role="progressbar"
      aria-label={`${WORD} is loading`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={loading ? `${pct}%` : 'Loaded'}
    >
      <div className="pl-cam" aria-hidden="true">
        <div className="pl-rig" ref={rigRef}>
          <div className="pl-ring">
            {GLYPHS.map((g, i) => {
              const [x, y] = ringXY(i, n)
              const [rx, ry, rz] = TILE_ROTATIONS[i % TILE_ROTATIONS.length]
              return (
                <div key={g.label} className="pl-slot" style={{ '--x': x, '--y': y, '--i': i }}>
                  <div className="pl-counter">
                    <div className="pl-bob" style={{ animationDelay: `${-i * 1.3}s`, animationDuration: `${4.6 + (i % 3) * 0.9}s` }}>
                      <div ref={(el) => { tiles.current[i] = el }} className="pl-tile" style={{ '--rx': `${rx}deg`, '--ry': `${ry}deg`, '--rz': `${rz}deg` }}>
                        <div className="pl-leaf" style={{ '--i': i }}>
                          <Layers n={SLOT_LAYERS} />
                          <span className="pl-face"><Face glyph={g} /></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pl-hero">
            <div className="pl-hero-bob">
              <div className="pl-hero-turn">
                <div className="pl-tile pl-tile-hero">
                  <div className="pl-leaf">
                    <Layers n={HERO_LAYERS} />
                    <span className="pl-face pl-back">
                      <svg className="pl-svg" viewBox="0 0 100 100" aria-hidden="true">
                        <rect className="pl-edge bright" style={{ opacity: 1 }} x="0.6" y="0.6" width="98.8" height="98.8" rx="20" />
                        <rect className="pl-dash" x="9" y="9" width="82" height="82" rx="13" />
                        <path className="pl-tick" d="M50 .6V6M99.4 50H94M50 99.4V94M.6 50H6M44 50H56M50 44V56" />
                      </svg>
                    </span>
                    <span className="pl-face pl-front"><Face glyph={GROWZHO_MARK} scale={0.8} hero /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pl-title" aria-hidden="true">
        <p className="pl-word">
          {Array.from(WORD).map((c, i) => <span key={i} className="pl-letter" style={{ animationDelay: `${0.08 + i * 0.07}s` }}>{c}</span>)}
        </p>
        <p className="pl-caption">{CAPTION}</p>
      </div>

      <div className="pl-bar pl-bar-top" aria-hidden="true">
        <span><i className="pl-dot" /><b>{WORD}</b><span className="pl-sm"> — {status}</span></span>
        <span>
          {loading
            ? <><span className="pl-sm">{GLYPHS[Math.min(n - 1, idx)].label} · </span>{String(idx).padStart(2, '0')} / {String(n).padStart(2, '0')}</>
            : status}
        </span>
      </div>
      <div className="pl-bar pl-bar-bot" aria-hidden="true">
        <span className="pl-sm">Loading</span>
        <span className="pl-track">
          <span className="pl-fill" />
          <span className="pl-ticks">{Array.from({ length: n + 1 }, (_, i) => <i key={i} />)}</span>
        </span>
        <span className="pl-pct"><b>{String(pct).padStart(3, '0')}</b> %</span>
      </div>

      <span className="pl-sr" aria-live="polite">{loading ? (idx > 0 ? GLYPHS[idx - 1].label : '') : `${WORD} — ${CAPTION}`}</span>
    </div>
  )
}