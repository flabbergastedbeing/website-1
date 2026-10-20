import { useEffect, useRef } from 'react'
import HL from './camera/kernel.js'
import { mount3d } from './sector/engine.js'
import * as objects from './sector/objects.js'

/**
 * A piece of shooting gear (softbox, mic or clapperboard) drawn with Hairline, standing next to the tripod in the hero.
 * Same engine as the sector figures: it turns to the pointer and nods with its height. The pointer is followed anywhere
 * over the hero, so the stage itself ignores pointer events and never blocks the camera or the buttons.
 */
export default function GearFigure({ kind, track = '.hero', className = '', style }) {
  const ref = useRef(null)

  useEffect(() => {
    const stage = ref.current, obj = objects[kind]
    if (!stage || !obj) return
    HL.inject(document)
    stage.setAttribute('data-hairline', kind)
    stage.setAttribute('data-hairline-theme', 'dark')
    stage.setAttribute('role', 'img')
    stage.setAttribute('aria-label', `Line drawing of ${obj.label} that turns to follow the pointer`)
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage)
    const handle = mount3d({ stage, svg }, obj)

    const zone = stage.closest(track) || document
    const send = (type, e) =>
      stage.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, clientX: e.clientX, clientY: e.clientY }))
    const move = (e) => { if (e.pointerType === 'mouse') send('pointermove', e) }
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

  return <div ref={ref} className={`gear g-${kind} ${className}`.trim()} style={style} />
}