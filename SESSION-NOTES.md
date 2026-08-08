# SESSION NOTES — Zestorium

## Status: Game flow + tipping bottle w/ fluid + cork pop, all on staging

| Item | Value |
|------|-------|
| Live URL (prod) | zestorium.com / zestorium.vercel.app |
| Staging | auto-deploys from `staging` branch on Vercel |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite + Framer Motion + Matter.js |
| Dev server | `npx vite --host` (test on phone via LAN IP) |
| Build | `npx vite build` |

## User Journey (current)
1. **Intro**: "Three ingredients. One week. Your own limoncello." + physics bottle
   - Bottle DROPS from top of screen, lands on invisible floor at 68% height
   - Gyro tips it over (enabled after landing); trapped in screen walls
   - TAP the bottle → cork pops out (physics body, violent bounces, stays forever)
   - Bottle art swaps to bottle-nocork.png; neck boundary opens
   - Tip far enough → SPH liquid pours out neck, free-falls off screen, gone
2. **Citrus**: "We'll build your recipe from what's in your kitchen" + 4 cards (min counts)
3. **Fruit count**: fullscreen fruit physics (fixed viewport canvas, fruit visible behind Zestorium header), tap to add, fling to remove, count in white pill, "Now let's add vodka!"
4. **Vodka**: proof pills (80/90/100/151/190) top-left under header, bottle right with swipe hint, "Show me my recipe →" + skip link
5. **Calculator**: scrollable, pre-populated from game, real fruit images

## BottlePhysics.jsx (intro bottle) — key architecture
- Collision polygon traced from bottle pixels; Matter wraps concave neck in convex hull
- **Image↔polygon alignment**: computed from body.bounds vs definition-space bounds (exact, works despite hull). DON'T guess vertex offsets — the centroid moves with every vertex edit
- Center of mass moved via Matter.Body.setCentre to y=0.06*renderH (below shoulder)
- Bottle render size = 42vh, 2:3 aspect (matches old static bottle / CSS wrapper)
- SPH fluid ported verbatim from LiquidBottle (same params, 280x420 sim space, traced BOTTLE_PROFILE interior, 525ml = ~446 particles)
- Fluid simulated in BOTTLE-LOCAL frame: world gravity rotated by -bottleAngle each frame; boundary never moves → liquid can't escape (until uncorked)
- **Perf**: small goo-filtered fluid canvas (bottle-sized + 30px pad) positioned via CSS transform (GPU); redraw skipped when SPH sleeps; Matter enableSleeping kills body jitter; gyro wakes bottle explicitly on tilt change >0.03
- Cork: sprite region CORK_SRC {420,744,184,188} in cork.png; painted cork at x=-0.011, top y=-0.438 (definition fracs); pops along bottle local up axis, speed 22, no spin, restitution 0.85

## Assets (public/)
- bottle.png (labeled, vodka screen), bottle-nolabel.png (intro, corked)
- bottle-nocork.png (intro, after pop), cork.png (sprite at CORK_SRC region)
- fruit-{lemon,lime,orange,grapefruit}.png

## TODO / next session
- [ ] Fluid perf still needs work (user said "a little slow" even after optimizations)
- [ ] Fruit min counts on citrus cards are placeholders (6/5/3/2)
- [ ] Servings estimate on fruit + vodka screens (planned, not built)
- [ ] Side padding issue on fruit screen may persist — verify with fullscreen canvas
- [ ] Gyro untested: Chrome iOS, Android
- [ ] Game screens can scroll (constraint removed for calculator) — may need per-page lock
- [ ] Night Shift makes orange/grapefruit similar — art-level fix someday
- [ ] Swirl idea: per-particle hue variation in limoncello for organic look (user liked it)
- [ ] iOS status bar area unreachable in Safari browser mode (viewport-fit only helps in PWA)

## Deploy
- Staging: `git push origin staging` (auto-deploys)
- Prod: `git checkout main && git merge staging && git push origin main`
