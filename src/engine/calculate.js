import { CITRUS_DATA, SUGAR_DISPLACEMENT } from '../config/citrusData';

/**
 * Reference: all citrus data was measured with 750ml of 151-proof (75.5% ABV).
 * Pure alcohol in reference = 750 * 0.755 = 566.25ml
 * Zest scales with pure alcohol content, not spirit volume.
 */
const REFERENCE_PURE_ALCOHOL_ML = 566.25;

/**
 * Mode 1 (byIngredients): User specifies spirit volume + number of fruits.
 */
export function calculateByIngredients({ alcoholMl, numFruits, alcoholProof, citrusType, targetAbv, targetSweetness, fruitDiameter }) {
  const citrus = CITRUS_DATA[citrusType];
  const k = SUGAR_DISPLACEMENT;

  // Spirit properties
  const pureAlcoholMl = alcoholMl * (alcoholProof / 200);
  const waterInSpirit = alcoholMl - pureAlcoholMl;

  // Adjust zest per fruit based on user's fruit size vs average
  const diameter = fruitDiameter || citrus.avgDiameter;
  const sizeRatio = Math.pow(diameter / citrus.avgDiameter, 2);
  const adjustedZestPerFruit = citrus.zestPerFruit * sizeRatio;

  // Zest requirement scales with pure alcohol
  const zestPerMlPureAlcohol = citrus.zestPer750ml / REFERENCE_PURE_ALCOHOL_ML;
  const zestRequiredForSpirit = zestPerMlPureAlcohol * pureAlcoholMl;

  // Zest available from user's fruit
  const zestAvailable = numFruits * adjustedZestPerFruit;

  // Determine limiting factor
  let effectivePureAlcohol;
  let effectiveSpiritMl;
  let effectiveWaterInSpirit;
  let effectiveFruits;
  let effectiveZest;
  let limitingFactor;

  if (zestAvailable <= zestRequiredForSpirit) {
    // Fruit is the constraint
    effectiveZest = zestAvailable;
    effectivePureAlcohol = effectiveZest / zestPerMlPureAlcohol;
    effectiveSpiritMl = effectivePureAlcohol / (alcoholProof / 200);
    effectiveWaterInSpirit = effectiveSpiritMl - effectivePureAlcohol;
    effectiveFruits = numFruits;
    limitingFactor = 'fruit';
  } else {
    // Alcohol is the constraint
    effectivePureAlcohol = pureAlcoholMl;
    effectiveSpiritMl = alcoholMl;
    effectiveWaterInSpirit = waterInSpirit;
    effectiveZest = zestRequiredForSpirit;
    effectiveFruits = effectiveZest / adjustedZestPerFruit;
    limitingFactor = 'alcohol';
  }

  // Dilution math (accounting for water already in spirit)
  const finalVolumeMl = effectivePureAlcohol / targetAbv;
  const sugarGrams = targetSweetness * (finalVolumeMl / 1000);
  const sugarVolumeMl = sugarGrams * k;
  const totalWaterNeeded = finalVolumeMl - effectivePureAlcohol - sugarVolumeMl;
  const additionalWater = totalWaterNeeded - effectiveWaterInSpirit;

  // Simple syrup check (sugar dissolves in the additional water we add)
  const syrupRatio = additionalWater > 0 ? sugarGrams / additionalWater : Infinity;
  const syrupFeasible = syrupRatio <= 2.0 && additionalWater > 0;

  // Infusion time lookup
  let infusionMin, infusionMax;
  if (alcoholProof >= 151) {
    infusionMin = 5;
    infusionMax = 7;
  } else if (alcoholProof >= 100) {
    infusionMin = 10;
    infusionMax = 14;
  } else {
    infusionMin = 14;
    infusionMax = 21;
  }

  return {
    citrusType,
    citrusLabel: citrus.label,
    spiritMl: round(effectiveSpiritMl),
    alcoholProof,
    targetAbv,
    targetSweetness,
    limitingFactor,
    pureAlcoholMl: round(effectivePureAlcohol),
    finalVolumeMl: round(finalVolumeMl),
    sugarGrams: round(sugarGrams),
    waterMl: round(Math.max(0, additionalWater)),
    zestGrams: round(effectiveZest),
    numFruits: Math.ceil(effectiveFruits),
    infusionMin,
    infusionMax,
    infusionRange: `${infusionMin}\u2013${infusionMax} days`,
    syrupRatio: round(syrupRatio, 2),
    syrupFeasible,
    actualAbv: round(effectivePureAlcohol / finalVolumeMl, 4),
    actualSweetness: round(sugarGrams / (finalVolumeMl / 1000), 1),
    fruitDiameter: diameter,
    adjustedZestPerFruit: round(adjustedZestPerFruit, 1),
  };
}

