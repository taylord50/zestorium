# SESSION NOTES — Zestorium

## Status: DEPLOYED v0.1 ✓

| Item | Value |
|------|-------|
| Live URL | zestorium.com / zestorium.vercel.app |
| Repo | github.com/taylord50/zestorium |
| Stack | React + Vite, static deploy on Vercel |
| Domain | Namecheap → Vercel DNS (configured) |
| Reddit post | reddit.com/r/limoncello/comments/1vgm7tz/limoncello_science/ |

## What's Built
- Two-panel live calculator (inputs left, recipe right)
- Two modes: "I have ingredients" / "I want a specific amount"
- Fruit size slider with 10th/90th percentile bounds per citrus
- Zest scales with pure alcohol (reference: 66g/566.25ml from 750ml 151-proof)
- Water in spirit accounted for in dilution math
- Phase 1 (infusion) always visible, Phase 2 (dilute) in modal
- Infusion time: 5-7 days (151+), 10-14 (100-150), 14-21 (below 100)
- Story/blog page with data modal
- Labels: "Spirit Volume" / "Spirit Proof"

## NEXT: Priority Build Order

1. **Share Card + Prompt** (small, high value, closes the viral loop)
   - After Phase 1 instructions, add "Share your batch" CTA
   - Generate image card with recipe stats
   - Copy-to-clipboard caption with URL
   - Trigger native share sheet on mobile

2. **The Game** (bigger build, biggest impact on conversion)
   - Visual quiz-style entry: "What spirit?" → "What citrus?" → "How many?" → "How full?"
   - Replace/precede calculator for first-time visitors
   - Ends with reveal: "You can make X servings. 5 minutes of prep."
   - Feeds into existing calculator/recipe flow

3. **Polish**
   - Plausible analytics (swap YOUR_DOMAIN with zestorium.com)
   - Shareable result card design

## Key Decisions Made
- Zest ratio tied to pure alcohol, not spirit volume
- Water in spirit counts toward dilution
- Infusion times are lookup table, not formula (awaiting community validation)
- Sugar displacement: 0.62ml/g
- Max syrup ratio: 2:1
- No accounts, no backend, no saved data
- Open project philosophy: community feedback via Reddit
