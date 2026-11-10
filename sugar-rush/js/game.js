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
  narrative: { currentPassage: null, eventsCompleted: [], choices: {}, dayEvents: {}, pendingAfterRescue: null, rescueInProgress: false, lowBGHandled: false },
  companion: { name: '', mood: 'happy' },
  flags: { setupComplete: false }
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

const BGConfig = {
  carbRaisePer1g: 0.1, carbAbsorptionFast: 0.5, carbAbsorptionSlow: 2.0,
  insulinDropPer1u: 3.0, insulinOnsetDelay: 0.25, insulinDuration: 4.0,
  exerciseDropPerHour: 1.0, basalDriftPerHour: 0.3, basalInsulinPerHour: 0.3,
  targetLow: 5.0, targetHigh: 12.0, minBG: 2.0, maxBG: 30.0,
  carbRatio: 10, correctionFactor: 3.0, correctionTarget: 8.0,
  energyDrain: [
    { min: 5, max: 12, rate: 0 }, { min: 12, max: 15, rate: 5 },
    { min: 15, max: 30, rate: 15 }, { min: 3, max: 5, rate: 10 }, { min: 2, max: 3, rate: 25 }
  ],
  energyRecoveryPerHour: 10
};

function eatFood(grams, speed) { state.carbs.pending.push({ time: state.time.hour, grams, speed: speed || 'fast', absorbed: 0 }); }
function doseInsulin(units) { state.insulin.pendingDoses.push({ time: state.time.hour, units, delivered: 0 }); }
function recommendedDose(carbs, currentBG) {
  let d = carbs / BGConfig.carbRatio;
  if (currentBG > BGConfig.correctionTarget) d += (currentBG - BGConfig.correctionTarget) / BGConfig.correctionFactor;
  return Math.round(d * 2) / 2;
}

function tick(deltaHours) {
  if (deltaHours <= 0) return;
  let bgDelta = 0;
  for (const c of state.carbs.pending) {
    if (c.absorbed >= c.grams) continue;
    const rate = c.speed === 'fast' ? BGConfig.carbAbsorptionFast : BGConfig.carbAbsorptionSlow;
    const abs = Math.min((c.grams / rate) * deltaHours, c.grams - c.absorbed);
    c.absorbed += abs;
    bgDelta += abs * BGConfig.carbRaisePer1g;
  }
  state.carbs.pending = state.carbs.pending.filter(c => c.absorbed < c.grams);
  for (const d of state.insulin.pendingDoses) {
    if (d.delivered >= d.units) continue;
    const elapsed = state.time.hour - d.time;
    if (elapsed < BGConfig.insulinOnsetDelay) continue;
    if (elapsed > BGConfig.insulinDuration + BGConfig.insulinOnsetDelay) { d.delivered = d.units; continue; }
    const del = Math.min((d.units / BGConfig.insulinDuration) * deltaHours, d.units - d.delivered);
    d.delivered += del;
    bgDelta -= del * BGConfig.insulinDropPer1u;
  }
  state.insulin.pendingDoses = state.insulin.pendingDoses.filter(d => d.delivered < d.units);
  if (state.insulin.basalActive) bgDelta += (BGConfig.basalDriftPerHour - BGConfig.basalInsulinPerHour) * deltaHours;
  else bgDelta += BGConfig.basalDriftPerHour * deltaHours;
  const newBG = Math.max(BGConfig.minBG, Math.min(BGConfig.maxBG, state.bg.current + bgDelta));
  const diff = newBG - state.bg.current;
  let trend = 'stable';
  if (diff > 0.5 * deltaHours) trend = 'rising';
  if (diff > 1.5 * deltaHours) trend = 'rising_fast';
  if (diff < -0.5 * deltaHours) trend = 'falling';
  if (diff < -1.5 * deltaHours) trend = 'falling_fast';
  updateBG(newBG, trend);
  const bg = state.bg.current;
  let eDelta = 0;
  if (bg >= BGConfig.targetLow && bg <= BGConfig.targetHigh) eDelta = BGConfig.energyRecoveryPerHour * deltaHours;
  else { for (const z of BGConfig.energyDrain) { if (bg >= z.min && bg < z.max) { eDelta = -z.rate * deltaHours; break; } } }
  updateEnergy(state.energy + eDelta);
}

function getBGZone(v) {
  if (v < 3) return { zone: 'severe-low', label: 'Severe Low', color: 'red' };
  if (v < 5) return { zone: 'low', label: 'Low', color: 'yellow' };
  if (v <= 12) return { zone: 'target', label: 'In Range', color: 'green' };
  if (v <= 15) return { zone: 'high', label: 'High', color: 'yellow' };
  return { zone: 'very-high', label: 'Very High', color: 'red' };
}
function getTrendArrow(t) { return { rising_fast: '↑↑', rising: '↑', stable: '→', falling: '↓', falling_fast: '↓↓' }[t] || '→'; }

// ============================================
// 4. NARRATIVE ENGINE
// ============================================

const passages = {};
function addPassage(id, p) { passages[id] = p; }

