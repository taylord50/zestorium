import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CITRUS_DATA } from '../config/citrusData';

import LiquidBottle from './LiquidBottle';
import FruitPhysics from './FruitPhysics';

const SPIRIT_OPTIONS = [
  { label: 'Vodka', sublabel: '80 proof', proof: 80 },
  { label: 'Vodka 100', sublabel: '100 proof', proof: 100 },
  { label: 'Everclear', sublabel: '151 proof', proof: 151 },
  { label: 'Everclear', sublabel: '190 proof', proof: 190 },
];

const pageVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

function Game({ onComplete }) {
  const [step, setStep] = useState(0);
  const [citrusType, setCitrusType] = useState(null);
  const [spirit, setSpirit] = useState(null);
  const [bottleLevel, setBottleLevel] = useState(0.75);
  const [fruitCount, setFruitCount] = useState(8);

  const handleCitrus = (type) => {
    setCitrusType(type);
    setFruitCount(CITRUS_DATA[type].defaultFruits);
    setTimeout(() => setStep(2), 100);
  };

  const handleSpiritAndBottleConfirm = () => {
    if (!spirit) return;
    setStep(3);
  };

  const handleFruitConfirm = () => {
    const spiritMl = Math.round(750 * bottleLevel);
    onComplete({
      citrusType,
      alcoholProof: spirit.proof,
      alcoholMl: spiritMl,
      numFruits: fruitCount,
    });
  };

  return (
    <div className="game">
      <AnimatePresence mode="wait">
        {/* Step 0: Intro / Hook */}
        {step === 0 && (
          <motion.div
            key="intro"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <p className="intro-tagline">Three ingredients. One week.<br />Your own limoncello.</p>
            <div className="intro-bottle-wrap">
              <LiquidBottle value={0.8} onChange={() => {}} />
            </div>
            <motion.button
              className="game-confirm"
              onClick={() => setStep(1)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Let's make some →
            </motion.button>
          </motion.div>
        )}

        {/* Step 1: Citrus Selection */}
        {step === 1 && (
          <motion.div
            key="citrus"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>Pick your flavor</h2>
            <div className="game-options game-options-grid">
              {Object.entries(CITRUS_DATA).map(([key, data]) => (
                <motion.button
                  key={key}
                  className="game-option"
                  onClick={() => handleCitrus(key)}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img
                    src={`/fruit-${key}.png`}
                    alt={data.label}
                    className="game-option-fruit-img"
                  />
                  <span className="game-option-label">{data.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Spirit + Bottle (merged) */}
        {step === 2 && (
          <motion.div
            key="spirit-bottle"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>How full is your bottle?</h2>
            <div className="spirit-bottle-layout">
              <div className="spirit-select-side">
                {SPIRIT_OPTIONS.map((s) => (
                  <motion.button
                    key={s.proof}
                    className={`spirit-pill ${spirit?.proof === s.proof ? 'active' : ''}`}
                    onClick={() => setSpirit(s)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="spirit-pill-label">{s.label}</span>
                    <span className="spirit-pill-sub">{s.sublabel}</span>
                  </motion.button>
                ))}
              </div>
              <div className="bottle-side">
                <LiquidBottle value={bottleLevel} onChange={setBottleLevel} />
              </div>
            </div>
            <motion.button
              className="game-confirm"
              onClick={handleSpiritAndBottleConfirm}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ opacity: spirit ? 1 : 0.4 }}
            >
              Let's add fruit!
            </motion.button>
          </motion.div>
        )}

        {/* Step 3: Fruit Physics */}
        {step === 3 && (
          <motion.div
            key="fruits"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>How many {CITRUS_DATA[citrusType]?.label.toLowerCase()}s do you have?</h2>
            <FruitPhysics
              citrusType={citrusType}
              onConfirm={(count) => {
                setFruitCount(count);
                handleFruitConfirm();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Game;
