// ============================================
// SETUP PASSAGES — Title screen & character creation
// ============================================

import { state, notify } from '../engine/game-state.js';
import { renderPassage, renderScreen, addPassages } from '../engine/narrative.js';
import { showHUD } from '../hud/hud.js';
import { showCompanion } from '../companion/companion.js';

// Cosmetic options
const HATS = ['None', 'Cap', 'Beanie', 'Headband', 'Bow'];
const FACES = ['😊', '😎', '🙂', '😄', '🤓'];
const SHIRTS = ['Blue', 'Red', 'Green', 'Yellow', 'Purple'];
const SHOES = ['Sneakers', 'Boots', 'Sandals', 'Hi-tops', 'Slip-ons'];

export function registerSetupPassages() {

  addPassages({

    // ---- TITLE SCREEN ----
    'title': {
      content: () => `
        <div class="title-screen">
          <h1>Sugar Rush</h1>
          <p class="subtitle">A week in the life</p>
          <button class="start-btn" id="start-game-btn">New Game</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          const btn = document.getElementById('start-game-btn');
          if (btn) {
            btn.addEventListener('click', () => renderPassage('setup-name'));
          }
        }, 50);
      }
    },

    // ---- NAME ----
    'setup-name': {
      content: () => `
        <div class="creation-panel">
          <h2>What's your name?</h2>
          <div class="creation-field">
            <input type="text" id="player-name" placeholder="Enter your name" maxlength="20" autofocus>
          </div>
          <button class="continue-btn" id="name-continue">Next</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          const btn = document.getElementById('name-continue');
          const input = document.getElementById('player-name');
          if (btn && input) {
            const proceed = () => {
              const name = input.value.trim();
              if (name.length > 0) {
                state.player.name = name;
                notify();
                renderPassage('setup-appearance');
              } else {
                input.focus();
                input.style.borderColor = 'var(--zone-red)';
              }
            };
            btn.addEventListener('click', proceed);
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') proceed();
            });
          }
        }, 50);
      }
    },

    // ---- APPEARANCE ----
    'setup-appearance': {
      content: () => `
        <div class="creation-panel">
          <h2>Customize your look</h2>

          <div class="creation-field">
            <label>Hat</label>
            <div class="option-picker" data-field="hat">
              ${HATS.map((h, i) => `<div class="option-pick${state.player.appearance.hat === i ? ' selected' : ''}" data-index="${i}">${['—', '🧢', '🧶', '🎽', '🎀'][i]}</div>`).join('')}
            </div>
          </div>

          <div class="creation-field">
            <label>Face</label>
            <div class="option-picker" data-field="face">
              ${FACES.map((f, i) => `<div class="option-pick${state.player.appearance.face === i ? ' selected' : ''}" data-index="${i}">${f}</div>`).join('')}
            </div>
          </div>

          <div class="creation-field">
            <label>Shirt</label>
            <div class="option-picker" data-field="shirt">
              ${SHIRTS.map((s, i) => `<div class="option-pick${state.player.appearance.shirt === i ? ' selected' : ''}" data-index="${i}"><span style="display:block;width:32px;height:32px;border-radius:6px;background:${['#5b8fb9','#e85d4a','#4caf50','#ffc107','#9c27b0'][i]}"></span></div>`).join('')}
            </div>
          </div>

          <div class="creation-field">
            <label>Shoes</label>
            <div class="option-picker" data-field="shoes">
              ${SHOES.map((s, i) => `<div class="option-pick${state.player.appearance.shoes === i ? ' selected' : ''}" data-index="${i}">${['👟','🥾','🩴','👞','🥿'][i]}</div>`).join('')}
            </div>
          </div>

          <button class="continue-btn" id="appearance-continue">Next</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          // Wire up option pickers
          document.querySelectorAll('.option-picker').forEach(picker => {
            const field = picker.dataset.field;
            picker.querySelectorAll('.option-pick').forEach(opt => {
              opt.addEventListener('click', () => {
                picker.querySelectorAll('.option-pick').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                state.player.appearance[field] = parseInt(opt.dataset.index);
              });
            });
          });

          document.getElementById('appearance-continue')?.addEventListener('click', () => {
            renderPassage('setup-devices');
          });
        }, 50);
      }
    },

    // ---- DEVICES ----
    'setup-devices': {
      content: () => `
        <div class="creation-panel">
          <h2>How do you manage your diabetes?</h2>

          <div class="creation-field">
            <label>How do you take your insulin?</label>
            <div class="device-choice" data-field="insulin">
              <div class="device-option${state.player.device.insulin === 'pump' ? ' selected' : ''}" data-value="pump">
                <h3>Insulin Pump</h3>
                <p>A small device that delivers insulin throughout the day. You program it for meals.</p>
              </div>
              <div class="device-option${state.player.device.insulin === 'injections' ? ' selected' : ''}" data-value="injections">
                <h3>Injections</h3>
                <p>You use an insulin pen or syringe. A long-acting shot once or twice daily, plus fast-acting at meals.</p>
              </div>
            </div>
          </div>

          <div class="creation-field">
            <label>How do you check your blood sugar?</label>
            <div class="device-choice" data-field="bgMonitor">
              <div class="device-option${state.player.device.bgMonitor === 'cgm' ? ' selected' : ''}" data-value="cgm">
                <h3>CGM</h3>
                <p>A sensor on your body that checks your blood sugar all the time. You can always see your number.</p>
              </div>
              <div class="device-option${state.player.device.bgMonitor === 'fingerprick' ? ' selected' : ''}" data-value="fingerprick">
                <h3>Finger Pricks</h3>
                <p>You prick your finger and use a meter to check. You decide when to check — you're the detective.</p>
              </div>
            </div>
          </div>

          <button class="continue-btn" id="devices-continue">Next</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          document.querySelectorAll('.device-choice').forEach(group => {
            const field = group.dataset.field;
            group.querySelectorAll('.device-option').forEach(opt => {
              opt.addEventListener('click', () => {
                group.querySelectorAll('.device-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                state.player.device[field] = opt.dataset.value;
              });
            });
          });

          document.getElementById('devices-continue')?.addEventListener('click', () => {
            renderPassage('setup-difficulty');
          });
        }, 50);
      }
    },

    // ---- DIFFICULTY ----
    'setup-difficulty': {
      content: () => `
        <div class="creation-panel">
          <h2>Choose your pace</h2>
          <div class="difficulty-choice">
            <div class="difficulty-option${state.player.difficulty === 'learning' ? ' selected' : ''}" data-value="learning">
              <h3>Learning the Ropes</h3>
              <p>I'm new to this and want help along the way. More tips, gentler pacing, and a friendly guide.</p>
            </div>
            <div class="difficulty-option${state.player.difficulty === 'gotthis' ? ' selected' : ''}" data-value="gotthis">
              <h3>I've Got This</h3>
              <p>I know some stuff. Let me figure things out. Hints only when I ask.</p>
            </div>
          </div>
          <button class="continue-btn" id="difficulty-continue" style="margin-top: 24px;">Start Day 1</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          document.querySelectorAll('.difficulty-option').forEach(opt => {
            opt.addEventListener('click', () => {
              document.querySelectorAll('.difficulty-option').forEach(o => o.classList.remove('selected'));
              opt.classList.add('selected');
              state.player.difficulty = opt.dataset.value;
            });
          });

          document.getElementById('difficulty-continue')?.addEventListener('click', () => {
            renderPassage('setup-companion');
          });
        }, 50);
      }
    },

    // ---- COMPANION INTRO ----
    'setup-companion': {
      content: () => `
        <div class="creation-panel">
          <h2>One more thing...</h2>
          <p>A small robot floats into view. It has a glowing screen for a face, a tiny antenna, and an expression that somehow manages to look both friendly and slightly apologetic.</p>
          <p><strong>"Hey, ${state.player.name}. I'm your new companion. Your pancreas decided to take early retirement. Rude, honestly. That's where I come in."</strong></p>
          <p>The robot does a little spin.</p>
          <p><strong>"I'll be here all week — helping you keep track of things, learning alongside you, and occasionally making observations nobody asked for. Want to give me a name?"</strong></p>
          <div class="creation-field" style="margin-top: 16px;">
            <input type="text" id="companion-name" placeholder="Name your companion" value="Pip" maxlength="15">
          </div>
          <button class="continue-btn" id="companion-continue">Let's go!</button>
        </div>
      `,
      onEnter: () => {
        setTimeout(() => {
          const btn = document.getElementById('companion-continue');
          const input = document.getElementById('companion-name');
          if (btn) {
            btn.addEventListener('click', () => {
              state.companion.name = (input?.value.trim()) || 'Pip';
              state.flags.setupComplete = true;
              state.flags.companionIntroduced = true;
              notify();
              // Transition to Day 1
              showHUD();
              renderPassage('day1-wakeup');
              showCompanion(`Alright, ${state.player.name}. Day 1. Let's do this.`);
            });
          }
        }, 50);
      }
    }

  });
}
