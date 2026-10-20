import { useEffect, useRef } from 'react'
import HL from './camera/kernel.js'
import figure from './camera/camera.js'

/**
 * The Hairline camera, mounted into the hero. It is the same figure and engine as hairline-camera.html.
 * Two additions for the page: the camera follows the mouse anywhere over the hero (not only over its own box),
 * and it walks its tour by itself until a hand arrives, so the pane is never dead.
 */
export default function CameraFigure({ track = '.hero', className = '', style }) {
  const ref = useRef(null)

  useEffect(() => {
    const stage = ref.current
    if (!stage) return
    HL.inject(document)
    stage.setAttribute('data-hairline', figure.name)
    stage.setAttribute('data-hairline-theme', 'dark')
    stage.setAttribute('role', 'img')
    stage.setAttribute('aria-label', 'Line drawing of a camera on a tripod, facing left, that tilts up and down to follow the pointer')
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage)
    const handle = figure.mount({ stage, svg, read: { set textContent(_) {} } }, figure.range[1])

    // forward the mouse from the whole hero to the stage, so the lens follows the cursor across the page
    const zone = stage.closest(track) || document
    const send = (type, e) =>
      stage.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, clientX: e.clientX, clientY: e.clientY }))
    const move = (e) => { if (e.pointerType === 'mouse' && !stage.contains(e.target)) send('pointermove', e) }
    const leave = (e) => { if (e.pointerType === 'mouse') send('pointerleave', e) }
    zone.addEventListener('pointermove', move)
    zone.addEventListener('pointerleave', leave)

    const walk = HL.tour(stage, figure.tour, () => {})

    return () => {
      zone.removeEventListener('pointermove', move)
      zone.removeEventListener('pointerleave', leave)
      walk.stop()
      handle.destroy()
      stage.replaceChildren()
    }
  }, [track])

  return <div ref={ref} className={`camera ${className}`.trim()} style={style} />
}