// ============================================
// BG SIMULATION ENGINE
// Simple, predictable, config-driven.
// ============================================

import { state, updateBG, updateEnergy } from './game-state.js';

export const BGConfig = {
  // Carb impact
  carbRaisePer1g: 0.1,        // 1g carbs raises BG by 0.1 mmol/L
  carbAbsorptionFast: 0.5,    // hours to fully absorb fast carbs
  carbAbsorptionSlow: 2.0,    // hours for slow carbs (protein, fat, fibre)

  // Insulin impact
  insulinDropPer1u: 3.0,      // 1 unit lowers BG by 3.0 mmol/L
  insulinOnsetDelay: 0.25,    // hours before insulin starts working
  insulinPeakTime: 1.0,       // hours to peak effect
  insulinDuration: 4.0,       // hours of total action

  // Exercise
  exerciseDropPerHour: 1.0,   // mmol/L per hour moderate exercise
  postExerciseDrop: 0.5,      // continues for this many hours after

  // Basal drift (without insulin, BG rises slowly)
  basalDriftPerHour: 0.3,
  basalInsulinPerHour: 0.3,   // basal insulin counteracts drift

  // Stress/illness modifiers
  stressRisePerHour: 0.5,
  illnessRisePerHour: 1.0,

  // Target range
  targetLow: 5.0,
  targetHigh: 12.0,

  // Clamp
  minBG: 2.0,
  maxBG: 30.0,

  // Energy mapping
  energyDrain: [
    { min: 5, max: 12, drainPerHour: 0 },       // optimal
    { min: 12, max: 15, drainPerHour: 5 },       // mild high
    { min: 15, max: 30, drainPerHour: 15 },      // very high
    { min: 3, max: 5, drainPerHour: 10 },        // mild low
    { min: 2, max: 3, drainPerHour: 25 },        // very low
  ],

  // Energy recovery when in range
  energyRecoveryPerHour: 10,

  // Insulin-to-carb ratio for tutorial
  carbRatio: 10, // 1 unit per 10g carbs
  correctionFactor: 3.0, // 1 unit drops BG by 3 mmol/L
  correctionTarget: 8.0  // correct toward this value
};

// Active modifiers
let exerciseActive = false;
let exerciseEndTime = 0;
let stressActive = false;
let illnessActive = false;

export function setExercise(active) {
  exerciseActive = active;
  if (!active) exerciseEndTime = state.time.hour + BGConfig.postExerciseDrop;
}

export function setStress(active) { stressActive = active; }
export function setIllness(active) { illnessActive = active; }

// Eat food: adds carbs to pending absorption
export function eatFood(carbsGrams, speed = 'fast') {
  state.carbs.pending.push({
    time: state.time.hour,
    grams: carbsGrams,
    speed,
    absorbed: 0
  });
}

// Take insulin dose
export function doseInsulin(units, type = 'meal') {
  state.insulin.pendingDoses.push({
    time: state.time.hour,
    units,
    type,
    delivered: 0
  });
}

// Calculate recommended dose for a meal
export function recommendedDose(carbsGrams, currentBG) {
  const mealDose = carbsGrams / BGConfig.carbRatio;
  let correctionDose = 0;
  if (currentBG > BGConfig.correctionTarget) {
    correctionDose = (currentBG - BGConfig.correctionTarget) / BGConfig.correctionFactor;
  }
  return Math.round((mealDose + correctionDose) * 2) / 2; // round to nearest 0.5
}

