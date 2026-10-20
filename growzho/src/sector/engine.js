import HL from '../camera/kernel.js'

/**
 * A tiny 3D layer over the Hairline kernel, shared by the sector figures (books, cup, dress).
 * An object is {H, R, parts}: H its height, R its half-width, and parts a list of
 *   { c: [u, v, w], draw(k) -> {sil, cr, dt}, hi?, bias? }
 * in its own frame (u front, v across, w up). c is the part's centre, used to paint parts back to front;
 * draw gets a context k (below) and returns the part's silhouette, crease and detail paths.
 * The pointer turns the whole object (yaw) and nods it (up / down), each on its own spring, like the camera.
 */
const { Cam, circ, clamp, fit, hull, mk, open, poly, pointer, proj, put, rad, register, ringAt, run, solid, spring, stepS, disposer } = HL
const K = Math.SQRT1_2
const YAW0 = 15, YAW = 38, NOD = 16

// yaw about the vertical (the front starts toward the viewer), then a nod about the screen-horizontal axis
const turn = (yaw, nod) => {
  const a = rad(45 + yaw), ca = Math.cos(a), sa = Math.sin(a), t = rad(nod), ct = Math.cos(t), st = Math.sin(t)
  return (u, v, w) => {
    const x = u * ca - v * sa, y = u * sa + v * ca, d = K * (x - y)
    return [x * ct - K * w * st + K * d * (1 - ct), y * ct - K * w * st - K * d * (1 - ct), w * ct + K * (x + y) * st]
  }
}

// the context a part draws with. (dx, dy, a) places a sub-object (one book of a stack) at an offset and its own yaw.
function ctx(R, P, hz, dx = 0, dy = 0, a = 0) {
  const c = Math.cos(rad(a)), s = Math.sin(rad(a))
  const at = (u, v, w) => { const q = R(dx + u * c - v * s, dy + u * s + v * c, w - hz); return P(q[0], q[1], q[2]) }
  const dir = (u, v, w = 0) => R(u * c - v * s, u * s + v * c, w)
  return {
    at,
    front: (q) => { const n = dir(q.nu, q.nv); return n[0] + n[1] >= -1e-6 },            // a ring sample on the side facing us
    face: (u, v, w) => { const n = dir(u, v, w); return n[0] * 0.612 + n[1] * 0.612 + n[2] * 0.5 > 0.12 },
    sub: (x, y, ang) => ctx(R, P, hz, x, y, ang),
  }
}

/** drawing helpers for the objects */
export const ell = (rx, ry, n = 28) => Array.from({ length: n }, (_, i) => {         // an ellipse ring, with true normals
  const a = (i / n) * 6.2832, c = Math.cos(a), s = Math.sin(a), l = Math.hypot(ry * c, rx * s) || 1
  return { u: rx * c, v: ry * s, nu: (ry * c) / l, nv: (rx * s) / l }
})
export const frus = (k, r0, z0, r1, z1) => poly(hull(ringAt(k.at, r0, z0).concat(ringAt(k.at, r1, z1))))   // the silhouette of a solid between two rings
export const arc = (k, ring, z) => open(ringAt(k.at, run(ring, k.front), z))        // the half of a ring we can see
export const loop = (k, ring, z) => poly(ringAt(k.at, ring, z))
export const line = (k, pts) => open(pts.map((p) => k.at(...p)))
export const shape = (k, pts) => poly(pts.map((p) => k.at(...p)))

export function mount3d({ stage, svg }, obj) {
  const bag = disposer(), hz = obj.H / 2, gz = -hz - obj.R * 0.22
  const C = Cam(45, 0.5, 1), P = proj(C), pts = []
  for (const y of [YAW0 - YAW, YAW0, YAW0 + YAW]) for (const n of [-NOD, NOD]) {
    const R = turn(y, n)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const w of [0, obj.H]) pts.push(R(sx * obj.R, sy * obj.R, w - hz))
  }
  pts.push(...circ(obj.R * 1.1, 24).map((q) => [q.u, q.v, gz]))
  const xs = pts.map((q) => P(...q)[0]), ys = pts.map((q) => P(...q)[1])
  C.S = Math.min(340 / (Math.max(...xs) - Math.min(...xs)), 270 / (Math.max(...ys) - Math.min(...ys)))   // fill the box at the most extreme pose
  fit(C, pts, 200, 150)

  const g = mk('g', {}, svg)
  mk('path', { d: poly(ringAt(P, circ(obj.R * 1.1, 56), gz)), class: 'nf dash' }, g)   // the floor it hovers over
  const parts = obj.parts.map((p) => { const el = solid(g); el.dt = mk('path', { class: p.cls ? `nf lo ${p.cls}` : 'nf lo' }, el.g); return { ...p, el } })
  const yaw = spring(YAW0, { eps: 0.05 }), nod = spring(0, { eps: 0.05 })
  let ly = NaN, ln = NaN, order = ''

  function draw(a, n) {
    if (a === ly && n === ln) return
    ly = a; ln = n
    const R = turn(a, n), k = ctx(R, P, hz)
    for (const p of parts) {
      const o = p.draw(k)
      put(p.el, { sil: o.sil || '', crease: o.cr || '' })
      p.el.dt.setAttribute('d', o.dt || '')
      p.el.sil.classList.toggle('hi', !!p.hi)
      const q = R(p.c[0], p.c[1], p.c[2] - hz)
      p.key = q[0] + q[1] + 0.8165 * q[2] + (p.bias || 0)
    }
    const sorted = parts.slice().sort((x, y) => x.key - y.key), sig = sorted.map((p) => parts.indexOf(p)).join()
    if (sig !== order) { order = sig; for (const p of sorted) g.appendChild(p.el.g) }
  }

  const B = register(stage, (dt) => { const a = stepS(yaw, dt), b = stepS(nod, dt); draw(yaw.x, nod.x); return a || b })
  bag.add(B.unregister)
  const aim = (p) => {
    yaw.t = p ? YAW0 - YAW * clamp((p[0] - 200) / 160, -1, 1) : YAW0      // it turns to face the pointer
    nod.t = p ? NOD * clamp((150 - p[1]) / 130, -1, 1) : 0                // and lifts or drops with its height
    B.wake()
  }
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }))
  bag.add(() => svg.replaceChildren())
  return { destroy: bag.dispose }
}