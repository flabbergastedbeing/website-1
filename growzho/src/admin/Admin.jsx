import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../lib/supabase.js'
import { SERVICES } from '../lib/services.js'
import '../pages.css'

/**
 * /admin: sign in with the one admin account, then see, search, export and delete the contact-form submissions.
 * Who may read the data is decided by the database (supabase/schema.sql), not by this page: anyone else who signs in sees nothing.
 */
const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const IG = /^@?[A-Za-z0-9._]{1,30}$/
const MAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

// CSV that opens correctly in Excel (BOM, quotes) and can't run a formula: a cell that starts with = + - @ is made plain text,
// except a real phone number (+91 …) or Instagram handle (@brand), which are checked first so they stay clean.
const PHONE = /^\+?[\d\s().-]{6,30}$/
const cell = (v, ok) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !ok?.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"` }
function toCsv(rows) {
  const head = ['Submitted', 'Full name', 'Email', 'Phone / WhatsApp', 'Company / Brand', 'Instagram', 'Services', 'Project details']
  const lines = rows.map((r) => [cell(fmtDate(r.created_at)), cell(r.full_name), cell(r.email), cell(r.phone, PHONE), cell(r.company), cell(r.instagram, IG), cell((r.services || []).join('; ')), cell(r.message)].join(','))
  return '\ufeff' + [head.map((h) => cell(h)).join(','), ...lines].join('\r\n')
}

function useDocTitle(title) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    return () => { document.title = prev; meta.remove() }
  }, [title])
}

function Shell({ children, right }) {
  return (
    <div className="pg ad">
      <header className="pg-bar">
        <a href="/" className="logo">growzho.<span className="ad-tag">admin</span></a>
        <div className="ad-right">{right}</div>
      </header>
      {children}
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr('That email and password don’t match.')
    setBusy(false)
  }
  return (
    <main className="ad-login">
      <p className="label">Admin // Sign in</p>
      <h1 className="h-lg">Welcome back.</h1>
      <form onSubmit={go} className="ad-form">
        <div className="field"><label htmlFor="ad-email">Email address</label><input id="ad-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="ad-pw">Password</label><input id="ad-pw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn lg" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}

function Row({ r, open, onToggle, confirm, setConfirm, onDelete, busy }) {
  const phoneHref = r.phone && /^[+\d][\d\s().-]*$/.test(r.phone) ? `tel:${r.phone.replace(/[^\d+]/g, '')}` : null
  return (
    <li className={`ad-row${open ? ' open' : ''}`}>
      <button type="button" className="ad-sum" aria-expanded={open} onClick={onToggle}>
        <span className="c-date">{fmtDate(r.created_at)}</span>
        <span className="c-who"><b>{r.full_name}</b><em>{r.company}</em></span>
        <span className="c-mail">{r.email}</span>
        <span className="c-ig">{r.instagram}</span>
        <span className="c-svc">{(r.services || []).length ? r.services.join(' · ') : <i>—</i>}</span>
        <span className="c-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="ad-detail">
          <dl>
            <div><dt>Full name</dt><dd>{r.full_name}</dd></div>
            <div><dt>Email</dt><dd>{MAIL.test(r.email) ? <a href={`mailto:${r.email}`}>{r.email}</a> : r.email}</dd></div>
            <div><dt>Phone / WhatsApp</dt><dd>{phoneHref ? <a href={phoneHref}>{r.phone}</a> : r.phone}</dd></div>
            <div><dt>Company / Brand</dt><dd>{r.company}</dd></div>
            <div><dt>Instagram</dt><dd>{IG.test(r.instagram) ? <a href={`https://www.instagram.com/${r.instagram.replace(/^@/, '')}/`} target="_blank" rel="noopener noreferrer">{r.instagram} ↗</a> : r.instagram}</dd></div>
            <div><dt>Services</dt><dd>{(r.services || []).length ? r.services.join(', ') : 'None selected'}</dd></div>
            <div className="wide"><dt>Project details</dt><dd className="msg">{r.message}</dd></div>
          </dl>
          <div className="ad-del">
            {confirm === r.id ? (
              <>
                <span>Delete this submission for good?</span>
                <button type="button" className="pg-btn danger" disabled={busy} onClick={() => onDelete(r.id)}>{busy ? 'Deleting…' : 'Yes, delete'}</button>
                <button type="button" className="pg-btn" onClick={() => setConfirm(null)}>Cancel</button>
              </>
            ) : <button type="button" className="pg-btn" onClick={() => setConfirm(r.id)}>Delete</button>}
          </div>
        </div>
      )}
    </li>
  )
}

