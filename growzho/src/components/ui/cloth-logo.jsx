import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useDeferredMount } from '../../useDeferredMount.js'

// three.js, react-three-fiber and the cloth simulation live in this chunk. It is only downloaded
// after the page has painted, so the first load is just React + the still poster.
const ClothCanvas = lazy(() => import('./cloth-canvas.jsx'))

// If WebGL is unavailable or the texture fails, quietly fall back to the still image.
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

// Cursor tilt (the pointer movement from the glare-card snippet, without any glare layers):
// while the mouse is over the visible cloth it leans toward the cursor in 3D, and eases back to
// flat when the cursor leaves. Same maths as the snippet: rotateY = -(dx / 3.5), rotateX = dy / 2,
// where dx / dy are the cursor's offset from the centre in percent, times `strength`.
// The tilt is a CSS transform on a wrapper, so the cloth simulation keeps running underneath it.
function useCursorTilt(hostRef, tiltRef, src, enabled, strength) {
  useEffect(() => {
    const host = hostRef.current
    const tilt = tiltRef.current
    if (!enabled || !host || !tilt || strength <= 0) return
    if (!window.matchMedia?.('(hover: hover)').matches) return // touch screens have no hovering cursor

    // silhouette of the cloth (alpha of the cut-out photo), so only the visible fabric reacts
    let mask = null
    let mw = 0
    let mh = 0
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      try {
        mw = 128
        mh = Math.max(8, Math.round((mw * img.naturalHeight) / img.naturalWidth))
        const cv = document.createElement('canvas')
        cv.width = mw
        cv.height = mh
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, mw, mh)
        const d = ctx.getImageData(0, 0, mw, mh).data
        mask = new Uint8Array(mw * mh)
        for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 128 ? 1 : 0
      } catch { mask = null }
    }
    img.src = src

    const target = { x: 0, y: 0 } // rotateY, rotateX in degrees
    const cur = { x: 0, y: 0 }
    let raf = 0
    let last = 0

    const frame = (now) => {
      // time-based easing (~120 ms time constant), so it feels the same at 30, 60 or 144 fps
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60
      last = now
      const k = 1 - Math.exp(-dt / 0.12)
      cur.x += (target.x - cur.x) * k
      cur.y += (target.y - cur.y) * k
      tilt.style.transform = `perspective(600px) rotateY(${cur.x.toFixed(3)}deg) rotateX(${cur.y.toFixed(3)}deg)`
      if (Math.abs(target.x - cur.x) < 0.005 && Math.abs(target.y - cur.y) < 0.005 && !target.x && !target.y) {
        tilt.style.transform = ''
        raf = 0
        last = 0
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame) }

    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      const r = host.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      let inside = px >= 0 && px <= 1 && py >= 0 && py <= 1
      if (inside && mask) inside = mask[Math.min(mh - 1, Math.floor(py * mh)) * mw + Math.min(mw - 1, Math.floor(px * mw))] === 1
      if (!inside) { target.x = 0; target.y = 0; kick(); return }
      target.x = -((px * 100 - 50) / 3.5) * strength
      target.y = ((py * 100 - 50) / 2) * strength
      kick()
    }
    const onLeave = () => { target.x = 0; target.y = 0; kick() }

    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    return () => {
      cancelled = true
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
      tilt.style.transform = ''
    }
  }, [hostRef, tiltRef, src, enabled, strength])
}

