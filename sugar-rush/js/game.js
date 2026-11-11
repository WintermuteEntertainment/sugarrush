// ============================================
// SUGAR RUSH — Complete Game Engine
// A Type 1 Diabetes education game
// ============================================

const SugarRush = (function() {
'use strict';

// ============================================
// 1. GAME STATE
// ============================================

const state = {
  player: { name: '', appearance: { hat: 0, face: 0, shirt: 0, shoes: 0 }, device: { insulin: 'pump', bgMonitor: 'cgm' }, difficulty: 'learning' },
  bg: { current: 7.2, trend: 'stable', history: [], unit: 'mmol' },
  energy: 85,
  confidence: 50,
  insulin: { onBoard: 0, pendingDoses: [], basalActive: true },
  carbs: { pending: [] },
  time: { day: 1, hour: 7.0, week: 1 },
  score: { timeInRange: [], bgSamples: [], collectiblesFound: [], totalCollectibles: 50, mealsManaged: 0, snacksRemembered: 0 },
  narrative: { currentPassage: null, resumePassage: null, eventsCompleted: [], choices: {}, dayPicks: null, pendingAfterRescue: null, rescueInProgress: false, lowBGHandled: false, lowsToday: 0, lowsWeek: 0 },
  companion: { name: '', mood: 'happy' },
  flags: { setupComplete: false, weekComplete: false, tipsOff: false, tips: {}, seenGames: {} }
};

// ============================================
// 2. STATE HELPERS
// ============================================

const listeners = [];
function onChange(fn) { listeners.push(fn); }
function notify() { listeners.forEach(fn => fn(state)); }

function updateBG(value, trend) {
  state.bg.current = Math.round(value * 10) / 10;
  if (trend) state.bg.trend = trend;
  state.bg.history.push({ time: state.time.hour, day: state.time.day, value: state.bg.current });
  state.score.bgSamples.push({ time: state.time.hour, value: state.bg.current });
  notify();
}
function updateEnergy(value) { state.energy = Math.max(0, Math.min(100, Math.round(value))); notify(); }
function updateConfidence(delta) { state.confidence = Math.max(0, Math.min(100, state.confidence + delta)); notify(); }
function advanceTime(hours) { state.time.hour += hours; if (state.time.hour >= 24) { state.time.hour -= 24; state.time.day++; } notify(); }
function collectBetaCell(id) {
  if (!state.score.collectiblesFound.includes(id)) { state.score.collectiblesFound.push(id); notify(); return true; }
  return false;
}
function bgDisplay(v) { return state.bg.unit === 'mgdl' ? Math.round(v * 18) : v.toFixed(1); }

function resetDayScore() {
  state.score.bgSamples = [];
  state.score.mealsManaged = 0;
  state.score.snacksRemembered = 0;
}

// ============================================
// 3. BG SIMULATION
// ============================================
// Insulin is simulated internally as "how much it will lower BG". The player never
// sees units, ratios or correction factors. In this game, taking insulin always means
// "following the plan from your diabetes team", because everyone's plan is different.

const BGConfig = {
  carbRaisePer1g: 0.1,
  absorbHours: { glucose: 0.3, fast: 1.0, slow: 2.5 },
  insulinOnsetDelay: 0.25, insulinDuration: 2.5,
  mealCoverage: 1.0,
  correctionTarget: 7.0, correctionStrength: 0.8,
  backgroundDriftPerHour: -0.15,
  targetLow: 5.0, targetHigh: 10.0, hypo: 4.0, minBG: 2.5, maxBG: 25.0,
  energyRecoveryPerHour: 10
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function dayName(d) { return DAY_NAMES[((d || 1) - 1) % 7]; }
function isWeekend(d) { const n = ((d || 1) - 1) % 7; return n === 5 || n === 6; }

function eatFood(grams, speed) {
  if (grams > 0) state.carbs.pending.push({ grams, speed: speed || 'slow', absorbed: 0 });
}

function insulinOnBoard() {
  return state.insulin.pendingDoses.reduce((a, d) => a + (d.drop - d.delivered), 0);
}

// Mealtime insulin, following the plan. preBolus = taken a little before eating.
function takeMealInsulin(carbs, preBolus) {
  const drop = carbs * BGConfig.carbRaisePer1g * BGConfig.mealCoverage;
  if (drop > 0) state.insulin.pendingDoses.push({ age: preBolus ? 0.17 : 0, drop, delivered: 0 });
}

// Following the plan for highs. Insulin already working is counted, so doses never stack.
function takeCorrection() {
  const excess = state.bg.current - BGConfig.correctionTarget - insulinOnBoard();
  if (excess > 0.5) state.insulin.pendingDoses.push({ age: 0, drop: excess * BGConfig.correctionStrength, delivered: 0 });
}

// Eat a meal and take mealtime insulin per the plan (the plan also covers being above range).
function eatMeal(carbs, speed, preBolus) {
  takeMealInsulin(carbs, preBolus);
  if (state.bg.current > BGConfig.targetHigh) takeCorrection();
  eatFood(carbs, speed);
  state.score.mealsManaged++;
}

// Snacks: small ones are eaten as-is; bigger ones are covered by the plan.
function eatSnack(carbs, speed) {
  if (carbs > 20) takeMealInsulin(carbs);
  eatFood(carbs, speed);
  state.score.snacksRemembered++;
}

function tick(deltaHours) {
  if (deltaHours <= 0) return;
  let bgDelta = 0;
  for (const c of state.carbs.pending) {
    const hrs = BGConfig.absorbHours[c.speed] || BGConfig.absorbHours.slow;
    const abs = Math.min((c.grams / hrs) * deltaHours, c.grams - c.absorbed);
    c.absorbed += abs;
    bgDelta += abs * BGConfig.carbRaisePer1g;
  }
  state.carbs.pending = state.carbs.pending.filter(c => c.absorbed < c.grams - 0.01);
  const end = BGConfig.insulinOnsetDelay + BGConfig.insulinDuration;
  for (const d of state.insulin.pendingDoses) {
    const before = d.age;
    d.age += deltaHours;
    const from = Math.max(before, BGConfig.insulinOnsetDelay), to = Math.min(d.age, end);
    if (to <= from) continue;
    const del = Math.min((d.drop / BGConfig.insulinDuration) * (to - from), d.drop - d.delivered);
    d.delivered += del;
    bgDelta -= del;
  }
  state.insulin.pendingDoses = state.insulin.pendingDoses.filter(d => d.delivered < d.drop - 0.01 && d.age < end + 0.01);
  bgDelta += BGConfig.backgroundDriftPerHour * deltaHours;
  const newBG = Math.max(BGConfig.minBG, Math.min(BGConfig.maxBG, state.bg.current + bgDelta));
  const diff = newBG - state.bg.current;
  let trend = 'stable';
  if (diff > 0.5 * deltaHours) trend = 'rising';
  if (diff > 1.5 * deltaHours) trend = 'rising_fast';
  if (diff < -0.5 * deltaHours) trend = 'falling';
  if (diff < -1.5 * deltaHours) trend = 'falling_fast';
  updateBG(newBG, trend);
  const bg = state.bg.current;
  let eDelta;
  if (inRange(bg)) eDelta = BGConfig.energyRecoveryPerHour;
  else if (bg < BGConfig.hypo) eDelta = -15;
  else if (bg < BGConfig.targetLow) eDelta = -4;
  else if (bg <= 14) eDelta = -4;
  else eDelta = -10;
  updateEnergy(state.energy + eDelta * deltaHours);
}

function inRange(v) { return v >= BGConfig.targetLow && v <= BGConfig.targetHigh; }

// Move the clock forward to a set time of day, running the BG simulation for the gap.
function setClock(h) {
  const d = h - state.time.hour;
  if (d > 0) { tick(d); state.time.hour = h; notify(); }
}

function getBGZone(v) {
  if (v < 3) return { zone: 'severe-low', label: 'Very Low', color: 'red' };
  if (v < 4) return { zone: 'low', label: 'Low', color: 'red' };
  if (v < 5) return { zone: 'below', label: 'A Bit Low', color: 'yellow' };
  if (v <= 10) return { zone: 'target', label: 'In Range', color: 'green' };
  if (v <= 14) return { zone: 'high', label: 'High', color: 'yellow' };
  return { zone: 'very-high', label: 'Very High', color: 'red' };
}
function getTrendArrow(t) { return { rising_fast: '↑↑', rising: '↑', stable: '→', falling: '↓', falling_fast: '↓↓' }[t] || '→'; }

// ============================================
// 4. NARRATIVE ENGINE
// ============================================

const passages = {};
function addPassage(id, p) { passages[id] = p; }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5); }

// Emoji "illustration" panel. mood picks the background; default follows the clock.
function sceneArt(big, rows, mood) {
  if (!mood) {
    const h = state.time.hour;
    mood = h < 9 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'evening' : 'night';
  }
  return '<div class="scene-art scene-' + mood + '"><div class="scene-big">' + big + '</div>' +
    (rows || []).map(r => '<div class="scene-row">' + r + '</div>').join('') + '</div>';
}

// Re-selectable multiple choice. Feedback shows on every pick; the player can change
// their pick freely. onPick(isCorrect, option) lets the caller show/hide a Next button.
function choiceQuiz(container, options, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz';
  const fb = document.createElement('div');
  fb.className = 'quiz-feedback';
  options.forEach(o => {
    const b = document.createElement('button');
    b.className = 'quiz-option';
    b.innerHTML = o.text;
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.quiz-option').forEach(x => x.classList.remove('picked'));
      b.classList.add('picked', o.correct ? 'right' : 'tried');
      fb.className = 'quiz-feedback ' + (o.correct ? 'right' : 'try');
      fb.innerHTML = (o.correct ? '✅ ' : '🤔 ') + o.feedback + (o.correct ? '' : ' <em>Pick another one.</em>');
      if (onPick) onPick(!!o.correct, o);
    });
    wrap.appendChild(b);
  });
  container.appendChild(wrap);
  container.appendChild(fb);
}

function renderPassage(id, opts) {
  if (!id) return;
  opts = opts || {};
  const p = passages[id];
  if (!p) { console.error('Missing passage:', id); return; }
  state.narrative.currentPassage = id;
  closeTip();
  const container = document.getElementById('passage-container');
  container.innerHTML = '';
  document.getElementById('narrative').scrollTop = 0;
  // AUDIO: Play passage transition sound
  if (p.onEnter && !opts.skipOnEnter) p.onEnter(state);
  // Low BG interrupt: after onEnter may have moved BG, divert to the rescue flow if needed.
  if (!opts.skipOnEnter && checkLowBGInterrupt(id)) return;
  if (state.bg.current >= BGConfig.targetLow && state.narrative.lowBGHandled) state.narrative.lowBGHandled = false;
  const div = document.createElement('div');
  div.className = p.noWrap ? '' : 'passage';
  div.innerHTML = typeof p.content === 'function' ? p.content(state) : p.content;
  container.appendChild(div);

  if (p.quiz) {
    const q = p.quiz(state);
    const holder = document.createElement('div');
    holder.className = 'passage-quiz';
    container.appendChild(holder);
    const w = document.createElement('div');
    w.style.marginTop = '16px';
    w.style.display = 'none';
    const btn = document.createElement('button');
    btn.className = 'continue-btn';
    btn.textContent = q.continueText || 'Continue';
    btn.addEventListener('click', () => { if (q.onDone) q.onDone(state); notify(); renderPassage(typeof q.next === 'function' ? q.next(state) : q.next); });
    w.appendChild(btn);
    choiceQuiz(holder, q.options, ok => { w.style.display = ok ? '' : 'none'; });
    container.appendChild(w);
  }

  const choices = typeof p.choices === 'function' ? p.choices(state) : p.choices;
  if (choices && choices.length > 0) {
    const cd = document.createElement('div');
    cd.className = 'choices';
    for (const c of choices) {
      if (c.condition && !c.condition(state)) continue;
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = typeof c.text === 'function' ? c.text(state) : c.text;
      btn.addEventListener('click', () => {
        // AUDIO: Play choice selection click
        if (c.onSelect) c.onSelect(state);
        state.narrative.choices[id] = c.id || c.text;
        const next = typeof c.next === 'function' ? c.next(state) : c.next;
        if (next) { notify(); renderPassage(next); }
      });
      cd.appendChild(btn);
    }
    container.appendChild(cd);
  }
  if (p.next && (!choices || choices.length === 0) && !p.quiz) {
    const btn = document.createElement('button');
    btn.className = 'continue-btn';
    btn.id = 'passage-continue';
    btn.textContent = p.continueText || 'Continue';
    btn.addEventListener('click', () => {
      if (p.onExit) p.onExit(state);
      const next = typeof p.next === 'function' ? p.next(state) : p.next;
      const nextOpts = typeof p.nextOpts === 'function' ? p.nextOpts(state) : p.nextOpts;
      notify();
      renderPassage(next, nextOpts);
    });
    const w = document.createElement('div');
    w.style.marginTop = '20px';
    w.appendChild(btn);
    container.appendChild(w);
  }
  notify();
  if (state.flags.setupComplete) saveGame();
  if (p.afterRender) setTimeout(() => p.afterRender(state, container), 60);
}

// --- Low BG ---
// Under 4.0 mmol/L is a low. The rescue flow mirrors real life: fast sugar, wait 15
// minutes, check again (treat again if still under 4), then a snack with carbs and
// protein if the next meal is a while away. Repeat lows in a day get a shorter flow.

const LOW_BG_INTERRUPT_EXEMPT = /^(low-bg-rescue|day1-hypo|setup-|title|dedication|slot-)/;

function isLowBG(v) { return v < BGConfig.hypo; }
function isSevereLowBG(v) { return v < 3.0; }
function isMealPassage(id) { return /meal|breakfast|lunch|dinner|brunch|anchor-solo|anchor-estimation|bedtime|-snack-/.test(id || ''); }

function beginRescue(resumeId, fresh, mealSoon) {
  const n = state.narrative;
  n.rescueInProgress = true;
  n.lowBGHandled = true;
  n.pendingAfterRescue = resumeId;
  n.resumeFresh = !!fresh;
  n.rescueMealSoon = (mealSoon === undefined) ? isMealPassage(resumeId) : mealSoon;
  n.lowsToday = (n.lowsToday || 0) + 1;
  n.lowsWeek = (n.lowsWeek || 0) + 1;
  renderPassage('low-bg-rescue');
}

function checkLowBGInterrupt(currentId) {
  const n = state.narrative;
  if (n.rescueInProgress || n.lowBGHandled) return false;
  if (LOW_BG_INTERRUPT_EXEMPT.test(currentId || '')) return false;
  if (!isLowBG(state.bg.current)) return false;
  beginRescue(currentId, false);
  return true;
}

// Scripted lows (Day 1 lesson, practice): resume at nextId and run its onEnter.
function startLowRescue(nextId, mealSoon) { beginRescue(nextId, true, mealSoon); }

const RECOVERY_SNACKS = [
  // Diabetes Canada: if a meal is more than an hour away, a snack with carbohydrate and protein.
  { emoji: '🍘🧀', name: '4 crackers and cheese', carbs: 12 },
  { emoji: '🥪', name: 'Half a turkey sandwich', carbs: 16 },
  { emoji: '🍎🧀', name: 'Apple and cheese', carbs: 20 },
  { emoji: '🥛🍘', name: 'Milk and 4 crackers', carbs: 23 },
  { emoji: '🫓🫘', name: 'Half a pita with hummus', carbs: 25 },
  { emoji: '🥣🍓', name: 'Plain yogurt with strawberries', carbs: 19 }
];

function registerLowBGRescuePassages() {
  addPassage('low-bg-rescue', {
    content: (s) => {
      const bg = s.bg.current, severe = isSevereLowBG(bg), repeat = (s.narrative.lowsToday || 1) > 1;
      const symptoms = severe
        ? pick(['Your hands are shaking hard and it is tough to think straight.', 'You feel very drowsy and confused, and your heart is pounding.'])
        : pick(['Your hands feel trembly.', 'You feel sweaty and suddenly very hungry.', 'You feel dizzy and it\'s hard to concentrate.', 'Your legs feel weak and you have a headache.']);
      const check = s.player.device.bgMonitor === 'cgm' ? 'Your CGM beeps.' : 'You check with your meter.';
      const cause = s.narrative.lowCause ? '<p class="passage-scene">' + s.narrative.lowCause + '</p>' : '';
      s.narrative.lowCause = null;
      const pip = repeat
        ? pick(['Another low. You know the drill: fast sugar first.', 'Low again. Stop, treat, wait.'])
        : severe ? 'Stop everything. Fast sugar right now, and tell a grown-up who is nearby.'
                 : 'You\'re under 4. Stop what you\'re doing. Fast sugar first.';
      return sceneArt(severe ? '🚨' : '⚠️', [severe ? '😵‍💫 ➜ 🍬' : '😟 ➜ 🍬'], 'alert') +
        '<h2>Low Blood Sugar</h2>' + cause +
        '<p>' + check + ' <strong class="bg-big red">' + bg.toFixed(1) + '</strong> mmol/L. ' + symptoms + '</p>' +
        '<p><strong>' + s.companion.name + ':</strong> "' + pip + '"</p>' +
        (repeat ? '' : '<div class="tip-box">💡 Under <strong>4.0</strong> is a low. The plan: <strong>fast sugar</strong>, then <strong>wait 15 minutes</strong>, then <strong>check again</strong>. Your diabetes team will tell you how much fast sugar is right for you.</div>');
    },
    onEnter: (s) => { showCompanion(isSevereLowBG(s.bg.current) ? 'Fast sugar now!' : 'Low! Fast sugar first.', 5000); },
    choices: [{
      text: '🍬 Treat the low',
      next: function() {
        const seen = state.flags.seenGames && state.flags.seenGames['Treat-the-Low'];
        playMiniGame('Treat-the-Low', { currentBG: state.bg.current, skipIntro: seen }, 'low-bg-rescue-wait');
        return null;
      }
    }]
  });

  addPassage('low-bg-rescue-wait', {
    content: (s) => sceneArt('⏳', [pick(['🪑 😮‍💨', '🛋️ 😌', '🌳 🪑 😮‍💨'])]) +
      '<h2>Wait 15 Minutes</h2>' +
      '<p>' + pick(['You sit down and rest.', 'You stay put and take some slow breaths.', 'You find a comfy spot and rest.']) + ' No running around until you check again.</p>' +
      '<div class="wait-timer"><div class="wait-timer-fill"></div></div>',
    onEnter: (s) => { eatFood(s.narrative.lastLowTreat || 15, 'glucose'); },
    afterRender: (s, c) => {
      const btn = document.getElementById('passage-continue');
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = '⏱️ Waiting...';
      setTimeout(() => { btn.disabled = false; btn.textContent = '🩸 Check again'; }, 3500);
    },
    next: 'low-bg-rescue-recheck'
  });

  addPassage('low-bg-rescue-recheck', {
    content: (s) => {
      const bg = s.bg.current;
      if (isLowBG(bg)) {
        return sceneArt('🩸', ['⏱️ ➜ 🩸 ' + bg.toFixed(1)], 'alert') + '<h2>Check Again</h2>' +
          '<p>BG: <strong class="bg-big red">' + bg.toFixed(1) + '</strong>. Still under 4. That happens sometimes. Treat again, then wait another 15 minutes.</p>';
      }
      return sceneArt('🩸', ['⏱️ ➜ 🩸 📈'], 'day') + '<h2>Check Again</h2>' +
        '<p>BG: <strong class="bg-big ' + (inRange(bg) ? 'green' : 'yellow') + '">' + bg.toFixed(1) + '</strong>. Back above 4.</p>';
    },
    onEnter: () => { tick(0.25); advanceTime(0.25); },
    choices: (s) => isLowBG(s.bg.current)
      ? [{ text: '🍬 Fast sugar again', onSelect: (st) => { st.narrative.lastLowTreat = 15; }, next: 'low-bg-rescue-wait' }]
      : [{ text: 'Continue', next: 'low-bg-rescue-followup' }]
  });

  addPassage('low-bg-rescue-followup', {
    content: (s) => {
      if (s.narrative.rescueMealSoon) {
        return '<h2>Back on Track</h2><p>' + (/-snack-/.test(s.narrative.pendingAfterRescue || '')
          ? 'It\'s snack time anyway. Diabetes Canada suggests a snack with some carbs and some protein after a low.'
          : 'Your next meal is coming up soon. That will help keep you steady.') + '</p>';
      }
      return sceneArt('🍽️', ['🧀 🍘 🍎 🥛']) + '<h2>Keep It Steady</h2>' +
        '<p>Your next meal is more than an hour away. Diabetes Canada says to have a snack with some carbs and some protein.</p>';
    },
    choices: (s) => s.narrative.rescueMealSoon
      ? [{ text: 'Continue', next: 'low-bg-rescue-after' }]
      : shuffle(RECOVERY_SNACKS).slice(0, 3).map(sn => ({
          text: sn.emoji + ' ' + sn.name + ' <span class="carb-tag">~' + sn.carbs + 'g carbs + protein</span>',
          onSelect: () => { eatFood(sn.carbs, 'slow'); },
          next: 'low-bg-rescue-after'
        }))
  });

  addPassage('low-bg-rescue-after', {
    content: (s) => '<h2>All Set</h2>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "' + pick([
        'You noticed it, you treated it, you checked again. That\'s the whole job.',
        'Nicely handled. Lows can happen even when you do everything right.',
        'Done. Some people feel tired after a low, so take it easy for a bit.'
      ]) + '"</p>',
    onEnter: (s) => {
      if (collectBetaCell('fifteen-fifteen-rule')) setTimeout(() => showBetaCellNotification(betaCellMap['fifteen-fifteen-rule'].name, betaCellMap['fifteen-fifteen-rule'].cat), 500);
      updateConfidence(3);
    },
    onExit: (s) => { s.narrative.rescueInProgress = false; s.narrative.lowBGHandled = false; },
    next: (s) => s.narrative.pendingAfterRescue || ('d' + s.time.day + '-evening'),
    nextOpts: (s) => ({ skipOnEnter: !s.narrative.resumeFresh }),
    continueText: 'Back to the day'
  });
}

// Shared helper — pick a companion line appropriate to the current BG zone.
// Use this in place of randomLine('afterMealGood') so Pip never congratulates
// the player when BG is dangerously low or high.
function contextualCompanionLine(defaultCat) {
  const z = getBGZone(state.bg.current).zone;
  if (z === 'severe-low' || z === 'low') return randomLine('bgLow');
  if (z === 'very-high' || z === 'high') return randomLine('bgHigh');
  return randomLine(defaultCat);
}

// ============================================
// 5. HUD
// ============================================

const hud = {};
function initHUD() {
  hud.el = document.getElementById('hud');
  hud.bgValue = document.getElementById('hud-bg-value');
  hud.bgTrend = document.getElementById('hud-bg-trend');
  hud.bgFill = document.getElementById('hud-bg-fill');
  hud.energyFill = document.getElementById('hud-energy-fill');
  hud.confidenceValue = document.getElementById('hud-confidence-value');
  hud.day = document.getElementById('hud-day');
  hud.clock = document.getElementById('hud-clock');
  hud.betaCells = document.getElementById('hud-beta-cells');
  hud.effects = document.getElementById('screen-effects');
  hud.avatarName = document.getElementById('hud-avatar-name');
  hud.avatarFigure = document.getElementById('hud-avatar-figure');
  onChange(updateHUD);
  document.getElementById('hud-collectibles').style.cursor = 'pointer';
  document.getElementById('hud-collectibles').addEventListener('click', openJournal);
  document.getElementById('hud-menu')?.addEventListener('click', openMenu);
  document.getElementById('companion-face')?.addEventListener('click', pipHint);
  // Tap the speech bubble to dismiss it (it can sit over content on small screens).
  document.getElementById('companion-bubble')?.addEventListener('click', hideCompanion);
  // Rotating a phone or tablet: refresh the HUD and drop any tip pointing at the old layout.
  window.addEventListener('resize', () => { if (tipOpen) closeTip(); notify(); });
}
function showHUD() {
  hud.el.classList.remove('hidden');
  document.getElementById('companion').classList.remove('hidden');
  updateAvatar();
  startPipBlink();
}
function hideHUD() {
  hud.el.classList.add('hidden');
  document.getElementById('companion').classList.add('hidden');
  document.body.dataset.bg = '';
  hud.effects.className = '';
}

function updateHUD() {
  if (!hud.el || hud.el.classList.contains('hidden')) return;
  const bg = state.bg.current;
  const zone = getBGZone(bg);
  const colorVar = zone.color === 'green' ? 'var(--zone-green)' : zone.color === 'yellow' ? 'var(--zone-yellow)' : 'var(--zone-red)';
  hud.bgValue.textContent = bgDisplay(bg);
  hud.bgValue.style.color = colorVar;
  hud.bgTrend.textContent = state.player.device.bgMonitor === 'cgm' ? getTrendArrow(state.bg.trend) : '';
  hud.bgFill.style.width = Math.max(0, Math.min(100, ((bg - 2) / 16) * 100)) + '%';
  hud.bgFill.style.backgroundColor = colorVar;
  hud.energyFill.style.width = state.energy + '%';
  hud.confidenceValue.textContent = state.confidence;
  hud.day.textContent = window.innerWidth <= 600 ? dayName(state.time.day).slice(0, 3) : dayName(state.time.day).slice(0, 3) + ' · Day ' + state.time.day;
  const h = Math.floor(state.time.hour), m = Math.round((state.time.hour - h) * 60) % 60;
  const period = h >= 12 ? 'PM' : 'AM', dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  hud.clock.textContent = dh + ':' + String(m).padStart(2, '0') + ' ' + period;
  hud.betaCells.textContent = state.score.collectiblesFound.length + ' / ' + state.score.totalCollectibles;
  document.body.dataset.bg = zone.zone;
  // Edge glow only. Nothing blurs or shakes the text, so the game stays readable.
  hud.effects.className = bg < 4 ? 'low-severe' : bg < 5 ? 'low-mild' : bg > 14 ? 'high-severe' : bg > 10 ? 'high-mild' : '';
  const badge = document.getElementById('pip-badge');
  if (badge) badge.textContent = bg < 5 ? '⬇' : bg > 10 ? '⬆' : '';
  updateAvatar();
  pipMoodFromBG();
}

function updateAvatar() {
  if (!hud.avatarFigure) return;
  const a = state.player.appearance;
  hud.avatarFigure.querySelector('.av-hat').textContent = a.hat ? HATS[a.hat] : '';
  hud.avatarFigure.querySelector('.av-face').textContent = FACES[a.face] || FACES[0];
  hud.avatarFigure.querySelector('.av-shirt').style.background = SHIRT_COLORS[a.shirt] || SHIRT_COLORS[0];
  hud.avatarFigure.querySelector('.av-shoes').textContent = SHOES[a.shoes] || SHOES[0];
  if (hud.avatarName) hud.avatarName.textContent = state.player.name || '';
}

// ============================================
// 6. COMPANION (Pip)
// ============================================
// Pip stays on screen during play. The speech bubble comes and goes.

let companionTimeout = null;
let pipBlinkInterval = null;

function setPipMood(mood) {
  const face = document.getElementById('companion-face');
  if (!face) return;
  face.classList.remove('happy', 'worried', 'alert', 'thinking');
  if (mood !== 'neutral') face.classList.add(mood);
}

function pipBlink() {
  const face = document.getElementById('companion-face');
  if (!face) return;
  face.classList.add('blink');
  setTimeout(() => face.classList.remove('blink'), 150);
}

function startPipBlink() {
  if (pipBlinkInterval) clearInterval(pipBlinkInterval);
  pipBlinkInterval = setInterval(() => { if (Math.random() < 0.4) pipBlink(); }, 2500);
}

function pipMoodFromBG() {
  const bg = state.bg.current;
  if (bg < 4 || bg > 14) setPipMood('alert');
  else if (bg < 5 || bg > 10) setPipMood('worried');
  else setPipMood('happy');
}

function showCompanion(text, dur) {
  const el = document.getElementById('companion');
  const face = document.getElementById('companion-face');
  const bubble = document.getElementById('companion-bubble');
  el.classList.remove('hidden');
  bubble.classList.remove('hidden');
  bubble.style.animation = 'none';
  void bubble.offsetWidth;
  bubble.style.animation = '';
  document.getElementById('companion-text').textContent = text;
  pipMoodFromBG();
  if (face) {
    face.classList.add('speaking');
    setTimeout(() => face.classList.remove('speaking'), 500);
  }
  // AUDIO: Play companion dialogue blip
  if (companionTimeout) clearTimeout(companionTimeout);
  let ms = dur > 0 ? dur : 7000;
  if (window.innerWidth <= 600) ms = Math.min(ms, 4500);
  companionTimeout = setTimeout(() => bubble.classList.add('hidden'), ms);
}
function hideCompanion() { document.getElementById('companion-bubble').classList.add('hidden'); }

// Tap Pip for a hint that fits the moment.
function pipHint() {
  const bg = state.bg.current;
  let line;
  if (bg < 4) line = 'You\'re under 4. Fast sugar first, then wait 15 minutes and check again.';
  else if (bg < 5) line = 'A bit low. A snack with some carbs would help. Keep an eye on it.';
  else if (bg > 14) line = 'Very high. Drink some water, follow your plan for highs, and tell a grown-up if you feel unwell.';
  else if (bg > 10) line = 'A bit high. Water helps, and your plan for highs will bring it down. It takes time.';
  else line = pick([
    'Looking good. Tap the Beta Cell counter (top right) to read what you\'ve learned.',
    'Canada\'s Food Guide says to make water your drink of choice.',
    'The menu button (☰) shows how saving works.',
    'In range! Nice.'
  ]);
  showCompanion(line, 6000);
}

