# SESSION NOTES — Zestorium

## Status: v0.1 DEPLOYED, game WIP on staging branch

| Item | Value |
|------|-------|
| Live URL (prod) | zestorium.com / zestorium.vercel.app |
| Staging | auto-deploys from `staging` branch on Vercel |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite + Framer Motion + Matter.js + Three.js |
| Domain | Namecheap DNS → Vercel (configured, SSL active) |
| Reddit | reddit.com/r/limoncello/comments/1vgm7tz/ |
| Dev server | `npx --registry https://registry.npmjs.org vite --host` |
| Build | `npx --registry https://registry.npmjs.org vite build` |
| npm auth issue | Must use `--registry https://registry.npmjs.org` flag always |

## What's Deployed (main branch)
- Two-panel live calculator (inputs left, recipe right)
- Two modes: "I have ingredients" / "I want a specific amount"
- Fruit size slider with tick marks (10th/90th percentile bounds)
- Corrected math: zest scales with pure alcohol, water in spirit accounted for
- Phase 1 (infusion) always visible, Phase 2 (dilute) in modal
- Infusion times: 5-7d (151+), 10-14d (100-150), 14-21d (<100)
- Story/blog page with data modal and Reddit link
- Share section with copy-caption + native share API
- Reddit feedback link in footer

## What's on Staging Branch (not merged to prod)
- Game entry flow: citrus → spirit → bottle → fruit
- SPH fluid simulation in bottle (spatial hash, GPU gooey filter, sleep system)
- ChatGPT bottle art (hand-drawn linework, transparent bg, traced boundary)
- Fruit physics with Matter.js (replaced custom physics)
- ChatGPT fruit art: lemon, lime, orange, grapefruit (all transparent bg)
- Fruit images in `public/`: fruit-lemon.png, fruit-lime.png, fruit-orange.png, fruit-grapefruit.png
- Gyro tilt for bottle liquid

## CURRENT STATE: Fruit Physics Debug Mode
- App opens directly to FruitPhysicsDebug component (set in App.jsx: `debugFruit = true`)
- **Remove this before deploying to prod**: set `debugFruit = false` in App.jsx
- Using Matter.js for physics (proper collision detection)
- Fruit selector in tuning panel (lemon/lime/orange/grapefruit)
- Collision bodies: ellipse polygons (20 vertices) from traced bounding boxes
- Collision size has a 1.05x multiplier over render size (may need adjustment)
- Render: cropped PNG drawn at body position/angle

## Fruit Collision Data (traced from PNGs)
```
lemon:      bbox { x:161, y:232, w:712, h:518 } rx:356 ry:259
lime:       bbox { x:192, y:231, w:648, h:508 } rx:324 ry:254
orange:     bbox { x:195, y:201, w:637, h:576 } rx:318 ry:288
grapefruit: bbox { x:204, y:203, w:623, h:575 } rx:312 ry:288
```

## Known Issues / Next Steps
1. **Collision fit**: lemons/limes are oval but collision is ellipse — minor gaps at body center. The 1.05 multiplier may be too much. May need to try 1.02 or revert to 1.0.
2. **Bottle fill level**: bumped to 0.85 particles/ml but may still not fill to mid-neck
3. **Debug mode**: must disable before merging to prod
4. **Fruit scale**: currently 0.12 in debug params, adjust per fruit type for final game
5. **Gyro for fruit game**: not yet implemented in Matter.js version
6. **Deploy staging**: `git checkout staging && git push` (auto-deploys preview)
7. **Deploy prod**: `git checkout main && git merge staging && git push origin main`

## Architecture Notes
- Bottle liquid: custom SPH simulation (src/components/LiquidBottle.jsx)
- Fruit physics: Matter.js (src/components/FruitPhysicsDebug.jsx)
- Production fruit physics: src/components/FruitPhysics.jsx (old custom physics, needs replacement with Matter.js version)
- Game flow: src/components/Game.jsx
- Calculator engine: src/engine/calculate.js
- Citrus data: src/config/citrusData.js

## Agent Pipelines (Separate Exploration)
- Tested at agent-pipelines.harmony.a2z.com
- Created task: "Zestorium v0.2 - Game Entry Flow"
- Worker: AgentPipeline-Worker (was launching, may be done now)
- Knowledge base uploaded: zestorium-knowledge-base.md

## Multi-Agent Dev Pipeline (VX Team)
- Spec at .kiro/specs/multi-agent-dev-pipeline/requirements.md
- 11 requirements covering orchestration, agents, gates, legal, security
- Workshop planned with SDM to define gates and test agent quality
- Key tools: Venue/DC agents (design), Kiro (dev), AutoSDE (review), Harmony (deploy)
- Protozoa for internal prototype sharing