/**
 * The Growzho logo cloth photo, brought to life: it hangs from its
 * top edge and moves in a light indoor breeze. Calm on purpose, a soft ripple
 * travelling through the fabric rather than a flag snapping in a gale.
 *
 * Props
 *  - poster     small still of the cloth, shown immediately and faded out once the WebGL cloth is running
 *  - src        the photo used as the texture: hero-logo.jpg resized 2x and lightly sharpened
 *               (same picture, same tilt, so it stays crisp when drawn at 2-3x pixel density)
 *  - aspect     width / height of that photo (882 / 830 for hero-logo.jpg)
 *  - segments   cloth resolution per side (more = finer folds, heavier)
 *  - speed      pace of the breeze pattern (1 = default)
 *  - sheen      strength of the satin highlights and reflections (1 = default, 0 = off, ~1.5 = glossy)
 *  - metal      strength of the metallic glints on the fold crests (0.04 = default, barely there; 1 = medium; 0 = off)
 *  - foldDepth  how deep the photo's creases are built into the cloth's 3D shape (world units, 0.025 = default, 0.05 = deeper, 0 = flat sheet)
 *  - tilt       how far the cloth leans toward the cursor on hover (0.2 = default, gentle; 0.4 = the glare-card snippet; 0 = off)
 *  - delay      ms after page load before the WebGL cloth starts (it also starts on the first touch / mouse move)
 *  - dpr        [min, max] pixel density the cloth is drawn at (default [1, 2])
 *  - wind       breeze strength (1 = default, 0 = hanging still, ~2 = windy)
 *  - noise      strength of the fabric grain (0.12 = default; 0 = off, 0.25 = heavy)
 *  - noiseScale grain density across the cloth (900 = default; higher = finer grain)
 *  - noiseFlicker how much the grain shimmers over time (0 = frozen weave, 1 = film grain; 0.35 = default)
 */
export function ClothLogo({
  src = '/hero-logo-cutout.webp',
  poster = '/hero-logo-poster.webp',
  aspect = 882 / 830,
  alt = 'Growzho logo printed on red cloth — Scale your story',
  segments = 30,
  speed = 1,
  wind = 1,
  sheen = 0,
  metal = 0.3,
  foldDepth = 0.025,
  tilt = 0,
  noise = 0.2,
  noiseScale = 1000,
  noiseFlicker = 0.35,
  delay = 2800,
  dpr = [1, 2],
  className = '',
  style,
}) {
  const reduced = useReducedMotion()
  const hostRef = useRef(null)
  const tiltRef = useRef(null)
  useCursorTilt(hostRef, tiltRef, poster, !reduced, tilt)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false) // the WebGL cloth has drawn its first frame
  const armed = useDeferredMount(delay) && !reduced
  // Draw a few frames as soon as the canvas exists, even though it is off screen: that is when the shaders compile and the
  // texture uploads, and it must not happen later, in the middle of the section's entrance animation.
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    if (!armed) return
    setWarm(true)
    const t = setTimeout(() => setWarm(false), 1500)
    return () => clearTimeout(t)
  }, [armed])

  // Stop rendering while the hero is scrolled out of view.
  useEffect(() => {
    const el = hostRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  // The host box and the still poster render immediately and never remount, so the entrance
  // animation plays once and the layout is reserved up front (no layout shift).
  return (
    <div
      ref={hostRef}
      className={`cloth ${className}`}
      style={{ ...style, aspectRatio: String(aspect) }}
      role="img"
      aria-label={alt}
    >
      <div ref={tiltRef} style={{ position: 'absolute', inset: 0, willChange: reduced ? undefined : 'transform' }}>
        <img
          className={`cloth-poster${ready ? ' off' : ''}${reduced ? ' masked' : ''}`}
          src={poster}
          alt=""
          width={882}
          height={830}
          decoding="async"
          fetchpriority="high"
        />
        {armed && (
          <Boundary fallback={null}>
            <Suspense fallback={null}>
              <ClothCanvas
                visible={visible || warm}
                dpr={dpr}
                aspect={aspect}
                src={src}
                segments={segments}
                speed={speed}
                wind={wind}
                sheen={sheen}
                metal={metal}
                foldDepth={foldDepth}
                noise={noise}
                noiseScale={noiseScale}
                noiseFlicker={noiseFlicker}
                onReady={() => setReady(true)}
              />
            </Suspense>
          </Boundary>
        )}
      </div>
    </div>
  )
}

export default ClothLogo