function showBetaCellNotification(name, color) {
  const old = document.querySelector('.beta-cell-notification');
  if (old) old.remove();
  // AUDIO: Play Beta Cell collection chime
  const div = document.createElement('div');
  div.className = 'beta-cell-notification';
  div.innerHTML = '<span class="beta-icon ' + color + '"></span> <strong>Beta Cell collected!</strong><br>' + name;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

// --- Tutorial spotlights ---
// One short tip at a time, pointing at the thing it explains. Each shows once per save.
const tipQueue = [];
let tipOpen = false;

function tutorialTip(key, selector, html) {
  state.flags.tips = state.flags.tips || {};
  if (state.flags.tips[key] || state.flags.tipsOff) return;
  tipQueue.push({ key, selector, html });
  if (!tipOpen) nextTip();
}

function nextTip() {
  const t = tipQueue.shift();
  if (!t) { tipOpen = false; return; }
  const target = document.querySelector(t.selector);
  if (!target || state.flags.tipsOff) { nextTip(); return; }
  tipOpen = true;
  state.flags.tips[t.key] = true;
  target.classList.add('tip-target');
  const host = target.closest('#hud, #companion');
  const oldZ = host ? host.style.zIndex : '';
  if (host) host.style.zIndex = 1600;
  const shield = document.createElement('div');
  shield.className = 'tip-shield';
  const box = document.createElement('div');
  box.className = 'tip-bubble';
  box.innerHTML = '<div class="tip-pip">🤖</div><div class="tip-text">' + t.html + '</div>' +
    '<div class="tip-actions"><button class="tip-skip">Skip all tips</button><button class="tip-ok">Got it</button></div>';
  document.body.appendChild(shield);
  document.body.appendChild(box);
  const r = target.getBoundingClientRect();
  const bw = Math.min(340, window.innerWidth - 24);
  box.style.width = bw + 'px';
  box.style.left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + 'px';
  if (r.top < window.innerHeight / 2) box.style.top = (r.bottom + 14) + 'px';
  else box.style.top = Math.max(12, r.top - box.offsetHeight - 14) + 'px';
  const done = () => { target.classList.remove('tip-target'); if (host) host.style.zIndex = oldZ; shield.remove(); box.remove(); nextTip(); };
  box.querySelector('.tip-ok').addEventListener('click', done);
  box.querySelector('.tip-skip').addEventListener('click', () => { state.flags.tipsOff = true; tipQueue.length = 0; done(); });
}

function closeTip() {
  tipQueue.length = 0;
  document.querySelectorAll('.tip-shield, .tip-bubble').forEach(e => e.remove());
  document.querySelectorAll('.tip-target').forEach(e => e.classList.remove('tip-target'));
  ['hud', 'companion'].forEach(id => { const el = document.getElementById(id); if (el) el.style.zIndex = ''; });
  tipOpen = false;
}

// --- In-page modal (used instead of browser confirm boxes) ---
function showModal(title, html, buttons) {
  closeModal();
  const ov = document.createElement('div');
  ov.id = 'modal-overlay';
  ov.innerHTML = '<div class="modal-box"><h2>' + title + '</h2><div class="modal-body">' + html + '</div><div class="modal-actions"></div></div>';
  const actions = ov.querySelector('.modal-actions');
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'modal-btn' + (b.danger ? ' danger' : '') + (b.primary ? ' primary' : '');
    btn.textContent = b.text;
    btn.addEventListener('click', () => { closeModal(); if (b.onClick) b.onClick(); });
    actions.appendChild(btn);
  });
  document.body.appendChild(ov);
}
function closeModal() { document.getElementById('modal-overlay')?.remove(); }

function openMenu() {
  saveGame();
  showModal('☰ Menu',
    '<p>💾 Your game <strong>saves by itself</strong> after every step.</p>' +
    '<p>You can refresh the page, close it, or press Back, and pick up right here later: choose <strong>Continue</strong> on your save slot.</p>' +
    '<p>Playing as <strong>' + (state.player.name || '?') + '</strong> in save slot ' + (currentSlot || '?') + '.</p>',
    [
      { text: '▶ Keep playing', primary: true },
      { text: '📖 Knowledge Journal', onClick: openJournal },
      { text: state.flags.tipsOff ? '💡 Turn tips back on' : '💡 Turn tips off', onClick: () => { state.flags.tipsOff = !state.flags.tipsOff; saveGame(); } },
      { text: '🏠 Title screen', onClick: goToTitle }
    ]);
}

function goToTitle() {
  saveGame();
  hideHUD();
  renderPassage('title');
}

const companionLines = {
  afterMealGood: ["Nice choice. That should keep things steady.", "Good call on the meal.", "Solid choice. Let's see how it lands."],
  afterMealOkay: ["Not bad. Could go either way — we'll keep an eye on it.", "That'll work. Let's see what happens."],
  encouragement: ["You're getting the hang of this.", "One step at a time. You're doing it.", "Every check, every count — it all adds up."],
  morningGreeting: ["Morning! Let's see where we're at.", "New day. How's the number?", "Rise and shine. Quick check?"],
  bgGood: ["Right in the green. Nice.", "Look at that number. Solid.", "In range. Good."],
  bgHigh: ["Running a bit high. Let's bring it down.", "A little high. Water and your plan for highs will help.", "Number's climbing. Watch the trend."],
  bgLow: ["Hey, that number is low. Fast sugar, now.", "You're going low. Stop and treat it.", "Under 4. Don't wait: fast sugar first."]
};
function randomLine(cat) { const pool = companionLines[cat]; return pool ? pool[Math.floor(Math.random() * pool.length)] : ''; }

// ============================================
// 7. BETA CELL CATALOG (50 entries)
// ============================================

const betaCells = [
  // Every factual statement here comes from Diabetes Canada or Health Canada.
  // `src` codes are listed in design/fact-sources.md. 'encouragement' = no factual claim.

  // BLUE: Facts (13)
  { id: 'what-is-blood-sugar', name: 'What is Blood Sugar?', cat: 'blue', src: 'DC-T1, DC-CPG34', desc: 'Blood sugar (also called blood glucose) is sugar in your blood. Insulin helps your body\'s cells use it for energy. Diabetes Canada\'s targets for kids and teens are 4.0 to 8.0 before meals and 5.0 to 10.0 two hours after meals.' },
  { id: 'what-are-carbs', name: 'What are Carbs?', cat: 'blue', src: 'DC-CARB, DC-CPG34', desc: 'Carbohydrates are in grains and starches, fruits, some vegetables, legumes, milk, sugary foods and many prepared foods. Meat, most vegetables and fats have little. Counting carbs is a way to match your insulin to the carbs you eat.' },
  { id: 'what-is-insulin', name: 'What is Insulin?', cat: 'blue', src: 'DC-INS, DC-T1, DC-CPG12', desc: 'Insulin is a hormone made by the pancreas. It helps your body\'s cells use blood sugar for energy. With type 1 diabetes, insulin is given by pen, syringe or insulin pump.' },
  { id: 'what-is-t1d', name: 'What is Type 1 Diabetes?', cat: 'blue', src: 'DC-T1', desc: 'Type 1 diabetes is an autoimmune condition: the body\'s immune cells mistakenly attack the cells in the pancreas that make insulin. It usually starts in childhood, but it can start in adults too.' },
  { id: 'what-are-ketones', name: 'What are Ketones?', cat: 'blue', src: 'DC-CPG9, DC-CPG15, DC-T1', desc: 'Diabetes Canada recommends checking ketones when you\'re sick with high blood sugar, when your BG before meals stays above 14.0, or if you have signs of DKA. A blood ketone test is preferred over a urine test. DKA happens when there isn\'t enough insulin in your body.' },
  { id: 'what-is-a1c', name: 'What is A1C?', cat: 'blue', src: 'DC-CPG9, DC-CPG34', desc: 'A1C is a blood test that shows your average blood sugar over the last 2 to 3 months. Diabetes Canada\'s A1C target for kids and teens is 7.5% or lower.' },
  { id: 'what-is-basal', name: 'What is Basal Insulin?', cat: 'blue', src: 'DC-CPG12, DC-INS', desc: 'Basal insulin is long- or intermediate-acting insulin that works in the background. Insulin pumps deliver insulin 24 hours a day through a small tube under the skin.' },
  { id: 'what-is-bolus', name: 'What is a Bolus?', cat: 'blue', src: 'DC-CPG12, DC-INS', desc: 'A bolus is rapid- or short-acting insulin for the rise in blood sugar at meals. Your diabetes team gives you the plan for how much to take and when.' },
  { id: 'how-cgm-works', name: 'How Does a CGM Work?', cat: 'blue', src: 'DC-CPG9', desc: 'A CGM measures glucose in the fluid around your cells (called interstitial fluid). It shows trend arrows, and it can sound an alarm when glucose goes above or below a limit you set.' },
  { id: 'how-pump-works', name: 'How Does an Insulin Pump Work?', cat: 'blue', src: 'DC-INS', desc: 'An insulin pump is a small device worn outside the body. It replaces injections and delivers insulin 24 hours a day through a small tube under the skin. Some pumps can respond to readings from a CGM.' },
  { id: 'what-is-pancreas', name: 'What is the Pancreas?', cat: 'blue', src: 'DC-INS, DC-T1', desc: 'The pancreas is the organ that makes insulin. In type 1 diabetes, the immune system attacks the cells in the pancreas that make insulin.' },
  { id: 'what-are-beta-cells', name: 'Why "Beta Cells"?', cat: 'blue', src: 'DC-T1', desc: 'The cells in the pancreas that make insulin are called beta cells. They are the cells the immune system attacks in type 1 diabetes. In this game, every Beta Cell you collect is a fact you get to keep.' },
  { id: 'macronutrients', name: 'Canada\'s Food Guide in a Nutshell', cat: 'blue', src: 'CFG-SNAP', desc: 'Canada\'s Food Guide says: eat a variety of healthy foods each day. Have plenty of vegetables and fruits, choose whole grain foods, eat protein foods, and make water your drink of choice.' },

  // GREEN: Skills (13)
  { id: 'carbs-everywhere', name: 'How Many Carbs?', cat: 'green', src: 'DC-CARB', desc: 'Diabetes Canada says most people aim for about 45 to 60 g of carbohydrate at meals and 15 to 30 g at snacks. Your dietitian helps you set your own goal.' },
  { id: 'fifteen-fifteen-rule', name: 'Treat, Wait, Check Again', cat: 'green', src: 'DC-CPG14, DC-CPG34', desc: 'Under 4.0 mmol/L is a low. Have fast sugar, like glucose tablets, wait 15 minutes, and check again. Still low? Treat again. For kids, the amount of fast sugar depends on age, so your diabetes team tells you yours. Always carry fast sugar with you.' },
  { id: 'estimating-carbs', name: 'Carb Counting Tips', cat: 'green', src: 'DC-CARB', desc: 'Diabetes Canada\'s tips: check the serving size, use measuring cups and spoons when you can, and try to be within about 5 g of your carb goal for each meal or snack.' },
  { id: 'bedtime-snacks', name: 'Lows at Night', cat: 'green', src: 'DC-CPG14, DC-CPG10', desc: 'Lows can happen while you sleep, and you might not feel them. Exercise late in the day can raise the chance of a low overnight. Whether you need a bedtime snack is part of your plan with your diabetes team.' },
  { id: 'reading-labels', name: 'Reading a Nutrition Facts Table', cat: 'green', src: 'DC-CARB, CFG-LABELS', desc: 'Check the serving size first: every number is for that amount. Find Carbohydrate. Diabetes Canada says fibre does not raise blood sugar and should be subtracted from the total. Canada\'s Food Guide: 5% DV or less is a little, 15% DV or more is a lot.' },
  { id: 'restaurant-carbs', name: 'Carbs When Eating Out', cat: 'green', src: 'HC-NV, DC-HANDY', desc: 'Health Canada lists a hamburger bun at about 21 g of carbs and 20 to 25 fast-food fries at about 29 g. When there\'s no label, use foods you know and your Handy Portion Guide.' },
  { id: 'adjusting-exercise', name: 'Being Active', cat: 'green', src: 'DC-CPG34, DC-CPG10', desc: 'Diabetes Canada encourages kids with diabetes to be active at least 3 times a week for 60 minutes or more. Long exercise can lower blood sugar for up to 48 hours afterwards. Make an exercise plan with your diabetes team.' },
  { id: 'sick-day-management', name: 'Sick Days', cat: 'green', src: 'DC-CPG15, DC-CPG34', desc: 'When you\'re sick, blood sugar can go up and down in ways that are hard to predict. Check more often than usual (for example every 2 to 4 hours), check ketones, drink plenty of water or sugar-free fluids, and follow the sick-day plan you made with your diabetes team.' },
  { id: 'packing-trip', name: 'Packing for a Trip', cat: 'green', src: 'DC-AIR', desc: 'When you fly, keep insulin and supplies in your carry-on, never in checked luggage, because temperature changes can damage insulin. Bring extra insulin and supplies, glucagon, fast sugar, snacks, and a letter from your doctor.' },
  { id: 'site-rotation', name: 'Rotating Sites', cat: 'green', src: 'DC-INS', desc: 'Change where you inject insulin each time. Diabetes Canada says this helps prevent fatty lumps that can make insulin work poorly. On your belly, stay about 2 inches (three finger-widths) away from your belly button.' },
  { id: 'portion-estimation', name: 'The Handy Portion Guide', cat: 'green', src: 'DC-HANDY', desc: 'Diabetes Canada\'s Handy Portion Guide: grains, starches and fruit, the size of your fist. Vegetables, as much as both hands can hold. Meat and alternatives, the size of your palm and as thick as your little finger. Fat, the size of the tip of your thumb.' },
  { id: 'pre-bolusing', name: 'Timing Mealtime Insulin', cat: 'green', src: 'DC-INS', desc: 'Rapid-acting mealtime insulin is usually taken 0 to 15 minutes before a meal. Your diabetes team tells you what timing is right for you.' },
  { id: 'correcting-high', name: 'When You\'re High', cat: 'green', src: 'DC-CPG9', desc: 'Your diabetes team\'s plan tells you what to do about highs. Diabetes Canada recommends checking ketones when you\'re sick with high blood sugar, or when your BG before meals stays above 14.0 mmol/L.' },

  // GOLD: Life Wisdom (13). Encouragement, not medical facts.
  { id: 'talking-to-friends', name: 'Talking to Friends About T1D', cat: 'gold', src: 'encouragement', desc: 'Some days you\'ll want to explain everything. Other days you won\'t want to talk about it at all. Both are fine. Having a few people who understand can make things easier.' },
  { id: 'bad-days-okay', name: 'It\'s Okay to Have Bad Days', cat: 'gold', src: 'encouragement', desc: 'Some days your blood sugar goes all over the place, even when you followed your plan. That doesn\'t mean you failed. Try again tomorrow.' },
  { id: 'not-your-numbers', name: 'You Are Not Your Numbers', cat: 'gold', src: 'encouragement', desc: 'A blood sugar reading is information, not a grade. It helps you and your team make decisions. That\'s all it is.' },
  { id: 'asking-help', name: 'Asking for Help is a Strength', cat: 'gold', src: 'encouragement', desc: 'Managing T1D is a lot. Asking parents, friends, teachers or your diabetes team for help is a smart move.' },
  { id: 'setting-boundaries', name: 'Setting Boundaries', cat: 'gold', src: 'encouragement', desc: 'It\'s okay to say "I don\'t want to talk about that right now." You decide who you share your diabetes stuff with.' },
  { id: 'teaching-others', name: 'Teaching Others About T1D', cat: 'gold', src: 'encouragement', desc: 'When you explain T1D to someone, you become the expert. You don\'t have to correct everyone, but when you choose to teach, it helps.' },
  { id: 'burnout-real', name: 'Feeling Worn Out', cat: 'gold', src: 'DC-CPG34', desc: 'Diabetes Canada says kids and teens with diabetes can go through diabetes distress, and that support helps. If it all feels like too much, tell your family and your diabetes team.' },
  { id: 'celebrating-wins', name: 'Celebrating Small Wins', cat: 'gold', src: 'encouragement', desc: 'Caught a low early? Win. Counted carbs at a party? Win. Got through a tough day? Big win. Notice them.' },
  { id: 'every-expert-beginner', name: 'Every Expert Was Once a Beginner', cat: 'gold', src: 'encouragement', desc: 'Everything you\'re learning now gets easier with practice. Give yourself time.' },
  { id: 'feelings-valid', name: 'Your Feelings Are Valid', cat: 'gold', src: 'encouragement', desc: 'Whatever you feel about having T1D is okay to feel. Talking to someone you trust can help.' },
  { id: 'support-team', name: 'Building Your Support Team', cat: 'gold', src: 'DC-INS', desc: 'Family, friends, teachers, coaches and your diabetes team can all have your back. Diabetes Canada says it\'s important that others know you have diabetes, in case of an emergency.' },
  { id: 'self-advocacy', name: 'Speaking Up', cat: 'gold', src: 'encouragement', desc: 'Asking for what you need, like a snack in class or a break during sports to check your BG, gets easier with practice.' },
  { id: 'tld-not-define', name: 'T1D Doesn\'t Define You', cat: 'gold', src: 'encouragement', desc: 'You are a person who happens to have type 1 diabetes. It\'s part of your life, not all of it.' },

  // RED: Emergency (11)
  { id: 'when-call-help', name: 'When to Get Help', cat: 'red', src: 'DC-T1', desc: 'If you think you might have DKA, Diabetes Canada says to get medical help immediately. Warning signs include feeling very thirsty, very weak, peeing more than usual, shortness of breath, nausea, throwing up, stomach pain, and high blood sugar.' },
  { id: 'dka-signs', name: 'DKA: What It Is', cat: 'red', src: 'DC-T1, DC-CPG34, DC-CPG15', desc: 'DKA is a serious complication that happens when there isn\'t enough insulin in your body. In kids with diabetes, it comes from missed insulin or a sick day that didn\'t go to plan. Blood ketone tests are preferred over urine tests.' },
  { id: 'severe-low-others', name: 'Severe Lows: What Others Should Know', cat: 'red', src: 'DC-CPG14, DC-CPG12', desc: 'If someone with diabetes is unconscious from a low, they need glucagon, and emergency services should be called. The people around you should learn about lows: how to spot them and what to do.' },
  { id: 'glucagon-backup', name: 'Glucagon: The Emergency Backup', cat: 'red', src: 'DC-CPG14, DC-CPG34, DC-AIR', desc: 'Glucagon is an emergency medicine for severe lows, when someone can\'t safely eat or drink. Diabetes Canada suggests bringing a glucagon emergency kit when travelling or hiking somewhere remote.' },
  { id: 'sick-day-red-flags', name: 'Sick Day Warning Signs', cat: 'red', src: 'DC-T1, DC-CPG15', desc: 'Get help if you have DKA warning signs: very thirsty, very weak, peeing a lot, short of breath, throwing up or stomach pain. Diabetes Canada says sick-day plans that include ketone checks help young people stay out of the hospital.' },
  { id: 'device-failures', name: 'Have a Backup', cat: 'red', src: 'DC-AIR', desc: 'Diabetes Canada\'s travel checklist includes extra insulin, extra syringes and needles, and an extra insulin pen if you use one. Backups help if something breaks or runs out.' },
  { id: 'overnight-safety', name: 'Overnight Safety', cat: 'red', src: 'DC-CPG14, DC-CPG9', desc: 'Lows during sleep are common and may not wake you up. A CGM can sound an alarm when glucose goes below a limit you set.' },
  { id: 'exercise-emergencies', name: 'Fast Sugar, Always', cat: 'red', src: 'DC-CPG14', desc: 'Diabetes Canada says to carry fast sugar at all times, like glucose tablets or a juice box. If you feel shaky, sweaty, dizzy or confused while you\'re active, stop and check.' },
  { id: 'stress-bg', name: 'Sprinting Can Surprise You', cat: 'red', src: 'DC-CPG10', desc: 'Most exercise lowers blood sugar, but Diabetes Canada notes that brief, intense exercise like sprinting can make glucose go up for a while.' },
  { id: 'travel-safety', name: 'Airport Security', cat: 'red', src: 'DC-AIR', desc: 'You can bring liquids to treat lows through airport security, even over 100 mL, if you declare them. You don\'t have to remove your insulin pump for screening, but it shouldn\'t go through the body scanner or x-ray.' },
  { id: 'medical-id', name: 'Medical ID', cat: 'red', src: 'DC-INS', desc: 'Diabetes Canada says to always carry a card that says you have diabetes, and suggests a bracelet such as MedicAlert, so people know in an emergency.' }
];

const betaCellMap = {};
betaCells.forEach(bc => { betaCellMap[bc.id] = bc; });

// ============================================
// 8. JOURNAL VIEWER
// ============================================

function openJournal() {
  let overlay = document.getElementById('journal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'journal-overlay';
    overlay.className = 'hidden';
    document.getElementById('game').appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  renderJournal('all');
}

function renderJournal(filter) {
  const overlay = document.getElementById('journal-overlay');
  const found = state.score.collectiblesFound;
  const cats = [
    { key: 'all', label: 'All', color: '#aaa' },
    { key: 'blue', label: 'Facts', color: '#42A5F5' },
    { key: 'green', label: 'Skills', color: '#66BB6A' },
    { key: 'gold', label: 'Life Wisdom', color: '#FFD54F' },
    { key: 'red', label: 'Emergency', color: '#EF5350' }
  ];
  const filtered = filter === 'all' ? betaCells : betaCells.filter(b => b.cat === filter);
  const catCounts = {};
  cats.slice(1).forEach(c => {
    const total = betaCells.filter(b => b.cat === c.key).length;
    const have = betaCells.filter(b => b.cat === c.key && found.includes(b.id)).length;
    catCounts[c.key] = have + '/' + total;
  });

  overlay.innerHTML = '<div style="max-width:640px;width:100%;margin:0 auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<h2 style="color:var(--text-light);font-size:22px;">Knowledge Journal</h2>' +
    '<button id="journal-close-btn" style="background:var(--accent);color:white;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:15px;">Close</button></div>' +
    '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">' +
    cats.map(c => '<button class="journal-tab" data-cat="' + c.key + '" style="padding:6px 14px;border-radius:6px;border:2px solid ' + c.color + ';background:' + (filter === c.key ? c.color : 'transparent') + ';color:' + (filter === c.key ? '#fff' : c.color) + ';cursor:pointer;font-size:13px;font-weight:600;">' + c.label + (c.key !== 'all' ? ' ' + catCounts[c.key] : ' ' + found.length + '/' + betaCells.length) + '</button>').join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">' +
    filtered.map(bc => {
      const have = found.includes(bc.id);
      const colors = { blue: '#42A5F5', green: '#66BB6A', gold: '#FFD54F', red: '#EF5350' };
      return '<div class="journal-cell" data-id="' + bc.id + '" style="background:' + (have ? 'var(--bg-card)' : '#2a2a3e') + ';border:2px solid ' + (have ? colors[bc.cat] : '#444') + ';border-radius:8px;padding:12px;cursor:' + (have ? 'pointer' : 'default') + ';min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:transform 0.1s;">' +
        '<div style="width:24px;height:24px;border-radius:50%;background:' + (have ? colors[bc.cat] : '#555') + ';margin-bottom:8px;' + (have ? 'box-shadow:0 0 10px ' + colors[bc.cat] : '') + '"></div>' +
        '<div style="font-size:12px;color:' + (have ? 'var(--text-primary)' : '#666') + ';font-weight:600;">' + (have ? bc.name : '???') + '</div></div>';
    }).join('') + '</div><div id="journal-detail" style="margin-top:16px;"></div></div>';

  setTimeout(() => {
    document.getElementById('journal-close-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.querySelectorAll('.journal-tab').forEach(tab => {
      tab.addEventListener('click', () => renderJournal(tab.dataset.cat));
    });
    overlay.querySelectorAll('.journal-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const bc = betaCellMap[cell.dataset.id];
        if (bc && found.includes(bc.id)) showJournalDetail(bc);
      });
    });
  }, 30);
}

function showJournalDetail(bc) {
  const det = document.getElementById('journal-detail');
  if (!det) return;
  const colors = { blue: '#42A5F5', green: '#66BB6A', gold: '#FFD54F', red: '#EF5350' };
  det.innerHTML = '<div style="background:var(--bg-card);border:2px solid ' + colors[bc.cat] + ';border-radius:10px;padding:20px;">' +
    '<h3 style="margin-bottom:8px;">' + bc.name + '</h3>' +
    '<p style="color:var(--text-secondary);font-size:15px;line-height:1.6;">' + bc.desc + '</p></div>';
}

// ============================================
// 9. SAVE / LOAD SYSTEM (3 slots)
// ============================================
// The game autosaves after every passage. Saves hold the whole game state plus the
// ids of the events picked for the current day, so a refresh resumes mid-day.

const SAVE_PREFIX = 'sugarrush-slot-';
const LEGACY_SAVE_KEY = 'sugarrush-save';
const SLOT_COUNT = 3;
const NON_GAME_PASSAGE = /^(title|slot-|dedication|setup-)/;
let currentSlot = null;

const DEFAULT_STATE = JSON.stringify(state);
function resetState() {
  const fresh = JSON.parse(DEFAULT_STATE);
  Object.keys(fresh).forEach(k => { state[k] = fresh[k]; });
}

function slotKey(n) { return SAVE_PREFIX + n; }

function saveGame() {
  if (!currentSlot || !state.flags.setupComplete) return false;
  const cp = state.narrative.currentPassage;
  if (cp && !NON_GAME_PASSAGE.test(cp)) state.narrative.resumePassage = cp;
  const data = JSON.parse(JSON.stringify(state));
  data.bg.history = [];
  data.version = 3;
  data.timestamp = Date.now();
  try { localStorage.setItem(slotKey(currentSlot), JSON.stringify(data)); return true; }
  catch (e) { console.error('Save failed:', e); return false; }
}

function readSlot(n) {
  try { const raw = localStorage.getItem(slotKey(n)); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}

function loadGame(n) {
  const d = readSlot(n);
  if (!d) return false;
  resetState();
  ['player', 'bg', 'insulin', 'carbs', 'time', 'score', 'narrative', 'companion', 'flags'].forEach(k => {
    if (d[k]) state[k] = Object.assign(state[k], d[k]);
  });
  ['energy', 'confidence'].forEach(k => { if (typeof d[k] === 'number') state[k] = d[k]; });
  state.bg.history = [];
  if (!Array.isArray(state.score.bgSamples)) state.score.bgSamples = [];
  // v2 saves stored insulin with a different shape; drop it rather than misread it.
  if (!d.version || d.version < 3) { state.carbs.pending = []; state.insulin.pendingDoses = []; }
  currentSlot = n;
  return true;
}

function deleteSlot(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) {} }

// One-time move of the v0.1 single save into the first empty slot (never overwrites a slot).
function migrateLegacySave() {
  try {
    const raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return;
    for (let n = 1; n <= SLOT_COUNT; n++) {
      if (!localStorage.getItem(slotKey(n))) {
        localStorage.setItem(slotKey(n), raw);
        localStorage.removeItem(LEGACY_SAVE_KEY);
        return;
      }
    }
  } catch (e) {}
}

// Resume a loaded game at the exact passage it was on.
function resumeGame() {
  showHUD();
  const day = state.time.day;
  if (state.flags.weekComplete) { renderPassage('weekly-summary'); return; }
  const target = state.narrative.resumePassage;
  if (day === 1 && state.time.week === 1) {
    if (target && passages[target]) renderPassage(target, { skipOnEnter: true });
    else renderPassage('day1-wakeup');
  } else {
    if (state.narrative.dayPicks && state.narrative.dayPicks.day === day) {
      buildDay(day, state.narrative.dayPicks);
      if (target && passages[target]) renderPassage(target, { skipOnEnter: true });
      else renderPassage('d' + day + '-wakeup');
    } else {
      startDay(day);
    }
  }
  showCompanion('Welcome back, ' + state.player.name + '!', 4000);
}

// 10. EVENT POOL SYSTEM
// ============================================

// Each event = { id, title, type, tier, register(dayNum, prefix) }
// register() adds passages to the passage map and returns the entry passage ID

const mealPool = [];
const socialPool = [];
const emotionalPool = [];
const practicalPool = [];

// Events that only make sense on a school day (Monday to Friday).
const SCHOOL_ONLY = ['curious-classmate', 'show-tell', 'sub-teacher', 'playground-low', 'new-kid', 'school-supply', 'cafeteria-wildcard', 'school-lunch-line', 'bento-box'];

function pickFromPool(pool, tier, count, seen, day) {
  const eligible = pool.filter(e => e.tier <= tier && !seen.includes(e.id) && !(isWeekend(day) && SCHOOL_ONLY.includes(e.id)));
  return shuffle(eligible).slice(0, count);
}

// Emoji for a food, by keyword. First match wins, so specific words come first.
const FOOD_EMOJI = [
  ['ice cream', '🍨'], ['sundae', '🍨'], ['hot dog', '🌭'], ['popcorn', '🍿'], ['pancake', '🥞'], ['waffle', '🧇'],
  ['smoothie', '🥤'], ['fruit salad', '🍉'], ['berries', '🍓'], ['banana', '🍌'], ['apple', '🍎'], ['orange', '🍊'],
  ['pizza', '🍕'], ['taco', '🌮'], ['burrito', '🌯'], ['wrap', '🌯'], ['roti', '🫓'], ['naan', '🫓'], ['pita', '🫓'], ['bannock', '🫓'],
  ['sushi', '🍣'], ['dumpling', '🥟'], ['perogies', '🥟'], ['noodle', '🍜'], ['pho', '🍜'], ['soup', '🍲'], ['stew', '🍲'], ['chili', '🫘'],
  ['curry', '🍛'], ['butter chicken', '🍛'], ['dal', '🍛'], ['biryani', '🍛'], ['rice', '🍚'], ['stir-fry', '🥢'],
  ['pasta', '🍝'], ['spaghetti', '🍝'], ['mac', '🧀'], ['poutine', '🍟'], ['fries', '🍟'], ['fish', '🐟'], ['salmon', '🐟'],
  ['burger', '🍔'], ['steak', '🥩'], ['turkey', '🦃'], ['chicken', '🍗'], ['pie', '🥧'], ['cake', '🎂'], ['muffin', '🧁'],
  ['bagel', '🥯'], ['omelette', '🍳'], ['eggs', '🍳'], ['egg', '🍳'], ['oatmeal', '🥣'], ['oats', '🥣'], ['cereal', '🥣'], ['yogurt', '🥣'], ['parfait', '🥣'],
  ['sandwich', '🥪'], ['pb&j', '🥪'], ['toast', '🍞'], ['bread', '🍞'], ['crackers', '🍘'], ['cheese', '🧀'], ['milk', '🥛'],
  ['potato', '🥔'], ['salad', '🥗'], ['veggie', '🥦'], ['hummus', '🫘'], ['falafel', '🧆'], ['plate', '🍽️']
];
function foodEmoji(name) {
  const n = name.toLowerCase();
  for (const [k, e] of FOOD_EMOJI) if (n.includes(k)) return e;
  return '🍽️';
}

