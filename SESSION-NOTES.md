# SESSION NOTES — Zestorium

## Status: Game flow on staging, fruit physics tuned, REVERTED viewport work

| Item | Value |
|------|-------|
| Live URL (prod) | zestorium.com / zestorium.vercel.app |
| Staging | auto-deploys from `staging` branch on Vercel |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite + Framer Motion + Matter.js |
| Current commit | bd3605f |
| Dev server | `npx --registry https://registry.npmjs.org vite --host` |
| Build | `npx --registry https://registry.npmjs.org vite build` |

## What's Live on Staging
- Full game flow: citrus → spirit → bottle → fruit physics → calculator
- Real fruit PNG images on citrus selection (proportional sizes)
- FruitPhysics uses Matter.js with tuned params
- Retina canvas (devicePixelRatio) for crisp mobile rendering
- Gyro/tilt: auto-probes on mount, falls back to touchstart for permission
- Per-fruit size variation + deformation
- FruitPhysicsDebug commented out (uncomment debugFruit in App.jsx to restore)
- Debug text showing gyro status on bottle screen (remove before prod)

## NEXT SESSION: Mobile Safe Zone (UNRESOLVED)

**Problem:** iOS Safari has a floating transparent address bar covering ~15% of the bottom of the screen. Content (buttons, text, fruit count) gets hidden behind it.

**What needs to happen:**
- All content on every screen must stay above the toolbar
- Need a fixed bottom dead zone (~15% of viewport) where nothing renders
- All layout must use RELATIVE sizing (no fixed px heights) so content flexes to fit the available 85%
- The canvas aspect ratio must stay correct (not squashed)
- Need to test on Chrome iOS and Android too

**What was tried and failed (reverted):**
- `padding-bottom: 15dvh` on #root — children ignored it
- `height: 85dvh` on #root with overflow hidden — content still overflowed
- Removing all fixed heights and making everything flex — broke the layout badly
- Multiple attempts at the flex chain approach didn't constrain children

**Approach for next session:**
- Consider using a wrapper div with `max-height: 85dvh` and `overflow: hidden`
- Or set explicit `height: 85dvh` on the `.app-game` class directly
- The fruit physics canvas needs to maintain its aspect ratio while fitting
- May need to use `clamp()` or `min()` for element sizes
- Keep a red dotted debug line at the boundary for visual verification

## Tuned Physics Params
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

## TODO
- [ ] Mobile safe zone (see above)
- [ ] Gyro not tested on Chrome iPhone
- [ ] Gyro not tested on Android
- [ ] Remove gyro debug text before prod
- [ ] Night Shift: orange/grapefruit look similar under warm display — art fix needed
- [ ] Remove .kiro/steering/mobile-safe-zone.md or update it once the approach works

## Deploy
- Staging: `git push origin staging` (auto-deploys via Vercel)
- Prod: `git checkout main && git merge staging && git push origin main`
