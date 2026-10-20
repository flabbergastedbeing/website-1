// Position-based (Verlet) cloth, tuned to look like a lightweight fabric
// hanging from a rail in a soft indoor breeze.
//
// Why this reads as "natural" compared with a plain spring-mass sheet:
//  - Fixed 60 Hz timestep, so motion is identical on 60/120/144 Hz screens.
//  - Structural + shear + bend constraints. Shear stops the grid collapsing into
//    diamonds, bend keeps ripples soft instead of crinkly.
//  - Wind pushes through the surface normal (force ∝ n·(wind − velocity)), so a
//    sheet that already moves with the air is barely pushed, and edge-on parts
//    catch almost nothing. That is what makes real cloth settle and billow.
//  - The wind is a slow, low-amplitude field with a travelling ripple, not a
//    hard sine push on every vertex.

export const CLOTH_WIDTH = 3 // world units; height follows the image's aspect ratio

const STEP = 1 / 60
const MAX_STEPS = 3

export function createClothSim(segments = 30, aspect = 1) {
  const width = CLOTH_WIDTH
  const height = CLOTH_WIDTH / aspect
  const rowSegs = Math.max(2, Math.round(segments / aspect))
  const cols = segments + 1
  const rows = rowSegs + 1
  const n = cols * rows

  const pos = new Float32Array(n * 3)
  const prev = new Float32Array(n * 3)
  const normals = new Float32Array(n * 3)
  const dpos = new Float32Array(n * 3) // what is drawn: simulated sheet + the photo's folds
  const dnormals = new Float32Array(n * 3)
  const fold = new Float32Array(n) // per-vertex fold height (world units), filled in from the photo
  const pinned = new Uint8Array(n)

  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const i = v * cols + u
      pos[i * 3] = (u / segments - 0.5) * width
      pos[i * 3 + 1] = (0.5 - v / rowSegs) * height
      pos[i * 3 + 2] = 0
      if (v === 0) pinned[i] = 1 // the top edge is clipped to a rail
    }
  }
  prev.set(pos)

  const dx = width / segments
  const dy = height / rowSegs
  const groups = { structural: [], shear: [], bend: [] }
  const add = (g, a, b, rest) => groups[g].push([a, b, rest])

  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const i = v * cols + u
      if (u < cols - 1) add('structural', i, i + 1, dx)
      if (v < rows - 1) add('structural', i, i + cols, dy)
      if (u < cols - 1 && v < rows - 1) {
        const diag = Math.hypot(dx, dy)
        add('shear', i, i + cols + 1, diag)
        add('shear', i + 1, i + cols, diag)
      }
      if (u < cols - 2) add('bend', i, i + 2, dx * 2)
      if (v < rows - 2) add('bend', i, i + 2 * cols, dy * 2)
    }
  }

  const pack = (list, k) => ({
    a: Uint32Array.from(list.map((c) => c[0])),
    b: Uint32Array.from(list.map((c) => c[1])),
    rest: Float32Array.from(list.map((c) => c[2])),
    k,
  })

  const sim = {
    segments,
    rowSegs,
    width,
    height,
    cols,
    rows,
    n,
    pos,
    prev,
    normals,
    dpos,
    dnormals,
    fold,
    pinned,
    // stiffness per constraint family (1 = fully rigid per iteration)
    sets: [
      pack(groups.structural, 1.0),
      pack(groups.shear, 0.55),
      pack(groups.bend, 0.22),
    ],
    acc: 0,
    time: 0,
    elapsed: 0,
    damp: VERLET_DAMP,
  }
  computeNormals(sim)
  hangStill(sim)
  applyFolds(sim)
  return sim
}

// Let the cloth find its resting hang (gravity only, heavily damped) before the first
// frame is ever drawn, then wipe all velocity. Without this it starts perfectly flat,
// drops, stretches and bounces on screen.
function hangStill(sim) {
  sim.damp = 0.75
  for (let i = 0; i < 50; i++) substep(sim, 0, 0)
  sim.prev.set(sim.pos)
  sim.damp = VERLET_DAMP
  computeNormals(sim)
}

