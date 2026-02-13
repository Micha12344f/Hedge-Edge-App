# Vibe-Code Audit Checklist

Use this checklist when reviewing any component or page for "vibe coded" (AI-generated template) aesthetics. Every item must pass before a component ships.

---

## Layout & Composition

- [ ] **No symmetric 3-column card grids** — If using cards, layout is asymmetric, bento-style, or varies in size
- [ ] **No uniform spacing everywhere** — Padding/margins vary intentionally (e.g., `pt-8 pb-14` not `py-10`)
- [ ] **Visual hierarchy is clear** — Eye knows where to go first. One element dominates, others support
- [ ] **Whitespace is intentional** — Used to create breathing room, not just default margins
- [ ] **No "wave" SVG section dividers** — Sections transition via color, spacing, or animation — not clipart waves

## Color & Surface

- [ ] **No default gradients** — Especially `bg-gradient-to-r from-blue-500 to-purple-500`
- [ ] **Brand colors used consistently** — Not generic Tailwind palette defaults
- [ ] **Surface treatments are layered** — Backgrounds use subtle noise, glass blur, or overlapping tones — not flat slabs
- [ ] **Borders are refined** — `ring-1 ring-white/5` or colored accents — not `border border-gray-200`
- [ ] **Dark mode is the primary design** — Light mode is secondary; dark-first for financial aesthetic

## Typography

- [ ] **Type scale is varied** — At least 3 different sizes on any section with text
- [ ] **Font weight varies** — Not everything is medium; use light/regular for body, semibold/bold for headings
- [ ] **Letter spacing is adjusted** — Headings use `tracking-tight`, small caps use `tracking-wider`
- [ ] **Line height is tuned** — Not just Tailwind defaults; `leading-snug` for headlines, `leading-relaxed` for body

## Components (shadcn/ui)

- [ ] **No default shadcn styling** — Every shadcn component has been extended with brand-specific variants
- [ ] **CVA variants defined** — Custom variants via `cva()` for size, color, and state
- [ ] **Interactive states are distinct** — Hover, focus, active, disabled all look intentionally different
- [ ] **Focus rings are styled** — Not browser default; use `focus-visible:ring-2 focus-visible:ring-brand/50`

## Iconography (Lucide)

- [ ] **Every icon communicates function** — No decorative icons. Each answers "what does this tell the user?"
- [ ] **Consistent stroke width** — `strokeWidth={1.5}` throughout (not default 2)
- [ ] **Icon sizes are appropriate** — 16px for inline, 20px for buttons, 24px only for primary actions
- [ ] **No icon overload** — If more than 50% of a section is icons, reduce

## Animation & Motion

- [ ] **Not everything fades in the same way** — Animation types vary per section
- [ ] **Stagger has intentional order** — Left-to-right, top-to-bottom, or by importance — not random
- [ ] **Timing feels natural** — Typical: 200-400ms for micro, 600-1000ms for sections, custom ease curves
- [ ] **No animation is gratuitous** — Every motion communicates something (entry, state, attention)
- [ ] **`prefers-reduced-motion` respected** — Animations reduce or disable for users who prefer it

## Overall "Smell Test"

- [ ] **Would a designer be proud of this?** — Not just functional, but intentionally crafted
- [ ] **Does it look like 50 other AI-generated sites?** — If yes, it fails. Redesign.
- [ ] **Can you identify 3 intentional design decisions?** — If not, the design lacks soul
- [ ] **Is there one "hero moment"?** — Every page needs a focal point that draws the eye
