import { useState } from 'react';

function Story({ onBack }) {
  const [showData, setShowData] = useState(false);

  return (
    <div className="story-page">
      <button className="back-link" onClick={onBack}>← Back to Calculator</button>

      <article className="story-content">
        <h1>How This Started</h1>

        <div className="story-hero">
          <img
            src="/hero-bottles.png"
            alt="Four bottles of homemade citrus liqueur, grapefruit, orange, lemon, and lime, served ice cold"
            className="story-image"
          />
        </div>

        <p className="story-lede">
          I'm new to this, but I've become a little obsessed with homemade citrus liqueurs.
          I grew up Mormon and didn't start drinking alcohol until I was 43. Four years ago.
        </p>

        <p>
          Back in March I set out to make really great limoncello for an early summer party.
          I started looking through recipes online and found a massive amount of variability
          in the recommended ratios of lemons, alcohol, sugar, and water. As an engineer,
          that drove me a little crazy.
        </p>

        <p>
          I picked what I thought was a highly reputable recipe and started experimenting.
          My basic premise was that making great limoncello should be straightforward
          regardless of which lemons you buy or what proof vodka you start with. Obviously
          every lemon is different, but I figured most people would happily accept that
          variability if they could at least know how much fruit, alcohol, and syrup to use
          to reliably hit a target ABV.
        </p>

        <p>
          And then the ADHD kicked in. I decided that while I was at it, I should make
          OTHER types of citrus liqueurs. So I did. I ultimately made lemon, lime,
          grapefruit, and orange liqueurs. Stored them all as concentrates until it was
          time to dilute and serve.
        </p>

        <h2>The Process</h2>

        <p>
          I weighed everything. Like, everything. The zest from every single fruit. Average
          fruit diameters so I could correlate size to yield. I tracked exactly how many
          grams of zest came off 20 lemons, 18 limes, 11 oranges, and 8 grapefruits. All
          infused in 750ml of 151-proof Everclear.
        </p>

        <p>
          For the dilution step, I worked out the closed-form math to hit both a target ABV
          and a target sweetness simultaneously. Most recipes online just eyeball it or give
          you fixed ratios that only work for one specific proof of alcohol. I wanted
          something that works for any combination. Any proof, any batch size, any sweetness
          preference. And I got there.
        </p>

        <p>
          <button className="inline-link" onClick={() => setShowData(true)}>
            See the raw data →
          </button>
        </p>

        <h2>Validation</h2>

        <p>
          Math is great but it doesn't matter if the result doesn't taste good. Every batch
          got tasted. Multiple stages. After infusion, after initial dilution, after resting
          in the freezer. I adjusted the sweetness target based on what actually tasted
          balanced, not just what the numbers said. 200 grams per liter turned out to be
          the sweet spot for a classic limoncello. Not cloying, but that smooth syrupy body
          you want when you pour it ice cold.
        </p>

        <p>
          The lime was too intense on my first try. I'd recommend more like 20 to 25 limes
          next time instead of 18 for a 750ml batch. The grapefruit was the surprise hit
          though. Everyone at the party asked about it. Nobody expected grapefruit to work
          that well.
        </p>

        <div className="story-hero">
          <img
            src="/bottles-fridge.jpg"
            alt="Four bottles of citrus liqueur labeled grapefruit, orange, lemon, and lime"
            className="story-image"
          />
          <p className="story-caption">The finished product, ready to pour.</p>
        </div>

        <p>
          After serving these at my summer party, I'm pretty confident that more people
          would get into this if they knew how easy it is. The biggest hurdle is just
          knowing what ratios to use. That's literally it. That's what this tool solves.
        </p>

        <h2>This Is an Open Project</h2>

        <p>
          I definitely don't have all the answers. My data comes from my own batches. A
          handful of experiments with specific fruit from specific grocery stores in Utah.
          What I'd love is for other people to try these ratios, report
          back on what worked, and help refine the model over time.
        </p>

        <p>
          Think of this as an open-source recipe. The calculator gives you a solid starting
          point based on real measurements and real math. But the best version of this tool
          is going to come from a community of people all contributing their results.
          Different citrus varieties, different proofs, different climates, different taste
          preferences. All of that makes it better.
        </p>

        <p>
          If you make a batch using this calculator, I genuinely want to hear how it
          turned out. What worked? What didn't? Was the sweetness right? Did the infusion
          time feel too short or too long? Every single data point makes the next version
          better for everyone.
        </p>

        <p>
          <a
            href="https://www.reddit.com/r/limoncello/comments/1vgm7tz/limoncello_science/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
          >
            Join the conversation on Reddit →
          </a>
        </p>

        <div className="story-cta">
          <p>Ready to make your own?</p>
          <button className="btn-phase2" onClick={onBack}>
            Open the Calculator →
          </button>
        </div>
      </article>

      {/* Data Modal */}
      {showData && (
        <div className="modal-overlay" onClick={() => setShowData(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Raw Data</h2>
              <button className="modal-close" onClick={() => setShowData(false)}>✕</button>
            </div>

            <p className="data-intro">
              All measurements based on 750ml of 151-proof (75.5% ABV) Everclear.
              Fruit purchased from standard grocery stores in Utah.
            </p>

            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Lemon</th>
                  <th>Lime</th>
                  <th>Orange</th>
                  <th>Grapefruit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fruits used</td>
                  <td>20</td>
                  <td>18</td>
                  <td>11</td>
                  <td>8</td>
                </tr>
                <tr>
                  <td>Actual zest (g)</td>
                  <td>66</td>
                  <td>25</td>
                  <td>69</td>
                  <td>60</td>
                </tr>
                <tr>
                  <td>Zest per fruit (g)</td>
                  <td>3.3</td>
                  <td>1.4</td>
                  <td>6.3</td>
                  <td>7.5</td>
                </tr>
                <tr>
                  <td>Avg diameter (in)</td>
                  <td>2.5</td>
                  <td>1.75</td>
                  <td>3.25</td>
                  <td>4.0</td>
                </tr>
              </tbody>
            </table>

            <h3>Dilution Targets</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Target ABV</td>
                  <td>30% (default, adjustable 20-40%)</td>
                </tr>
                <tr>
                  <td>Target sweetness</td>
                  <td>200 g/L (default, adjustable 100-300)</td>
                </tr>
                <tr>
                  <td>Sugar displacement factor</td>
                  <td>0.62 ml per gram</td>
                </tr>
                <tr>
                  <td>Max simple syrup ratio</td>
                  <td>2:1 (sugar:water by mass)</td>
                </tr>
              </tbody>
            </table>

            <h3>How the Math Works</h3>
            <div className="data-formula">
              <p><strong>Given:</strong> alcohol volume, proof, target ABV, target sweetness</p>
              <p>Pure alcohol = volume × (proof / 200)</p>
              <p>Final volume = pure alcohol / target ABV</p>
              <p>Sugar = target sweetness × (final volume / 1000)</p>
              <p>Water = final volume - alcohol volume - (sugar × 0.62)</p>
            </div>

            <p className="data-note">
              This is a closed-form solution. Both ABV and sweetness targets are hit exactly.
              No iteration required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Story;
