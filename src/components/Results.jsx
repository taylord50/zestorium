import { useState } from 'react';

function Results({ recipe }) {
  const [showModal, setShowModal] = useState(false);

  const {
    citrusLabel,
    spiritMl,
    alcoholProof,
    zestGrams,
    numFruits,
    sugarGrams,
    waterMl,
    finalVolumeMl,
    actualAbv,
    actualSweetness,
    infusionRange,
    infusionMin,
    infusionMax,
    syrupFeasible,
    limitingFactor,
  } = recipe;

  // Calculate date range for Phase 2
  const today = new Date();
  const earliestDate = new Date(today);
  earliestDate.setDate(earliestDate.getDate() + infusionMin);
  const latestDate = new Date(today);
  latestDate.setDate(latestDate.getDate() + infusionMax);

  const formatDate = (d) => d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const earliestDateStr = formatDate(earliestDate);
  const latestDateStr = formatDate(latestDate);

  return (
    <section className="card results">
      <h2>Start your infusion today!</h2>
      <p className="card-subtitle">It's easier than you think. Three steps and you're done.</p>

      {!syrupFeasible && (
        <div className="warning">
          ⚠️ This combination requires more sugar than can dissolve in the available water.
          Try lowering your target ABV or reducing sweetness.
        </div>
      )}

      {limitingFactor === 'fruit' && (
        <div className="info-note">
          Your fruit is the limiting factor. Only {spiritMl}ml of alcohol will be used.
        </div>
      )}
      {limitingFactor === 'alcohol' && (
        <div className="info-note">
          Your alcohol is the limiting factor. You'll need ~{numFruits} {citrusLabel.toLowerCase()}s.
        </div>
      )}

      {/* Yield summary for "by ingredients" mode */}
      {(limitingFactor === 'fruit' || limitingFactor === 'alcohol') && (
        <div className="yield-summary">
          <span className="yield-value">{finalVolumeMl}ml</span>
          <span className="yield-detail">
            ≈ {Math.floor(finalVolumeMl / 44)} servings of {citrusLabel.toLowerCase()}cello
          </span>
        </div>
      )}

      {/* Phase 1: Infusion - always visible */}
      <div className="phase phase-1">
        <div className="results-grid">
          <div className="result-item">
            <span className="result-value">~{numFruits}</span>
            <span className="result-label">{citrusLabel}s</span>
          </div>
          <div className="result-item">
            <span className="result-value">{spiritMl}ml</span>
            <span className="result-label">{alcoholProof} proof</span>
          </div>
          <div className="result-item">
            <span className="result-value">{infusionRange}</span>
            <span className="result-label">Infusion time</span>
          </div>
        </div>

        <ol className="recipe-steps">
          <li>
            <strong>Wash the fruit.</strong> Scrub all {numFruits} {citrusLabel.toLowerCase()}s
            under hot water with a stiff bristle brush. Do this even if they're organic.
          </li>
          <li>
            <strong>Zest the fruit.</strong> Zest ~{numFruits} {citrusLabel.toLowerCase()}s
            using a microplane or fine grater.
            You should get about <strong>{zestGrams}g</strong> of zest total.
            Avoid the white pith — it's bitter.
          </li>
          <li>
            <strong>Combine zest + alcohol.</strong> Add all the zest
            to {spiritMl}ml of {alcoholProof}-proof spirit in a sealed glass jar.
          </li>
          <li>
            <strong>Store and wait.</strong> Keep in a cool, dark place
            for {infusionRange}. Shake gently once a day.
            The zest will turn pale when extraction is complete.
          </li>
        </ol>

        <div className="ready-date">
          <span className="ready-date-label">Next step ready:</span>
          <span className="ready-date-value">{earliestDateStr} to {latestDateStr}</span>
        </div>

        <div className="screenshot-note">
          📱 Take a screenshot or photo of this page. Your recipe isn't saved.
          Come back between <strong>{earliestDateStr}</strong> and <strong>{latestDateStr}</strong> and open Phase 2 below.
        </div>

        {/* Share Your Batch */}
        <div className="share-section">
          <h4>Started your batch? Share it.</h4>
          <p className="share-hint">Take a photo of your jar and post it. Here's a caption:</p>
          <div className="share-caption">
            <p className="caption-text">
              Just started a batch of {citrusLabel.toLowerCase()}cello. {numFruits} {citrusLabel.toLowerCase()}s, {spiritMl}ml of {alcoholProof}-proof, 5 minutes of prep. {Math.floor(finalVolumeMl / 44)} servings ready in {infusionRange}. Check what you can make: zestorium.com
            </p>
            <button
              className="btn-copy"
              onClick={() => {
                const caption = `Just started a batch of ${citrusLabel.toLowerCase()}cello. ${numFruits} ${citrusLabel.toLowerCase()}s, ${spiritMl}ml of ${alcoholProof}-proof, 5 minutes of prep. ${Math.floor(finalVolumeMl / 44)} servings ready in ${infusionRange}. Check what you can make: zestorium.com`;
                navigator.clipboard.writeText(caption);
              }}
            >
              Copy caption
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                className="btn-share"
                onClick={() => {
                  navigator.share({
                    title: 'My batch of ' + citrusLabel.toLowerCase() + 'cello',
                    text: `Just started a batch of ${citrusLabel.toLowerCase()}cello. ${numFruits} ${citrusLabel.toLowerCase()}s, ${spiritMl}ml of ${alcoholProof}-proof, 5 minutes of prep. Check what you can make:`,
                    url: 'https://zestorium.com',
                  });
                }}
              >
                Share
              </button>
            )}
          </div>
        </div>

        <button
          className="btn-phase2"
          onClick={() => setShowModal(true)}
        >
          View Phase 2: Filter &amp; Dilute →
        </button>
      </div>

      {/* Phase 2 Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Phase 2: Filter &amp; Dilute</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-screenshot-note">
              📱 <strong>Take a photo of this screen now.</strong> Your recipe isn't saved
              and will disappear when you leave the page.
            </div>

            <div className="results-grid">
              <div className="result-item">
                <span className="result-value">{sugarGrams}g</span>
                <span className="result-label">Sugar</span>
              </div>
              <div className="result-item">
                <span className="result-value">{waterMl}ml</span>
                <span className="result-label">Water</span>
              </div>
              <div className="result-item">
                <span className="result-value">{finalVolumeMl}ml</span>
                <span className="result-label">Final volume</span>
              </div>
            </div>

            <ol className="recipe-steps" start={5}>
              <li>
                <strong>Filter.</strong> Strain through a fine mesh strainer or cheesecloth
                to remove all zest. For extra clarity, follow with a coffee filter.
              </li>
              <li>
                <strong>Make simple syrup.</strong> Combine {sugarGrams}g sugar
                with {waterMl}ml water in a saucepan. Heat gently until fully dissolved.
                Cool completely.
              </li>
              <li>
                <strong>Combine.</strong> Mix the infused alcohol with the cooled syrup.
                Stir gently.
              </li>
              <li>
                <strong>Rest and serve.</strong> Transfer to the freezer for at least 24 hours.
                Serve ice cold.
              </li>
            </ol>

            <div className="final-note">
              <p>
                Makes <strong>{finalVolumeMl}ml</strong> of {citrusLabel.toLowerCase()}cello
                at <strong>{(actualAbv * 100).toFixed(1)}% ABV</strong> with
                {' '}<strong>{actualSweetness} g/L</strong> sweetness.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Results;
