/**
 * Illustrations for the red wipe panel: one restrained still life per section, drawn as technical line art.
 * One hairline weight, a little fine hatching for depth, almost no solid black. Parts that sit in front are filled with the
 * panel's own red so they hide what is behind them. Objects only: no characters, no sparkles, no emoji-style details.
 * Everything is original and built from the small drawing helpers below. Output is plain SVG markup.
 */
const RED = '#FF0800', INK = '#000'
let uid = 0
const f = (n) => Math.round(n * 10) / 10

/* ------------------------------------------------------------------ drawing kit -------------------------------- */
const P = (d, fill = RED, x = '') => `<path d="${d}" fill="${fill}"${x}/>`           // a filled shape (red = hides what is behind)
const L = (d, x = '') => `<path d="${d}" fill="none"${x}/>`                           // an open line
const O = (cx, cy, rx, ry = rx, fill = RED, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${x}/>`
const R = (x, y, w, h, r = 0, fill = RED, x2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${x2}/>`
const fine = ' stroke-width=".8"'
const hair = ' stroke-width=".6"'
const thick = (w) => ` stroke-width="${w}"`
// parallel hatching inside a shape: angle a, spacing gap
const hatch = (d, a = 50, gap = 6, w = 0.6) => {
  const id = 'hc' + ++uid
  let m = ''
  for (let y = -400; y <= 400; y += gap) m += `M-400,${y}H400`
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${m}" transform="rotate(${a})" fill="none" stroke-width="${w}"/></g>`
}
const rectPath = (x, y, w, h) => `M${x},${y}H${x + w}V${y + h}H${x}Z`

/* ------------------------------------------------------------------ objects (origin = bottom centre, up is negative) */
const OBJ = {
  /* ---------- a single quiet accent, used sparingly ---------- */
  dot: () => O(0, 0, 4, 4, INK, ' stroke="none"'),
  ring: () => O(0, 0, 6, 6, 'none', fine),
  cross: () => L('M-6,0H6M0,-6V6', fine),
  rule: () => L('M-60,0H60', hair),

  /* ---------- camera, lenses, light ---------- */
  camera: () => {
    const body = 'M-118,-92Q-118,-102 -108,-102H-52L-40,-126H40L52,-102H108Q118,-102 118,-92V-10Q118,0 108,0H-108Q-118,0 -118,-10Z'
    let ticks = ''
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ticks += `M${f(Math.cos(a) * 41)},${f(-54 + Math.sin(a) * 41)}L${f(Math.cos(a) * 45)},${f(-54 + Math.sin(a) * 45)}` }
    return P(body)
      + hatch('M70,-102H108Q118,-102 118,-92V-10Q118,0 108,0H70Z', 62, 5)
      + P('M-24,-126V-134H24V-126Z') + R(-14, -112, 28, 6, 1, 'none', fine)
      + R(-106, -88, 34, 22, 3, 'none', fine) + O(96, -90, 6, 3, 'none', fine)
      + L('M-118,-70H-84M118,-70H84', hair)
      + O(0, -54, 58, 58) + O(0, -54, 52, 52, 'none', fine) + L(ticks, hair)
      + O(0, -54, 38, 38, 'none', fine) + O(0, -54, 30, 30, INK) + O(0, -54, 22, 22, 'none', ' stroke="' + RED + '" stroke-width=".8"')
      + O(0, -54, 12, 12, 'none', ' stroke="' + RED + '" stroke-width=".8"')
      + L('M-20,-70C-14,-78 -6,-82 2,-82', ' stroke="' + RED + '" stroke-width="1.4"')
  },
  lens: () => {
    let rings = ''
    for (let i = 0; i < 14; i++) rings += `M${-54 + i * 5},-98V-14`
    return P('M-70,-100H70V-12H-70Z', RED) + L(rings, hair)
      + P('M-70,-100H70V-84H-70Z') + P('M-70,-26H70V-12H-70Z') + L('M-70,-56H70', hair)
      + P('M70,-104H84V-8H70Z') + P('M-84,-96H-70V-16H-84Z')
      + O(84, -56, 6, 48, 'none', fine)
      + R(-44, -76, 60, 14, 2, 'none', fine) + L('M-36,-76V-62M-26,-76V-62M-16,-76V-62M-6,-76V-62M4,-76V-62', hair)
  },
  tripod: () => {
    return L('M0,-250V-60', thick(1.2)) + R(-10, -270, 20, 22, 2) + R(-34, -290, 68, 22, 3) + L('M-34,-279H34', hair)
      + L('M0,-60L-70,0M0,-60L70,0M0,-60V0', thick(1.2)) + L('M-26,-24L-52,0M26,-24L52,0', hair)
      + R(-6, -68, 12, 16, 2) + L('M18,-262H62', thick(1.2)) + R(60, -272, 14, 20, 2, INK, ' stroke="none"')
  },
  softbox: () => {
    const front = pts([-92, -170], [92, -170], [112, -40], [-112, -40])
    return L('M0,-40V0M-40,0H40M0,-6L-38,0M0,-6L38,0', thick(1.2))
      + P(front) + hatch(front, 54, 7)
      + P(pts([-82, -162], [82, -162], [100, -48], [-100, -48]), RED, hair) + L('M-60,-162L-76,-48M-20,-162L-26,-48M20,-162L26,-48M60,-162L76,-48', hair)
      + R(-20, -186, 40, 16, 2)
  },
  clapper: () => {
    const stripes = (x0, y0, w, h) => { let s = ''; for (let i = 0; x0 + i * 32 < x0 + w; i++) { const x = x0 + i * 32; s += P(`M${x},${y0 + h}L${x + 12},${y0 + h}L${Math.min(x + 12 + h * 0.7, x0 + w)},${y0}L${Math.min(x + h * 0.7, x0 + w)},${y0}Z`, INK, ' stroke="none"') } return s }
    let grid = ''
    for (let i = 0; i < 3; i++) grid += `M-96,${-70 + i * 24}H96`
    return P('M-100,-88H100V0H-100Z') + L(grid + 'M-30,-88V0M40,-88V0', hair) + L('M-84,-76H-44M-84,-52H-60M-20,-76H20M50,-76H86', fine)
      + P('M-100,-114H100V-88H-100Z') + stripes(-100, -114, 200, 26) + L('M-100,-114H100V-88H-100Z', fine)
      + `<g transform="rotate(-11 -100 -118)">${P('M-102,-142H100V-118H-102Z')}${stripes(-102, -142, 202, 24)}${L('M-102,-142H100V-118H-102Z', fine)}</g>` + O(-100, -116, 4, 4, INK, ' stroke="none"')
  },
  laptop: () => {
    return P('M-126,-24H126L142,-4Q142,0 136,0H-136Q-142,0 -142,-4Z') + L('M-22,-24H22', hair) + hatch('M-126,-24H126L142,-4Q142,0 136,0H-136Q-142,0 -142,-4Z', 20, 6)
      + R(-108, -158, 216, 134, 4) + R(-100, -150, 200, 118, 1, 'none', hair)
      + R(-90, -140, 40, 98, 0, INK, ' stroke="none"') + L('M-84,-128H-56M-84,-118H-62M-84,-108H-58', ' stroke="' + RED + '" stroke-width=".7"')
      + R(-40, -140, 130, 70, 0, 'none', fine) + L('M-40,-70L-12,-104L8,-84L30,-110L58,-70', fine) + O(70, -122, 6, 6, 'none', fine)
      + L('M-40,-58H80M-40,-48H56M-40,-38H70', hair)
  },
  /* ---------- craft ---------- */
  pencil: () => {
    return P('M-9,-250L0,-256L9,-250V-44H-9Z') + L('M0,-256V-44', hair) + hatch('M0,-256L9,-250V-44H0Z', 70, 4)
      + P('M-9,-44L0,0L9,-44Z') + P('M-3.5,-14L0,0L3.5,-14Z', INK, ' stroke="none"')
      + P('M-9,-262V-250L0,-256V-268Z') + P('M-9,-262L0,-268L9,-262V-250L0,-256Z') + L('M-9,-80V-250M9,-80V-250', ' stroke-width=".5"')
  },
  palette: () => {
    const d = 'M-100,-58C-116,-122 -20,-150 62,-122C122,-100 128,-30 72,-14C42,-6 40,-34 12,-28C-30,-18 -84,-8 -100,-58Z'
    return P(d) + hatch('M62,-122C122,-100 128,-30 72,-14C42,-6 40,-34 12,-28L22,-104Z', 60, 5) + O(-20, -36, 9, 6, 'none', fine)
      + [[-76, -80], [-44, -106], [-2, -116], [38, -108], [-80, -46]].map(([x, y]) => O(x, y, 8, 7, 'none', fine)).join('') + O(-2, -116, 5, 4.5, INK, ' stroke="none"') + O(-80, -46, 5, 4.5, INK, ' stroke="none"')
  },
  headphones: () => {
    const cup = (s) => P(`M${s * 100},-70C${s * 100},-90 ${s * 64},-90 ${s * 64},-70V-12C${s * 64},8 ${s * 100},8 ${s * 100},-12Z`) + hatch(`M${s * 100},-70C${s * 100},-90 ${s * 64},-90 ${s * 64},-70V-12C${s * 64},8 ${s * 100},8 ${s * 100},-12Z`, 64, 5) + P(`M${s * 62},-74C${s * 50},-80 ${s * 44},-60 ${s * 44},-42C${s * 44},-24 ${s * 50},-4 ${s * 62},-10Z`, INK, ' stroke="none"')
    return L('M-72,-36C-86,-180 86,-180 72,-36', thick(12)) + L('M-72,-36C-86,-180 86,-180 72,-36', ' stroke="' + RED + '" stroke-width="9.6"') + cup(-1) + cup(1)
  },
  /* ---------- results ---------- */
  chart: () => {
    let o = R(-140, -200, 280, 200, 4) + L('M-140,-176H140', hair) + O(-128, -188, 3, 3, INK, ' stroke="none"') + O(-116, -188, 3, 3, 'none', hair) + O(-104, -188, 3, 3, 'none', hair)
    for (let i = 0; i < 4; i++) o += L(`M-112,${-150 + i * 30}H120`, ' stroke-dasharray="2 4" stroke-width=".5"')
    const bars = [[-100, 36], [-58, 56], [-16, 50], [26, 84], [68, 116]]
    bars.forEach(([x, h], i) => { const d = `M${x},-26V${-26 - h}H${x + 30}V-26Z`; o += i === 4 ? P(d, INK) : P(d) + hatch(d, 58, 5) })
    const tops = bars.map(([x, h]) => [x + 15, -26 - h - 14])
    o += L('M' + tops.map((p) => p.join(',')).join('L'), thick(1.2)) + L(`M-112,-26H120M-112,-26V-156`, thick(1))
    tops.slice(0, 4).forEach((p) => { o += O(p[0], p[1], 3.5, 3.5) })
    return o
  },
  trophy: () => {
    const cup = 'M-56,-200H56C56,-138 34,-104 0,-104C-34,-104 -56,-138 -56,-200Z'
    return L('M-54,-188C-92,-188 -88,-134 -42,-124M54,-188C92,-188 88,-134 42,-124', thick(9)) + L('M-54,-188C-92,-188 -88,-134 -42,-124M54,-188C92,-188 88,-134 42,-124', ' stroke="' + RED + '" stroke-width="6.8"')
      + P(cup) + hatch(cup, 66, 5) + O(0, -200, 56, 7) + L('M-46,-172C-44,-150 -32,-128 -14,-118', ' stroke="' + RED + '" stroke-width="1.6"')
      + P('M-8,-104H8L11,-66H-11Z') + P('M-26,-66H26L30,-50H-30Z', INK, ' stroke="none"') + P('M-44,-50H44V-24H-44Z') + hatch('M-44,-50H44V-24H-44Z', 60, 5) + P('M-60,-24H60V0H-60Z', INK, ' stroke="none"')
  },
  phone: () => {
    return R(-58, -212, 116, 212, 14) + R(-50, -194, 100, 174, 2, 'none', hair) + R(-14, -204, 28, 5, 2.5, INK, ' stroke="none"')
      + O(-34, -168, 8, 8, 'none', fine) + L('M-20,-172H30M-20,-164H12', hair)
      + R(-40, -142, 80, 46, 2, 'none', fine) + L('M-40,-96L-16,-120L0,-106L18,-126L40,-96', fine)
      + L('M-40,-78H40M-40,-68H26', hair)
      + [[-32, 22], [-12, 34], [8, 16], [28, 40]].map(([x, h]) => L(`M${x},-30V${-30 - h}`, thick(4))).join('')
  },
  rosette: () => {
    const Rr = 60, N = 36
    let d = ''
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, r = i % 2 ? Rr - 5 : Rr; d += (i ? 'L' : 'M') + `${f(r * Math.cos(a))},${f(-100 + r * Math.sin(a))}` }
    return P('M-30,-60L-52,0L-34,-8L-22,8L-4,-52Z') + hatch('M-30,-60L-52,0L-34,-8L-22,8L-4,-52Z', 60, 4) + P('M30,-60L52,0L34,-8L22,8L4,-52Z', INK, ' stroke="none"')
      + P(d + 'Z') + O(0, -100, 46, 46) + O(0, -100, 40, 40, 'none', hair) + O(0, -100, 14, 14, INK, ' stroke="none"')
  },
  /* ---------- start ---------- */
  rocket: () => {
    const body = 'M0,-318C46,-262 52,-186 38,-112H-38C-52,-186 -46,-262 0,-318Z'
    return P('M-22,-112C-28,-70 -2,-36 0,-8C2,-36 28,-70 22,-112Z', INK, ' stroke="none"')
      + P('M-38,-170L-80,-116L-76,-62L-38,-110Z') + hatch('M-38,-170L-80,-116L-76,-62L-38,-110Z', 62, 5) + P('M38,-170L80,-116L76,-62L38,-110Z', INK, ' stroke="none"')
      + P(body) + hatch('M10,-300C44,-256 52,-186 38,-112H8Z', 66, 5) + L('M-39,-142H39', hair)
      + O(0, -204, 22, 22) + O(0, -204, 16, 16, 'none', fine) + O(0, -204, 10, 10, INK, ' stroke="none"')
  },
  envelope: () => P('M-96,-118H96V0H-96Z') + hatch('M-96,0L-96,-118L0,-52L96,-118V0Z', 56, 6) + P('M-96,-118L0,-50L96,-118Z') + L('M-96,0L-34,-58M96,0L34,-58', fine) + O(0, -50, 8, 8, INK, ' stroke="none"'),
  plane: () => P('M-110,-70L120,-120L-6,-30Z') + hatch('M-110,-70L120,-120L-6,-30Z', 40, 6) + P('M-6,-30L120,-120L-2,-8Z', INK, ' stroke="none"') + L('M-6,-30L-2,-8M-6,-30L-40,-62', fine)
    + L('M-120,-56C-160,-40 -150,-8 -190,6C-210,12 -220,0 -236,6', ' stroke-dasharray="2 5" stroke-width=".8"'),
  chat: () => P('M-48,-210H48Q60,-210 60,-198V-14Q60,0 46,0H-46Q-60,0 -60,-14V-198Q-60,-210 -48,-210Z') + R(-50, -192, 100, 170, 2, 'none', hair) + R(-14, -202, 28, 5, 2.5, INK, ' stroke="none"')
    + R(-40, -170, 54, 22, 4, 'none', fine) + L('M-34,-162H4M-34,-155H-10', hair)
    + R(-6, -134, 46, 22, 4, INK, ' stroke="none"') + L('M0,-126H32M0,-119H18', ' stroke="' + RED + '" stroke-width=".8"')
    + R(-40, -98, 54, 22, 4, 'none', fine) + L('M-34,-90H4M-34,-83H-10', hair),
  book: () => {
    const one = (x, y, w, h, ink) => {
      const d = rectPath(x, y - h, w, h)
      let s = P(d, ink ? INK : RED)
      if (!ink) s += L(`M${x + 6},${y - h * 0.3}H${x + w - 6}M${x + 6},${y - h * 0.7}H${x + w - 6}`, hair) + hatch(d, 20, 6)
      return s
    }
    return one(-120, 0, 240, 22, false) + one(-104, -22, 212, 18, true) + one(-114, -40, 226, 24, false) + one(-96, -64, 196, 16, true)
  },
  gradcap: () => {
    const board = 'M0,-86L104,-60L0,-34L-104,-60Z', edge = 'M-104,-60L0,-34V-26L-104,-52Z', edge2 = 'M104,-60L0,-34V-26L104,-52Z'
    return P('M-50,-50V-20C-50,-2 50,-2 50,-20V-50Z') + hatch('M-50,-50V-20C-50,-2 50,-2 50,-20V-50Z', 62, 5)
      + P(edge, INK, ' stroke="none"') + P(edge2, INK, ' stroke="none"') + P(board) + hatch(board, 38, 7)
      + O(0, -60, 5, 2.5, INK, ' stroke="none"') + L('M0,-60L92,-58V-18', fine) + P('M88,-18H96L97,-4H87Z', INK, ' stroke="none"')
  },
  cup: () => {
    const body = 'M-44,-110H44L36,-6H-36Z'
    return P(body) + hatch(body, 62, 5) + P('M-41,-92H41L38,-54H-38Z', INK, ' stroke="none"') + L('M-39,-80H39', ' stroke="' + RED + '" stroke-width=".6"')
      + P('M-50,-110H50L48,-122H-48Z') + P('M-42,-122C-42,-140 42,-140 42,-122Z') + L('M-30,-130H30', hair)
  },
  glassbottle: () => {
    const body = 'M-26,-150C-26,-170 -12,-176 -12,-196V-232H12V-196C12,-176 26,-170 26,-150V0H-26Z'
    return P(body) + hatch('M26,-150C26,-170 12,-176 12,-196V-232H8V-196C8,-176 22,-170 22,-150V0H26Z', 60, 4) + P('M-14,-232H14V-246H-14Z', INK, ' stroke="none"') + P('M-26,-120H26V-52H-26Z', INK, ' stroke="none"') + L('M-26,-104H26M-26,-68H26', ' stroke="' + RED + '" stroke-width=".6"')
  },
  bag: () => {
    const body = 'M-64,-100H64L72,0H-72Z'
    return L('M-30,-100C-30,-168 30,-168 30,-100', thick(5)) + L('M-30,-100C-30,-168 30,-168 30,-100', ' stroke="' + RED + '" stroke-width="2.8"')
      + P(body) + hatch(body, 66, 6) + L('M-64,-82H64', hair) + O(0, -50, 8, 8, 'none', fine)
  },
  sprout: () => {
    const leaf = (rot, len) => `<g transform="rotate(${rot})">${P(`M0,0C${len * 0.26},${-len * 0.34} ${len * 0.9},${-len * 0.28} ${len},${-len * 0.04}C${len * 0.7},${len * 0.36} ${len * 0.22},${len * 0.28} 0,0Z`)}${L(`M0,0C${len * 0.4},${-len * 0.04} ${len * 0.7},${-len * 0.06} ${len * 0.94},${-len * 0.04}`, hair)}</g>`
    const pot = 'M-48,-70L-38,0H38L48,-70Z'
    return L('M0,-80C-4,-116 6,-146 0,-170', thick(2.4)) + `<g transform="translate(0,-130)">${leaf(-26, 96)}${leaf(206, 96)}</g>` + `<g transform="translate(0,-170)">${leaf(-84, 68)}</g>`
      + P(pot) + hatch(pot, 66, 5) + R(-54, -86, 108, 16, 2)
  },
}