function registerMealEvent(id, title, tier, options, betaId) {
  mealPool.push({
    id, title, type: 'meal', tier,
    register: function(day, nextPassage, hour) {
      const p = 'd' + day + '-meal-' + id;
      addPassage(p, {
        content: (s) => sceneArt(options.foods.map(f => foodEmoji(f.name)).join(' '), [options.place || '🍽️']) +
          '<h2>' + title + '</h2>' +
          '<p class="passage-scene">' + options.scene + '</p>' +
          '<div class="food-list">' + options.foods.map(f =>
            '<div class="food-row"><span class="food-emoji">' + foodEmoji(f.name) + '</span><div><strong>' + f.name + '</strong> <span class="carb-tag">~' + f.carbs + 'g carbs</span><br><small>' + f.desc + '</small></div></div>'
          ).join('') + '</div>',
        onEnter: () => { if (hour) setClock(hour); else { advanceTime(0.5); tick(0.5); } showCompanion(options.companionIntro || 'What looks good?'); },
        choices: options.foods.map(f => ({
          text: foodEmoji(f.name) + ' ' + f.name + ' <span class="carb-tag">~' + f.carbs + 'g</span>',
          onSelect: (s) => {
            s.narrative.lastMealCarbs = f.carbs;
            s.narrative.wasHighBeforeMeal = s.bg.current > BGConfig.targetHigh;
            eatMeal(f.carbs, f.speed || 'slow');
            tick(0.5); advanceTime(0.5);
          },
          next: p + '-done'
        }))
      });
      addPassage(p + '-done', {
        content: (s) => {
          const zone = getBGZone(s.bg.current);
          const take = s.player.device.insulin === 'pump' ? 'You tell your pump the carbs and it gives your mealtime insulin.' : 'You take your mealtime insulin with your pen, following your plan.';
          let resultText;
          if (s.narrative.wasHighBeforeMeal) {
            resultText = 'You were above 10 before eating, so your plan covered that too. ' + s.companion.name + ': "It will come down. Give it a couple of hours."';
          } else if (zone.zone === 'high' || zone.zone === 'very-high') {
            resultText = 'Your BG is going up while the food digests. ' + s.companion.name + ': "That\'s normal after a meal. The insulin is working on it."';
          } else {
            resultText = options.result || (s.companion.name + ' gives you a thumbs up.');
          }
          return '<p>' + take + '</p><p>' + resultText + '</p>' +
            '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + zone.label + '</p>';
        },
        onEnter: (s) => {
          tick(0.5); advanceTime(0.5);
          showCompanion(contextualCompanionLine('afterMealGood'));
          if (s.narrative.wasHighBeforeMeal && collectBetaCell('correcting-high')) setTimeout(() => showBetaCellNotification(betaCellMap['correcting-high'].name, 'green'), 500);
          else if (betaId && collectBetaCell(betaId)) setTimeout(() => showBetaCellNotification(betaCellMap[betaId].name, betaCellMap[betaId].cat), 500);
        },
        next: nextPassage, continueText: 'Continue'
      });
      return p;
    }
  });
}

// Tier 1 meals
registerMealEvent('pancake', 'Pancake Morning', 1, {
  scene: 'Kitchen. The sweet smell of pancakes fills the air.',
  companionIntro: "Pancakes! Maple syrup has 14 g of carbs in one tablespoon.",
  foods: [
    { name: '3 pancakes + 2 tbsp maple syrup', carbs: 61, desc: '3 pancakes (33 g) + syrup (28 g).', speed: 'fast' },
    { name: '2 pancakes + strawberries', carbs: 28, desc: '2 pancakes (22 g) + 7 strawberries (6 g).', speed: 'fast' },
    { name: '1 pancake + 2 eggs', carbs: 13, desc: '1 pancake (11 g) + 2 eggs (2 g).', speed: 'slow' }
  ],
});

registerMealEvent('sandwich', 'Sandwich Builder', 1, {
  scene: 'Lunch time. You\'re building your own sandwich.',
  foods: [
    { name: 'Turkey sandwich on white bread', carbs: 36, desc: '2 slices white bread (36 g). Turkey has little carbohydrate.', speed: 'fast' },
    { name: 'Cheese sandwich on whole wheat', carbs: 33, desc: '2 slices whole wheat (32 g) + cheese (1 g).', speed: 'slow' },
    { name: 'Chicken wrap', carbs: 27, desc: 'One 20 cm wheat tortilla (27 g) with chicken and veggies.', speed: 'slow' }
  ]
}, 'macronutrients');

registerMealEvent('taco', 'Taco Night', 1, {
  scene: 'Family taco night. Everything is laid out to build your own.',
  foods: [
    { name: '3 soft corn tacos', carbs: 24, desc: '3 corn tortillas (8 g each), with fillings.', speed: 'slow' },
    { name: 'Taco bowl with rice and black beans', carbs: 53, desc: '½ cup rice (24 g) + ¾ cup black beans (29 g).', speed: 'slow' },
    { name: '2 flour tortilla tacos', carbs: 54, desc: '2 wheat tortillas (27 g each).', speed: 'slow' }
  ]
});

registerMealEvent('soup', 'Soup and Bread', 1, {
  scene: 'A warm bowl of soup and crusty bread.',
  companionIntro: "Soup can have hidden carbs — noodles, potatoes, beans.",
  foods: [
    { name: 'Chicken noodle soup + bread', carbs: 36, desc: '1 cup soup (18 g) + 1 slice white bread (18 g).', speed: 'slow' },
    { name: 'Tomato soup + 4 crackers', carbs: 27, desc: '1 cup tomato soup (18 g) + 4 saltines (9 g).', speed: 'slow' },
    { name: 'Chicken noodle soup only', carbs: 18, desc: '1 cup (18 g).', speed: 'slow' }
  ]
});

registerMealEvent('fruit-salad', 'Fruit Salad Surprise', 1, {
  scene: 'Someone brought a big fruit salad. "It\'s healthy!"',
  companionIntro: "Fruit is healthy AND it has carbs. Both things are true.",
  foods: [
    { name: 'Big bowl of fruit', carbs: 56, desc: 'A banana (27 g), 20 grapes (18 g), ½ cup blueberries (11 g).', speed: 'fast' },
    { name: 'Blueberries + plain yogurt', carbs: 24, desc: '½ cup blueberries (11 g) + ¾ cup plain yogurt (13 g).', speed: 'slow' },
    { name: 'Strawberries + cheese', carbs: 7, desc: '7 strawberries (6 g) + cheese (1 g).', speed: 'slow' }
  ]
});

// Tier 2 meals
registerMealEvent('birthday-pizza', 'Birthday Party Pizza', 2, {
  scene: 'A friend\'s birthday party. Pizza, cake, juice boxes. Everyone\'s eating.',
  companionIntro: "Social eating is hard. All approaches are valid here.",
  foods: [
    { name: 'Two slices of pizza', carbs: 50, desc: '2 slices of cheese pizza (25 g each).', speed: 'slow' },
    { name: 'One slice + salad', carbs: 25, desc: '1 slice (25 g). Salad has little carbohydrate.', speed: 'slow' },
    { name: 'One slice + ice cream', carbs: 43, desc: '1 slice (25 g) + ½ cup ice cream (18 g).', speed: 'slow' }
  ],
  result: "Party food is tricky, but you counted it."
}, 'restaurant-carbs');

registerMealEvent('cafeteria-wildcard', 'Cafeteria Wildcard', 2, {
  scene: 'The cafeteria changed the menu. Your planned meal isn\'t available.',
  companionIntro: "Plans change. Time to adapt.",
  foods: [
    { name: 'Spaghetti with sauce', carbs: 42, desc: '1 cup cooked spaghetti (42 g).', speed: 'slow' },
    { name: 'Chef salad + a bun', carbs: 21, desc: 'Salad with ham, cheese and egg, plus a bun (21 g).', speed: 'slow' },
    { name: 'Fish + fries', carbs: 29, desc: 'Baked fish + 20 to 25 fries (29 g).', speed: 'slow' }
  ]
});

registerMealEvent('grandma', 'Grandma\'s Cooking', 2, {
  scene: 'Grandma made a big meal. She\'s watching to make sure you eat enough. "Have more, you\'re too skinny!"',
  companionIntro: "Navigating family and food. You've got this.",
  foods: [
    { name: 'Her portion', carbs: 69, desc: '1½ cups mashed potatoes (57 g) + ½ cup peas (12 g) + roast.', speed: 'slow' },
    { name: 'Your own portion', carbs: 31, desc: '½ cup mashed potatoes (19 g) + ½ cup peas (12 g) + roast.', speed: 'slow' },
    { name: 'In between', carbs: 50, desc: '1 cup mashed potatoes (38 g) + ½ cup peas (12 g) + roast.', speed: 'slow' }
  ],
  result: "Family meals are about more than food. You managed both the carbs and the feelings."
});

registerMealEvent('protein-plate', 'The Protein Plate', 2, {
  scene: 'Tonight\'s dinner is steak with carrots and broccoli.',
  companionIntro: "Not every meal is carb-heavy. This one's mostly protein.",
  foods: [
    { name: 'Steak + carrots + broccoli', carbs: 12, desc: '½ cup carrots (6 g) + ½ cup broccoli (6 g).', speed: 'slow' },
    { name: 'Steak + veggies + a bun', carbs: 33, desc: 'Veggies (12 g) + a bun (21 g).', speed: 'slow' },
    { name: 'Steak + veggies + baked potato', carbs: 49, desc: 'Veggies (12 g) + a baked potato (37 g).', speed: 'slow' }
  ]
}, 'pre-bolusing');

registerMealEvent('smoothie-trap', 'The Smoothie Trap', 2, {
  scene: 'Your friend made smoothies. "They\'re so healthy!" The smoothie is HUGE.',
  companionIntro: "Smoothies can be carb bombs. That fruit adds up fast.",
  foods: [
    { name: 'Full smoothie', carbs: 72, desc: 'Banana (27 g) + ½ cup apple juice (15 g) + ¾ cup fruit yogurt (30 g).', speed: 'fast' },
    { name: 'Half the smoothie', carbs: 36, desc: 'Half of the big one.', speed: 'fast' },
    { name: 'Blueberry milk smoothie', carbs: 23, desc: '½ cup blueberries (11 g) + 1 cup milk (12 g).', speed: 'fast' }
  ]
});

// Tier 3 meals
registerMealEvent('restaurant-no-info', 'Restaurant — No Nutrition Info', 3, {
  scene: 'Family dinner at a local restaurant. No nutrition info anywhere. Time to estimate.',
  companionIntro: "No labels. Pure estimation. Use what you've learned.",
  foods: [
    { name: 'Spaghetti, about 1½ cups', carbs: 63, desc: '1½ cups cooked spaghetti (63 g).', speed: 'slow' },
    { name: 'Chicken + 1 cup rice', carbs: 48, desc: '1 cup cooked rice (48 g).', speed: 'slow' },
    { name: 'Burger + fries', carbs: 50, desc: 'Bun (21 g) + 20 to 25 fries (29 g).', speed: 'slow' }
  ],
  result: "Restaurant estimation is a real-world skill. Close enough is good enough."
}, 'portion-estimation');

registerMealEvent('cultural-feast', 'Cultural Feast', 3, {
  scene: 'A celebration meal with dishes you might not have tried before.',
  foods: [
    { name: 'Butter chicken + naan', carbs: 36, desc: 'Half a naan (36 g). The chicken has little carbohydrate.', speed: 'slow' },
    { name: 'Biryani (about 1 cup rice)', carbs: 48, desc: '1 cup cooked rice (48 g).', speed: 'slow' },
    { name: 'Chana + rice', carbs: 64, desc: '¾ cup chickpeas (40 g) + ½ cup rice (24 g).', speed: 'slow' }
  ],
  result: "Every cuisine is manageable. It's all about breaking down the carbs on the plate."
});

registerMealEvent('cook-own', 'Cook Your Own Meal', 3, {
  scene: 'You\'re making dinner tonight. You get to choose every ingredient.',
  companionIntro: "Cooking gives you the most control. You know exactly what's in it.",
  foods: [
    { name: 'Stir-fry + 1 cup rice', carbs: 48, desc: '1 cup rice (48 g). You measured it.', speed: 'slow' },
    { name: 'Omelette + 2 slices toast', carbs: 35, desc: '3 eggs (3 g) + 2 slices whole wheat toast (32 g).', speed: 'slow' },
    { name: 'Spaghetti with your own sauce', carbs: 42, desc: '1 cup cooked spaghetti (42 g).', speed: 'slow' }
  ]
});

registerMealEvent('buffet', 'The Buffet', 3, {
  scene: 'All-you-can-eat buffet. The options are overwhelming.',
  companionIntro: "Buffets are tricky. Portion control matters more than ever.",
  foods: [
    { name: 'Moderate plate', carbs: 54, desc: '1 cup rice (48 g) + veggies (6 g) + chicken.', speed: 'slow' },
    { name: 'Big plate', carbs: 111, desc: '1 cup rice (48 g) + 1 cup noodles (42 g) + a bun (21 g).', speed: 'slow' },
    { name: 'Protein plate', carbs: 30, desc: '½ cup rice (24 g) + veggies (6 g) + chicken.', speed: 'slow' }
  ]
});

registerMealEvent('not-hungry', 'Eating When You Don\'t Want To', 3, {
  scene: 'You\'re not hungry at all. But your BG is 5.2 and trending down. You need to eat.',
  companionIntro: "Sometimes eating is medicine. Not appetite.",
  foods: [
    { name: 'Crackers and cheese', carbs: 12, desc: '4 whole wheat crackers (11 g) + cheese (1 g).', speed: 'slow' },
    { name: 'Glass of milk', carbs: 12, desc: '1 cup milk (12 g).', speed: 'slow' },
    { name: 'Banana', carbs: 27, desc: '1 banana (27 g).', speed: 'fast' }
  ]
});

// More Tier 1 meals
registerMealEvent('yogurt-bowl', 'Yogurt Bowl', 1, {
  scene: 'A yogurt bowl with toppings set out on the counter.',
  companionIntro: "¾ cup of plain yogurt has about 13 g of carbs. The toppings add more.",
  foods: [
    { name: 'Yogurt + granola + blueberries', carbs: 47, desc: '¾ cup plain yogurt (13 g) + ¼ cup granola (23 g) + ½ cup blueberries (11 g).', speed: 'slow' },
    { name: 'Yogurt + blueberries', carbs: 24, desc: '¾ cup plain yogurt (13 g) + ½ cup blueberries (11 g).', speed: 'slow' },
    { name: 'Fruit yogurt', carbs: 30, desc: '¾ cup vanilla or fruit yogurt (30 g).', speed: 'slow' }
  ]
});

registerMealEvent('hotdog', 'Hot Dog Lunch', 1, {
  scene: 'Classic hot dog lunch at a cookout.',
  foods: [
    { name: 'Hot dog + pretzels', carbs: 29, desc: 'Bun (21 g) + 20 pretzel sticks (8 g).', speed: 'slow' },
    { name: 'Hot dog in a bun', carbs: 21, desc: 'Bun (21 g).', speed: 'slow' },
    { name: 'Hot dog, no bun, + carrots', carbs: 6, desc: '½ cup carrots (6 g).', speed: 'slow' }
  ]
});

registerMealEvent('chicken-rice', 'Chicken and Rice', 1, {
  scene: 'A home-cooked plate of chicken with rice and vegetables.',
  companionIntro: "Half a cup of cooked rice has about 24 g of carbs.",
  foods: [
    { name: '1 cup rice + chicken + broccoli', carbs: 54, desc: 'Rice (48 g) + broccoli (6 g).', speed: 'slow' },
    { name: '½ cup rice + chicken + broccoli', carbs: 30, desc: 'Rice (24 g) + broccoli (6 g).', speed: 'slow' },
    { name: 'Chicken + broccoli + carrots', carbs: 12, desc: 'Broccoli (6 g) + carrots (6 g).', speed: 'slow' }
  ]
});

// More Tier 2 meals
registerMealEvent('movie-snacks', 'Movie Theater', 2, {
  scene: 'The previews are starting. Someone hands you a shared bag of popcorn.',
  companionIntro: "Air-popped popcorn has about 7 g of carbs per cup. It adds up.",
  foods: [
    { name: 'Big popcorn + cola', carbs: 84, desc: '8 cups popcorn (56 g) + 1 cup cola (28 g).', speed: 'fast' },
    { name: 'Medium popcorn + water', carbs: 28, desc: '4 cups popcorn (28 g).', speed: 'fast' },
    { name: 'Small popcorn + water', carbs: 14, desc: '2 cups popcorn (14 g).', speed: 'fast' }
  ]
});

registerMealEvent('pasta-night', 'Pasta Night', 2, {
  scene: 'Spaghetti with meat sauce. Easy dinner. Hard carbs to count.',
  companionIntro: "One cup of cooked spaghetti has about 42 g of carbs. Portions are easy to misjudge.",
  foods: [
    { name: 'Big plate (2 cups)', carbs: 84, desc: '2 cups cooked spaghetti (84 g).', speed: 'slow' },
    { name: 'Normal plate (1 cup)', carbs: 42, desc: '1 cup cooked spaghetti (42 g).', speed: 'slow' },
    { name: '½ cup pasta + salad', carbs: 21, desc: '½ cup spaghetti (21 g). Salad has little carbohydrate.', speed: 'slow' }
  ]
}, 'estimating-carbs');

// More Tier 3 meals
registerMealEvent('ice-cream-trip', 'Ice Cream Trip', 3, {
  scene: 'Summer evening. The ice cream shop. Long line.',
  companionIntro: "Half a cup of ice cream has 18 g of carbs.",
  foods: [
    { name: '1½ cups ice cream', carbs: 54, desc: '1½ cups vanilla ice cream (54 g).', speed: 'slow' },
    { name: '1 cup ice cream', carbs: 36, desc: '1 cup (36 g).', speed: 'slow' },
    { name: '½ cup ice cream', carbs: 18, desc: '½ cup (18 g).', speed: 'slow' }
  ]
});

registerMealEvent('thanksgiving', 'Thanksgiving Dinner', 3, {
  scene: 'A big holiday meal. Turkey, mashed potatoes, corn, peas, rolls. All of it.',
  companionIntro: "Holiday meals are the hardest \u2014 lots of items, long meal, dessert later. Take it in pieces.",
  foods: [
    { name: 'A bit of everything', carbs: 78, desc: '1 cup mashed potatoes (38 g) + ½ cup corn (19 g) + a roll (21 g) + turkey.', speed: 'slow' },
    { name: 'Moderate plate', carbs: 38, desc: '½ cup mashed potatoes (19 g) + ½ cup corn (19 g) + turkey.', speed: 'slow' },
    { name: 'Mostly turkey and veggies', carbs: 18, desc: '½ cup peas (12 g) + ½ cup carrots (6 g) + turkey.', speed: 'slow' }
  ]
}, 'restaurant-carbs');

// --- v0.2 meals: more variety. Carb values are estimates (see HANDOFF: verify). ---
registerMealEvent('bagel-morning', 'Bagel Morning', 1, {
  scene: 'Kitchen. A bag of fresh bagels on the counter.',
  place: '🏠 🌅',
  companionIntro: 'One plain bagel has about 38 g of carbs, more than two slices of bread.',
  foods: [
    { name: 'Bagel with cream cheese', carbs: 38, desc: 'One plain bagel (38 g).', speed: 'slow' },
    { name: 'Half a bagel + egg', carbs: 20, desc: 'Half a bagel (19 g) + egg (1 g).', speed: 'slow' },
    { name: 'English muffin + egg', carbs: 27, desc: 'English muffin (26 g) + egg (1 g).', speed: 'slow' }
  ]
});

registerMealEvent('oatmeal-bar', 'Oatmeal Bar', 1, {
  scene: 'A pot of oatmeal and a row of toppings.',
  place: '🏠 🌅',
  companionIntro: '¾ cup of cooked oatmeal has 17 g of carbs. The toppings change the total.',
  foods: [
    { name: 'Oatmeal + raisins', carbs: 46, desc: '¾ cup oatmeal (17 g) + ¼ cup raisins (29 g).', speed: 'slow' },
    { name: 'Oatmeal + blueberries + milk', carbs: 40, desc: '¾ cup oatmeal (17 g) + ½ cup blueberries (11 g) + 1 cup milk (12 g).', speed: 'slow' },
    { name: 'Oatmeal + almonds', carbs: 24, desc: '¾ cup oatmeal (17 g) + ¼ cup almonds (7 g).', speed: 'slow' }
  ]
});

registerMealEvent('breakfast-wrap', 'Breakfast Wraps', 1, {
  scene: 'Someone is making breakfast wraps to go.',
  place: '🏠 🌅',
  foods: [
    { name: 'Egg and cheese wrap', carbs: 29, desc: 'Wheat tortilla (27 g) + egg (1 g) + cheese (1 g).', speed: 'slow' },
    { name: 'Bean breakfast burrito', carbs: 57, desc: 'Wheat tortilla (27 g) + ¾ cup black beans (29 g) + egg (1 g).', speed: 'slow' },
    { name: 'Yogurt + peaches', carbs: 28, desc: '¾ cup plain yogurt (13 g) + ½ cup canned peaches (15 g).', speed: 'slow' }
  ]
});

registerMealEvent('pita-lunch', 'Pita Lunch', 1, {
  scene: 'Lunch. A plate of pita, hummus, veggies and falafel.',
  place: '🏫 🍽️',
  foods: [
    { name: 'Pita with hummus and veggies', carbs: 41, desc: 'One pita (33 g) + ¼ cup hummus (8 g).', speed: 'slow' },
    { name: 'Half a pita + hummus', carbs: 25, desc: 'Half a pita (17 g) + ¼ cup hummus (8 g).', speed: 'slow' },
    { name: 'Greek salad + crackers', carbs: 11, desc: 'Salad with chicken + 4 whole wheat crackers (11 g).', speed: 'slow' }
  ]
});

registerMealEvent('dumplings', 'Dumpling Night', 1, {
  scene: 'Steaming baskets of dumplings at dinner.',
  place: '🏠 🌆',
  companionIntro: 'Each dumpling has about 8 g of carbs. Count the dumplings!',
  foods: [
    { name: '8 dumplings + rice', carbs: 88, desc: '8 dumplings (64 g) + ½ cup rice (24 g).', speed: 'slow' },
    { name: '8 dumplings', carbs: 64, desc: '8 dumplings (8 g each).', speed: 'slow' },
    { name: '4 dumplings + broth', carbs: 32, desc: '4 dumplings (32 g).', speed: 'slow' }
  ]
});

registerMealEvent('bento-box', 'Bento Box Lunch', 2, {
  scene: 'Your lunch box has little sections for each food.',
  place: '🏫 🍱',
  foods: [
    { name: 'Rice + salmon', carbs: 48, desc: '1 cup rice (48 g) + salmon.', speed: 'slow' },
    { name: 'Sushi (4 pieces)', carbs: 35, desc: '4 pieces sushi with fish (35 g).', speed: 'slow' },
    { name: 'Noodles in broth', carbs: 42, desc: '1 cup egg noodles (42 g).', speed: 'slow' }
  ]
});

registerMealEvent('chili-pot', 'Big Pot of Chili', 2, {
  scene: 'A pot of chili has been cooking all afternoon.',
  place: '🏠 🌆',
  companionIntro: 'Beans have carbs and lots of fibre.',
  foods: [
    { name: 'Chili + a bun', carbs: 44, desc: '1 cup chili (23 g) + a bun (21 g).', speed: 'slow' },
    { name: 'Chili over rice', carbs: 47, desc: '1 cup chili (23 g) + ½ cup rice (24 g).', speed: 'slow' },
    { name: 'Bowl of chili', carbs: 23, desc: '1 cup chili (23 g).', speed: 'slow' }
  ]
});

registerMealEvent('roti-dinner', 'Curry Night', 2, {
  scene: 'Dinner at a friend\'s house. Their family made naan and curry.',
  place: '🏡 🌆',
  companionIntro: 'Naan is the bread here. Chickpeas and lentils have carbs too.',
  foods: [
    { name: 'Naan + chickpea curry', carbs: 76, desc: 'Half a naan (36 g) + ¾ cup chickpeas (40 g).', speed: 'slow' },
    { name: 'Naan + chicken curry', carbs: 36, desc: 'Half a naan (36 g).', speed: 'slow' },
    { name: 'Lentil dal + rice', carbs: 53, desc: '¾ cup lentils (29 g) + ½ cup rice (24 g).', speed: 'slow' }
  ]
});

registerMealEvent('potluck', 'Community Potluck', 2, {
  scene: 'A community potluck. Long tables, lots of families, food from everywhere.',
  place: '🏛️ 🍽️',
  companionIntro: 'Potlucks are a carb-counting puzzle. Take a little of a few things.',
  foods: [
    { name: 'Bannock + chili', carbs: 42, desc: 'Bannock (19 g) + 1 cup chili (23 g).', speed: 'slow' },
    { name: 'Wild rice + turkey', carbs: 18, desc: '½ cup wild rice (18 g) + turkey.', speed: 'slow' },
    { name: 'A bit of everything', carbs: 56, desc: 'Bannock (19 g) + ½ cup wild rice (18 g) + ½ cup mashed potatoes (19 g).', speed: 'slow' }
  ]
});

registerMealEvent('hockey-poutine', 'Hockey Game Snack Bar', 3, {
  scene: 'Weekend hockey game at the arena. The snack bar smells amazing.',
  place: '🏒 🥅',
  companionIntro: 'One cup of poutine has about 25 g of carbs.',
  foods: [
    { name: 'Large poutine', carbs: 50, desc: '2 cups poutine (25 g per cup).', speed: 'slow' },
    { name: 'Small poutine', carbs: 25, desc: '1 cup poutine (25 g).', speed: 'slow' },
    { name: 'Hot dog + water', carbs: 21, desc: 'Bun (21 g).', speed: 'slow' }
  ]
});

registerMealEvent('pho-shop', 'Noodle Soup Restaurant', 3, {
  scene: 'A busy restaurant. Giant bowls of noodle soup go by.',
  place: '🍜 🏙️',
  companionIntro: 'One cup of rice noodles has about 46 g of carbs.',
  foods: [
    { name: 'Large bowl of pho', carbs: 92, desc: '2 cups rice noodles (46 g per cup).', speed: 'slow' },
    { name: 'Small bowl of pho', carbs: 46, desc: '1 cup rice noodles (46 g).', speed: 'slow' },
    { name: 'Light bowl', carbs: 23, desc: '½ cup rice noodles (23 g) in broth.', speed: 'slow' }
  ]
});

// Which meal of the day each meal event can be. Events with no entry here are never
// drawn (ice cream trip: a treat outing, not a meal). 'sick' meals are only for Friday.
const MEAL_SLOTS = {
  'pancake': ['breakfast'], 'yogurt-bowl': ['breakfast'], 'bagel-morning': ['breakfast'], 'oatmeal-bar': ['breakfast'],
  'breakfast-wrap': ['breakfast'], 'smoothie-trap': ['breakfast'],
  'sandwich': ['lunch'], 'hotdog': ['lunch'], 'pita-lunch': ['lunch'], 'bento-box': ['lunch'], 'cafeteria-wildcard': ['lunch'],
  'fruit-salad': ['lunch'], 'not-hungry': ['lunch'], 'movie-snacks': ['lunch'],
  'soup': ['lunch', 'dinner'], 'chicken-rice': ['lunch', 'dinner'], 'hockey-poutine': ['lunch', 'dinner'], 'pho-shop': ['lunch', 'dinner'],
  'birthday-pizza': ['lunch', 'dinner'], 'potluck': ['lunch', 'dinner'],
  'taco': ['dinner'], 'grandma': ['dinner'], 'protein-plate': ['dinner'], 'restaurant-no-info': ['dinner'], 'cultural-feast': ['dinner'],
  'cook-own': ['dinner'], 'buffet': ['dinner'], 'pasta-night': ['dinner'], 'thanksgiving': ['dinner'], 'dumplings': ['dinner'],
  'chili-pot': ['dinner'], 'roti-dinner': ['dinner'],
  'sick-lunch': ['sick-lunch'], 'sick-dinner': ['sick-dinner']
};
// Weekend-only lunches (you're not at school).
const WEEKEND_ONLY = ['movie-snacks', 'birthday-pizza', 'hockey-poutine', 'potluck'];

function pickMeal(slot, tier, seen, day) {
  const fits = e => (MEAL_SLOTS[e.id] || []).includes(slot) &&
    !(isWeekend(day) && SCHOOL_ONLY.includes(e.id)) &&
    !(!isWeekend(day) && slot === 'lunch' && WEEKEND_ONLY.includes(e.id));
  const pool = mealPool.filter(fits);
  const fresh = pool.filter(e => e.tier <= tier && !seen.includes(e.id));
  return pick(fresh.length ? fresh : pool.filter(e => e.tier <= tier)) || pick(pool) || null;
}

// --- Gentle meals for the sick day ---
registerMealEvent('sick-lunch', 'Something Gentle for Lunch', 1, {
  scene: 'Home sick. Your tummy is still a bit off, so lunch is something easy.',
  place: '🛋️ 🤒',
  companionIntro: 'Small and easy is fine today. Keep sipping fluids too.',
  foods: [
    { name: 'Chicken noodle soup + crackers', carbs: 27, desc: '1 cup soup (18 g) + 4 saltines (9 g).', speed: 'slow' },
    { name: 'Toast + applesauce', carbs: 33, desc: '1 slice white toast (18 g) + ½ cup unsweetened applesauce (15 g).', speed: 'slow' },
    { name: 'Plain rice + chicken', carbs: 24, desc: '½ cup rice (24 g).', speed: 'slow' }
  ]
});

registerMealEvent('sick-dinner', 'An Easy Dinner', 1, {
  scene: 'Evening. You\'re feeling a bit better and a bit hungry.',
  place: '🏠 🌆',
  companionIntro: 'Feeling better? Something simple is a good idea.',
  foods: [
    { name: 'Scrambled eggs + toast', carbs: 20, desc: '2 eggs (2 g) + 1 slice white toast (18 g).', speed: 'slow' },
    { name: 'Plain spaghetti', carbs: 42, desc: '1 cup cooked spaghetti (42 g).', speed: 'slow' },
    { name: 'Tomato soup + crackers', carbs: 27, desc: '1 cup tomato soup (18 g) + 4 saltines (9 g).', speed: 'slow' }
  ]
});

// --- SOCIAL EVENTS ---

