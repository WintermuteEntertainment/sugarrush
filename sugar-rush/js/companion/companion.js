// ============================================
// COMPANION — The Robot
// Warm, supportive, never condescending.
// ============================================

import { state } from '../engine/game-state.js';

const companionEl = () => document.getElementById('companion');
const textEl = () => document.getElementById('companion-text');
const faceEl = () => document.getElementById('companion-face');

let hideTimeout = null;

export function showCompanion(text, duration = 0) {
  const el = companionEl();
  el.classList.remove('hidden');
  textEl().textContent = text;

  if (hideTimeout) clearTimeout(hideTimeout);
  if (duration > 0) {
    hideTimeout = setTimeout(() => hideCompanion(), duration);
  }
}

export function hideCompanion() {
  companionEl().classList.add('hidden');
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// Show companion with a typing-like reveal
export function sayCompanion(text, duration = 0) {
  showCompanion(text, duration);
}

// Set companion mood (affects face display)
export function setMood(mood) {
  state.companion.mood = mood;
  const face = faceEl();

  // Update the eyes based on mood
  const moods = {
    happy: '• •',
    concerned: 'o o',
    alert: '! !',
    proud: '^ ^',
    empathetic: '~ ~',
    thinking: '. .'
  };

  // We use the ::after pseudo-element for eyes, so we set a data attribute
  // and use CSS to read it. For now, simple class approach:
  face.dataset.mood = mood;
}

// Contextual companion lines
export const lines = {
  morningGreeting: [
    "Morning! Let's see where we're at.",
    "New day. How's the number?",
    "Rise and shine. Quick check?"
  ],
  bgGood: [
    "Right in the green. Nice.",
    "Look at that number. Solid.",
    "In range. Good start."
  ],
  bgMildHigh: [
    "Running a bit high. No big deal — let's bring it down.",
    "A little elevated. A correction should sort it out."
  ],
  bgVeryHigh: [
    "That's high. Let's get a correction in and keep an eye on it.",
    "Okay, that number needs attention. You know what to do."
  ],
  bgMildLow: [
    "Little low. Let's grab something quick.",
    "Dipping down. Time for 15 grams."
  ],
  bgSevereLow: [
    "You're low. Let's treat it now. 15 grams, fast-acting.",
    "Low alert. Grab some glucose tabs or juice. Right now."
  ],
  afterMealGood: [
    "Nice choice. That should keep things steady.",
    "Good call on the meal. Let's see how it plays out."
  ],
  afterMistake: [
    "Happens. Even experienced people miscalculate.",
    "Not the result we wanted, but now you know for next time."
  ],
  encouragement: [
    "You're getting the hang of this.",
    "Every check, every count — it all adds up.",
    "One step at a time. You're doing it."
  ],
  betaCellFound: [
    "Beta Cell collected! Check your journal for a new entry.",
    "Nice find! That's another piece of the puzzle.",
    "Got it! Knowledge is power."
  ]
};

// Pick a random line from a category
export function randomLine(category) {
  const pool = lines[category];
  if (!pool || pool.length === 0) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}
