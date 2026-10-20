// Scroll motion for the whole page (GSAP + ScrollTrigger), loaded after first paint.
//
//  1. Red wipe      just before a section's content would appear, scrolling FREEZES, a red panel sweeps up over the
//                   screen and names the section, and STAYS there until the visitor scrolls once more. Then the page jumps to
//                   the section under the cover, the panel lifts straight onto it, the section's elements animate in as it
//                   clears, and scrolling is released. So the order is always: wipe, hold, lift, that section's animation, then the next wipe.
//                   Scrolling back up never plays it.
//  2. Headlines     every headline line slides up out of its own mask
//  3. Label + intro  fade + 24px rise, in order: label, headline, intro (held until the wipe has lifted, if one is playing)
//                   Cards / components have no scroll animation.
//
// Everything is skipped for visitors who prefer reduced motion (the caller never loads this file for them).

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
// By default GSAP "lag smoothing" pretends a long frame was short, which makes every animation crawl after a
// hitch. Off: motion keeps real time, so a dropped frame is a jump, not a slow-motion tail.
gsap.ticker.lagSmoothing(0)
ScrollTrigger.config({ ignoreMobileResize: true })

// Entrance motion (label and intro line): fade in + rise RISE px, one easing, no tilt, no scale, no sideways move
const RISE = 24
const EASE = 'power2.out'
// Order inside a section header (seconds from the moment it starts)
const HEADLINE_AT = 0.15 // headline lines begin just after the label
const INTRO_AT = 0.6     // intro line follows the headline
// Red wipe timing (seconds)
const AUTO_LIFT_MS = 350 // ms the red panel is held before it lifts on its own
const WIPE_IN = 0.45    // red panel sweeps up over the screen
const WIPE_OUT = 0.55  // panel sweeps off the top
const SECTION_TOP = 120 // px: where the section's top sits once the panel has lifted (below the fixed nav)
const ELEMENTS_AT = 0.3 // the section's elements start animating this many seconds into the sweep off
// When does it start? Scrolling freezes the moment it does, so it only needs a small margin before the section's first
// content would appear: WIPE_LEAD_MIN screens, plus the distance covered in WIPE_REACTION seconds at the current scroll speed.
const WIPE_LEAD_MIN = 0.04 // fraction of the screen height
const WIPE_REACTION = 0.06 // seconds