function registerSocialEvent(id, title, tier, scene, dialogueChoices, betaId) {
  socialPool.push({
    id, title, type: 'social', tier,
    register: function(day, nextPassage) {
      const p = 'd' + day + '-social-' + id;
      addPassage(p, {
        content: () => '<h2>' + title + '</h2><p class="passage-scene">' + scene + '</p>',
        // ART: Character expressions for NPCs in social scene
        onEnter: () => { showCompanion("Your call. No wrong answer."); },
        choices: dialogueChoices.map((dc, i) => ({
          text: dc.text,
          onSelect: (s) => {
            updateConfidence(dc.conf || 5);
            s.narrative.choices[p] = dc.id || ('opt' + i);
          },
          next: p + '-resp'
        }))
      });
      addPassage(p + '-resp', {
        content: (s) => {
          const chosen = s.narrative.choices[p] || 'opt0';
          const dc = dialogueChoices.find(d => (d.id || 'opt0') === chosen) || dialogueChoices[0];
          return '<p>' + (dc.response || 'The moment passes. You handled it well.') + '</p>' +
            '<p><strong>' + s.companion.name + ':</strong> "' + (dc.companionSays || 'Nice. You handled that.') + '"</p>';
        },
        onEnter: () => {
          if (betaId && collectBetaCell(betaId)) setTimeout(() => showBetaCellNotification(betaCellMap[betaId].name, betaCellMap[betaId].cat), 500);
        },
        next: nextPassage, continueText: 'Continue'
      });
      return p;
    }
  });
}

// Tier 1
registerSocialEvent('curious-classmate', 'The Curious Classmate', 1,
  'A classmate notices you checking your BG. "Hey, what are you doing? Does that hurt?"',
  [
    { id: 'explain', text: '"I\'m checking my blood sugar. I have Type 1 Diabetes."', conf: 5, response: 'They listen carefully. "That\'s a lot to deal with. You\'re kind of amazing."', companionSays: 'Honest and direct. Well done.' },
    { id: 'casual', text: '"Just a quick health check. No big deal."', conf: 3, response: 'They nod. "Oh cool, okay." And go back to what they were doing.', companionSays: 'Short and simple. Works perfectly.' },
    { id: 'deflect', text: '"It\'s a thing. Don\'t worry about it."', conf: 3, response: 'They shrug. "Okay!" No awkwardness at all.', companionSays: 'You don\'t owe anyone an explanation.' }
  ]
);

registerSocialEvent('supportive-coach', 'The Supportive Coach', 1,
  'Your coach pulls you aside before practice. "I read about your diabetes. What do I need to know?"',
  [
    { id: 'explain', text: '"I might need to stop and eat if my blood sugar drops. I\'ll have snacks with me."', conf: 5, response: 'Coach nods seriously. "Got it. Just give me a signal and we\'ll take a break. No questions asked."', companionSays: 'Having adults who listen makes everything easier.' },
    { id: 'detailed', text: '"Here\'s what a low looks like, and here\'s where my glucose tabs are..."', conf: 5, response: 'Coach takes mental notes. "Thanks for telling me. I\'ve got your back."', companionSays: 'Teaching your coach — that\'s self-advocacy in action.' },
    { id: 'minimal', text: '"I\'ll be fine. I know how to handle it."', conf: 3, response: '"Alright, but don\'t be a hero. Health first, always."', companionSays: 'Fair enough. Just know the offer is there.' }
  ], 'self-advocacy'
);

registerSocialEvent('buddy-system', 'The Buddy System', 1,
  'A close friend says: "I want to learn how to help if you ever have a low. Can you teach me?"',
  [
    { id: 'teach', text: '"Absolutely! Here\'s what to do..." (Teach them: fast sugar, wait 15 minutes, check again)', conf: 5, response: 'You walk them through it. They practice pretending to hand you a juice box. You both laugh, but they\'re serious about remembering.', companionSays: 'You just taught someone something that could matter a lot. That\'s real friendship.' },
    { id: 'grateful', text: '"That means a lot. Let me show you where I keep my supplies."', conf: 5, response: 'You show them your kit. They ask good questions. It feels good to have someone in your corner.', companionSays: 'Building your support team, one person at a time.' },
    { id: 'later', text: '"Thanks! Can we do it another time? I appreciate you asking."', conf: 3, response: '"Totally. Whenever you\'re ready." They mean it.', companionSays: 'The offer stands. That\'s what matters.' }
  ], 'support-team'
);

registerSocialEvent('show-tell', 'Show and Tell', 1,
  'There\'s an opportunity to show your class/group your diabetes gear. Totally optional.',
  [
    { id: 'show', text: 'Show your gear and explain what each piece does', conf: 5, response: 'The class is fascinated. Someone says "That\'s like being a superhero with gadgets." You kind of like that comparison.', companionSays: 'You just educated a whole room. Superhero status confirmed.' },
    { id: 'pass', text: '"I\'ll pass this time."', conf: 3, response: 'No one minds. The moment moves on naturally.', companionSays: 'Your choice. Always.' }
  ], 'teaching-others'
);

// Tier 2
registerSocialEvent('cinnamon-grandma', 'The Cinnamon Cure', 2,
  'A well-meaning adult says: "My neighbour cured her diabetes with cinnamon and a special diet. You should try that!"',
  [
    { id: 'explain', text: '"Type 1 is different from Type 2. My immune system destroyed the cells that make insulin. That\'s why I need insulin."', conf: 5, response: 'They look a bit embarrassed but nod. "Oh, I didn\'t know there were different types."', companionSays: 'Handled with grace. Not everyone knows the difference — and now one more person does.' },
    { id: 'diplomatic', text: '"Thanks, I\'ll ask my doctor about that."', conf: 3, response: 'They feel heard, you didn\'t have to argue. Win-win.', companionSays: 'The diplomatic deflection. A classic.' },
    { id: 'smile', text: 'Smile and change the subject.', conf: 3, response: 'You redirect the conversation smoothly. You don\'t need to educate everyone.', companionSays: 'You don\'t owe anyone a biology lesson.' }
  ], 'what-is-t1d'
);

registerSocialEvent('sleepover', 'The Sleepover Dilemma', 2,
  'You\'re invited to a sleepover. You need to figure out: what to pack, what to tell the host\'s parents, and how to handle a midnight BG check in a shared room.',
  [
    { id: 'prepared', text: 'Tell the parents in advance and pack everything you need', conf: 5, response: 'The host\'s parents are great about it. They even ask what snacks to have on hand. The sleepover goes smoothly.', companionSays: 'Preparation is power. And you still had a great time.' },
    { id: 'wing-it', text: 'Pack your supplies but don\'t mention it unless necessary', conf: 3, response: 'It works out, but you have to explain at midnight when you need to check your BG. A little awkward, but your friend is cool about it.', companionSays: 'It worked, but next time a heads-up might make things easier.' },
    { id: 'skip', text: 'Decide to skip it this time', conf: 3, response: 'You stay home tonight.', companionSays: 'Sometimes you\'re not ready, and that\'s okay. There\'ll be more sleepovers.' }
  ], 'packing-trip'
);

registerSocialEvent('sub-teacher', 'The Substitute Teacher', 2,
  'A substitute teacher sees you eating a snack during class. "Put that away! No food in class."',
  [
    { id: 'explain', text: '"I have Type 1 Diabetes. I need to eat when my blood sugar is low. I have a medical note."', conf: 5, response: 'The sub looks uncertain but backs down. "Oh. Okay, carry on." Later, your regular teacher confirms everything is fine.', companionSays: 'That took courage. Speaking up for yourself when someone pushes back — that\'s a real skill.' },
    { id: 'nurse', text: '"Can I go to the nurse? They can explain."', conf: 5, response: 'The nurse handles it. The sub apologizes later. "I had no idea. Sorry about that."', companionSays: 'Smart move. Let the system work for you.' },
    { id: 'comply', text: 'Put the snack away', conf: 3, response: 'You put it away, but your BG drops. You raise your hand to go to the nurse. It works out, but it shouldn\'t have been this hard.', companionSays: 'That wasn\'t fair. But you handled it — and next time you\'ll know what to say.' }
  ]
);

registerSocialEvent('left-out', 'Feeling Left Out', 2,
  'Your friends are planning a big hike. You\'re anxious about managing BG during hours of walking with no shade and limited food options.',
  [
    { id: 'go-prepared', text: 'Go, but prepare: extra snacks, fast sugar, and more BG checks', conf: 5, response: 'The hike goes great. You stop once for a snack, and nobody minds. You made it to the top.', companionSays: 'You faced the fear AND had a good time. That\'s the whole game right there.' },
    { id: 'modify', text: 'Suggest a shorter hike that works for everyone', conf: 5, response: 'Your friends are totally fine with a shorter route. Turns out, a couple of them were nervous about the long one too.', companionSays: 'Advocating for what you need often helps everyone.' },
    { id: 'skip', text: 'Sit this one out', conf: 3, response: 'You stay home this time.', companionSays: 'Missing out is hard. But not every outing has to be yours.' }
  ], 'adjusting-exercise'
);

registerSocialEvent('food-police', '"Are You Allowed to Eat That?"', 2,
  'Someone watches you eat a cookie and says: "Are you allowed to eat that? I thought diabetics couldn\'t have sugar."',
  [
    { id: 'educate', text: '"Kids with T1D eat the same healthy foods as everyone else. We count the carbs and take insulin."', conf: 5, response: '"Oh! I didn\'t know that. Sorry for assuming." They look genuinely surprised and a little sheepish.', companionSays: 'One more person who gets it now. You\'re changing minds one cookie at a time.' },
    { id: 'short', text: '"Yep. I can eat whatever I want."', conf: 5, response: 'You take a bite. Eye contact maintained. Power move.', companionSays: 'Short, confident, done. Respect.' },
    { id: 'ignore', text: 'Keep eating without responding.', conf: 3, response: 'They get the message. You enjoy your cookie.', companionSays: 'Sometimes silence says everything.' }
  ], 'setting-boundaries'
);

// Tier 3
registerSocialEvent('new-kid', 'The New Kid', 3,
  'A new student just got diagnosed with T1D. They look scared and lost. A teacher asks if you can talk to them.',
  [
    { id: 'mentor', text: 'Sit with them and share your experience. "I know how you\'re feeling. It gets easier."', conf: 10, response: 'They listen to every word. By the end of the conversation, they look a little less terrified. "Thanks. Can I ask you more stuff later?" "Anytime."', companionSays: 'You just became someone\'s lighthouse. What you did today matters more than you know.' },
    { id: 'practical', text: 'Show them your gear and walk them through the basics.', conf: 8, response: 'You show them how your CGM/pump works, what glucose tabs taste like, how to count carbs. They\'re still scared, but now they\'re also curious.', companionSays: 'Knowledge replaces fear. You gave them that.' },
    { id: 'encourage', text: '"It\'s going to be okay. Everyone here will help you."', conf: 5, response: 'Simple, but they needed to hear it. They nod quietly.', companionSays: 'Sometimes the most powerful thing is just knowing you\'re not alone.' }
  ], 'every-expert-beginner'
);

registerSocialEvent('team-pressure', 'Team Sport Pressure', 3,
  'You\'re in the middle of a game. Your team is counting on you. But you feel the familiar wobble of a low coming on.',
  [
    { id: 'stop', text: 'Call a timeout. "I need a minute."', conf: 8, response: 'You step out, treat the low, rest for a few minutes, and come back. Nobody is upset. Your coach says "Good call."', companionSays: 'Health first. Always. The team gets it — and if they don\'t, that\'s on them, not you.' },
    { id: 'sub', text: 'Signal to sub out and treat on the bench.', conf: 5, response: 'You swap out, treat quickly, and watch from the bench for a few minutes. You go back in feeling solid.', companionSays: 'Smart. You didn\'t wait until it got worse.' },
    { id: 'push', text: 'Try to push through it.', conf: 0, response: 'You keep playing, but everything gets harder. Your vision swims. You finally sit down. Your teammate brings you juice. It was scary for a second.', companionSays: 'That was risky. Please don\'t do that. A few minutes of sitting out is always better than a dangerous low.' }
  ], 'exercise-emergencies'
);

registerSocialEvent('social-media', 'The Social Media Moment', 3,
  'Someone snapped a photo of you checking your BG and posted it with the caption "lol needle time." You see it on your phone.',
  [
    { id: 'confront', text: 'Ask them to take it down. "That\'s my medical stuff. It\'s not funny."', conf: 5, response: 'They take it down. "Oh, sorry. I didn\'t think about it like that." Maybe they actually learned something.', companionSays: 'You stood up for yourself. That post is gone and they\'ll think twice next time.' },
    { id: 'adult', text: 'Tell a trusted adult.', conf: 5, response: 'The adult handles it. The post comes down. You get an apology.', companionSays: 'Getting help isn\'t tattling. It\'s problem-solving.' },
    { id: 'let-go', text: 'Let it go. You know it wasn\'t meant to be cruel.', conf: 3, response: 'You move on.', companionSays: 'Your call. Just know it\'s always okay to speak up if something bothers you.' }
  ]
);

registerSocialEvent('skeptic', 'The Skeptic', 3,
  '"But you don\'t LOOK sick." Someone says it with genuine confusion.',
  [
    { id: 'educate', text: '"That\'s because T1D is an invisible illness. I manage it so well you can\'t tell."', conf: 5, response: 'They think about it. "Huh. I guess I never thought about it that way."', companionSays: '"You don\'t look sick" is one of the most common things people say. And you handled it perfectly.' },
    { id: 'humor', text: '"Thanks! I\'m putting a lot of work into not looking sick."', conf: 5, response: 'They laugh, then realize you\'re kind of serious too. "Wait, really? That sounds exhausting."', companionSays: 'Humor and truth, mixed perfectly.' },
    { id: 'shrug', text: '"Yeah, that\'s how invisible illnesses work."', conf: 3, response: 'Short. Pointed. They get it.', companionSays: 'Mic drop.' }
  ], 'tld-not-define'
);

registerSocialEvent('birthday-invite', 'The Birthday Invite', 1,
  'A friend hands you a birthday party invitation. "There will be cake! Is that okay for you?"',
  [
    { id: 'yes-cake', text: '"Yeah, I can eat cake \u2014 I just plan for it with my insulin."', conf: 5, response: 'Their eyes widen. "Oh, cool! I didn\'t know that." They look relieved.', companionSays: 'Now they know \u2014 no food is off limits, you just plan for it.' },
    { id: 'thanks-ask', text: '"Thanks for thinking of me. I\'ll be there."', conf: 4, response: 'They smile. "Can\'t wait!"', companionSays: 'Simple. Warm. You didn\'t have to explain anything unless you wanted to.' },
    { id: 'ask-menu', text: '"What food will be there? I just like to know ahead."', conf: 3, response: 'They list it off. You mentally add up the likely carbs. Pizza, cake, chips.', companionSays: 'Smart \u2014 knowing the menu ahead of time is a real advantage.' }
  ], 'talking-to-friends'
);

registerSocialEvent('well-meaning-adult', 'The Well-Meaning Adult', 2,
  'An adult at a community event watches you check your BG. "Oh you poor thing. Is that for your sugars?"',
  [
    { id: 'educate-gently', text: '"Yeah! It\'s Type 1 Diabetes \u2014 my body doesn\'t make insulin, so I take it with a pump/injection."', conf: 5, response: 'They listen intently. "Oh, I had no idea it was different from what my grandfather had."', companionSays: 'That\'s a big one \u2014 Type 1 and Type 2 are very different. Most people don\'t know.' },
    { id: 'polite', text: '"Yes. I\'m doing well with it, thanks."', conf: 4, response: 'They nod and move on. Short and polite.', companionSays: 'You don\'t owe anyone an explanation. Polite and brief works.' },
    { id: 'self-advocate', text: '"I\'m not a poor thing. I\'m handling it."', conf: 5, response: 'They blink. "Oh \u2014 I\'m sorry, you\'re right." A small teaching moment.', companionSays: 'Words matter. You corrected them without being unkind.' }
  ], 'self-advocacy'
);

registerSocialEvent('playground-low', 'Playground Moment', 1,
  'Mid-recess. You feel shaky \u2014 you\u2019re going low. A friend notices you\'ve stopped running.',
  [
    { id: 'tell-friend', text: '"I\u2019m low \u2014 I need to grab a snack. Can you come with me?"', conf: 5, response: 'They walk with you to the cubby where your glucose tabs are. "Of course."', companionSays: 'Having a buddy for lows is smart. You taught them how to help just by asking.' },
    { id: 'hide-it', text: 'Say nothing. Walk off alone.', conf: 1, response: 'You make it, but you were wobbly. If anything had gone wrong, nobody would have known.', companionSays: 'Lows are when you want people around, not fewer. Next time, try telling someone.' },
    { id: 'adult', text: 'Tell the teacher on duty.', conf: 4, response: 'They get you to the office quickly. You treat the low, rest 15 minutes, and recheck.', companionSays: 'Adults on duty are there exactly for this. Good call.' }
  ], 'severe-low-others'
);

// --- EMOTIONAL EVENTS ---

function registerEmotionalEvent(id, title, tier, scene, choices, betaId) {
  emotionalPool.push({
    id, title, type: 'emotional', tier,
    register: function(day, nextPassage) {
      const p = 'd' + day + '-emo-' + id;
      addPassage(p, {
        content: () => '<h2>' + title + '</h2><p class="passage-scene">' + scene + '</p>',
        onEnter: () => { showCompanion(choices[0].companionSetup || "How are you doing?"); },
        choices: choices.map((c, i) => ({
          text: c.text, next: p + '-resp',
          onSelect: (s) => { updateConfidence(c.conf || 3); s.narrative.choices[p] = c.id || ('opt' + i); }
        }))
      });
      addPassage(p + '-resp', {
        content: (s) => {
          const chosen = s.narrative.choices[p];
          const c = choices.find(x => (x.id || 'opt0') === chosen) || choices[0];
          return '<p>' + (c.response || '') + '</p><p><strong>' + s.companion.name + ':</strong> "' + c.companionSays + '"</p>';
        },
        onEnter: () => {
          if (betaId && collectBetaCell(betaId)) setTimeout(() => showBetaCellNotification(betaCellMap[betaId].name, betaCellMap[betaId].cat), 500);
        },
        next: nextPassage, continueText: 'Continue'
      });
      return p;
    }
  });
}

registerEmotionalEvent('frustration', 'The Frustration', 1,
  'Your BG went high even though you did everything right. The number stares back at you from the screen.',
  [
    { id: 'vent', text: '"This isn\'t fair."', conf: 3, response: 'You stare at the number. It doesn\'t change. But saying it out loud helps a little.', companionSays: 'Yeah. It isn\'t fair. And it\'s okay to be mad about it.' },
    { id: 'fix', text: 'Take a breath and follow my plan for highs.', conf: 5, response: 'You follow your plan and move on. The number will come down. You know what to do.', companionSays: 'That\'s resilience right there. Feel it AND fix it.' },
    { id: 'shrug', text: '"Whatever. It\'ll come down."', conf: 3, response: 'You shrug it off. Some battles aren\'t worth the emotional energy.', companionSays: 'Sometimes that\'s the right move. Not every high needs a feelings conversation.' }
  ], 'not-your-numbers'
);

registerEmotionalEvent('small-win', 'The Small Win', 1,
  'You check your BG after a tricky meal... and it\'s perfect. Right in the middle of the green zone.',
  [
    { id: 'celebrate', text: 'Fist pump. You nailed it.', conf: 5, response: 'A grin spreads across your face. You actually nailed the carb count AND the timing.', companionSays: 'See that? That was all you. No luck — that was skill.' },
    { id: 'note', text: 'Make a mental note of what you did right.', conf: 5, response: 'You think back through the meal. You\'ll remember this one.', companionSays: 'Learning from success is just as important as learning from mistakes.' }
  ], 'celebrating-wins'
);

registerEmotionalEvent('missing-normal', 'Missing Normal', 2,
  'A quiet moment. You watch your friends eating without thinking, running without checking, living without counting. You remember what that felt like.',
  [
    { id: 'feel', text: 'Let yourself feel it.', conf: 3, response: 'You sit with it for a moment. Then the moment passes.', companionSays: 'I\'m not going to tell you to look on the bright side. This is a real loss, and you\'re allowed to grieve it.' },
    { id: 'reframe', text: '"I can still do everything they do. I just do it differently."', conf: 5, response: 'You watch them again. You\'re doing the same things — eating, running, living. Just with extra steps.', companionSays: 'Different, not less. That\'s the truth.' },
    { id: 'distract', text: 'Push the feeling aside and focus on something else.', conf: 3, response: 'You redirect your attention. The feeling will come back sometime, but right now you\'re okay.', companionSays: 'There\'s no right way to handle this. Whatever gets you through the moment.' }
  ], 'feelings-valid'
);

registerEmotionalEvent('bad-day', 'The Bad Day', 2,
  'BG was all over the place today. High after breakfast, low before lunch, high again at dinner. Nothing worked the way it was supposed to.',
  [
    { id: 'frustrated', text: '"I did everything right and it still didn\'t work."', conf: 3, response: 'It\'s true. Sometimes the body just doesn\'t cooperate. Hormones, stress, weather — things you can\'t control.', companionSays: 'Some days are like that. Even people who\'ve done this for 20 years have bad days. This doesn\'t mean you\'re failing.' },
    { id: 'accept', text: '"Tomorrow is a new day."', conf: 5, response: 'You close the day out and look forward. Tomorrow the numbers reset.', companionSays: 'That\'s the spirit. Every day is a fresh start.' }
  ], 'bad-days-okay'
);

registerEmotionalEvent('burnout', 'Burnout', 3,
  'Checking. Counting. Every single day. Today you notice just how much of it there is.',
  [
    { id: 'vent', text: 'Tell someone how you\'re feeling.', conf: 5, response: 'You talk to someone you trust. They listen. They don\'t try to fix it — they just hear you. It helps more than you expected.', companionSays: 'Burnout is real, it\'s normal, and talking about it is the first step. You\'re not alone in this.' },
    { id: 'skip', text: 'Skip a check. Just this once.', conf: 0, response: 'You skip one check. The world doesn\'t end. But the BG drifts a bit without you noticing. Tomorrow, you get back to it.', companionSays: 'I get it. Just... come back to it when you\'re ready. The routine is there when you need it.' },
    { id: 'rest', text: 'Keep managing, but give yourself permission to be tired.', conf: 5, response: 'You do the checks, take the insulin, count the carbs — but you also acknowledge that it\'s exhausting. And that\'s enough.', companionSays: 'You can be tired AND capable at the same time. Both things are true.' }
  ], 'burnout-real'
);

registerEmotionalEvent('pride', 'Pride', 3,
  'End of a really tough day. Multiple curveballs. But you managed every single one. Your BG is in range. Your energy is good. You did this.',
  [
    { id: 'own-it', text: 'Let yourself feel proud.', conf: 10, response: 'You sit with the feeling for a moment. You did a hard thing.', companionSays: 'You handled that whole day. No help needed. That\'s real.' },
    { id: 'share', text: 'Tell someone about your day.', conf: 8, response: 'You share the highlights. They might not fully understand, but they can tell it was a big day.', companionSays: 'Share the wins. People want to celebrate with you.' }
  ]
);

registerEmotionalEvent('why-me', 'Why Me?', 2,
  'A quiet moment lying on your bed. The question sneaks up like it always does: why does this have to be my life? What did I do?',
  [
    { id: 'nothing', text: '"Nothing. I didn\'t do anything. It just happened."', conf: 5, response: 'You let that truth settle. It wasn\'t caused by anything you ate or didn\'t do. That\'s a strange kind of relief.', companionSays: 'T1D is autoimmune. Your immune cells attacked the cells that make insulin by mistake.' },
    { id: 'unfair', text: '"It\'s not fair."', conf: 4, response: 'You acknowledge it \u2014 it isn\'t fair. And somehow saying it out loud makes it a little lighter.', companionSays: "It\u2019s not fair. That\u2019s a true thing. You\u2019re allowed to say it." },
    { id: 'shrug-it-off', text: '"I\'m not going to think about this right now."', conf: 2, response: 'You roll over and put your phone in your hand. Sometimes the answer is "not tonight."', companionSays: 'You don\'t have to have the big thoughts every day. Sometimes you just live the day.' }
  ], 'feelings-valid'
);

registerEmotionalEvent('new-routine', 'The New Routine', 1,
  'It\u2019s only been a little while since you started managing this. Some things feel automatic now. Some things still feel strange. You pause, halfway through a check, and notice yourself.',
  [
    { id: 'notice', text: 'Notice how far you\'ve come.', conf: 5, response: 'You think back to your first finger prick or your first pump site change. You were terrified. Now it\'s just\u2026 part of your day.', companionSays: 'Every expert was a beginner. You\u2019re building something real.' },
    { id: 'nervous', text: 'Notice how much you still don\'t know.', conf: 3, response: 'There\'s so much. But you also realize there\'s no finish line \u2014 you just keep learning.', companionSays: "I\u2019m still learning too. And that\u2019s fine \u2014 nobody has this all figured out." }
  ], 'every-expert-beginner'
);

// --- PRACTICAL EVENTS ---

function registerPracticalEvent(id, title, tier, scene, choices, betaId) {
  practicalPool.push({
    id, title, type: 'practical', tier,
    register: function(day, nextPassage) {
      const p = 'd' + day + '-prac-' + id;
      addPassage(p, {
        content: () => '<h2>' + title + '</h2><p class="passage-scene">' + scene + '</p>',
        onEnter: () => { showCompanion(choices[0].setup || "Let's handle this."); },
        choices: choices.map((c, i) => ({
          text: c.text, next: p + '-result',
          onSelect: (s) => { updateConfidence(c.conf || 3); s.narrative.choices[p] = c.id || ('opt' + i); if (c.effect) c.effect(s); }
        }))
      });
      addPassage(p + '-result', {
        content: (s) => {
          const chosen = s.narrative.choices[p];
          const c = choices.find(x => (x.id || 'opt0') === chosen) || choices[0];
          return '<p>' + (c.result || 'Handled.') + '</p>';
        },
        onEnter: () => {
          if (betaId && collectBetaCell(betaId)) setTimeout(() => showBetaCellNotification(betaCellMap[betaId].name, betaCellMap[betaId].cat), 500);
        },
        next: nextPassage, continueText: 'Continue'
      });
      return p;
    }
  });
}

registerPracticalEvent('pack-bag', 'Pack Your Bag', 1,
  'You\'re heading out for the day. Time to make sure you have everything.',
  [
    { id: 'full', text: 'Pack everything: insulin, meter, glucose tabs, snacks, water, medical ID', conf: 5, result: 'Your bag is ready. You\'ve got everything you might need. It\'s a bit heavier, but peace of mind is worth it.', setup: "Let's make sure you're prepared." },
    { id: 'quick', text: 'Grab the essentials: insulin and glucose tabs', conf: 3, result: 'Light pack. Hopefully you won\'t need more than this, but if you do...', setup: "Quick pack? Risky but let's see." },
  ]
);

registerPracticalEvent('fridge-check', 'The Fridge Check', 1,
  'Time to check your insulin supply. Is everything stored properly?',
  [
    { id: 'check', text: 'Check expiry dates and temperature. Everything looks good.', conf: 3, result: 'Insulin is stored at the right temperature, not expired, and you have enough for the week. All good.' },
    { id: 'notice', text: 'Notice the insulin got pushed to the back of the fridge — almost frozen!', conf: 5, result: 'Good catch! Frozen insulin doesn\'t work properly. You move it to a safer spot and note the opened vial\'s date.' }
  ], 'what-is-insulin'
);

registerPracticalEvent('pharmacy', 'Pharmacy Run', 2,
  'Running low on supplies. Time to check what you need and pick it up.',
  [
    { id: 'list', text: 'Make a list: test strips, insulin, pump sites/pen needles, glucose tabs', conf: 5, result: 'You check everything, make a list, and get it sorted. Staying on top of supplies is part of the routine.' },
    { id: 'rush', text: 'Realize at the last minute you\'re almost out — rush to the pharmacy', conf: 3, result: 'You make it in time, but barely. A reminder to check supplies before they run low.' }
  ]
);

practicalPool.push({
  id: 'site-change', title: 'Site Change Time', type: 'practical', tier: 2,
  register: function(day, nextPassage) {
    const p = 'd' + day + '-prac-site-change';
    addPassage(p, {
      content: (s) => '<h2>Site Change Time</h2><p class="passage-scene">' +
        (s.player.device.insulin === 'pump'
          ? 'Your pump site has been in for 3 days. Time to change it.'
          : 'Time to think about where you\'re injecting. Are you rotating sites?') + '</p>',
      onEnter: () => { showCompanion("Let's handle this."); },
      choices: [
        { text: 'Choose a new spot — somewhere you haven\'t used recently', next: p + '-result',
          onSelect: (s) => { updateConfidence(5); s.narrative.choices[p] = 'rotate'; } },
        { text: 'Put it close to the old spot — it\'s just easier', next: p + '-result',
          onSelect: (s) => { updateConfidence(3); s.narrative.choices[p] = 'nearby'; } }
      ]
    });
    addPassage(p + '-result', {
      content: (s) => {
        const chosen = s.narrative.choices[p];
        return '<p>' + (chosen === 'rotate'
          ? 'New site is in a well-rested spot. Rotating helps prevent fatty lumps that can make insulin work poorly.'
          : 'It works, but using the same spot again and again can cause fatty lumps that make insulin work poorly. Try to move further next time.') + '</p>';
      },
      onEnter: () => {
        if (collectBetaCell('site-rotation')) setTimeout(() => showBetaCellNotification(betaCellMap['site-rotation'].name, betaCellMap['site-rotation'].cat), 500);
      },
      next: nextPassage, continueText: 'Continue'
    });
    return p;
  }
});

registerPracticalEvent('dead-battery', 'Dead Battery', 2,
  'Your meter just died. Or your CGM sensor fell off in the shower. Tech problems!',
  [
    { id: 'backup', text: 'Pull out your backup supplies', conf: 5, result: 'You had spare batteries and a backup meter. Crisis averted. This is why we pack extras.' },
    { id: 'borrow', text: 'Ask someone for help finding a solution', conf: 3, result: 'You figure it out — borrow batteries, or use your backup method. Not ideal, but you managed.' }
  ], 'device-failures'
);

registerPracticalEvent('travel-prep', 'Travel Prep', 3,
  'You\'re going on a trip. Time zones, keeping insulin cool, carrying enough supplies, airport security...',
  [
    { id: 'thorough', text: 'Make a full travel checklist and pack double supplies', conf: 5, result: 'Double the insulin, double the test strips, doctor\'s letter, snacks in carry-on, insulin in a cool pack. You\'re ready for anything.' },
    { id: 'minimal', text: 'Pack what you normally would plus a few extras', conf: 3, result: 'Hopefully enough. But if your luggage gets lost or the trip extends...' }
  ], 'travel-safety'
);

