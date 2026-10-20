import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { buildFoldField } from './cloth-utils/fold-field.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import {
  CLOTH_WIDTH,
  createClothSim,
  applyFolds,
  driftLight,
  stepCloth,
  writeShading,
} from './cloth-utils/cloth-sim.js'

// The mesh covers the whole photo, so it sits on the page exactly where the old <img> did.
// The canvas is BLEED larger than the photo on every side so the cloth can drift toward the
// lens without being clipped; the camera is framed to match.
const FOV = 26
const BLEED = 0.08
const cameraZ = (aspect) =>
  ((CLOTH_WIDTH / aspect) * (1 + 2 * BLEED)) / (2 * Math.tan((FOV * Math.PI) / 360))

function buildGeometry(sim) {
  const { segments, rowSegs, cols, rows, n } = sim
  const geo = new THREE.BufferGeometry()

  const position = new THREE.BufferAttribute(sim.dpos, 3)
  position.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', position)

  const colors = new Float32Array(n * 3)
  writeShading(sim, colors)
  const color = new THREE.BufferAttribute(colors, 3)
  color.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('color', color)

  const normal = new THREE.BufferAttribute(sim.dnormals, 3)
  normal.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('normal', normal)

  const uv = new Float32Array(n * 2)
  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const i = v * cols + u
      uv[i * 2] = u / segments
      uv[i * 2 + 1] = 1 - v / rowSegs
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  const index = new Uint16Array(segments * rowSegs * 6)
  let o = 0
  for (let v = 0; v < rowSegs; v++) {
    for (let u = 0; u < segments; u++) {
      const a = v * cols + u
      const b = a + 1
      const c = a + cols
      const d = c + 1
      index[o++] = a; index[o++] = c; index[o++] = b
      index[o++] = b; index[o++] = c; index[o++] = d
    }
  }
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  return geo
}