export function initMotion(root = document) {
  const wipe = root.querySelector('.wipe')
  const wipeLabel = wipe && wipe.querySelector('.wipe-label')
  const wipeHint = wipe && wipe.querySelector('.wipe-hint')
  const sections = gsap.utils.toArray('main > section', root)

  // Entrance animations wait for the wipe: while the red panel is up they are queued, and released as it lifts.
  let wiping = false
  const queued = []
  const gate = (fn) => (wiping ? queued.push(fn) : fn())
  const release = () => { wiping = false; queued.splice(0).forEach((fn) => fn()) }

  let undoWipe = null
  const ctx = gsap.context(() => {
    // ---------- 2 + 3. section content: one fixed order per section ----------
    // Section header only: label -> headline -> intro line. Cards and other components have no scroll animation.
    sections.forEach((sec) => {
      const label = sec.querySelector(':scope > .label')
      const heading = sec.querySelector('.h-lg, .display')
      const lines = heading ? heading.querySelectorAll('.ln-i') : []
      const intro = sec.querySelector('.head .body')

      // header: label, then headline lines, then the intro line, as one timeline
      const header = gsap.timeline({ paused: true })
      if (label) header.fromTo(label, { y: RISE, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: EASE }, 0)
      if (lines.length) header.fromTo(lines, { yPercent: 115, rotate: 4, opacity: 1 }, // opacity: 1 un-hides the line (CSS hides it before this runs); the mask hides the offset
        { yPercent: 0, rotate: 0, duration: 0.9, ease: 'power4.out', stagger: 0.1 }, HEADLINE_AT)
      if (intro) header.fromTo(intro, { y: RISE, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: EASE }, INTRO_AT)

      let headerStarted = 0 // gsap time when the header began (0 = not yet)
      const playHeader = () => {
        if (headerStarted) return
        headerStarted = -1 // claimed; real time is set when the gate opens
        gate(() => { headerStarted = gsap.ticker.time; header.play() })
      }
      const first = label || heading
      if (first) ScrollTrigger.create({ trigger: first, start: 'top 90%', once: true, onEnter: playHeader })
    })

    // ---------- 1. red wipe between sections ----------
    if (wipe) {
      let armed = false
      let skipUntil = 0 // set after a click on an in-page link, so the wipe never fires during that jump
      const armTimer = setTimeout(() => { armed = true }, 900) // never fire for the position the page loads at

      // where each section starts on the page (offsetTop ignores transforms, so the scale-on-leave effect can't skew it)
      const topOf = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y }
      let tops = sections.map(topOf)
      const measure = () => { tops = sections.map(topOf) }
      ScrollTrigger.addEventListener('refresh', measure)

      const onLink = (e) => { if (e.target.closest?.('a[href^="#"]:not([href="#"])')) { skipUntil = performance.now() + 2000; lift(false) } }
      document.addEventListener('click', onLink, true)

      // --- freeze: while the wipe plays the page cannot scroll at all (inline overflow:hidden on <html>) ---
      // Used instead of blocking wheel / touch events: browsers can't cancel a scroll that is already under way (touch drags,
      // trackpad momentum), but a page that is not scrollable cannot move.
      const html = document.documentElement
      html.style.scrollbarGutter = 'stable' // keeps the scrollbar's space reserved, so the layout doesn't shift when frozen
      const goTo = (y) => window.scrollTo({ top: y, behavior: 'instant' }) // 'instant': the page has smooth scrolling on
      let busy = false
      let guard = 0
      let tl = null
      const finish = () => {
        clearTimeout(guard)
        listen(false)
        tl = null
        html.style.overflow = '' // unfreeze
        busy = false
        speed = 0
        lastY = window.scrollY
        lastT = performance.now()
        release()
      }

      // --- the hold: once the red panel covers the screen it STAYS until the visitor scrolls again ---
      // Scroll "intent" is read from wheel / touch / keys (the page itself can't move, it is frozen). Momentum left over from the
      // scroll that started the wipe must not count: a wheel event only counts after a quiet gap, and a touch only if its finger
      // went down after the panel was in place.
      let holding = false
      let holdAt = 0
      let runAt = 0
      let pending = false // a fresh scroll arrived while the panel was still sweeping up: lift as soon as it has landed
      let lifting = false
      let lastWheel = 0
      let lastAbs = Infinity
      let touchY = null
      const MIN_COVER = 250 // ms the panel is always seen fully up, even if the visitor scrolled while it was arriving
      const KEYS = new Set(['ArrowDown', 'PageDown', ' ', 'Spacebar', 'End', 'ArrowUp', 'PageUp', 'Home'])
      // One scroll must be enough. A wheel / trackpad event is a NEW scroll (not the tail of the one that started the wipe) when
      // it follows a pause, or when it is stronger than the one before it (momentum only ever fades).
      const intent = () => {
        if (lifting) return
        if (holding) { if (performance.now() - holdAt > 120) lift() } else pending = true
      }
      const onWheel = (e) => {
        if (busy && e.cancelable) e.preventDefault() // frozen: nothing may scroll, whatever the browser thinks of overflow:hidden
        const now = performance.now()
        const abs = Math.abs(e.deltaY) + Math.abs(e.deltaX)
        const fresh = now - lastWheel > 90 || abs > lastAbs * 1.3
        lastWheel = now
        lastAbs = abs
        if (fresh && abs > 4) intent()
      }
      const onTouchStart = (e) => { touchY = performance.now() > runAt ? e.touches[0].clientY : null }
      const onTouchMove = (e) => { if (busy && e.cancelable) e.preventDefault(); if (touchY !== null && Math.abs(e.touches[0].clientY - touchY) > 24) intent() }
      const onKey = (e) => { if (busy && KEYS.has(e.key)) { e.preventDefault(); intent() } }
      const listen = (on) => {
        const m = on ? 'addEventListener' : 'removeEventListener'
        window[m]('wheel', onWheel, { passive: false })
        window[m]('touchstart', onTouchStart, { passive: true })
        window[m]('touchmove', onTouchMove, { passive: false })
        window[m]('keydown', onKey)
      }
      const hold = () => {
        holding = true
        holdAt = performance.now()
        clearTimeout(guard) // no time limit: the panel waits for the visitor
        if (pending) { pending = false; setTimeout(lift, MIN_COVER) }
        // no waiting for a second scroll: the panel lifts by itself after a short beat, so the page never looks stuck
        setTimeout(() => lift(), AUTO_LIFT_MS)
      }
      // the first scroll while the panel is up: the page jumps to the section while the red still covers everything (the jump is
      // never seen), then the panel lifts straight onto the section it was made for, and its elements animate in as it clears.
      // `toSection` is false when a nav link was clicked instead: then the browser's own jump to that link is left alone.
      let heldSec = null
      const lift = (toSection = true) => {
        if (!holding) return
        holding = false
        lifting = true
        guard = setTimeout(finish, (WIPE_OUT + 3) * 1000)
        if (wipeHint) gsap.to(wipeHint, { opacity: 0, duration: 0.2 })
        if (toSection) goTo(Math.max(0, Math.min(topOf(heldSec) - SECTION_TOP, document.documentElement.scrollHeight - window.innerHeight)))
        ScrollTrigger.update() // the section's entrance animations see the new position now, and queue behind the panel
        tl = gsap.timeline({ onComplete: finish })
          .to(wipe, { yPercent: -100, duration: WIPE_OUT, ease: 'power3.inOut' })
          .call(release, null, ELEMENTS_AT)
          .set(wipe, { visibility: 'hidden' })
      }

      const run = (sec, i) => {
        busy = true
        wiping = true
        lastWheel = performance.now()
        lastAbs = Infinity
        runAt = lastWheel
        pending = false
        lifting = false
        listen(true)
        // freeze right here, and make sure none of the section has crept into view in the meantime
        html.style.overflow = 'hidden'
        heldSec = sec
        const top = topOf(sec)
        const safeY = top - window.innerHeight - 4
        if (window.scrollY > safeY) goTo(safeY)
        if (wipeLabel) wipeLabel.textContent = (sec.querySelector('.label')?.textContent || '').trim()
        // safety net for the sweep up: whatever happens (tab hidden, error), the page is never left frozen
        guard = setTimeout(() => { holding = false; listen(false); gsap.set(wipe, { visibility: 'hidden' }); finish() }, (WIPE_IN + 3) * 1000)
        // the panel only ever moves with transform (cheap, runs on the GPU): up over the page, then it waits
        tl = gsap.timeline()
          .set(wipe, { yPercent: 100, y: 0, visibility: 'visible' })
          .to(wipe, { yPercent: 0, duration: WIPE_IN, ease: 'power3.inOut' })
          .fromTo(wipeLabel, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }, `-=${WIPE_IN * 0.4}`)
          .call(hold, null, WIPE_IN) // the panel has landed: from now on one fresh scroll lifts it
      }

      // watch the scroll position and speed (reads only scrollY: no layout work while scrolling)
      const fired = sections.map(() => false)
      let lastY = window.scrollY
      let lastT = performance.now()
      let speed = 0 // px per second, positive = scrolling down
      const onScroll = () => {
        const now = performance.now()
        const y = window.scrollY
        const dy = y - lastY
        speed = speed * 0.5 + ((dy / Math.max(now - lastT, 1)) * 1000) * 0.5
        lastY = y
        lastT = now
        if (busy) return
        const vh = window.innerHeight
        sections.forEach((sec, i) => {
          if (busy) return
          const dist = tops[i] - (y + vh) // how far the section's top is below the bottom edge of the screen
          if (fired[i] || dy <= 0) return // only ever when scrolling down
          if (dist < -vh * 0.3) { fired[i] = true; return } // already well inside it (page loaded here, or a long jump)
          if (!armed || now < skipUntil) return
          const lead = vh * WIPE_LEAD_MIN + Math.max(speed, 0) * WIPE_REACTION
          if (dist <= lead) { fired[i] = true; run(sec, i) }
        })
      }
      window.addEventListener('scroll', onScroll, { passive: true })

      gsap.set(wipe, { visibility: 'hidden', yPercent: 100, y: 0 })
      undoWipe = () => {
        clearTimeout(armTimer)
        window.removeEventListener('scroll', onScroll)
        document.removeEventListener('click', onLink, true)
        clearTimeout(guard)
        listen(false)
        html.style.overflow = ''
        html.style.scrollbarGutter = ''
        ScrollTrigger.removeEventListener('refresh', measure)
      }
    }
    // gsap.context runs this callback immediately, so `ctx` does not exist yet in here: the wipe's clean-up is handed back
    // as the return value, which gsap.context calls when it is reverted.
    return () => undoWipe?.()
  }, root)

  // the page grows when the lazy 3D figures and images arrive: keep trigger positions honest
  let t = 0
  const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250) }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(refresh) : null
  ro?.observe(document.body)
  window.addEventListener('load', refresh)

  return () => {
    clearTimeout(t)
    ro?.disconnect()
    window.removeEventListener('load', refresh)
    ctx.revert()
  }
}