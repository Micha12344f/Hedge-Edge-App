---
name: visual-effects
description: |
  Create GPU-accelerated visual effects using PixiJS for particles, animated
  backgrounds, data visualizations, and interactive canvas elements. Use when
  standard CSS/DOM animation is insufficient and WebGL rendering is needed for
  performance or visual complexity.
---

# Visual Effects (PixiJS)

## Objective

Build GPU-accelerated 2D visual effects using PixiJS that elevate the Hedge Edge UI beyond what CSS and DOM-based animations can achieve. This includes particle systems, animated backgrounds, trading data visualizations, and interactive canvas elements — all rendered via WebGL/WebGPU for buttery 60fps performance.

## When to Use This Skill

- Building animated particle backgrounds (hero sections, ambient effects)
- Creating GPU-rendered data visualizations (trading charts, network graphs)
- Adding interactive canvas elements (hover-reactive backgrounds, cursor trails)
- Building visual effects that would tank performance in DOM (100+ moving elements)
- Creating smooth gradient animations or noise-based visual textures
- Any visual that requires thousands of simultaneous animated entities

## Input Specification

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| effect_type | enum | Yes | `particles`, `background`, `data-viz`, `interactive`, `texture` |
| target_section | string | Yes | Where the effect appears (e.g., "hero", "dashboard-bg", "loading") |
| target_project | enum | Yes | `landing-page` or `desktop-app` |
| intensity | enum | No | `ambient` (default), `moderate`, `intense` — particle count / complexity |
| interactive | boolean | No | Whether the effect responds to mouse/touch input |

## Step-by-Step Process

1. **Assess Necessity** — PixiJS adds bundle weight (~200KB). Before using, confirm:
   - Can this effect be achieved with CSS animations? If yes, use CSS.
   - Can GSAP or Motion handle it? If yes, use those.
   - Does this need 100+ simultaneous animated entities? → PixiJS
   - Does this need shader-level visual effects? → PixiJS
   - Is this a background ambient effect? → PixiJS is appropriate

2. **Set Up Canvas Layer** — PixiJS renders to a `<canvas>` element:
   - Create a React wrapper component that manages the PixiJS `Application` lifecycle
   - Position canvas `absolute` / `fixed` behind DOM content with `pointer-events: none`
   - Handle resize via `ResizeObserver` → `app.renderer.resize()`
   - Reference: [pixi-react-patterns.md](../../tmp/pixi-react-patterns.md)

3. **Build the Effect** — Follow PixiJS v8 patterns:
   ```typescript
   import { Application, Assets, Sprite, Container } from 'pixi.js';
   
   const app = new Application();
   await app.init({ 
     background: 'transparent',
     backgroundAlpha: 0,
     resizeTo: containerElement,
     antialias: true,
   });
   containerElement.appendChild(app.canvas);
   ```

4. **Optimize Performance**:
   - Use `ParticleContainer` for large numbers of similar sprites
   - Batch draw calls — group similar visual elements in the same `Container`
   - Use sprite sheets / texture atlases instead of individual images
   - Set `interactiveChildren = false` on containers that don't need hit testing
   - Profile with `app.ticker.FPS` and Chrome DevTools GPU panel

5. **Handle Lifecycle in React**:
   - Initialize in `useEffect` with cleanup
   - Destroy the PixiJS `Application` on component unmount: `app.destroy(true)`
   - Pause ticker when off-screen (IntersectionObserver)
   - Respect `prefers-reduced-motion` — reduce particle count or disable entirely

6. **Validate** — Check against the Definition of Done

## Execution Scripts

- [pixi-performance-check.md](./execution/pixi-performance-check.md) — Performance profiling checklist for PixiJS effects

## Resources

- [pixi-react-patterns.md](../../tmp/pixi-react-patterns.md) — React integration patterns for PixiJS v8: lifecycle, resize, cleanup
- [pixi-effect-recipes.md](../../tmp/pixi-effect-recipes.md) — Ready-to-use PixiJS effect recipes: particles, noise backgrounds, cursor trails

## Expected Output

- A React component wrapping a PixiJS canvas
- Canvas renders behind DOM content at the appropriate z-index
- Effect runs at 60fps with no impact on DOM interaction
- Proper cleanup on unmount (no WebGL context leaks)
- `prefers-reduced-motion` respected

## Definition of Done

- [ ] Effect renders correctly in the target canvas layer
- [ ] 60fps maintained with no dropped frames
- [ ] React lifecycle properly managed (init, resize, destroy)
- [ ] Canvas does not intercept pointer events (unless `interactive: true`)
- [ ] `prefers-reduced-motion` disables or simplifies the effect
- [ ] WebGL context is destroyed on component unmount
- [ ] Effect enhances the UI without distracting from content
- [ ] Bundle impact is acceptable (PixiJS tree-shaken to only used modules)
- [ ] No memory leaks (textures and resources properly disposed)

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| WebGL context lost | Too many canvases or GPU pressure | Reduce to single PixiJS app instance, share across sections |
| Canvas doesn't resize | Missing resize handler | Use `ResizeObserver` on container, call `app.renderer.resize()` |
| Memory leak on navigation | PixiJS app not destroyed | Call `app.destroy(true, { children: true, texture: true })` in cleanup |
| Effect blocking clicks | Canvas capturing pointer events | Set `pointer-events: none` on canvas CSS, or `app.canvas.style.pointerEvents = 'none'` |
| Low FPS with many particles | Too many draw calls | Use `ParticleContainer`, reduce particle count, use sprite sheets |
| Effect invisible on some devices | WebGL not supported | Add fallback: check `PIXI.utils.isWebGLSupported()`, show static CSS gradient |
