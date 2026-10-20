import HL from '../camera/kernel.js'
import { arc, ell, frus, line, loop, shape } from './engine.js'

const { circ, prism, rings } = HL

/** Education: a stack of three books, each turned a little off the one below. [width, depth, thickness, dx, dy, yaw, z] */
const BOOKS = [[46, 32, 7, 0, 0, 0, 0], [40, 29, 6, 2, -1.5, 9, 7], [33, 24, 5, -1.5, 1, -11, 13]]
export const books = {
  label: 'a stack of three books',
  H: 18, R: 29,
  parts: BOOKS.map(([a, b, t, dx, dy, yaw, z]) => ({
    c: [dx, dy, z + t / 2], bias: z * 2,          // a stack paints bottom to top, whatever the offsets
    draw: (K) => {
      const k = K.sub(dx, dy, yaw), [ring, inner] = rings(-a / 2, -b / 2, a / 2, b / 2, 1.4, 1.1), p = prism(k.at, k.front, ring, inner, z, z + t)
      const label = rings(-a * 0.26, -b * 0.2, a * 0.26, b * 0.2, 1, 0.6)[0]
      return {
        sil: p.sil, cr: p.crease,
        dt: arc(k, ring, z + 1) + arc(k, ring, z + t - 1) + arc(k, ring, z + t / 2)                 // the page block between the covers
          + (k.face(-1, 0, 0) ? [-1, 1].map((s) => line(k, [[-a / 2, s * b * 0.22, z + 0.4], [-a / 2, s * b * 0.22, z + t - 0.4]])).join('') : '')   // spine ribs
          + loop(k, label, z + t),                                                                  // title block
      }
    },
  })),
}

/** Cafe: a cup on a saucer, handle to the right, steam over the coffee. */
const steam = (k, v, ph) => line(k, Array.from({ length: 9 }, (_, i) => [2.2 * Math.sin(i * 0.9 + ph), v, 25 + i * 1.7]))
const half = (rx, ry, c) => Array.from({ length: 9 }, (_, i) => { const t = (1.5708 - (i * 3.1416) / 8); return [0, -(c + rx * Math.cos(t)), 13 + ry * Math.sin(t)] })
export const cup = {
  label: 'a coffee cup on a saucer',
  H: 40, R: 30,
  parts: [
    { c: [0, 0, 1.6], draw: (k) => ({ sil: frus(k, circ(17, 40), 0, circ(28, 40), 3.2), dt: loop(k, circ(26.4, 40), 3.2) + loop(k, circ(15, 36), 3) }) },
    { c: [0, 0, 13], hi: 1, draw: (k) => ({
      sil: frus(k, circ(11, 36), 3, circ(15.5, 36), 22),
      dt: arc(k, circ(11.6, 36), 4.8) + loop(k, circ(14.4, 36), 22) + loop(k, circ(13, 36), 21.2),   // foot ring, lip, coffee
    }) },
    { c: [0, -18, 13], draw: (k) => ({ sil: shape(k, half(8.6, 6, 12.4).concat(half(5, 3.2, 12.4).reverse())) }) },   // handle: a flat C-shaped band
    { c: [0, 0, 32], bias: 99, cls: 'steam', draw: (k) => ({ dt: steam(k, -3, 0) + steam(k, 3, 2.4) }) },
  ],
}

/** Lifestyle: a dress on a form, built from a profile turned round the vertical: [height, half-width]. Its depth is 55% of its width. */
const PROFILE = [[0, 27], [5, 26], [14, 22], [26, 15.5], [36, 10.5], [42, 8.2], [47, 9.4], [54, 10.2], [61, 9], [66, 8]]
const RINGS = PROFILE.map(([, r]) => ell(0.55 * r, r))
const PLEATS = [-70, -35, 0, 35, 70].map((d) => (d * Math.PI) / 180)
export const dress = {
  label: 'a sleeveless dress with a bow at the waist',
  H: 76, R: 28,
  parts: PROFILE.slice(0, -1).map(([z0, r0], i) => {
    const [z1, r1] = PROFILE[i + 1]
    return {
      c: [0, 0, (z0 + z1) / 2],
      draw: (k) => ({
        sil: frus(k, RINGS[i], z0, RINGS[i + 1], z1),
        dt: (i ? arc(k, RINGS[i], z0) : arc(k, RINGS[0], 3))                                            // seams, and a hem fold
          + (i < 5 ? PLEATS.map((t) => (k.face(Math.cos(t), 0.55 * Math.sin(t), 0)
            ? line(k, [[0.55 * r0 * Math.cos(t), r0 * Math.sin(t), z0], [0.55 * r1 * Math.cos(t), r1 * Math.sin(t), z1]]) : '')).join('') : '')   // skirt pleats
          + (i === 8 ? loop(k, RINGS[9], 66) + (k.face(1, 0, 0) ? line(k, [[3.8, -4.2, 65.7], [5.45, 0, 57], [3.8, 4.2, 65.7]]) : '') : ''),     // neckline
      }),
    }
  }).concat([
    { c: [0, 0, 42.2], bias: 3.5, hi: 1, draw: (k) => ({                                               // belt and bow
      sil: frus(k, ell(4.6, 8.4), 40.8, ell(4.6, 8.4), 43.5),
      dt: k.face(1, 0, 0) ? shape(k, [[4.8, 0, 42.2], [5.2, -6.5, 46], [5.2, -6.5, 38.4]]) + shape(k, [[4.8, 0, 42.2], [5.2, 6.5, 46], [5.2, 6.5, 38.4]]) + shape(k, [[5.2, -1.2, 43.6], [5.2, 1.2, 43.6], [5.2, 1.2, 40.8], [5.2, -1.2, 40.8]]) : '',
    }) },
    ...[-1, 1].map((s) => ({ c: [0, s * 3, 70], draw: (k) => ({ sil: shape(k, [[3.6, s * 4.9, 66.3], [3.6, s * 3.3, 66.3], [0.4, s * 0.6, 75.5], [0.4, s * 1.8, 75.5]]) }) })),   // straps
  ]),
}