registerPracticalEvent('doctor-visit', 'Doctor\'s Appointment', 3,
  'Time for a check-up with your diabetes team. They want to review your numbers and talk about how things are going.',
  [
    { id: 'honest', text: 'Be honest about the good days AND the hard days', conf: 5, result: 'Your team appreciates the honesty. They adjust a few things and reassure you that you\'re doing well. "We\'re on the same team," your doctor says.' },
    { id: 'numbers', text: 'Focus on the numbers and keep it clinical', conf: 3, result: 'The numbers are reviewed. Some tweaks are made. It\'s productive, if a bit dry.' }
  ], 'asking-help'
);

registerPracticalEvent('emergency-card', 'Emergency Info Card', 3,
  'Let\'s review your emergency information. Do the people around you know what to do?',
  [
    { id: 'review', text: 'Review and update your emergency contacts and info', conf: 5, result: 'Emergency contacts updated. Glucagon location confirmed. Key people know the plan. You\'re prepared for the worst while hoping for the best.' },
    { id: 'tell', text: 'Tell one new person about your emergency plan', conf: 5, result: 'One more person knows where your glucagon is and when to call 911. Your safety net just got wider.' }
  ], 'medical-id'
);

practicalPool.push({
  id: 'low-supplies', title: 'Running Low on Supplies', type: 'practical', tier: 2,
  register: function(day, nextPassage) {
    const p = 'd' + day + '-prac-low-supplies';
    addPassage(p, {
      content: (s) => '<h2>Running Low on Supplies</h2><p class="passage-scene">' +
        (s.player.device.insulin === 'pump'
          ? 'You open the drawer and notice: only three infusion sets left. Reservoir cartridges running low. Test strips \u2014 half a vial. This is lower than it should be.'
          : 'You open the drawer and notice: only two insulin pens left. A handful of pen needles. Test strips \u2014 half a vial. This is lower than it should be.') + '</p>',
      onEnter: () => { showCompanion("Let's handle this."); },
      choices: [
        { text: 'Order refills today, before it gets urgent', next: p + '-result',
          onSelect: (s) => { updateConfidence(5); s.narrative.choices[p] = 'order-now'; } },
        { text: 'Set a reminder and order tomorrow', next: p + '-result',
          onSelect: (s) => { updateConfidence(3); s.narrative.choices[p] = 'remind'; } },
        { text: 'You\u2019ll deal with it later', next: p + '-result',
          onSelect: (s) => { updateConfidence(0); s.narrative.choices[p] = 'ignore'; updateConfidence(-3); } }
      ]
    });
    addPassage(p + '-result', {
      content: (s) => {
        const chosen = s.narrative.choices[p];
        if (chosen === 'order-now') return '<p>You put in the order. Your pharmacy will have them in a few days. Future-you will be glad.</p>';
        if (chosen === 'remind') return '<p>Reminder set. It\u2019s on the list \u2014 just not done yet.</p>';
        return '<p>You close the drawer. In three days, you\u2019ll be scrambling. You know this.</p>';
      },
      onEnter: () => {
        if (collectBetaCell('device-failures')) setTimeout(() => showBetaCellNotification(betaCellMap['device-failures'].name, betaCellMap['device-failures'].cat), 500);
      },
      next: nextPassage, continueText: 'Continue'
    });
    return p;
  }
});

registerPracticalEvent('school-supply', 'School Nurse Supply Drop', 1,
  'The school nurse asked you to drop off a small emergency kit \u2014 glucose tabs, a juice box, and a note with your emergency contacts \u2014 so it\u2019s there if you ever need it.',
  [
    { id: 'full-kit', text: 'Drop off the full kit with glucose tabs, juice, and a note', conf: 5, result: 'The nurse thanks you and puts it in your file. If anything happens at school, they\'re ready.' },
    { id: 'just-tabs', text: 'Just bring the glucose tabs', conf: 3, result: 'Better than nothing. You tell yourself you\'ll bring the rest tomorrow.' }
  ], 'severe-low-others'
);

// ============================================
// 11. MINI-GAME FRAMEWORK + IMPLEMENTATIONS
// ============================================
// Every mini-game: a start screen that explains it, no timers on learning games,
// answers can be changed until they're right, and the finish is always encouraging.
// Stars are kept internally (they nudge Confidence) but never shown.

const miniGameSchedule = {
  1: { am: { name: 'Carb Counter',      desc: 'Add up the carbs on a plate.' },
       pm: { name: 'Exercise Balance',  desc: 'Gym class! Keep your BG in the green while you move.' } },
  2: { am: { name: 'Label Reader',      desc: 'Read a Canadian Nutrition Facts label. Take your time.' },
       pm: { name: 'Carb Counter',      desc: 'A new plate to count.' } },
  3: { am: { name: 'Mealtime Routine',  desc: 'Walk through the steps you follow at every meal.' },
       pm: { name: 'Pack Your Bag',     desc: 'Pack everything you need for a day at school.' } },
  4: { am: { name: 'Portion Estimator', desc: 'Look at the plate and estimate the carbs.' },
       pm: { name: 'Carb Catcher',      desc: 'Catch foods to keep your BG in the green zone while you play.' } },
  5: { am: { name: 'Label Reader',      desc: 'Crackers and soup are about all you can manage. Read the labels.' },
       pm: { name: 'Sick Day Protocol', desc: 'Step through what to do on a sick day.' } },
  6: { am: { name: 'Pack Your Bag',     desc: 'Pack for a Saturday out with friends.' },
       pm: { name: 'Exercise Balance',  desc: 'A long bike ride. Keep your BG in the green.' } },
  7: { am: { name: 'Mealtime Routine',  desc: 'Tricky meals: estimating, fatty foods, and knowing when to wait.' },
       pm: { name: 'Carb Catcher',      desc: 'One more round of catching. Which foods have the most carbs?' } }
};

const miniGameBetaCells = {
  'Carb Counter':     'carbs-everywhere',
  'Mealtime Routine': 'what-is-bolus',
  'Treat-the-Low':    'fifteen-fifteen-rule',
  'Label Reader':     'reading-labels',
  'Exercise Balance': 'adjusting-exercise',
  'Pack Your Bag':    'packing-trip',
  'Carb Catcher':     'what-are-carbs',
  'Portion Estimator':'portion-estimation',
  'Sick Day Protocol':'sick-day-management'
};

const MiniGames = {};

function renderMGPanel(innerHtml) {
  const container = document.getElementById('passage-container');
  container.innerHTML = '';
  document.getElementById('narrative').scrollTop = 0;
  const div = document.createElement('div');
  div.className = 'minigame-panel';
  div.innerHTML = innerHtml;
  container.appendChild(div);
  return div;
}

function starsFromDiff(diff, thresholds) {
  if (diff <= thresholds[0]) return 3;
  if (diff <= thresholds[1]) return 2;
  if (diff <= thresholds[2]) return 1;
  return 0;
}

// Encouraging finish box with a Continue button.
function mgFinish(message, onContinue, emoji) {
  const resDiv = document.getElementById('mg-result');
  resDiv.className = 'mg-result good';
  resDiv.innerHTML = '<div class="mg-finish-emoji">' + (emoji || '🎉') + '</div>' + message +
    '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
  document.getElementById('mg-continue').addEventListener('click', onContinue);
  resDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Step-by-step question game used by Mealtime Routine and Sick Day Protocol.
function runSteps(panelTitle, subtitle, steps, finishMsg, onComplete) {
  let i = 0, firstTry = 0;
  function show() {
    const st = steps[i];
    renderMGPanel('<h2>' + panelTitle + '</h2><p class="mg-subtitle">' + subtitle + '</p>' +
      '<div class="step-dots">' + steps.map((_, k) => '<span class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></span>').join('') + '</div>' +
      (st.art ? sceneArt(st.art, [], 'day') : '') +
      '<div class="step-card"><p>' + st.situation + '</p><p><strong>' + st.q + '</strong></p></div>' +
      '<div id="mg-step-quiz"></div>' +
      '<div style="margin-top:12px;display:none;" id="mg-next-wrap"><button class="mg-action-btn" id="mg-next">' + (i < steps.length - 1 ? 'Next step ▶' : 'Finish ▶') + '</button></div>' +
      '<div id="mg-result"></div>');
    let tried = false;
    choiceQuiz(document.getElementById('mg-step-quiz'), shuffle(st.choices), (ok) => {
      if (ok && !tried) firstTry++;
      if (!ok) tried = true;
      document.getElementById('mg-next-wrap').style.display = ok ? '' : 'none';
    });
    document.getElementById('mg-next').addEventListener('click', () => {
      i++;
      if (i < steps.length) { show(); return; }
      renderMGPanel('<h2>' + panelTitle + '</h2><div id="mg-result"></div>');
      mgFinish(finishMsg, () => onComplete({ stars: firstTry === steps.length ? 3 : firstTry >= steps.length - 1 ? 2 : 1, summary: finishMsg }));
    });
  }
  show();
}

// ---- Carb Counter ----
MiniGames['Carb Counter'] = {
  intro: { emoji: '🥪', how: [
    'You\'ll see a plate of food with portion sizes.',
    'Add up the carbs and type your total. Use the reference chart if you like.',
    'There\'s no timer. Diabetes Canada suggests trying to be within about 5 g.'] },
  play: function(opts, onComplete) {
    const tier = opts.tier || 1;
    // Health Canada, Nutrient Value of Some Common Foods (2008). See design/fact-sources.md.
    const pool = [
      { emoji: '🍎', name: 'Apple', portion: '1 medium', carbs: 19 },
      { emoji: '🍌', name: 'Banana', portion: '1 medium', carbs: 27 },
      { emoji: '🍊', name: 'Orange', portion: '1', carbs: 15 },
      { emoji: '🍐', name: 'Pear', portion: '1', carbs: 26 },
      { emoji: '🍇', name: 'Grapes', portion: '20 grapes', carbs: 18 },
      { emoji: '🍓', name: 'Strawberries', portion: '7', carbs: 6 },
      { emoji: '🫐', name: 'Blueberries', portion: '½ cup', carbs: 11 },
      { emoji: '🥛', name: 'Milk', portion: '1 cup (250 mL)', carbs: 12 },
      { emoji: '🥣', name: 'Plain yogurt', portion: '¾ cup', carbs: 13 },
      { emoji: '🧀', name: 'Cheddar', portion: '50 g', carbs: 1 },
      { emoji: '🥚', name: 'Egg', portion: '1 large', carbs: 1 },
      { emoji: '🍞', name: 'White bread', portion: '1 slice', carbs: 18 },
      { emoji: '🍞', name: 'Whole wheat bread', portion: '1 slice', carbs: 16 },
      { emoji: '🥯', name: 'Bagel', portion: '1 plain', carbs: 38 },
      { emoji: '🍚', name: 'White rice', portion: '½ cup cooked', carbs: 24 },
      { emoji: '🍝', name: 'Spaghetti', portion: '1 cup cooked', carbs: 42 },
      { emoji: '🥔', name: 'Baked potato', portion: '1', carbs: 37 },
      { emoji: '🌽', name: 'Corn', portion: '½ cup', carbs: 19 },
      { emoji: '🫛', name: 'Peas', portion: '½ cup', carbs: 12 },
      { emoji: '🥕', name: 'Carrots', portion: '½ cup cooked', carbs: 6 },
      { emoji: '🥦', name: 'Broccoli', portion: '½ cup cooked', carbs: 6 },
      { emoji: '🫘', name: 'Black beans', portion: '¾ cup', carbs: 29 },
      { emoji: '🥣', name: 'Oatmeal', portion: '¾ cup cooked', carbs: 17 },
      { emoji: '🍿', name: 'Popcorn (air-popped)', portion: '1 cup', carbs: 7 },
      { emoji: '🍪', name: 'Chocolate chip cookies', portion: '2', carbs: 13 },
      { emoji: '🌮', name: 'Corn tortilla', portion: '1', carbs: 8 },
      { emoji: '🧇', name: 'Waffle', portion: '1', carbs: 14 }
    ];
    const n = tier === 1 ? 3 : tier === 2 ? 4 : 5;
    const foods = shuffle(pool).slice(0, n);
    const total = foods.reduce((sum, f) => sum + f.carbs, 0);
    renderMGPanel(
      '<h2>🥪 Carb Counter</h2>' +
      '<p class="mg-subtitle">Add up the total carbs on your plate.</p>' +
      '<div class="plate">' + foods.map(f => '<span title="' + f.name + '">' + f.emoji + '</span>').join('') + '</div>' +
      foods.map(f => '<div class="mg-food-row"><div><span class="mg-food-emoji">' + f.emoji + '</span><span class="mg-food-name">' + f.name + '</span></div><span class="mg-food-portion">' + f.portion + '</span></div>').join('') +
      '<details class="mg-legend"><summary><strong>📖 Carb reference</strong> (tap to open)</summary><div class="mg-legend-grid">' +
        '<div><strong>🍎 Fruit</strong><br>Apple 19 g<br>Orange 15 g<br>Banana 27 g<br>½ cup blueberries 11 g</div>' +
        '<div><strong>🍞 Grains</strong><br>1 slice bread 16-18 g<br>½ cup rice 24 g<br>1 cup spaghetti 42 g<br>1 bagel 38 g</div>' +
        '<div><strong>🥛 Milk</strong><br>1 cup milk 12 g<br>¾ cup plain yogurt 13 g<br>Cheese about 1 g</div>' +
        '<div><strong>🥦 Veggies &amp; protein</strong><br>½ cup carrots or broccoli 6 g<br>Meat, eggs: little carbohydrate<br>¾ cup beans 29 g</div>' +
      '</div><p class="src-note">Source: Health Canada, Nutrient Value of Some Common Foods.</p></details>' +
      '<div class="mg-estimate-row"><label for="mg-carb-input">Total carbs:</label><input type="number" id="mg-carb-input" inputmode="numeric" pattern="[0-9]*" placeholder="0" min="0" max="300"><span>g</span><button class="mg-action-btn" id="mg-submit">Check</button></div>' +
      '<div id="mg-result"></div>');
    setTimeout(() => {
      const input = document.getElementById('mg-carb-input');
      const submit = () => {
        const guess = parseInt(input.value, 10);
        if (isNaN(guess)) { input.focus(); return; }
        const diff = Math.abs(guess - total);
        const head = diff <= 5 ? 'Spot on!' : diff <= 15 ? 'Close! That\'s a good estimate.' : 'Good try! Here\'s how it adds up.';
        const msg = '<p><strong>' + head + '</strong> You said ' + guess + 'g. The plate has about <strong>' + total + 'g</strong>.</p>' +
          '<p><small>' + foods.map(f => f.emoji + ' ' + f.carbs + 'g').join(' + ') + '</small></p>';
        mgFinish(msg, () => onComplete({ stars: starsFromDiff(diff, [5, 15, 30]), summary: head }), diff <= 15 ? '🎯' : '👍');
      };
      document.getElementById('mg-submit').addEventListener('click', submit);
      input.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
    }, 30);
  }
};

// ---- Mealtime Routine ----
// Teaches the steps around mealtime insulin. Never asks for or shows a dose.
MiniGames['Mealtime Routine'] = {
  intro: { emoji: '🍽️', how: [
    'A few questions about what you do at mealtime.',
    'Pick an answer. If it\'s not the best one, Pip explains why and you can pick again.',
    'Your own plan comes from your diabetes team. Facts here come from Diabetes Canada.'] },
  play: function(opts, onComplete) {
    const tier = opts.tier || 1;
    const pump = state.player.device.insulin === 'pump';
    const steps = tier <= 2 ? [
      { art: '🍽️ 🤔', situation: 'Lunch is in front of you: a sandwich, an apple and milk.', q: 'Which of these has carbohydrate?',
        choices: [
          { text: '🥪🍎🥛 The bread, the apple and the milk', correct: true, feedback: 'Yes. Diabetes Canada lists grains, fruits and milk as foods with carbohydrate.' },
          { text: '🥪 Only the bread', correct: false, feedback: 'Bread has carbs, but so do fruit and milk.' },
          { text: '🍗 Only the turkey', correct: false, feedback: 'Meat has little carbohydrate. The bread, apple and milk are where the carbs are.' }
        ] },
      { art: '🥪 🍎 🥛 ➜ 🔢', situation: 'You want to count the carbs.', q: 'Where can you find the carbs for packaged food?',
        choices: [
          { text: '🏷️ The Nutrition Facts table', correct: true, feedback: 'Right. Check the serving size first, then find Carbohydrate.' },
          { text: '🎨 The picture on the box', correct: false, feedback: 'The picture doesn\'t tell you much. The Nutrition Facts table does.' },
          { text: '🤷 Just guess', correct: false, feedback: 'When there\'s a label, use it. It has the numbers you need.' }
        ] },
      { art: pump ? '🔢 ➜ 🎛️' : '🔢 ➜ 🖊️', situation: 'You know the carbs.', q: 'How do you figure out your mealtime insulin?',
        choices: [
          { text: '📋 Use the plan from my diabetes team', correct: true, feedback: 'Exactly. Your diabetes team makes your plan. ' + (pump ? 'Your pump uses that plan when you enter the carbs.' : 'Your plan tells you what to take with your pen.') },
          { text: '🌐 Look it up online', correct: false, feedback: 'Your plan comes from your own diabetes team.' },
          { text: '🙋 Ask a friend what they take', correct: false, feedback: 'Your friend\'s plan was made for them. Yours comes from your team.' }
        ] },
      { art: '📈 ⏱️', situation: 'Diabetes Canada has targets for kids and teens.', q: 'What is the target range two hours after a meal?',
        choices: [
          { text: '🟩 5.0 to 10.0', correct: true, feedback: 'Yes. Before meals the target is 4.0 to 8.0. That\'s where this game\'s green zone comes from.' },
          { text: '🟥 Under 4.0', correct: false, feedback: 'Under 4.0 is a low. The after-meal target is 5.0 to 10.0.' },
          { text: '🟨 Over 14', correct: false, feedback: 'That\'s high. The after-meal target is 5.0 to 10.0.' }
        ] }
    ] : [
      { art: '🎂 🍕 🤷', situation: 'Birthday party. No labels anywhere.', q: 'How can you estimate the carbs?',
        choices: [
          { text: '✊ Use the Handy Portion Guide and foods I know', correct: true, feedback: 'Yes. A fist-sized amount of grains or fruit, and what you know about common foods.' },
          { text: '🙅 Skip eating', correct: false, feedback: 'You can enjoy the party. Estimating is a skill you can use anywhere.' },
          { text: '🎲 Pick a random number', correct: false, feedback: 'Use what you know instead, like the Handy Portion Guide.' }
        ] },
      { art: '⏱️ 💉', situation: 'Diabetes Canada describes rapid-acting mealtime insulin.', q: 'When is it usually taken?',
        choices: [
          { text: '⏱️ 0 to 15 minutes before the meal (your team decides your timing)', correct: true, feedback: 'Yes. Your diabetes team tells you what timing is right for you.' },
          { text: '🌙 Only at bedtime', correct: false, feedback: 'Mealtime insulin is for meals. Your team decides the timing.' },
          { text: '❌ Never with meals', correct: false, feedback: 'It\'s called mealtime insulin because it goes with meals.' }
        ] },
      { art: '🤒 📈', situation: 'You\'re sick and your BG before meals stays above 14.', q: 'What does Diabetes Canada recommend checking?',
        choices: [
          { text: '🧪 Ketones', correct: true, feedback: 'Right. Check ketones when you\'re sick with high blood sugar, or when BG before meals stays above 14.0.' },
          { text: '🌡️ Only your temperature', correct: false, feedback: 'Temperature matters, but ketones are the key check.' },
          { text: '🙈 Nothing', correct: false, feedback: 'Sick plus high BG means checking ketones.' }
        ] },
      { art: '🍽️ 🔢', situation: 'Diabetes Canada gives a general guide for carbs.', q: 'About how many grams do most people aim for at a meal?',
        choices: [
          { text: '🍽️ 45 to 60 g (your dietitian sets your own goal)', correct: true, feedback: 'Yes. And 15 to 30 g at snacks. Your dietitian helps set your own goal.' },
          { text: '0 g', correct: false, feedback: 'Carbs are part of healthy eating. Most people aim for 45 to 60 g at meals.' },
          { text: '200 g', correct: false, feedback: 'That\'s much more than the general guide of 45 to 60 g.' }
        ] }
    ];
    runSteps('🍽️ Mealtime Routine', 'Pick an answer. You can change it any time.', steps,
      '<p><strong>Nice work!</strong> Know where the carbs are, count them, and follow your team\'s plan.</p>',
      onComplete);
  }
};

// ---- Treat-the-Low ----
// Glucose tabs are always an option. Wrong picks explain why; pick again.
MiniGames['Treat-the-Low'] = {
  intro: { emoji: '🍬', how: [
    'Your BG is under 4. Pick something with fast sugar.',
    'If you pick something that isn\'t fast, Pip will tell you why and you can pick again.'] },
  play: function(opts, onComplete) {
    const bg = state.bg.current;
    // Fast sugars: Diabetes Canada CPG ch. 14, Table 4. Amounts are not shown: for kids they
    // depend on age (CPG ch. 34, Table 2), so the game says the diabetes team decides.
    const tabs = { emoji: '🍬', name: 'Glucose tablets', good: true, why: 'Diabetes Canada says glucose tablets are one of the best choices for a low.' };
    const otherGood = [
      { emoji: '🥄', name: 'Sugar dissolved in water', good: true, why: 'Table sugar dissolved in water is on Diabetes Canada\'s list of fast sugars.' },
      { emoji: '🧊', name: 'Sugar cubes', good: true, why: 'Sugar cubes are on Diabetes Canada\'s list of fast sugars.' },
      { emoji: '🍯', name: 'Honey', good: true, why: 'Honey is on Diabetes Canada\'s list of fast sugars.' },
      { emoji: '🧃', name: 'Juice box', good: true, why: 'Juice is on Diabetes Canada\'s list of fast sugars. Glucose tablets are an even better choice.' }
    ];
    if (Math.random() < 0.15) otherGood.push({ emoji: '🥤', name: 'Regular pop (not diet)', good: true, why: 'Regular soft drinks are on Diabetes Canada\'s list of fast sugars. Canada\'s Food Guide calls them sugary drinks, so they\'re not an everyday drink.' });
    const notIdeal = [
      { emoji: '🍫', name: 'Chocolate bar', good: false, why: 'Chocolate isn\'t on Diabetes Canada\'s list of fast sugars for lows.' },
      { emoji: '🥜', name: 'Handful of nuts', good: false, why: 'Nuts have very little carbohydrate, so they won\'t fix a low.' },
      { emoji: '🧀', name: 'Cheese stick', good: false, why: 'Cheese has almost no carbohydrate.' },
      { emoji: '🍎', name: 'Whole apple', good: false, why: 'An apple isn\'t on the list of fast sugars for lows. Save it for the snack afterwards.' },
      { emoji: '🍨', name: 'Ice cream', good: false, why: 'Ice cream isn\'t on the list of fast sugars for lows.' },
      { emoji: '🥤', name: 'Diet pop', good: false, why: 'Diet pop has no sugar, so it can\'t raise BG.' },
      { emoji: '💧', name: 'Water', good: false, why: 'Water has no sugar. Fast sugar first.' },
      { emoji: '🥛', name: 'Glass of milk', good: false, why: 'Diabetes Canada says milk raises blood sugar more slowly. Better for the snack afterwards.' }
    ];
    const options = shuffle([tabs, pick(otherGood)].concat(shuffle(notIdeal).slice(0, 2)));
    renderMGPanel(
      '<h2>⚠️ Treat the Low</h2>' +
      '<p class="mg-subtitle">BG: <strong class="bg-big red">' + bg.toFixed(1) + '</strong>. Pick something with fast sugar.</p>' +
      '<p class="src-note">How much fast sugar is right for you depends on your age. Your diabetes team will tell you.</p>' +
      '<div class="mg-options-grid">' + options.map((o, i) =>
        '<div class="mg-option-card" data-idx="' + i + '"><span class="mg-opt-emoji">' + o.emoji + '</span><span class="mg-opt-name">' + o.name + '</span>' +
        (o.note ? '<span class="mg-opt-carbs">' + o.note + '</span>' : '') + '</div>').join('') + '</div>' +
      '<div id="mg-low-fb" class="quiz-feedback"></div><div id="mg-result"></div>');
    let tried = false;
    setTimeout(() => {
      document.querySelectorAll('.mg-option-card').forEach(card => {
        card.addEventListener('click', () => {
          const o = options[parseInt(card.dataset.idx, 10)];
          document.querySelectorAll('.mg-option-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          const fb = document.getElementById('mg-low-fb');
          if (!o.good) {
            tried = true;
            card.classList.add('dim');
            fb.className = 'quiz-feedback try';
            fb.innerHTML = '🤔 ' + o.why + ' <em>Pick something with fast sugar.</em>';
            return;
          }
          fb.className = 'quiz-feedback right';
          fb.innerHTML = '✅ ' + o.why;
          document.querySelectorAll('.mg-option-card').forEach(c => c.style.pointerEvents = 'none');
          state.narrative.lastLowTreat = 15;
          mgFinish('<p>You have the ' + o.name.toLowerCase() + '. Now wait 15 minutes and check again.</p>',
            () => onComplete({ stars: tried ? 2 : 3, summary: o.name, noTick: true }), o.emoji);
        });
      });
    }, 30);
  }
};

// ---- Label Reader ----
// Canadian Nutrition Facts label. No timer. Wrong answers get a hint and another try.
MiniGames['Label Reader'] = {
  intro: { emoji: '🏷️', how: [
    'You\'ll see the carbohydrate part of a Nutrition Facts table.',
    'Answer a few questions by reading the label.',
    'If an answer isn\'t right, you get a hint and can try again. No rush.'] },
  play: function(opts, onComplete) {
    const tier = opts.tier || 1;
    // Health Canada, Nutrient Value of Some Common Foods (2008), rounded to whole grams like a label.
    const labels = [
      { product: '🍞 Whole wheat bread', servingSize: '1 slice (35 g)', carbs: 16, fibre: 2 },
      { product: '🥣 Cheerios cereal', servingSize: '250 mL (24 g)', carbs: 18, fibre: 2 },
      { product: '🥣 Oatmeal, cooked', servingSize: '175 mL (173 g)', carbs: 17, fibre: 3 },
      { product: '🍝 Spaghetti, cooked', servingSize: '250 mL (148 g)', carbs: 42, fibre: 3 },
      { product: '🥣 Granola with raisins', servingSize: '125 mL (59 g)', carbs: 46, fibre: 4 },
      { product: '🫘 Black beans, canned', servingSize: '175 mL (178 g)', carbs: 29, fibre: 12 },
      { product: '🍘 Whole wheat crackers', servingSize: '4 crackers (16 g)', carbs: 11, fibre: 2 },
      { product: '🫘 Chickpeas, canned', servingSize: '175 mL (178 g)', carbs: 40, fibre: 8 },
      { product: '🧁 English muffin', servingSize: '1 muffin (52 g)', carbs: 26, fibre: 2 },
      { product: '🫘 Hummus', servingSize: '60 mL (57 g)', carbs: 8, fibre: 3 }
    ];
    const L = pick(labels);
    const qs = [
      { q: 'How many grams of carbohydrate are in one serving?', answer: L.carbs, unit: 'g', hint: 'Find the line that says <strong>Carbohydrate / Glucides</strong>.', explain: 'That number is for one serving, the amount shown at the top.' },
      { q: 'If you ate TWO servings, how many grams of carbohydrate is that?', answer: L.carbs * 2, unit: 'g', hint: 'Take the carbs for one serving and add it twice.', explain: 'Diabetes Canada says to check the serving size, because the numbers are only for that amount.' }
    ];
    if (tier >= 2) qs.push({ q: 'How many grams of fibre are in one serving?', answer: L.fibre, unit: 'g', hint: 'Fibre is listed just under Carbohydrate.', explain: 'Fibre is part of the carbohydrate number.' });
    if (tier >= 2) qs.push({ q: 'Diabetes Canada says to subtract fibre from carbohydrate. What do you get for one serving?', answer: L.carbs - L.fibre, unit: 'g', hint: 'Carbohydrate minus fibre: ' + L.carbs + ' − ' + L.fibre + '.', explain: 'Fibre does not raise blood sugar, so Diabetes Canada says to subtract it.' });
    if (tier >= 3) qs.push({ q: 'How many grams of carbohydrate are in THREE servings?', answer: L.carbs * 3, unit: 'g', hint: L.carbs + ' × 3.', explain: 'Bigger portions add up fast.' });

    let qi = 0, firstTry = 0;
    const labelHtml = '<div class="nf-label">' +
      '<div class="nf-title">Nutrition Facts</div><div class="nf-sub">Valeur nutritive</div>' +
      '<div class="nf-line nf-thick">Per ' + L.servingSize + '</div>' +
      '<div class="nf-line nf-row"><strong>Carbohydrate / Glucides</strong><span>' + L.carbs + ' g</span></div>' +
      '<div class="nf-line nf-row nf-indent">Fibre / Fibres<span>' + L.fibre + ' g</span></div></div>' +
      '<p class="src-note">Values: Health Canada, Nutrient Value of Some Common Foods. A real label also lists calories, fat, sugars and more.</p>';

    renderMGPanel('<h2>🏷️ Label Reader</h2><p class="mg-subtitle">' + L.product + '</p>' + labelHtml + '<div id="mg-question"></div><div id="mg-result"></div>');

    function showQ() {
      const qd = qs[qi];
      let misses = 0;
      const box = document.getElementById('mg-question');
      box.innerHTML = '<p class="step-q"><strong>' + (qi + 1) + ' of ' + qs.length + ':</strong> ' + qd.q + '</p>' +
        '<div class="mg-estimate-row"><input type="number" id="mg-label-input" inputmode="numeric" pattern="[0-9]*" placeholder="0" min="0" max="9999"><span>' + qd.unit + '</span><button class="mg-action-btn" id="mg-label-submit">Answer</button></div>' +
        '<div id="mg-q-feedback"></div>';
      const input = document.getElementById('mg-label-input');
      const next = () => { qi++; if (qi < qs.length) showQ(); else { box.innerHTML = ''; mgFinish('<p><strong>Label master!</strong> Serving size first, then carbohydrate, then fibre.</p>', () => onComplete({ stars: firstTry === qs.length ? 3 : 2, summary: 'Label read' }), '🏷️'); } };
      const submit = () => {
        const val = parseInt(input.value, 10);
        if (isNaN(val)) { input.focus(); return; }
        const fb = document.getElementById('mg-q-feedback');
        if (val === qd.answer) {
          if (misses === 0) firstTry++;
          fb.innerHTML = '<p class="quiz-feedback right">✅ Yes, ' + qd.answer + qd.unit + '. ' + qd.explain + '</p><button class="mg-action-btn" id="mg-next-q">Next ▶</button>';
          document.getElementById('mg-label-submit').disabled = true;
          document.getElementById('mg-next-q').addEventListener('click', next);
        } else {
          misses++;
          if (misses < 3) {
            fb.innerHTML = '<p class="quiz-feedback try">🤔 Not quite. ' + qd.hint + ' Try again.</p>';
            input.select();
          } else {
            fb.innerHTML = '<p class="quiz-feedback try">💡 It\'s <strong>' + qd.answer + qd.unit + '</strong>. ' + qd.hint + ' ' + qd.explain + '</p><button class="mg-action-btn" id="mg-next-q">Got it ▶</button>';
            document.getElementById('mg-label-submit').disabled = true;
            document.getElementById('mg-next-q').addEventListener('click', next);
          }
        }
      };
      document.getElementById('mg-label-submit').addEventListener('click', submit);
      input.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
      // On touch screens, don't pop the keyboard over the label before the player has read it.
      if (window.matchMedia('(hover: hover)').matches) input.focus();
    }
    setTimeout(showQ, 30);
  }
};

// ---- Exercise Balance ----
// BG falls while you move. One snack at a time, and it takes a few minutes to work.
// A dip under 4 pauses for a treatment instead of ending the game.
MiniGames['Exercise Balance'] = {
  intro: { emoji: '⚽', how: [
    'You\'re being active, and moving uses up sugar, so your BG slowly drops.',
    'Tap <strong>🍌 Snack</strong> when BG gets close to the bottom of the green zone (5).',
    'A snack takes a few minutes to work, so you can only have one at a time.',
    'Goal: finish with your BG in the green zone, not too low and not too high.'] },
  play: function(opts, onComplete) {
    const tier = opts.tier || 1;
    let bg = state.bg.current;
    const TOTAL = 60, MS = 400, RISE = 1.5, DIGEST = 10;
    const phases = [
      { until: 10, name: 'Warm-up', emoji: '🤸', rate: 0.04 },
      { until: 45, name: 'Main activity', emoji: opts.activity || '⚽', rate: 0.09 + tier * 0.015 },
      { until: 60, name: 'Cool-down', emoji: '🧘', rate: 0.03 }
    ];
    let minute = 0, digest = 0, snacks = 0, green = 0, timeouts = 0, paused = false, done = false;
    let note = '';
    if (bg < 5.5) { digest = DIGEST; snacks = 1; note = 'Your BG was a bit low to start, so you had a snack first.'; }
    const pct = v => Math.max(0, Math.min(100, ((v - 2) / 14) * 100));
    renderMGPanel(
      '<h2>' + (opts.activity || '⚽') + ' Exercise Balance</h2>' +
      '<p class="mg-subtitle" id="mg-ex-phase">Get ready...</p>' +
      '<div class="ex-track"><div class="ex-runner" id="mg-runner">🏃</div><div class="ex-flag">🏁</div></div>' +
      '<div class="ex-meter"><div class="ex-green" style="left:' + pct(5) + '%;width:' + (pct(10) - pct(5)) + '%"></div>' +
        '<div class="ex-marker" id="mg-ex-marker"></div><span class="ex-lbl" style="left:' + pct(5) + '%">5</span><span class="ex-lbl" style="left:' + pct(10) + '%">10</span></div>' +
      '<div class="ex-bg">BG <strong id="mg-ex-bg">' + bg.toFixed(1) + '</strong></div>' +
      '<div style="text-align:center;margin:12px 0;"><button class="mg-action-btn big" id="mg-ex-snack">🍌 Snack</button></div>' +
      '<p class="ex-status" id="mg-ex-status">' + (note || '&nbsp;') + '</p>' +
      '<div id="mg-result"></div>');
    setTimeout(() => {
      const bgEl = document.getElementById('mg-ex-bg'), marker = document.getElementById('mg-ex-marker');
      const runner = document.getElementById('mg-runner'), phaseEl = document.getElementById('mg-ex-phase');
      const statusEl = document.getElementById('mg-ex-status'), snackBtn = document.getElementById('mg-ex-snack');
      const draw = () => {
        bgEl.textContent = bg.toFixed(1);
        bgEl.style.color = bg < 4 ? 'var(--zone-red)' : (bg < 5 || bg > 10) ? '#d39e00' : 'var(--zone-green)';
        marker.style.left = pct(bg) + '%';
        runner.style.left = (minute / TOTAL * 88) + '%';
        snackBtn.disabled = digest > 0 || paused || done;
        snackBtn.textContent = digest > 0 ? '😋 Digesting...' : '🍌 Snack';
      };
      snackBtn.addEventListener('click', () => {
        if (digest > 0 || paused || done) return;
        digest = DIGEST; snacks++;
        statusEl.textContent = 'Snack eaten. It takes a few minutes to kick in.';
        draw();
      });
      draw();
      const loop = setInterval(() => {
        if (done || paused) return;
        if (!document.getElementById('mg-ex-bg')) { clearInterval(loop); return; }
        const ph = phases.find(p => minute < p.until) || phases[2];
        phaseEl.textContent = ph.emoji + ' ' + ph.name + ' · minute ' + minute + ' of ' + TOTAL;
        runner.textContent = ph.emoji === '🧘' ? '🚶' : '🏃';
        let drop = ph.rate + Math.random() * 0.02;
        if (ph.name === 'Main activity' && Math.random() < 0.12) { drop += 0.3; statusEl.textContent = pick(['💨 Sprint!', '💨 Big run down the field!', '💨 Racing for the ball!']); }
        bg -= drop;
        if (digest > 0) { bg += RISE / DIGEST; digest--; if (digest === 0) statusEl.innerHTML = '&nbsp;'; }
        if (inRange(bg)) green++;
        minute++;
        if (bg < 4) {
          paused = true; timeouts++;
          statusEl.innerHTML = '⏸️ <strong>Time out!</strong> BG is under 4. You stop, have glucose tabs and sit out for a bit.';
          runner.textContent = '🪑';
          let k = 0;
          const rec = setInterval(() => {
            bg += 0.25; k++; draw();
            if (k >= 8) { clearInterval(rec); paused = false; statusEl.textContent = 'Feeling better. Back in the game!'; }
          }, 350);
        }
        if (minute >= TOTAL) finish();
        draw();
      }, MS);
      function finish() {
        done = true; clearInterval(loop);
        runner.textContent = '🎉';
        bg = Math.round(bg * 10) / 10;
        let msg;
        if (bg > 10) msg = '<p><strong>You stayed safe the whole time!</strong> You finished a bit high (' + bg.toFixed(1) + '). Next time, try waiting a little longer between snacks.</p>';
        else if (bg < 5) msg = '<p><strong>You made it!</strong> You finished a bit low (' + bg.toFixed(1) + '). A snack a little earlier would help, and have something when you\'re done.</p>';
        else msg = '<p><strong>Great balance!</strong> You finished in the green zone at ' + bg.toFixed(1) + '.</p>';
        msg += '<p><small>Snacks: ' + snacks + ' · Time in the green zone: ' + Math.round(green / TOTAL * 100) + '%</small></p>';
        if (timeouts) msg += '<p><small>You also stopped to treat a low. That\'s exactly the right move.</small></p>';
        msg += '<p><small>💡 Diabetes Canada says long exercise can lower blood sugar for up to 48 hours afterwards.</small></p>';
        mgFinish(msg, () => {
          state.bg.current = bg;
          state.bg.trend = 'stable';
          notify();
          onComplete({ stars: inRange(bg) ? (green / TOTAL >= 0.7 ? 3 : 2) : 1, summary: 'Exercise done', hours: 1.0 });
        }, inRange(bg) ? '🏅' : '👍');
      }
    }, 50);
  }
};

// ---- Pack Your Bag ----
MiniGames['Pack Your Bag'] = {
  intro: { emoji: '🎒', how: [
    'Tap the things you want to pack. Tap again to take something out.',
    'When you\'re ready, tap Done. If something important is missing, Pip will give you a hint.'] },
  play: function(opts, onComplete) {
    const tier = opts.tier || 1;
    const isPump = state.player.device.insulin === 'pump', isCGM = state.player.device.bgMonitor === 'cgm';
    const items = [
      { emoji: isPump ? '🎛️' : '🖊️', name: isPump ? 'Pump supplies' : 'Insulin pen + needles', essential: true, hint: 'How will you take your mealtime insulin?' },
      { emoji: '🩸', name: isCGM ? 'Phone or receiver for your CGM' : 'Meter + test strips', essential: true, hint: 'How will you check your BG?' },
      { emoji: '🍬', name: 'Glucose tabs', essential: true, hint: 'What will you use if you go low?' },
      { emoji: '🥪', name: 'Snacks', essential: true, hint: 'You might get hungry, or need a snack after a low.' },
      { emoji: '💧', name: 'Water bottle', essential: true, hint: 'Canada\'s Food Guide says water is the drink of choice.' },
      { emoji: '🪪', name: 'Medical ID', essential: true, hint: 'Something that tells people you have T1D if you can\'t.' },
      { emoji: '🧃', name: 'Juice box', essential: false },
      { emoji: '🔋', name: 'Charger / spare batteries', essential: false },
      { emoji: '📋', name: 'Emergency contact card', essential: false },
      { emoji: isPump ? '🩹' : '🖊️', name: isPump ? 'Spare infusion set' : 'Spare pen needles', essential: false },
      { emoji: '❄️', name: 'Insulin cool pack', essential: false }
    ];
    if (tier >= 2) items.push({ emoji: '📝', name: 'Letter from your diabetes team', essential: false });
    const fun = shuffle([
      { emoji: '🎮', name: 'Video game' }, { emoji: '🧸', name: 'Stuffed animal' }, { emoji: '🕶️', name: 'Sunglasses' },
      { emoji: '📚', name: 'Comic book' }, { emoji: '⚽', name: 'Soccer ball' }, { emoji: '🎨', name: 'Sketchbook' }
    ]).slice(0, 2).map(f => Object.assign(f, { essential: false, fun: true }));
    const all = shuffle(items.concat(fun));
    const packed = {};
    renderMGPanel('<h2>🎒 Pack Your Bag</h2><p class="mg-subtitle">Pack for ' + (tier <= 1 ? 'a day at school' : tier <= 2 ? 'a day out' : 'a trip') + '.</p>' +
      '<div class="mg-options-grid" id="mg-pack-items">' + all.map((it, i) =>
        '<div class="mg-option-card" data-idx="' + i + '"><span class="mg-opt-emoji">' + it.emoji + '</span><span class="mg-opt-name">' + it.name + '</span></div>').join('') + '</div>' +
      '<div class="bag-line">🎒 <span id="mg-pack-bag"></span></div>' +
      '<div style="text-align:center;margin:12px 0;"><button class="mg-action-btn" id="mg-pack-done">✅ Done packing</button></div>' +
      '<div id="mg-pack-fb"></div><div id="mg-result"></div>');
    setTimeout(() => {
      const bagEl = document.getElementById('mg-pack-bag');
      const drawBag = () => { bagEl.textContent = Object.keys(packed).map(i => all[i].emoji).join(' ') || '(empty)'; };
      drawBag();
      document.querySelectorAll('#mg-pack-items .mg-option-card').forEach(card => {
        card.addEventListener('click', () => {
          const i = card.dataset.idx;
          if (packed[i]) { delete packed[i]; card.classList.remove('packed'); } else { packed[i] = true; card.classList.add('packed'); }
          drawBag();
        });
      });
      let hints = 0;
      document.getElementById('mg-pack-done').addEventListener('click', () => {
        const missing = all.filter((it, i) => it.essential && !packed[i]);
        const fb = document.getElementById('mg-pack-fb');
        if (missing.length) {
          hints++;
          fb.innerHTML = '<p class="quiz-feedback try">🤖 Almost! ' + missing.length + ' important thing' + (missing.length > 1 ? 's are' : ' is') + ' still at home. Hint: ' + missing[0].hint + '</p>';
          return;
        }
        document.getElementById('mg-pack-done').disabled = true;
        fb.innerHTML = '';
        const extras = all.filter((it, i) => !it.essential && !it.fun && packed[i]).length;
        const funPacked = all.filter((it, i) => it.fun && packed[i]);
        let msg = '<p><strong>All the important stuff is packed!</strong></p>';
        if (extras) msg += '<p><small>Nice extras too: backups make surprises easier.</small></p>';
        if (funPacked.length) msg += '<p><small>And you brought the ' + funPacked.map(f => f.name.toLowerCase()).join(' and ') + '. Fun counts too!</small></p>';
        mgFinish(msg, () => onComplete({ stars: hints === 0 ? 3 : 2, summary: 'Packed' }), '🎒');
      });
    }, 50);
  }
};

// ---- Carb Catcher ----
// Foods fall; you move to catch the ones you want. Each food raises BG by its real carb
// amount (Health Canada values; drinks and fruit act faster). Being active pulls BG down.
// Goal: stay in the green zone. Catching everything sends BG too high, so you choose.
MiniGames['Carb Catcher'] = {
  intro: { emoji: '🧺', how: [
    'Foods fall from the top. Slide your basket left and right to catch the ones you want. Drag on the game, or use ◀ ▶ (arrow keys work too).',
    'Each food shows its carbs. Catching it raises your BG by that much, so big-carb foods push it up a lot and low-carb foods hardly at all.',
    'Being active slowly lowers your BG. When BG gets low, grab something with carbs. When it\'s high, let foods fall past.',
    'Goal: stay in the green zone (5 to 10). Missing foods is fine. It lasts about 45 seconds.'] },
  play: function(opts, onComplete) {
    // Carbs: Health Canada, Nutrient Value of Some Common Foods (2008).
    const FOODS = [
      { e: '🧃', n: 'Apple juice ½ cup', c: 15, fast: true }, { e: '🍌', n: 'Banana', c: 27, fast: true },
      { e: '🍊', n: 'Orange', c: 15, fast: true }, { e: '🍇', n: '20 grapes', c: 18, fast: true },
      { e: '🍎', n: 'Apple', c: 19 }, { e: '🍓', n: '7 strawberries', c: 6 },
      { e: '🥛', n: 'Milk, 1 cup', c: 12 }, { e: '🍐', n: 'Pear', c: 26 },
      { e: '🍞', n: 'Slice of bread', c: 18 }, { e: '🍕', n: 'Slice of pizza', c: 25 },
      { e: '🍚', n: 'Rice ½ cup', c: 24 }, { e: '🍪', n: '2 cookies', c: 13 },
      { e: '🍿', n: 'Popcorn, 1 cup', c: 7 }, { e: '🧀', n: 'Cheese', c: 1 },
      { e: '🥚', n: 'Egg', c: 1 }, { e: '🥦', n: 'Broccoli ½ cup', c: 6 }, { e: '🥕', n: 'Carrots ½ cup', c: 6 }
    ];
    const TOTAL = 45, TICK = 50, H = 320;
    const PHASES = [
      { until: 12, label: '🚶 Walking to the park', drift: 0.008 },
      { until: 30, label: '⚽ Playing tag', drift: 0.016 },
      { until: 45, label: '🛝 Playground', drift: 0.012 }
    ];
    let bg = Math.min(9, Math.max(5.5, state.bg.current));
    let t = 0, x = 50, moveDir = 0, dragging = false, inGreen = 0, ticks = 0, done = false, paused = false;
    const falling = [], absorbing = [], eaten = [];
    let spawnIn = 0;
    const pct = v => Math.max(0, Math.min(100, ((v - 2) / 16) * 100));

    renderMGPanel('<h2>🧺 Carb Catcher</h2><p class="mg-subtitle" id="cc-phase">Get ready...</p>' +
      '<div class="cc-wrap"><div class="cc-field" id="cc-field" style="height:' + H + 'px"><div class="cc-basket" id="cc-basket">🧺</div><div class="cc-pop" id="cc-pop"></div></div>' +
      '<div class="cc-meter"><div class="cc-green" style="bottom:' + pct(5) + '%;height:' + (pct(10) - pct(5)) + '%"></div><div class="cc-marker" id="cc-marker"></div></div></div>' +
      '<div class="cc-status">BG <strong id="cc-bg">' + bg.toFixed(1) + '</strong> <span id="cc-note"></span></div>' +
      '<div class="roller-btns"><button class="mg-action-btn big" id="cc-left">◀</button><button class="mg-action-btn big" id="cc-right">▶</button></div>' +
      '<div class="roller-progress"><div id="cc-prog"></div></div><div id="mg-result"></div>');

    setTimeout(() => {
      const field = document.getElementById('cc-field');
      if (!field) return;
      const basket = document.getElementById('cc-basket'), marker = document.getElementById('cc-marker');
      const bgEl = document.getElementById('cc-bg'), noteEl = document.getElementById('cc-note');
      const phaseEl = document.getElementById('cc-phase'), prog = document.getElementById('cc-prog'), pop = document.getElementById('cc-pop');

      const setFromPointer = e => {
        const r = field.getBoundingClientRect();
        x = Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100));
      };
      field.addEventListener('pointerdown', e => { dragging = true; field.setPointerCapture(e.pointerId); setFromPointer(e); });
      field.addEventListener('pointermove', e => { if (dragging) setFromPointer(e); });
      field.addEventListener('pointerup', () => { dragging = false; });
      field.addEventListener('pointercancel', () => { dragging = false; });
      const hold = (id, dir) => {
        const b = document.getElementById(id);
        b.addEventListener('pointerdown', e => { e.preventDefault(); moveDir = dir; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { if (moveDir === dir) moveDir = 0; }));
      };
      hold('cc-left', -1); hold('cc-right', 1);
      const keyDown = e => { if (e.key === 'ArrowLeft') { moveDir = -1; e.preventDefault(); } if (e.key === 'ArrowRight') { moveDir = 1; e.preventDefault(); } };
      const keyUp = e => { if ((e.key === 'ArrowLeft' && moveDir < 0) || (e.key === 'ArrowRight' && moveDir > 0)) moveDir = 0; };
      document.addEventListener('keydown', keyDown);
      document.addEventListener('keyup', keyUp);
      const cleanup = () => { document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); };

      const showPop = (txt) => { pop.textContent = txt; pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show'); };

      const loop = setInterval(() => {
        if (!document.getElementById('cc-field')) { clearInterval(loop); cleanup(); return; }
        if (done || paused) return;
        ticks++;
        t = ticks * TICK / 1000;
        const ph = PHASES.find(p => t < p.until) || PHASES[2];
        phaseEl.textContent = ph.label;
        x = Math.max(6, Math.min(94, x + moveDir * 2.2));
        basket.style.left = x + '%';

        // Being active lowers BG; food that was caught raises it over a second or few.
        bg -= ph.drift;
        for (const a of absorbing) {
          const step = Math.min(a.left, a.rate);
          bg += step; a.left -= step;
        }
        for (let i = absorbing.length - 1; i >= 0; i--) if (absorbing[i].left <= 0.0001) absorbing.splice(i, 1);

        // Spawn foods: a mix, with low-carb foods common enough to matter.
        spawnIn -= TICK;
        if (spawnIn <= 0) {
          spawnIn = 1300 + Math.random() * 700;
          const f = pick(FOODS);
          const el = document.createElement('div');
          el.className = 'cc-food';
          el.innerHTML = '<span>' + f.e + '</span><small>' + f.c + 'g</small>';
          const fx = 8 + Math.random() * 84;
          el.style.left = fx + '%';
          field.appendChild(el);
          falling.push({ f, el, x: fx, y: -10, v: 0.75 + Math.random() * 0.35 });
        }
        for (let i = falling.length - 1; i >= 0; i--) {
          const o = falling[i];
          o.y += o.v;
          o.el.style.top = o.y + '%';
          if (o.y >= 80 && o.y <= 92 && Math.abs(o.x - x) < 10) {
            const rise = o.f.c * 0.1;
            absorbing.push({ left: rise, rate: rise / ((o.f.fast ? 1.2 : 3) * 1000 / TICK) });
            eaten.push(o.f);
            showPop(o.f.e + ' +' + o.f.c + 'g');
            o.el.remove(); falling.splice(i, 1);
          } else if (o.y > 100) { o.el.remove(); falling.splice(i, 1); }
        }

        if (inRange(bg)) inGreen++;
        bgEl.textContent = bg.toFixed(1);
        bgEl.style.color = inRange(bg) ? 'var(--zone-green)' : (bg < 4 || bg > 14) ? 'var(--zone-red)' : '#d39e00';
        marker.style.bottom = pct(bg) + '%';
        noteEl.textContent = bg > 12 ? 'Lots of carbs coming in. Let some foods fall past.' : bg < 5.5 ? 'Getting low. Catch something with carbs!' : '';
        prog.style.width = Math.min(100, t / TOTAL * 100) + '%';

        if (bg < 4) {
          paused = true;
          noteEl.textContent = '⏸️ Under 4: you stop and have glucose tablets.';
          let k = 0;
          const rec = setInterval(() => {
            bg += 0.2; k++; bgEl.textContent = bg.toFixed(1); marker.style.bottom = pct(bg) + '%';
            if (k >= 8) { clearInterval(rec); paused = false; }
          }, 250);
        }
        if (t >= TOTAL) finish();
      }, TICK);

      function finish() {
        done = true; clearInterval(loop); cleanup();
        falling.forEach(o => o.el.remove());
        const p = Math.round(inGreen / ticks * 100);
        const total = eaten.reduce((a, f) => a + f.c, 0);
        const sorted = eaten.slice().sort((a, b) => b.c - a.c);
        const big = sorted[0], small = sorted[sorted.length - 1];
        let msg = '<p><strong>' + (p >= 70 ? 'Great balance!' : p >= 40 ? 'Nice work!' : 'That was a wild ride!') + '</strong> You were in the green zone ' + p + '% of the time.</p>' +
          '<p><small>You caught ' + eaten.length + ' food' + (eaten.length === 1 ? '' : 's') + ' with about ' + total + ' g of carbs.' +
          (big && small && big !== small ? ' Biggest: ' + big.e + ' ' + big.n + ' (' + big.c + ' g). Smallest: ' + small.e + ' ' + small.n + ' (' + small.c + ' g).' : '') + '</small></p>' +
          '<p><small>💡 Foods like cheese, eggs and most vegetables have little carbohydrate (Diabetes Canada). Carb values: Health Canada.</small></p>';
        mgFinish(msg, () => onComplete({ stars: p >= 70 ? 3 : p >= 40 ? 2 : 1, summary: p + '%' }), '🧺');
      }
    }, 50);
  }
};

