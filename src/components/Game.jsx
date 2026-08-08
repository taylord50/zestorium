import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CITRUS_DATA } from '../config/citrusData';

import LiquidBottle from './LiquidBottle';
import FruitPhysics from './FruitPhysics';

const SPIRIT_OPTIONS = [
  { label: '80 proof', proof: 80 },
  { label: '90 proof', proof: 90 },
  { label: '100 proof', proof: 100 },
  { label: '151 proof', proof: 151 },
  { label: '190 proof', proof: 190 },
];

// Minimum fruits needed per type (will be adjusted later)
const MIN_FRUITS = {
  lemon: 6,
  lime: 5,
  orange: 3,
  grapefruit: 2,
};

const pageVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

function Game({ onComplete, onSkipToCalculator }) {
  const [step, setStep] = useState(0);
  const [citrusType, setCitrusType] = useState(null);
  const [spirit, setSpirit] = useState(null);
  const [bottleLevel, setBottleLevel] = useState(0.75);
  const [fruitCount, setFruitCount] = useState(8);

  // Gyro permission — request on first user gesture
  const gyroGrantedRef = useRef(false);
  const requestGyro = useCallback(async () => {
    if (gyroGrantedRef.current) return;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') gyroGrantedRef.current = true;
      } else {
        gyroGrantedRef.current = true;
      }
    } catch (e) { /* denied or failed */ }
  }, []);

  const handleCitrus = (type) => {
    setCitrusType(type);
    setFruitCount(CITRUS_DATA[type].defaultFruits);
    setTimeout(() => setStep(2), 100);
  };

  const handleFruitConfirm = (count) => {
    setFruitCount(count);
    setStep(3);
  };

  const handleFinalConfirm = () => {
    if (!spirit) return;
    const spiritMl = Math.round(750 * bottleLevel);
    onComplete({
      citrusType,
      alcoholProof: spirit.proof,
      alcoholMl: spiritMl,
      numFruits: fruitCount,
    });
  };

  // Request gyro on intro button tap (Option A)
  const handleIntroNext = () => {
    requestGyro();
    setStep(1);
  };

  return (
    <div className="game">
      {step > 0 && (
        <button className="game-back" onClick={() => setStep(step - 1)}>← Back</button>
      )}
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
              <LiquidBottle value={0.8} onChange={() => {}} readOnly liquidColor="rgba(255, 248, 180, 0.85)" bottleImage="/bottle-nolabel.png" />
            </div>
            <motion.button
              className="game-confirm"
              onClick={handleIntroNext}
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
            <p className="step-intro">We'll build your recipe<br />from what's in your kitchen.</p>
            <p className="step-question">What citrus do you have?</p>
            <div className="game-options game-options-grid">
              {Object.entries(CITRUS_DATA).map(([key, data]) => (
                <motion.button
                  key={key}
                  className="game-option"
                  onClick={() => handleCitrus(key)}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="game-option-img-box">
                    <img
                      src={`/fruit-${key}.png`}
                      alt={data.label}
                      className="game-option-fruit-img"
                    />
                  </div>
                  <span className="game-option-label">{data.label}</span>
                  <span className="game-option-min">at least {MIN_FRUITS[key]}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Fruit Physics */}
        {step === 2 && (
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
              onConfirm={handleFruitConfirm}
            />
          </motion.div>
        )}

        {/* Step 3: Spirit + Bottle */}
        {step === 3 && (
          <motion.div
            key="spirit-bottle"
            className="game-step"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2>You'll also need vodka.<br /><strong>What do you have?</strong></h2>
            <div className="spirit-bottle-layout">
              <div className="spirit-select-side">
                <p className="spirit-proof-label">Choose your proof</p>
                {SPIRIT_OPTIONS.map((s) => (
                  <motion.button
                    key={s.proof}
                    className={`spirit-pill ${spirit?.proof === s.proof ? 'active' : ''}`}
                    onClick={() => setSpirit(s)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="spirit-pill-label">{s.label}</span>
                  </motion.button>
                ))}
              </div>
              <div className="bottle-side">
                <LiquidBottle value={bottleLevel} onChange={setBottleLevel} />
                <div className="swipe-hint-side">
                  <div className="swipe-arrows">
                    <span className="swipe-arrow-up">↑</span>
                    <span className="swipe-arrow-down">↓</span>
                  </div>
                  <p className="swipe-hint-text">Swipe to set<br />your amount</p>
                </div>
              </div>
            </div>
            <motion.button
              className="game-confirm"
              onClick={handleFinalConfirm}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ opacity: spirit ? 1 : 0.4 }}
            >
              Show me my recipe →
            </motion.button>
            <button
              className="skip-vodka-link"
              onClick={onSkipToCalculator}
            >
              I don't have vodka → Skip to calculator
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Game;
