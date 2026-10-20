import { useMemo } from 'react'
import { scene, SCENE_IDS } from './wipe-art.js'

/**
 * The crowd drawn at the bottom of the red wipe panel, one scene per section. All four are in the page; CSS shows the one named by
 * the panel's data-scene (motion.js sets it just before the panel sweeps up). Still pictures, no animation.
 */
export default function WipeArt() {
  const html = useMemo(() => SCENE_IDS.map((id) => scene(id)).join(''), [])
  return <div className="wipe-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
}