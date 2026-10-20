import HL from './kernel.js'

/**
 * Camera: a DSLR on a tripod, seen from its right-hand side and facing left. The pointer's height against the
 * camera head sets the tilt (above it the lens lifts, below it the lens drops). The pointer's x sets a small pan:
 * left of the camera it stays facing left, and moving right turns it toward the viewer, SWEEP degrees at most
 * (never away). Each angle is on its own spring. At rest it looks a little down. The lens is the one bright place.
 * The slider is the swing: how much of the way to the pointer's height the camera tilts.
 *
 * Detail lines (all "lo" strokes, so they stay quiet next to the outlines): body seams, strap lug, port door,
 * grip ribs, mode / command dials, shutter button, hot shoe, eyepiece, lens ridges, AF/MF switch, distance
 * window, hood bayonet notches and front-element rings; on the tripod: leg clamps, column locks, head and lever.
 */
const {
  Cam, circ, clamp, fillet, fit, mk, open, poly, pointer, proj, put, rad, register, rings, ringAt, rrect, run,
  solid, prism, spring, stepS, disposer,
} = HL;

// Tall tripod: head height HP, leg hub HUB and foot spread RF. CS is the size of the camera body.
const HP = 150, CS = 1.15, PZ = HP + 3, HUB = 102, RF = 66;
const PAN0 = 125, SWEEP = 90, DX0 = -40, DX1 = 160, REST = -4, LO = -26, HI = 24, GAIN = 0.25, LZ = 12;

const sh = (ring, du, dv) => ring.map((q) => ({ ...q, u: q.u + du, v: q.v + dv }));   // a ring moved to (du, dv)
const L = (at, pts) => open(pts.map((q) => at(...q)));                                // an open line through [u, v, w] points
const Z = (at, pts) => poly(pts.map((q) => at(...q)));                                // a closed one
const disc = (at, u, v, w, r, n = 14) => Z(at, Array.from({ length: n }, (_, k) => [u + r * Math.cos((k / n) * 6.2832), v, w + r * Math.sin((k / n) * 6.2832)]));
const pad = (at, v, u0, w0, u1, w1, r) => Z(at, rrect(u0, w0, u1, w1, r, 3).map((q) => [q.u, v, q.v]));   // a rounded patch on a side face
const seam = (at, fr, ring, z) => open(ringAt(at, run(ring, fr), z));                 // a line round the visible sides of a body at height z
const ticks = (at, u, v, z, r0, r1, n, a0 = 0, a1 = 6.2832) => Array.from({ length: n }, (_, k) => {
  const a = a0 + ((a1 - a0) * k) / n, c = Math.cos(a), s = Math.sin(a);
  return L(at, [[u + r0 * c, v + r0 * s, z], [u + r1 * c, v + r1 * s, z]]);
}).join("");
const BODY = rings(-8, -15, 8, 15, 3.4, 1.2), GRIP = rings(3.5, -16, 10.6, -9.5, 1.9, 0.8), HUMP = rings(-7, -5.5, 4, 5.5, 3, 1);
const lens = (r) => [circ(r, 28), circ(r - 1.2, 28)];
const arcs = ({ m, fr }, R, cs) => cs.map((c) => open(ringAt(m, run(circ(R, 28), fr), c))).join("");   // rings round the lens at each u in cs
const patch = (m, R, a0, a1, c0, c1) => {                                                            // a rounded window on the barrel
  const arc = (c) => Array.from({ length: 5 }, (_, k) => { const t = rad(a0 + ((a1 - a0) * k) / 4); return m(R * Math.cos(t), R * Math.sin(t), c); });
  return poly(arc(c0).concat(arc(c1).reverse()));
};
const onSide = (k, a, str) => (k.face(0, Math.cos(rad(a)), Math.sin(rad(a))) ? str : "");   // a lens feature, only while its side faces the viewer
const rib = (m, R, a, c0, c1) => { const t = rad(a); return open([m(R * Math.cos(t), R * Math.sin(t), c0), m(R * Math.cos(t), R * Math.sin(t), c1)]); };

