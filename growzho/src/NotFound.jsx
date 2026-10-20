import { useEffect } from 'react'
import './pages.css'

/** Shown for any address the site doesn't have. Same black, mono and red-panel look as the home page. */
export default function NotFound() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Page not found — Growzho'
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => { document.title = prev; meta.remove() }
  }, [])
  return (
    <div className="pg nf">
      <header className="pg-bar"><a href="/" className="logo">growzho.</a><a href="/#start" className="btn">Contact Us</a></header>
      <main className="nf-main">
        <p className="label">Error // Page not found</p>
        <h1 className="nf-code" aria-label="404">4<span>0</span>4</h1>
        <p className="body nf-text">This page doesn’t exist, or it has moved. Let’s get you back to something worth looking at.</p>
        <div className="nf-actions">
          <a href="/" className="pg-btn solid">Back to home <span aria-hidden="true">→</span></a>
          <a href="/#specialisation" className="pg-btn">See what we do</a>
          <a href="/#start" className="pg-btn">Get in touch</a>
        </div>
      </main>
      <div className="nf-band" role="presentation"><span>404 // Nothing here</span><span>growzho.in</span></div>
    </div>
  )
}