MiniGames['Portion Estimator'] = {
  intro: { emoji: '👁️', how: [
    'You\'ll see a plate of food. Slide to estimate the total carbs.',
    'Diabetes Canada\'s Handy Portion Guide can help: a fist-sized amount of grains, starches or fruit.',
    'No timer, and close is great.'] },
  play: function(opts, onComplete) {
    // Health Canada values (2008). Meat and most vegetables: "little carbohydrate" (Diabetes Canada).
    const plates = [
      { items: [['🍚', '1½ cups rice', 72], ['🍗', 'Chicken', 0], ['🥦', '½ cup broccoli', 6]], hint: '½ cup of cooked rice has 24 g, so 1½ cups has 72 g.' },
      { items: [['🍝', '1½ cups spaghetti', 63], ['🧀', 'Cheese', 1], ['🥗', 'Salad', 0]], hint: '1 cup of cooked spaghetti has 42 g.' },
      { items: [['🥞', '3 pancakes', 33], ['🍁', '2 tbsp maple syrup', 28], ['🍓', '7 strawberries', 6]], hint: 'Each pancake has about 11 g. Maple syrup has 14 g per tablespoon.' },
      { items: [['🍕', '2 slices of pizza', 50], ['🥛', '1 cup milk', 12]], hint: 'Each slice of cheese pizza has about 25 g.' },
      { items: [['🌮', '3 corn tortillas', 24], ['🫘', '¾ cup refried beans', 29], ['🧀', 'Cheese', 1]], hint: 'Each corn tortilla has about 8 g. Beans have a lot.' },
      { items: [['🥣', '1 cup corn flakes', 23], ['🥛', '1 cup milk', 12], ['🍌', 'Banana', 27]], hint: 'Cereal, milk and fruit all add up.' },
      { items: [['🍔', 'Burger on a bun', 21], ['🍟', '20 to 25 fries', 29], ['💧', 'Water', 0]], hint: 'The bun and fries are where the carbs are.' },
      { items: [['🥪', 'Sandwich (2 slices whole wheat)', 32], ['🍎', 'Apple', 19], ['🥛', '1 cup milk', 12]], hint: 'One slice of whole wheat bread has about 16 g.' },
      { items: [['🍛', 'Chicken curry', 0], ['🍚', '1 cup rice', 48], ['🫓', 'Half a naan', 36]], hint: 'Rice and bread together add up fast.' },
      { items: [['🥟', '6 dumplings', 48], ['🍜', '1 cup rice noodles', 46], ['🥦', '½ cup broccoli', 6]], hint: 'Each dumpling has about 8 g, and noodles have a lot.' }
    ];
    const pl = pick(plates);
    const total = pl.items.reduce((a, it) => a + it[2], 0);
    renderMGPanel('<h2>👁️ Portion Estimator</h2><p class="mg-subtitle">Estimate the total carbs on this plate.</p>' +
      '<div class="plate big">' + pl.items.map(it => '<div class="plate-item"><span>' + it[0] + '</span><small>' + it[1] + '</small></div>').join('') + '</div>' +
      '<p class="hand-ref">Handy Portion Guide: ✊ fist = grains, starches, fruit · 🙌 both hands = veggies · ✋ palm = meat · 👍 thumb tip = fat</p>' +
      '<div class="mg-slider-row"><label for="mg-portion-slider">Estimate:</label><input type="range" id="mg-portion-slider" min="0" max="150" step="5" value="0"><span class="mg-slider-value" id="mg-portion-val">0g</span></div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="mg-action-btn" id="mg-portion-submit">Check</button></div><div id="mg-result"></div>');
    setTimeout(() => {
      const sl = document.getElementById('mg-portion-slider'), val = document.getElementById('mg-portion-val');
      sl.addEventListener('input', () => { val.textContent = sl.value + 'g'; });
      document.getElementById('mg-portion-submit').addEventListener('click', () => {
        const g = parseInt(sl.value, 10), diff = Math.abs(g - total);
        document.getElementById('mg-portion-submit').disabled = true;
        const head = diff <= 10 ? 'Great eye!' : diff <= 25 ? 'Close!' : 'Good try!';
        mgFinish('<p><strong>' + head + '</strong> You said ' + g + 'g. The plate has about <strong>' + total + 'g</strong>.</p>' +
          '<p><small>' + pl.items.map(it => it[0] + ' ' + it[2] + 'g').join(' + ') + '</small></p><p><small>💡 ' + pl.hint + '</small></p>',
          () => onComplete({ stars: starsFromDiff(diff, [10, 25, 40]), summary: head }), diff <= 25 ? '👁️' : '👍');
      });
    }, 50);
  }
};

// ---- Sick Day Protocol ----
// Teaches what to watch and when to get help. Insulin decisions are "your sick day plan".
MiniGames['Sick Day Protocol'] = {
  intro: { emoji: '🤒', how: [
    'You\'re sick. A few questions about what to do.',
    'Pick an answer. If it\'s not the best one, Pip explains and you can pick again.',
    'Your diabetes team gives you a sick day plan. This game is about the big ideas.'] },
  play: function(opts, onComplete) {
    // Diabetes Canada CPG ch. 9, 15, 34 and the Type 1 page (DKA signs).
    const steps = [
      { art: '🤒 🛏️', situation: 'You wake up with a fever and an upset stomach. Your BG is 16.5.', q: 'What\'s a good first step?',
        choices: [
          { text: '🙋 Tell a grown-up and check for ketones', correct: true, feedback: 'Yes. Diabetes Canada says to check ketones when you\'re sick with high blood sugar.' },
          { text: '😴 Go back to sleep and check later', correct: false, feedback: 'When you\'re sick, blood sugar can change in ways that are hard to predict. It needs attention now.' },
          { text: '🙈 Don\'t tell anyone', correct: false, feedback: 'Sick days are a team job. Tell a grown-up.' }
        ] },
      { art: '🧪 ⚠️', situation: 'Ketone check: <strong>moderate</strong>.', q: 'What now?',
        choices: [
          { text: '📋 Follow the sick-day plan from my diabetes team', correct: true, feedback: 'Right. Diabetes Canada says to make a sick-day plan with your diabetes team ahead of time.' },
          { text: '🍕 Eat a big meal', correct: false, feedback: 'Your sick-day plan is the place to start.' },
          { text: '⏰ Ignore it for a few hours', correct: false, feedback: 'Ketones need attention. Follow your sick-day plan now.' }
        ] },
      { art: '⏱️ 🩸', situation: 'You\'re still sick.', q: 'How often should you check your blood sugar?',
        choices: [
          { text: '🩸 More often than usual, like every 2 to 4 hours', correct: true, feedback: 'Yes. That\'s Diabetes Canada\'s sick-day advice.' },
          { text: '📅 Once tomorrow', correct: false, feedback: 'On sick days, check more often than usual: every 2 to 4 hours.' },
          { text: '🤷 Only if you feel worse', correct: false, feedback: 'Check more often than usual, even if you feel okay.' }
        ] },
      { art: '💧 🥤', situation: 'You\'re thirsty.', q: 'What should you drink?',
        choices: [
          { text: '💧 Plenty of water or sugar-free fluids', correct: true, feedback: 'Yes. That\'s straight from Diabetes Canada\'s sick-day advice.' },
          { text: '🥤 Nothing until tomorrow', correct: false, feedback: 'Diabetes Canada says to drink plenty of water or sugar-free fluids.' },
          { text: '☕ Only coffee', correct: false, feedback: 'Water or sugar-free fluids are the best pick.' }
        ] },
      { art: '📞 🏥', situation: 'Knowing when to get help is the most important part.', q: 'Which of these are DKA warning signs that mean get medical help right away?',
        choices: [
          { text: '🚨 Very thirsty, very weak, throwing up, stomach pain, short of breath', correct: true, feedback: 'Exactly. Diabetes Canada says if you think it might be DKA, get medical help immediately.' },
          { text: '🤧 A runny nose', correct: false, feedback: 'That\'s not on the list of DKA warning signs.' },
          { text: '😴 Feeling a bit sleepy', correct: false, feedback: 'The DKA warning signs are being very thirsty, very weak, peeing a lot, throwing up, stomach pain, or shortness of breath.' }
        ] }
    ];
    runSteps('🤒 Sick Day Protocol', 'Pick an answer. You can change it any time.', steps,
      '<p><strong>You know the big ideas!</strong> Tell a grown-up, check BG and ketones more often, follow your sick-day plan, drink water, and know the DKA warning signs.</p>',
      onComplete);
  }
};

