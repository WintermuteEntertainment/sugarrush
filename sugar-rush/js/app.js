// ============================================
// SUGAR RUSH — Main Application Entry Point
// ============================================

import { state } from './engine/game-state.js';
import { renderPassage } from './engine/narrative.js';
import { initHUD } from './hud/hud.js';
import { registerSetupPassages } from './passages/setup.js';
import { registerDay1Passages } from './passages/day1.js';

// Initialize the game
function init() {
  // Register all passages
  registerSetupPassages();
  registerDay1Passages();

  // Initialize HUD (hidden until setup complete)
  initHUD();

  // Start at title screen
  renderPassage('title');
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