function Drape({ src, segments, speed, wind, aspect, sheen, metal, foldDepth, noise, noiseScale, noiseFlicker, onReady }) {
  const texture = useLoader(THREE.TextureLoader, src)
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy())
  const sim = useMemo(() => createClothSim(segments, aspect), [segments, aspect])
  const geometry = useMemo(() => buildGeometry(sim), [sim])

  useEffect(() => {
    // Use the photo exactly as supplied: no resampling, full-quality filtering.
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = maxAniso
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
  }, [texture, maxAniso])

  useEffect(() => () => geometry.dispose(), [geometry])

  // Real folds: read the creases painted in the photo and build them into the cloth's shape.
  useEffect(() => {
    const field = buildFoldField(texture.image, sim.segments, sim.rowSegs)
    for (let i = 0; i < sim.n; i++) sim.fold[i] = field[i] * foldDepth
  }, [texture, sim, foldDepth])

  // Reflections: a small built-in studio room (no download), used only by the satin layer.
  const gl = useThree((st) => st.gl)
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = new RoomEnvironment()
    const rt = pmrem.fromScene(env, 0.04)
    pmrem.dispose()
    env.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    return rt
  }, [gl])
  useEffect(() => () => envMap.dispose(), [envMap])

  // The satin layer: black base colour, so it adds ONLY highlights (specular, sheen, room
  // reflections) on top of the photo. Additive, so the logo's own colours are untouched.
  const satin = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x000000,
        map: texture, // only its alpha matters here: keeps highlights strictly inside the cloth's outline
        roughness: 0.34,
        metalness: 0,
        envMap: envMap.texture,
        envMapIntensity: 0.4 * sheen,
        sheen: 0.5,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#ffffff'),
        // highlights follow the photo's own colours: no sheen on the dark backdrop, red-tinted on the red
        sheenColorMap: texture,
        specularColor: new THREE.Color('#ffffff'),
        specularColorMap: texture,
        anisotropy: 0.55,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [envMap, sheen, texture],
  )
  useEffect(() => () => satin.dispose(), [satin])

  // Metallic glints: a metal layer (reflections tinted by the cloth's own colour) that is only
  // visible on fold crests, i.e. where the fold shading says the surface is turned to the light.
  const glintMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture, // tints the metal by the cloth colour, and keeps it inside the cutout
        metalness: 1,
        roughness: 0.36,
        envMap: envMap.texture,
        envMapIntensity: 0.5 * metal,
        vertexColors: true, // the crest mask lives in the vertex colours of glintGeo
        opacity: Math.min(Math.max(metal, 0), 1), // scales the WHOLE layer (reflections and direct light), so `metal` is a true strength dial
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [envMap, metal, texture],
  )
  useEffect(() => () => glintMat.dispose(), [glintMat])
  // shares positions, normals and uvs with the cloth, but has its own colour (mask) attribute
  const glintGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', geometry.getAttribute('position'))
    g.setAttribute('normal', geometry.getAttribute('normal'))
    g.setAttribute('uv', geometry.getAttribute('uv'))
    g.setIndex(geometry.getIndex())
    const mask = new THREE.BufferAttribute(new Float32Array(sim.n * 3), 3)
    mask.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('color', mask)
    return g
  }, [geometry, sim])
  useEffect(() => () => glintGeo.dispose(), [glintGeo])

  // Fabric grain: fine noise baked into the photo's own material. It is anchored to the cloth's
  // UVs, so the grain travels with the fabric as it ripples (rather than sitting on the screen
  // like a dirty lens). It only touches colour, never alpha, so the cut-out silhouette is intact.
  const grain = useMemo(
    () => ({
      uNoise: { value: noise },
      uNoiseScale: { value: noiseScale },
      uNoiseFlicker: { value: noiseFlicker },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps -- values are kept in sync below
  )
  useEffect(() => {
    grain.uNoise.value = noise
    grain.uNoiseScale.value = noiseScale
    grain.uNoiseFlicker.value = noiseFlicker
  }, [grain, noise, noiseScale, noiseFlicker])

  const baseMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true, // the photo is cut out: everything outside the cloth is transparent
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, grain)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uNoise;
uniform float uNoiseScale;
uniform float uNoiseFlicker;
uniform float uTime;
// cheap, stable hash (no sin(), so no banding on mobile GPUs)
float grainHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
#ifdef USE_MAP
  {
    // two octaves: fine grain + a softer clump, so it reads as woven fabric, not TV static
    vec2 g = vMapUv * uNoiseScale;
    float frame = floor(uTime * 12.0); // flicker steps at ~12 fps, like film grain
    float fine = grainHash(vec3(floor(g), frame * uNoiseFlicker));
    float soft = grainHash(vec3(floor(g * 0.5), 7.0));
    float n = (fine * 0.7 + soft * 0.3) - 0.5;      // -0.5 .. 0.5
    // multiplicative (so the dark backdrop stays dark) plus a touch additive for visibility
    diffuseColor.rgb = max(diffuseColor.rgb * (1.0 + n * 2.0 * uNoise) + n * uNoise * 0.12, 0.0);
  }
#endif`,
        )
    }
    m.customProgramCacheKey = () => 'cloth-grain-v1'
    return m
  }, [texture, grain])
  useEffect(() => () => baseMat.dispose(), [baseMat])

  const keyLight = useRef(null)
  const announced = useRef(false)
  const light = useMemo(() => [0, 0, 1], [])

  useFrame((_, delta) => {
    stepCloth(sim, delta, speed, wind)
    grain.uTime.value = sim.time
    applyFolds(sim)
    driftLight(light, sim.time) // same light drives the fold shading and the satin highlights
    const pos = geometry.getAttribute('position')
    const col = geometry.getAttribute('color')
    const nor = geometry.getAttribute('normal')
    writeShading(sim, col.array, 1.35, light)
    if (keyLight.current) keyLight.current.position.set(light[0] * 6, light[1] * 6, light[2] * 6)
    // crest mask: 0 on flat cloth and in shadow, rising on surfaces turned toward the light
    const gm = glintGeo.getAttribute('color')
    for (let i = 0; i < col.array.length; i += 3) {
      const t = Math.min(Math.max((col.array[i] - 1.07) / 0.15, 0), 1)
      const m = t * t
      gm.array[i] = m
      gm.array[i + 1] = m
      gm.array[i + 2] = m
    }
    gm.needsUpdate = true
    pos.needsUpdate = true
    col.needsUpdate = true
    nor.needsUpdate = true
    // first frame is on screen: let the page fade the still poster out
    if (!announced.current) { announced.current = true; onReady?.() }
  })

  // frustumCulled off: the bounding sphere is computed once at rest, the cloth moves.
  return (
    <>
      <mesh geometry={geometry} material={baseMat} frustumCulled={false} />
      <directionalLight ref={keyLight} intensity={1.5 * sheen} color="#fff1e8" />
      <mesh geometry={geometry} material={satin} frustumCulled={false} renderOrder={1} />
      <mesh geometry={glintGeo} material={glintMat} frustumCulled={false} renderOrder={2} />
    </>
  )
}


/** The WebGL part of the cloth logo. Loaded lazily by cloth-logo.jsx so three.js stays out of the first load. */
export default function ClothCanvas({ visible, dpr, aspect, ...drape }) {
  return (
    <Canvas
      aria-hidden="true"
      frameloop={visible ? 'always' : 'never'}
      dpr={dpr}
      flat
      className="cloth-gl"
      camera={{ position: [0, 0, cameraZ(aspect)], fov: FOV, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: `-${BLEED * 100}%`, width: 'auto', height: 'auto' }}
    >
      <Suspense fallback={null}>
        <Drape aspect={aspect} {...drape} />
      </Suspense>
    </Canvas>
  )
}