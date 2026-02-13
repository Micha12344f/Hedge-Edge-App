# Animation Quality Audit

Use this checklist to validate any animation before shipping. Covers performance, accessibility, intent, and technical implementation.

---

## 1. Intent Validation

- [ ] **Animation has a purpose** — Can you explain in one sentence what this animation communicates?
- [ ] **Purpose is one of**: entry/reveal, exit/dismissal, state change, spatial continuity, attention direction, feedback
- [ ] **Not decorative** — Animation is not just "making it move because we can"
- [ ] **Matches content importance** — Hero gets dramatic animation; footer items get subtle or none

## 2. Library Selection

- [ ] **Correct library chosen per Decision Matrix:**
  - Micro-interactions (hover, press, mount) → **Motion**
  - Scroll-triggered reveals → **GSAP ScrollTrigger**
  - Complex timelines → **GSAP**
  - Cinematic sequences → **Theatre.js** or **GSAP**
  - Layout/shared-element → **Motion layoutId**
  - Character text splits → **GSAP SplitText**
- [ ] **Not mixing libraries for same job** — One animation = one library handling it

## 3. Performance

- [ ] **60fps maintained** — Profile in Chrome DevTools > Performance
- [ ] **Only animating composite properties** — `transform` and `opacity` preferred
- [ ] **No layout thrash** — Not animating `width`, `height`, `top`, `left`, `margin`, `padding`
- [ ] **`will-change` used sparingly** — Only added before animation, removed after
- [ ] **No paint storms** — Use Layers panel to verify no unnecessary repaints
- [ ] **Scroll events are throttled** — ScrollTrigger handles this; manual scroll listeners use `requestAnimationFrame`

## 4. Accessibility

- [ ] **`prefers-reduced-motion` respected:**
  ```typescript
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ```
- [ ] **Alternative provided** — When animation is reduced, content is still visible and functional
- [ ] **No seizure risk** — No rapid flashing (3+ flashes per second)
- [ ] **Focus is not confusing** — Animated elements don't trap or redirect keyboard focus unexpectedly

## 5. Technical Implementation (GSAP)

- [ ] **Using `useGSAP()` hook** — Not raw `useEffect` for GSAP animations
- [ ] **Plugins registered** — `gsap.registerPlugin(ScrollTrigger, ...)` called once at top level
- [ ] **ScrollTrigger has `start`/`end` explicitly set** — Not relying on defaults
- [ ] **Cleanup happens automatically** — `useGSAP` handles `revert()` on unmount
- [ ] **Context scoped** — `useGSAP(() => {...}, { scope: containerRef })`

## 6. Technical Implementation (Motion)

- [ ] **AnimatePresence wraps conditional renders** — For exit animations to work
- [ ] **Variants used for complex states** — Not inline `animate={{}}` for multi-state components
- [ ] **`layoutId` used for shared elements** — Not manually tweening position between routes
- [ ] **Spring physics feel natural** — `type: "spring", stiffness: 300, damping: 30` as baseline

## 7. Technical Implementation (Theatre.js)

- [ ] **`@theatre/studio` only in devDependencies** — Never in production bundle
- [ ] **Studio conditionally imported** — `if (process.env.NODE_ENV === 'development') { ... }`
- [ ] **State JSON exported** — Animation state is serialized and loaded in production (no studio needed)
- [ ] **Core is Apache-licensed** — Only `@theatre/core` ships to production

## 8. Polish

- [ ] **Timing feels natural** — Not too fast (< 150ms feels abrupt) or too slow (> 1200ms feels sluggish)
- [ ] **Easing is custom** — Not just `ease: "power2.out"` everywhere. Vary curves per animation type.
- [ ] **Stagger has visual rhythm** — Stagger delay creates a visual wave, not simultaneous pop
- [ ] **Animations don't fight each other** — No two animations competing for the same element simultaneously
- [ ] **Animation ends cleanly** — No visible snap-back, no elements stuck in mid-state