/** The camera's parts. ax 1 stands along the lens axis; hi marks the lens (the bright place); det draws a part's fine lines. */
const PARTS = [
  { rg: rings(-9, -6.5, 9, 6.5, 1.6, 0.7), z: [0, 2.2], c: [0, 0, 1.1],                                  // quick-release plate
    det: ({ at, face }) => (face(0, -1, 0) ? L(at, [[-7.4, -6.5, 1.1], [7.4, -6.5, 1.1]]) : "") },
  { rg: BODY, z: [2.2, 21], c: [0, 0, 11.6],                                                              // body
    det: ({ at, fr, face }) => seam(at, fr, BODY[0], 18.4) + seam(at, fr, BODY[0], 4.6) + (!face(0, -1, 0) ? "" :   // flank details only while the right side faces us
      disc(at, -3.4, -15, 15, 1.5) + disc(at, -3.4, -15, 15, 0.55, 8) + pad(at, -15, -4.2, 5.8, -0.5, 10.6, 0.9)
      + L(at, [[-1.2, -15, 7.2], [-1.2, -15, 9.2]]) + L(at, [[-3.6, -15, 12.2], [-0.4, -15, 12.2]])) },
  { rg: HUMP, z: [21, 27], c: [-1.5, 0, 24],                                                              // pentaprism
    det: ({ at, fr }) => seam(at, fr, HUMP[0], 24.4) },
  { rg: GRIP, z: [3.5, 17.6], c: [7, -12.7, 10.6],                                                        // grip
    det: ({ at, fr, face }) => seam(at, fr, GRIP[0], 15.8) + seam(at, fr, GRIP[0], 5.4)
      + (face(0, -1, 0) ? [5.4, 7, 8.6].map((u) => L(at, [[u, -16, 7.2], [u, -16, 14.4]])).join("") : "") },
  { rg: [sh(circ(2, 14), 5, -12), sh(circ(1.2, 14), 5, -12)], z: [21, 22.6], c: [5, -12, 21.8] },         // shutter button
  { rg: [sh(circ(3.3, 18), -2, -11.5), sh(circ(2.6, 18), -2, -11.5)], z: [21, 23.4], c: [-2, -11.5, 22.2], // command dial
    det: ({ at }) => ticks(at, -2, -11.5, 23.4, 2.6, 3.3, 12) },
  { rg: [sh(circ(4.4, 22), -3.4, 9.5), sh(circ(3.5, 22), -3.4, 9.5)], z: [21, 24.2], c: [-3.4, 9.5, 22.6], // mode dial
    det: ({ at }) => ticks(at, -3.4, 9.5, 24.2, 3.5, 4.4, 10) + L(at, [[-3.4, 9.5, 24.2], [-3.4 + 3.2, 9.5 + 0.6, 24.2]]) },
  { rg: rings(-5.5, -2.6, 1, 2.6, 0.8, 0.5), z: [27, 28.2], c: [-2.2, 0, 27.6],                           // hot shoe
    det: ({ at }) => L(at, [[-5, -1.1, 28.2], [0.5, -1.1, 28.2]]) + L(at, [[-5, 1.1, 28.2], [0.5, 1.1, 28.2]]) },
  { ax: 1, rg: [rrect(-3.8, 10, 3.8, 14.4, 1.3, 3), null], z: [-9.8, -7], c: [-8.4, 0, 24] },             // eyepiece
  { ax: 1, hi: 1, rg: lens(7.7), z: [8, 9.2], c: [8.6, 0, LZ] },                                          // mount flange
  { ax: 1, hi: 1, rg: lens(7), z: [9.2, 14], c: [11.6, 0, LZ] },                                          // mount
  { ax: 1, hi: 1, rg: lens(8.4), z: [14, 28], c: [21, 0, LZ],                                             // barrel
    det: (k) => arcs(k, 8.4, [15.2, 15.7, 26.6, 27.1]) + onSide(k, 178, patch(k.m, 8.4, 168, 188, 14.5, 17.2))
      + onSide(k, 205, patch(k.m, 8.4, 194, 216, 24.4, 27.2) + [199, 205, 211].map((a) => rib(k.m, 8.4, a, 25.2, 26.4)).join("")) },
  { ax: 1, hi: 1, rg: [circ(9.2, 28), null], z: [18, 24], c: [21, 0, LZ], bias: 0.5,                     // focus ring
    det: (k) => arcs(k, 9.2, [0, 1, 2, 3, 4, 5, 6].map((i) => 18.7 + i * 0.77)) },
  { ax: 1, hi: 1, rg: lens(9.8), z: [28, 34], c: [31, 0, LZ], glass: [5.4, 3.4, 1.6],                    // hood
    det: (k) => arcs(k, 9.8, [30.6]) + onSide(k, 162, rib(k.m, 9.8, 162, 28.4, 30.2)) + onSide(k, 214, rib(k.m, 9.8, 214, 28.4, 30.2)) },
];

