import { getCostRate, getIntensityColor, getRegionPrice } from '../data/regions.js';

/**
 * Calculate carbon emissions for a workload in a specific region
 */
export function calculateCarbon(watts, durationHours, carbonIntensity, runsPerMonth, regionId) {
  const energyKwh = (watts / 1000) * durationHours;
  const co2Grams = energyKwh * carbonIntensity;
  const co2Kg = co2Grams / 1000;
  const monthlyCo2Kg = co2Kg * runsPerMonth;
  const yearlyCo2Kg = monthlyCo2Kg * 12;

  // Equivalents
  const kmDriven = co2Kg * 6.3;
  const treesNeeded = co2Kg / 21.7;
  const phoneCharges = co2Kg / 0.00886;
  const beefGrams = co2Kg / 0.027;

  // Real region-specific pricing
  const regionPrice = getRegionPrice(regionId);
  const costPerRun = regionPrice * durationHours;
  const monthlyCost = costPerRun * runsPerMonth;
  const yearlyCost = monthlyCost * 12;

  return {
    energyKwh,
    co2Grams,
    co2Kg,
    monthlyCo2Kg,
    yearlyCo2Kg,
    kmDriven,
    treesNeeded,
    phoneCharges,
    beefGrams,
    costPerRun,
    monthlyCost,
    yearlyCost,
    regionPrice,
    color: getIntensityColor(carbonIntensity),
  };
}

/**
 * Calculate Carbon ROI: comparing best vs a reference region
 */
export function calculateROI(bestResult, worstResult, runsPerMonth) {
  const carbonSavedPerRun = worstResult.co2Kg - bestResult.co2Kg;
  const carbonSavedYearly = carbonSavedPerRun * runsPerMonth * 12;
  const costDiffPerRun = worstResult.costPerRun - bestResult.costPerRun;
  const costSavedMonthly = costDiffPerRun * runsPerMonth;
  const costSavedYearly = costSavedMonthly * 12;
  // Positive costSaved = you save money by going green; negative = going green costs more
  const carbonPctSaved = worstResult.co2Kg > 0
    ? Math.round((1 - bestResult.co2Kg / worstResult.co2Kg) * 100) : 0;

  return {
    carbonSavedPerRun,
    carbonSavedYearly,
    costDiffPerRun,
    costSavedMonthly,
    costSavedYearly,
    carbonPctSaved,
    // Is going green also cheaper?
    greenIsCheaper: costDiffPerRun >= 0,
  };
}

/**
 * Parse duration input to hours
 */
export function parseDuration(value, unit) {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 0;
  switch (unit) {
    case 'minutes': return num / 60;
    case 'hours': return num;
    case 'days': return num * 24;
    default: return num;
  }
}

/**
 * Format numbers nicely
 */
export function fmt(num, decimals = 1) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  if (num < 0.01 && num > 0) return num.toFixed(4);
  return num.toFixed(decimals);
}