// Smooth vertex normals straight from the grid (central differences).
// Oriented so a flat, undisturbed cloth has normal (0, 0, 1).
export function computeNormals(sim, posArr = sim.pos, outNormals = sim.normals) {
  const { cols, rows } = sim
  const pos = posArr
  const normals = outNormals
  for (let v = 0; v < rows; v++) {
    const v0 = Math.max(v - 1, 0)
    const v1 = Math.min(v + 1, rows - 1)
    for (let u = 0; u < cols; u++) {
      const u0 = Math.max(u - 1, 0)
      const u1 = Math.min(u + 1, cols - 1)
      const i = v * cols + u
      const l = (v * cols + u0) * 3
      const r = (v * cols + u1) * 3
      const t = (v0 * cols + u) * 3
      const b = (v1 * cols + u) * 3
      // tangent along +u, and along +v (downwards)
      const ux = pos[r] - pos[l]
      const uy = pos[r + 1] - pos[l + 1]
      const uz = pos[r + 2] - pos[l + 2]
      const vx = pos[b] - pos[t]
      const vy = pos[b + 1] - pos[t + 1]
      const vz = pos[b + 2] - pos[t + 2]
      // n = v × u
      let nx = vy * uz - vz * uy
      let ny = vz * ux - vx * uz
      let nz = vx * uy - vy * ux
      const len = Math.hypot(nx, ny, nz) || 1
      normals[i * 3] = nx / len
      normals[i * 3 + 1] = ny / len
      normals[i * 3 + 2] = nz / len
    }
  }
}

// Push every vertex of the simulated sheet along its own (smooth) normal by its fold height, and
// compute the normals of the result. The sheet still moves in the wind exactly as before; the folds
// ride on it, so the creases you see are real geometry that catches the light as it moves.
export function applyFolds(sim) {
  const { pos, normals, dpos, fold, n } = sim
  for (let i = 0; i < n; i++) {
    const io = i * 3
    const h = fold[i]
    dpos[io] = pos[io] + normals[io] * h
    dpos[io + 1] = pos[io + 1] + normals[io + 1] * h
    dpos[io + 2] = pos[io + 2] + normals[io + 2] * h
  }
  computeNormals(sim, dpos, sim.dnormals)
}

// Tunables. Units: the cloth is 3 units wide, so ~1 unit ≈ 30 cm.
const GRAVITY = 9.0
const AIR_DRAG = 3.2 // how strongly the air grabs the surface
const VERLET_DAMP = 0.992
const RAMP_SECONDS = 7 // the breeze eases in over this long, so nothing snaps on at load
const ITERATIONS = 9
const WIND_Z = 2 // peak breeze speed: a lively but natural breeze, hem drifts ~25% of cloth width at its widest

// A gentle breeze: slow swell + a ripple that travels across and down the sheet.
function wind(out, x, y, t, strength, top, height) {
  // y runs from `top` (rail) down to `top − height` (free hem); the hem catches more air than the rail
  const free = Math.min(Math.max((top - y) / height, 0), 1)
  const swell =
    0.55 +
    0.28 * Math.sin(t * 0.52 + 0.4) +
    0.14 * Math.sin(t * 0.97 + 2.1) +
    0.06 * Math.sin(t * 1.71 + 0.9)
  const ripple =
    0.4 * Math.sin(1.35 * x - 0.8 * y - t * 1.05) +
    0.18 * Math.sin(2.7 * x + 1.4 * y - t * 1.7 + 1.3)
  const reach = 0.2 + 0.8 * free // the rail end barely feels it, the hem feels it fully
  const local = (swell + ripple * (0.35 + 0.65 * free)) * reach
  out[0] = strength * WIND_Z * 0.6 * Math.sin(t * 0.33 + y * 0.5 + x * 0.4) * free // slight sideways drift
  out[1] = 0
  out[2] = strength * WIND_Z * local
}

const w = [0, 0, 0]

