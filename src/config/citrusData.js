/**
 * Citrus constants derived from empirical testing.
 * All zest/fruit values are per 750ml of alcohol.
 */
export const CITRUS_DATA = {
  lemon: {
    label: 'Lemon',
    emoji: '🍋',
    zestPer750ml: 66,      // grams of zest per 750ml alcohol
    fruitsPer750ml: 20,    // number of fruits per 750ml alcohol
    avgDiameter: 2.5,      // inches
    minDiameter: 2.0,      // 10th percentile
    maxDiameter: 3.0,      // 90th percentile
    zestPerFruit: 3.3,     // grams (66/20)
    defaultFruits: 12,     // Costco bag
  },
  lime: {
    label: 'Lime',
    emoji: '🍋‍🟩',
    zestPer750ml: 25,
    fruitsPer750ml: 18,
    avgDiameter: 1.75,
    minDiameter: 1.25,
    maxDiameter: 2.25,
    zestPerFruit: 1.39,    // grams (25/18)
    defaultFruits: 15,     // Costco bag
  },
  orange: {
    label: 'Orange',
    emoji: '🍊',
    zestPer750ml: 69,
    fruitsPer750ml: 15,
    avgDiameter: 3.25,
    minDiameter: 2.75,
    maxDiameter: 4.0,
    zestPerFruit: 4.6,     // grams (69/15)
    defaultFruits: 12,     // Costco bag
  },
  grapefruit: {
    label: 'Grapefruit',
    emoji: '🩷',
    zestPer750ml: 60,
    fruitsPer750ml: 10,
    avgDiameter: 4.25,
    minDiameter: 3.5,
    maxDiameter: 5.25,
    zestPerFruit: 7.5,     // grams (60/8)
    defaultFruits: 8,      // Costco bag
  },
};

export const PROOF_OPTIONS = [80, 90, 100, 120, 151, 190];

export const DEFAULTS = {
  citrusType: 'lemon',
  alcoholProof: 100,
  alcoholMl: 750,
  targetAbv: 0.30,
  targetSweetness: 200, // g/L
};

export const SUGAR_DISPLACEMENT = 0.62; // ml per gram of sugar
