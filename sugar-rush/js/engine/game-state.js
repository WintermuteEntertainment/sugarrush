// ============================================
// GAME STATE — Single source of truth
// ============================================

export function createInitialState() {
  return {
    player: {
      name: '',
      appearance: { hat: 0, face: 0, shirt: 0, shoes: 0 },
      device: { insulin: 'pump', bgMonitor: 'cgm' },
      difficulty: 'learning' // 'learning' or 'gotthis'
    },

    bg: {
      current: 7.2,
      trend: 'stable', // rising, falling, stable, rising_fast, falling_fast
      history: [],
      unit: 'mmol' // 'mmol' or 'mgdl'
    },

    energy: 85,
    confidence: 50,

    insulin: {
      onBoard: 0,       // active insulin units (decays over time)
      pendingDoses: [],  // { time, units, type }
      basalActive: true
    },

    carbs: {
      pending: [] // { time, grams, speed: 'fast'|'slow' }
    },

    time: {
      day: 1,
      hour: 7.0, // 7.0 = 7:00 AM
      week: 1
    },

    score: {
      timeInRange: [],      // per-day percentages
      bgSamples: [],        // { time, value } for current day
      collectiblesFound: [],
      totalCollectibles: 48,
      mealsManaged: 0,
      snacksRemembered: 0
    },

    narrative: {
      currentPassage: null,
      eventsCompleted: [],
      choices: {}
    },

    companion: {
      name: '',
      mood: 'happy' // happy, concerned, alert, proud, empathetic
    },

    flags: {
      setupComplete: false,
      tutorialActive: true,
      companionIntroduced: false
    }
  };
}

// Global game state
export const state = createInitialState();

// State change listeners
const listeners = [];

export function onChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function notify() {
  for (const fn of listeners) fn(state);
}

// Convenience setters that auto-notify
export function updateBG(value, trend) {
  state.bg.current = Math.round(value * 10) / 10; // one decimal
  if (trend) state.bg.trend = trend;
  state.bg.history.push({ time: state.time.hour, day: state.time.day, value: state.bg.current });
  state.score.bgSamples.push({ time: state.time.hour, value: state.bg.current });
  notify();
}

export function updateEnergy(value) {
  state.energy = Math.max(0, Math.min(100, Math.round(value)));
  notify();
}

export function updateConfidence(delta) {
  state.confidence = Math.max(0, Math.min(100, state.confidence + delta));
  notify();
}

export function advanceTime(hours) {
  state.time.hour += hours;
  if (state.time.hour >= 24) {
    state.time.hour -= 24;
    state.time.day += 1;
  }
  notify();
}

export function collectBetaCell(id) {
  if (!state.score.collectiblesFound.includes(id)) {
    state.score.collectiblesFound.push(id);
    notify();
    return true; // newly collected
  }
  return false; // already had it
}

// Convert mmol/L to mg/dL for display
export function bgDisplay(value) {
  if (state.bg.unit === 'mgdl') {
    return Math.round(value * 18);
  }
  return value.toFixed(1);
}

export function bgUnitLabel() {
  return state.bg.unit === 'mgdl' ? 'mg/dL' : 'mmol/L';
}