function substep(sim, t, strength) {
  const { pos, prev, normals, pinned, n } = sim
  const dt = STEP
  const dt2 = dt * dt

  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue
    const io = i * 3
    const x = pos[io]
    const y = pos[io + 1]
    const z = pos[io + 2]
    const vx = (x - prev[io]) / dt
    const vy = (y - prev[io + 1]) / dt
    const vz = (z - prev[io + 2]) / dt

    wind(w, x, y, t, strength, sim.height / 2, sim.height)
    const nx = normals[io]
    const ny = normals[io + 1]
    const nz = normals[io + 2]
    // relative air speed through the surface, then force along the normal
    const through = nx * (w[0] - vx) + ny * (w[1] - vy) + nz * (w[2] - vz)
    const f = AIR_DRAG * through

    const ax = f * nx
    const ay = f * ny - GRAVITY
    const az = f * nz

    pos[io] = x + (x - prev[io]) * sim.damp + ax * dt2
    pos[io + 1] = y + (y - prev[io + 1]) * sim.damp + ay * dt2
    pos[io + 2] = z + (z - prev[io + 2]) * sim.damp + az * dt2
    prev[io] = x
    prev[io + 1] = y
    prev[io + 2] = z
  }

  for (let it = 0; it < ITERATIONS; it++) {
    for (let s = 0; s < sim.sets.length; s++) {
      const { a, b, rest, k } = sim.sets[s]
      for (let c = 0; c < rest.length; c++) {
        const ia = a[c]
        const ib = b[c]
        const pa = pinned[ia]
        const pb = pinned[ib]
        if (pa && pb) continue
        const ao = ia * 3
        const bo = ib * 3
        const dx = pos[bo] - pos[ao]
        const dy = pos[bo + 1] - pos[ao + 1]
        const dz = pos[bo + 2] - pos[ao + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
        const diff = ((dist - rest[c]) / dist) * k
        const wgt = pa || pb ? 1 : 0.5
        const mx = dx * diff * wgt
        const my = dy * diff * wgt
        const mz = dz * diff * wgt
        if (!pa) {
          pos[ao] += mx
          pos[ao + 1] += my
          pos[ao + 2] += mz
        }
        if (!pb) {
          pos[bo] -= mx
          pos[bo + 1] -= my
          pos[bo + 2] -= mz
        }
      }
    }
  }
  computeNormals(sim)
}

/**
 * Advance the sim by a real-time delta (seconds).
 * @param speed    time multiplier for the breeze pattern (1 = calm default)
 * @param strength breeze strength multiplier (1 = calm default)
 */
export function stepCloth(sim, delta, speed = 1, strength = 1) {
  sim.acc += Math.min(delta, 0.1)
  let steps = 0
  while (sim.acc >= STEP && steps < MAX_STEPS) {
    sim.time += STEP * speed
    sim.elapsed += STEP
    const k = Math.min(sim.elapsed / RAMP_SECONDS, 1)
    const ramp = k * k * (3 - 2 * k) // smoothstep: starts and ends with zero slope
    substep(sim, sim.time, strength * ramp)
    sim.acc -= STEP
    steps++
  }
  if (steps === MAX_STEPS) sim.acc = 0 // drop backlog after a long stall
}

// Soft studio-style shading baked into vertex colours (multiplies the texture).
// A flat, undisturbed cloth returns exactly 1.0 for ANY light direction, so the logo
// looks like the artwork at rest and only picks up light/shadow as folds travel through it.
export const BASE_LIGHT = (() => {
  const v = [-0.42, 0.62, 0.66]
  const m = Math.hypot(...v)
  return v.map((c) => c / m)
})()

// Slowly drifting key light (unit vector, written into `out`). Period ~ 40-60 s, small sweep,
// so it reads as the room's light shifting, never as a spotlight swinging about.
export function driftLight(out, t) {
  const az = Math.sin(t * 0.13) * 0.55 + Math.sin(t * 0.071 + 1.3) * 0.25
  const el = Math.sin(t * 0.09 + 0.7) * 0.18
  const x = BASE_LIGHT[0] + az
  const y = BASE_LIGHT[1] + el
  const z = BASE_LIGHT[2]
  const m = Math.hypot(x, y, z)
  out[0] = x / m
  out[1] = y / m
  out[2] = z / m
  return out
}

export function writeShading(sim, colors, amount = 1.35, light = BASE_LIGHT) {
  const normals = sim.dnormals
  const { n } = sim
  const restDot = light[2] // dot of the flat-cloth normal (0,0,1) with the light
  for (let i = 0; i < n; i++) {
    const io = i * 3
    let nx = normals[io]
    let ny = normals[io + 1]
    let nz = normals[io + 2]
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz } // always shade the face we see
    const d = nx * light[0] + ny * light[1] + nz * light[2]
    let s = 1 + (d - restDot) * amount
    s = Math.min(Math.max(s, 0.58), 1.22)
    colors[io] = s
    colors[io + 1] = s
    colors[io + 2] = s
  }
}