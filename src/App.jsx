import { useState } from 'react';
import Calculator from './components/Calculator';
import Results from './components/Results';
import Story from './components/Story';
import { calculateByIngredients, calculateByServings } from './engine/calculate';
import './App.css';

function App() {
  const [recipe, setRecipe] = useState(null);
  const [page, setPage] = useState('calculator'); // 'calculator' | 'story'

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

  if (page === 'story') {
    return <Story onBack={() => setPage('calculator')} />;
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
        <Calculator onInputChange={handleInputChange} />
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