/**
 * Mode 2 (byServings): User specifies desired final volume.
 */
export function calculateByServings({ finalVolumeMl, alcoholProof, citrusType, targetAbv, targetSweetness, fruitDiameter }) {
  const citrus = CITRUS_DATA[citrusType];
  const k = SUGAR_DISPLACEMENT;

  // Adjust zest per fruit based on user's fruit size vs average
  const diameter = fruitDiameter || citrus.avgDiameter;
  const sizeRatio = Math.pow(diameter / citrus.avgDiameter, 2);
  const adjustedZestPerFruit = citrus.zestPerFruit * sizeRatio;

  // Work backwards from desired final volume
  const pureAlcoholMl = finalVolumeMl * targetAbv;
  const spiritMl = pureAlcoholMl / (alcoholProof / 200);
  const waterInSpirit = spiritMl - pureAlcoholMl;

  const sugarGrams = targetSweetness * (finalVolumeMl / 1000);
  const sugarVolumeMl = sugarGrams * k;
  const totalWaterNeeded = finalVolumeMl - pureAlcoholMl - sugarVolumeMl;
  const additionalWater = totalWaterNeeded - waterInSpirit;

  // Simple syrup check
  const syrupRatio = additionalWater > 0 ? sugarGrams / additionalWater : Infinity;
  const syrupFeasible = syrupRatio <= 2.0 && additionalWater > 0;

  // Zest and fruit (scales with pure alcohol)
  const zestPerMlPureAlcohol = citrus.zestPer750ml / REFERENCE_PURE_ALCOHOL_ML;
  const zestGrams = zestPerMlPureAlcohol * pureAlcoholMl;
  const numFruits = zestGrams / adjustedZestPerFruit;

  // Infusion time lookup
  let infusionMin, infusionMax;
  if (alcoholProof >= 151) {
    infusionMin = 5;
    infusionMax = 7;
  } else if (alcoholProof >= 100) {
    infusionMin = 10;
    infusionMax = 14;
  } else {
    infusionMin = 14;
    infusionMax = 21;
  }

  return {
    citrusType,
    citrusLabel: citrus.label,
    spiritMl: round(spiritMl),
    alcoholProof,
    targetAbv,
    targetSweetness,
    limitingFactor: 'servings',
    pureAlcoholMl: round(pureAlcoholMl),
    finalVolumeMl: round(finalVolumeMl),
    sugarGrams: round(sugarGrams),
    waterMl: round(Math.max(0, additionalWater)),
    zestGrams: round(zestGrams),
    numFruits: Math.ceil(numFruits),
    infusionMin,
    infusionMax,
    infusionRange: `${infusionMin}\u2013${infusionMax} days`,
    syrupRatio: round(syrupRatio, 2),
    syrupFeasible,
    actualAbv: round(pureAlcoholMl / finalVolumeMl, 4),
    actualSweetness: round(sugarGrams / (finalVolumeMl / 1000), 1),
  };
}

/**
 * Compute the maximum target ABV that still allows a feasible simple syrup.
 */
export function getMaxTargetAbv(spiritMl, alcoholProof, targetSweetness) {
  const pureAlcohol = spiritMl * (alcoholProof / 200);
  const waterInSpirit = spiritMl - pureAlcohol;
  const k = SUGAR_DISPLACEMENT;

  // We need: additionalWater >= sugar / 2
  // additionalWater = finalVol - pureAlcohol - sugarVol - waterInSpirit
  // finalVol = pureAlcohol / T
  // sugar = sweetness * finalVol / 1000
  // sugarVol = sugar * k
  // Solving: pureAlcohol/T - pureAlcohol - sweetness*pureAlcohol/(T*1000)*k - waterInSpirit >= sweetness*pureAlcohol/(T*1000) / 2
  // This is complex, so let's just iterate to find it
  for (let t = 0.40; t >= 0.15; t -= 0.01) {
    const finalVol = pureAlcohol / t;
    const sugar = targetSweetness * finalVol / 1000;
    const sugarVol = sugar * k;
    const totalWater = finalVol - pureAlcohol - sugarVol;
    const addWater = totalWater - waterInSpirit;
    if (addWater > 0 && sugar / addWater <= 2.0) {
      return t;
    }
  }
  return 0.20;
}

function round(value, decimals = 0) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
