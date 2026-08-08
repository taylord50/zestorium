import { useState } from 'react';
import Calculator from './components/Calculator';
import Results from './components/Results';
import Story from './components/Story';
import Game from './components/Game';
import BottlePhysics from './components/BottlePhysics';
// import FruitPhysicsDebug from './components/FruitPhysicsDebug';
import { calculateByIngredients, calculateByServings } from './engine/calculate';
import { CITRUS_DATA } from './config/citrusData';
import './App.css';

function App() {
  const [recipe, setRecipe] = useState(null);
  const [page, setPage] = useState('bottle-proto'); // 'bottle-proto' | 'game' | 'calculator' | 'story'
  const [gameDefaults, setGameDefaults] = useState(null);
  // const [debugFruit, setDebugFruit] = useState(true); // start on fruit step for debugging

  const handleInputChange = (state) => {
    let result;
    if (state.mode === 'ingredients') {
      result = calculateByIngredients({
        alcoholMl: state.alcoholMl,
        numFruits: state.numFruits,
        fruitDiameter: state.fruitDiameter,
        alcoholProof: state.alcoholProof,
        citrusType: state.citrusType,
        targetAbv: state.targetAbv,
        targetSweetness: state.targetSweetness,
      });
    } else {
      result = calculateByServings({
        finalVolumeMl: state.finalVolumeMl,
        alcoholProof: state.alcoholProof,
        citrusType: state.citrusType,
        targetAbv: state.targetAbv,
        targetSweetness: state.targetSweetness,
        fruitDiameter: state.fruitDiameter,
      });
    }
    setRecipe(result);

    if (window.plausible) {
      window.plausible('Recipe Calculated', {
        props: { citrus: state.citrusType, proof: state.alcoholProof, mode: state.mode },
      });
    }
  };

  const handleGameComplete = (choices) => {
    setGameDefaults(choices);
    setPage('calculator');

    // Immediately calculate with game choices
    const citrus = CITRUS_DATA[choices.citrusType];
    const result = calculateByIngredients({
      alcoholMl: choices.alcoholMl,
      numFruits: choices.numFruits,
      fruitDiameter: citrus.avgDiameter,
      alcoholProof: choices.alcoholProof,
      citrusType: choices.citrusType,
      targetAbv: 0.30,
      targetSweetness: 200,
    });
    setRecipe(result);

    if (window.plausible) {
      window.plausible('Game Completed', {
        props: { citrus: choices.citrusType, proof: choices.alcoholProof },
      });
    }
  };

  if (page === 'bottle-proto') {
    return <BottlePhysics />;
  }

  if (page === 'story') {
    return <Story onBack={() => setPage('calculator')} />;
  }

  if (page === 'game') {
    /* Debug: uncomment to skip straight to fruit physics tuning
    if (debugFruit) {
      return (
        <div className="app app-game" style={{ maxWidth: '100%', flexDirection: 'row', padding: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
            <FruitPhysicsDebug citrusType="lemon" />
          </div>
        </div>
      );
    }
    */
    return (
      <div className="app app-game">
        <header className="header">
          <h1 className="logo">Zestorium</h1>
        </header>
        <Game onComplete={handleGameComplete} onSkipToCalculator={() => setPage('calculator')} />
        <p className="skip-link">
          <button onClick={() => setPage('calculator')}>Skip to full calculator →</button>
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Zestorium</h1>
        <p className="tagline">
          Making any citrus liqueur at home is easy. You can do it in any amount,
          starting with ingredients you probably already have.
        </p>
        <button className="story-link" onClick={() => setPage('story')}>
          See the results — our story →
        </button>
      </header>

      <main className="main">
        <Calculator onInputChange={handleInputChange} gameDefaults={gameDefaults} />
        {recipe && <Results recipe={recipe} />}
      </main>

      <footer className="footer">
        <p className="footer-tagline">Made with 🍋 and obsessive measurement.</p>
        <p>
          <a
            href="https://www.reddit.com/r/limoncello/comments/1vgm7tz/limoncello_science/"
            target="_blank"
            rel="noopener noreferrer"
            className="feedback-link"
          >
            Made this? Share your results or request a new feature on Reddit →
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
