import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

// The canvas stays mounted (unmounting it made the gradient blink out and back in when scrolling up), but it stops
// drawing frames while the hero is off screen, so it costs nothing during the other sections' animations.
function FrameGate() {
  const el = useThree((s) => s.gl.domElement)
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? 'always' : 'never'), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [el, setFrameloop])
  return null
}

export default function HeroGradient() {
  return (
    <div className="gl-fade">
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      pointerEvents="none"
      lazyLoad={false} // the library unmounts the canvas when it scrolls out of view, so it re-fades in on the way back up; keep it mounted
    >
      <FrameGate />
      <ShaderGradient
        animate="on"
        axesHelper="off"
        brightness={0.4}
        cAzimuthAngle={270}
        cDistance={0.5}
        cPolarAngle={180}
        cameraZoom={14.9}
        color1="#000000"
        color2="#F23005"
        color3="#000000"
        destination="onCanvas"
        embedMode="off"
        envPreset="city"
        format="gif"
        fov={45}
        frameRate={10}
        gizmoHelper="hide"
        grain="on"
        lightType="env"
        pixelDensity={1}
        positionX={-0.1}
        positionY={0}
        positionZ={0}
        range="disabled"
        rangeEnd={40}
        rangeStart={0}
        reflection={0.2}
        rotationX={0}
        rotationY={130}
        rotationZ={70}
        shader="defaults"
        type="sphere"
        uAmplitude={6.2}
        uDensity={0.4}
        uFrequency={5.5}
        uSpeed={0.3}
        uStrength={0.5}
        uTime={0}
        wireframe={false}
      />
    </ShaderGradientCanvas>
    </div>
  )
}