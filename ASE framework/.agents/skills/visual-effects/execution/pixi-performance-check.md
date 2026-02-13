# PixiJS Performance Check

Use this checklist before shipping any PixiJS-powered visual effect. Covers GPU performance, memory management, and React lifecycle.

---

## 1. Initialization

- [ ] **Single Application instance** — Only one `new Application()` per canvas. Never create multiple apps for the same viewport.
- [ ] **Transparent background configured** — `backgroundAlpha: 0` if overlaying DOM content
- [ ] **Antialias enabled** — `antialias: true` for clean edges (disable only if performance-critical)
- [ ] **Canvas appended correctly** — `containerElement.appendChild(app.canvas)`, not document.body

## 2. GPU Performance

- [ ] **FPS check** — Monitor `app.ticker.FPS` during effect. Must maintain 60fps.
- [ ] **Draw calls minimized** — Check with PixiJS DevTools or `app.renderer.objectsLastRendered`
- [ ] **ParticleContainer used for homogeneous sprites** — When rendering 100+ identical sprites
- [ ] **Sprite sheets used** — Individual image loads replaced with texture atlases
- [ ] **Interaction disabled on non-interactive containers** — `container.interactiveChildren = false`
- [ ] **No unnecessary filters** — Blur/glow filters are expensive; use sparingly

## 3. Memory Management

- [ ] **Textures disposed on cleanup** — `texture.destroy(true)` frees GPU memory
- [ ] **Application destroyed on unmount** — `app.destroy(true, { children: true, texture: true, context: true })`
- [ ] **No texture leaks** — Textures created in loops are tracked and disposed
- [ ] **Asset loading uses PixiJS Assets** — `await Assets.load(url)` with proper caching
- [ ] **No orphaned display objects** — All children removed from stage before destroy

## 4. React Integration

- [ ] **useEffect with cleanup:**
  ```typescript
  useEffect(() => {
    const app = new Application();
    // ... init
    return () => {
      app.destroy(true, { children: true, texture: true });
    };
  }, []);
  ```
- [ ] **Resize handled** — ResizeObserver on container, calls `app.renderer.resize(width, height)`
- [ ] **Visibility handled** — IntersectionObserver pauses ticker when off-screen
- [ ] **Refs used for DOM** — `useRef<HTMLDivElement>()` for container element
- [ ] **No state-driven renders** — PixiJS manages its own render loop; don't trigger React re-renders

## 5. Accessibility

- [ ] **`prefers-reduced-motion` respected:**
  - Reduce particle count to < 10% or disable effect entirely
  - Slow down motion to near-static
- [ ] **Canvas has `role="img"` and `aria-label`** — Describes the visual effect for screen readers
- [ ] **Not the only way to convey information** — Visual effect is decorative; data is also in DOM

## 6. Fallbacks

- [ ] **WebGL support checked:**
  ```typescript
  // PixiJS v8 auto-fallback, but verify:
  if (!navigator.gpu && !document.createElement('canvas').getContext('webgl2')) {
    // Show CSS fallback
  }
  ```
- [ ] **CSS fallback exists** — Static gradient or solid color when WebGL unavailable
- [ ] **Mobile performance acceptable** — Test on real device; reduce complexity for mobile
- [ ] **Battery consideration** — Consider pausing on low-power mode (if detectable)

## 7. Visual Quality

- [ ] **Effect matches brand aesthetic** — Colors from Hedge Edge palette, not random
- [ ] **Effect is subtle, not distracting** — Ambient effects should not compete with content
- [ ] **No visual artifacts** — No flickering, tearing, or z-fighting
- [ ] **Transition from canvas to DOM is seamless** — No visible seam between layers