// Main simulation tick
export function tick(deltaHours) {
  if (deltaHours <= 0) return;

  let bgDelta = 0;

  // 1. Process carb absorption
  for (const carb of state.carbs.pending) {
    if (carb.absorbed >= carb.grams) continue;
    const rate = carb.speed === 'fast' ? BGConfig.carbAbsorptionFast : BGConfig.carbAbsorptionSlow;
    const absorbThisTick = Math.min(
      (carb.grams / rate) * deltaHours,
      carb.grams - carb.absorbed
    );
    carb.absorbed += absorbThisTick;
    bgDelta += absorbThisTick * BGConfig.carbRaisePer1g;
  }

  // Clean up fully absorbed carbs
  state.carbs.pending = state.carbs.pending.filter(c => c.absorbed < c.grams);

  // 2. Process insulin
  for (const dose of state.insulin.pendingDoses) {
    if (dose.delivered >= dose.units) continue;
    const elapsed = state.time.hour - dose.time;
    if (elapsed < BGConfig.insulinOnsetDelay) continue; // not active yet

    const activeTime = elapsed - BGConfig.insulinOnsetDelay;
    if (activeTime > BGConfig.insulinDuration) {
      dose.delivered = dose.units;
      continue;
    }

    // Simple linear delivery over duration
    const deliverThisTick = Math.min(
      (dose.units / BGConfig.insulinDuration) * deltaHours,
      dose.units - dose.delivered
    );
    dose.delivered += deliverThisTick;
    bgDelta -= deliverThisTick * BGConfig.insulinDropPer1u;
  }

  // Clean up fully delivered doses
  state.insulin.pendingDoses = state.insulin.pendingDoses.filter(d => d.delivered < d.units);

  // Update insulin on board
  state.insulin.onBoard = state.insulin.pendingDoses.reduce(
    (sum, d) => sum + (d.units - d.delivered), 0
  );

  // 3. Exercise
  if (exerciseActive) {
    bgDelta -= BGConfig.exerciseDropPerHour * deltaHours;
  } else if (state.time.hour < exerciseEndTime) {
    bgDelta -= (BGConfig.exerciseDropPerHour * 0.5) * deltaHours;
  }

  // 4. Stress/illness
  if (stressActive) bgDelta += BGConfig.stressRisePerHour * deltaHours;
  if (illnessActive) bgDelta += BGConfig.illnessRisePerHour * deltaHours;

  // 5. Basal drift vs basal insulin
  if (state.insulin.basalActive) {
    // Basal insulin roughly cancels drift
    bgDelta += (BGConfig.basalDriftPerHour - BGConfig.basalInsulinPerHour) * deltaHours;
  } else {
    bgDelta += BGConfig.basalDriftPerHour * deltaHours;
  }

  // 6. Apply and clamp
  const newBG = Math.max(BGConfig.minBG, Math.min(BGConfig.maxBG, state.bg.current + bgDelta));

  // Determine trend
  const diff = newBG - state.bg.current;
  let trend = 'stable';
  if (diff > 0.5 * deltaHours) trend = 'rising';
  if (diff > 1.5 * deltaHours) trend = 'rising_fast';
  if (diff < -0.5 * deltaHours) trend = 'falling';
  if (diff < -1.5 * deltaHours) trend = 'falling_fast';

  updateBG(newBG, trend);

  // 7. Update energy
  let energyDelta = 0;
  const bg = state.bg.current;

  if (bg >= BGConfig.targetLow && bg <= BGConfig.targetHigh) {
    energyDelta = BGConfig.energyRecoveryPerHour * deltaHours;
  } else {
    for (const zone of BGConfig.energyDrain) {
      if (bg >= zone.min && bg < zone.max) {
        energyDelta = -zone.drainPerHour * deltaHours;
        break;
      }
    }
  }

  updateEnergy(state.energy + energyDelta);
}

// Get BG zone info for display
export function getBGZone(value) {
  if (value < 3.0) return { zone: 'severe-low', label: 'Severe Low', color: 'red' };
  if (value < 5.0) return { zone: 'low', label: 'Low', color: 'yellow' };
  if (value <= 12.0) return { zone: 'target', label: 'In Range', color: 'green' };
  if (value <= 15.0) return { zone: 'high', label: 'High', color: 'yellow' };
  return { zone: 'very-high', label: 'Very High', color: 'red' };
}

// Get trend arrow for display
export function getTrendArrow(trend) {
  const arrows = {
    rising_fast: '↑↑',
    rising: '↑',
    stable: '→',
    falling: '↓',
    falling_fast: '↓↓'
  };
  return arrows[trend] || '→';
}
