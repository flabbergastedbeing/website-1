# Growzho homepage

React + Vite, styled from design.md (basement.studio style reference).
Hero left half: `@shadergradient/react` with your exact props (`src/HeroGradient.jsx`).
Hero right half: `public/hero-logo.jpg`.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # output in dist/

Note: color1="#73bf4" is not a valid 6-digit hex; swap in e.g. "#73bfc4" if it renders wrong.

## Animated cloth logo

The hero logo is a simulated piece of cloth (`src/components/ui/cloth-logo.jsx`, physics in
`src/components/ui/cloth-utils/cloth-sim.js`). It hangs from its top edge and moves in a light breeze.

    <ClothLogo />                       // defaults
    <ClothLogo wind={0.6} speed={0.8}/> // calmer
    <ClothLogo wind={1.6} />            // breezier (still well-behaved)

- `public/cloth-logo.jpg` is the texture: the original photo flattened to a front-on square.
- `public/hero-logo.jpg` is kept as the fallback for no-WebGL and `prefers-reduced-motion`.
- Rendering pauses when the hero is scrolled off-screen.