function renderPassage(id, opts) {
  opts = opts || {};
  const p = passages[id];
  if (!p) { console.error('Missing passage:', id); return; }
  state.narrative.currentPassage = id;
  const container = document.getElementById('passage-container');
  container.innerHTML = '';
  document.getElementById('narrative').scrollTop = 0;
  // AUDIO: Play passage transition sound
  if (p.onEnter && !opts.skipOnEnter) p.onEnter(state);
  // LOW-BG INTERRUPT — after onEnter may have ticked BG, check if rescue is needed.
  // Skips rescue-related passages, the Day 1 scripted hypo tutorial, and the scheduled
  // Treat-the-Low mini-game intro so they don't retrigger the check.
  if (!opts.skipOnEnter && checkLowBGInterrupt(id)) return;
  // If BG is now healthy, clear the handled flag so a future low can trigger again.
  if (state.bg.current >= 5 && state.narrative.lowBGHandled) state.narrative.lowBGHandled = false;
  const div = document.createElement('div');
  div.className = p.noWrap ? '' : 'passage';
  div.innerHTML = typeof p.content === 'function' ? p.content(state) : p.content;
  container.appendChild(div);
  const choices = typeof p.choices === 'function' ? p.choices(state) : p.choices;
  if (choices && choices.length > 0) {
    const cd = document.createElement('div');
    cd.className = 'choices';
    for (const c of choices) {
      if (c.condition && !c.condition(state)) continue;
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = typeof c.text === 'function' ? c.text(state) : c.text;
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
  if (p.next && (!choices || choices.length === 0)) {
    const next = typeof p.next === 'function' ? p.next(state) : p.next;
    const nextOpts = typeof p.nextOpts === 'function' ? p.nextOpts(state) : p.nextOpts;
    const btn = document.createElement('button');
    btn.className = 'continue-btn';
    btn.textContent = p.continueText || 'Continue';
    btn.addEventListener('click', () => { if (p.onExit) p.onExit(state); notify(); renderPassage(next, nextOpts); });
    const w = document.createElement('div');
    w.style.marginTop = '20px';
    w.appendChild(btn);
    container.appendChild(w);
  }
  notify();
}

// --- Low BG narrative interrupt ---
// When BG drops into hypo territory, divert the player into a rescue passage
// chain that launches the Treat-the-Low mini-game. After resolution, the
// original passage is re-rendered with skipOnEnter so its side effects don't
// double-fire.

// Passages we never interrupt (they ARE the rescue flow, or already teach hypo).
const LOW_BG_INTERRUPT_EXEMPT = /^(low-bg-rescue|day1-hypo)/;

function isLowBG(v) { return v < 4.0; } // ≤3.9 mmol/L = hypoglycemia
function isSevereLowBG(v) { return v < 3.0; }

function checkLowBGInterrupt(currentId) {
  if (state.narrative.rescueInProgress) return false;
  if (state.narrative.lowBGHandled) return false;
  // Don't hijack passages that are themselves meant to teach low BG
  // or that are mid-meal (let the meal resolve, then the post-meal passage catches it).
  if (LOW_BG_INTERRUPT_EXEMPT.test(currentId || '')) return false;
  if (!isLowBG(state.bg.current)) return false;
  state.narrative.rescueInProgress = true;
  state.narrative.lowBGHandled = true;
  state.narrative.pendingAfterRescue = currentId;
  renderPassage('low-bg-rescue');
  return true;
}

function registerLowBGRescuePassages() {
  // The alert — companion reacts, symptoms described, player chooses to treat.
  addPassage('low-bg-rescue', {
    content: (s) => {
      const bg = s.bg.current;
      const severe = isSevereLowBG(bg);
      const symptoms = severe
        ? 'Your hands shake hard. Your vision tunnels. Your heart pounds in your ears. This is serious.'
        : 'Your hands feel trembly. A thin sweat breaks on your forehead. Suddenly you\'re starving.';
      const pipLine = severe
        ? '"Hey — <strong>stop</strong>. Look at me. That number is dangerous. Fast sugar, right now, no dosing."'
        : '"You\'re low. Stop what you\'re doing. Time for fast sugar — 15 grams."';
      return '<h2>⚠️ Low Blood Sugar' + (severe ? ' — Severe' : '') + '</h2>' +
        '<p class="passage-scene">' + symptoms + '</p>' +
        '<p>BG: <strong style="color:var(--zone-red);">' + bg.toFixed(1) + '</strong> mmol/L — ' + getBGZone(bg).label + '.</p>' +
        '<p><strong>' + s.companion.name + ':</strong> ' + pipLine + '</p>' +
        '<p><small>Low BG (hypoglycemia) is anything under 4.0 mmol/L. It can happen to every T1D. What matters is catching it and treating it — fast sugar, then wait 15 minutes, then recheck. This is the <strong>15-15 rule</strong>.</small></p>';
    },
    onEnter: (s) => {
      const severe = isSevereLowBG(s.bg.current);
      showCompanion(severe ? 'Severe low — fast sugar now!' : 'You\'re low. Let\'s handle it.', 4000);
    },
    choices: [{
      text: '▶ Treat the low →',
      next: function() {
        playMiniGame('Treat-the-Low', { currentBG: state.bg.current }, 'low-bg-rescue-after');
        return null;
      }
    }]
  });

  // After the mini-game: apply sugar, teach recovery, resume the original passage.
  addPassage('low-bg-rescue-after', {
    content: (s) => '<h2>Back in Range</h2>' +
      '<p>You wait out the 15 minutes. Slowly, the trembling fades. The fog in your head lifts. The world comes back into focus.</p>' +
      '<p>BG: <strong style="color:var(--zone-green);">' + s.bg.current.toFixed(1) + '</strong> mmol/L — ' + getBGZone(s.bg.current).label + '.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Good. That\'s going to happen sometimes — even when you do everything right. What matters is that you <em>felt it</em>, <em>checked it</em>, and <em>treated it</em>. That\'s the whole job."</p>',
    onEnter: (s) => {
      // Apply the 15g fast-sugar rescue: bring BG up and set a rising trend.
      eatFood(15, 'fast');
      tick(0.25); advanceTime(0.25);
      // Ensure we're safely above the hypo threshold even if absorption is slow.
      if (s.bg.current < 5.5) { s.bg.current = 5.5; }
      s.bg.trend = 'rising';
      notify();
      if (collectBetaCell('fifteen-fifteen-rule')) {
        setTimeout(() => showBetaCellNotification(betaCellMap['fifteen-fifteen-rule'].name, betaCellMap['fifteen-fifteen-rule'].cat), 500);
      }
      updateConfidence(3);
    },
    onExit: (s) => {
      s.narrative.rescueInProgress = false;
    },
    next: (s) => s.narrative.pendingAfterRescue || ('d' + s.time.day + '-evening'),
    nextOpts: { skipOnEnter: true },
    continueText: 'Resume the day'
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
  onChange(updateHUD);
  // Make beta cell counter clickable to open journal
  document.getElementById('hud-collectibles').style.cursor = 'pointer';
  document.getElementById('hud-collectibles').addEventListener('click', openJournal);
}
function showHUD() { hud.el.classList.remove('hidden'); }

function updateHUD() {
  if (!hud.el || hud.el.classList.contains('hidden')) return;
  const bg = state.bg.current;
  const zone = getBGZone(bg);
  const colorVar = zone.color === 'green' ? 'var(--zone-green)' : zone.color === 'yellow' ? 'var(--zone-yellow)' : 'var(--zone-red)';
  hud.bgValue.textContent = bgDisplay(bg);
  hud.bgValue.style.color = colorVar;
  hud.bgTrend.textContent = state.player.device.bgMonitor === 'cgm' ? getTrendArrow(state.bg.trend) : '';
  const pct = Math.max(0, Math.min(100, ((bg - 2) / 18) * 100));
  hud.bgFill.style.width = pct + '%';
  hud.bgFill.style.backgroundColor = colorVar;
  hud.energyFill.style.width = state.energy + '%';
  hud.confidenceValue.textContent = state.confidence;
  hud.day.textContent = 'Day ' + state.time.day;
  const h = Math.floor(state.time.hour), m = Math.round((state.time.hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM', dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  hud.clock.textContent = dh + ':' + String(m).padStart(2, '0') + ' ' + period;
  hud.betaCells.textContent = state.score.collectiblesFound.length + ' / ' + state.score.totalCollectibles;
  hud.effects.className = '';
  if (bg < 3) hud.effects.className = 'low-severe';
  else if (bg < 5) hud.effects.className = 'low-mild';
  else if (bg > 15) hud.effects.className = 'high-severe';
  else if (bg > 12) hud.effects.className = 'high-mild';
}

// ============================================
// 6. COMPANION
// ============================================

let companionTimeout = null;
function showCompanion(text, dur) {
  const el = document.getElementById('companion');
  el.classList.remove('hidden');
  document.getElementById('companion-text').textContent = text;
  // AUDIO: Play companion dialogue blip
  if (companionTimeout) clearTimeout(companionTimeout);
  if (dur > 0) companionTimeout = setTimeout(() => el.classList.add('hidden'), dur);
}
function hideCompanion() { document.getElementById('companion').classList.add('hidden'); }

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

const companionLines = {
  afterMealGood: ["Nice choice. That should keep things steady.", "Good call on the meal.", "Solid choice. Let's see how it lands."],
  afterMealOkay: ["Not bad. Could go either way — we'll keep an eye on it.", "That'll work. Let's see what happens."],
  encouragement: ["You're getting the hang of this.", "One step at a time. You're doing it.", "Every check, every count — it all adds up."],
  morningGreeting: ["Morning! Let's see where we're at.", "New day. How's the number?", "Rise and shine. Quick check?"],
  bgGood: ["Right in the green. Nice.", "Look at that number. Solid.", "In range. Good."],
  bgHigh: ["Running a bit high. Let's bring it down.", "A little elevated. A correction should help.", "Number's climbing. Watch the trend."],
  bgLow: ["Hey — that number is low. Fast sugar, now.", "You're going low. Stop and treat it.", "Under 4. Don't wait — 15 grams of fast sugar."]
};
function randomLine(cat) { const pool = companionLines[cat]; return pool ? pool[Math.floor(Math.random() * pool.length)] : ''; }

// ============================================
// 7. BETA CELL CATALOG (50 entries)
// ============================================

const betaCells = [
  // BLUE — Facts (13)
  { id: 'what-is-blood-sugar', name: 'What is Blood Sugar?', cat: 'blue', desc: 'Blood sugar (glucose) is the main sugar in your blood. It comes from the food you eat and is your body\'s primary source of energy. Your body needs to keep blood sugar in a healthy range to function well.' },
  { id: 'what-are-carbs', name: 'What are Carbs?', cat: 'blue', desc: 'Carbohydrates are nutrients found in food that your body breaks down into glucose. Bread, rice, fruit, and sweets all contain carbs. Counting carbs helps you figure out how much insulin you need.' },
  { id: 'what-is-insulin', name: 'What is Insulin?', cat: 'blue', desc: 'Insulin is a hormone that acts like a key, unlocking your cells so glucose can enter and be used for energy. In T1D, your body stops making insulin, so you take it through a pump or injections.' },
  { id: 'what-is-t1d', name: 'What is Type 1 Diabetes?', cat: 'blue', desc: 'Type 1 Diabetes is an autoimmune condition where the immune system mistakenly destroys the beta cells in the pancreas that make insulin. It\'s not caused by diet or lifestyle — it can happen to anyone.' },
  { id: 'what-are-ketones', name: 'What are Ketones?', cat: 'blue', desc: 'When your body can\'t use glucose for energy (because there\'s not enough insulin), it burns fat instead. This creates ketones. A small amount is normal, but high ketones can be dangerous and can lead to DKA.' },
  { id: 'what-is-a1c', name: 'What is A1C?', cat: 'blue', desc: 'A1C is a blood test that shows your average blood sugar over the past 2-3 months. It\'s like a report card for blood sugar management. Your diabetes team uses it to see how things are going overall.' },
  { id: 'what-is-basal', name: 'What is Basal Insulin?', cat: 'blue', desc: 'Basal insulin is the background insulin your body needs all day and night, even when you\'re not eating. Pumps deliver it continuously. With injections, you take a long-acting shot once or twice daily.' },
  { id: 'what-is-bolus', name: 'What is a Bolus?', cat: 'blue', desc: 'A bolus is the insulin you take specifically for food or to correct a high blood sugar. You calculate it based on the carbs you\'re eating and your current BG. Getting the bolus right keeps your BG in range after meals.' },
  { id: 'how-cgm-works', name: 'How Does a CGM Work?', cat: 'blue', desc: 'A Continuous Glucose Monitor (CGM) is a small sensor inserted under the skin that measures glucose in the fluid between cells. It checks every few minutes and shows trends — whether you\'re rising, falling, or stable.' },
  { id: 'how-pump-works', name: 'How Does an Insulin Pump Work?', cat: 'blue', desc: 'An insulin pump is a small device that delivers fast-acting insulin through a tiny tube under the skin. It gives a steady trickle (basal) all day and you program it to give extra (bolus) at meals.' },
  { id: 'what-is-pancreas', name: 'What is the Pancreas?', cat: 'blue', desc: 'The pancreas is an organ behind your stomach. In people without diabetes, it makes insulin automatically when blood sugar rises. In T1D, the insulin-making cells (beta cells) have been destroyed.' },
  { id: 'what-are-beta-cells', name: 'What are Beta Cells?', cat: 'blue', desc: 'Beta cells are special cells in the pancreas that produce insulin. In Type 1 Diabetes, the immune system attacks and destroys these cells. That\'s why people with T1D need to take insulin from outside the body.' },
  { id: 'macronutrients', name: 'Carbs, Protein, and Fat — The Big Three', cat: 'blue', desc: 'Food is made up of three main nutrients: carbs raise blood sugar the fastest, protein raises it slowly and helps you feel full, and fat slows down digestion. Knowing all three helps you predict what your BG will do.' },

  // GREEN — Skills (13)
  { id: 'carbs-everywhere', name: 'Carbs Are Everywhere (And That\'s Okay)', cat: 'green', desc: 'Carbs aren\'t bad — they\'re fuel! But they\'re in more foods than you might think: bread, rice, fruit, milk, even some vegetables. The key isn\'t avoiding carbs — it\'s knowing how many you\'re eating.' },
  { id: 'fifteen-fifteen-rule', name: 'The 15-15 Rule — Your Emergency Plan', cat: 'green', desc: 'When you\'re low (under 5 mmol/L): eat 15 grams of fast-acting sugar, wait 15 minutes, then recheck. If still low, repeat. Fast-acting means juice, glucose tabs, or regular soda — not chocolate or candy bars.' },
  { id: 'estimating-carbs', name: 'Estimating Carbs Without Labels', cat: 'green', desc: 'Not all food comes with nutrition labels. Use your hand as a guide: your fist is about 1 cup, your palm is about a serving of protein. Practice makes this easier — you don\'t need to be exact, just close.' },
  { id: 'bedtime-snacks', name: 'Why Bedtime Snacks Matter', cat: 'green', desc: 'A bedtime snack with carbs AND protein helps keep blood sugar steady overnight. Your body still needs fuel while you sleep. A good combo: crackers with cheese, toast with peanut butter, or a glass of milk.' },
  { id: 'reading-labels', name: 'Reading a Nutrition Label', cat: 'green', desc: 'On a Canadian Nutrition Facts label, look for: Serving Size (how much is one serving?), Total Carbohydrate (your key number), and Fibre (can subtract from total carbs). Always check how many servings are in the package!' },
  { id: 'restaurant-carbs', name: 'Counting Carbs at a Restaurant', cat: 'green', desc: 'Restaurants are tricky — no labels! Estimate using what you know: a bun is ~30g, a cup of rice ~45g, a side of fries ~40g. Ask the server about ingredients. Some restaurants have nutrition info online — check before you go.' },
  { id: 'adjusting-exercise', name: 'Adjusting for Exercise', cat: 'green', desc: 'Exercise lowers blood sugar, sometimes for hours afterward. Before being active: check your BG, have a snack if you\'re under 7, and consider reducing insulin. Keep glucose tabs handy. Every body responds differently — you\'ll learn your pattern.' },
  { id: 'sick-day-management', name: 'Sick Day Management', cat: 'green', desc: 'When you\'re sick, blood sugar often runs high even if you\'re not eating much. Check BG more often, check ketones, drink lots of water, and take correction doses as needed. Call your diabetes team if ketones stay high.' },
  { id: 'packing-trip', name: 'Packing for a Trip', cat: 'green', desc: 'Always pack MORE supplies than you think you\'ll need: extra insulin, extra test strips, glucose tabs, snacks, and your medical ID. Keep insulin cool but not frozen. If flying, carry everything in your carry-on — never check it.' },
  { id: 'site-rotation', name: 'Site Rotation and Care', cat: 'green', desc: 'Whether you use a pump or injections, rotating where you put your sites/inject prevents scar tissue buildup. Common spots: belly, thighs, upper arms, and hips. Give each spot time to rest before using it again.' },
  { id: 'portion-estimation', name: 'Portion Size Estimation', cat: 'green', desc: 'Your hand is a built-in measuring tool. Fist = 1 cup (rice, pasta). Palm = protein serving. Thumb = 1 tablespoon (peanut butter). Cupped hand = 1/2 cup (fruit). These aren\'t exact, but they\'re close enough for good carb counting.' },
  { id: 'pre-bolusing', name: 'Pre-Bolusing — Timing Your Insulin', cat: 'green', desc: 'Taking insulin 10-15 minutes BEFORE eating gives it a head start, so it\'s working when the carbs hit your blood. This helps prevent the post-meal spike. Start small — even 5 minutes early makes a difference.' },
  { id: 'correcting-high', name: 'Correcting a High', cat: 'green', desc: 'When BG is high, a correction dose brings it back down. Use your correction factor: if 1 unit drops you 3 mmol/L and you\'re at 15 (target 8), you need about 2-2.5 units. Be careful not to stack corrections too close together.' },

  // GOLD — Life Wisdom (13)
  { id: 'talking-to-friends', name: 'Talking to Friends About T1D', cat: 'gold', desc: 'Some days you\'ll want to explain everything. Other days you won\'t want to talk about it at all. Both are fine. You don\'t owe anyone an explanation — but having a few people who understand can make things easier.' },
  { id: 'bad-days-okay', name: 'It\'s Okay to Have Bad Days', cat: 'gold', desc: 'Some days your blood sugar will be all over the place no matter what you do. That doesn\'t mean you failed. Even people who\'ve managed T1D for decades have bad days. Be kind to yourself and try again tomorrow.' },
  { id: 'not-your-numbers', name: 'You Are Not Your Numbers', cat: 'gold', desc: 'A blood sugar reading is information, not a grade. A high number doesn\'t mean you did something wrong. A low number doesn\'t mean you\'re broken. These are data points that help you make decisions — nothing more.' },
  { id: 'asking-help', name: 'Asking for Help is a Strength', cat: 'gold', desc: 'Managing T1D is a lot. Asking for help — from parents, friends, teachers, your diabetes team — isn\'t weakness. It\'s smart. Even the most independent people need support sometimes.' },
  { id: 'setting-boundaries', name: 'Setting Boundaries', cat: 'gold', desc: 'It\'s okay to say "I don\'t want to talk about that right now." It\'s okay to not show your CGM to curious strangers. It\'s okay to eat in private if that\'s what you need. Your health is your business — you decide who\'s in the circle.' },
  { id: 'teaching-others', name: 'Teaching Others About T1D', cat: 'gold', desc: 'When you explain T1D to someone, you become the expert. That shift — from "patient" to "educator" — is powerful. You don\'t have to correct every misconception, but when you choose to teach, you help everyone.' },
  { id: 'burnout-real', name: 'Diabetes Burnout is Real', cat: 'gold', desc: 'Getting tired of the constant checking, counting, and dosing is completely normal. It doesn\'t mean you\'re lazy or don\'t care. Take breaks where you can, ask for help, and talk to your diabetes team about how you\'re feeling.' },
  { id: 'celebrating-wins', name: 'Celebrating Small Wins', cat: 'gold', desc: 'Caught a low before it got bad? That\'s a win. Estimated carbs perfectly at dinner? Win. Made it through a tough day? Huge win. T1D management is full of small victories — notice them.' },
  { id: 'every-expert-beginner', name: 'Every Expert Was Once a Beginner', cat: 'gold', desc: 'The person who manages their T1D effortlessly was once terrified of their first injection. Every skill you\'re learning now will become second nature. Give yourself time and grace.' },
  { id: 'feelings-valid', name: 'Your Feelings Are Valid', cat: 'gold', desc: 'Angry about having T1D? Valid. Frustrated when things don\'t work? Valid. Sad about what\'s changed? Valid. Don\'t let anyone — including yourself — tell you that you shouldn\'t feel what you feel.' },
  { id: 'support-team', name: 'Building Your Support Team', cat: 'gold', desc: 'Your support team is the people who have your back: family, friends, teachers, coaches, your diabetes team. Let them know what you need — some people want to help but don\'t know how unless you tell them.' },
  { id: 'self-advocacy', name: 'Self-Advocacy is a Superpower', cat: 'gold', desc: 'Speaking up for what you need — a snack during class, a timeout during sports, a moment to check your BG — gets easier with practice. You have the right to manage your health wherever you are.' },
  { id: 'tld-not-define', name: 'T1D Doesn\'t Define You', cat: 'gold', desc: 'You are a person who happens to have Type 1 Diabetes. It\'s part of your life, but it\'s not your whole life. You can do anything — T1D just means you have to plan a little more.' },

  // RED — Emergency (11)
  { id: 'when-call-help', name: 'When to Call for Help', cat: 'red', desc: 'Call your diabetes team or go to the ER if: ketones are high and not coming down, you\'re vomiting and can\'t keep fluids down, BG is over 20 and not responding to corrections, or you feel seriously unwell. Don\'t wait it out — call.' },
  { id: 'dka-signs', name: 'DKA — Know the Signs', cat: 'red', desc: 'Diabetic Ketoacidosis (DKA) is a serious emergency. Signs: very high BG, moderate to high ketones, nausea/vomiting, stomach pain, fruity-smelling breath, rapid breathing, confusion. This needs immediate medical attention.' },
  { id: 'severe-low-others', name: 'Severe Low — What Others Need to Know', cat: 'red', desc: 'If you can\'t treat a low yourself, others need to know: don\'t give food or drink to someone who\'s unconscious, use glucagon if available, call 911, lay the person on their side. Make sure at least one person around you knows this.' },
  { id: 'glucagon-backup', name: 'Glucagon — The Emergency Backup', cat: 'red', desc: 'Glucagon is an emergency medication that raises blood sugar fast. It\'s used when someone is too low to eat or drink. Keep it accessible and make sure people close to you know where it is and how to use it.' },
  { id: 'sick-day-red-flags', name: 'Sick Day Red Flags', cat: 'red', desc: 'When sick, watch for: ketones rising above moderate, BG staying above 15 despite corrections, inability to keep fluids down, fever that won\'t break. These need a call to your doctor — don\'t try to manage alone.' },
  { id: 'device-failures', name: 'When Your Devices Fail', cat: 'red', desc: 'Pumps can malfunction, CGMs can fall off, meters can die. Always have a backup plan: carry a spare meter and strips, know how to give injections even if you use a pump, and keep emergency supplies separate from your main kit.' },
  { id: 'overnight-safety', name: 'Overnight Safety', cat: 'red', desc: 'Nighttime lows are a real concern. A bedtime snack, a CGM with alarms, or a planned middle-of-night check can help. Make sure someone in the house knows how to recognize and treat a low while you\'re asleep.' },
  { id: 'exercise-emergencies', name: 'Exercise Emergencies', cat: 'red', desc: 'During intense activity, BG can drop fast. Always have fast-acting sugar within reach. If you feel shaky, dizzy, or confused during exercise, STOP and treat immediately. Health always comes before the game.' },
  { id: 'stress-bg', name: 'Stress and Blood Sugar', cat: 'red', desc: 'Stress hormones (like adrenaline and cortisol) raise blood sugar. Tests, arguments, scary movies — all can spike your BG. This isn\'t something you did wrong. Recognize the pattern and correct if needed.' },
  { id: 'travel-safety', name: 'Travel Safety', cat: 'red', desc: 'When traveling: bring double the supplies you think you need, keep insulin in your carry-on (not checked luggage), carry a doctor\'s letter for security, and know the words for "diabetes" and "insulin" in the local language.' },
  { id: 'medical-id', name: 'Medical ID — Why It Matters', cat: 'red', desc: 'A medical ID bracelet or necklace tells first responders you have T1D if you can\'t speak for yourself. Wear it always — especially during sports, travel, and outings. It\'s a small thing that can save your life.' }
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
// 9. SAVE / LOAD SYSTEM
// ============================================

const SAVE_KEY = 'sugarrush-save';

function saveGame() {
  const saveData = {
    version: 2,
    timestamp: Date.now(),
    player: state.player,
    bg: { current: state.bg.current, trend: state.bg.trend, unit: state.bg.unit },
    energy: state.energy,
    confidence: state.confidence,
    time: state.time,
    score: {
      timeInRange: state.score.timeInRange,
      collectiblesFound: state.score.collectiblesFound,
      totalCollectibles: state.score.totalCollectibles,
      mealsManaged: state.score.mealsManaged,
      snacksRemembered: state.score.snacksRemembered
    },
    narrative: { eventsCompleted: state.narrative.eventsCompleted, choices: state.narrative.choices },
    companion: state.companion,
    flags: state.flags
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) { console.error('Save failed:', e); return false; }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.version) return false;
    Object.assign(state.player, d.player);
    state.bg.current = d.bg.current;
    state.bg.trend = d.bg.trend;
    state.bg.unit = d.bg.unit || 'mmol';
    state.bg.history = [];
    state.energy = d.energy;
    state.confidence = d.confidence;
    Object.assign(state.time, d.time);
    state.score.timeInRange = d.score.timeInRange || [];
    state.score.collectiblesFound = d.score.collectiblesFound || [];
    state.score.mealsManaged = d.score.mealsManaged || 0;
    state.score.snacksRemembered = d.score.snacksRemembered || 0;
    state.score.bgSamples = [];
    state.narrative.eventsCompleted = d.narrative.eventsCompleted || [];
    state.narrative.choices = d.narrative.choices || {};
    Object.assign(state.companion, d.companion);
    Object.assign(state.flags, d.flags);
    // Clear pending carbs/insulin on load (stale data)
    state.carbs.pending = [];
    state.insulin.pendingDoses = [];
    return true;
  } catch (e) { console.error('Load failed:', e); return false; }
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

// ============================================
// 10. EVENT POOL SYSTEM
// ============================================

// Each event = { id, title, type, tier, register(dayNum, prefix) }
// register() adds passages to the passage map and returns the entry passage ID

const mealPool = [];
const socialPool = [];
const emotionalPool = [];
const practicalPool = [];

function pickFromPool(pool, tier, count, seen) {
  const eligible = pool.filter(e => e.tier <= tier && !seen.includes(e.id));
  const shuffled = eligible.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- MEAL EVENTS ---

function registerMealEvent(id, title, tier, options, betaId) {
  mealPool.push({
    id, title, type: 'meal', tier,
    register: function(day, nextPassage) {
      const p = 'd' + day + '-meal-' + id;
      addPassage(p, {
        content: (s) => '<h2>' + title + '</h2>' +
          // ART: Scene background — meal scene
          '<p class="passage-scene">' + options.scene + '</p>' +
          '<table class="meal-options">' + options.foods.map(f => '<tr><td><strong>' + f.name + '</strong></td><td>' + f.desc + ' <strong>~' + f.carbs + 'g carbs</strong></td></tr>').join('') + '</table>',
        onEnter: () => { advanceTime(0.5); tick(0.5); showCompanion(options.companionIntro || "What looks good?"); },
        choices: options.foods.map(f => ({
          text: f.name + ' (~' + f.carbs + 'g)',
          onSelect: (s) => {
            eatFood(f.carbs, f.speed || 'slow');
            doseInsulin(recommendedDose(f.carbs, s.bg.current));
            s.score.mealsManaged++;
            tick(0.5); advanceTime(0.5);
          },
          next: p + '-done'
        }))
      });
      addPassage(p + '-done', {
        content: (s) => {
          const zone = getBGZone(s.bg.current);
          let resultText;
          if (zone.zone === 'severe-low' || zone.zone === 'low') {
            resultText = 'You finish eating, but something already feels off — your hands are trembly and the room seems far away. ' + s.companion.name + ' frowns at the meter.';
          } else if (zone.zone === 'very-high') {
            resultText = 'You eat and dose. The correction is on board, but the number is stubborn. ' + s.companion.name + (s.player.device.bgMonitor === 'cgm' ? ' watches the CGM.' : ' checks the meter.') + ' "Give it time."';
          } else if (zone.zone === 'high') {
            resultText = 'You eat and dose. BG is running a bit high — the correction should help. ' + s.companion.name + ': "We\'ll watch it."';
          } else {
            resultText = options.result || 'You eat and dose. ' + s.companion.name + ' nods approvingly.';
          }
          return '<p>' + resultText + '</p>' +
            '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong> — ' + zone.label + '</p>';
        },
        onEnter: () => {
          tick(0.5); advanceTime(0.5);
          showCompanion(contextualCompanionLine('afterMealGood'));
          if (betaId && collectBetaCell(betaId)) setTimeout(() => showBetaCellNotification(betaCellMap[betaId].name, betaCellMap[betaId].cat), 500);
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
  companionIntro: "Pancakes! Syrup is basically pure sugar — keep that in mind.",
  foods: [
    { name: 'Pancakes with syrup', carbs: 55, desc: 'Three fluffy pancakes drizzled with maple syrup.', speed: 'fast' },
    { name: 'Pancakes with fruit', carbs: 45, desc: 'Two pancakes topped with strawberries.', speed: 'fast' },
    { name: 'One pancake + eggs', carbs: 25, desc: 'One pancake with scrambled eggs on the side.', speed: 'slow' }
  ],
  result: "Breakfast of champions. The syrup hits fast, so the insulin timing matters here."
});

registerMealEvent('sandwich', 'Sandwich Builder', 1, {
  scene: 'Lunch time. You\'re building your own sandwich.',
  foods: [
    { name: 'Turkey on white bread', carbs: 35, desc: 'Turkey, lettuce, tomato on two slices of white bread.', speed: 'fast' },
    { name: 'PB&J on whole wheat', carbs: 45, desc: 'Peanut butter and jam on whole wheat. Classic.', speed: 'slow' },
    { name: 'Chicken wrap', carbs: 25, desc: 'Grilled chicken in a small tortilla with veggies.', speed: 'slow' }
  ]
}, 'macronutrients');

registerMealEvent('taco', 'Taco Night', 1, {
  scene: 'Family taco night. Everything is laid out to build your own.',
  foods: [
    { name: 'Two hard shell tacos', carbs: 30, desc: 'Beef, cheese, lettuce in crispy shells.', speed: 'slow' },
    { name: 'Taco bowl (no shell)', carbs: 15, desc: 'All the fillings in a bowl. Fewer carbs, same taste.', speed: 'slow' },
    { name: 'Three soft tacos', carbs: 45, desc: 'Flour tortillas loaded with everything.', speed: 'slow' }
  ]
});

registerMealEvent('soup', 'Soup and Bread', 1, {
  scene: 'A warm bowl of soup and crusty bread.',
  companionIntro: "Soup can have hidden carbs — noodles, potatoes, beans.",
  foods: [
    { name: 'Chicken noodle + bread', carbs: 40, desc: 'Classic chicken noodle with a slice of bread.', speed: 'slow' },
    { name: 'Tomato soup + crackers', carbs: 35, desc: 'Creamy tomato soup with saltine crackers.', speed: 'fast' },
    { name: 'Broth-based veggie soup', carbs: 15, desc: 'Clear broth with vegetables. Light on carbs.', speed: 'slow' }
  ]
});

registerMealEvent('fruit-salad', 'Fruit Salad Surprise', 1, {
  scene: 'Someone brought a big fruit salad. "It\'s healthy!"',
  companionIntro: "Fruit is healthy AND it has carbs. Both things are true.",
  foods: [
    { name: 'Big bowl of fruit salad', carbs: 40, desc: 'Melon, grapes, banana, mango. Delicious but carb-heavy.', speed: 'fast' },
    { name: 'Small bowl with yogurt', carbs: 25, desc: 'A smaller portion with plain yogurt mixed in.', speed: 'slow' },
    { name: 'Just berries', carbs: 12, desc: 'Strawberries and blueberries. Lower sugar fruits.', speed: 'fast' }
  ]
});

// Tier 2 meals
registerMealEvent('birthday-pizza', 'Birthday Party Pizza', 2, {
  scene: 'A friend\'s birthday party. Pizza, cake, soda. Everyone\'s eating freely.',
  companionIntro: "Social eating is hard. All approaches are valid here.",
  foods: [
    { name: 'Two slices of pizza', carbs: 60, desc: 'The full party experience.', speed: 'slow' },
    { name: 'One slice + salad', carbs: 35, desc: 'Pizza plus something lighter.', speed: 'slow' },
    { name: 'One slice + birthday cake', carbs: 70, desc: 'Can\'t miss the cake! Big carb load.', speed: 'slow' }
  ],
  result: "Party food is tricky — but doable. The fat in pizza slows down the carb spike, so the BG might rise later than expected."
}, 'restaurant-carbs');

registerMealEvent('cafeteria-wildcard', 'Cafeteria Wildcard', 2, {
  scene: 'The cafeteria changed the menu. Your planned meal isn\'t available.',
  companionIntro: "Plans change. Time to adapt.",
  foods: [
    { name: 'Mac and cheese', carbs: 40, desc: 'The backup option. Cheesy and carb-heavy.', speed: 'slow' },
    { name: 'Chef\'s salad with roll', carbs: 25, desc: 'Salad with ham, cheese, egg, and a bread roll.', speed: 'slow' },
    { name: 'Fish sticks and fries', carbs: 45, desc: 'Breaded fish with a side of fries.', speed: 'slow' }
  ]
});

registerMealEvent('grandma', 'Grandma\'s Cooking', 2, {
  scene: 'Grandma made a big meal. She\'s watching to make sure you eat enough. "Have more, you\'re too skinny!"',
  companionIntro: "Navigating family and food. You've got this.",
  foods: [
    { name: 'Full plate (her portion)', carbs: 65, desc: 'A heaping plate. Grandma is satisfied.', speed: 'slow' },
    { name: 'Your own portion', carbs: 40, desc: 'A reasonable amount. Grandma looks slightly hurt.', speed: 'slow' },
    { name: 'Full plate, slow eating', carbs: 55, desc: 'Take a full plate but eat slowly, maybe leave a bit.', speed: 'slow' }
  ],
  result: "Family meals are about more than food. You managed both the carbs and the feelings."
});

registerMealEvent('protein-plate', 'The Protein Plate', 2, {
  scene: 'Tonight\'s dinner is steak, roasted veggies, and a green salad.',
  companionIntro: "Not every meal is carb-heavy. This one's mostly protein.",
  foods: [
    { name: 'Steak + veggies only', carbs: 10, desc: 'Almost all protein and fat. Very low carbs.', speed: 'slow' },
    { name: 'Steak + veggies + bread', carbs: 25, desc: 'Adding a dinner roll for some carbs.', speed: 'slow' },
    { name: 'Steak + baked potato', carbs: 45, desc: 'Adding a medium baked potato.', speed: 'slow' }
  ]
}, 'pre-bolusing');

registerMealEvent('smoothie-trap', 'The Smoothie Trap', 2, {
  scene: 'Your friend made smoothies. "They\'re so healthy!" The smoothie is HUGE.',
  companionIntro: "Smoothies can be carb bombs. That fruit adds up fast.",
  foods: [
    { name: 'Full smoothie', carbs: 55, desc: 'Banana, mango, juice, honey. Tastes amazing. Carb bomb.', speed: 'fast' },
    { name: 'Half smoothie + water', carbs: 28, desc: 'Half the smoothie and switch to water.', speed: 'fast' },
    { name: 'Make your own (berries + milk)', carbs: 20, desc: 'Just berries and milk. Much lower carbs.', speed: 'fast' }
  ]
});

// Tier 3 meals
registerMealEvent('restaurant-no-info', 'Restaurant — No Nutrition Info', 3, {
  scene: 'Family dinner at a local restaurant. No nutrition info anywhere. Time to estimate.',
  companionIntro: "No labels. Pure estimation. Use what you've learned.",
  foods: [
    { name: 'Pasta dish', carbs: 55, desc: 'Looks like about 1.5 cups of pasta with sauce.', speed: 'slow' },
    { name: 'Grilled chicken + rice', carbs: 45, desc: 'Chicken with what looks like a cup of rice.', speed: 'slow' },
    { name: 'Burger with fries', carbs: 60, desc: 'Standard burger on a bun with a side of fries.', speed: 'slow' }
  ],
  result: "Restaurant estimation is a real-world skill. Close enough is good enough."
}, 'portion-estimation');

registerMealEvent('cultural-feast', 'Cultural Feast', 3, {
  scene: 'A celebration meal with dishes you might not have tried before.',
  foods: [
    { name: 'Butter chicken + naan', carbs: 55, desc: 'Rich curry with a piece of naan bread.', speed: 'slow' },
    { name: 'Biryani', carbs: 50, desc: 'Fragrant rice dish with spices and meat.', speed: 'slow' },
    { name: 'Perogies + salad', carbs: 45, desc: 'Five potato and cheese perogies with sour cream.', speed: 'slow' }
  ],
  result: "Every cuisine is manageable. It's all about breaking down the carbs on the plate."
});

registerMealEvent('cook-own', 'Cook Your Own Meal', 3, {
  scene: 'You\'re making dinner tonight. You get to choose every ingredient.',
  companionIntro: "Cooking gives you the most control. You know exactly what's in it.",
  foods: [
    { name: 'Stir-fry + rice', carbs: 50, desc: 'Chicken, veggies, and a cup of rice. You measured everything.', speed: 'slow' },
    { name: 'Omelette + toast', carbs: 20, desc: 'Eggs with cheese and veggies, two slices of toast.', speed: 'slow' },
    { name: 'Pasta with homemade sauce', carbs: 55, desc: 'You made the sauce from scratch. Pasta is the carb source.', speed: 'slow' }
  ]
});

registerMealEvent('buffet', 'The Buffet', 3, {
  scene: 'All-you-can-eat buffet. The options are overwhelming.',
  companionIntro: "Buffets are tricky. Portion control matters more than ever.",
  foods: [
    { name: 'Moderate plate', carbs: 45, desc: 'A reasonable selection. You resisted going back for seconds.', speed: 'slow' },
    { name: 'Heavy plate', carbs: 70, desc: 'You loaded up. It happens. Dose accordingly.', speed: 'slow' },
    { name: 'Protein-focused plate', carbs: 25, desc: 'Mostly meat and veggies, small portion of rice.', speed: 'slow' }
  ]
});

registerMealEvent('not-hungry', 'Eating When You Don\'t Want To', 3, {
  scene: 'You\'re not hungry at all. But your BG is 5.2 and trending down. You need to eat.',
  companionIntro: "Sometimes eating is medicine. Not appetite.",
  foods: [
    { name: 'Crackers and cheese', carbs: 15, desc: 'Small, easy, quick. Gets the job done.', speed: 'slow' },
    { name: 'Glass of milk', carbs: 12, desc: 'Liquid is easier when you don\'t feel like eating.', speed: 'fast' },
    { name: 'Banana', carbs: 27, desc: 'Quick, portable, effective.', speed: 'fast' }
  ]
});

// More Tier 1 meals
registerMealEvent('yogurt-bowl', 'Yogurt Bowl', 1, {
  scene: 'A yogurt bowl with toppings set out on the counter.',
  companionIntro: "Plain yogurt has some carbs from milk sugar, and the toppings add more.",
  foods: [
    { name: 'Plain yogurt + granola + berries', carbs: 30, desc: 'Protein-heavy base plus crunchy granola.', speed: 'slow' },
    { name: 'Plain yogurt + just berries', carbs: 18, desc: 'Lower carb, still tasty.', speed: 'slow' },
    { name: 'Flavored yogurt (peach)', carbs: 28, desc: 'Flavored yogurts have added sugar. Read the label.', speed: 'fast' }
  ]
});

registerMealEvent('hotdog', 'Hot Dog Lunch', 1, {
  scene: 'Classic hot dog lunch at a cookout.',
  foods: [
    { name: 'Hot dog + bun + chips', carbs: 45, desc: 'Bun and chips are where the carbs live.', speed: 'fast' },
    { name: 'Hot dog + bun only', carbs: 27, desc: 'Skip the chips, keep it simple.', speed: 'fast' },
    { name: 'Hot dog on a lettuce wrap', carbs: 5,  desc: 'Low-carb option when the bun isn\'t essential.', speed: 'slow' }
  ]
});

registerMealEvent('chicken-rice', 'Chicken and Rice', 1, {
  scene: 'A home-cooked plate of chicken with rice and vegetables.',
  companionIntro: "Rice is dense \u2014 1/2 cup of cooked rice is about 22g.",
  foods: [
    { name: '1 cup rice + chicken + veggies', carbs: 45, desc: 'A full cup of rice is pretty carb-heavy.', speed: 'slow' },
    { name: '1/2 cup rice + extra chicken', carbs: 22, desc: 'More protein, less starch.', speed: 'slow' },
    { name: 'Just chicken + veggies', carbs: 8,  desc: 'Skip the rice entirely.', speed: 'slow' }
  ]
});

// More Tier 2 meals
registerMealEvent('movie-snacks', 'Movie Theater', 2, {
  scene: 'The previews are starting. Someone hands you a shared bag of popcorn.',
  companionIntro: "Popcorn is sneaky \u2014 it looks like air but it\u2019s a lot of carbs.",
  foods: [
    { name: 'Large popcorn + soda', carbs: 85, desc: 'Butter popcorn and a sugary drink. Lots of carbs.', speed: 'fast' },
    { name: 'Medium popcorn + water', carbs: 45, desc: 'Skip the soda, go easier on the popcorn.', speed: 'fast' },
    { name: 'Share popcorn + diet soda', carbs: 25, desc: 'Small portion, no added sugar in the drink.', speed: 'fast' }
  ]
});

registerMealEvent('pasta-night', 'Pasta Night', 2, {
  scene: 'Spaghetti with meat sauce. Easy dinner. Hard carbs to count.',
  companionIntro: "Pasta is one of the trickiest things \u2014 portion size deceives everyone.",
  foods: [
    { name: 'Big plate (~2 cups pasta)', carbs: 80, desc: 'Piled high. That\u2019s a lot of noodles.', speed: 'slow' },
    { name: 'Normal plate (~1 cup pasta)', carbs: 40, desc: 'Average portion. Easy to underestimate.', speed: 'slow' },
    { name: 'Half pasta + extra salad', carbs: 22, desc: 'Less pasta, bigger salad on the side.', speed: 'slow' }
  ]
}, 'estimating-carbs');

// More Tier 3 meals
registerMealEvent('ice-cream-trip', 'Ice Cream Trip', 3, {
  scene: 'Summer evening. The ice cream shop. Long line.',
  companionIntro: "Ice cream has a lot of fat \u2014 it slows the sugar absorption. The BG spike comes later.",
  foods: [
    { name: 'Large sundae + toppings', carbs: 65, desc: 'All the fixings. Delicious. Very carby.', speed: 'slow' },
    { name: 'Single scoop in a cone', carbs: 30, desc: 'Classic. The cone adds about 5g.', speed: 'slow' },
    { name: 'Single scoop in a cup', carbs: 22, desc: 'Skip the cone, save some carbs.', speed: 'slow' }
  ]
});

registerMealEvent('thanksgiving', 'Thanksgiving Dinner', 3, {
  scene: 'A massive holiday meal. Turkey, stuffing, mashed potatoes, gravy, cranberry sauce, rolls, pie. All of it.',
  companionIntro: "Holiday meals are the hardest \u2014 lots of items, long meal, dessert later. Take it in pieces.",
  foods: [
    { name: 'Full plate of everything + pie', carbs: 110, desc: 'The whole experience. Big dose needed.', speed: 'slow' },
    { name: 'Moderate plate, pie for later', carbs: 65, desc: 'Split it up \u2014 dose for now, dose again for pie.', speed: 'slow' },
    { name: 'Protein-focused + small portions', carbs: 35, desc: 'Turkey and veggies mostly, small taste of the rest.', speed: 'slow' }
  ]
}, 'restaurant-carbs');

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
    { id: 'explain', text: '"I\'m checking my blood sugar. I have Type 1 Diabetes."', conf: 5, response: 'They listen carefully. "That\'s a lot to deal with. You\'re kind of badass."', companionSays: 'Honest and direct. Well done.' },
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
    { id: 'teach', text: '"Absolutely! Here\'s what to do..." (Teach the 15-15 rule)', conf: 5, response: 'You walk them through it. They practice pretending to hand you a juice box. You both laugh, but they\'re serious about remembering.', companionSays: 'You just taught someone something that could matter a lot. That\'s real friendship.' },
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
    { id: 'explain', text: '"Type 1 is different from Type 2. My immune system destroyed the cells that make insulin. No diet can fix that."', conf: 5, response: 'They look a bit embarrassed but nod. "Oh, I didn\'t know there were different types."', companionSays: 'Handled with grace. Not everyone knows the difference — and now one more person does.' },
    { id: 'diplomatic', text: '"Thanks, I\'ll ask my doctor about that."', conf: 3, response: 'They feel heard, you didn\'t have to argue. Win-win.', companionSays: 'The diplomatic deflection. A classic.' },
    { id: 'smile', text: 'Smile and change the subject.', conf: 3, response: 'You redirect the conversation smoothly. You don\'t need to educate everyone.', companionSays: 'You don\'t owe anyone a biology lesson.' }
  ], 'what-is-t1d'
);

registerSocialEvent('sleepover', 'The Sleepover Dilemma', 2,
  'You\'re invited to a sleepover. You need to figure out: what to pack, what to tell the host\'s parents, and how to handle a midnight BG check in a shared room.',
  [
    { id: 'prepared', text: 'Tell the parents in advance and pack everything you need', conf: 5, response: 'The host\'s parents are great about it. They even ask what snacks to have on hand. The sleepover goes smoothly.', companionSays: 'Preparation is power. And you still had a great time.' },
    { id: 'wing-it', text: 'Pack your supplies but don\'t mention it unless necessary', conf: 3, response: 'It works out, but you have to explain at midnight when you need to check your BG. A little awkward, but your friend is cool about it.', companionSays: 'It worked, but next time a heads-up might make things easier.' },
    { id: 'skip', text: 'Decide to skip it this time', conf: 3, response: 'You stay home. It\'s a valid choice, but you wonder if you would have been fine.', companionSays: 'Sometimes you\'re not ready, and that\'s okay. There\'ll be more sleepovers.' }
  ], 'packing-trip'
);

registerSocialEvent('sub-teacher', 'The Substitute Teacher', 2,
  'A substitute teacher sees you eating a snack during class. "Put that away! No food in class."',
  [
    { id: 'explain', text: '"I have Type 1 Diabetes. I need to eat when my blood sugar is low. I have a medical note."', conf: 5, response: 'The sub looks uncertain but backs down. "Oh. Okay, carry on." Later, your regular teacher confirms everything is fine.', companionSays: 'That took courage. Speaking up for yourself when someone pushes back — that\'s a real skill.' },
    { id: 'nurse', text: '"Can I go to the nurse? They can explain."', conf: 5, response: 'The nurse handles it. The sub apologizes later. "I had no idea. Sorry about that."', companionSays: 'Smart move. Let the system work for you.' },
    { id: 'comply', text: 'Put the snack away (and feel frustrated)', conf: 3, response: 'You put it away, but your BG drops. You raise your hand to go to the nurse. It works out, but it shouldn\'t have been this hard.', companionSays: 'That wasn\'t fair. But you handled it — and next time you\'ll know what to say.' }
  ]
);

registerSocialEvent('left-out', 'Feeling Left Out', 2,
  'Your friends are planning a big hike. You\'re anxious about managing BG during hours of walking with no shade and limited food options.',
  [
    { id: 'go-prepared', text: 'Go, but prepare carefully — extra snacks, reduced insulin, frequent checks', conf: 5, response: 'The hike goes great. You stop once for a snack, and nobody minds. You feel proud for not letting T1D stop you.', companionSays: 'You faced the fear AND had a good time. That\'s the whole game right there.' },
    { id: 'modify', text: 'Suggest a shorter hike that works for everyone', conf: 5, response: 'Your friends are totally fine with a shorter route. Turns out, a couple of them were nervous about the long one too.', companionSays: 'Advocating for what you need often helps everyone.' },
    { id: 'skip', text: 'Sit this one out', conf: 3, response: 'You stay home. It\'s okay, but you feel a little down about it.', companionSays: 'Missing out is hard. But not every outing has to be yours.' }
  ], 'adjusting-exercise'
);

registerSocialEvent('food-police', '"Are You Allowed to Eat That?"', 2,
  'Someone watches you eat a cookie and says: "Are you allowed to eat that? I thought diabetics couldn\'t have sugar."',
  [
    { id: 'educate', text: '"People with T1D can eat anything — we just take insulin for it."', conf: 5, response: '"Oh! I didn\'t know that. Sorry for assuming." They look genuinely surprised and a little sheepish.', companionSays: 'One more person who gets it now. You\'re changing minds one cookie at a time.' },
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
    { id: 'let-go', text: 'Let it go. You know it wasn\'t meant to be cruel.', conf: 3, response: 'You move on. It stings a little, but you know who you are.', companionSays: 'Your call. Just know it\'s always okay to speak up if something bothers you.' }
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
    { id: 'yes-cake', text: '"Yeah, I can eat cake \u2014 I just dose insulin for it."', conf: 5, response: 'Their eyes widen. "Oh, cool! I didn\'t know that." They look relieved.', companionSays: 'Now they know \u2014 no food is off limits, you just plan for it.' },
    { id: 'thanks-ask', text: '"Thanks for thinking of me. I\'ll be there."', conf: 4, response: 'They smile. "Can\'t wait!"', companionSays: 'Simple. Warm. You didn\'t have to explain anything unless you wanted to.' },
    { id: 'ask-menu', text: '"What food will be there? I just like to know ahead."', conf: 3, response: 'They list it off. You mentally add up the likely carbs. Pizza, cake, soda, chips.', companionSays: 'Smart \u2014 knowing the menu ahead of time is a real advantage.' }
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
    { id: 'fix', text: 'Take a breath and give a correction dose.', conf: 5, response: 'You correct and move on. The number will come down. You know what to do.', companionSays: 'That\'s resilience right there. Feel it AND fix it.' },
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
    { id: 'feel', text: 'Let yourself feel it.', conf: 3, response: 'The sadness washes over you. It\'s real. You sit with it for a moment, and then it passes — not gone, but manageable.', companionSays: 'I\'m not going to tell you to look on the bright side. This is a real loss, and you\'re allowed to grieve it.' },
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
  'You are so tired. Tired of checking. Tired of counting. Tired of this being your life every single day. You want to skip everything just for one day.',
  [
    { id: 'vent', text: 'Tell someone how you\'re feeling.', conf: 5, response: 'You talk to someone you trust. They listen. They don\'t try to fix it — they just hear you. It helps more than you expected.', companionSays: 'Burnout is real, it\'s normal, and talking about it is the first step. You\'re not alone in this.' },
    { id: 'skip', text: 'Skip a check. Just this once.', conf: 0, response: 'You skip one check. The world doesn\'t end. But the BG drifts a bit without you noticing. Tomorrow, you get back to it.', companionSays: 'I get it. Just... come back to it when you\'re ready. The routine is there when you need it.' },
    { id: 'rest', text: 'Keep managing, but give yourself permission to be tired.', conf: 5, response: 'You do the checks, take the insulin, count the carbs — but you also acknowledge that it\'s exhausting. And that\'s enough.', companionSays: 'You can be tired AND capable at the same time. Both things are true.' }
  ], 'burnout-real'
);

registerEmotionalEvent('pride', 'Pride', 3,
  'End of a really tough day. Multiple curveballs. But you managed every single one. Your BG is in range. Your energy is good. You did this.',
  [
    { id: 'own-it', text: 'Let yourself feel proud.', conf: 10, response: 'You sit with the feeling. Not arrogance — just quiet, earned pride. You did a hard thing, and you did it well.', companionSays: 'You handled that whole day. No help needed. That\'s real.' },
    { id: 'share', text: 'Tell someone about your day.', conf: 8, response: 'You share the highlights. They might not fully understand, but they can see it in your face — you\'re proud of yourself.', companionSays: 'Share the wins. People want to celebrate with you.' }
  ]
);

registerEmotionalEvent('why-me', 'Why Me?', 2,
  'A quiet moment lying on your bed. The question sneaks up like it always does: why does this have to be my life? What did I do?',
  [
    { id: 'nothing', text: '"Nothing. I didn\'t do anything. It just happened."', conf: 5, response: 'You let that truth settle. It wasn\'t caused by anything you ate or didn\'t do. That\'s a strange kind of relief.', companionSays: 'You didn\'t cause this. Nothing you ate, nothing you did. T1D is autoimmune \u2014 your immune system made a mistake.' },
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
          ? 'New site is in a well-rested spot. Rotating prevents scar tissue and keeps absorption consistent.'
          : 'It works, but using the same area too often can cause scar tissue. Try to move further next time.') + '</p>';
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

const miniGameSchedule = {
  2: { am: { name: 'Label Reader',      desc: 'Read a Canadian Nutrition Facts label. No rush. Accuracy is everything.' },
       pm: { name: 'Exercise Balance',   desc: 'Keep exercising, but watch your BG. Pause to snack when you need to.' } },
  3: { am: { name: 'Dose Calculator',   desc: 'Calculate the right insulin dose from carbs and current BG.' },
       pm: { name: 'Pack Your Bag',     desc: 'Heading to school. Pack everything you need for a day out.' } },
  4: { am: { name: 'Carb Counter',      desc: 'Restaurant-style plate. No labels, just instinct.' },
       pm: { name: 'Glucose Roller',    desc: 'Keep the ball in the green zone. Feel how BG has momentum.' } },
  5: { am: { name: 'Portion Estimator', desc: 'Look at the plate and estimate the total carbs. Your eyes are your tools.' },
       pm: { name: 'Sick Day Protocol', desc: 'You\'re sick and BG is high. Step through the protocol correctly.' } },
  6: { am: { name: 'Label Reader',      desc: 'Trickier label. More questions. Take your time.' },
       pm: { name: 'Pack Your Bag',     desc: 'Going on a trip. More supplies, more to remember.' } },
  7: { am: { name: 'Dose Calculator',   desc: 'Complex scenario — odd carb counts, active insulin on board, BG correction needed.' },
       pm: { name: 'Exercise Balance',  desc: 'Sports tournament. Longer session, harder to stay in range.' } }
};

// Mini-game Beta Cells (awarded on first play of each game type)
const miniGameBetaCells = {
  'Carb Counter':    'carbs-everywhere',
  'Dose Calculator': 'what-is-bolus',
  'Treat-the-Low':   'fifteen-fifteen-rule',
  'Label Reader':    'reading-labels',
  'Exercise Balance':'adjusting-exercise',
  'Pack Your Bag':   'packing-trip',
  'Glucose Roller':  'what-is-basal',
  'Portion Estimator':'portion-estimation',
  'Sick Day Protocol':'sick-day-management'
};

// ---- Generic framework ----
// Each mini-game exposes: play(opts, onComplete)
// opts: { tier, currentBG, carbsActual?, ... }
// onComplete({ stars: 0-3, summary: string })
const MiniGames = {};

// Render a panel inside the passage container (reuses the narrative area)
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

// Star rating from difference: [perfect, good, ok]
function starsFromDiff(diff, thresholds) {
  if (diff <= thresholds[0]) return 3;
  if (diff <= thresholds[1]) return 2;
  if (diff <= thresholds[2]) return 1;
  return 0;
}

// ---- Carb Counter ----
// Show N foods, player enters total estimated carbs.
MiniGames['Carb Counter'] = {
  play: function(opts, onComplete) {
    // AUDIO: Play mini-game start jingle
    const tier = opts.tier || 1;
    // Canada Food Guide–aligned basic foods with portion sizes
    const pool = [
      { emoji: '🍎', name: 'Apple',         portion: '1 medium',      carbs: 19 },
      { emoji: '🍌', name: 'Banana',        portion: '1 medium',      carbs: 27 },
      { emoji: '🥛', name: 'Milk',          portion: '250 mL',        carbs: 13 },
      { emoji: '🥯', name: 'Bagel',         portion: '1 plain',       carbs: 48 },
      { emoji: '🍞', name: 'Bread',         portion: '1 slice',       carbs: 15 },
      { emoji: '🍚', name: 'White rice',    portion: '1/2 cup cooked',carbs: 22 },
      { emoji: '🍝', name: 'Pasta',         portion: '1 cup cooked',  carbs: 40 },
      { emoji: '🥔', name: 'Potato',        portion: '1 medium',      carbs: 26 },
      { emoji: '🥕', name: 'Carrots',       portion: '1 cup',         carbs: 12 },
      { emoji: '🧀', name: 'Cheddar',       portion: '1 slice',       carbs: 1  },
      { emoji: '🥜', name: 'Peanut butter', portion: '2 tbsp',        carbs: 6  },
      { emoji: '🥚', name: 'Eggs',          portion: '2 large',       carbs: 1  },
      { emoji: '🍇', name: 'Grapes',        portion: '1 cup',         carbs: 16 },
      { emoji: '🍓', name: 'Strawberries',  portion: '1 cup',         carbs: 11 },
      { emoji: '🥣', name: 'Oatmeal',       portion: '1/2 cup cooked',carbs: 14 },
      { emoji: '🥨', name: 'Pretzels',      portion: '1 oz',          carbs: 23 },
      { emoji: '🍪', name: 'Cookies',       portion: '2 small',       carbs: 20 },
      { emoji: '🥤', name: 'Juice',         portion: '250 mL',        carbs: 28 },
      { emoji: '🌮', name: 'Corn tortilla', portion: '1 small',       carbs: 12 },
      { emoji: '🥦', name: 'Broccoli',      portion: '1 cup',         carbs: 6  }
    ];
    const n = tier === 1 ? 3 : tier === 2 ? 4 : 5;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, n);
    const total = shuffled.reduce((sum, f) => sum + f.carbs, 0);

    renderMGPanel(
      '<h2>🥪 Carb Counter</h2>' +
      '<p class="mg-subtitle">Add up the total carbs on your plate.</p>' +
      '<details class="mg-legend" open>' +
        '<summary><strong>📖 Portion size reference</strong> — rough gram ranges you can memorize</summary>' +
        '<div class="mg-legend-grid">' +
          '<div><strong>🍎 Fruit</strong><br>' +
            '• Small (berries, ½ banana) ~10g<br>' +
            '• Medium (apple, orange) ~15–20g<br>' +
            '• Large (big banana, mango) ~25–30g</div>' +
          '<div><strong>🍞 Grains &amp; starches</strong><br>' +
            '• 1 slice bread ~15g<br>' +
            '• ½ cup rice / pasta / potato ~20–22g<br>' +
            '• 1 cup rice / pasta ~40–45g<br>' +
            '• 1 bagel ~45–50g</div>' +
          '<div><strong>🥛 Dairy</strong><br>' +
            '• 1 cup milk ~12g<br>' +
            '• ¾ cup plain yogurt ~12g<br>' +
            '• ¾ cup flavoured yogurt ~20–30g<br>' +
            '• Cheese ~0–1g</div>' +
          '<div><strong>🥦 Non-starchy veg</strong><br>' +
            '• 1 cup raw ~5g<br>' +
            '• 1 cup cooked ~10g<br>' +
            '• Leafy greens ~free</div>' +
          '<div><strong>🥜 Protein &amp; fats</strong><br>' +
            '• Meat, eggs, fish ~0g<br>' +
            '• Nuts &amp; nut butter ~5–8g per 2 tbsp<br>' +
            '• Beans/lentils ~20g per cup</div>' +
          '<div><strong>🍪 Sweets &amp; drinks</strong><br>' +
            '• 1 small cookie ~8–10g<br>' +
            '• Juice box (250 mL) ~25–30g<br>' +
            '• Regular pop (can) ~35–40g</div>' +
        '</div>' +
      '</details>' +
      shuffled.map(f =>
        '<div class="mg-food-row">' +
          '<div><span class="mg-food-emoji">' + f.emoji + '</span>' +
          '<span class="mg-food-name">' + f.name + '</span></div>' +
          '<span class="mg-food-portion">' + f.portion + '</span>' +
        '</div>'
      ).join('') +
      '<div class="mg-estimate-row">' +
        '<label>Total carbs:</label>' +
        '<input type="number" id="mg-carb-input" placeholder="0" min="0" max="300">' +
        '<span>g</span>' +
        '<button class="mg-action-btn" id="mg-submit">Check</button>' +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(() => {
      const input = document.getElementById('mg-carb-input');
      if (input) input.focus();
      const submit = () => {
        const guess = parseInt(input.value, 10);
        if (isNaN(guess)) { input.focus(); return; }
        const diff = Math.abs(guess - total);
        const stars = starsFromDiff(diff, [5, 10, 20]);
        const cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        const breakdown = shuffled.map(f => f.name + ' ' + f.carbs + 'g').join(', ');
        const headline = stars === 3 ? 'Spot on!' :
                         stars === 2 ? 'Close!' :
                         stars === 1 ? 'In the ballpark.' :
                                       'Off by quite a bit.';
        const msg = headline + ' Actual: <strong>' + total + 'g</strong> (you said ' + guess + 'g, off by ' + diff + 'g).' +
                    '<br><small style="color:var(--text-secondary);">Breakdown: ' + breakdown + '.</small>';
        const resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', () => onComplete({ stars: stars, summary: msg }));
      };
      document.getElementById('mg-submit').addEventListener('click', submit);
      input.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
    }, 30);
  }
};

// ---- Dose Calculator ----
// Show a meal + current BG; player picks insulin units via slider.
MiniGames['Dose Calculator'] = {
  play: function(opts, onComplete) {
    // AUDIO: Play mini-game start jingle
    const meals = [
      { name: 'Ham sandwich + apple',  carbs: 45, emoji: '🥪' },
      { name: 'Slice of pizza + salad',carbs: 35, emoji: '🍕' },
      { name: 'Cereal with milk',      carbs: 50, emoji: '🥣' },
      { name: 'Chicken burrito',       carbs: 60, emoji: '🌯' },
      { name: 'Mac and cheese',        carbs: 40, emoji: '🧀' },
      { name: 'Rice + stir-fry',       carbs: 55, emoji: '🍚' },
      { name: 'Spaghetti with sauce',  carbs: 65, emoji: '🍝' },
      { name: 'Two pancakes + syrup',  carbs: 48, emoji: '🥞' }
    ];
    const meal = meals[Math.floor(Math.random() * meals.length)];
    const bg = opts.currentBG || state.bg.current;
    const correct = recommendedDose(meal.carbs, bg);
    // Display the breakdown for learning
    const mealUnits = meal.carbs / BGConfig.carbRatio;
    const correctionUnits = bg > BGConfig.correctionTarget ? (bg - BGConfig.correctionTarget) / BGConfig.correctionFactor : 0;

    renderMGPanel(
      '<h2>💉 Dose Calculator</h2>' +
      '<p class="mg-subtitle">Calculate your mealtime insulin dose.</p>' +
      '<div class="mg-food-row">' +
        '<div><span class="mg-food-emoji">' + meal.emoji + '</span><span class="mg-food-name">' + meal.name + '</span></div>' +
        '<span class="mg-food-portion">' + meal.carbs + 'g carbs</span>' +
      '</div>' +
      '<div class="mg-food-row">' +
        '<div><span class="mg-food-emoji">🩸</span><span class="mg-food-name">Current BG</span></div>' +
        '<span class="mg-food-portion">' + bg.toFixed(1) + ' mmol/L</span>' +
      '</div>' +
      '<div style="padding:14px;background:white;border-radius:8px;border:2px solid var(--border);margin:16px 0;font-size:14px;color:var(--text-secondary);line-height:1.7;">' +
        '<strong>Your ratios:</strong><br>' +
        '• 1 unit insulin per <strong>' + BGConfig.carbRatio + 'g</strong> carbs<br>' +
        '• Target BG: <strong>' + BGConfig.correctionTarget + '</strong> mmol/L<br>' +
        '• 1 unit drops BG by <strong>' + BGConfig.correctionFactor + '</strong> mmol/L' +
      '</div>' +
      '<div class="mg-slider-row">' +
        '<label>Dose:</label>' +
        '<input type="range" id="mg-dose-slider" min="0" max="15" step="0.5">' +
        '<span class="mg-slider-value" id="mg-dose-val">0.0u</span>' +
      '</div>' +
      '<div style="text-align:center;margin-top:16px;">' +
        '<button class="mg-action-btn" id="mg-dose-submit">Deliver Dose</button>' +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(() => {
      const slider = document.getElementById('mg-dose-slider');
      const valEl  = document.getElementById('mg-dose-val');
      // Random starting offset so it's not pre-correct
      const offset = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.5);
      const start = Math.max(0, Math.min(15, Math.round((correct + offset) * 2) / 2));
      slider.value = start;
      valEl.textContent = parseFloat(slider.value).toFixed(1) + 'u';
      slider.addEventListener('input', () => { valEl.textContent = parseFloat(slider.value).toFixed(1) + 'u'; });
      document.getElementById('mg-dose-submit').addEventListener('click', () => {
        const chosen = parseFloat(slider.value);
        const diff = Math.abs(chosen - correct);
        const stars = starsFromDiff(diff, [0.5, 1.0, 2.0]);
        const cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        const headline = stars === 3 ? 'Perfect dose!' :
                         stars === 2 ? 'Very close.' :
                         stars === 1 ? 'In the ballpark.' :
                                       'Off by quite a bit.';
        const math = 'Meal: ' + meal.carbs + 'g ÷ ' + BGConfig.carbRatio + ' = ' + mealUnits.toFixed(1) + 'u' +
                     (correctionUnits > 0 ? ' + correction (' + correctionUnits.toFixed(1) + 'u)' : '') +
                     ' → <strong>' + correct + 'u</strong>';
        const warn = chosen > correct + 1 ? ' ⚠️ Too much — BG may go low later.' :
                     chosen < correct - 1 ? ' ⚠️ Too little — BG will run high.' : '';
        const msg = headline + '<br>' + math + warn;
        const resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', () => {
          // Apply the chosen dose (and the meal)
          eatFood(meal.carbs, 'slow');
          doseInsulin(chosen);
          state.score.mealsManaged++;
          onComplete({ stars: stars, summary: msg });
        });
      });
    }, 30);
  }
};

// ---- Treat-the-Low ----
// Player picks the right fast-acting carb to treat a low BG.
MiniGames['Treat-the-Low'] = {
  play: function(opts, onComplete) {
    // AUDIO: Play low-BG alarm tone
    const bg = opts.currentBG && opts.currentBG < 4 ? opts.currentBG : (3.2 + Math.random() * 0.6);
    const options = [
      { emoji: '🧃', name: 'Juice box',         carbs: 15, ideal: true },
      { emoji: '🍬', name: '4 glucose tabs',    carbs: 16, ideal: true },
      { emoji: '🥤', name: 'Regular cola (sm)', carbs: 15, ideal: true },
      { emoji: '🍯', name: '1 tbsp honey',      carbs: 17, ideal: true },
      { emoji: '🍫', name: 'Chocolate bar',     carbs: 25, ideal: false, reason: 'Fat slows the sugar absorption — too slow for a low.' },
      { emoji: '🥜', name: 'Handful of peanuts',carbs: 5,  ideal: false, reason: 'Mostly fat and protein. Barely any fast carbs.' },
      { emoji: '🧀', name: 'Cheese stick',      carbs: 1,  ideal: false, reason: 'Almost no carbs — won\'t raise BG.' },
      { emoji: '🍎', name: 'Whole apple',       carbs: 19, ideal: false, reason: 'Fibre slows it down. Fine as a snack, not ideal for a low.' },
      { emoji: '🍦', name: 'Ice cream',         carbs: 20, ideal: false, reason: 'Fat in the ice cream slows the sugar absorption.' }
    ];
    // Pick 2 ideal + 2 non-ideal, shuffled
    const idealPicks = options.filter(o => o.ideal).sort(() => Math.random() - 0.5).slice(0, 2);
    const nonPicks   = options.filter(o => !o.ideal).sort(() => Math.random() - 0.5).slice(0, 2);
    const choices = idealPicks.concat(nonPicks).sort(() => Math.random() - 0.5);

    renderMGPanel(
      '<h2>⚠️ Treat the Low</h2>' +
      '<p class="mg-subtitle">BG: <strong style="color:var(--zone-red);font-size:22px;">' + bg.toFixed(1) + '</strong> — you feel shaky, sweaty, hungry.</p>' +
      '<p style="margin-bottom:12px;">Pick the best thing to bring BG up fast. <strong>15-15 rule:</strong> eat 15g of fast carbs, wait 15 minutes, recheck.</p>' +
      '<div class="mg-options-grid">' +
        choices.map((c, i) =>
          '<div class="mg-option-card" data-idx="' + i + '">' +
            '<span class="mg-opt-emoji">' + c.emoji + '</span>' +
            '<span class="mg-opt-name">' + c.name + '</span>' +
            '<span class="mg-opt-carbs">~' + c.carbs + 'g carbs</span>' +
          '</div>'
        ).join('') +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    // Update state BG to the shown value for screen effects
    state.bg.current = Math.round(bg * 10) / 10;
    state.bg.trend = 'falling';
    notify();

    setTimeout(() => {
      document.querySelectorAll('.mg-option-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.idx, 10);
          const pick = choices[idx];
          document.querySelectorAll('.mg-option-card').forEach(c => c.style.pointerEvents = 'none');
          card.classList.add('selected');
          let stars, cls, msg;
          if (pick.ideal) {
            stars = 3; cls = 'good';
            msg = '✓ Good call. <strong>' + pick.name + '</strong> is ~15g of fast-acting carbs. Wait 15 minutes and recheck before eating anything else.';
          } else {
            stars = 0; cls = 'bad';
            msg = '✗ ' + pick.reason + ' You still need a fast-acting carb.';
          }
          const resDiv = document.getElementById('mg-result');
          resDiv.className = 'mg-result ' + cls;
          resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
            (stars === 3 ? '⭐⭐⭐' : '❌') + '</div>' + msg +
            '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
          document.getElementById('mg-continue').addEventListener('click', () => {
            if (pick.ideal) {
              eatFood(pick.carbs, 'fast');
              // Simulated immediate rescue
              state.bg.current = Math.max(state.bg.current, 5.8);
              state.bg.trend = 'rising';
              notify();
            }
            onComplete({ stars: stars, summary: msg });
          });
        });
      });
    }, 30);
  }
};

// ---- Label Reader ----
// Canadian Nutrition Facts label reading. No timer. Accuracy only.
MiniGames['Label Reader'] = {
  play: function(opts, onComplete) {
    var tier = opts.tier || 1;
    var labels = [
      { product: '🥣 Oatmeal', servingSize: '1 packet (43g)', servingsPerPkg: 8, totalCarbs: 27, fibre: 3, sugar: 12, calories: 160 },
      { product: '🥤 Apple Juice', servingSize: '250 mL', servingsPerPkg: 4, totalCarbs: 28, fibre: 0, sugar: 24, calories: 110 },
      { product: '🍪 Chocolate Chip Cookies', servingSize: '2 cookies (30g)', servingsPerPkg: 10, totalCarbs: 22, fibre: 1, sugar: 11, calories: 140 },
      { product: '🥜 Peanut Butter', servingSize: '1 tbsp (15g)', servingsPerPkg: 30, totalCarbs: 3, fibre: 1, sugar: 1, calories: 90 },
      { product: '🧃 Fruit Snacks', servingSize: '1 pouch (22g)', servingsPerPkg: 6, totalCarbs: 18, fibre: 0, sugar: 11, calories: 80 },
      { product: '🥛 Chocolate Milk', servingSize: '250 mL', servingsPerPkg: 2, totalCarbs: 26, fibre: 0, sugar: 24, calories: 160 },
      { product: '🍞 Whole Wheat Bread', servingSize: '1 slice (38g)', servingsPerPkg: 20, totalCarbs: 18, fibre: 3, sugar: 2, calories: 90 },
      { product: '🥫 Tomato Soup', servingSize: '250 mL', servingsPerPkg: 2, totalCarbs: 20, fibre: 2, sugar: 12, calories: 100 }
    ];
    var label = labels[Math.floor(Math.random() * labels.length)];
    var netCarbs = label.totalCarbs - label.fibre;
    var wholePackageCarbs = label.totalCarbs * label.servingsPerPkg;

    var questions;
    if (tier <= 1) {
      questions = [
        { q: 'How many total carbohydrates per serving?', answer: label.totalCarbs, unit: 'g', explain: 'Total carbohydrates is the number you need for dosing.' },
        { q: 'What is the serving size?', answer: label.servingSize, type: 'text', explain: 'Always check serving size first. You might eat more or less than one serving.' },
        { q: 'How many servings in the package?', answer: label.servingsPerPkg, unit: '', explain: 'If you eat the whole thing, multiply carbs by this number.' }
      ];
    } else if (tier <= 2) {
      questions = [
        { q: 'How many total carbohydrates per serving?', answer: label.totalCarbs, unit: 'g', explain: 'Total carbohydrates is the number you need for dosing.' },
        { q: 'How many servings in the package?', answer: label.servingsPerPkg, unit: '', explain: 'If you eat the whole thing, multiply carbs by this number.' },
        { q: 'How many total carbs if you eat the WHOLE package?', answer: wholePackageCarbs, unit: 'g', explain: 'Multiply carbs per serving by number of servings. A common trap!' },
        { q: 'How many grams of fibre per serving?', answer: label.fibre, unit: 'g', explain: 'Fibre can be subtracted from total carbs for "net carbs." It does not raise BG.' }
      ];
    } else {
      questions = [
        { q: 'How many total carbohydrates per serving?', answer: label.totalCarbs, unit: 'g', explain: 'Total carbohydrates is the number you need for dosing.' },
        { q: 'How many total carbs if you eat the WHOLE package?', answer: wholePackageCarbs, unit: 'g', explain: 'Multiply carbs per serving by number of servings.' },
        { q: 'How many grams of fibre per serving?', answer: label.fibre, unit: 'g', explain: 'Fibre can be subtracted from total carbs for "net carbs."' },
        { q: 'What are the "net carbs" per serving? (total carbs minus fibre)', answer: netCarbs, unit: 'g', explain: 'Net carbs = total carbs - fibre. This is what actually raises your BG.' },
        { q: 'How many grams of sugar per serving?', answer: label.sugar, unit: 'g', explain: 'Sugar is part of total carbs. It tells you how fast the carbs might hit.' }
      ];
    }

    var currentQ = 0;
    var correct = 0;

    function renderLabel() {
      return '<div style="background:#fff;border:3px solid #000;padding:16px;border-radius:4px;max-width:280px;margin:0 auto 16px;font-family:Arial,sans-serif;color:#000;font-size:13px;line-height:1.4;">' +
        '<div style="font-size:18px;font-weight:bold;border-bottom:8px solid #000;padding-bottom:4px;">Nutrition Facts</div>' +
        '<div style="font-size:11px;border-bottom:1px solid #000;padding:2px 0;">Valeur nutritive</div>' +
        '<div style="border-bottom:1px solid #000;padding:4px 0;"><strong>Serving Size / Portion</strong> ' + label.servingSize + '</div>' +
        '<div style="border-bottom:4px solid #000;padding:4px 0;">Servings Per Container / Portions par contenant <strong>' + label.servingsPerPkg + '</strong></div>' +
        '<div style="border-bottom:1px solid #000;padding:3px 0;display:flex;justify-content:space-between;"><strong>Calories / Calories</strong><span><strong>' + label.calories + '</strong></span></div>' +
        '<div style="border-bottom:1px solid #000;padding:3px 0;display:flex;justify-content:space-between;font-weight:bold;">Total Carbohydrate / Glucides<span>' + label.totalCarbs + 'g</span></div>' +
        '<div style="border-bottom:1px solid #000;padding:3px 0;display:flex;justify-content:space-between;padding-left:16px;">Dietary Fibre / Fibres<span>' + label.fibre + 'g</span></div>' +
        '<div style="border-bottom:1px solid #000;padding:3px 0;display:flex;justify-content:space-between;padding-left:16px;">Sugars / Sucres<span>' + label.sugar + 'g</span></div>' +
        '</div>';
    }

    function showQuestion() {
      if (currentQ >= questions.length) {
        var missed = questions.length - correct;
        var stars = missed === 0 ? 3 : missed === 1 ? 2 : missed === 2 ? 1 : 0;
        var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        var headline = stars === 3 ? 'Perfect reading!' : stars === 2 ? 'Almost perfect.' : stars === 1 ? 'Room to improve.' : 'Keep practicing label reading.';
        var msg = headline + ' Got ' + correct + ' out of ' + questions.length + ' correct.';
        var resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', function() { onComplete({ stars: stars, summary: msg }); });
        return;
      }
      var qData = questions[currentQ];
      var qDiv = document.getElementById('mg-question');
      if (qData.type === 'text') {
        qDiv.innerHTML = '<p style="font-weight:bold;margin-bottom:8px;">' + qData.q + '</p>' +
          '<p style="color:var(--text-secondary);">Answer: <strong>' + qData.answer + '</strong></p>' +
          '<p style="font-size:13px;color:var(--text-secondary);margin-top:6px;">💡 ' + qData.explain + '</p>' +
          '<button class="mg-action-btn" id="mg-next-q">Next</button>';
        correct++;
        currentQ++;
        document.getElementById('mg-next-q').addEventListener('click', showQuestion);
      } else {
        qDiv.innerHTML = '<p style="font-weight:bold;margin-bottom:8px;">Q' + (currentQ + 1) + ': ' + qData.q + '</p>' +
          '<div class="mg-estimate-row"><input type="number" id="mg-label-input" placeholder="0" min="0" max="999"><span>' + qData.unit + '</span>' +
          '<button class="mg-action-btn" id="mg-label-submit">Answer</button></div>' +
          '<div id="mg-q-feedback"></div>';
        setTimeout(function() {
          var input = document.getElementById('mg-label-input');
          if (input) input.focus();
          var submit = function() {
            var val = parseInt(input.value, 10);
            if (isNaN(val)) { input.focus(); return; }
            var fb = document.getElementById('mg-q-feedback');
            if (val === qData.answer) {
              correct++;
              fb.innerHTML = '<p style="color:var(--zone-green);">✓ Correct!</p><p style="font-size:13px;color:var(--text-secondary);">💡 ' + qData.explain + '</p>';
            } else {
              fb.innerHTML = '<p style="color:var(--zone-red);">✗ The answer was <strong>' + qData.answer + qData.unit + '</strong>.</p><p style="font-size:13px;color:var(--text-secondary);">💡 ' + qData.explain + '</p>';
            }
            currentQ++;
            fb.innerHTML += '<button class="mg-action-btn" id="mg-next-q" style="margin-top:10px;">Next</button>';
            document.getElementById('mg-next-q').addEventListener('click', showQuestion);
          };
          document.getElementById('mg-label-submit').addEventListener('click', submit);
          input.addEventListener('keypress', function(e) { if (e.key === 'Enter') submit(); });
        }, 30);
      }
    }

    renderMGPanel(
      '<h2>🏷️ Label Reader</h2>' +
      '<p class="mg-subtitle">' + label.product + ' — Read the label carefully. No rush.</p>' +
      renderLabel() +
      '<div id="mg-question"></div>' +
      '<div id="mg-result"></div>'
    );
    setTimeout(showQuestion, 50);
  }
};

// ---- Exercise Balance ----
// BG drops during exercise. Decide when to pause and eat.
MiniGames['Exercise Balance'] = {
  play: function(opts, onComplete) {
    var startBG = opts.currentBG || state.bg.current;
    if (startBG < 5.5) startBG = 7.0;
    var bg = startBG;
    var exerciseSeconds = 0;
    var paused = false;
    var snacksUsed = 0;
    var wentLow = false;
    var finished = false;
    var targetSeconds = 60;
    var dropRate = 0.04 + (opts.tier || 1) * 0.01;

    renderMGPanel(
      '<h2>🏃 Exercise Balance</h2>' +
      '<p class="mg-subtitle">Keep exercising, but watch your BG. Pause to snack when you need to.</p>' +
      '<div style="text-align:center;margin:16px 0;">' +
        '<div style="font-size:48px;" id="mg-runner">🏃</div>' +
        '<div style="margin:8px 0;font-size:14px;">BG: <span id="mg-ex-bg" style="font-weight:bold;">' + bg.toFixed(1) + '</span> mmol/L</div>' +
        '<div style="background:var(--border);border-radius:8px;height:20px;overflow:hidden;margin:8px auto;max-width:300px;">' +
          '<div id="mg-ex-bar" style="height:100%;width:0%;background:var(--zone-green);transition:width 0.3s;"></div>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);" id="mg-ex-status">Exercise: 0/' + targetSeconds + 's</div>' +
      '</div>' +
      '<div style="text-align:center;margin:16px 0;">' +
        '<button class="mg-action-btn" id="mg-ex-snack">🍌 Eat a Snack (+15g carbs)</button>' +
      '</div>' +
      '<div style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:8px;">Exercise runs automatically. Eat a snack before BG drops below 4.0.</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(function() {
      var bgEl = document.getElementById('mg-ex-bg');
      var barEl = document.getElementById('mg-ex-bar');
      var statusEl = document.getElementById('mg-ex-status');
      var runnerEl = document.getElementById('mg-runner');
      var snackBtn = document.getElementById('mg-ex-snack');

      snackBtn.addEventListener('click', function() {
        if (finished) return;
        bg += 2.0;
        snacksUsed++;
        paused = true;
        runnerEl.textContent = '🧍';
        statusEl.textContent = 'Snacking... +15g carbs';
        setTimeout(function() {
          if (!finished) {
            paused = false;
            runnerEl.textContent = '🏃';
          }
        }, 2000);
      });

      var interval = setInterval(function() {
        if (finished) { clearInterval(interval); return; }
        if (!paused) {
          exerciseSeconds++;
          bg -= dropRate + (Math.random() * 0.01);
          bg = Math.round(bg * 10) / 10;
        }

        bgEl.textContent = bg.toFixed(1);
        bgEl.style.color = bg < 4.0 ? 'var(--zone-red)' : bg < 5.0 ? 'var(--zone-yellow)' : 'var(--zone-green)';
        barEl.style.width = Math.min(100, (exerciseSeconds / targetSeconds) * 100) + '%';
        barEl.style.backgroundColor = bg < 4.0 ? 'var(--zone-red)' : bg < 5.0 ? 'var(--zone-yellow)' : 'var(--zone-green)';
        statusEl.textContent = paused ? 'Snacking...' : 'Exercise: ' + exerciseSeconds + '/' + targetSeconds + 's';

        if (bg < 4.0) wentLow = true;
        if (bg < 3.0 || exerciseSeconds >= targetSeconds) {
          finished = true;
          clearInterval(interval);
          runnerEl.textContent = bg < 3.0 ? '😵' : '🎉';

          var stars;
          if (bg >= 4.0 && bg <= 12.0 && exerciseSeconds >= targetSeconds) stars = 3;
          else if (bg >= 3.5 && exerciseSeconds >= targetSeconds) stars = 2;
          else if (exerciseSeconds >= targetSeconds * 0.6) stars = 1;
          else stars = 0;

          var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
          var headline = stars === 3 ? 'Great balance!' : stars === 2 ? 'Finished, but BG got low.' : stars === 1 ? 'Tough session.' : 'BG crashed. Had to stop early.';
          var msg = headline + ' Final BG: <strong>' + bg.toFixed(1) + '</strong>. Snacks used: ' + snacksUsed + '.';
          if (wentLow) msg += '<br><small>💡 Exercise lowers BG. Eating a snack BEFORE you go low keeps you in range.</small>';
          var resDiv = document.getElementById('mg-result');
          resDiv.className = 'mg-result ' + cls;
          resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
            (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
            '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
          document.getElementById('mg-continue').addEventListener('click', function() {
            state.bg.current = bg;
            notify();
            onComplete({ stars: stars, summary: msg });
          });
        }
      }, 200);
    }, 50);
  }
};

// ---- Pack Your Bag ----
// Click items to pack for a trip. Must get all essentials.
MiniGames['Pack Your Bag'] = {
  play: function(opts, onComplete) {
    var tier = opts.tier || 1;
    var isPump = state.player.device.insulin === 'pump';
    var isCGM = state.player.device.bgMonitor === 'cgm';

    var items = [
      { emoji: '💉', name: isPump ? 'Pump supplies' : 'Insulin pen + needles', essential: true, cat: 'insulin' },
      { emoji: '🩸', name: isCGM ? 'CGM receiver/phone' : 'Blood glucose meter + strips', essential: true, cat: 'monitor' },
      { emoji: '🍬', name: 'Glucose tabs', essential: true, cat: 'low-treatment' },
      { emoji: '🧃', name: 'Juice box', essential: true, cat: 'low-treatment' },
      { emoji: '🥪', name: 'Snacks', essential: true, cat: 'food' },
      { emoji: '💧', name: 'Water bottle', essential: true, cat: 'hydration' },
      { emoji: '🪪', name: 'Medical ID', essential: true, cat: 'safety' },
      { emoji: '🔋', name: 'Extra batteries / charger', essential: false, cat: 'backup' },
      { emoji: '📋', name: 'Emergency contact card', essential: false, cat: 'safety' },
      { emoji: isPump ? '🔧' : '💉', name: isPump ? 'Backup infusion sets' : 'Extra pen needles', essential: false, cat: 'backup' },
      { emoji: '❄️', name: 'Insulin cool pack', essential: false, cat: 'storage' }
    ];
    if (tier >= 2) {
      items.push({ emoji: '📝', name: 'Doctor\'s note / letter', essential: false, cat: 'travel' });
      items.push({ emoji: '🧊', name: 'Insulated bag', essential: false, cat: 'storage' });
    }
    var distractors = [
      { emoji: '🎮', name: 'Video game', essential: false, cat: 'distractor' },
      { emoji: '🧸', name: 'Stuffed animal', essential: false, cat: 'distractor' },
      { emoji: '🕶️', name: 'Sunglasses', essential: false, cat: 'distractor' },
      { emoji: '📚', name: 'Comic book', essential: false, cat: 'distractor' }
    ];
    var shuffledDistractors = distractors.sort(function() { return Math.random() - 0.5; }).slice(0, 2);
    var allItems = items.concat(shuffledDistractors).sort(function() { return Math.random() - 0.5; });
    var packed = {};

    renderMGPanel(
      '<h2>🎒 Pack Your Bag</h2>' +
      '<p class="mg-subtitle">Tap everything you need for ' + (tier <= 1 ? 'a day at school' : tier <= 2 ? 'a sleepover' : 'a day trip') + '.</p>' +
      '<div class="mg-options-grid" id="mg-pack-items">' +
        allItems.map(function(item, i) {
          return '<div class="mg-option-card" data-idx="' + i + '" style="cursor:pointer;">' +
            '<span class="mg-opt-emoji">' + item.emoji + '</span>' +
            '<span class="mg-opt-name">' + item.name + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div style="text-align:center;margin:12px 0;">' +
        '<div id="mg-pack-count" style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">Packed: 0 items</div>' +
        '<button class="mg-action-btn" id="mg-pack-done">🎒 Done Packing</button>' +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(function() {
      document.querySelectorAll('#mg-pack-items .mg-option-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var idx = parseInt(card.dataset.idx, 10);
          if (packed[idx]) {
            delete packed[idx];
            card.style.border = '';
            card.style.background = '';
          } else {
            packed[idx] = true;
            card.style.border = '2px solid var(--zone-green)';
            card.style.background = 'rgba(76,175,80,0.1)';
          }
          document.getElementById('mg-pack-count').textContent = 'Packed: ' + Object.keys(packed).length + ' items';
        });
      });

      document.getElementById('mg-pack-done').addEventListener('click', function() {
        var essentialsMissed = [];
        var extrasGot = 0;
        allItems.forEach(function(item, i) {
          if (item.essential && !packed[i]) essentialsMissed.push(item.name);
          if (!item.essential && item.cat !== 'distractor' && packed[i]) extrasGot++;
        });

        var stars;
        if (essentialsMissed.length === 0 && extrasGot >= 2) stars = 3;
        else if (essentialsMissed.length === 0) stars = 2;
        else if (essentialsMissed.length <= 1) stars = 1;
        else stars = 0;

        var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        var headline = stars === 3 ? 'Perfectly packed!' : stars === 2 ? 'Got all the essentials.' : stars === 1 ? 'Almost there.' : 'Missing important items.';
        var msg = headline;
        if (essentialsMissed.length > 0) msg += '<br><span style="color:var(--zone-red);">Forgot: ' + essentialsMissed.join(', ') + '</span>';
        if (extrasGot > 0) msg += '<br><small>💡 Nice touch bringing backup supplies.</small>';

        var resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', function() { onComplete({ stars: stars, summary: msg }); });
      });
    }, 50);
  }
};

// ---- Glucose Roller ----
// Keep BG in range by using carb/insulin pickups. Arrow keys to steer.
MiniGames['Glucose Roller'] = {
  play: function(opts, onComplete) {
    var bg = 7.0;
    var velocity = 0;
    var timeInGreen = 0;
    var totalTicks = 0;
    var maxTicks = 300;
    var finished = false;
    var pickups = [];
    var nextPickup = 30;

    renderMGPanel(
      '<h2>🎱 Glucose Roller</h2>' +
      '<p class="mg-subtitle">Keep the ball in the green zone. Use ⬆️ (carbs: BG up) and ⬇️ (insulin: BG down).</p>' +
      '<div style="position:relative;max-width:320px;margin:0 auto;height:300px;border:2px solid var(--border);border-radius:8px;overflow:hidden;background:linear-gradient(to bottom, rgba(244,67,54,0.15) 0%, rgba(255,235,59,0.1) 15%, rgba(76,175,80,0.15) 30%, rgba(76,175,80,0.15) 70%, rgba(255,235,59,0.1) 85%, rgba(244,67,54,0.15) 100%);" id="mg-roller-field">' +
        '<div style="position:absolute;left:0;right:0;top:28%;height:1px;border-top:1px dashed var(--zone-green);opacity:0.5;"></div>' +
        '<div style="position:absolute;left:0;right:0;top:72%;height:1px;border-top:1px dashed var(--zone-green);opacity:0.5;"></div>' +
        '<div id="mg-roller-ball" style="position:absolute;left:50%;transform:translateX(-50%);font-size:28px;transition:top 0.05s;">⚽</div>' +
        '<div id="mg-roller-pickups" style="position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;"></div>' +
      '</div>' +
      '<div style="text-align:center;margin:8px 0;">' +
        '<span style="font-size:14px;">BG: <strong id="mg-roller-bg">7.0</strong></span> | ' +
        '<span style="font-size:14px;">Time in range: <strong id="mg-roller-tir">0%</strong></span>' +
      '</div>' +
      '<div style="text-align:center;margin:8px 0;">' +
        '<button class="mg-action-btn" id="mg-roller-up" style="margin:0 4px;">⬆️ Carbs</button>' +
        '<button class="mg-action-btn" id="mg-roller-down" style="margin:0 4px;">⬇️ Insulin</button>' +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(function() {
      var ballEl = document.getElementById('mg-roller-ball');
      var bgEl = document.getElementById('mg-roller-bg');
      var tirEl = document.getElementById('mg-roller-tir');

      function bgToY(val) {
        var clamped = Math.max(2, Math.min(18, val));
        return ((18 - clamped) / 16) * 260 + 10;
      }

      function applyForce(dir) {
        if (finished) return;
        velocity += dir * 0.15;
      }

      document.getElementById('mg-roller-up').addEventListener('click', function() { applyForce(1); });
      document.getElementById('mg-roller-down').addEventListener('click', function() { applyForce(-1); });

      document.addEventListener('keydown', function handler(e) {
        if (finished) { document.removeEventListener('keydown', handler); return; }
        if (e.key === 'ArrowUp') { applyForce(1); e.preventDefault(); }
        if (e.key === 'ArrowDown') { applyForce(-1); e.preventDefault(); }
      });

      var interval = setInterval(function() {
        if (finished) { clearInterval(interval); return; }
        totalTicks++;
        velocity += (Math.random() - 0.52) * 0.06;
        velocity *= 0.97;
        bg += velocity * 0.1;
        bg = Math.max(2, Math.min(18, bg));

        if (bg >= 5 && bg <= 12) timeInGreen++;

        ballEl.style.top = bgToY(bg) + 'px';
        bgEl.textContent = bg.toFixed(1);
        bgEl.style.color = bg >= 5 && bg <= 12 ? 'var(--zone-green)' : bg < 4 || bg > 15 ? 'var(--zone-red)' : 'var(--zone-yellow)';
        tirEl.textContent = Math.round((timeInGreen / totalTicks) * 100) + '%';

        if (totalTicks >= maxTicks) {
          finished = true;
          clearInterval(interval);
          var pct = Math.round((timeInGreen / totalTicks) * 100);
          var stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
          var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
          var headline = stars === 3 ? 'Smooth rolling!' : stars === 2 ? 'Decent control.' : stars === 1 ? 'Bumpy ride.' : 'Wild swings.';
          var msg = headline + ' Time in range: <strong>' + pct + '%</strong>.' +
            '<br><small>💡 BG has momentum. Small, early corrections work better than big, late ones.</small>';
          var resDiv = document.getElementById('mg-result');
          resDiv.className = 'mg-result ' + cls;
          resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
            (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
            '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
          document.getElementById('mg-continue').addEventListener('click', function() { onComplete({ stars: stars, summary: msg }); });
        }
      }, 50);
    }, 50);
  }
};

// ---- Portion Estimator ----
// See a plate described with emoji, estimate total carbs with a slider.
MiniGames['Portion Estimator'] = {
  play: function(opts, onComplete) {
    var tier = opts.tier || 1;
    var plates = [
      { items: [{ emoji: '🍚', desc: '~1.5 cups rice', carbs: 67 }, { emoji: '🍗', desc: 'Chicken thigh', carbs: 0 }, { emoji: '🥬', desc: 'Side of veggies', carbs: 8 }], total: 75, hint: 'Your fist = about 1 cup. That rice looks like 1.5 fists.' },
      { items: [{ emoji: '🍝', desc: 'Big bowl of pasta', carbs: 60 }, { emoji: '🧀', desc: 'Parmesan on top', carbs: 1 }, { emoji: '🥗', desc: 'Side salad', carbs: 5 }], total: 66, hint: 'A big bowl of pasta is often 1.5 cups or more.' },
      { items: [{ emoji: '🥞', desc: '3 pancakes', carbs: 45 }, { emoji: '🍯', desc: 'Syrup drizzle', carbs: 15 }, { emoji: '🍓', desc: 'Strawberries', carbs: 6 }], total: 66, hint: 'Each pancake is about 15g. Syrup adds fast carbs.' },
      { items: [{ emoji: '🍕', desc: '2 slices of pizza', carbs: 60 }, { emoji: '🥤', desc: 'Glass of pop', carbs: 39 }], total: 99, hint: 'Each pizza slice is about 30g. Pop is pure sugar.' },
      { items: [{ emoji: '🌮', desc: '3 soft tacos', carbs: 45 }, { emoji: '🫘', desc: 'Refried beans', carbs: 20 }, { emoji: '🧀', desc: 'Cheese', carbs: 1 }], total: 66, hint: 'Each flour tortilla is about 15g.' },
      { items: [{ emoji: '🥣', desc: 'Bowl of cereal', carbs: 35 }, { emoji: '🥛', desc: 'Milk', carbs: 13 }, { emoji: '🍌', desc: 'Banana on top', carbs: 27 }], total: 75, hint: 'Cereal + milk + fruit adds up fast.' },
      { items: [{ emoji: '🍔', desc: 'Burger with bun', carbs: 35 }, { emoji: '🍟', desc: 'Medium fries', carbs: 44 }, { emoji: '🥤', desc: 'Small juice', carbs: 28 }], total: 107, hint: 'The bun, fries, and drink are ALL carbs.' },
      { items: [{ emoji: '🥪', desc: 'PB&J sandwich', carbs: 45 }, { emoji: '🍎', desc: 'Apple', carbs: 19 }, { emoji: '🥛', desc: 'Glass of milk', carbs: 13 }], total: 77, hint: 'Two slices of bread + jam = ~35g. PB adds very little.' }
    ];
    var plate = plates[Math.floor(Math.random() * plates.length)];

    renderMGPanel(
      '<h2>👁️ Portion Estimator</h2>' +
      '<p class="mg-subtitle">Look at this plate and estimate the total carbs.</p>' +
      '<div style="background:white;border-radius:50%;width:220px;height:220px;margin:16px auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;border:3px solid var(--border);gap:4px;">' +
        plate.items.map(function(item) {
          return '<div style="text-align:center;"><span style="font-size:36px;">' + item.emoji + '</span><div style="font-size:11px;color:#333;">' + item.desc + '</div></div>';
        }).join('') +
      '</div>' +
      '<div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:8px;">' +
        '<strong>Handy references:</strong> Your fist = 1 cup | Your palm = 3oz protein | Your thumb = 1 tbsp' +
      '</div>' +
      '<div class="mg-slider-row">' +
        '<label>Estimate:</label>' +
        '<input type="range" id="mg-portion-slider" min="0" max="150" step="5" value="50">' +
        '<span class="mg-slider-value" id="mg-portion-val">50g</span>' +
      '</div>' +
      '<div style="text-align:center;margin-top:12px;">' +
        '<button class="mg-action-btn" id="mg-portion-submit">Check Estimate</button>' +
      '</div>' +
      '<div id="mg-result"></div>'
    );

    setTimeout(function() {
      var slider = document.getElementById('mg-portion-slider');
      var valEl = document.getElementById('mg-portion-val');
      slider.addEventListener('input', function() { valEl.textContent = slider.value + 'g'; });
      document.getElementById('mg-portion-submit').addEventListener('click', function() {
        var guess = parseInt(slider.value, 10);
        var diff = Math.abs(guess - plate.total);
        var stars = starsFromDiff(diff, [10, 20, 30]);
        var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        var headline = stars === 3 ? 'Great eye!' : stars === 2 ? 'Close!' : stars === 1 ? 'In the ballpark.' : 'Off by quite a bit.';
        var breakdown = plate.items.map(function(item) { return item.desc + ' ' + item.carbs + 'g'; }).join(' + ');
        var msg = headline + ' Actual: <strong>' + plate.total + 'g</strong> (you said ' + guess + 'g, off by ' + diff + 'g).' +
          '<br><small style="color:var(--text-secondary);">' + breakdown + '</small>' +
          '<br><small>💡 ' + plate.hint + '</small>';
        var resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', function() { onComplete({ stars: stars, summary: msg }); });
      });
    }, 50);
  }
};

// ---- Sick Day Protocol ----
// Step through the correct management protocol for a sick day.
MiniGames['Sick Day Protocol'] = {
  play: function(opts, onComplete) {
    var steps = [
      {
        situation: '🤒 You wake up feeling awful. Fever, nausea, body aches. Your BG reads <strong>16.5</strong>.',
        question: 'What do you do first?',
        options: [
          { text: '🩸 Check for ketones', correct: true, feedback: 'Correct! When BG is high and you\'re sick, always check ketones.' },
          { text: '💉 Give a big correction dose', correct: false, feedback: 'Hold on. Check ketones first. High BG + illness could mean ketones, and that changes what you do.' },
          { text: '😴 Go back to sleep', correct: false, feedback: 'Not safe. High BG when sick needs attention right away.' }
        ]
      },
      {
        situation: '⚠️ Ketone check: <strong>Moderate ketones detected.</strong>',
        question: 'What next?',
        options: [
          { text: '💧 Drink water + give correction dose', correct: true, feedback: 'Yes! Fluids help flush ketones. A correction dose helps bring BG down.' },
          { text: '🍕 Eat something to feel better', correct: false, feedback: 'Eating adds carbs when BG is already high. Fluids first, correction first.' },
          { text: '⏰ Wait and recheck in a few hours', correct: false, feedback: 'Moderate ketones need action now, not later. Waiting can lead to DKA.' }
        ]
      },
      {
        situation: '💧 You\'ve had water and given a correction. It\'s been 2 hours.',
        question: 'Time to recheck. What are you checking?',
        options: [
          { text: '🩸 BG and ketones both', correct: true, feedback: 'Correct! You need to see if BG came down AND if ketones improved.' },
          { text: '🩸 Just BG', correct: false, feedback: 'BG matters, but ketones are the bigger danger right now. Check both.' },
          { text: '🤷 Feel fine-ish, skip the check', correct: false, feedback: 'Never skip a recheck during a sick day. Things can change fast.' }
        ]
      },
      {
        situation: '📊 Recheck: BG is <strong>13.0</strong> (coming down). Ketones: <strong>trace</strong> (improving).',
        question: 'Things are improving. What now?',
        options: [
          { text: '💧 Keep sipping fluids, eat small amounts if you can, recheck in 2 hours', correct: true, feedback: 'Perfect. Stay hydrated, small carbs if tolerated, and keep monitoring.' },
          { text: '🎉 All clear, go back to normal', correct: false, feedback: 'Not yet. Ketones are still present and you\'re still sick. Keep monitoring.' },
          { text: '📞 Call 911', correct: false, feedback: 'Not needed right now. Things are improving. But if ketones had gotten WORSE, calling your diabetes team would be the right move.' }
        ]
      },
      {
        situation: '❓ At what point should you call your diabetes team or go to the ER?',
        question: 'Which of these is a reason to call for help?',
        options: [
          { text: '🚨 Ketones stay high or worsen after 2 corrections, or you can\'t keep fluids down', correct: true, feedback: 'Exactly. Persistent high ketones or vomiting can lead to DKA. That needs medical help.' },
          { text: '🤒 You still have a fever', correct: false, feedback: 'A fever alone isn\'t an emergency for T1D, as long as BG and ketones are manageable.' },
          { text: '😢 You feel tired', correct: false, feedback: 'Feeling tired when sick is normal. The red flags are: high ketones that won\'t come down, vomiting, confusion, or fruity-smelling breath.' }
        ]
      }
    ];

    var currentStep = 0;
    var correctCount = 0;

    function renderStep() {
      if (currentStep >= steps.length) {
        var stars = correctCount === 5 ? 3 : correctCount >= 4 ? 2 : correctCount >= 3 ? 1 : 0;
        var cls = stars === 3 ? 'good' : stars >= 1 ? 'ok' : 'bad';
        var headline = stars === 3 ? 'Perfect protocol!' : stars === 2 ? 'Strong knowledge.' : stars === 1 ? 'Getting there.' : 'Review the sick day steps.';
        var msg = headline + ' Got ' + correctCount + ' out of ' + steps.length + ' steps right.' +
          '<br><small>💡 Sick day basics: check ketones, drink water, correct BG, recheck every 2 hours, call for help if ketones won\'t come down.</small>';
        var resDiv = document.getElementById('mg-result');
        resDiv.className = 'mg-result ' + cls;
        resDiv.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">' +
          (stars === 3 ? '⭐⭐⭐' : stars === 2 ? '⭐⭐' : stars === 1 ? '⭐' : '❌') + '</div>' + msg +
          '<div style="margin-top:14px;"><button class="mg-action-btn" id="mg-continue">Continue</button></div>';
        document.getElementById('mg-continue').addEventListener('click', function() { onComplete({ stars: stars, summary: msg }); });
        return;
      }
      var step = steps[currentStep];
      var stepDiv = document.getElementById('mg-sick-step');
      stepDiv.innerHTML = '<div style="background:white;border:2px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;color:#333;">' +
        '<p>' + step.situation + '</p>' +
        '<p style="font-weight:bold;">' + step.question + '</p>' +
        '</div>' +
        '<div class="mg-options-grid">' +
          step.options.map(function(opt, i) {
            return '<div class="mg-option-card" data-idx="' + i + '" style="cursor:pointer;text-align:left;padding:12px;">' +
              '<span>' + opt.text + '</span></div>';
          }).join('') +
        '</div>' +
        '<div id="mg-step-feedback"></div>';

      setTimeout(function() {
        stepDiv.querySelectorAll('.mg-option-card').forEach(function(card) {
          card.addEventListener('click', function() {
            var idx = parseInt(card.dataset.idx, 10);
            var opt = step.options[idx];
            stepDiv.querySelectorAll('.mg-option-card').forEach(function(c) { c.style.pointerEvents = 'none'; });
            card.style.border = opt.correct ? '2px solid var(--zone-green)' : '2px solid var(--zone-red)';
            if (opt.correct) correctCount++;
            var fb = document.getElementById('mg-step-feedback');
            fb.innerHTML = '<p style="margin-top:10px;color:' + (opt.correct ? 'var(--zone-green)' : 'var(--zone-red)') + ';">' +
              (opt.correct ? '✓ ' : '✗ ') + opt.feedback + '</p>' +
              '<button class="mg-action-btn" id="mg-next-step" style="margin-top:8px;">Next</button>';
            currentStep++;
            document.getElementById('mg-next-step').addEventListener('click', renderStep);
          });
        });
      }, 30);
    }

    renderMGPanel(
      '<h2>🤒 Sick Day Protocol</h2>' +
      '<p class="mg-subtitle">You\'re sick and your BG is high. Step through the protocol.</p>' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Step ' + (currentStep + 1) + ' of ' + steps.length + '</div>' +
      '<div id="mg-sick-step"></div>' +
      '<div id="mg-result"></div>'
    );
    setTimeout(renderStep, 50);
  }
};

// ---- Mini-game launcher ----
// Plays a mini-game, then renders nextPassage. Awards Beta Cell on first play.
function playMiniGame(gameName, opts, nextPassage) {
  const game = MiniGames[gameName];
  if (!game) { renderPassage(nextPassage); return; }
  game.play(opts || {}, (result) => {
    // AUDIO: Play result jingle based on stars
    const bcId = miniGameBetaCells[gameName];
    if (bcId && collectBetaCell(bcId)) {
      setTimeout(() => showBetaCellNotification(betaCellMap[bcId].name, betaCellMap[bcId].cat), 400);
    }
    if (result.stars === 3) updateConfidence(5);
    else if (result.stars === 2) updateConfidence(3);
    else if (result.stars === 1) updateConfidence(1);
    else updateConfidence(-2);
    tick(0.25); advanceTime(0.25);
    renderPassage(nextPassage);
  });
}

// ---- Mini-game passage registration ----
// Day/slot-based mini-game launch point used by startDay().
function registerMiniGamePassage(day, slot, nextPassage) {
  const schedule = miniGameSchedule[day];
  if (!schedule) return nextPassage; // Day 1 has its own built-in mini-games
  const game = slot === 'am' ? schedule.am : schedule.pm;
  const p = 'd' + day + '-game-' + slot;
  const hasImpl = !!MiniGames[game.name];

  addPassage(p, {
    content: (s) => '<h2>' + game.name + '</h2>' +
      // ART: Mini-game preview illustration
      '<p class="passage-scene">' + game.desc + '</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Ready for a challenge?"</p>' +
      (hasImpl ? '' : '<p><em>(Mini-game coming soon — simulating result for now.)</em></p>'),
    // AUDIO: Play mini-game start jingle
    onEnter: () => { advanceTime(0.25); showCompanion("Let's do this!"); },
    choices: [{
      text: hasImpl ? '▶ Play ' + game.name : 'Simulate ' + game.name,
      next: function() {
        if (hasImpl) {
          playMiniGame(game.name, { tier: getDayTier(day), currentBG: state.bg.current }, nextPassage);
          return null; // playMiniGame handles rendering
        }
        return p + '-result';
      }
    }]
  });

  addPassage(p + '-result', {
    content: (s) => '<h2>Nice work!</h2><p>You completed the ' + game.name + ' challenge.</p>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong></p>',
    onEnter: (s) => {
      tick(0.25); advanceTime(0.25);
      showCompanion("Good job! You're getting better at this.");
      const bcId = miniGameBetaCells[game.name];
      if (bcId && collectBetaCell(bcId)) setTimeout(() => showBetaCellNotification(betaCellMap[bcId].name, betaCellMap[bcId].cat), 500);
    },
    next: nextPassage, continueText: 'Continue'
  });

  return p;
}

// ============================================
// 12. GENERIC SNACK PASSAGE
// ============================================

function registerSnackPassage(day, slot, nextPassage) {
  const p = 'd' + day + '-snack-' + slot;
  const snackOptions = [
    ['Apple slices (~15g)', 15, 'fast'],
    ['Cheese and crackers (~15g)', 15, 'slow'],
    ['Almonds (~5g)', 5, 'slow'],
    ['Yogurt (~15g)', 15, 'fast'],
    ['Granola bar (~20g)', 20, 'slow'],
    ['Trail mix (~17g)', 17, 'slow'],
    ['Banana (~27g)', 27, 'fast'],
    ['Celery with peanut butter (~8g)', 8, 'slow']
  ];
  // Pick 3 random snack options
  const shuffled = snackOptions.sort(() => Math.random() - 0.5).slice(0, 3);

  addPassage(p, {
    content: (s) => '<h2>Snack Time</h2>' +
      '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong> — ' + getBGZone(s.bg.current).label + '</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Quick snack to keep things steady."</p>',
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    choices: shuffled.map(sn => ({
      text: sn[0],
      onSelect: (s) => { eatFood(sn[1], sn[2]); s.score.snacksRemembered++; },
      next: nextPassage
    }))
  });
  return p;
}

// ============================================
// 13. DAY GENERATOR — startDay(n)
// ============================================

function getDayTier(day) {
  if (day <= 2) return 1;
  if (day <= 4) return 2;
  return 3;
}

function startDay(day) {
  const tier = getDayTier(day);
  const seen = state.narrative.eventsCompleted;

  // Reset daily score
  resetDayScore();

  // Pick events from pools
  const mealEvents = pickFromPool(mealPool, tier, 3, seen);
  const socialEvent = pickFromPool(socialPool, tier, 1, seen)[0];
  const emotionalEvent = pickFromPool(emotionalPool, tier, 1, seen)[0];
  const practicalEvent = pickFromPool(practicalPool, tier, 1, seen)[0];

  // Store what we picked
  state.narrative.dayEvents = { meals: mealEvents, social: socialEvent, emotional: emotionalEvent, practical: practicalEvent };

  // Build the day's passage chain
  // Wakeup → Breakfast → Morning Snack → Morning Game → [Social] → Lunch → Afternoon Snack → Afternoon Game → Late Snack → Dinner → Evening → Bedtime → [Night] → Day End

  const dayEnd = 'd' + day + '-end';
  const nightPassage = (day === 3 || day === 5 || day === 7) ? 'd' + day + '-night' : dayEnd;
  const bedtimeResult = 'd' + day + '-bedtime-check';
  const bedtime = 'd' + day + '-bedtime';
  const evening = 'd' + day + '-evening';

  // Register day-end
  registerDayEnd(day);

  // Night events for Days 3, 5, 7
  if (day === 3 || day === 5 || day === 7) registerNightEvent(day, dayEnd);

  // Bedtime
  registerBedtime(day, bedtimeResult, nightPassage);
  registerBedtimeCheck(day, bedtimeResult, nightPassage);

  // Evening — emotional or practical event
  let eveningPassage;
  if (day === 5) {
    // Scripted anchor: emotional check-in after sick day
    eveningPassage = registerEmotionalAnchor_Day5Evening(day, bedtime);
  } else if (emotionalEvent) {
    eveningPassage = emotionalEvent.register(day, bedtime);
    seen.push(emotionalEvent.id);
  } else if (practicalEvent) {
    eveningPassage = practicalEvent.register(day, bedtime);
    seen.push(practicalEvent.id);
  } else {
    eveningPassage = bedtime;
  }

  // Dinner — scripted on Day 3 or from pool
  let dinnerPassage;
  if (day === 3) {
    dinnerPassage = registerScriptedDinner_Day3(day, eveningPassage);
  } else if (mealEvents[2]) {
    dinnerPassage = mealEvents[2].register(day, eveningPassage);
    seen.push(mealEvents[2].id);
  } else {
    dinnerPassage = eveningPassage;
  }

  // Late snack
  const lateSnack = registerSnackPassage(day, 'late', dinnerPassage);

  // Afternoon game
  const pmGame = registerMiniGamePassage(day, 'pm', lateSnack);

  // Afternoon snack
  const pmSnack = registerSnackPassage(day, 'afternoon', pmGame);

  // Social event (between lunch and afternoon snack, or skip if none)
  // Day 4 replaces this slot with the scripted Soccer Practice anchor.
  let socialPassage;
  if (day === 4) {
    socialPassage = registerScriptedExercise_Day4(day, pmSnack);
  } else if (socialEvent) {
    socialPassage = socialEvent.register(day, pmSnack);
    seen.push(socialEvent.id);
  } else if (practicalEvent && !seen.includes(practicalEvent.id)) {
    socialPassage = practicalEvent.register(day, pmSnack);
    seen.push(practicalEvent.id);
  } else {
    socialPassage = pmSnack;
  }

  // Lunch
  let lunchPassage;
  if (mealEvents[1]) {
    lunchPassage = mealEvents[1].register(day, socialPassage);
    seen.push(mealEvents[1].id);
  } else {
    lunchPassage = socialPassage;
  }

  // Morning game
  const amGame = registerMiniGamePassage(day, 'am', lunchPassage);

  // Morning snack
  const amSnack = registerSnackPassage(day, 'morning', amGame);

  // Breakfast — scripted on Day 2, 5, 6, 7; pool on others
  let breakfastPassage;
  if (day === 2) {
    breakfastPassage = registerScriptedMorning_Day2(day, amSnack);
  } else if (day === 5) {
    breakfastPassage = registerScriptedMorning_Day5(day, amSnack);
  } else if (day === 6) {
    breakfastPassage = registerScriptedMorning_Day6(day, amSnack);
  } else if (day === 7) {
    breakfastPassage = registerScriptedMorning_Day7(day, amSnack);
  } else if (mealEvents[0]) {
    breakfastPassage = mealEvents[0].register(day, amSnack);
    seen.push(mealEvents[0].id);
  } else {
    breakfastPassage = amSnack;
  }

  // Wakeup
  registerWakeup(day, breakfastPassage);

  // Start the day
  // AUDIO: Play morning ambient track
  renderPassage('d' + day + '-wakeup');
}

// ============================================
// 14. WAKEUP / BEDTIME / DAY-END TEMPLATES
// ============================================

// Per-day wake-up flavor — makes each day feel distinct
// Scripted moments on Days 1, 3, 5, 7 get their own breakfast flow,
// so these themes focus on setting the TONE of each day.
const dayThemes = {
  2: {
    headline: 'Day 2 — First Day Solo',
    scene: 'Morning. Yesterday\'s tutorial is over. Today you make the calls.',
    companionLine: "Morning. I'll still be here, but today I want you driving. You've got the basics now.",
    continueText: 'Start the day'
  },
  3: {
    headline: 'Day 3 — Building Muscle',
    scene: 'Third morning in a row. The routine is starting to feel like a routine.',
    companionLine: "Day three. The carb counting is getting easier, right? Tonight\u2019s dinner is the big one \u2014 I\u2019m going to let you fly solo on that.",
    continueText: 'Time for breakfast'
  },
  4: {
    headline: 'Day 4 — Game Day',
    scene: 'Mid-week. Your backpack has your gym clothes in it. Soccer practice after school today.',
    companionLine: "Game day. Exercise is one of the trickiest parts of T1D \u2014 it drops your BG, sometimes hours after you\u2019re done. We\u2019ll plan around it.",
    continueText: "Let\u2019s do it"
  },
  5: {
    headline: 'Day 5 — Something\'s Off',
    scene: '',
    companionLine: '',
    skipBoilerplate: true, // Day 5 has a scripted morning that replaces the wakeup body
    continueText: 'Continue'
  },
  6: {
    headline: 'Day 6 — Saturday',
    scene: 'No school. No rush. The whole day stretches out in front of you.',
    companionLine: "Weekend. Different rhythm. People sleep in, eat later, snack more randomly. Keep an eye on the patterns \u2014 they\u2019re different from weekdays.",
    continueText: 'Enjoy the morning'
  },
  7: {
    headline: 'Day 7 — Field Trip',
    scene: '',
    companionLine: '',
    skipBoilerplate: true, // Day 7 scripted
    continueText: 'Continue'
  }
};

function registerWakeup(day, nextPassage) {
  const theme = dayThemes[day];
  addPassage('d' + day + '-wakeup', {
    content: (s) => {
      const headline = theme ? theme.headline : ('Day ' + day);
      const scene    = theme && theme.scene ? theme.scene : 'Morning. A new day.';
      if (theme && theme.skipBoilerplate) {
        // Day 5/7 show only the headline — the scripted morning passage follows immediately
        return '<h2>' + headline + '</h2>' +
          // ART: Scene background \u2014 bedroom morning (day-specific)
          '<p class="passage-scene">You wake up.</p>';
      }
      return '<h2>' + headline + '</h2>' +
        // ART: Scene background \u2014 bedroom morning (day-specific)
        '<p class="passage-scene">' + scene + '</p>' +
        '<p>You check your BG: <strong>' + s.bg.current.toFixed(1) + '</strong> \u2014 ' + getBGZone(s.bg.current).label + '.</p>';
    },
    onEnter: (s) => {
      // AUDIO: Play morning ambient track (variant per day of week)
      s.time.hour = 7.0;
      // Morning BG \u2014 slight randomness, 6-9 range
      const morningBG = 6 + Math.random() * 3;
      s.bg.current = Math.round(morningBG * 10) / 10;
      s.bg.trend = 'stable';
      notify();
      const line = theme && theme.companionLine
        ? theme.companionLine
        : (randomLine('morningGreeting') + ' ' + s.bg.current.toFixed(1) + ' \u2014 ' + getBGZone(s.bg.current).label.toLowerCase() + '.');
      showCompanion(line, 6000);
    },
    next: nextPassage,
    continueText: theme ? theme.continueText : 'Time for breakfast'
  });
}

function registerBedtime(day, nextId, nightPassage) {
  addPassage('d' + day + '-bedtime', {
    content: (s) => '<h2>Bedtime Snack</h2>' +
      '<p><strong>' + s.companion.name + ':</strong> "Bedtime snack keeps things steady overnight."</p>',
    onEnter: () => { advanceTime(1.5); tick(0.5); },
    choices: [
      { text: 'Crackers with cheese (~15g)', onSelect: (s) => { eatFood(15, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: nextId },
      { text: 'Glass of milk (~12g)', onSelect: (s) => { eatFood(12, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: nextId },
      { text: 'Toast with peanut butter (~15g)', onSelect: (s) => { eatFood(15, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: nextId }
    ]
  });
}

function registerBedtimeCheck(day, passageId, nextPassage) {
  addPassage(passageId, {
    content: (s) => {
      const ok = s.bg.current >= 5 && s.bg.current <= 12;
      return '<h2>Final Check</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong> — ' + getBGZone(s.bg.current).label + '</p>' +
        '<p><strong>' + s.companion.name + ':</strong> "' + (ok ? 'Looking good for bedtime.' : 'Not perfect, but safe.') + '"</p>';
    },
    onEnter: () => { tick(0.5); },
    next: nextPassage, continueText: 'Go to sleep'
  });
}

function registerNightEvent(day, nextPassage) {
  addPassage('d' + day + '-night', {
    content: (s) => {
      // AUDIO: Play night ambient track
      const event = Math.random();
      if (event < 0.4) {
        s.bg.current = 4.0 + Math.random();
        s.bg.trend = 'falling';
        notify();
        return '<h2>Night Alert</h2>' +
          '<p class="passage-scene">2:30 AM. Something wakes you.</p>' +
          (s.player.device.bgMonitor === 'cgm'
            ? '<p>Your CGM is alarming. BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. Low.</p>'
            : '<p>You feel shaky. You check: <strong>' + s.bg.current.toFixed(1) + '</strong>. Low.</p>') +
          '<p>You grab a juice box from the nightstand. 15g of fast sugar. Wait... recheck...</p>' +
          '<p>BG comes back up to <strong>6.2</strong>. Back to sleep.</p>';
      } else if (event < 0.7) {
        s.bg.current = 13 + Math.random() * 3;
        s.bg.trend = 'rising';
        notify();
        return '<h2>Night Check</h2>' +
          '<p class="passage-scene">3:00 AM.</p>' +
          '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. Running high.</p>' +
          '<p>A small correction dose and some water. It\'ll come down by morning.</p>';
      } else {
        return '<h2>Peaceful Night</h2>' +
          '<p class="passage-scene">You sleep through the night.</p>' +
          '<p>Morning BG will tell the story, but for now — rest.</p>';
      }
    },
    onEnter: (s) => {
      // Fix BG after night treatment
      if (s.bg.current < 5) { s.bg.current = 6.2; notify(); }
      else if (s.bg.current > 12) { const corrected = s.bg.current - 3; s.bg.current = Math.max(7, corrected); notify(); }
    },
    next: nextPassage, continueText: 'Morning comes...'
  });
}

function registerDayEnd(day) {
  addPassage('d' + day + '-end', {
    noWrap: true,
    content: (s) => {
      // AUDIO: Play end-of-day summary fanfare
      const samples = s.score.bgSamples;
      const inRange = samples.filter(x => x.value >= 5 && x.value <= 12).length;
      const tir = samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 75;
      return '<div class="summary-panel"><h2>Day ' + day + ' — Complete</h2>' +
        '<div class="summary-stat"><span class="label">Time in Range</span><span class="value" style="color:var(--zone-green)">' + tir + '%</span></div>' +
        '<div class="tir-bar"><div class="tir-fill" style="width:' + tir + '%"></div></div>' +
        '<div class="summary-stat"><span class="label">Meals Managed</span><span class="value">' + s.score.mealsManaged + '/4</span></div>' +
        '<div class="summary-stat"><span class="label">Snacks</span><span class="value">' + s.score.snacksRemembered + '/3</span></div>' +
        '<div class="summary-stat"><span class="label">Beta Cells</span><span class="value" style="color:var(--accent-warm)">' + s.score.collectiblesFound.length + '/' + s.score.totalCollectibles + '</span></div>' +
        '<div class="summary-stat"><span class="label">Confidence</span><span class="value">' + s.confidence + '/100</span></div></div>' +
        '<div class="passage"><p><strong>' + s.companion.name + ':</strong> "Day ' + day + ' done. ' +
        (tir >= 70 ? 'Solid day. You should be proud.' : 'Tough day, but you showed up. That matters.') + '"</p></div>';
    },
    onEnter: (s) => {
      const samples = s.score.bgSamples;
      const inRange = samples.filter(x => x.value >= 5 && x.value <= 12).length;
      const tir = samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 75;
      s.score.timeInRange.push(tir);
      saveGame(); // Auto-save at day transition
      showCompanion("Day " + day + " in the books.", 5000);
    },
    choices: day < 7
      ? [{ text: 'Start Day ' + (day + 1), onSelect: () => { state.time.day = day + 1; }, next: function() { startDay(day + 1); return null; } }]
      : [{ text: 'View Weekly Summary', next: 'weekly-summary' }]
  });

  // Fix the day transition — we need to use startDay, not renderPassage
  if (day < 7) {
    // Override the choice to call startDay directly
    const endId = 'd' + day + '-end';
    const origPassage = passages[endId];
    origPassage.choices = [{
      text: 'Start Day ' + (day + 1),
      onSelect: () => { state.time.day = day + 1; startDay(day + 1); },
      next: null // startDay handles rendering
    }];
    // Override choice click to not call renderPassage(null)
  }
}

// ============================================
// 15. SCRIPTED ANCHORS
// ============================================

// Day 3 Dinner: Estimation Challenge — first meal without companion guidance
function registerScriptedDinner_Day3(day, nextPassage) {
  const p = 'd3-anchor-estimation';
  addPassage(p, {
    content: (s) => '<h2>The Estimation Challenge</h2>' +
      '<p class="passage-scene">Home. Chicken stir-fry with noodles and vegetables. No label. And this time...</p>' +
      '<p><strong>' + s.companion.name + '</strong> steps back. "This one\'s yours. I\'m not going to help with the carb count. You\'ve got the skills — let\'s see you use them."</p>' +
      '<p>You look at the plate. Noodles, chicken, mixed veggies in sauce.</p>' +
      '<p>How many carbs?</p>',
    onEnter: () => {
      advanceTime(0.5); tick(0.5);
      showCompanion("Training wheels off. You've got this.");
    },
    choices: [
      { text: 'About 30g', onSelect: (s) => { s.narrative.choices['d3-est'] = 30; }, next: p + '-result' },
      { text: 'About 45g', onSelect: (s) => { s.narrative.choices['d3-est'] = 45; }, next: p + '-result' },
      { text: 'About 60g', onSelect: (s) => { s.narrative.choices['d3-est'] = 60; }, next: p + '-result' }
    ]
  });

  addPassage(p + '-result', {
    content: (s) => {
      const est = s.narrative.choices['d3-est'];
      const actual = 45;
      const diff = Math.abs(est - actual);
      let fb;
      if (diff <= 10) fb = "That's really close. The noodles are the main carb — about 35-40g for that portion, plus a few from the sauce and veggies.";
      else if (est < actual) fb = "A bit low. Noodles are carb-heavy — that portion is about 35-40g just for the noodles. Easy to underestimate.";
      else fb = "A bit high. Good instinct to err on the higher side though — overshooting is safer than undershooting.";
      const dose = recommendedDose(actual, s.bg.current);
      return '<p><strong>' + s.companion.name + '</strong> breaks silence: "' + fb + '"</p>' +
        '<p>"Actual: about <strong>45g</strong>. You dose <strong>' + dose + ' units</strong>."</p>' +
        '<p>"' + (diff <= 10 ? 'You did that on your own. Nicely done.' : 'Estimation takes practice. You\'re building the skill.') + '"</p>';
    },
    onEnter: (s) => {
      eatFood(45, 'slow'); doseInsulin(recommendedDose(45, s.bg.current)); s.score.mealsManaged++;
      tick(0.5); advanceTime(0.5);
      if (collectBetaCell('correcting-high')) setTimeout(() => showBetaCellNotification(betaCellMap['correcting-high'].name, 'green'), 500);
    },
    next: nextPassage, continueText: 'Continue'
  });
  return p;
}

// Day 5: Sick morning
function registerScriptedMorning_Day5(day, nextSnack) {
  const p = 'd5-anchor-sick';
  addPassage(p, {
    content: (s) => '<h2>Something\'s Not Right</h2>' +
      '<p class="passage-scene">You wake up feeling awful. Stomach is off. Head is foggy. You already know before you check — BG is going to be high.</p>' +
      '<p>You check: <strong>16.5</strong>. Very high. And you didn\'t even eat anything unusual last night.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Sick day. This happens. When you\'re ill, your body releases stress hormones that push BG up. We need a plan."</p>',
    onEnter: (s) => {
      s.bg.current = 16.5; s.bg.trend = 'rising'; notify();
      showCompanion("Sick day protocol. Let's take it step by step.");
    },
    choices: [
      { text: 'Check ketones first', onSelect: () => { state.narrative.choices['d5-sick-step'] = 'ketones'; }, next: p + '-ketones' },
      { text: 'Give a correction dose right away', onSelect: () => { state.narrative.choices['d5-sick-step'] = 'correct'; }, next: p + '-correct' },
      { text: 'Drink water and wait', onSelect: () => { state.narrative.choices['d5-sick-step'] = 'water'; }, next: p + '-water' }
    ]
  });

  addPassage(p + '-ketones', {
    content: (s) => '<p>You check ketones — <strong>moderate</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Good call checking first. Moderate ketones + high BG = give a correction AND drink water. If ketones go high, we call the doctor."</p>' +
      '<p>You give a correction dose and drink a big glass of water.</p>',
    onEnter: (s) => {
      doseInsulin(3); s.bg.current = 14; s.bg.trend = 'falling'; notify();
      updateConfidence(5);
      if (collectBetaCell('what-are-ketones')) setTimeout(() => showBetaCellNotification(betaCellMap['what-are-ketones'].name, 'blue'), 500);
      if (collectBetaCell('sick-day-red-flags')) setTimeout(() => showBetaCellNotification(betaCellMap['sick-day-red-flags'].name, 'red'), 1500);
    },
    next: p + '-continue', continueText: 'Continue'
  });

  addPassage(p + '-correct', {
    content: (s) => '<p>You give a correction dose.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Good — but on a sick day, always check ketones too. Let\'s do that now." Ketones: <strong>moderate</strong>.</p>' +
      '<p>"Moderate ketones means drink water and keep a close eye. If they go high, we call the doctor."</p>',
    onEnter: (s) => { doseInsulin(3); s.bg.current = 14; notify(); updateConfidence(3); },
    next: p + '-continue', continueText: 'Continue'
  });

  addPassage(p + '-water', {
    content: (s) => '<p>You drink water, but without insulin the BG isn\'t going anywhere.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Hydration is great, but you also need a correction dose when you\'re this high. And check ketones." Ketones: <strong>moderate</strong>.</p>' +
      '<p>You give a correction dose.</p>',
    onEnter: (s) => { doseInsulin(3); s.bg.current = 15; notify(); updateConfidence(3); },
    next: p + '-continue', continueText: 'Continue'
  });

  addPassage(p + '-continue', {
    content: (s) => '<h2>Sick Day Continues</h2>' +
      '<p>It\'s going to be one of those days. BG is coming down slowly: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "On sick days: check BG every 2 hours, keep drinking water, take corrections as needed, and eat what you can — even if you don\'t feel like it."</p>' +
      '<p>You manage through the morning with frequent checks.</p>',
    onEnter: (s) => {
      advanceTime(1.0); tick(1.0);
      // BG should be trending down from the correction
      if (s.bg.current > 12) { s.bg.current = 11; s.bg.trend = 'falling'; notify(); }
    },
    next: nextSnack, continueText: 'Continue to mid-morning'
  });

  return p;
}

// Day 5 Evening: Emotional anchor after sick day
function registerEmotionalAnchor_Day5Evening(day, nextPassage) {
  const p = 'd5-anchor-evening';
  addPassage(p, {
    content: (s) => '<h2>End of a Tough Day</h2>' +
      '<p class="passage-scene">Evening. You\'re still not 100%, but the worst is over. BG is back in range.</p>' +
      '<p><strong>' + s.companion.name + '</strong> sits with you quietly for a moment.</p>' +
      '<p>"Tough day. You handled it."</p>',
    onEnter: () => { showCompanion("I mean it. Today was hard, and you showed up."); },
    choices: [
      { text: '"Yeah. I\'m tired."', conf: 5, onSelect: () => { updateConfidence(5); }, next: p + '-resp' },
      { text: '"It wasn\'t so bad."', conf: 3, onSelect: () => { updateConfidence(3); }, next: p + '-resp' },
      { text: 'Say nothing. Just nod.', conf: 5, onSelect: () => { updateConfidence(5); }, next: p + '-resp' }
    ]
  });
  addPassage(p + '-resp', {
    content: (s) => '<p><strong>' + s.companion.name + ':</strong> "Sick days are the hardest. Not because the management is that much harder — but because you have to do all of it while feeling terrible. That takes real strength."</p>',
    onEnter: () => {
      if (collectBetaCell('bad-days-okay')) setTimeout(() => showBetaCellNotification(betaCellMap['bad-days-okay'].name, 'gold'), 500);
    },
    next: nextPassage, continueText: 'Continue'
  });
  return p;
}

// Day 7: Boss Day — framed as a field trip
function registerScriptedMorning_Day7(day, nextSnack) {
  const p = 'd7-anchor-fieldtrip';
  addPassage(p, {
    content: (s) => '<h2>Field Trip Day!</h2>' +
      // ART: Scene background — school bus / field trip destination
      '<p class="passage-scene">Day 7. The big day. Your class is going on a field trip to the science museum. A whole day out of routine.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Field trip! Exciting, but we need to think ahead. No regular meal times, lots of walking, unfamiliar food options. Let\'s pack smart."</p>' +
      '<p>You grab breakfast before the bus.</p>',
    onEnter: (s) => {
      advanceTime(0.5);
      showCompanion("Big day. Let's make sure we're prepared.");
    },
    choices: [
      { text: 'Oatmeal with berries (~30g, slow-burning)', onSelect: (s) => { eatFood(30, 'slow'); doseInsulin(recommendedDose(30, s.bg.current)); s.score.mealsManaged++; }, next: p + '-pack' },
      { text: 'Toast with peanut butter (~25g)', onSelect: (s) => { eatFood(25, 'slow'); doseInsulin(recommendedDose(25, s.bg.current)); s.score.mealsManaged++; }, next: p + '-pack' },
      { text: 'Cereal (~45g, fast-burning)', onSelect: (s) => { eatFood(45, 'fast'); doseInsulin(recommendedDose(45, s.bg.current)); s.score.mealsManaged++; }, next: p + '-pack' }
    ]
  });

  addPassage(p + '-pack', {
    content: (s) => '<h2>Pack for the Trip</h2>' +
      '<p>The bus leaves in 10 minutes. What do you make sure to bring?</p>',
    onEnter: () => { tick(0.5); advanceTime(0.5); },
    choices: [
      { text: 'Everything: insulin, meter, glucose tabs, snacks, water, medical ID, extra supplies', onSelect: () => { updateConfidence(5); state.narrative.choices['d7-packed'] = 'full'; }, next: nextSnack },
      { text: 'Essentials: insulin, glucose tabs, one snack', onSelect: () => { updateConfidence(3); state.narrative.choices['d7-packed'] = 'light'; }, next: nextSnack }
    ]
  });

  return p;
}

// Day 2: First Day Solo — morning scripted with a pre-bolus teaching moment
function registerScriptedMorning_Day2(day, nextSnack) {
  const p = 'd2-anchor-solo';
  addPassage(p, {
    content: (s) => '<h2>Breakfast, On Your Own</h2>' +
      // ART: Scene background — kitchen, morning light
      '<p class="passage-scene">The kitchen. Cereal in a bowl, milk in the fridge, banana on the counter. No one hovering.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Here\u2019s a trick \u2014 the best time to take mealtime insulin is about 10 minutes BEFORE you eat. It gives the insulin a head start so it\u2019s working when the carbs hit."</p>' +
      '<p>"Want to try pre-bolusing this morning?"</p>',
    onEnter: () => { showCompanion("Pre-bolusing is a pro move. Give it a shot."); },
    choices: [
      {
        text: 'Pre-bolus 10 minutes early, then eat',
        onSelect: (s) => {
          doseInsulin(recommendedDose(40, s.bg.current));
          advanceTime(0.17); tick(0.17);
          eatFood(40, 'fast');
          s.score.mealsManaged++;
          updateConfidence(5);
          if (collectBetaCell('pre-bolusing')) setTimeout(() => showBetaCellNotification(betaCellMap['pre-bolusing'].name, 'green'), 500);
        },
        next: p + '-good'
      },
      {
        text: 'Dose and eat at the same time (the classic way)',
        onSelect: (s) => {
          eatFood(40, 'fast');
          doseInsulin(recommendedDose(40, s.bg.current));
          s.score.mealsManaged++;
          updateConfidence(3);
        },
        next: p + '-classic'
      }
    ]
  });

  addPassage(p + '-good', {
    content: (s) => '<p>You dose first, wash up, then come back and eat. By the time the cereal hits your stomach, the insulin is already working.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "See the difference? Your BG will still rise, but much less. This is the single biggest trick for smoother meals."</p>',
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    next: nextSnack, continueText: 'Continue'
  });

  addPassage(p + '-classic', {
    content: (s) => '<p>You eat and dose together. It works \u2014 the insulin just chases the carbs a little.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Totally fine. Tomorrow, maybe try pre-bolusing once and see what happens. BG spikes a lot less."</p>',
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    next: nextSnack, continueText: 'Continue'
  });

  return p;
}

// Day 4: Soccer Practice — exercise anchor
// Replaces the social slot. Teaches pre-exercise snacking and BG monitoring during activity.
function registerScriptedExercise_Day4(day, nextPassage) {
  const p = 'd4-anchor-soccer';
  addPassage(p, {
    content: (s) => '<h2>Soccer Practice</h2>' +
      // ART: Scene background — soccer field, afternoon
      '<p class="passage-scene">After school. You\u2019re on the sideline tying your cleats. Practice starts in 10 minutes. You check your BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Exercise drops BG. A lot of it happens during, but some of it happens hours AFTER you stop. What\u2019s your plan?"</p>',
    onEnter: (s) => {
      // Force BG into a moderate range for the teaching moment
      if (s.bg.current < 6) s.bg.current = 6.5;
      if (s.bg.current > 10) s.bg.current = 8.2;
      notify();
      advanceTime(0.5);
      showCompanion("Think about it before practice starts.");
    },
    choices: [
      {
        text: 'Eat 15g of slow carbs before practice (granola bar)',
        onSelect: (s) => {
          eatFood(15, 'slow');
          s.score.snacksRemembered++;
          state.narrative.choices['d4-ex-prep'] = 'snack';
        },
        next: p + '-during'
      },
      {
        text: 'Just start \u2014 BG is in range, you\u2019ll handle it',
        onSelect: () => { state.narrative.choices['d4-ex-prep'] = 'skip'; },
        next: p + '-during'
      },
      {
        text: 'Reduce insulin (if on pump) and have glucose tabs ready',
        onSelect: (s) => {
          s.insulin.basalActive = true; // cosmetic
          state.narrative.choices['d4-ex-prep'] = 'reduce';
          updateConfidence(3);
        },
        next: p + '-during'
      }
    ]
  });

  addPassage(p + '-during', {
    content: (s) => {
      const prep = state.narrative.choices['d4-ex-prep'];
      // AUDIO: Play crowd/whistle ambient for practice
      // Simulate exercise drop
      const drop = prep === 'skip' ? 3.5 : prep === 'snack' ? 1.8 : 1.5;
      const before = s.bg.current;
      s.bg.current = Math.max(3.2, s.bg.current - drop);
      s.bg.trend = 'falling';
      notify();

      const low = s.bg.current < 5;
      return '<h2>During Practice</h2>' +
        '<p class="passage-scene">Scrimmage. Running, passing, sprinting for loose balls. 40 minutes in, you feel a bit shaky.</p>' +
        '<p>You check your BG: <strong>' + s.bg.current.toFixed(1) + '</strong> (started at ' + before.toFixed(1) + ').</p>' +
        (low
          ? '<p><strong>' + s.companion.name + ':</strong> "You\u2019re low. Time to stop and treat."</p>'
          : '<p><strong>' + s.companion.name + ':</strong> "Still in range, but trending down. Quick snack break?"</p>');
    },
    onEnter: () => { advanceTime(0.75); tick(0.75); },
    choices: [
      {
        text: 'Eat glucose tabs (15g) and sit out 15 minutes',
        onSelect: (s) => {
          eatFood(15, 'fast');
          s.bg.current = Math.max(s.bg.current, 6.2);
          s.bg.trend = 'stable';
          notify();
          updateConfidence(4);
          if (collectBetaCell('adjusting-exercise')) setTimeout(() => showBetaCellNotification(betaCellMap['adjusting-exercise'].name, 'green'), 500);
        },
        next: p + '-after'
      },
      {
        text: 'Half a juice box + keep playing gently',
        onSelect: (s) => {
          eatFood(10, 'fast');
          s.bg.current = Math.max(s.bg.current, 5.5);
          notify();
          updateConfidence(3);
        },
        next: p + '-after'
      },
      {
        text: 'Push through the last 10 minutes',
        condition: (s) => s.bg.current >= 5,
        onSelect: (s) => {
          s.bg.current = Math.max(3.2, s.bg.current - 0.8);
          notify();
          updateConfidence(-2);
        },
        next: p + '-after'
      }
    ]
  });

  addPassage(p + '-after', {
    content: (s) => '<h2>After Practice</h2>' +
      '<p class="passage-scene">You cool down, stretch, grab your bag. BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Here\u2019s the tricky part \u2014 your muscles keep pulling glucose out of your blood for hours after intense exercise. Watch for a low later tonight, and eat a solid snack with protein."</p>',
    onEnter: () => {
      advanceTime(0.5); tick(0.5);
      if (collectBetaCell('exercise-emergencies')) setTimeout(() => showBetaCellNotification(betaCellMap['exercise-emergencies'].name, 'red'), 800);
    },
    next: nextPassage, continueText: 'Head home'
  });

  return p;
}

// Day 6: Saturday Brunch — weekend rhythm, late breakfast with more choices
function registerScriptedMorning_Day6(day, nextSnack) {
  const p = 'd6-anchor-brunch';
  addPassage(p, {
    content: (s) => '<h2>Saturday Brunch</h2>' +
      // ART: Scene background — kitchen, weekend morning, sun through window
      '<p class="passage-scene">It\u2019s almost 10. Somebody in the house is making waffles. Coffee smell. A lazy morning.</p>' +
      '<p><strong>' + s.companion.name + ':</strong> "Weekend mornings are tricky because you sleep later and eat later. Your BG may have been drifting up since you woke up. Check first, then dose for what\u2019s on the plate."</p>' +
      '<p>You check: <strong>' + s.bg.current.toFixed(1) + '</strong> \u2014 ' + getBGZone(s.bg.current).label + '.</p>',
    onEnter: (s) => {
      s.time.hour = 10.0; notify();
      showCompanion("Weekend mode. Same rules, different timing.");
    },
    choices: [
      {
        text: 'Two waffles with syrup + bacon (~55g)',
        onSelect: (s) => { eatFood(55, 'fast'); doseInsulin(recommendedDose(55, s.bg.current)); s.score.mealsManaged++; state.narrative.choices['d6-brunch'] = 'waffles'; },
        next: p + '-done'
      },
      {
        text: 'Scrambled eggs + one waffle + fruit (~30g)',
        onSelect: (s) => { eatFood(30, 'slow'); doseInsulin(recommendedDose(30, s.bg.current)); s.score.mealsManaged++; updateConfidence(3); state.narrative.choices['d6-brunch'] = 'balanced'; },
        next: p + '-done'
      },
      {
        text: 'Yogurt parfait with granola and berries (~35g)',
        onSelect: (s) => { eatFood(35, 'slow'); doseInsulin(recommendedDose(35, s.bg.current)); s.score.mealsManaged++; updateConfidence(2); state.narrative.choices['d6-brunch'] = 'parfait'; },
        next: p + '-done'
      }
    ]
  });

  addPassage(p + '-done', {
    content: (s) => {
      const pick = state.narrative.choices['d6-brunch'];
      const note = pick === 'waffles'
        ? "Waffles + syrup is a lot of fast carbs. Pre-bolusing would help here \u2014 otherwise expect a bump."
        : pick === 'balanced'
          ? "Good balance. The eggs slow the waffle, and the fruit keeps it reasonable."
          : "Parfait is deceptively carby from the granola and berries, but protein and fat smooth it out.";
      return '<p><strong>' + s.companion.name + ':</strong> "' + note + '"</p>' +
        '<p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>.</p>';
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
    const tirs = s.score.timeInRange;
    const avgTIR = tirs.length > 0 ? Math.round(tirs.reduce((a, b) => a + b, 0) / tirs.length) : 70;
    const bestDay = tirs.indexOf(Math.max(...tirs)) + 1;
    const toughDay = tirs.indexOf(Math.min(...tirs)) + 1;
    const totalBC = s.score.collectiblesFound.length;
    let stars, starMsg;
    if (avgTIR >= 75) { stars = 3; starMsg = "Amazing! You handled everything like a pro. Can you do it again with new challenges?"; }
    else if (avgTIR >= 55) { stars = 2; starMsg = "Solid week! You really know your stuff. Ready for another?"; }
    else { stars = 1; starMsg = "Great start! You're learning fast. Play another week to level up!"; }

    return '<div class="summary-panel"><h2>Week ' + s.time.week + ' — Complete!</h2>' +
      '<div style="text-align:center;font-size:36px;margin:16px 0;">' + '⭐'.repeat(stars) + '</div>' +
      '<p style="text-align:center;color:var(--text-secondary);margin-bottom:20px;">' + starMsg + '</p>' +
      '<div class="summary-stat"><span class="label">Average Time in Range</span><span class="value" style="color:var(--zone-green)">' + avgTIR + '%</span></div>' +
      '<div class="tir-bar"><div class="tir-fill" style="width:' + avgTIR + '%"></div></div>' +
      '<div class="summary-stat"><span class="label">Best Day</span><span class="value">Day ' + bestDay + ' (' + (tirs[bestDay - 1] || '?') + '%)</span></div>' +
      '<div class="summary-stat"><span class="label">Toughest Day</span><span class="value">Day ' + toughDay + ' (' + (tirs[toughDay - 1] || '?') + '%)</span></div>' +
      '<div class="summary-stat"><span class="label">Beta Cells Collected</span><span class="value" style="color:var(--accent-warm)">' + totalBC + '/' + s.score.totalCollectibles + '</span></div>' +
      '<div class="summary-stat"><span class="label">Final Confidence</span><span class="value">' + s.confidence + '/100</span></div>' +
      '</div>' +
      '<div class="passage"><p><strong>' + s.companion.name + ':</strong> "' + (stars === 3 ? 'That was an incredible week. Every single day, you showed up and managed it.' : stars === 2 ? 'A really good week. You learned so much — I can see it in your confidence.' : 'First week down. It only gets easier from here. I\'m proud of you.') + '"</p></div>';
  },
  onEnter: (s) => {
    saveGame();
    showCompanion("What a week. Ready for another?", 8000);
  },
  choices: [
    { text: 'Play Another Week!', onSelect: (s) => {
      s.time.week++;
      s.time.day = 1;
      s.score.timeInRange = [];
      // Keep collectibles, confidence, companion name
      startDay(1);
    }},
    { text: 'View Journal', onSelect: () => { openJournal(); } }
  ]
});

// ============================================
// 17. SETUP PASSAGES (Title, Name, Appearance, Devices, Difficulty, Companion)
// ============================================

function registerSetupPassages() {
  const HATS = ['—','🧢','🧶','🎽','🎀'], FACES = ['😊','😎','🙂','😄','🤓'];
  const SHIRT_COLORS = ['#5b8fb9','#e85d4a','#4caf50','#ffc107','#9c27b0'];
  const SHOES = ['👟','🥾','🩴','👞','🥿'];

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
    content: () => {
      const hasSaveData = hasSave();
      // ART: Title screen background illustration
      return '<div class="title-screen"><h1>Sugar Rush</h1><p class="subtitle">A week in the life</p>' +
        (hasSaveData ? '<button class="start-btn" id="continue-btn" style="margin-bottom:12px;">Continue</button><br>' : '') +
        '<button class="start-btn" id="start-game-btn"' + (hasSaveData ? ' style="background:var(--accent);font-size:16px;padding:12px 36px;"' : '') + '>New Game</button></div>';
    },
    // AUDIO: Play title screen music
    onEnter: () => {
      setTimeout(() => {
        document.getElementById('start-game-btn')?.addEventListener('click', () => {
          if (hasSave()) {
            if (confirm('This will overwrite your current save. Continue?')) {
              deleteSave();
              renderPassage('setup-name');
            }
          } else {
            renderPassage('setup-name');
          }
        });
        document.getElementById('continue-btn')?.addEventListener('click', () => {
          if (loadGame()) {
            showHUD();
            // Resume at the start of the current day
            const day = state.time.day;
            if (day === 1) {
              renderPassage('day1-wakeup');
            } else {
              startDay(day);
            }
            showCompanion('Welcome back, ' + state.player.name + '! Picking up where we left off.');
          }
        });
      }, 50);
    }
  });

  addPassage('setup-name', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>What\'s your name?</h2><div class="creation-field"><input type="text" id="player-name" placeholder="Enter your name" maxlength="20" autofocus></div><button class="continue-btn" id="name-continue">Next</button></div>',
    onEnter: () => {
      setTimeout(() => {
        const btn = document.getElementById('name-continue'), inp = document.getElementById('player-name');
        const go = () => { const n = inp.value.trim(); if (n) { state.player.name = n; notify(); renderPassage('setup-appearance'); } else { inp.style.borderColor = 'var(--zone-red)'; inp.focus(); } };
        btn?.addEventListener('click', go);
        inp?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      }, 50);
    }
  });

  addPassage('setup-appearance', {
    noWrap: true,
    content: () => {
      const a = state.player.appearance;
      // ART: Character paper-doll preview that updates as options are selected
      return '<div class="creation-panel"><h2>Customize your look</h2>' +
        '<div class="creation-field"><label>Hat</label><div class="option-picker" data-field="hat">' + HATS.map((h,i) => '<div class="option-pick' + (a.hat===i?' selected':'') + '" data-index="'+i+'">'+h+'</div>').join('') + '</div></div>' +
        '<div class="creation-field"><label>Face</label><div class="option-picker" data-field="face">' + FACES.map((f,i) => '<div class="option-pick' + (a.face===i?' selected':'') + '" data-index="'+i+'">'+f+'</div>').join('') + '</div></div>' +
        '<div class="creation-field"><label>Shirt</label><div class="option-picker" data-field="shirt">' + SHIRT_COLORS.map((c,i) => '<div class="option-pick' + (a.shirt===i?' selected':'') + '" data-index="'+i+'"><span style="display:block;width:32px;height:32px;border-radius:6px;background:'+c+'"></span></div>').join('') + '</div></div>' +
        '<div class="creation-field"><label>Shoes</label><div class="option-picker" data-field="shoes">' + SHOES.map((s,i) => '<div class="option-pick' + (a.shoes===i?' selected':'') + '" data-index="'+i+'">'+s+'</div>').join('') + '</div></div>' +
        '<button class="continue-btn" id="appearance-continue">Next</button></div>';
    },
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.option-picker').forEach(p => {
          const f = p.dataset.field;
          p.querySelectorAll('.option-pick').forEach(o => {
            o.addEventListener('click', () => { p.querySelectorAll('.option-pick').forEach(x => x.classList.remove('selected')); o.classList.add('selected'); state.player.appearance[f] = parseInt(o.dataset.index); });
          });
        });
        document.getElementById('appearance-continue')?.addEventListener('click', () => renderPassage('setup-devices'));
      }, 50);
    }
  });

  addPassage('setup-devices', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>How do you manage your diabetes?</h2>' +
      '<div class="creation-field"><label>How do you take your insulin?</label><div class="device-choice" data-field="insulin">' +
      '<div class="device-option' + (state.player.device.insulin==='pump'?' selected':'') + '" data-value="pump"><h3>Insulin Pump</h3><p>A small device that delivers insulin throughout the day.</p></div>' +
      '<div class="device-option' + (state.player.device.insulin==='injections'?' selected':'') + '" data-value="injections"><h3>Injections</h3><p>An insulin pen or syringe. Long-acting daily, fast-acting at meals.</p></div></div></div>' +
      '<div class="creation-field"><label>How do you check your blood sugar?</label><div class="device-choice" data-field="bgMonitor">' +
      '<div class="device-option' + (state.player.device.bgMonitor==='cgm'?' selected':'') + '" data-value="cgm"><h3>CGM</h3><p>A sensor that checks your blood sugar continuously.</p></div>' +
      '<div class="device-option' + (state.player.device.bgMonitor==='fingerprick'?' selected':'') + '" data-value="fingerprick"><h3>Finger Pricks</h3><p>You prick your finger and use a meter. You\'re the detective.</p></div></div></div>' +
      '<button class="continue-btn" id="devices-continue">Next</button></div>',
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.device-choice').forEach(g => {
          const f = g.dataset.field;
          g.querySelectorAll('.device-option').forEach(o => {
            o.addEventListener('click', () => { g.querySelectorAll('.device-option').forEach(x => x.classList.remove('selected')); o.classList.add('selected'); state.player.device[f] = o.dataset.value; });
          });
        });
        document.getElementById('devices-continue')?.addEventListener('click', () => renderPassage('setup-difficulty'));
      }, 50);
    }
  });

  addPassage('setup-difficulty', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>Choose your pace</h2><div class="difficulty-choice">' +
      '<div class="difficulty-option' + (state.player.difficulty==='learning'?' selected':'') + '" data-value="learning"><h3>Learning the Ropes</h3><p>I\'m new to this and want help along the way.</p></div>' +
      '<div class="difficulty-option' + (state.player.difficulty==='gotthis'?' selected':'') + '" data-value="gotthis"><h3>I\'ve Got This</h3><p>I know some stuff. Let me figure things out.</p></div>' +
      '</div><button class="continue-btn" id="diff-continue" style="margin-top:24px">Start Day 1</button></div>',
    onEnter: () => {
      setTimeout(() => {
        document.querySelectorAll('.difficulty-option').forEach(o => {
          o.addEventListener('click', () => { document.querySelectorAll('.difficulty-option').forEach(x => x.classList.remove('selected')); o.classList.add('selected'); state.player.difficulty = o.dataset.value; });
        });
        document.getElementById('diff-continue')?.addEventListener('click', () => renderPassage('setup-companion'));
      }, 50);
    }
  });

  addPassage('setup-companion', {
    noWrap: true,
    content: () => '<div class="creation-panel"><h2>One more thing...</h2>' +
      // ART: Companion robot floating entrance animation
      '<p>A small robot floats into view. Glowing screen face, tiny antenna, an expression that\'s both friendly and slightly apologetic.</p>' +
      '<p><strong>"Hey, ' + state.player.name + '. I\'m your new companion. Your pancreas decided to take early retirement. Rude, honestly. That\'s where I come in."</strong></p>' +
      '<p>The robot does a little spin.</p>' +
      '<p><strong>"I\'ll be here all week. Want to give me a name?"</strong></p>' +
      '<div class="creation-field" style="margin-top:16px"><input type="text" id="companion-name" placeholder="Name your companion" value="Pip" maxlength="15"></div>' +
      '<button class="continue-btn" id="comp-continue">Let\'s go!</button></div>',
    onEnter: () => {
      // AUDIO: Play companion intro jingle
      setTimeout(() => {
        document.getElementById('comp-continue')?.addEventListener('click', () => {
          state.companion.name = (document.getElementById('companion-name')?.value.trim()) || 'Pip';
          state.flags.setupComplete = true;
          notify();
          showHUD();
          renderPassage('day1-wakeup');
          showCompanion('Alright, ' + state.player.name + '. Day 1. Let\'s do this.');
        });
      }, 50);
    }
  });
}

// ============================================
// 18. DAY 1 PASSAGES (Tutorial — fully scripted)
// ============================================

function registerDay1Passages() {
  addPassage('day1-wakeup', {
    content: (s) => {
      const isCGM = s.player.device.bgMonitor === 'cgm';
      // ART: Scene background — bedroom morning
      return '<h2>Day 1 — Morning</h2>' +
        '<p class="passage-scene">Your bedroom. Morning light through the curtains. The alarm goes off.</p>' +
        '<p>You open your eyes. First day of managing things yourself.</p>' +
        (isCGM
          ? '<p>You glance at your CGM. The number reads <strong>' + s.bg.current.toFixed(1) + '</strong>. The green zone is <strong>5 to 12</strong> — you\'re right in it.</p>'
          : '<p>You reach for your meter. A quick prick... <strong>' + s.bg.current.toFixed(1) + '</strong>. The green zone is <strong>5 to 12</strong> — you\'re right in it.</p>');
    },
    // AUDIO: Play morning ambient track
    onEnter: (s) => { s.time.hour = 7.0; s.bg.current = 7.2; s.bg.trend = 'stable'; notify(); showCompanion('Morning, ' + s.player.name + '! ' + s.bg.current.toFixed(1) + ' — right in the green.'); },
    next: 'day1-hud-explain', continueText: 'Continue'
  });

  addPassage('day1-hud-explain', {
    content: (s) => '<h2>Your Dashboard</h2>' +
      '<p><strong>' + s.companion.name + '</strong> gestures to the bar at the top.</p>' +
      '<p><strong>"That\'s your blood sugar meter. Green = in range. It moves based on food, insulin, and activity."</strong></p>' +
      '<p><strong>"Energy shows how you feel. In range = full energy."</strong></p>' +
      '<p><strong>"Confidence is at ' + s.confidence + '. It\'ll grow as you learn."</strong></p>',
    onEnter: () => { if (collectBetaCell('what-is-blood-sugar')) setTimeout(() => showBetaCellNotification('What is Blood Sugar?', 'blue'), 500); },
    next: 'day1-breakfast-intro', continueText: 'Time for breakfast'
  });

  addPassage('day1-breakfast-intro', {
    content: (s) => '<h2>Breakfast</h2>' +
      // ART: Scene background — kitchen morning
      '<p class="passage-scene">The kitchen. Something smells good.</p>' +
      '<p>Different foods = different carbs. Let\'s look at your options.</p>',
    onEnter: () => { advanceTime(0.5); showCompanion("Different foods, different carbs. None of these are wrong."); },
    next: 'day1-breakfast-choice'
  });

  addPassage('day1-breakfast-choice', {
    content: () => '<h2>What\'s for breakfast?</h2>' +
      '<table class="meal-options"><tr><td><strong>Cereal with milk</strong></td><td><strong>45g carbs</strong></td></tr>' +
      '<tr><td><strong>Toast with peanut butter</strong></td><td><strong>30g</strong></td></tr>' +
      '<tr><td><strong>Scrambled eggs on toast</strong></td><td><strong>20g</strong></td></tr></table>',
    choices: [
      { id: 'cereal', text: 'Cereal with milk (45g)', onSelect: (s) => { s.narrative.choices['bk-carbs'] = 45; }, next: 'day1-breakfast-dose' },
      { id: 'toast', text: 'Toast with PB (30g)', onSelect: (s) => { s.narrative.choices['bk-carbs'] = 30; }, next: 'day1-breakfast-dose' },
      { id: 'eggs', text: 'Eggs on toast (20g)', onSelect: (s) => { s.narrative.choices['bk-carbs'] = 20; }, next: 'day1-breakfast-dose' }
    ]
  });

  addPassage('day1-breakfast-dose', {
    content: (s) => {
      const c = s.narrative.choices['bk-carbs'], d = recommendedDose(c, s.bg.current);
      return '<h2>Insulin Time</h2>' +
        '<p><strong>' + c + 'g carbs</strong>. Ratio: 1 unit per 10g. That\'s about <strong>' + d + ' units</strong>.</p>' +
        (s.player.difficulty === 'learning' ? '<p>' + s.companion.name + ': "' + c + ' ÷ 10 = ' + (c/10) + ' units."</p>' : '') +
        '<div class="dose-input-group"><label>Dose:</label><input type="number" class="dose-input" id="dose-val" value="' + d + '" min="0" max="20" step="0.5"><span class="dose-unit">units</span><button class="dose-confirm" id="dose-btn">Confirm</button></div>';
    },
    onEnter: (s) => {
      setTimeout(() => {
        document.getElementById('dose-btn')?.addEventListener('click', () => {
          const dose = parseFloat(document.getElementById('dose-val')?.value) || 0;
          eatFood(s.narrative.choices['bk-carbs'], 'fast'); doseInsulin(dose);
          s.narrative.choices['bk-dose'] = dose; s.score.mealsManaged++;
          notify(); renderPassage('day1-breakfast-result');
        });
      }, 50);
    }
  });

  addPassage('day1-breakfast-result', {
    content: (s) => {
      const c = s.narrative.choices['bk-carbs'], d = s.narrative.choices['bk-dose'], ideal = recommendedDose(c, 7.2);
      const diff = Math.abs(d - ideal);
      const fb = diff <= 0.5 ? "Perfect dose." : diff <= 1.5 ? "Close enough!" : "A bit off, but this is day one.";
      return '<h2>Breakfast Done</h2><p>' + s.companion.name + ': "' + fb + '"</p>' +
        '<p>BG rises from carbs... then insulin kicks in. Smooth.</p>';
    },
    onEnter: () => {
      tick(0.5); advanceTime(0.5); tick(0.5); advanceTime(0.5); tick(0.5); advanceTime(0.5);
      if (collectBetaCell('what-are-carbs')) setTimeout(() => showBetaCellNotification('What are Carbs?', 'blue'), 800);
      showCompanion(contextualCompanionLine('afterMealGood'));
    },
    next: 'day1-morning-snack', continueText: 'Continue'
  });

  addPassage('day1-morning-snack', {
    content: (s) => '<h2>Morning Snack</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong> — ' + getBGZone(s.bg.current).label + '</p>',
    choices: [
      { text: 'Apple slices (~15g)', onSelect: (s) => { eatFood(15,'fast'); s.score.snacksRemembered++; }, next: 'day1-morning-game' },
      { text: 'Cheese and crackers (~15g)', onSelect: (s) => { eatFood(15,'slow'); s.score.snacksRemembered++; }, next: 'day1-morning-game' },
      { text: 'Almonds (~5g)', onSelect: (s) => { eatFood(5,'slow'); s.score.snacksRemembered++; }, next: 'day1-morning-game' }
    ]
  });

  addPassage('day1-morning-game', {
    content: (s) => '<h2>Carb Counter</h2>' +
      // TODO: MINI-GAME HOOK — Replace with actual Carb Counter tutorial mini-game
      // The mini-game should: Show food items, player builds a plate hitting a target carb range
      // It should return: { score: 0-3, bgEffect: number, collectible: 'carbs-everywhere' }
      '<p><em>Mini-game — simulating result.</em></p>',
    // AUDIO: Play mini-game start jingle
    onEnter: () => { advanceTime(0.5); tick(0.5); },
    choices: [{ text: 'Play Carb Counter (simulated)', next: 'day1-morning-game-result' }]
  });

  addPassage('day1-morning-game-result', {
    content: () => '<h2>Nice!</h2><p>You\'re learning which foods carry the carbs.</p>' +
      '<p><strong>Did you know?</strong> Rice and pasta: ~40-45g per cup. Broccoli: almost none.</p>',
    onEnter: () => {
      tick(0.5); advanceTime(0.5);
      if (collectBetaCell('carbs-everywhere')) setTimeout(() => showBetaCellNotification('Carbs Are Everywhere', 'green'), 500);
      showCompanion("Carbs aren't the enemy. You just need to know where they are.");
    },
    next: 'day1-lunch', continueText: 'Continue to lunch'
  });

  addPassage('day1-lunch', {
    content: () => '<h2>Lunch</h2>' +
      // ART: Scene background — school cafeteria
      '<p class="passage-scene">The cafeteria.</p>' +
      '<table class="meal-options"><tr><td><strong>Cheese pizza</strong></td><td><strong>~30g</strong></td></tr>' +
      '<tr><td><strong>Chicken wrap</strong></td><td><strong>~25g</strong></td></tr>' +
      '<tr><td><strong>Pasta</strong></td><td><strong>~50g</strong></td></tr></table>',
    onEnter: () => { advanceTime(2.0); tick(1.0); },
    choices: [
      { text: 'Pizza (~30g)', onSelect: (s) => { eatFood(30,'slow'); doseInsulin(recommendedDose(30,s.bg.current)); s.score.mealsManaged++; }, next: 'day1-lunch-social' },
      { text: 'Wrap (~25g)', onSelect: (s) => { eatFood(25,'fast'); doseInsulin(recommendedDose(25,s.bg.current)); s.score.mealsManaged++; }, next: 'day1-lunch-social' },
      { text: 'Pasta (~50g)', onSelect: (s) => { eatFood(50,'slow'); doseInsulin(recommendedDose(50,s.bg.current)); s.score.mealsManaged++; }, next: 'day1-lunch-social' }
    ]
  });

  addPassage('day1-lunch-social', {
    content: (s) => '<h2>A Friend Sits Down</h2><p>Mia: "Hey! What\'s ' + (s.player.device.insulin==='pump'?'the thing on your belt':'that pen you just used') + '?"</p>',
    onEnter: () => { tick(0.25); showCompanion("Your call. No wrong answer."); },
    choices: (s) => [
      { text: '"It\'s my insulin ' + (s.player.device.insulin==='pump'?'pump':'pen') + '. It helps me manage my diabetes."', onSelect: () => { state.narrative.choices['d1-social']='explain'; updateConfidence(5); }, next: 'day1-lunch-response' },
      { text: s.player.device.insulin==='pump' ? '"Basically a tiny computer that gives me medicine."' : '"It\'s like a needle, but for medicine I need every day."', onSelect: () => { state.narrative.choices['d1-social']='casual'; updateConfidence(5); }, next: 'day1-lunch-response' },
      { text: '"I\'d rather not talk about it right now."', onSelect: () => { state.narrative.choices['d1-social']='deflect'; updateConfidence(5); }, next: 'day1-lunch-response' }
    ]
  });

  addPassage('day1-lunch-response', {
    content: (s) => {
      const r = { explain: '"Oh cool! Does it hurt?" Genuine curiosity.', casual: '"No way, can I see?" She\'s fascinated.', deflect: '"Okay! Want some chips?" She moves right on.' };
      return '<p><strong>' + r[s.narrative.choices['d1-social']] + '</strong></p>' +
        '<p><strong>' + s.companion.name + ':</strong> "Talking about T1D gets easier with practice. Both sharing and not sharing are fine."</p>';
    },
    onEnter: () => { if (collectBetaCell('talking-to-friends')) setTimeout(() => showBetaCellNotification('Talking to Friends About T1D', 'gold'), 500); },
    next: 'day1-pm-snack', continueText: 'Continue'
  });

  addPassage('day1-pm-snack', {
    content: (s) => '<h2>Afternoon Snack</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong></p>',
    onEnter: () => { advanceTime(2.0); tick(1.0); },
    choices: [
      { text: 'Granola bar (~20g)', onSelect: (s) => { eatFood(20,'slow'); s.score.snacksRemembered++; }, next: 'day1-hypo' },
      { text: 'Yogurt (~15g)', onSelect: (s) => { eatFood(15,'fast'); s.score.snacksRemembered++; }, next: 'day1-hypo' },
      { text: 'Trail mix (~10g)', onSelect: (s) => { eatFood(10,'slow'); s.score.snacksRemembered++; }, next: 'day1-hypo' }
    ]
  });

  // Hypo tutorial
  addPassage('day1-hypo', {
    content: () => '<h2>Something Feels Off</h2><p>Shaky hands. Wobbly vision. Fast heartbeat.</p><p>BG: <strong>4.2</strong>. Below 5. You\'re going low.</p>',
    onEnter: (s) => { s.bg.current = 4.2; s.bg.trend = 'falling'; advanceTime(0.5); notify(); showCompanion('You\'re low. Let\'s handle it.'); },
    next: 'day1-hypo-lesson', continueText: 'What do I do?'
  });

  addPassage('day1-hypo-lesson', {
    content: (s) => '<h2>The 15-15 Rule</h2><p><strong>' + s.companion.name + ':</strong></p>' +
      '<ol><li><strong>15 grams</strong> of fast-acting sugar</li><li>Wait <strong>15 minutes</strong></li><li>Recheck. If still low, repeat.</li></ol>' +
      '<p>"Fast-acting = juice, glucose tabs, regular soda. NOT chocolate. NOT diet soda."</p>',
    choices: [
      { text: 'Juice box (15g, fast)', onSelect: (s) => { s.narrative.choices['hypo']='perfect'; }, next: 'day1-hypo-result' },
      { text: 'Glucose tabs x3 (15g, fast)', onSelect: (s) => { s.narrative.choices['hypo']='perfect'; }, next: 'day1-hypo-result' },
      { text: 'Candy bar (30g, has fat)', onSelect: (s) => { s.narrative.choices['hypo']='toomuch'; }, next: 'day1-hypo-result' },
      { text: 'Diet soda (0g sugar)', onSelect: (s) => { s.narrative.choices['hypo']='nosugar'; }, next: 'day1-hypo-result' }
    ]
  });

  addPassage('day1-hypo-result', {
    content: (s) => {
      const t = s.narrative.choices['hypo'];
      if (t === 'perfect') return '<h2>Good call.</h2><p>15g fast sugar. 15 minutes... <strong>5.8</strong>. Back in the green.</p>';
      if (t === 'toomuch') return '<h2>That\'ll work, but...</h2><p>30g is double what you need. You\'ll rebound high. <strong>8.5</strong>.</p>';
      return '<h2>That won\'t help.</h2><p>Diet soda = 0 sugar. You grab juice instead. <strong>5.8</strong>.</p>';
    },
    onEnter: (s) => {
      if (s.narrative.choices['hypo'] === 'toomuch') { s.bg.current = 8.5; eatFood(30,'slow'); }
      else { s.bg.current = 5.8; eatFood(15,'fast'); }
      s.bg.trend = 'rising'; notify();
      if (collectBetaCell('fifteen-fifteen-rule')) setTimeout(() => showBetaCellNotification('The 15-15 Rule', 'green'), 800);
    },
    next: 'day1-late-snack', continueText: 'Continue'
  });

  addPassage('day1-late-snack', {
    content: (s) => '<h2>Late Afternoon Snack</h2><p>' + s.companion.name + ': "After that low, your body needs fuel."</p>',
    onEnter: () => { advanceTime(1.5); tick(0.5); },
    choices: [
      { text: 'Cheese and crackers (~15g)', onSelect: (s) => { eatFood(15,'slow'); s.score.snacksRemembered++; }, next: 'day1-dinner' },
      { text: 'Apple with PB (~20g)', onSelect: (s) => { eatFood(20,'slow'); s.score.snacksRemembered++; }, next: 'day1-dinner' }
    ]
  });

  addPassage('day1-dinner', {
    content: (s) => '<h2>Dinner</h2>' +
      // ART: Scene background — home kitchen evening
      '<p class="passage-scene">Home. Stir-fry: rice, chicken, veggies. No label.</p>' +
      '<p>' + s.companion.name + ': "Rice ~45g, chicken ~0, veggies ~5. Total ~50g."</p><p>How many carbs?</p>',
    onEnter: () => { advanceTime(1.5); tick(1.0); },
    choices: [
      { text: 'About 25g', onSelect: (s) => { s.narrative.choices['d1-dinner']=25; }, next: 'day1-dinner-result' },
      { text: 'About 50g', onSelect: (s) => { s.narrative.choices['d1-dinner']=50; }, next: 'day1-dinner-result' },
      { text: 'About 75g', onSelect: (s) => { s.narrative.choices['d1-dinner']=75; }, next: 'day1-dinner-result' }
    ]
  });

  addPassage('day1-dinner-result', {
    content: (s) => {
      const e = s.narrative.choices['d1-dinner'], diff = Math.abs(e - 50);
      const fb = diff <= 10 ? "About 50g — nice!" : e < 50 ? (e + "g is a bit low." ) : (e + "g is a bit high.");
      return '<p>' + s.companion.name + ': "' + fb + ' Estimating gets easier."</p>';
    },
    onEnter: (s) => {
      eatFood(50,'slow'); doseInsulin(recommendedDose(50,s.bg.current)); s.score.mealsManaged++;
      tick(0.5); advanceTime(0.5);
      if (collectBetaCell('estimating-carbs')) setTimeout(() => showBetaCellNotification('Estimating Carbs Without Labels', 'green'), 800);
    },
    next: 'day1-dinner-social', continueText: 'Continue'
  });

  addPassage('day1-dinner-social', {
    content: () => '<h2>Dinner Conversation</h2><p>Someone asks how your day went.</p>',
    choices: [
      { text: '"Pretty good! Learning a lot."', onSelect: () => { updateConfidence(3); }, next: 'day1-evening' },
      { text: '"It\'s a lot to think about."', onSelect: () => { updateConfidence(3); }, next: 'day1-evening' },
      { text: '"Can we talk about something else?"', onSelect: () => { updateConfidence(3); }, next: 'day1-evening' }
    ]
  });

  addPassage('day1-evening', {
    content: (s) => '<h2>Evening</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. ' + getBGZone(s.bg.current).label + '.</p>',
    onEnter: () => { advanceTime(1.5); tick(1.0); },
    choices: [
      { text: 'Relax', next: 'day1-bedtime' },
      { text: 'Check your journal', onSelect: () => { openJournal(); }, next: 'day1-bedtime' }
    ]
  });

  addPassage('day1-bedtime', {
    content: (s) => '<h2>Bedtime Snack</h2><p>' + s.companion.name + ': "Bedtime snack = steady overnight BG."</p>',
    onEnter: () => { advanceTime(1.5); tick(0.5); },
    choices: [
      { text: 'Crackers with cheese (~15g)', onSelect: (s) => { eatFood(15,'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: 'day1-final-check' },
      { text: 'Glass of milk (~12g)', onSelect: (s) => { eatFood(12,'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: 'day1-final-check' },
      { text: 'Toast with butter (~15g)', onSelect: (s) => { eatFood(15,'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; }, next: 'day1-final-check' }
    ]
  });

  addPassage('day1-final-check', {
    content: (s) => {
      const ok = s.bg.current >= 5 && s.bg.current <= 12;
      return '<h2>Final Check</h2><p>BG: <strong>' + s.bg.current.toFixed(1) + '</strong>. ' + (ok ? 'Looking good.' : 'Safe enough.') + '</p>';
    },
    onEnter: () => {
      tick(0.5);
      if (collectBetaCell('bedtime-snacks')) setTimeout(() => showBetaCellNotification('Why Bedtime Snacks Matter', 'green'), 500);
    },
    next: 'day1-end', continueText: 'Go to sleep'
  });

  addPassage('day1-end', {
    noWrap: true,
    content: (s) => {
      // AUDIO: Play end-of-day summary fanfare
      const samples = s.score.bgSamples;
      const inRange = samples.filter(x => x.value >= 5 && x.value <= 12).length;
      const tir = samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 80;
      return '<div class="summary-panel"><h2>Day 1 — Complete</h2>' +
        '<div class="summary-stat"><span class="label">Time in Range</span><span class="value" style="color:var(--zone-green)">' + tir + '%</span></div>' +
        '<div class="tir-bar"><div class="tir-fill" style="width:' + tir + '%"></div></div>' +
        '<div class="summary-stat"><span class="label">Meals</span><span class="value">' + s.score.mealsManaged + '/4</span></div>' +
        '<div class="summary-stat"><span class="label">Snacks</span><span class="value">' + s.score.snacksRemembered + '/3</span></div>' +
        '<div class="summary-stat"><span class="label">Beta Cells</span><span class="value" style="color:var(--accent-warm)">' + s.score.collectiblesFound.length + '/' + s.score.totalCollectibles + '</span></div>' +
        '<div class="summary-stat"><span class="label">Confidence</span><span class="value">' + s.confidence + '</span></div></div>' +
        '<div class="passage"><p><strong>' + s.companion.name + ':</strong> "Day 1 done. You handled it."</p></div>';
    },
    onEnter: (s) => {
      const samples = s.score.bgSamples;
      const inRange = samples.filter(x => x.value >= 5 && x.value <= 12).length;
      s.score.timeInRange.push(samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 80);
      saveGame();
      showCompanion("Day 1 done. You should be proud.", 5000);
    },
    choices: [{
      text: 'Start Day 2',
      onSelect: () => { state.time.day = 2; startDay(2); }
    }]
  });
}

// ============================================
// 19. INIT
// ============================================

function init() {
  registerSetupPassages();
  registerDay1Passages();
  registerLowBGRescuePassages();
  initHUD();
  renderPassage('dedication');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

return { state, renderPassage, startDay, openJournal, saveGame, loadGame };
})();
