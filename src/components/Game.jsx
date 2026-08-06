import { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CITRUS_DATA } from '../config/citrusData';

import LiquidBottle, { DEFAULT_PARAMS } from './LiquidBottle';

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

function FruitCounter({ citrusType, value, onChange }) {
  const citrus = CITRUS_DATA[citrusType];
  const maxFruits = 20;

  return (
    <div className="fruit-counter">
      <div className="fruit-display">
        <motion.span
          className="fruit-count-big"
          key={value}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          {value}
        </motion.span>
        <span className="fruit-count-label">{citrus.label.toLowerCase()}s</span>
      </div>
      <div className="fruit-grid">
        {Array.from({ length: maxFruits }, (_, i) => (
          <motion.button
            key={i}
            className={`fruit-dot ${i < value ? 'active' : ''}`}
            onClick={() => onChange(i + 1)}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            animate={i < value ? { opacity: 1, scale: 1 } : { opacity: 0.3, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          >
            {citrus.emoji}
          </motion.button>
        ))}
      </div>
      <p className="fruit-hint">Tap to set how many you have</p>
    </div>
  );
}

function Game({ onComplete }) {
  const [step, setStep] = useState(0);
  const [citrusType, setCitrusType] = useState(null);
  const [spirit, setSpirit] = useState(null);
  const [bottleLevel, setBottleLevel] = useState(0.75);
  const [fruitCount, setFruitCount] = useState(8);
  const [physicsParams, setPhysicsParams] = useState({ ...DEFAULT_PARAMS });

  const updateParam = (key, val) => {
    setPhysicsParams((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleCitrus = (type) => {
    setCitrusType(type);
    setFruitCount(CITRUS_DATA[type].defaultFruits);
    setTimeout(() => setStep(1), 100);
  };

  const handleSpirit = (s) => {
    setSpirit(s);
    setTimeout(() => setStep(2), 100);
  };

  const handleBottleConfirm = () => {
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
      {/* Debug Physics Sliders */}
      <div className="debug-panel" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(255,255,255,0.95)', padding: '8px 12px', fontSize: '11px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #ccc' }}>
        {[
          { key: 'damping', min: 0.9, max: 0.999, step: 0.001, label: 'Damping' },
          { key: 'tension', min: 0.005, max: 0.1, step: 0.005, label: 'Tension' },
          { key: 'spread', min: 0.05, max: 0.5, step: 0.05, label: 'Spread' },
          { key: 'tiltTarget', min: 50, max: 400, step: 10, label: 'Tilt Target' },
          { key: 'tiltPull', min: 0.005, max: 0.15, step: 0.005, label: 'Tilt Pull' },
          { key: 'dragDisturb', min: 0.02, max: 0.5, step: 0.02, label: 'Drag Disturb' },
        ].map(({ key, min, max, step, label }) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
            <span>{label}: {physicsParams[key]}</span>
            <input type="range" min={min} max={max} step={step} value={physicsParams[key]} onChange={(e) => updateParam(key, e.target.value)} style={{ width: '80px' }} />
          </label>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="citrus"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>What citrus do you have at home?</h2>
            <div className="game-options game-options-grid">
              {Object.entries(CITRUS_DATA).map(([key, data]) => (
                <motion.button
                  key={key}
                  className="game-option"
                  onClick={() => handleCitrus(key)}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="game-option-emoji">{data.emoji}</span>
                  <span className="game-option-label">{data.label}s</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="spirit"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>What spirit do you have?</h2>
            <div className="game-options game-options-list">
              {SPIRIT_OPTIONS.map((s) => (
                <motion.button
                  key={s.proof}
                  className="game-option-wide"
                  onClick={() => handleSpirit(s)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="game-option-label">{s.label}</span>
                  <span className="game-option-sublabel">{s.sublabel}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="bottle"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>How full is your bottle?</h2>
            <LiquidBottle value={bottleLevel} onChange={setBottleLevel} params={physicsParams} />
            <motion.button
              className="game-confirm"
              onClick={handleBottleConfirm}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              That's about right →
            </motion.button>
          </motion.div>
        )}

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
            <h2>How many {CITRUS_DATA[citrusType]?.label.toLowerCase()}s?</h2>
            <FruitCounter
              citrusType={citrusType}
              value={fruitCount}
              onChange={setFruitCount}
            />
            <motion.button
              className="game-confirm"
              onClick={handleFruitConfirm}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Show me what I can make →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Game;
