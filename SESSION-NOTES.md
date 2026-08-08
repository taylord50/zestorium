# SESSION NOTES — Zestorium

## Status: Game flow on staging, tuned fruit physics

| Item | Value |
|------|-------|
| Live URL (prod) | zestorium.com / zestorium.vercel.app |
| Staging | auto-deploys from `staging` branch on Vercel |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite + Framer Motion + Matter.js |
| Dev server | `npx --registry https://registry.npmjs.org vite --host` |
| Build | `npx --registry https://registry.npmjs.org vite build` |
| npm auth issue | Must use `--registry https://registry.npmjs.org` flag always |

## What's on Staging (current)
- Full game flow: citrus → spirit → bottle → fruit physics → calculator
- FruitPhysics uses Matter.js with tuned params (same engine as debug)
- Real fruit PNG images rendered on canvas (bbox-cropped sprites)
- Per-fruit size variation + deformation (lemon/lime: 10%/15%, orange/grapefruit: 10%/5%)
- Retina canvas (devicePixelRatio scaling) for crisp rendering on mobile
- Gyro/tilt: auto-detects existing permission on mount (probe listener)
- Gyro fallback: touchstart triggers requestPermission on first visit
- FruitPhysicsDebug commented out in App.jsx (uncomment debugFruit to restore)
- Debug text showing gyro status still visible on bottle screen (remove before prod)

## Tuned Physics Params (from debug session)
| Param | Value |
|-------|-------|
| Gravity | 1.0 |
| Bounciness | 0.6 |
| Friction | 0.2 |
| Air Resistance | 0.005 |
| Density | 0.0076 |
| Spin Damping | 0.05 |
| Slop | 0.05 |
| Fruit Scale | 0.12 |
| Fling Speed | 0.05 |

## Gyro Permission Strategy (iOS Safari)
1. On mount: add probe listener for deviceorientation events
2. If events arrive within 500ms → permission already granted, activate immediately
3. If no events → wait for user touch gesture (touchstart/click)
4. On touch: call DeviceOrientationEvent.requestPermission() → Safari dialog
5. Once granted, cached per-origin by Safari for future visits

## TODO / Untested
- [ ] Gyro not tested on Chrome on iPhone
- [ ] Gyro not tested on any Android devices
- [ ] Remove gyro debug text from bottle screen before merging to prod
- [ ] Collision fit for lemons/limes (oval shapes, ellipse approximation)
- [ ] Night Shift / warm display: orange and grapefruit look too similar under iOS Night Shift. No API to detect it. Fix requires making grapefruit PNG more pink/magenta at the art level. Low priority.

## Architecture
- Bottle liquid: custom SPH (src/components/LiquidBottle.jsx)
- Fruit physics: Matter.js (src/components/FruitPhysics.jsx)
- Fruit physics debug: Matter.js + tuning panel (src/components/FruitPhysicsDebug.jsx)
- Game flow: src/components/Game.jsx
- Calculator: src/engine/calculate.js
- Citrus data: src/config/citrusData.js

## Deploy
- Staging: `git push origin staging` (auto-deploys via Vercel)
- Prod: `git checkout main && git merge staging && git push origin main`
