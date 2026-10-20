import { Component, Suspense, lazy, useState, useEffect, useLayoutEffect, useRef } from 'react'
import CameraFigure from './CameraFigure.jsx'
import GrowzhoMark from './GrowzhoMark.jsx' // the preloader's logo, shown in the About section
import { TextRoll, TextRollWords } from './components/ui/text-roll.jsx'
import { useDeferredMount } from './useDeferredMount.js'
import Preloader from './preloader/Preloader.jsx'
import SectorCarousel from './SectorCarousel.jsx'
import ContactForm from './ContactForm.jsx'

// The WebGL gradient (three.js + shadergradient) is a separate chunk, fetched only after the page
// has painted, so the headline and copy are on screen before any of that code is downloaded or run.
const HeroGradient = lazy(() => import('./HeroGradient.jsx'))
// The sector figures (3D books, cup, dress) are their own chunk too; the card keeps its space until they arrive.
const SectorFigure = lazy(() => import('./SectorFigure.jsx'))
// ms after page load before the gradient starts (it also starts on the first touch / mouse move)
// (the preloader is now shorter, so this lands right after it lifts)
const GRADIENT_DELAY = 2800

// One headline line per mask, so motion.js can slide each line up on its own.
function Lines({ l }) {
  return l.map((t, i) => <span className="ln" key={i}><span className="ln-i">{t}</span></span>)
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// If the WebGL gradient fails to load (e.g. blocked HDR env map), keep the page up and the pane black.
class GradientBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

// Footer details. TODO: replace the placeholders below with the real contact details and social profiles.
const CONTACT = { email: 'hello@growzho.in', phone: '+91 00000 00000', tel: '+910000000000', address: ['Vadodara', 'Gujarat, India'] }
const SOCIALS = [['Instagram', 'https://www.instagram.com/'], ['LinkedIn', 'https://www.linkedin.com/'], ['X / Twitter', 'https://x.com/']]

const proof = [
  ['4', '+', 'Team members'],
  ['2', '+', 'Verified clients'],
  ['100', '%', 'On-time delivery'],
  ['2026', '', 'Founded, Vadodara'],
]
const sectors = [
  {
    n: '01',
    fig: 'books',
    title: 'Education',
    forWho: 'Coaching Institutes & Academies',
    desc: 'Turn student results into enrollments. We craft authentic classroom photography, high-retention student testimonial reels, and result-oriented campaigns that build parent trust and fill batches.',
    tags: ['Admissions Campaigns', 'Faculty Spotlight', 'Campus Videography'],
    cta: 'Inquire for Education',
  },
  {
    n: '02',
    fig: 'cup',
    title: 'Cafe & Restaurant',
    forWho: 'Hospitality, Bistros & Dining',
    desc: 'Fill seats and fuel cravings. We capture mouthwatering culinary photography, cinematic sizzling reels, and atmosphere-driven videos that turn casual scrollers into loyal diners.',
    tags: ['Food Styling & Shoots', 'Viral Menu Reels', 'Foot-Traffic Growth'],
    cta: 'Inquire for Hospitality',
  },
  {
    n: '03',
    fig: 'dress',
    title: 'Lifestyle Brand',
    forWho: 'Fashion, Beauty, Wellness & D2C',
    desc: 'Cultivate aesthetic desire and brand love. From editorial lookbooks to culture-driven vertical storytelling, we create the distinctive digital presence your brand deserves.',
    tags: ['Product Lookbooks', 'Trend-Driven Reels', 'Feed Aesthetic Design'],
    cta: 'Inquire for Lifestyle',
  },
]
const stats = [
  ['2', 'Verified clients with positive feedback'],
  ['100%', 'On-time project delivery, every time'],
  ['Jan', '2026 — Agency founded & operational'],
  ['100%', 'Client content ownership — always yours'],
]
const reviews = [
  {
    q: 'Best work and best timely delivery. Growzho delivered exactly what we needed for our brand — the quality of content and how smoothly the whole project was handled stood out from the start.',
    name: 'Herb Infinity', init: 'HI', role: 'Beauty Brand', handle: '@herbinfinity.co',
  },
  {
    q: 'Budget-friendly and quality works. Growzho understood what we needed, delivered on time, and made sure we got real value. Exactly the kind of agency a community organisation can rely on.',
    name: 'Bajar Yuvak Mandal', init: 'BY', role: 'Community Organisation', handle: '@bajar_yuvak_mandal_',
  },
]
const pillars = [
  ['Industry-Specialized', 'We understand what makes a parent choose a coaching class, what makes a customer walk into a cafe, and what makes a follower become a fan.'],
  ['Full Multimedia Production', 'Photography, videography, design, and strategy — all under one roof. No more coordinating multiple vendors.'],
  ['Results-Driven', 'More student inquiries. More cafe foot traffic. More engaged followers. Every strategy is tied to a real business outcome.'],
]

export default function App() {
  const [active, setActive] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  // The heavy WebGL gradient is for large screens with a mouse only; phones and tablets get a light CSS gradient instead
  // (saves ~1 MB of script and a lot of battery).
  const [wideScreen] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 901px) and (hover: hover)').matches)
  const showGradient = useDeferredMount(GRADIENT_DELAY) && wideScreen
  // the footer has its own live gradient (a second canvas); it is only started once the footer is about to scroll into view
  const footRef = useRef(null)
  const [footNear, setFootNear] = useState(false)
  useEffect(() => {
    const el = footRef.current
    if (!el || !wideScreen) return
    if (!('IntersectionObserver' in window)) { setFootNear(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setFootNear(true); io.disconnect() } }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [wideScreen])
  const navLinks = [['top', 'Home'], ['specialisation', 'Specialisation'], ['numbers', 'Results'], ['about', 'About']]

  // mobile menu: Escape closes it, and it never stays open when the window grows to desktop size
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false) }
    const mq = window.matchMedia('(min-width: 901px)')
    const onMq = () => { if (mq.matches) setMenu(false) }
    window.addEventListener('keydown', onKey)
    mq.addEventListener?.('change', onMq)
    return () => { window.removeEventListener('keydown', onKey); mq.removeEventListener?.('change', onMq) }
  }, [menu])

  // highlight the nav link of the section the reader is currently in (none while still in the hero).
  // Layout is read at most once per frame, and never during the first render, so it can't force a reflow.
  useEffect(() => {
    const ids = ['specialisation', 'numbers', 'about', 'start']
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight * 0.4
      let cur = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = 'start'
      setActive(cur)
      setScrolled(window.scrollY > 8) // the bar fades in as soon as the page moves
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Scroll motion (GSAP). The `motion` class hides the things that will animate in, before first paint,
  // so there is no flash; if the motion code is slow or fails to load, the class is removed and everything shows.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    document.documentElement.classList.add('motion')
    return () => document.documentElement.classList.remove('motion')
  }, [])
  useEffect(() => {
    if (prefersReducedMotion()) return
    const html = document.documentElement
    let off
    let cancelled = false
    const giveUp = setTimeout(() => html.classList.remove('motion'), 6000)
    import('./motion.js')
      .then((m) => { if (cancelled) return; clearTimeout(giveUp); off = m.initMotion(document) })
      .catch(() => html.classList.remove('motion'))
    return () => { cancelled = true; clearTimeout(giveUp); off?.() }
  }, [])

  return (
    <>
      <Preloader />
      <div className="wipe" aria-hidden="true"><span className="wipe-label" /><span className="wipe-hint">Scroll to continue ↓</span></div>
      <nav className={[scrolled ? 'scrolled' : '', menu ? 'menu-open' : ''].filter(Boolean).join(' ') || undefined}>
        <div className="in">
          <a href="#top" className="logo">growzho.</a>
          <div className="links">
            {navLinks.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={(active || 'top') === id ? 'on' : undefined} aria-current={(active || 'top') === id ? 'true' : undefined}>{label}</a>
            ))}
          </div>
          <div className="r">
            <a href="#start" className="btn" onClick={() => setMenu(false)}>Contact Us</a>
            <button type="button" className="burger" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu((m) => !m)}>
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
        <div id="mobile-menu" className="mobile-menu" hidden={!menu}>
          {navLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenu(false)} aria-current={(active || 'top') === id ? 'true' : undefined}>{label}</a>
          ))}
        </div>
      </nav>

      <main id="top">
        <header className="hero">
          <div id="gl" aria-hidden="true">{showGradient && <GradientBoundary><Suspense fallback={null}><HeroGradient /></Suspense></GradientBoundary>}</div>
          <div className="pane shade">
            <div className="copy">
              <h1 className="display rise" style={{ "--d": "0.1s" }}>
                {['Professional', 'Content.', 'Real', 'Growth.'].map((line) => (
                  <span className="line" key={line}><TextRoll>{line}</TextRoll>{' '}</span>
                ))}
              </h1>
              <p className="body rise" style={{ "--d": "0.3s" }}>
                <TextRollWords>
                  {'Full-scale Social Media Management powered by in-house Photography and Videography, crafted to build unmissable visual authority and genuine audience traction.'}
                </TextRollWords>
              </p>
              <div className="actions">
                <a href="#start" className="touch rise" style={{ "--d": "0.5s" }}><TextRoll>Get in touch</TextRoll><span className="arrow-r" aria-hidden="true">→</span></a>
                <a href="#specialisation" className="scroll rise" style={{ "--d": "0.62s" }}><TextRoll>Scroll to Explore</TextRoll><span className="arrow" aria-hidden="true">↓</span></a>
              </div>
            </div>
          </div>
          <div className="pane mark">
            <div className="figure">
              <CameraFigure className="rise zoom" style={{ "--d": "0.2s" }} />
                            <div className="proof">
                {proof.map(([n, s, l], i) => (
                  <div key={l} className="rise" style={{ "--d": `${0.5 + i * 0.12}s` }}><b><TextRoll>{n + s}</TextRoll></b><span><TextRoll>{l}</TextRoll></span></div>
                ))}
              </div>
            </div>
            <span className="cap"><TextRoll>growzho.in — Scale your story</TextRoll></span>
          </div>
        </header>

        <section id="specialisation" className="wrap">
          <p className="label">01 // Specialisation</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Industry', 'Specialisation.']} /></h2>
          </div>
          <div className="sectors">
            <SectorCarousel
              items={sectors}
              autoplay={!prefersReducedMotion()}
              renderCard={(x) => (
                <article className="sector">
                  <span className="n">Sector {x.n}</span>
                  <Suspense fallback={<div className="fig" />}><SectorFigure kind={x.fig} /></Suspense>
                  <h3 className="h">{x.title}</h3>
                  <p className="for">{x.forWho}</p>
                  <p className="desc">{x.desc}</p>
                  <ul className="tags">{x.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                  <a href="#start" className="go"><TextRoll>{x.cta}</TextRoll><span className="arrow-r" aria-hidden="true">→</span></a>
                </article>
              )}
            />
          </div>
        </section>

        <section id="numbers" className="wrap">
          <p className="label">02 // Client outcomes</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Results', '& Reviews.']} /></h2>
          </div>
          <div className="stats">
            {stats.map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}
          </div>
          <div className="reviews">
            {reviews.map((r) => (
              <figure className="review" key={r.name}>
                <div className="stars" role="img" aria-label="5 out of 5 stars">★★★★★</div>
                <blockquote>&ldquo;{r.q}&rdquo;</blockquote>
                <figcaption>
                  <span className="av" aria-hidden="true">{r.init}</span>
                  <span><b>{r.name}</b><span className="meta">{r.role} · {r.handle}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="about" className="wrap">
          <p className="label">03 // About us</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Who we are.']} /></h2>
          </div>
          <div className="about">
            <div className="story">
              <h3 className="h">A Creative Agency Built in Vadodara</h3>
              <p>Growzho.in is a social media and creative agency founded in January 2026, based in Vadodara, Gujarat. We work with brands across education, hospitality, beauty, lifestyle, and culture — helping them show up online with content that actually reflects who they are. From brand identity and graphic design to social media management, video editing, and content strategy, we handle the creative so our clients can focus on what they do best.</p>
              <p className="soft">We’re a young, hands-on team. Every project gets direct attention from the people building it — no middlemen, no templated output.</p>
              <blockquote>“We don’t just make content. We build the creative identity your brand deserves.”</blockquote>
            </div>
            <div className="story-logo">
              <GrowzhoMark />
            </div>
          </div>
          <div className="pillars">
            {pillars.map(([t, d], i) => (
              <div className="pillar" key={t}><span className="pn">{String(i + 1).padStart(2, '0')}</span><h3 className="h">{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </section>

        <section id="start" className="wrap cta">
          <p className="label">Get started</p>
          <div className="cta-grid">
            <div className="cta-lead">
              <h2 className="display"><Lines l={['Ready to', 'grow?']} /></h2>
              <p className="body">Tell us about your brand and what you need. We’ll get back to you using the details you share.</p>
              <a className="cta-mail" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </div>
            <ContactForm fallbackEmail={CONTACT.email} />
          </div>
        </section>
      </main>

      <footer ref={footRef}>
        <div className="foot-gl" aria-hidden="true">{footNear && <GradientBoundary><Suspense fallback={null}><HeroGradient /></Suspense></GradientBoundary>}</div>
        <div className="wrap foot-in">
          <div className="foot-cols">
            <div className="foot-col">
              <h3>Get in touch</h3>
              <a className="foot-mail" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={`tel:${CONTACT.tel}`}>{CONTACT.phone}</a>
            </div>
            <div className="foot-col">
              <h3>Studio</h3>
              <p>{CONTACT.address[0]}<br />{CONTACT.address[1]}</p>
            </div>
            <div className="foot-col">
              <h3>Follow</h3>
              {SOCIALS.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer">{name} <span aria-hidden="true">↗</span></a>)}
            </div>
          </div>
          <div>
            <p className="foot-mark" aria-label="growzho.">growzho.</p>
            <div className="foot-bar">
              <span>© 2026 growzho.</span>
              <div><a href="#specialisation">Specialisation</a><a href="#numbers">Results</a><a href="#about">About</a><a href="#start">Contact</a></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}