function Dashboard({ session }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [svc, setSvc] = useState('')
  const [openId, setOpenId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(5000)
    if (e) { setError('Could not load the submissions. Check your Supabase settings and try again.'); setRows([]); return }
    setRows(data)
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (rows || []).filter((r) => (!svc || (r.services || []).includes(svc)) &&
      (!n || [r.full_name, r.email, r.phone, r.company, r.instagram, r.message, ...(r.services || [])].some((x) => String(x || '').toLowerCase().includes(n))))
  }, [rows, q, svc])

  async function del(id) {
    setBusy(true); setError('')
    const { data, error: e } = await supabase.from('submissions').delete().eq('id', id).select('id')
    setBusy(false)
    if (e || !data?.length) { setError('Could not delete that submission.'); return }
    setRows((p) => p.filter((r) => r.id !== id)); setConfirm(null); setOpenId(null)
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `growzho-submissions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  return (
    <Shell right={<><span className="ad-who">{session.user.email}</span><button type="button" className="pg-btn" onClick={() => supabase.auth.signOut()}>Sign out</button></>}>
      <main className="ad-main wrap">
        <p className="label">Admin // Submissions</p>
        <div className="ad-head">
          <h1 className="h-lg">Contact form submissions.</h1>
          <p className="ad-count" aria-live="polite">{rows ? `${shown.length} of ${rows.length}` : '…'}</p>
        </div>
        <div className="ad-tools">
          <div className="field grow"><label htmlFor="ad-q">Search</label><input id="ad-q" type="search" placeholder="Name, brand, email, Instagram, message…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-svc">Service</label>
            <select id="ad-svc" value={svc} onChange={(e) => setSvc(e.target.value)}><option value="">All services</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <button type="button" className="pg-btn" onClick={load}>Refresh</button>
          <button type="button" className="pg-btn solid" onClick={exportCsv} disabled={!shown.length}>Export CSV</button>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {rows === null ? <p className="ad-empty">Loading…</p> : shown.length === 0 ? (
          <p className="ad-empty">{rows.length ? 'No submissions match your search.' : 'No submissions yet. They will appear here as soon as someone fills in the form.'}</p>
        ) : (
          <>
            <div className="ad-cols" aria-hidden="true"><span>Submitted</span><span>Name / Brand</span><span>Email</span><span>Instagram</span><span>Services</span><span /></div>
            <ul className="ad-list">
              {shown.map((r) => <Row key={r.id} r={r} open={openId === r.id} onToggle={() => { setOpenId(openId === r.id ? null : r.id); setConfirm(null) }} confirm={confirm} setConfirm={setConfirm} onDelete={del} busy={busy} />)}
            </ul>
          </>
        )}
      </main>
    </Shell>
  )
}

export default function Admin() {
  useDocTitle('Admin — Growzho')
  const [session, setSession] = useState(undefined)   // undefined = still checking
  const [access, setAccess] = useState(null)          // null = checking, true / false

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const uid = session?.user?.id
  useEffect(() => {
    if (!uid) { setAccess(null); return }
    let off = false
    supabase.rpc('is_admin').then(({ data, error }) => { if (!off) setAccess(!error && data === true) })
    return () => { off = true }
  }, [uid])

  if (!supabaseReady) return (
    <Shell><main className="ad-login"><p className="label">Admin // Setup needed</p><h1 className="h-lg">Not connected yet.</h1>
      <p className="body">Add your Supabase URL and key to a <code>.env</code> file (see <code>.env.example</code>), run <code>supabase/schema.sql</code>, then restart the site. Steps are in the README.</p></main></Shell>
  )
  if (session === undefined) return <Shell><main className="ad-login"><p className="ad-empty">Loading…</p></main></Shell>
  if (!session) return <Shell><Login /></Shell>
  if (access === null) return <Shell><main className="ad-login"><p className="ad-empty">Checking access…</p></main></Shell>
  if (!access) return (
    <Shell><main className="ad-login"><p className="label">Admin // No access</p><h1 className="h-lg">This account isn’t the admin.</h1>
      <p className="body">You’re signed in as {session.user.email}, which doesn’t have access to the submissions.</p>
      <button type="button" className="btn lg" onClick={() => supabase.auth.signOut()}>Sign out</button></main></Shell>
  )
  return <Dashboard session={session} />
}