// ---- Mini-game launcher ----
function showMiniGameIntro(name, intro, onStart) {
  renderMGPanel('<div class="mg-intro"><div class="mg-intro-emoji">' + intro.emoji + '</div><h2>' + name + '</h2>' +
    '<ul class="mg-how">' + intro.how.map(h => '<li>' + h + '</li>').join('') + '</ul>' +
    '<button class="mg-action-btn big" id="mg-start">▶ Start</button></div>');
  setTimeout(() => document.getElementById('mg-start').addEventListener('click', onStart), 30);
}

function playMiniGame(gameName, opts, nextPassage) {
  const game = MiniGames[gameName];
  if (!game) { renderPassage(nextPassage); return; }
  opts = opts || {};
  state.flags.seenGames = state.flags.seenGames || {};
  const run = () => {
    state.flags.seenGames[gameName] = true;
    game.play(opts, (result) => {
      // AUDIO: Play result jingle
      const bcId = miniGameBetaCells[gameName];
      if (bcId && collectBetaCell(bcId)) setTimeout(() => showBetaCellNotification(betaCellMap[bcId].name, betaCellMap[bcId].cat), 400);
      updateConfidence(result.stars >= 3 ? 5 : result.stars >= 2 ? 4 : 3);
      if (!result.noTick) {
        if (result.hours) advanceTime(result.hours);
        else { tick(0.25); advanceTime(0.25); }
      }
      renderPassage(nextPassage);
    });
  };
  if (game.intro && !opts.skipIntro) showMiniGameIntro(gameName, game.intro, run); else run();
}

function registerMiniGamePassage(day, slot, nextPassage) {
  const schedule = miniGameSchedule[day];
  if (!schedule) return nextPassage;
  const game = slot === 'am' ? schedule.am : schedule.pm;
  const p = 'd' + day + '-game-' + slot;
  const intro = MiniGames[game.name] && MiniGames[game.name].intro;
  addPassage(p, {
    content: (s) => sceneArt(intro ? intro.emoji : '🎮', ['🎮 ✨'], 'day') +
      '<h2>' + game.name + '</h2><p class="passage-scene">' + game.desc + '</p>',
    onEnter: () => { setClock(slot === 'am' ? 10.5 : 15.0); showCompanion(pick(['Want to give it a try?', 'Mini-game time!', 'This one\'s fun.'])); },
    choices: [{
      text: '▶ Play ' + game.name,
      next: function() { playMiniGame(game.name, { tier: getDayTier(day) }, nextPassage); return null; }
    }]
  });
  return p;
}

// ============================================
// 12. SNACKS
// ============================================
// Carb values are estimates (see HANDOFF). Nut snacks never show up on school days,
// since many Canadian schools are nut-free.

const SNACKS = [
  // Health Canada values (2008); meat, cheese and most vegetables have little carbohydrate.
  { emoji: '🍎🧀', name: 'Apple + cheese', carbs: 20, speed: 'slow', tag: 'fruit + protein' },
  { emoji: '🥕🫘', name: 'Carrots + hummus', carbs: 14, speed: 'slow', tag: 'veggies' },
  { emoji: '🥛', name: 'Glass of milk', carbs: 12, speed: 'slow', tag: 'milk' },
  { emoji: '🍌', name: 'Banana', carbs: 27, speed: 'fast', tag: 'fruit' },
  { emoji: '🍊', name: 'Orange', carbs: 15, speed: 'fast', tag: 'fruit' },
  { emoji: '🍇', name: '20 grapes', carbs: 18, speed: 'fast', tag: 'fruit' },
  { emoji: '🥣🍓', name: 'Plain yogurt + strawberries', carbs: 19, speed: 'slow', tag: 'milk + fruit' },
  { emoji: '🍿', name: 'Air-popped popcorn (3 cups)', carbs: 21, speed: 'slow', tag: 'whole grain' },
  { emoji: '🍘🧀', name: '4 whole wheat crackers + cheese', carbs: 12, speed: 'slow', tag: 'whole grain + protein' },
  { emoji: '🥪', name: 'Half a turkey sandwich', carbs: 16, speed: 'slow', tag: 'whole grain + protein' },
  { emoji: '🫛', name: 'Edamame', carbs: 8, speed: 'slow', tag: 'protein' },
  { emoji: '🥚🍘', name: 'Hard-boiled egg + rice cake', carbs: 8, speed: 'slow', tag: 'protein' },
  { emoji: '🍑🥣', name: 'Cottage cheese + canned peaches', carbs: 18, speed: 'slow', tag: 'milk + fruit' },
  { emoji: '🍎', name: 'Unsweetened applesauce', carbs: 15, speed: 'fast', tag: 'fruit' },
  { emoji: '🫐', name: 'Blueberries', carbs: 11, speed: 'fast', tag: 'fruit' },
  { emoji: '🧁', name: 'Fruit muffin', carbs: 23, speed: 'fast', tag: 'treat' },
  { emoji: '🍪🥛', name: 'Two cookies + milk', carbs: 25, speed: 'fast', tag: 'treat' },
  { emoji: '🥜', name: 'Almonds (¼ cup)', carbs: 7, speed: 'slow', tag: 'protein', notAtSchool: true },
  { emoji: '🍎🥜', name: 'Apple + peanut butter', carbs: 25, speed: 'slow', tag: 'fruit + protein', notAtSchool: true }
];

function snackChoices(day, n) {
  const school = !isWeekend(day);
  return shuffle(SNACKS.filter(s => !(school && s.notAtSchool))).slice(0, n);
}

function snackAdvice(bg) {
  if (bg > 10) return 'You\'re running a bit high. A lower-carb snack could be a good pick.';
  if (bg < 5) return 'You\'re on the low side. A snack with some carbs is a good idea.';
  return pick(['Pick whatever sounds good.', 'Snack time!', 'What sounds good?']);
}

function registerSnackPassage(day, slot, nextPassage) {
  const p = 'd' + day + '-snack-' + slot;
  const options = snackChoices(day, 4);
  addPassage(p, {
    content: (s) => sceneArt(options.map(o => o.emoji).join(' '), []) +
      '<h2>' + { morning: 'Morning Snack', afternoon: 'Afternoon Snack', late: 'After-School Snack' }[slot] + '</h2>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "' + snackAdvice(s.bg.current) + '"</p>',
    onEnter: (s) => {
      setClock({ morning: 10.0, afternoon: 14.5, late: 16.5 }[slot]);
      const picks = s.narrative.dayPicks;
      if (picks && picks.dipSlot === slot && !s.narrative.dipDone && s.bg.current < 9) {
        s.narrative.dipDone = true;
        s.carbs.pending = [];
        s.insulin.pendingDoses = [];
        s.bg.current = Math.round((3.5 + Math.random() * 0.4) * 10) / 10;
        s.bg.trend = 'falling';
        s.narrative.lowCause = isWeekend(day)
          ? pick(['You spent the morning biking around the neighbourhood.', 'You were outside playing tag for ages.'])
          : pick(['Gym class was a lot of running today.', 'Recess was one huge game of tag.']);
        notify();
      }
    },
    choices: options.map(sn => ({
      text: sn.emoji + ' ' + sn.name + ' <span class="carb-tag">~' + sn.carbs + 'g · ' + sn.tag + '</span>',
      onSelect: () => { eatSnack(sn.carbs, sn.speed); },
      next: nextPassage
    }))
  });
  return p;
}

// ============================================
// 13. DAY BUILDER
// ============================================
// choosePicks() decides the day's random events; buildDay() registers its passages.
// The picks are saved, so a reloaded game rebuilds the same day and resumes mid-day.

function getDayTier(day) {
  const base = day <= 2 ? 1 : day <= 4 ? 2 : 3;
  return Math.min(3, base + (state.time.week - 1));
}

function choosePicks(day) {
  const tier = getDayTier(day);
  const seen = state.narrative.eventsCompleted;
  const sick = day === 5;
  const meals = [
    pickMeal('breakfast', tier, seen, day),
    pickMeal(sick ? 'sick-lunch' : 'lunch', tier, seen, day),
    pickMeal(sick ? 'sick-dinner' : 'dinner', tier, seen, day)
  ];
  const social = pickFromPool(socialPool, tier, 1, seen, day)[0];
  const emotional = pickFromPool(emotionalPool, tier, 1, seen, day)[0];
  const practical = pickFromPool(practicalPool, tier, 1, seen, day)[0];
  const picks = {
    day,
    meals: meals.map(e => e ? e.id : null),
    social: social ? social.id : null,
    emotional: emotional ? emotional.id : null,
    practical: practical ? practical.id : null,
    dipSlot: (day !== 4 && day !== 5 && Math.random() < 0.35) ? 'afternoon' : null
  };
  [...meals, social, emotional, practical].forEach(e => { if (e) seen.push(e.id); });
  return picks;
}

function buildDay(day, picks) {
  const find = (pool, id) => pool.find(e => e.id === id);
  const meals = picks.meals.map(id => find(mealPool, id));
  const socialEvent = find(socialPool, picks.social);
  const emotionalEvent = find(emotionalPool, picks.emotional);
  const practicalEvent = find(practicalPool, picks.practical);
  const night = (day === 3 || day === 5 || day === 7);
  const dayEnd = 'd' + day + '-end';
  const nightPassage = night ? 'd' + day + '-night' : dayEnd;
  const bedtimeResult = 'd' + day + '-bedtime-check';
  const bedtime = 'd' + day + '-bedtime';

  registerDayEnd(day);
  if (night) registerNightEvent(day, dayEnd);
  registerBedtime(day, bedtimeResult);
  registerBedtimeCheck(day, bedtimeResult, nightPassage);

  let evening;
  if (day === 5) evening = registerEmotionalAnchor_Day5Evening(day, bedtime);
  else if (emotionalEvent) evening = emotionalEvent.register(day, bedtime);
  else if (practicalEvent) evening = practicalEvent.register(day, bedtime);
  else evening = bedtime;

  let dinner;
  if (day === 3) dinner = registerScriptedDinner_Day3(day, evening);
  else if (meals[2]) dinner = meals[2].register(day, evening, 18.0);
  else dinner = evening;

  const lateSnack = registerSnackPassage(day, 'late', dinner);
  const pmGame = registerMiniGamePassage(day, 'pm', lateSnack);
  const pmSnack = registerSnackPassage(day, 'afternoon', pmGame);

  let social;
  if (day === 4) social = registerScriptedExercise_Day4(day, pmSnack);
  else if (socialEvent) social = socialEvent.register(day, pmSnack);
  else if (practicalEvent && emotionalEvent) social = practicalEvent.register(day, pmSnack);
  else social = pmSnack;

  const lunch = meals[1] ? meals[1].register(day, social, 12.0) : social;
  const amGame = registerMiniGamePassage(day, 'am', lunch);
  const amSnack = registerSnackPassage(day, 'morning', amGame);

  let breakfast;
  if (day === 2) breakfast = registerScriptedMorning_Day2(day, amSnack);
  else if (day === 5) breakfast = registerScriptedMorning_Day5(day, amSnack);
  else if (day === 6) breakfast = registerScriptedMorning_Day6(day, amSnack);
  else if (day === 7) breakfast = registerScriptedMorning_Day7(day, amSnack);
  else if (meals[0]) breakfast = meals[0].register(day, amSnack, 7.5);
  else breakfast = amSnack;

  registerWakeup(day, breakfast);
  return 'd' + day + '-wakeup';
}

function startDay(day) {
  resetDayScore();
  state.time.day = day;
  state.narrative.lowsToday = 0;
  state.narrative.dipDone = false;
  state.narrative.lowBGHandled = false;
  state.narrative.rescueInProgress = false;
  const picks = choosePicks(day);
  state.narrative.dayPicks = picks;
  const first = buildDay(day, picks);
  // AUDIO: Play morning ambient track
  renderPassage(first);
}

// ============================================
// 14. WAKEUP / BEDTIME / NIGHT / DAY-END
// ============================================

const dayThemes = {
  1: { headline: 'Monday', art: ['🛏️ ⏰ 🎒'], line: 'New week, new start. You know the basics now.' },
  2: { headline: 'Tuesday: First Day Solo', art: ['🛏️ ☀️ 🎒'], line: 'Morning! Today you make the calls. I\'ll be right here.' },
  3: { headline: 'Wednesday', art: ['🛏️ 🌤️ 📚'], line: 'Day three. The routine is starting to feel like a routine.' },
  4: { headline: 'Thursday: Game Day', art: ['🛏️ ⚽ 👟'], line: 'Soccer practice after school today. We\'ll plan for it.' },
  5: { headline: 'Friday', art: ['🛏️ 🌧️'], line: '', skipBoilerplate: true },
  6: { headline: 'Saturday', art: ['🛏️ 😴 🌞'], line: 'Weekend! Sleeping in and eating later can shift your BG a bit.' },
  7: { headline: 'Sunday: Family Outing', art: ['🛏️ 🚲 🧺'], line: 'Sunday! Bike ride and picnic at the park today.' }
};

function registerWakeup(day, nextPassage) {
  const theme = dayThemes[day] || { headline: dayName(day), art: ['🛏️ ☀️'], line: '' };
  addPassage('d' + day + '-wakeup', {
    content: (s) => sceneArt('🌅', theme.art, 'morning') +
      '<h2>' + theme.headline + '</h2>' +
      (theme.skipBoilerplate ? '<p class="passage-scene">You wake up.</p>'
        : '<p>You check your BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '.</p>'),
    onEnter: (s) => {
      // AUDIO: Play morning ambient track
      s.time.hour = 7.0;
      s.bg.current = Math.round((6 + Math.random() * 3) * 10) / 10;
      s.bg.trend = 'stable';
      s.carbs.pending = [];
      s.insulin.pendingDoses = [];
      s.energy = Math.max(s.energy, 80);
      notify();
      if (theme.line) showCompanion(theme.line, 6000);
    },
    next: nextPassage,
    continueText: 'Start the day'
  });
}

const BEDTIME_SNACKS = [
  { emoji: '🍘🧀', name: 'Crackers with cheese', carbs: 12 },
  { emoji: '🥛', name: 'Glass of milk', carbs: 12 },
  { emoji: '🍞🧀', name: 'Whole wheat toast + cheese', carbs: 17 },
  { emoji: '🥣🍓', name: 'Yogurt with strawberries', carbs: 19 },
  { emoji: '🍎🧀', name: 'Apple and cheese', carbs: 20 },
  { emoji: '🥒', name: 'Cucumber slices', carbs: 1 }
];

function registerBedtime(day, nextId) {
  const options = shuffle(BEDTIME_SNACKS).slice(0, 3);
  addPassage('d' + day + '-bedtime', {
    content: (s) => sceneArt('🌙', ['🛏️ 🧸 ' + options.map(o => o.emoji).join(' ')], 'night') +
      '<h2>Bedtime Snack</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. ' +
      (s.bg.current > 10 ? 'You\'re a bit high, so a light snack might make sense.' : 'Bedtime snack time.') + '</p>',
    onEnter: () => { setClock(21.0); },
    choices: options.map(o => ({
      text: o.emoji + ' ' + o.name + ' <span class="carb-tag">~' + o.carbs + 'g</span>',
      onSelect: () => { eatFood(o.carbs, 'slow'); },
      next: nextId
    }))
  });
}

function registerBedtimeCheck(day, passageId, nextPassage) {
  addPassage(passageId, {
    content: (s) => '<h2>Last Check</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "' + (inRange(s.bg.current) ? 'Looking good for bedtime.' : 'Not perfect, and that\'s okay. Your plan has you covered tonight.') + '"</p>',
    onEnter: () => { tick(0.5); if (collectBetaCell('what-is-basal')) setTimeout(() => showBetaCellNotification(betaCellMap['what-is-basal'].name, 'blue'), 500); },
    next: nextPassage, continueText: '😴 Go to sleep'
  });
}

function registerNightEvent(day, nextPassage) {
  addPassage('d' + day + '-night', {
    content: (s) => {
      const k = s.narrative.nightKind;
      const cgm = s.player.device.bgMonitor === 'cgm';
      if (k === 'low') return sceneArt('🌙', ['🛏️ ' + (cgm ? '📳' : '😟') + ' 🍬'], 'night') + '<h2>Night Alert</h2>' +
        '<p class="passage-scene">2:30 AM. ' + (cgm ? 'Your CGM alarm goes off.' : 'You wake up feeling shaky.') + '</p>' +
        '<p>BG: <strong>3.8</strong>. You take the ' + pick(['glucose tabs from your nightstand', 'juice box you keep by your bed']) + ', wait 15 minutes with a grown-up, and check again: <strong>5.4</strong>. A small snack, then back to sleep.</p>';
      if (k === 'high') return sceneArt('🌙', ['🛏️ 🩸 💧'], 'night') + '<h2>Night Check</h2>' +
        '<p class="passage-scene">3:00 AM.</p><p>BG: <strong>13.6</strong>. You and your grown-up follow your plan for highs, and you drink some water. Back to sleep.</p>';
      return sceneArt('🌙', ['🛏️ 😴 ⭐'], 'night') + '<h2>Peaceful Night</h2><p class="passage-scene">You sleep right through.</p>';
    },
    onEnter: (s) => {
      const r = Math.random();
      s.narrative.nightKind = r < 0.3 ? 'low' : r < 0.55 ? 'high' : 'calm';
      s.bg.current = s.narrative.nightKind === 'high' ? 8.5 : 6.5;
      notify();
    },
    next: nextPassage, continueText: '🌅 Morning comes...'
  });
}

// Small SVG line of today's BG with the green band, so players can see their day.
function bgSparkline(samples) {
  if (!samples || samples.length < 2) return '';
  const W = 300, H = 70, lo = 2, hi = 18;
  const y = v => H - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * H;
  const pts = samples.map((s, i) => (i / (samples.length - 1) * W).toFixed(1) + ',' + y(s.value).toFixed(1)).join(' ');
  return '<svg class="sparkline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<rect x="0" y="' + y(10) + '" width="' + W + '" height="' + (y(5) - y(10)) + '" fill="rgba(76,175,80,0.2)"/>' +
    '<polyline points="' + pts + '" fill="none" stroke="#5b8fb9" stroke-width="2.5"/></svg>' +
    '<p class="spark-cap">Your BG today. The green band is 5 to 10.</p>';
}

function dayTIR(s) {
  const samples = s.score.bgSamples;
  return samples.length ? Math.round(samples.filter(x => inRange(x.value)).length / samples.length * 100) : 80;
}

function registerDayEnd(day) {
  addPassage('d' + day + '-end', {
    noWrap: true,
    content: (s) => {
      const tir = dayTIR(s);
      return '<div class="summary-panel"><h2>' + dayName(day) + ' is done!</h2>' +
        bgSparkline(s.score.bgSamples) +
        '<div class="summary-stat"><span class="label">Time in the green zone</span><span class="value" style="color:var(--zone-green)">' + tir + '%</span></div>' +
        '<div class="summary-stat"><span class="label">Lows handled</span><span class="value">' + (s.narrative.lowsToday || 0) + '</span></div>' +
        '<div class="summary-stat"><span class="label">Beta Cells</span><span class="value" style="color:var(--accent-warm)">' + s.score.collectiblesFound.length + '/' + s.score.totalCollectibles + '</span></div>' +
        '<div class="summary-stat"><span class="label">Confidence</span><span class="value">' + s.confidence + '</span></div></div>' +
        '<div class="passage"><p><strong>' + s.companion.name + ':</strong> "' + pick(['You showed up for every part of today.', 'Another day done. Nice work.', 'Every day teaches you something.']) + '"</p></div>';
    },
    onEnter: (s) => {
      s.score.timeInRange[day - 1] = dayTIR(s);
      if (day === 7) s.flags.weekComplete = true;
      showCompanion(dayName(day) + ' is in the books.', 5000);
    },
    choices: day < 7
      ? [{ text: '🌅 Start ' + dayName(day + 1), next: () => { startDay(day + 1); return null; } }]
      : [{ text: '📊 See your week', next: 'weekly-summary' }]
  });
}

// ============================================
// 15. SCRIPTED ANCHORS
// ============================================

// Wednesday dinner: estimation without Pip's help. Answers can be changed until right.
function registerScriptedDinner_Day3(day, nextPassage) {
  const p = 'd3-anchor-estimation';
  addPassage(p, {
    content: (s) => sceneArt('🥢 🍜 🥦 🍗', ['🏠 🍽️'], 'evening') +
      '<h2>Count It Yourself</h2>' +
      '<p class="passage-scene">Chicken stir-fry with about 1 cup of egg noodles and ½ cup of broccoli. No label.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "This one\'s all you. About how many carbs?"</p>' +
      '<p><small>Hint: 1 cup of spaghetti has 42 g. Egg noodles are about the same.</small></p>',
    onEnter: () => { setClock(18.0); },
    quiz: () => ({
      options: [
        { text: '🍜 About 15g', correct: false, feedback: 'That\'s a bit low. A cup of noodles has a lot more.' },
        { text: '🍜 About 50g', correct: true, feedback: 'Nice estimate! 1 cup of egg noodles is 42 g, plus about 6 g in the broccoli.' },
        { text: '🍜 About 90g', correct: false, feedback: 'That\'s about two plates. One cup of egg noodles is 42 g.' }
      ],
      continueText: '🍽️ Eat dinner',
      onDone: (s) => { eatMeal(48, 'slow'); tick(0.5); advanceTime(0.5); if (collectBetaCell('estimating-carbs')) setTimeout(() => showBetaCellNotification(betaCellMap['estimating-carbs'].name, 'green'), 500); },
      next: nextPassage
    })
  });
  return p;
}

// Friday: a sick morning. The player's job is to notice, tell a grown-up and check ketones.
// Insulin decisions belong to the sick day plan from the diabetes team.
function registerScriptedMorning_Day5(day, nextSnack) {
  const p = 'd5-anchor-sick';
  addPassage(p, {
    content: (s) => sceneArt('🤒', ['🛏️ 🌡️ 🥣'], 'morning') +
      '<h2>Something\'s Not Right</h2>' +
      '<p class="passage-scene">You wake up with a sore tummy and a foggy head.</p>' +
      '<p>You check: <strong class="bg-big red">16.5</strong>. Very high, and you didn\'t eat anything unusual last night.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Being sick can push BG up. What\'s a good first move?"</p>',
    onEnter: (s) => { s.bg.current = 16.5; s.bg.trend = 'rising'; notify(); showCompanion('Sick day. Step by step.'); },
    quiz: () => ({
      options: [
        { text: '🙋 Tell a grown-up and check for ketones', correct: true, feedback: 'Yes. Sick plus high BG means checking ketones, with a grown-up helping.' },
        { text: '😴 Go back to sleep', correct: false, feedback: 'Being sick can make BG and ketones climb. It needs attention now.' },
        { text: '🥞 Eat a big breakfast to feel better', correct: false, feedback: 'Your tummy and your BG need gentle care right now.' }
      ],
      continueText: '🧪 Check ketones',
      next: p + '-ketones'
    })
  });

  addPassage(p + '-ketones', {
    content: (s) => sceneArt('🧪', ['⚠️ moderate'], 'morning') +
      '<p>Ketones: <strong>moderate</strong>.</p>' +
      '<p>You and your grown-up follow your <strong>sick day plan</strong> from your diabetes team. It covers what to do about insulin, when to check again, and when to call. You sip water and rest.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "That plan is exactly what it\'s for. Keep sipping."</p>',
    onEnter: (s) => {
      takeCorrection();
      updateConfidence(5);
      if (collectBetaCell('what-are-ketones')) setTimeout(() => showBetaCellNotification(betaCellMap['what-are-ketones'].name, 'blue'), 500);
      if (collectBetaCell('sick-day-red-flags')) setTimeout(() => showBetaCellNotification(betaCellMap['sick-day-red-flags'].name, 'red'), 1500);
    },
    next: p + '-continue', continueText: 'Continue'
  });

  addPassage(p + '-continue', {
    content: (s) => sceneArt('🛋️', ['🤒 💧 📺'], 'day') + '<h2>Staying Home</h2>' +
      '<p>No school today. BG is coming down slowly: <strong>' + s.bg.current.toFixed(1) + '</strong>. Ketones are going down too.</p>' +
      '<p>You rest on the couch and check more often than usual.</p>',
    onEnter: () => { advanceTime(1.5); tick(1.5); },
    next: nextSnack, continueText: 'Continue'
  });
  return p;
}

function registerEmotionalAnchor_Day5Evening(day, nextPassage) {
  const p = 'd5-anchor-evening';
  addPassage(p, {
    content: (s) => sceneArt('🌆', ['🛋️ 🤖 🧒'], 'evening') + '<h2>End of a Long Day</h2>' +
      '<p class="passage-scene">Evening. You\'re feeling a bit better than this morning.</p>' +
      '<p><strong>' + s.companion.name + '</strong> floats over. "How are you doing?"</p>',
    onEnter: () => { showCompanion('Today was a lot.'); },
    choices: [
      { text: '"Tired."', onSelect: () => updateConfidence(4), next: p + '-resp' },
      { text: '"Better than this morning."', onSelect: () => updateConfidence(4), next: p + '-resp' },
      { text: 'Just nod.', onSelect: () => updateConfidence(4), next: p + '-resp' }
    ]
  });
  addPassage(p + '-resp', {
    content: (s) => '<p><strong>' + s.companion.name + ':</strong> "Fair enough. Sick days mean doing extra work while you feel bad. You got through it."</p>',
    onEnter: () => { if (collectBetaCell('bad-days-okay')) setTimeout(() => showBetaCellNotification(betaCellMap['bad-days-okay'].name, 'gold'), 500); },
    next: nextPassage, continueText: 'Continue'
  });
  return p;
}

// Sunday: family bike ride and picnic.
function registerScriptedMorning_Day7(day, nextSnack) {
  const p = 'd7-anchor-outing';
  addPassage(p, {
    content: (s) => sceneArt('🌳 🚲 🧺', ['🏠 ➜ 🏞️'], 'morning') +
      '<h2>Sunday Outing</h2>' +
      '<p class="passage-scene">Your family is biking to the park for a picnic. A whole day out of the usual routine.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Biking plus no regular mealtimes. Let\'s start with a good breakfast."</p>',
    onEnter: () => { advanceTime(0.5); showCompanion('Big day out!'); },
    choices: [
      { text: '🥣 Oatmeal with blueberries <span class="carb-tag">~28g</span>', onSelect: () => { eatMeal(28, 'slow'); }, next: p + '-pack' },
      { text: '🍞 2 slices whole wheat toast + cheese <span class="carb-tag">~33g</span>', onSelect: () => { eatMeal(33, 'slow'); }, next: p + '-pack' },
      { text: '🥞 3 pancakes + 2 tbsp maple syrup <span class="carb-tag">~61g</span>', onSelect: () => { eatMeal(61, 'fast'); }, next: p + '-pack' }
    ]
  });
  addPassage(p + '-pack', {
    content: () => sceneArt('🎒', ['🚲 🧺'], 'morning') + '<h2>Ready to Ride</h2><p>What goes in your bike bag?</p>',
    onEnter: () => { tick(0.5); advanceTime(0.5); },
    quiz: () => ({
      options: [
        { text: '🎒 Insulin supplies, BG checker, glucose tabs, snacks, water, medical ID', correct: true, feedback: 'Perfect. Diabetes Canada says to carry fast sugar at all times.' },
        { text: '🍬 Just glucose tabs', correct: false, feedback: 'Tabs are great, but you\'ll also want snacks, water, and a way to check your BG.' },
        { text: '📱 Just your phone', correct: false, feedback: 'A long day out needs your diabetes supplies too.' }
      ],
      continueText: '🚲 Let\'s go',
      onDone: () => updateConfidence(4),
      next: nextSnack
    })
  });
  return p;
}

// Tuesday: timing of mealtime insulin, framed as "ask your team what's right for you".
function registerScriptedMorning_Day2(day, nextSnack) {
  const p = 'd2-anchor-solo';
  addPassage(p, {
    content: (s) => sceneArt('🥣 🍌 🥛', ['🏠 🌅'], 'morning') +
      '<h2>Breakfast, On Your Own</h2>' +
      '<p class="passage-scene">Corn flakes with milk, and an orange. 1 cup corn flakes (23 g) + 1 cup milk (12 g) + an orange (15 g) = 50 g.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Rapid-acting mealtime insulin is usually taken 0 to 15 minutes before eating. Your diabetes team tells you what timing is right for you. What\'s your plan today?"</p>',
    onEnter: () => { showCompanion('Your call.'); },
    choices: [
      { text: '⏱️ Insulin a few minutes before eating (if that\'s in my plan)', onSelect: () => { eatMeal(50, 'fast', true); updateConfidence(4); if (collectBetaCell('pre-bolusing')) setTimeout(() => showBetaCellNotification(betaCellMap['pre-bolusing'].name, 'green'), 500); }, next: p + '-done' },
      { text: '🍽️ Insulin when I start eating', onSelect: () => { eatMeal(50, 'fast'); updateConfidence(4); }, next: p + '-done' }
    ]
  });
  addPassage(p + '-done', {
    content: (s) => '<p>Breakfast done. BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Timing is one of those things you and your team figure out together."</p>',
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    next: nextSnack, continueText: 'Continue'
  });
  return p;
}

// Thursday: soccer practice. Prep choice, then the Exercise Balance mini-game is the practice.
function registerScriptedExercise_Day4(day, nextPassage) {
  const p = 'd4-anchor-soccer';
  addPassage(p, {
    content: (s) => sceneArt('⚽ 🥅', ['🧒👟 🧒👟 🧒👟'], 'day') +
      '<h2>Soccer Practice</h2>' +
      '<p class="passage-scene">After school. You\'re tying your cleats. BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Exercise can lower BG, during practice and for hours after. What do you do before you start?"</p>',
    onEnter: (s) => { setClock(15.5); if (s.bg.current > 10) { s.bg.current = 8.4; notify(); } },
    quiz: () => ({
      options: [
        { text: '🎒 Check BG and keep glucose tabs and a snack in my bag', correct: true, feedback: 'Yes. Diabetes Canada says to carry fast sugar at all times. Your diabetes team can help you make an exercise plan.' },
        { text: '🤷 Nothing, just play', correct: false, feedback: 'Exercise can drop BG fast. Have fast sugar nearby, just in case.' },
        { text: '🙈 Leave my supplies in the locker room', correct: false, feedback: 'If you go low on the field, you\'ll want your supplies close by.' }
      ],
      continueText: '⚽ Start practice',
      next: () => { playMiniGame('Exercise Balance', { tier: 2, activity: '⚽' }, p + '-after'); return null; }
    })
  });
  addPassage(p + '-after', {
    content: (s) => sceneArt('🏁', ['😅 💧 🎒'], 'evening') + '<h2>After Practice</h2>' +
      '<p class="passage-scene">You cool down and grab your bag. BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Diabetes Canada says long exercise can lower blood sugar for up to 48 hours afterwards. Keep an eye on it tonight."</p>',
    onEnter: () => { if (collectBetaCell('exercise-emergencies')) setTimeout(() => showBetaCellNotification(betaCellMap['exercise-emergencies'].name, 'red'), 800); },
    next: nextPassage, continueText: '🏠 Head home'
  });
  return p;
}

// Saturday: late brunch.
function registerScriptedMorning_Day6(day, nextSnack) {
  const p = 'd6-anchor-brunch';
  addPassage(p, {
    content: (s) => sceneArt('🧇 🍳 🍓', ['🏠 ☀️ 😴'], 'morning') + '<h2>Saturday Brunch</h2>' +
      '<p class="passage-scene">It\'s almost 10. Somebody is making waffles.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Late breakfast on weekends. Check first, then follow your plan for what\'s on your plate."</p>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '.</p>',
    onEnter: (s) => { s.time.hour = 10.0; notify(); },
    choices: [
      { text: '🧇 Two waffles + 2 tbsp maple syrup <span class="carb-tag">~56g</span>', onSelect: (s) => { eatMeal(56, 'fast'); s.narrative.choices['d6-brunch'] = 'waffles'; }, next: p + '-done' },
      { text: '🍳 Eggs + one waffle + strawberries <span class="carb-tag">~22g</span>', onSelect: (s) => { eatMeal(22, 'slow'); s.narrative.choices['d6-brunch'] = 'balanced'; }, next: p + '-done' },
      { text: '🥣 Yogurt + ¼ cup granola + blueberries <span class="carb-tag">~47g</span>', onSelect: (s) => { eatMeal(47, 'slow'); s.narrative.choices['d6-brunch'] = 'parfait'; }, next: p + '-done' }
    ]
  });
  addPassage(p + '-done', {
    content: (s) => {
      const k = s.narrative.choices['d6-brunch'];
      const note = k === 'waffles' ? 'Maple syrup has 14 g of carbs per tablespoon. It adds up.'
        : k === 'balanced' ? 'Eggs and fruit with the waffle. Nice mix.'
        : 'Half a cup of granola has 46 g of carbs, so a quarter cup is about 23 g. Good thing you counted it.';
      return '<p><strong>' + s.companion.name + ':</strong> "' + note + '"</p><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>';
    },
    onEnter: () => { advanceTime(0.75); tick(0.75); },
    next: nextSnack, continueText: 'Continue'
  });
  return p;
}

// ============================================
// 16. WEEKLY SUMMARY
// ============================================

addPassage('weekly-summary', {
  noWrap: true,
  content: (s) => {
    // AUDIO: Play weekly summary celebration
    const tirs = s.score.timeInRange.map(v => v || 0);
    const avg = tirs.length ? Math.round(tirs.reduce((a, b) => a + b, 0) / tirs.length) : 0;
    const bars = DAY_NAMES.map((d, i) => {
      const v = tirs[i] || 0;
      return '<div class="wk-bar"><div class="wk-fill" style="height:' + v + '%"></div><span>' + d.slice(0, 3) + '</span><small>' + v + '%</small></div>';
    }).join('');
    return '<div class="summary-panel"><h2>Week ' + s.time.week + ' complete! 🎉</h2>' +
      '<p style="text-align:center;margin-bottom:12px;">Time in the green zone, day by day:</p>' +
      '<div class="wk-chart">' + bars + '</div>' +
      '<div class="summary-stat"><span class="label">Average</span><span class="value" style="color:var(--zone-green)">' + avg + '%</span></div>' +
      '<div class="summary-stat"><span class="label">Lows handled this week</span><span class="value">' + (s.narrative.lowsWeek || 0) + '</span></div>' +
      '<div class="summary-stat"><span class="label">Beta Cells collected</span><span class="value" style="color:var(--accent-warm)">' + s.score.collectiblesFound.length + '/' + s.score.totalCollectibles + '</span></div>' +
      '<div class="summary-stat"><span class="label">Confidence</span><span class="value">' + s.confidence + '</span></div></div>' +
      '<div class="passage"><p><strong>' + s.companion.name + ':</strong> "A whole week. Every meal, every check, every low you handled. That\'s a lot of learning."</p></div>';
  },
  onEnter: () => { showCompanion('What a week. Ready for another?', 8000); },
  choices: [
    { text: '🔁 Play another week', next: (s) => {
      s.time.week++;
      s.score.timeInRange = [];
      s.narrative.lowsWeek = 0;
      s.narrative.eventsCompleted = [];
      s.flags.weekComplete = false;
      startDay(1);
      return null;
    } },
    { text: '📖 Knowledge Journal', next: () => { openJournal(); return null; } }
  ]
});

// ============================================
// 17. SETUP PASSAGES (Dedication, Title, Save Slots, Character, Devices, Pace, Companion)
// ============================================

const HATS = ['', '🧢', '👒', '🎩', '🎀', '👑', '⛑️'], FACES = ['😊', '😎', '🙂', '😄', '🤓', '😺', '🤠'];
const SHIRT_COLORS = ['#5b8fb9', '#e85d4a', '#4caf50', '#ffc107', '#9c27b0', '#ff7eb6', '#26a69a'];
const SHOES = ['👟', '🥾', '🩴', '👞', '🥿', '🛼'];

function avatarHTML(a, big) {
  return '<div class="avatar-doll' + (big ? ' big' : '') + '">' +
    '<span class="d-hat">' + (HATS[a.hat] || '') + '</span>' +
    '<span class="d-face">' + (FACES[a.face] || FACES[0]) + '</span>' +
    '<span class="d-shirt" style="background:' + (SHIRT_COLORS[a.shirt] || SHIRT_COLORS[0]) + '"></span>' +
    '<span class="d-shoes">' + (SHOES[a.shoes] || SHOES[0]) + '</span></div>';
}

function registerSetupPassages() {
  addPassage('dedication', {
    noWrap: true,
    content: () => '<div class="title-screen" style="cursor:pointer;"><p style="font-style:italic;font-size:1.3em;color:#e0e0e0;">For Dr. Patricia Riley</p></div>',
    onEnter: () => {
      const advance = () => {
        document.removeEventListener('keydown', advance);
        document.getElementById('narrative')?.removeEventListener('click', advance);
        renderPassage('title');
      };
      setTimeout(() => {
        document.addEventListener('keydown', advance, { once: true });
        document.getElementById('narrative')?.addEventListener('click', advance);
      }, 100);
    }
  });

  addPassage('title', {
    noWrap: true,
    content: () => '<div class="title-screen"><div class="title-art">🍎 🤖 🩸 🥪 ⚽</div><h1>Sugar Rush</h1><p class="subtitle">A week in the life</p>' +
      '<button class="start-btn" id="play-btn">▶ Play</button></div>',
    onEnter: () => {
      hideHUD();
      setTimeout(() => document.getElementById('play-btn')?.addEventListener('click', () => renderPassage('slot-select')), 50);
    }
  });

  addPassage('slot-select', {
    noWrap: true,
    content: () => {
      let html = '<div class="creation-panel"><h2>Choose a save slot</h2><p class="slot-note">💾 The game saves by itself after every step. Each slot is a separate game.</p><div class="slots">';
      for (let n = 1; n <= SLOT_COUNT; n++) {
        const d = readSlot(n);
        if (d && d.player) {
          const day = d.time ? d.time.day : 1, week = d.time ? d.time.week : 1;
          const when = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
          html += '<div class="slot-card">' + avatarHTML(d.player.appearance || {}, false) +
            '<div class="slot-info"><strong>' + (d.player.name || 'Player') + '</strong><br><small>Week ' + week + ' · ' +
            (d.flags && d.flags.weekComplete ? 'Week finished' : dayName(day) + ' (Day ' + day + ')') + '</small><br><small class="muted">Last played ' + when + '</small></div>' +
            '<div class="slot-btns"><button class="modal-btn primary" data-continue="' + n + '">▶ Continue</button><button class="modal-btn" data-delete="' + n + '">🗑️</button></div></div>';
        } else {
          html += '<div class="slot-card empty"><div class="slot-info"><strong>Slot ' + n + '</strong><br><small class="muted">Empty</small></div>' +
            '<div class="slot-btns"><button class="modal-btn primary" data-new="' + n + '">✨ New game</button></div></div>';
        }
      }
      return html + '</div><button class="continue-btn" id="slot-back" style="margin-top:16px;">◀ Back</button></div>';
    },
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('[data-continue]').forEach(b => b.addEventListener('click', () => { if (loadGame(+b.dataset.continue)) resumeGame(); }));
        document.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => { resetState(); currentSlot = +b.dataset.new; renderPassage('setup-name'); }));
        document.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
          const n = +b.dataset.delete, d = readSlot(n);
          showModal('Delete this save?', '<p>This will permanently erase <strong>' + ((d && d.player && d.player.name) || 'this game') + '</strong> in slot ' + n + '. It can\'t be undone.</p>', [
            { text: 'Keep it', primary: true },
            { text: '🗑️ Delete forever', danger: true, onClick: () => { deleteSlot(n); renderPassage('slot-select'); } }
          ]);
        }));
        document.getElementById('slot-back')?.addEventListener('click', () => renderPassage('title'));
      }, 50);
    }
  });

  addPassage('setup-name', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>What\'s your name?</h2><div class="creation-field"><input type="text" id="player-name" placeholder="Enter your name" maxlength="20" autofocus></div><button class="continue-btn" id="name-continue">Next ▶</button></div>',
    onEnter: () => {
      setTimeout(() => {
        const btn = document.getElementById('name-continue'), inp = document.getElementById('player-name');
        inp?.focus();
        const go = () => { const n = inp.value.trim(); if (n) { state.player.name = n; renderPassage('setup-appearance'); } else { inp.style.borderColor = 'var(--zone-red)'; inp.focus(); } };
        btn?.addEventListener('click', go);
        inp?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      }, 50);
    }
  });

  addPassage('setup-appearance', {
    noWrap: true,
    content: () => {
      const a = state.player.appearance;
      const row = (label, field, list, render) => '<div class="creation-field"><label>' + label + '</label><div class="option-picker" data-field="' + field + '">' +
        list.map((v, i) => '<div class="option-pick' + (a[field] === i ? ' selected' : '') + '" data-index="' + i + '">' + render(v) + '</div>').join('') + '</div></div>';
      return '<div class="creation-panel"><h2>Make your look</h2><div class="appearance-layout"><div class="doll-preview" id="doll-preview">' + avatarHTML(a, true) + '<div class="doll-name">' + state.player.name + '</div></div><div>' +
        row('Hat', 'hat', HATS, v => v || '🚫') +
        row('Face', 'face', FACES, v => v) +
        row('Shirt', 'shirt', SHIRT_COLORS, c => '<span style="display:block;width:32px;height:32px;border-radius:6px;background:' + c + '"></span>') +
        row('Shoes', 'shoes', SHOES, v => v) +
        '</div></div><button class="continue-btn" id="appearance-continue">Next ▶</button></div>';
    },
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.option-picker').forEach(p => {
          const f = p.dataset.field;
          p.querySelectorAll('.option-pick').forEach(o => o.addEventListener('click', () => {
            p.querySelectorAll('.option-pick').forEach(x => x.classList.remove('selected'));
            o.classList.add('selected');
            state.player.appearance[f] = parseInt(o.dataset.index, 10);
            document.getElementById('doll-preview').innerHTML = avatarHTML(state.player.appearance, true) + '<div class="doll-name">' + state.player.name + '</div>';
            document.querySelector('#doll-preview .avatar-doll').classList.add('bounce');
          }));
        });
        document.getElementById('appearance-continue')?.addEventListener('click', () => renderPassage('setup-devices'));
      }, 50);
    }
  });

  addPassage('setup-devices', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>How do you manage your diabetes?</h2>' +
      '<div class="creation-field"><label>How do you take your insulin?</label><div class="device-choice" data-field="insulin">' +
      '<div class="device-option' + (state.player.device.insulin === 'pump' ? ' selected' : '') + '" data-value="pump"><div class="dev-emoji">🎛️</div><h3>Insulin Pump</h3><p>A small device that gives insulin all day.</p></div>' +
      '<div class="device-option' + (state.player.device.insulin === 'injections' ? ' selected' : '') + '" data-value="injections"><div class="dev-emoji">🖊️</div><h3>Injections</h3><p>An insulin pen or syringe.</p></div></div></div>' +
      '<div class="creation-field"><label>How do you check your blood sugar?</label><div class="device-choice" data-field="bgMonitor">' +
      '<div class="device-option' + (state.player.device.bgMonitor === 'cgm' ? ' selected' : '') + '" data-value="cgm"><div class="dev-emoji">📡</div><h3>CGM</h3><p>A sensor that checks all the time.</p></div>' +
      '<div class="device-option' + (state.player.device.bgMonitor === 'fingerprick' ? ' selected' : '') + '" data-value="fingerprick"><div class="dev-emoji">🩸</div><h3>Finger Pokes</h3><p>A meter and a quick poke. You\'re the detective.</p></div></div></div>' +
      '<p class="slot-note">Both ways work. Pick whatever matches you, or whatever you\'re curious about.</p>' +
      '<button class="continue-btn" id="devices-continue">Next ▶</button></div>',
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.device-choice').forEach(g => {
          const f = g.dataset.field;
          g.querySelectorAll('.device-option').forEach(o => o.addEventListener('click', () => {
            g.querySelectorAll('.device-option').forEach(x => x.classList.remove('selected'));
            o.classList.add('selected');
            state.player.device[f] = o.dataset.value;
          }));
        });
        document.getElementById('devices-continue')?.addEventListener('click', () => renderPassage('setup-difficulty'));
      }, 50);
    }
  });

  addPassage('setup-difficulty', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>Choose your pace</h2><div class="difficulty-choice">' +
      '<div class="difficulty-option' + (state.player.difficulty === 'learning' ? ' selected' : '') + '" data-value="learning"><h3>🌱 Learning the Ropes</h3><p>I\'m new to this. Show me tips along the way.</p></div>' +
      '<div class="difficulty-option' + (state.player.difficulty === 'gotthis' ? ' selected' : '') + '" data-value="gotthis"><h3>🚀 I\'ve Got This</h3><p>I know some stuff. Fewer tips, please.</p></div>' +
      '</div><button class="continue-btn" id="diff-continue" style="margin-top:24px">Next ▶</button></div>',
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.difficulty-option').forEach(o => o.addEventListener('click', () => {
          document.querySelectorAll('.difficulty-option').forEach(x => x.classList.remove('selected'));
          o.classList.add('selected');
          state.player.difficulty = o.dataset.value;
        }));
        document.getElementById('diff-continue')?.addEventListener('click', () => {
          state.flags.tipsOff = state.player.difficulty === 'gotthis';
          renderPassage('setup-companion');
        });
      }, 50);
    }
  });

  addPassage('setup-companion', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>One more thing...</h2>' +
      '<div class="pip-intro">🤖</div>' +
      '<p>A small robot floats into view and does a little spin.</p>' +
      '<p><strong>"Hi, ' + state.player.name + '! I\'m your helper for the week. Your pancreas took early retirement, so I\'m here to help you learn the ropes."</strong></p>' +
      '<p><strong>"Want to give me a name?"</strong></p>' +
      '<div class="creation-field" style="margin-top:16px"><input type="text" id="companion-name" placeholder="Name your helper" value="Pip" maxlength="15"></div>' +
      '<button class="continue-btn" id="comp-continue">Let\'s go! ▶</button></div>',
    onEnter: () => {
      // AUDIO: Play companion intro jingle
      setTimeout(() => {
        document.getElementById('comp-continue')?.addEventListener('click', () => {
          state.companion.name = (document.getElementById('companion-name')?.value.trim()) || 'Pip';
          document.getElementById('pip-nametag').textContent = state.companion.name;
          state.flags.setupComplete = true;
          state.time.day = 1; state.time.hour = 7.0; state.time.week = 1;
          resetDayScore();
          showHUD();
          renderPassage('day1-wakeup');
        });
      }, 50);
    }
  });
}

