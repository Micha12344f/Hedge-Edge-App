---
name: motion-animation
description: |
  Implement animations using GSAP, Motion (Framer Motion), and Theatre.js.
  Use for scroll-triggered reveals, micro-interactions, page transitions,
  hero sequences, and choreographed motion design. Ensures animations feel
  intentional and premium, not generic fade-in templates.
---

# Motion & Animation

## Objective

Add purposeful, high-craft animation to the Hedge Edge UI using the right tool for each job — GSAP for scroll and timeline choreography, Motion for declarative React component transitions, and Theatre.js for cinematic visual sequences. Every animation must serve a communication purpose (guide attention, indicate state change, create spatial continuity).

## When to Use This Skill

- Adding scroll-triggered section reveals to the landing page
- Building micro-interactions (hover, press, toggle states)
- Implementing page/route transitions
- Creating hero animations or cinematic brand moments
- Adding staggered list/grid reveal animations
- Animating numbers, counters, or data visualizations
- Building parallax or perspective scroll effects
- Text splitting and character-level animations

## Input Specification

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| animation_type | enum | Yes | `scroll-trigger`, `micro-interaction`, `page-transition`, `hero-sequence`, `text-animation`, `layout-transition` |
| target_element | string | Yes | CSS selector, component name, or page section being animated |
| target_project | enum | Yes | `landing-page` or `desktop-app` |
| library_preference | enum | No | `gsap`, `motion`, `theatre` — agent selects if omitted |
| intensity | enum | No | `subtle` (default), `moderate`, `dramatic` — controls motion magnitude |

## Step-by-Step Process

1. **Select Library** — Use the Decision Matrix:
   - **Micro-interactions** (hover, press, mount/unmount) → **Motion**
   - **Scroll-triggered reveals** → **GSAP ScrollTrigger**
   - **Page-level timelines** → **GSAP**
   - **Cinematic hero sequences** → **Theatre.js** or **GSAP**
   - **Layout/shared-element transitions** → **Motion** `layoutId`
   - **Character-level text animation** → **GSAP SplitText**

2. **Define Motion Intent** — Before coding, answer:
   - What is this animation communicating? (entry, exit, state change, attention, hierarchy)
   - What is the user's eye path? (where should they look first, second, third)
   - Does this animation have a purpose beyond "looking cool"?
   - Should this animation be skipped for `prefers-reduced-motion`?

3. **Implement Animation** — Follow library-specific patterns:
   - Reference: [gsap-patterns.md](../../tmp/gsap-patterns.md) for GSAP patterns
   - Reference: [motion-patterns.md](../../tmp/motion-patterns.md) for Motion patterns
   - Reference: [theatre-patterns.md](../../tmp/theatre-patterns.md) for Theatre.js patterns

4. **Add Accessibility** — Required for all animations:
   ```tsx
   // Always respect prefers-reduced-motion
   const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   ```
   - Motion: `<motion.div transition={prefersReducedMotion ? { duration: 0 } : { ... }}>`
   - GSAP: Wrap in `if (!prefersReducedMotion) { gsap.to(...) }`

5. **Performance Validation** — Required before shipping:
   - Open Chrome DevTools > Performance tab
   - Record during animation
   - Verify: no frames below 60fps, no layout thrash, no paint storms
   - Use `will-change: transform` only where needed, remove after animation

6. **Validate** — Check against the Definition of Done

## Execution Scripts

- [animation-audit.md](./execution/animation-audit.md) — Checklist for validating animation quality, performance, and accessibility

## Resources

- [gsap-patterns.md](../../tmp/gsap-patterns.md) — GSAP + React patterns: useGSAP, ScrollTrigger, timelines, SplitText
- [motion-patterns.md](../../tmp/motion-patterns.md) — Motion (Framer Motion) patterns: variants, AnimatePresence, gestures, layout
- [theatre-patterns.md](../../tmp/theatre-patterns.md) — Theatre.js patterns: sheets, objects, sequences, R3F integration

## Expected Output

- Animation code integrated into the target component or page
- Proper cleanup (useGSAP handles GSAP; AnimatePresence handles Motion)
- `prefers-reduced-motion` respected
- 60fps verified in DevTools
- Animation communicates clear intent (not just "fade in because why not")

## Definition of Done

- [ ] Animation uses the correct library per the Decision Matrix
- [ ] Motion has clear communicative intent (not decorative fluff)
- [ ] `prefers-reduced-motion` is respected — reduced or no animation for users who prefer it
- [ ] Performance validated: 60fps, no layout thrash
- [ ] GSAP animations use `useGSAP()` hook (not raw useEffect)
- [ ] Motion animations handle mount/unmount via `AnimatePresence`
- [ ] Theatre.js studio code is excluded from production bundles
- [ ] Timing feels natural — not too fast (jarring) or too slow (sluggish)
- [ ] Staggered animations have intentional order (not random)
- [ ] No vibe-code animation patterns (uniform fade-in-up on everything)

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Animation jank / dropped frames | Layout thrash or paint-heavy properties | Animate only `transform` and `opacity`. Add `will-change: transform` |
| GSAP animation doesn't cleanup | Using useEffect instead of useGSAP | Switch to `useGSAP()` from `@gsap/react` |
| ScrollTrigger doesn't fire | Element not in DOM when trigger created | Use `useGSAP` with `{ scope: containerRef }` or `{ dependencies: [] }` |
| Motion component flickers on unmount | Missing AnimatePresence wrapper | Wrap conditional renders in `<AnimatePresence>` |
| Theatre.js studio in production | Dev dependency leaked into build | Ensure `@theatre/studio` is in devDependencies and tree-shaken |
| All sections animate the same way | Uniform fade-in-up on every section | Vary animation types: slide, scale, clip-path, stagger, parallax |