/** Turns a point of the camera's own frame (u forward, v across, w up) about the head: tilt, then pan. */
function turn(pan, tilt) {
  const cp = Math.cos(rad(pan)), sp = Math.sin(rad(pan)), ct = Math.cos(rad(tilt)), st = Math.sin(rad(tilt));
  return (u, v, w) => { const a = u * ct - w * st; return [CS * (a * cp - v * sp), CS * (a * sp + v * cp), CS * (u * st + w * ct)]; };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.6);
  const feet = [225, 105, 345].map((a) => [RF * Math.cos(rad(a)), RF * Math.sin(rad(a)), 0]);
  const reach = [[...feet[0]], [...feet[1]], [...feet[2]], [0, 0, PZ]];
  for (const p of [PAN0, PAN0 - 30, PAN0 - 60, PAN0 - SWEEP]) for (const t of [LO, HI]) for (const u of [-10, 36]) for (const v of [-17, 17]) for (const w of [-2, 29]) {
    const q = turn(p, t)(u, v, w); reach.push([q[0], q[1], PZ + q[2]]);
  }
  fit(C, reach, 200, 166);
  const P = proj(C), S = Math.sin(C.az), K = Math.cos(C.az), [PX, PY] = P(0, 0, PZ);

  // The tripod never moves: the far leg, the column, the near legs, the collar and the head.
  const g = mk("g", {}, svg);
  const front = (q) => q.nu * S + q.nv * K >= -1e-6;
  const strip = (A, B, w0, w1) => {
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]), nx = -(B[1] - A[1]) / l, ny = (B[0] - A[0]) / l;
    const q = [[A[0] + nx * w0, A[1] + ny * w0], [B[0] + nx * w1, B[1] + ny * w1], [B[0] - nx * w1, B[1] - ny * w1], [A[0] - nx * w0, A[1] - ny * w0]];
    return poly(fillet(q, [0.9, 0.9, 0.9, 0.9], 3));
  };
  const leg = (f) => {
    const T = [f[0] * 0.08, f[1] * 0.08, HUB + 4], at = (t) => P(T[0] + (f[0] - T[0]) * t, T[1] + (f[1] - T[1]) * t, T[2] + (f[2] - T[2]) * t);
    const LT = 1.7, wd = (t) => 1.5 - 0.5 * t, foot = P(...f);
    mk("ellipse", { cx: foot[0], cy: foot[1], rx: 3.4, ry: 1.7 }, g);
    mk("path", { d: strip(at(0), at(1), 1.5 * LT, 1 * LT), class: "sil" }, g);
    for (const [t0, t1] of [[0, 0.06], [0.34, 0.4], [0.62, 0.68], [0.93, 1]]) mk("path", { d: strip(at(t0), at(t1), (wd(t0) + 0.9) * LT, (wd(t1) + 0.9) * LT), class: "sil" }, g);   // hinge, leg clamps, foot
  };
  const ring = (z, r = 2.2) => mk("path", { d: open(ringAt(P, run(circ(r, 12), front), z)), class: "nf lo" }, g);
  leg(feet[0]);
  put(solid(g), prism(P, front, circ(2.2, 12), circ(1.2, 12), HUB - 2, HP - 2));
  [HUB + 12, HUB + 13.6, HP - 16].forEach((z) => ring(z));                                                 // column lock and clamp lines
  leg(feet[1]); leg(feet[2]);
  put(solid(g), prism(P, front, circ(4.6, 14), circ(3.4, 14), HUB - 4, HUB + 3));
  ring(HUB - 0.5, 4.6);
  put(solid(g), prism(P, front, circ(4.2, 16), circ(3.2, 16), HP - 8, HP - 4));                           // head base
  ring(HP - 6, 4.2);
  const lv = [P(0, 0, HP - 3), P(10, -10, HP - 8)];
  mk("path", { d: strip(lv[0], lv[1], 0.8, 0.7), class: "sil" }, g);                                      // clamp lever and its knob
  mk("ellipse", { cx: lv[1][0], cy: lv[1][1], rx: 2.2, ry: 1.7 }, g);
  const hb = P(0, 0, HP - 0.5);
  mk("ellipse", { cx: hb[0], cy: hb[1], rx: 3.6 * C.S * 0.8, ry: 3.6 * C.S * 0.8 }, g);

  const cam = mk("g", {}, g);
  const parts = PARTS.map((p) => { const el = solid(cam); el.dt = mk("path", { class: "nf lo" }, el.g); return { ...p, el }; });
  const pit = spring(REST, { eps: 0.05 }), yaw = spring(PAN0, { eps: 0.05 });
  let swing = value, over = null, ly = NaN, lp = NaN, order = "";

  function draw(pan, tilt) {
    if (pan === ly && tilt === lp) return;
    ly = pan; lp = tilt;
    const R = turn(pan, tilt), at = (u, v, w) => { const q = R(u, v, w); return P(q[0], q[1], PZ + q[2]); };
    const see = (u, v, w) => { const q = R(u, v, w); return q[0] * 0.612 + q[1] * 0.612 + q[2] * 0.5; };   // > 0: that direction points toward the viewer
    const dir = (u, v, w) => see(u, v, w) > 0, face = (u, v, w) => see(u, v, w) > 0.12;
    for (const p of parts) {
      const m = p.ax ? (a, b, c) => at(c, a, LZ + b) : at;
      const fr = (q) => { const n = p.ax ? R(0, q.nu, q.nv) : R(q.nu, q.nv, 0); return n[0] * S + n[1] * K >= -1e-6; };
      const [ring, inner] = p.rg, [z0, z1] = p.z;
      const d = prism(m, fr, ring, p.ax ? null : inner, z0, z1);
      if (p.ax && inner && dir(1, 0, 0)) {
        d.crease = poly(ringAt(m, inner, z1));
        if (p.glass) {
          const gz = z1 - 0.6;
          d.crease += p.glass.map((r) => poly(ringAt(m, circ(r, 28), gz))).join("");
          d.crease += open(Array.from({ length: 7 }, (_, k) => { const t = rad(118 + k * 8); return m(4.4 * Math.cos(t), 4.4 * Math.sin(t), gz); }));   // a glint on the glass
        }
      }
      put(p.el, d);
      p.el.dt.setAttribute("d", p.det ? p.det({ at, m, fr, face }) : "");
      p.el.sil.classList.toggle("hi", !!p.hi);
      const q = R(...p.c);
      p.key = q[0] + q[1] + 0.8165 * q[2] + (p.bias || 0);
    }
    const sorted = parts.slice().sort((a, b) => a.key - b.key), sig = sorted.map((p) => parts.indexOf(p)).join();
    if (sig !== order) { order = sig; for (const p of sorted) cam.appendChild(p.el.g); }
  }

  const B = register(stage, (dt) => {
    const a = stepS(pit, dt), b = stepS(yaw, dt);
    draw(yaw.x, pit.x);
    return a || b;
  });
  bag.add(B.unregister);

  function retarget() {
    if (over === null) { pit.t = REST; yaw.t = PAN0; read.textContent = "rest"; B.wake(); return; }
    pit.t = REST + swing * (clamp((PY - over[1]) * GAIN, LO, HI) - REST);
    yaw.t = PAN0 - SWEEP * clamp((over[0] - PX - DX0) / (DX1 - DX0), 0, 1);       // left of the camera: facing left; to its right: turned toward us
    read.textContent = `pan ${Math.round(PAN0 - yaw.t)} tilt ${Math.round(pit.t)}`;
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = p; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { swing = v; if (over !== null) retarget(); },
    destroy: bag.dispose,
  };
}

export default {
  name: "camera",
  means: "A camera on a tripod, facing left, tilts its lens to the pointer's height and turns a little toward the viewer as the pointer moves right, then settles back when it leaves.",
  range: [0.5, 0.8, 1],
  tour: [[340, 20], [120, 130], [300, 236], null],
  mount,
}