// ============================================
// 18. DAY 1 (Monday): tutorial, one idea at a time
// ============================================
// Each part of the screen is introduced when it first matters, with a short tip
// pointing at it. Tips show once per save and can be switched off.

function registerDay1Passages() {
  const D1_BREAKFAST = [
    { name: 'Cereal with milk', carbs: 48, speed: 'fast', desc: '2 cups Cheerios (36 g) + 1 cup milk (12 g).' },
    { name: 'Toast with peanut butter', carbs: 38, speed: 'slow', desc: '2 slices whole wheat (32 g) + peanut butter (6 g).' },
    { name: 'Scrambled eggs on toast', carbs: 18, speed: 'slow', desc: '2 eggs (2 g) + 1 slice whole wheat toast (16 g).' }
  ];
  const D1_LUNCH = [
    { name: 'Cheese pizza slice', carbs: 25, speed: 'slow' },
    { name: 'Chicken wrap', carbs: 27, speed: 'slow' },
    { name: 'Pasta with sauce', carbs: 42, speed: 'slow' }
  ];

  addPassage('day1-wakeup', {
    content: (s) => {
      const cgm = s.player.device.bgMonitor === 'cgm';
      return sceneArt('🌅', ['🛏️ ⏰ 🎒', '🪟 ☀️ 🧸'], 'morning') +
        '<h2>Monday Morning</h2>' +
        '<p class="passage-scene">Your alarm goes off.</p>' +
        '<p>' + (cgm ? 'You glance at your CGM' : 'You do a quick finger poke') + ': <strong>' + s.bg.current.toFixed(1) + '</strong>. In the green zone.</p>';
    },
    onEnter: (s) => { s.time.hour = 7.0; s.bg.current = 7.2; s.bg.trend = 'stable'; notify(); },
    afterRender: (s) => {
      tutorialTip('bg', '#hud-bg', 'This is your <strong>blood sugar</strong> (BG). The <strong style="color:#4caf50">green zone is 5 to 10</strong>.' + (s.player.device.bgMonitor === 'cgm' ? ' The arrow shows which way it\'s heading.' : ''));
      tutorialTip('avatar', '#hud-avatar', 'That\'s you, ' + s.player.name + '!');
      tutorialTip('pip', '#companion-face', 'And that\'s me, ' + s.companion.name + '. I\'ll pop up with help. <strong>Tap me any time</strong> for a hint. If I start flashing, check your BG!');
    },
    next: 'day1-breakfast', continueText: '🍳 Breakfast'
  });

  addPassage('day1-breakfast', {
    content: () => sceneArt(D1_BREAKFAST.map(f => foodEmoji(f.name)).join(' '), ['🏠 🍽️'], 'morning') +
      '<h2>Breakfast</h2><div class="food-list">' + D1_BREAKFAST.map(f =>
        '<div class="food-row"><span class="food-emoji">' + foodEmoji(f.name) + '</span><div><strong>' + f.name + '</strong> <span class="carb-tag">~' + f.carbs + 'g carbs</span><br><small>' + f.desc + '</small></div></div>').join('') + '</div>',
    onEnter: () => { advanceTime(0.25); showCompanion('Any of these is fine. They just have different carbs.'); },
    choices: D1_BREAKFAST.map(f => ({
      text: foodEmoji(f.name) + ' ' + f.name,
      onSelect: (s) => { s.narrative.choices['bk'] = f; },
      next: 'day1-breakfast-routine'
    }))
  });

  addPassage('day1-breakfast-routine', {
    content: (s) => {
      const f = s.narrative.choices['bk'];
      return '<h2>Mealtime Routine</h2>' +
        '<div class="routine"><div class="r-step done">✅ 🩸 Check BG: ' + s.bg.current.toFixed(1) + '</div>' +
        '<div class="r-step done">✅ 🔢 Count the carbs: ' + f.carbs + 'g</div>' +
        '<div class="r-step now">⬜ ' + (s.player.device.insulin === 'pump' ? '🎛️' : '🖊️') + ' Take your mealtime insulin</div></div>' +
        '<div class="tip-box">💡 Your diabetes team gives you a <strong>plan</strong> that turns carbs into an insulin dose. Everyone\'s plan is different. In this game, your plan is built in, so your job is knowing the carbs.</div>';
    },
    choices: (s) => [{
      text: s.player.device.insulin === 'pump' ? '🎛️ Enter the carbs in my pump' : '🖊️ Take my mealtime insulin with my pen',
      onSelect: (st) => { const f = st.narrative.choices['bk']; eatMeal(f.carbs, f.speed); },
      next: 'day1-breakfast-done'
    }]
  });

  addPassage('day1-breakfast-done', {
    content: (s) => sceneArt('😋', ['🍽️ ✨'], 'morning') + '<h2>Breakfast Done</h2>' +
      '<p>BG will go up a bit as the food digests, then come back down as the insulin works.</p>',
    onEnter: () => {
      tick(0.5); advanceTime(0.5);
      collectBetaCell('what-are-carbs');
      setTimeout(() => showBetaCellNotification('What are Carbs?', 'blue'), 300);
    },
    afterRender: () => { tutorialTip('cells', '#hud-collectibles', 'You found a <strong>Beta Cell</strong>! Each one is a fact to keep. <strong>Tap here</strong> any time to read them in your Knowledge Journal.'); },
    next: 'day1-morning-snack', continueText: 'Continue'
  });

  addPassage('day1-morning-snack', {
    content: (s) => sceneArt('🏫 🍎', ['🎒 ✏️ 📚'], 'day') + '<h2>Recess Snack</h2>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. ' + snackAdvice(s.bg.current) + '</p>',
    onEnter: () => { advanceTime(2.0); tick(1.5); },
    choices: () => snackChoices(1, 3).map(sn => ({
      text: sn.emoji + ' ' + sn.name + ' <span class="carb-tag">~' + sn.carbs + 'g · ' + sn.tag + '</span>',
      onSelect: () => eatSnack(sn.carbs, sn.speed),
      next: 'day1-morning-game'
    })),
    afterRender: () => { tutorialTip('energy', '#hud-energy', '<strong>Energy</strong> shows how you feel. It fills up when BG is in the green zone, and drains when BG is too high or too low.'); }
  });

  addPassage('day1-morning-game', {
    content: () => sceneArt('🥪', ['🎮 ✨'], 'day') + '<h2>Mini-game: Carb Counter</h2><p class="passage-scene">Twice a day there\'s a mini-game. This one is about counting carbs.</p>',
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    choices: [{ text: '▶ Play Carb Counter', next: () => { playMiniGame('Carb Counter', { tier: 1 }, 'day1-lunch'); return null; } }]
  });

  addPassage('day1-lunch', {
    content: () => sceneArt(D1_LUNCH.map(f => foodEmoji(f.name)).join(' '), ['🏫 🍽️ 🧒🧒'], 'day') +
      '<h2>Lunch</h2><p class="passage-scene">The cafeteria.</p>',
    onEnter: () => { advanceTime(1.0); tick(1.0); },
    choices: D1_LUNCH.map(f => ({
      text: foodEmoji(f.name) + ' ' + f.name + ' <span class="carb-tag">~' + f.carbs + 'g</span>',
      onSelect: () => { eatMeal(f.carbs, f.speed); tick(0.25); },
      next: 'day1-lunch-social'
    })),
    afterRender: () => { tutorialTip('clock', '#hud-time', 'The <strong>day and time</strong>. Each day has meals, snacks and a couple of mini-games, from Monday to Sunday.'); }
  });

  addPassage('day1-lunch-social', {
    content: (s) => sceneArt('🧒 💬 🧒', [], 'day') + '<h2>A Friend Sits Down</h2><p>Mia: "Hey! What\'s ' + (s.player.device.insulin === 'pump' ? 'that thing on your belt' : 'that pen you just used') + '?"</p>',
    onEnter: () => { showCompanion('Your call. There\'s no wrong answer.'); },
    choices: (s) => [
      { text: '"It\'s my insulin ' + (s.player.device.insulin === 'pump' ? 'pump' : 'pen') + '. I have diabetes."', onSelect: () => { state.narrative.choices['d1-social'] = 'explain'; updateConfidence(5); }, next: 'day1-lunch-response' },
      { text: s.player.device.insulin === 'pump' ? '"Basically a tiny computer that gives me medicine."' : '"It gives me medicine I need every day."', onSelect: () => { state.narrative.choices['d1-social'] = 'casual'; updateConfidence(5); }, next: 'day1-lunch-response' },
      { text: '"I\'d rather not talk about it right now."', onSelect: () => { state.narrative.choices['d1-social'] = 'deflect'; updateConfidence(5); }, next: 'day1-lunch-response' }
    ]
  });

  addPassage('day1-lunch-response', {
    content: (s) => {
      const r = { explain: '"Oh cool! Does it hurt?"', casual: '"No way, can I see?"', deflect: '"Okay! Want some carrot sticks?"' };
      return '<p>Mia: <strong>' + r[s.narrative.choices['d1-social']] + '</strong></p>' +
        '<p><strong>' + s.companion.name + ':</strong> "Sharing and not sharing are both fine. It\'s up to you."</p>';
    },
    onEnter: () => { if (collectBetaCell('talking-to-friends')) setTimeout(() => showBetaCellNotification('Talking to Friends About T1D', 'gold'), 500); },
    afterRender: () => { tutorialTip('conf', '#hud-confidence', '<strong>Confidence</strong> grows as you learn and try things. In conversations there are no wrong answers.'); },
    next: 'day1-hypo', continueText: 'Continue'
  });

  // The first low: gym class. Uses the real low-BG rescue flow, which teaches as it goes.
  addPassage('day1-hypo', {
    content: () => sceneArt('🏐 🏃', ['🏫 💦'], 'day') + '<h2>Gym Class</h2>' +
      '<p class="passage-scene">Dodgeball, the whole period. Walking back to class, your legs feel wobbly and your hands feel shaky.</p>',
    onEnter: (s) => { s.time.hour = 14.0; s.carbs.pending = []; s.insulin.pendingDoses = []; s.bg.current = 3.7; s.bg.trend = 'falling'; notify(); showCompanion('Something feels off. Check your BG!'); },
    next: () => { startLowRescue('day1-dinner', false); return null; }, continueText: '🩸 Check BG'
  });

  addPassage('day1-dinner', {
    content: () => sceneArt('🥢 🍚 🍗 🥦', ['🏠 🍽️'], 'evening') + '<h2>Dinner</h2>' +
      '<p class="passage-scene">Stir-fry: about one cup of rice, chicken and ½ cup of broccoli. No label.</p>' +
      '<p>About how many carbs? <small>(½ cup of cooked rice has about 24 g. Chicken has little.)</small></p>',
    onEnter: () => { state.time.hour = 17.5; tick(1.5); },
    quiz: () => ({
      options: [
        { text: '🍚 About 15g', correct: false, feedback: 'A bit low. Half a cup of rice is already 24 g.' },
        { text: '🍚 About 55g', correct: true, feedback: 'Nice! One cup of rice is 48 g, plus about 6 g in the broccoli.' },
        { text: '🍚 About 100g', correct: false, feedback: 'That\'s more like two plates. One cup of rice is about 48 g.' }
      ],
      continueText: '🍽️ Eat dinner',
      onDone: () => {
        eatMeal(54, 'slow'); tick(0.5); advanceTime(0.5);
        if (collectBetaCell('estimating-carbs')) setTimeout(() => showBetaCellNotification('Estimating Carbs Without Labels', 'green'), 500);
      },
      next: 'day1-dinner-social'
    })
  });

  addPassage('day1-dinner-social', {
    content: () => sceneArt('👨‍👩‍👧 🍽️', [], 'evening') + '<h2>Dinner Table</h2><p>Someone asks how your day went.</p>',
    choices: [
      { text: '"Pretty good! I\'m learning a lot."', onSelect: () => updateConfidence(3), next: 'day1-evening' },
      { text: '"It was a lot to think about."', onSelect: () => updateConfidence(3), next: 'day1-evening' },
      { text: '"Can we talk about something else?"', onSelect: () => updateConfidence(3), next: 'day1-evening' }
    ]
  });

  addPassage('day1-evening', {
    content: (s) => sceneArt('🌆', ['🛋️ 📺 🎲'], 'evening') + '<h2>Evening</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '.</p>',
    onEnter: () => { advanceTime(1.5); tick(1.0); },
    choices: [
      { text: '🎲 Relax', next: 'd1-bedtime' },
      { text: '📖 Read your Knowledge Journal', onSelect: () => { openJournal(); }, next: 'd1-bedtime' }
    ]
  });

  registerBedtime(1, 'day1-final-check');
  addPassage('day1-final-check', {
    content: (s) => '<h2>Last Check</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>: ' + getBGZone(s.bg.current).label + '</p>',
    onEnter: () => {
      tick(0.5);
      if (collectBetaCell('bedtime-snacks')) setTimeout(() => showBetaCellNotification('Why Bedtime Snacks Matter', 'green'), 500);
    },
    next: 'd1-end', continueText: '😴 Go to sleep'
  });
  registerDayEnd(1);
}

// ============================================
// 19. INIT
// ============================================

function inGame() {
  return !!(currentSlot && state.flags.setupComplete && !NON_GAME_PASSAGE.test(state.narrative.currentPassage || ''));
}

// The browser Back button can't undo a choice here. Instead of leaving the page,
// it opens an in-page message explaining that the game is saved.
function guardNavigation() {
  try {
    history.replaceState({ sr: 'base' }, '');
    history.pushState({ sr: 'guard' }, '');
  } catch (e) { return; }
  window.addEventListener('popstate', () => {
    history.pushState({ sr: 'guard' }, '');
    if (!inGame()) return;
    saveGame();
    showModal('⬅️ The Back button',
      '<p>The Back button doesn\'t take back choices in Sugar Rush.</p>' +
      '<p>💾 Don\'t worry: your game is saved, right up to this moment.</p>',
      [
        { text: '▶ Keep playing', primary: true },
        { text: '🏠 Go to the title screen', onClick: goToTitle }
      ]);
  });
  // Refresh / close: the save is already up to date. Browsers show their own
  // "leave site?" box here; the Menu (☰) explains that refreshing is safe.
  window.addEventListener('beforeunload', (e) => {
    if (!inGame()) return;
    saveGame();
    e.preventDefault();
    e.returnValue = '';
  });
}

function init() {
  migrateLegacySave();
  registerSetupPassages();
  registerDay1Passages();
  registerLowBGRescuePassages();
  initHUD();
  guardNavigation();
  renderPassage('dedication');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

return { state, renderPassage, startDay, openJournal, saveGame, loadGame, tick, eatMeal, playMiniGame };
})();
