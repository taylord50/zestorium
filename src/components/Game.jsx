import { useState } from 'react';
import { CITRUS_DATA, PROOF_OPTIONS } from '../config/citrusData';

const BOTTLE_LEVELS = [
  { label: 'Almost empty', value: 0.2, visual: '▁' },
  { label: 'Quarter full', value: 0.25, visual: '▂' },
  { label: 'Half full', value: 0.5, visual: '▄' },
  { label: 'Three quarters', value: 0.75, visual: '▆' },
  { label: 'Full bottle', value: 1.0, visual: '█' },
];

const SPIRIT_OPTIONS = [
  { label: 'Vodka (80 proof)', proof: 80, emoji: '🍸' },
  { label: 'Vodka 100 (100 proof)', proof: 100, emoji: '🍸' },
  { label: 'Everclear 151', proof: 151, emoji: '🔥' },
  { label: 'Everclear 190', proof: 190, emoji: '🔥' },
];

function Game({ onComplete }) {
  const [step, setStep] = useState(0);
  const [citrusType, setCitrusType] = useState(null);
  const [spirit, setSpirit] = useState(null);
  const [bottleLevel, setBottleLevel] = useState(null);
  const [fruitCount, setFruitCount] = useState(null);

  const handleCitrus = (type) => {
    setCitrusType(type);
    setStep(1);
  };

  const handleSpirit = (s) => {
    setSpirit(s);
    setStep(2);
  };

  const handleBottle = (level) => {
    setBottleLevel(level);
    setStep(3);
  };

  const handleFruitCount = (count) => {
    setFruitCount(count);
    // Calculate and reveal
    const spiritMl = Math.round(750 * bottleLevel.value);
    onComplete({
      citrusType,
      alcoholProof: spirit.proof,
      alcoholMl: spiritMl,
      numFruits: count,
    });
  };

  const citrus = citrusType ? CITRUS_DATA[citrusType] : null;

  return (
    <div className="game">
      {step === 0 && (
        <div className="game-step">
          <h2>What citrus do you have?</h2>
          <div className="game-options game-options-grid">
            {Object.entries(CITRUS_DATA).map(([key, data]) => (
              <button
                key={key}
                className="game-option"
                onClick={() => handleCitrus(key)}
              >
                <span className="game-option-emoji">{data.emoji}</span>
                <span className="game-option-label">{data.label}s</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="game-step">
          <h2>What spirit do you have?</h2>
          <div className="game-options game-options-list">
            {SPIRIT_OPTIONS.map((s) => (
              <button
                key={s.proof}
                className="game-option-wide"
                onClick={() => handleSpirit(s)}
              >
                <span className="game-option-emoji">{s.emoji}</span>
                <span className="game-option-label">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="game-step">
          <h2>How full is your bottle?</h2>
          <div className="game-options game-options-bottles">
            {BOTTLE_LEVELS.map((level) => (
              <button
                key={level.value}
                className="game-option-bottle"
                onClick={() => handleBottle(level)}
              >
                <div className="bottle-visual">
                  <div
                    className="bottle-fill"
                    style={{ height: `${level.value * 100}%` }}
                  ></div>
                </div>
                <span className="game-option-label">{level.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="game-step">
          <h2>How many {citrus.label.toLowerCase()}s do you have?</h2>
          <div className="game-options game-options-counts">
            {[3, 5, 6, 8, 10, 12, 15, 20].map((count) => (
              <button
                key={count}
                className="game-option-count"
                onClick={() => handleFruitCount(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
