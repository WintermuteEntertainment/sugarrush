// ============================================
// HUD — Persistent heads-up display
// ============================================

import { state, onChange, bgDisplay, bgUnitLabel } from '../engine/game-state.js';
import { getBGZone, getTrendArrow } from '../engine/bg-simulation.js';

const elements = {};

export function initHUD() {
  elements.hud = document.getElementById('hud');
  elements.bgValue = document.getElementById('hud-bg-value');
  elements.bgTrend = document.getElementById('hud-bg-trend');
  elements.bgFill = document.getElementById('hud-bg-fill');
  elements.energyFill = document.getElementById('hud-energy-fill');
  elements.confidenceValue = document.getElementById('hud-confidence-value');
  elements.day = document.getElementById('hud-day');
  elements.clock = document.getElementById('hud-clock');
  elements.betaCells = document.getElementById('hud-beta-cells');
  elements.effects = document.getElementById('screen-effects');

  // Listen for state changes
  onChange(updateHUD);
}

export function showHUD() {
  elements.hud.classList.remove('hidden');
}

export function hideHUD() {
  elements.hud.classList.add('hidden');
}

function updateHUD() {
  if (elements.hud.classList.contains('hidden')) return;

  const bg = state.bg.current;
  const zone = getBGZone(bg);

  // BG value and color
  elements.bgValue.textContent = bgDisplay(bg);
  elements.bgValue.style.color = zone.color === 'green'
    ? 'var(--zone-green)'
    : zone.color === 'yellow'
      ? 'var(--zone-yellow)'
      : 'var(--zone-red)';

  // Trend arrow (only for CGM users, or show last-checked for finger prick)
  if (state.player.device.bgMonitor === 'cgm') {
    elements.bgTrend.textContent = getTrendArrow(state.bg.trend);
  } else {
    elements.bgTrend.textContent = '';
  }

  // BG bar fill (map 2-20 range to 0-100%)
  const bgPercent = Math.max(0, Math.min(100, ((bg - 2) / 18) * 100));
  elements.bgFill.style.width = bgPercent + '%';
  elements.bgFill.style.backgroundColor = zone.color === 'green'
    ? 'var(--zone-green)'
    : zone.color === 'yellow'
      ? 'var(--zone-yellow)'
      : 'var(--zone-red)';

  // Energy bar
  elements.energyFill.style.width = state.energy + '%';

  // Confidence
  elements.confidenceValue.textContent = state.confidence;

  // Time
  elements.day.textContent = `Day ${state.time.day}`;
  elements.clock.textContent = formatTime(state.time.hour);

  // Beta Cells
  elements.betaCells.textContent = `${state.score.collectiblesFound.length} / ${state.score.totalCollectibles}`;

  // Screen effects
  updateScreenEffects(bg);
}

function updateScreenEffects(bg) {
  const el = elements.effects;
  el.className = '';

  if (bg < 3.0) {
    el.className = 'low-severe';
  } else if (bg < 5.0) {
    el.className = 'low-mild';
  } else if (bg > 15.0) {
    el.className = 'high-severe';
  } else if (bg > 12.0) {
    el.className = 'high-mild';
  }
}

function formatTime(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}