function pts(...q) { return 'M' + q.map((p) => `${f(p[0])},${f(p[1])}`).join('L') + 'Z' }

/* ------------------------------------------------------------------ the scenes ----------------------------------- */
// [object, x, y (bottom centre), scale, rotation]; drawn in this order, so later pieces overlap earlier ones.
// Few pieces, generous gaps, one baseline: the panel's bottom edge crops them like a row of objects on a shelf.
const SCENES = {
  // Specialisation: education, cafe, lifestyle
  specialisation: [
    ['book', 230, 474, 1.15], ['gradcap', 230, 400, 1.0, -3], ['pencil', 470, 478, 1.0, 10],
    ['cup', 760, 478, 1.5], ['glassbottle', 940, 478, 1.15],
    ['bag', 1200, 478, 1.35], ['book', 1470, 478, 0.8],
    ['dot', 620, 220, 1], ['ring', 1380, 210, 1.6],
  ],
    // Results & reviews: growth, awards, a phone showing the reach
  numbers: [
    ['chart', 300, 478, 1.35],
    ['trophy', 800, 480, 1.4],
    ['phone', 1130, 480, 1.25, 3],
    ['rosette', 1400, 480, 1.1],
    ['dot', 560, 200, 1], ['ring', 1530, 190, 1.6],
  ],
  // About us: the team's tools
  about: [
    ['tripod', 160, 482, 1.2],
    ['camera', 430, 482, 1.3], ['lens', 700, 482, 1.1],
    ['clapper', 940, 482, 1.1], ['laptop', 1240, 482, 1.2],
    ['ring', 1540, 210, 1.6], ['dot', 820, 190, 1],
  ],
  // Get started: say hello, launch
  start: [
    
    ['sprout', 560, 482, 1.3],
    ['rocket', 820, 500, 1.0],
    ['envelope', 1080, 482, 1.15],
    ['chat', 1360, 484, 1.15, 3],
    ['plane', 200, 300, 1.0, -8], ['dot', 1000, 140, 1], ['ring', 1540, 190, 1.6],
  ],
}

/** One scene, as an SVG that fills the panel's width and is cropped by its bottom edge. */
export function scene(id, W = 1600, H = 440) {
  uid = 0
  let body = ''
  for (const [name, x, y, s = 1, rot = 0] of SCENES[id]) {
    body += `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">${OBJ[name]()}</g>`
  }
  const n = id.length   // keep each scene's hatch ids apart from the others in the page
  return `<svg class="art art-${id}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${body.replace(/hc(\d+)/g, `hc${id[0]}${n}-$1`)}</svg>`
}
export const SCENE_IDS = Object.keys(SCENES)