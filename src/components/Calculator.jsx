import { useState, useEffect, useRef } from 'react';
import { CITRUS_DATA, PROOF_OPTIONS, DEFAULTS } from '../config/citrusData';
import { getMaxTargetAbv } from '../engine/calculate';

const SHOT_ML = 44; // standard shot size (1.5 oz)

function getTickValues(citrus) {
  const ticks = [];
  for (let v = citrus.minDiameter; v <= citrus.maxDiameter; v += 0.25) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

function FruitSizeSlider({ citrusType, fruitDiameter, onChange }) {
  const citrus = CITRUS_DATA[citrusType];
  const range = citrus.maxDiameter - citrus.minDiameter;
  const avgPos = ((citrus.avgDiameter - citrus.minDiameter) / range) * 100;

  return (
    <div className="input-group">
      <label>Fruit Size: {fruitDiameter}"</label>
      <div className="tick-slider">
        <input
          type="range"
          min={citrus.minDiameter}
          max={citrus.maxDiameter}
          step="0.25"
          value={fruitDiameter}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="tick-labels-positioned">
          <div className="tick-label" style={{ left: '0%' }}>
            <div className="tick-mark"></div>
            <span className="tick-inches">{citrus.minDiameter}"</span>
            <span className="tick-descriptor">small</span>
          </div>
          <div className="tick-label" style={{ left: `${avgPos}%` }}>
            <div className="tick-mark"></div>
            <span className="tick-inches">{citrus.avgDiameter}"</span>
            <span className="tick-descriptor">average</span>
          </div>
          <div className="tick-label" style={{ left: '100%' }}>
            <div className="tick-mark"></div>
            <span className="tick-inches">{citrus.maxDiameter}"</span>
            <span className="tick-descriptor">large</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Calculator({ onInputChange }) {
  const [mode, setMode] = useState('ingredients'); // 'ingredients' | 'servings'
  const [citrusType, setCitrusType] = useState(DEFAULTS.citrusType);
  const [alcoholProof, setAlcoholProof] = useState(DEFAULTS.alcoholProof);
  const [alcoholMl, setAlcoholMl] = useState(DEFAULTS.alcoholMl);
  const [numFruits, setNumFruits] = useState(CITRUS_DATA[DEFAULTS.citrusType].defaultFruits);
  const [fruitDiameter, setFruitDiameter] = useState(CITRUS_DATA[DEFAULTS.citrusType].avgDiameter);
  const [finalVolumeMl, setFinalVolumeMl] = useState(1000);
  const [targetAbv, setTargetAbv] = useState(DEFAULTS.targetAbv * 100);
  const [targetSweetness, setTargetSweetness] = useState(DEFAULTS.targetSweetness);
  const initialMount = useRef(true);

  // Compute max ABV based on current proof and sweetness
  const computedMax = getMaxTargetAbv(
    mode === 'ingredients' ? alcoholMl : finalVolumeMl * (targetAbv / 100) / (alcoholProof / 200),
    alcoholProof,
    targetSweetness
  ) * 100;
  const maxAbv = Math.min(40, Math.floor(computedMax));
  const clampedAbv = Math.min(targetAbv, maxAbv);

  // Number of servings for "by servings" mode
  const numServings = Math.floor(finalVolumeMl / SHOT_ML);

  // Emit state to parent
  const emit = (overrides = {}) => {
    const state = {
      mode,
      citrusType,
      alcoholProof,
      alcoholMl: Number(alcoholMl),
      numFruits: Number(numFruits),
      fruitDiameter: Number(fruitDiameter),
      finalVolumeMl: Number(finalVolumeMl),
      targetAbv: clampedAbv / 100,
      targetSweetness: Number(targetSweetness),
      ...overrides,
    };
    if (overrides.targetAbv === undefined) {
      state.targetAbv = Math.min(targetAbv, maxAbv) / 100;
    }
    onInputChange(state);
  };

  // Emit on every state change
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      emit();
      return;
    }
    emit();
  }, [mode, citrusType, alcoholProof, alcoholMl, numFruits, fruitDiameter, finalVolumeMl, targetAbv, targetSweetness]);

  // When proof changes, clamp ABV if needed
  const handleProofChange = (e) => {
    const newProof = Number(e.target.value);
    setAlcoholProof(newProof);
    const newMax = Math.min(40, Math.floor(getMaxTargetAbv(
      mode === 'ingredients' ? alcoholMl : finalVolumeMl * (targetAbv / 100) / (newProof / 200),
      newProof,
      targetSweetness
    ) * 100));
    if (targetAbv > newMax) {
      setTargetAbv(newMax);
    }
  };

  return (
    <section className="card calculator">
      <h2>Citrus Liqueur Calculator</h2>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'ingredients' ? 'active' : ''}`}
          onClick={() => setMode('ingredients')}
        >
          I have ingredients
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'servings' ? 'active' : ''}`}
          onClick={() => setMode('servings')}
        >
          I want a specific amount
        </button>
      </div>

      {/* Citrus Type */}
      <div className="input-group">
        <label>Citrus Type</label>
        <div className="citrus-selector">
          {Object.entries(CITRUS_DATA).map(([key, data]) => (
            <button
              key={key}
              type="button"
              className={`citrus-option ${citrusType === key ? 'active' : ''}`}
              onClick={() => { setCitrusType(key); setFruitDiameter(data.avgDiameter); setNumFruits(data.defaultFruits); }}
            >
              <img src={`/fruit-${key}.png`} alt={data.label} className="citrus-option-img" />
              <span className="citrus-label">{data.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alcohol Proof */}
      <div className="input-group">
        <label htmlFor="proof">Spirit Proof</label>
        <select
          id="proof"
          value={alcoholProof}
          onChange={handleProofChange}
        >
          {PROOF_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} proof ({p / 2}% ABV)
            </option>
          ))}
        </select>
      </div>

      {/* Mode-specific inputs */}
      {mode === 'ingredients' ? (
        <>
          <div className="input-group">
            <label htmlFor="volume">Spirit Volume (ml)</label>
            <input
              id="volume"
              type="number"
              min="50"
              max="10000"
              step="50"
              value={alcoholMl}
              onChange={(e) => setAlcoholMl(e.target.value)}
            />
            <span className="input-hint">A standard bottle is 750ml</span>
          </div>

          <div className="input-group">
            <label htmlFor="fruits">Number of {CITRUS_DATA[citrusType].label}s</label>
            <input
              id="fruits"
              type="number"
              min="1"
              max="100"
              step="1"
              value={numFruits}
              onChange={(e) => setNumFruits(e.target.value)}
            />
          </div>

          <FruitSizeSlider
            citrusType={citrusType}
            fruitDiameter={fruitDiameter}
            onChange={setFruitDiameter}
          />
        </>
      ) : (
        <>
          <div className="input-group">
            <label htmlFor="finalVol">Desired Final Volume (ml)</label>
            <input
              id="finalVol"
              type="number"
              min="200"
              max="10000"
              step="100"
              value={finalVolumeMl}
              onChange={(e) => setFinalVolumeMl(e.target.value)}
            />
            <span className="input-hint">
              That's about <strong>{numServings} servings</strong> (1.5oz / 44ml shots)
            </span>
          </div>

          <FruitSizeSlider
            citrusType={citrusType}
            fruitDiameter={fruitDiameter}
            onChange={setFruitDiameter}
          />
        </>
      )}

      {/* Target ABV */}
      <div className="input-group">
        <label htmlFor="abv">Target ABV: {clampedAbv}%</label>
        <div className="slider-container">
          <input
            id="abv"
            type="range"
            min="20"
            max="40"
            step="1"
            value={clampedAbv}
            onChange={(e) => setTargetAbv(Math.min(Number(e.target.value), maxAbv))}
          />
          {maxAbv < 40 && (
            <div
              className="slider-max-marker"
              style={{ left: `${((maxAbv - 20) / 20) * 100}%` }}
            >
              <div className="max-marker-line"></div>
              <span className="max-marker-label">max for {alcoholProof}pr</span>
            </div>
          )}
          {maxAbv < 40 && (
            <div
              className="slider-disabled-zone"
              style={{
                left: `${((maxAbv - 20) / 20) * 100}%`,
                width: `${((40 - maxAbv) / 20) * 100}%`,
              }}
            ></div>
          )}
        </div>
        <div className="range-labels">
          <span>20%</span>
          <span>30% (classic)</span>
          <span>40%</span>
        </div>
      </div>

      {/* Target Sweetness */}
      <div className="input-group">
        <label htmlFor="sweetness">Sweetness: {targetSweetness} g/L</label>
        <input
          id="sweetness"
          type="range"
          min="100"
          max="300"
          step="10"
          value={targetSweetness}
          onChange={(e) => setTargetSweetness(Number(e.target.value))}
        />
        <div className="range-labels">
          <span>100 (dry)</span>
          <span>200 (classic)</span>
          <span>300 (sweet)</span>
        </div>
      </div>
    </section>
  );
}

export default Calculator;
