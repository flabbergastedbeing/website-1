import { useEffect, useRef } from 'react'
import HL from './camera/kernel.js'
import { mount3d } from './sector/engine.js'
import * as objects from './sector/objects.js'

/**
 * A Hairline 3D figure (books, cup or dress) for a sector card. It turns to the pointer and lifts or drops with its height,
 * and the pointer is followed anywhere over the card, not only over the figure's own box.
 */
export default function SectorFigure({ kind, track = '.sector' }) {
  const ref = useRef(null)

  useEffect(() => {
    const stage = ref.current, obj = objects[kind]
    if (!stage || !obj) return
    HL.inject(document)
    stage.setAttribute('data-hairline', kind)
    stage.setAttribute('data-hairline-theme', 'dark')
    stage.setAttribute('role', 'img')
    stage.setAttribute('aria-label', `Line drawing of ${obj.label} that turns and tilts to follow the pointer`)
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage)
    const handle = mount3d({ stage, svg }, obj)

    const zone = stage.closest(track) || document
    const send = (type, e) =>
      stage.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, clientX: e.clientX, clientY: e.clientY }))
    const move = (e) => { if (e.pointerType === 'mouse' && !stage.contains(e.target)) send('pointermove', e) }
    const leave = (e) => { if (e.pointerType === 'mouse') send('pointerleave', e) }
    zone.addEventListener('pointermove', move)
    zone.addEventListener('pointerleave', leave)
    return () => {
      zone.removeEventListener('pointermove', move)
      zone.removeEventListener('pointerleave', leave)
      handle.destroy()
      stage.replaceChildren()
    }
  }, [kind, track])

  return <div ref={ref} className="fig" />
}