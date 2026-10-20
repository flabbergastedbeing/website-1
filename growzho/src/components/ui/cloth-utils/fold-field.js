// Reads the creases painted into the cloth photo and turns them into a height field, so the
// 3D cloth can have the SAME folds as the picture (instead of a flat sheet wearing a photo of folds).
//
// Idea: in the photo the cloth is lit from the upper left, so the bright bands are fold crests and
// the dark bands are troughs. We read the red channel (the logo is white, so it is masked out and
// filled from its surroundings), blur it to the scale of the mesh, and normalise it.
// Returns one number per mesh vertex: ~ -2 (trough) .. +2 (crest), standard deviation ~1.

export function buildFoldField(image, segments, rowSegs) {
  const cols = segments + 1
  const rows = rowSegs + 1
  const zeros = new Float32Array(cols * rows)
  try {
    const iw = image.naturalWidth || image.width
    const ih = image.naturalHeight || image.height
    if (!iw || !ih) return zeros
    const W = 192
    const H = Math.max(8, Math.round((W * ih) / iw))
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data

    const N = W * H
    let val = new Float32Array(N)
    let ok = new Uint8Array(N) // 1 = a real piece of red cloth we can read a fold from
    const inCloth = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3]
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const white = mx > 120 && (mx - mn) / mx < 0.4 // the logo lettering
      inCloth[i] = a > 200 ? 1 : 0
      ok[i] = a > 200 && !white ? 1 : 0
      val[i] = r
    }

    // fill everything we cannot read (logo, backdrop) from the nearest readable pixels
    for (let pass = 0; pass < 80; pass++) {
      let left = 0
      const nv = val.slice()
      const nk = ok.slice()
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x
          if (ok[i]) continue
          let s = 0, c = 0
          for (let dy = -2; dy <= 2; dy++) {
            const yy = y + dy
            if (yy < 0 || yy >= H) continue
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx
              if (xx < 0 || xx >= W) continue
              const j = yy * W + xx
              if (ok[j]) { s += val[j]; c++ }
            }
          }
          if (c) { nv[i] = s / c; nk[i] = 1 } else left++
        }
      }
      val = nv
      ok = nk
      if (!left) break
    }

    // blur to roughly the size of a mesh cell, twice (soft, no mesh-scale noise)
    const radius = Math.max(1, Math.round((W / segments) * 0.9))
    const tmp = new Float32Array(N)
    const blurH = (src, dst) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let s = 0, c = 0
          for (let k = -radius; k <= radius; k++) {
            const xx = x + k
            if (xx < 0 || xx >= W) continue
            s += src[y * W + xx]; c++
          }
          dst[y * W + x] = s / c
        }
      }
    }
    const blurV = (src, dst) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let s = 0, c = 0
          for (let k = -radius; k <= radius; k++) {
            const yy = y + k
            if (yy < 0 || yy >= H) continue
            s += src[yy * W + x]; c++
          }
          dst[y * W + x] = s / c
        }
      }
    }
    for (let rep = 0; rep < 2; rep++) {
      blurH(val, tmp)
      blurV(tmp, val)
    }

    // normalise using only the cloth itself
    let sum = 0, cnt = 0
    for (let i = 0; i < N; i++) if (inCloth[i]) { sum += val[i]; cnt++ }
    const mean = sum / Math.max(cnt, 1)
    let vs = 0
    for (let i = 0; i < N; i++) if (inCloth[i]) vs += (val[i] - mean) ** 2
    const std = Math.sqrt(vs / Math.max(cnt, 1)) || 1

    const out = new Float32Array(cols * rows)
    for (let v = 0; v < rows; v++) {
      const fy = Math.min((v / rowSegs) * (H - 1), H - 1)
      const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, H - 1), ty = fy - y0
      for (let u = 0; u < cols; u++) {
        const fx = Math.min((u / segments) * (W - 1), W - 1)
        const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, W - 1), tx = fx - x0
        const a = val[y0 * W + x0] * (1 - tx) + val[y0 * W + x1] * tx
        const b = val[y1 * W + x0] * (1 - tx) + val[y1 * W + x1] * tx
        const h = ((a * (1 - ty) + b * ty) - mean) / std
        out[v * cols + u] = Math.max(-2.2, Math.min(2.2, h))
      }
    }
    return out
  } catch {
    return zeros // canvas unavailable: simply no extra folds
  }
}