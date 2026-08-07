# SESSION NOTES — Zestorium

## Status: v0.1 DEPLOYED to zestorium.com, game WIP on staging branch

| Item | Value |
|------|-------|
| Live URL (prod) | zestorium.com / zestorium.vercel.app |
| Staging branch | staging (auto-deploys preview URL on Vercel) |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite + Framer Motion, static on Vercel |
| Domain | Namecheap → Vercel DNS (configured, SSL active) |
| Reddit post | reddit.com/r/limoncello/comments/1vgm7tz/limoncello_science/ |

## What's Built & Deployed (main branch)
- Two-panel live calculator (inputs left, recipe right)
- Two modes: "I have ingredients" / "I want a specific amount"
- Fruit size slider with 10th/90th percentile bounds
- Zest scales with pure alcohol (ref: 66g/566.25ml from 750ml 151-proof)
- Water in spirit accounted for in dilution math
- Phase 1 (infusion) always visible, Phase 2 (dilute) in modal
- Infusion time: 5-7d (151+), 10-14d (100-150), 14-21d (below 100)
- Story page with data modal, Reddit links
- Share section with copy-caption + native share API
- Game entry flow (functional but visually WIP)

## What's on Staging (not merged to prod)
- Game flow: citrus select → spirit select → bottle fill → fruit count
- LiquidBottle component with:
  - Canvas wave physics (spring-damper, volume conservation)
  - PNG bottle overlay (ChatGPT generated, transparent bg)
  - SVG clip path for interior (from ChatGPT: bottle_inner_liquid_outline.svg)
  - Gyroscope tilt sloshing (iOS permission handled)
  - Cartoony line surface rendering (current state)
- Framer Motion page transitions between game steps

## NEXT SESSION: LiquidFun Integration
- **Goal:** Replace canvas wave sim with Google LiquidFun particle physics
- **Library:** liquidfun.js (Emscripten port of Box2D particle extension)
- **Demos:** google.github.io/liquidfun, doeberl.at/liquidfun
- **Approach:**
  1. Install liquidfun.js (or use WASM build)
  2. Create a Box2D world with bottle-shaped container (from SVG clip path)
  3. Fill with particle group (water type)
  4. Render particles on canvas (or use metaball shader for smooth surface)
  5. Connect drag/gyro to gravity direction
  6. Overlay bottle PNG on top
- **Key challenge:** Converting SVG path into Box2D chain shape for container walls
- **Stretch:** 3D perspective view (oval when still), splash droplets

## Key Architecture Decisions
- Zest ratio tied to pure alcohol, not spirit volume
- Water in spirit counts toward dilution
- Sugar displacement: 0.62ml/g, max syrup ratio 2:1
- Infusion times are lookup table (community validation pending)
- No backend, no accounts, no saved data
- Open project: community feedback via Reddit
- Viral loop: Game → Recipe → Make it → Share caption → Friend sees → Repeat

## Files of Note
- `public/bottle.png` — ChatGPT bottle image (transparent bg)
- `bottle_inner_liquid_outline.svg` — SVG interior clip path (in project root)
- `infusion-time-data.md` — collected infusion time research data
- `src/components/LiquidBottle.jsx` — current wave simulation (to be replaced)
- `src/components/Game.jsx` — game entry flow
- `src/engine/calculate.js` — math engine (closed-form, validated)

## Commands
- Dev server: `npx --registry https://registry.npmjs.org vite --host`
- Build: `npx --registry https://registry.npmjs.org vite build`
- Deploy staging: `git push` (on staging branch, auto-deploys preview)
- Deploy prod: `git checkout main && git merge staging && git push origin main`
- npm auth issue: must use `--registry https://registry.npmjs.org` flag
