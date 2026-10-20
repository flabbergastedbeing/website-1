import { useEffect, useId, useRef, useState } from 'react'
import { supabase, supabaseReady } from './lib/supabase.js'
import { SERVICES } from './lib/services.js'

/**
 * The "Get started" form. Seven fields (six required), checked in the browser first and again by the database
 * (see supabase/schema.sql), then saved as one row in the `submissions` table. The admin dashboard reads them from there.
 */
const EMPTY = { name: '', email: '', phone: '', company: '', instagram: '', services: [], message: '' }
const squash = (s) => s.replace(/\s+/g, ' ').trim()

// "@brand", "brand", "instagram.com/brand/" and "https://www.instagram.com/brand?igsh=…" all become "@brand"
const handleOf = (raw) => {
  let s = raw.trim()
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i)
  if (m) s = m[1]
  return s.replace(/^@+/, '')
}

function validate(v) {
  const e = {}
  const name = squash(v.name), company = squash(v.company), message = v.message.trim()
  if (name.length < 2) e.name = 'Please enter your full name.'
  else if (name.length > 120) e.name = 'That name is too long.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim()) || v.email.trim().length > 254) e.email = 'Please enter a valid email address, like you@company.com.'
  const digits = v.phone.replace(/\D/g, '')
  if (!/^[+\d][\d\s().-]*$/.test(v.phone.trim()) || digits.length < 7 || digits.length > 15) e.phone = 'Please enter a phone or WhatsApp number with 7 to 15 digits.'
  if (!company) e.company = 'Please enter your company or brand name.'
  else if (company.length > 160) e.company = 'That name is too long.'
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handleOf(v.instagram))) e.instagram = 'Please enter your Instagram handle, like @yourbrand.'
  if (message.length < 10) e.message = 'Please tell us a little more about your project (at least 10 characters).'
  else if (message.length > 4000) e.message = 'Please keep your message under 4,000 characters.'
  return e
}

function Field({ id, label, required, error, full, children, hint }) {
  return (
    <div className={`field${full ? ' full' : ''}${error ? ' bad' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  )
}

// A dropdown with checkboxes inside, so several services can be picked. Real checkboxes keep it usable with a keyboard and screen reader.
function ServicesSelect({ id, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key) }
  }, [open])
  const toggle = (s) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])
  const shown = value.length === 0 ? 'Select one or more' : value.length <= 2 ? value.join(', ') : `${value.length} services selected`
  return (
    <div className="ms" ref={wrap}>
      <button type="button" id={id} ref={btn} className="ms-btn" aria-haspopup="true" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((o) => !o)}>
        <span className={value.length ? 'val' : 'ph'}>{shown}</span>
        <span className="ms-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <fieldset className="ms-panel" id={`${id}-panel`}>
          <legend className="sr">Services interested in</legend>
          {SERVICES.map((s) => (
            <label className="ms-opt" key={s}>
              <input type="checkbox" checked={value.includes(s)} onChange={() => toggle(s)} />
              <span className="ms-box" aria-hidden="true" />
              {s}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}

export default function ContactForm({ fallbackEmail }) {
  const uid = useId().replace(/:/g, '')
  const [v, setV] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')   // idle | sending | sent | failed
  const [failMsg, setFailMsg] = useState('')
  const [trap, setTrap] = useState('')           // hidden field: people never fill it in, many bots do
  const formRef = useRef(null)
  const id = (k) => `${uid}-${k}`
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))
  const blur = (k) => () => setErrors((p) => { const e = validate(v); const n = { ...p }; if (e[k]) n[k] = e[k]; else delete n[k]; return n })
  const clearErr = (k) => setErrors((p) => { if (!p[k]) return p; const n = { ...p }; delete n[k]; return n })
  const props = (k) => ({ id: id(k), value: v[k], onChange: (e) => { set(k)(e); clearErr(k) }, onBlur: blur(k), 'aria-invalid': errors[k] ? 'true' : undefined, 'aria-describedby': errors[k] ? `${id(k)}-err` : undefined })

  async function submit(e) {
    e.preventDefault()
    if (status === 'sending') return
    const found = validate(v)
    setErrors(found)
    const first = ['name', 'email', 'phone', 'company', 'instagram', 'message'].find((k) => found[k])
    if (first) { formRef.current?.querySelector(`#${id(first)}`)?.focus(); return }
    if (trap) { setStatus('sent'); return }                                   // a bot: look successful, save nothing
    setStatus('sending'); setFailMsg('')
    if (!supabaseReady) {
      setStatus('failed'); setFailMsg(`The form is not connected yet. Please email us at ${fallbackEmail} instead.`)
      return
    }
    const { error } = await supabase.from('submissions').insert({
      full_name: squash(v.name),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.trim(),
      company: squash(v.company),
      instagram: '@' + handleOf(v.instagram),
      services: v.services,
      message: v.message.trim(),
    })
    if (error) { setStatus('failed'); setFailMsg(`Sorry, we couldn't send that. Please try again, or email us at ${fallbackEmail}.`); return }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="cform-done" role="status">
        <p className="label">Request received</p>
        <h3 className="h">Thank you{squash(v.name) ? `, ${squash(v.name).split(' ')[0]}` : ''}.</h3>
        <p>We have your details and will get back to you soon using the email or number you shared.</p>
        <button type="button" className="btn lg" onClick={() => { setV(EMPTY); setErrors({}); setTrap(''); setStatus('idle') }}>Send another request</button>
      </div>
    )
  }

  return (
    <form className="cform" ref={formRef} onSubmit={submit} noValidate aria-label="Contact form">
      <Field id={id('name')} label="Full name" required error={errors.name}>
        <input {...props('name')} type="text" name="name" autoComplete="name" maxLength={120} />
      </Field>
      <Field id={id('email')} label="Email address" required error={errors.email}>
        <input {...props('email')} type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@company.com" maxLength={254} />
      </Field>
      <Field id={id('phone')} label="Phone / WhatsApp number" required error={errors.phone}>
        <input {...props('phone')} type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" maxLength={30} />
      </Field>
      <Field id={id('company')} label="Company / Brand name" required error={errors.company}>
        <input {...props('company')} type="text" name="company" autoComplete="organization" maxLength={160} />
      </Field>
      <Field id={id('instagram')} label="Instagram handle" required error={errors.instagram}>
        <input {...props('instagram')} type="text" name="instagram" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="@yourbrand" maxLength={80} />
      </Field>
      <Field id={id('services')} label="Services interested in">
        <ServicesSelect id={id('services')} value={v.services} onChange={(s) => setV((p) => ({ ...p, services: s }))} />
      </Field>
      <Field id={id('message')} label="Tell us about your project and what you need" required error={errors.message} full>
        <textarea {...props('message')} name="message" rows={6} maxLength={4000} />
      </Field>

      <div className="hp" aria-hidden="true">
        <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
      </div>

      <div className="cform-foot full">
        <button className="btn lg" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send request'}<span aria-hidden="true">→</span></button>
        <p className="note">Fields marked <span className="req">*</span> are required.</p>
      </div>
      {status === 'failed' && <p className="cform-fail full" role="alert">{failMsg}</p>}
    </form>
  )
}