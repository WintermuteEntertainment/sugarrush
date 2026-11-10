// ============================================
// DAY 1 PASSAGES — Tutorial Day
// "Welcome to the Club"
// Fully scripted. Every beat is fixed.
// ============================================

import { state, advanceTime, collectBetaCell, updateConfidence, notify } from '../engine/game-state.js';
import { eatFood, doseInsulin, recommendedDose, tick, getBGZone } from '../engine/bg-simulation.js';
import { addPassages, renderPassage } from '../engine/narrative.js';
import { showCompanion, sayCompanion, randomLine, setMood } from '../companion/companion.js';

export function registerDay1Passages() {

  addPassages({

    // ============ 7:00 — WAKE UP ============
    'day1-wakeup': {
      content: (s) => {
        const monitorType = s.player.device.bgMonitor;
        const bgVal = s.bg.current.toFixed(1);
        return `
          <h2>Day 1 — Morning</h2>
          <p class="passage-scene">Your bedroom. Morning light through the curtains. The alarm goes off.</p>
          <p>You open your eyes. First day of the rest of your life — well, first day of managing things yourself, anyway. Time to check in.</p>
          ${monitorType === 'cgm'
            ? `<p>You glance at your CGM. The number on the screen reads <strong>${bgVal}</strong>. The green zone is <strong>5 to 12</strong> — and you're right in it.</p>`
            : `<p>You reach for your meter on the nightstand. A quick prick, a few seconds of waiting... <strong>${bgVal}</strong>. The green zone is <strong>5 to 12</strong> — and you're right in it.</p>`
          }
        `;
      },
      onEnter: (s) => {
        s.time.hour = 7.0;
        s.bg.current = 7.2;
        s.bg.trend = 'stable';
        sayCompanion(`Morning, ${s.player.name}! Let's see where we're at. ${s.bg.current.toFixed(1)} — right in the green. Good start.`);
        setMood('happy');
      },
      next: 'day1-wakeup-hud',
      continueText: 'Continue'
    },

    'day1-wakeup-hud': {
      content: (s) => `
        <h2>Your Dashboard</h2>
        <p>${s.companion.name} gestures to the bar at the top of your screen.</p>
        <p><strong>"See that bar up top? That's your blood sugar meter. Green means you're in range. It'll move throughout the day based on what you eat, your insulin, and what you do."</strong></p>
        <p><strong>"The lightning bolt is your energy. When your blood sugar is in range, you feel great. When it goes too high or too low... well, you'll see."</strong></p>
        <p><strong>"And the number next to 'Confidence'? That's how you're feeling about handling all this. It'll grow as you learn. Right now you're at ${s.confidence}. Totally normal."</strong></p>
      `,
      onEnter: (s) => {
        if (collectBetaCell('what-is-blood-sugar')) {
          setTimeout(() => showBetaCellNotification('What is Blood Sugar?', 'blue'), 500);
        }
      },
      next: 'day1-breakfast-intro',
      continueText: 'Time for breakfast'
    },

    // ============ 7:30 — BREAKFAST ============
    'day1-breakfast-intro': {
      content: (s) => `
        <h2>Breakfast</h2>
        <p class="passage-scene">The kitchen. Morning sun. Something smells good.</p>
        <p>Time to eat. But here's the thing — different foods affect your blood sugar differently. Foods with more <strong>carbs</strong> raise it more.</p>
        <p><strong>${s.companion.name}:</strong> "Let's look at your options."</p>
      `,
      onEnter: (s) => {
        advanceTime(0.5);
        sayCompanion("Different foods, different carbs. None of these are wrong — let's just learn what's in them.");
        setMood('happy');
      },
      next: 'day1-breakfast-choice'
    },

    'day1-breakfast-choice': {
      content: (s) => `
        <h2>What's for breakfast?</h2>
        <table class="meal-options">
          <tr><td><strong>Cereal with milk</strong></td><td>A bowl of your favourite cereal. The box says <strong>45g of carbs</strong>.</td></tr>
          <tr><td><strong>Toast with peanut butter</strong></td><td>Two slices with peanut butter. The bread has carbs, the PB not so much. About <strong>30g total</strong>.</td></tr>
          <tr><td><strong>Scrambled eggs on toast</strong></td><td>Eggs are almost zero carbs, but the toast has some. About <strong>20g total</strong>.</td></tr>
        </table>
      `,
      choices: [
        {
          id: 'cereal',
          text: 'Cereal with milk (45g carbs)',
          onSelect: (s) => { s.narrative.choices['breakfast-carbs'] = 45; },
          next: 'day1-breakfast-dose'
        },
        {
          id: 'toast-pb',
          text: 'Toast with peanut butter (30g carbs)',
          onSelect: (s) => { s.narrative.choices['breakfast-carbs'] = 30; },
          next: 'day1-breakfast-dose'
        },
        {
          id: 'eggs-toast',
          text: 'Scrambled eggs on toast (20g carbs)',
          onSelect: (s) => { s.narrative.choices['breakfast-carbs'] = 20; },
          next: 'day1-breakfast-dose'
        }
      ]
    },

    'day1-breakfast-dose': {
      content: (s) => {
        const carbs = s.narrative.choices['breakfast-carbs'];
        const dose = recommendedDose(carbs, s.bg.current);
        const deviceText = s.player.device.insulin === 'pump'
          ? 'tap your pump and dial in'
          : 'dial up your pen to';
        return `
          <h2>Insulin Time</h2>
          <p>You chose a meal with <strong>${carbs}g of carbs</strong>. Now you need insulin to help your body use those carbs.</p>
          <p><strong>${s.companion.name}:</strong> "Your <strong>insulin-to-carb ratio</strong> is 1 unit for every 10g of carbs. So for ${carbs}g, you need about <strong>${dose} units</strong>."</p>
          ${s.player.difficulty === 'learning'
            ? `<p>"Just ${deviceText} <strong>${dose}</strong> and confirm. I'll walk you through the math: ${carbs}g ÷ 10 = ${carbs/10} units.${dose !== carbs/10 ? ` Plus a small correction since your BG is ${s.bg.current.toFixed(1)}.` : ''}"</p>`
            : `<p>"${carbs}g of carbs, ratio of 1:10. How much insulin?"</p>`
          }
          <div class="dose-input-group">
            <label>Dose:</label>
            <input type="number" class="dose-input" id="dose-value" value="${dose}" min="0" max="20" step="0.5">
            <span class="dose-unit">units</span>
            <button class="dose-confirm" id="dose-confirm-btn">Confirm</button>
          </div>
        `;
      },
      onEnter: (s) => {
        setTimeout(() => {
          document.getElementById('dose-confirm-btn')?.addEventListener('click', () => {
            const input = document.getElementById('dose-value');
            const dose = parseFloat(input?.value) || 0;
            const carbs = s.narrative.choices['breakfast-carbs'];

            // Apply the meal and dose to the simulation
            eatFood(carbs, 'fast');
            doseInsulin(dose, 'meal');

            s.narrative.choices['breakfast-dose'] = dose;
            s.score.mealsManaged++;
            notify();
            renderPassage('day1-breakfast-result');
          });
        }, 50);
      }
    },

    'day1-breakfast-result': {
      content: (s) => {
        const carbs = s.narrative.choices['breakfast-carbs'];
        const dose = s.narrative.choices['breakfast-dose'];
        const ideal = recommendedDose(carbs, 7.2);
        const diff = Math.abs(dose - ideal);
        let feedback;
        if (diff <= 0.5) {
          feedback = "Perfect dose. The insulin will start working in about 15 minutes and keep going for a few hours.";
        } else if (diff <= 1.5) {
          feedback = "Close enough! You might run a little " + (dose < ideal ? "high" : "low") + " but nothing to worry about. You'll get a feel for this.";
        } else {
          feedback = "That's a bit " + (dose < ideal ? "under — you might run high" : "over — watch for a low") + " later. No stress, this is day one.";
        }
        return `
          <h2>Breakfast Done</h2>
          <p>You eat your meal and take your insulin.</p>
          <p><strong>${s.companion.name}:</strong> "${feedback}"</p>
          <p>You watch the BG meter. It rises a little from the carbs... then the insulin kicks in and starts bringing it back down. Smooth.</p>
        `;
      },
      onEnter: (s) => {
        // Simulate breakfast time passing (1.5 hours)
        tick(0.5);
        advanceTime(0.5);
        tick(0.5);
        advanceTime(0.5);
        tick(0.5);
        advanceTime(0.5);
        if (collectBetaCell('what-are-carbs')) {
          setTimeout(() => showBetaCellNotification('What are Carbs?', 'blue'), 800);
        }
        sayCompanion(randomLine('afterMealGood'));
        setMood('happy');
      },
      next: 'day1-morning-snack',
      continueText: 'Continue to mid-morning'
    },

    // ============ 9:00 — MORNING SNACK ============
    'day1-morning-snack': {
      content: (s) => `
        <h2>Morning Snack</h2>
        <p class="passage-scene">A couple of hours have passed. ${s.companion.name} nudges you.</p>
        <p><strong>${s.companion.name}:</strong> "It's been a while since breakfast. A small snack keeps your energy steady and your blood sugar from dipping too low."</p>
        <p>Your BG is currently <strong>${s.bg.current.toFixed(1)}</strong> — ${getBGZone(s.bg.current).label.toLowerCase()}.</p>
      `,
      onEnter: () => {
        sayCompanion("Snack time. Nothing big — just enough to keep things steady.");
      },
      choices: [
        {
          id: 'apple',
          text: 'Apple slices (~15g carbs)',
          onSelect: (s) => {
            eatFood(15, 'fast');
            s.score.snacksRemembered++;
          },
          next: 'day1-morning-snack-done'
        },
        {
          id: 'cheese-crackers',
          text: 'Cheese and crackers (~15g carbs)',
          onSelect: (s) => {
            eatFood(15, 'slow');
            s.score.snacksRemembered++;
          },
          next: 'day1-morning-snack-done'
        },
        {
          id: 'nuts',
          text: 'Handful of almonds (~5g carbs)',
          onSelect: (s) => {
            eatFood(5, 'slow');
            s.score.snacksRemembered++;
          },
          next: 'day1-morning-snack-done'
        }
      ]
    },

    'day1-morning-snack-done': {
      content: (s) => `
        <p>You grab your snack. Quick and easy.</p>
        <p><strong>${s.companion.name}:</strong> "For a small snack like this, you might not even need insulin — depends on the carbs and where your number is. You'll get a feel for it."</p>
      `,
      onEnter: (s) => {
        tick(0.5);
        advanceTime(0.5);
      },
      next: 'day1-morning-activity',
      continueText: 'On to morning activity'
    },

    // ============ 9:30 — MORNING MINI-GAME INTRO ============
    'day1-morning-activity': {
      content: (s) => `
        <h2>Morning Activity — Carb Counter</h2>
        <p class="passage-scene">Time for a quick challenge.</p>
        <p><strong>${s.companion.name}:</strong> "Pop quiz! Not really — it's more of a game. Let's see how well you can spot carbs."</p>
        <p>Food items will appear. Build a plate that hits the <strong>target carb range</strong>. The closer you get, the better your blood sugar will be afterward.</p>
        <p><em>This is the Carb Counter mini-game. For now, we'll simulate the result.</em></p>
      `,
      onEnter: () => {
        advanceTime(0.5);
        sayCompanion("Let's see what you know about carbs!");
        setMood('happy');
      },
      choices: [
        {
          text: 'Play Carb Counter (simulated)',
          next: 'day1-morning-game-result'
        }
      ]
    },

    'day1-morning-game-result': {
      content: (s) => `
        <h2>Nice work!</h2>
        <p>You built a solid plate. You're starting to recognize which foods carry the carbs and which don't.</p>
        <p><strong>Did you know?</strong> Rice and pasta have similar carbs — about 40-45g per cup. But vegetables like broccoli and lettuce have almost none.</p>
      `,
      onEnter: (s) => {
        tick(0.5);
        advanceTime(0.5);
        if (collectBetaCell('carbs-everywhere')) {
          setTimeout(() => showBetaCellNotification('Carbs Are Everywhere (And That\'s Okay)', 'green'), 500);
        }
        sayCompanion("You're getting it. Carbs aren't the enemy — you just need to know where they are.");
        setMood('proud');
      },
      next: 'day1-lunch-intro',
      continueText: 'Continue to lunch'
    },

    // ============ 11:30 — LUNCH ============
    'day1-lunch-intro': {
      content: (s) => `
        <h2>Lunch</h2>
        <p class="passage-scene">The cafeteria. Buzzing with noise. You grab a tray.</p>
        <p>Today's options are on the board.</p>
        <table class="meal-options">
          <tr><td><strong>Cheese pizza</strong> (1 slice)</td><td>The classic. Doughy and delicious. <strong>~30g carbs</strong>.</td></tr>
          <tr><td><strong>Chicken wrap</strong></td><td>Comes with a nutrition label. <strong>~25g carbs</strong>.</td></tr>
          <tr><td><strong>Pasta with tomato sauce</strong></td><td>A big bowl. Pasta is carb-heavy. <strong>~50g carbs</strong>.</td></tr>
        </table>
      `,
      onEnter: (s) => {
        advanceTime(2.0);
        tick(1.0);
        sayCompanion("Lunchtime. Pick what sounds good — we'll figure out the carbs together.");
      },
      choices: [
        {
          id: 'pizza',
          text: 'Cheese pizza (~30g carbs)',
          onSelect: (s) => {
            s.narrative.choices['lunch-carbs'] = 30;
            eatFood(30, 'slow');
            doseInsulin(recommendedDose(30, s.bg.current), 'meal');
            s.score.mealsManaged++;
          },
          next: 'day1-lunch-social'
        },
        {
          id: 'wrap',
          text: 'Chicken wrap (~25g carbs)',
          onSelect: (s) => {
            s.narrative.choices['lunch-carbs'] = 25;
            eatFood(25, 'fast');
            doseInsulin(recommendedDose(25, s.bg.current), 'meal');
            s.score.mealsManaged++;
          },
          next: 'day1-lunch-social'
        },
        {
          id: 'pasta',
          text: 'Pasta with tomato sauce (~50g carbs)',
          onSelect: (s) => {
            s.narrative.choices['lunch-carbs'] = 50;
            eatFood(50, 'slow');
            doseInsulin(recommendedDose(50, s.bg.current), 'meal');
            s.score.mealsManaged++;
          },
          next: 'day1-lunch-social'
        }
      ]
    },

    // ---- LUNCH SOCIAL BEAT ----
    'day1-lunch-social': {
      content: (s) => {
        const deviceName = s.player.device.insulin === 'pump'
          ? 'the thing on your belt'
          : 'that pen you just used';
        return `
          <h2>A Friend Sits Down</h2>
          <p>You take your insulin and start eating. A friend — Mia — slides into the seat across from you.</p>
          <p><strong>Mia:</strong> "Hey! What's ${deviceName}? I've been wanting to ask."</p>
        `;
      },
      onEnter: (s) => {
        tick(0.25);
        sayCompanion("Your call how you handle this. There's no wrong answer.");
        setMood('happy');
      },
      choices: [
        {
          id: 'explain',
          text: `"It's my insulin ${state.player.device.insulin === 'pump' ? 'pump' : 'pen'}. It helps me manage my diabetes."`,
          onSelect: (s) => {
            s.narrative.choices['social-lunch'] = 'explain';
            updateConfidence(5);
          },
          next: 'day1-lunch-social-response'
        },
        {
          id: 'casual',
          text: '"It\'s basically a tiny computer that gives me medicine. Pretty cool actually."',
          onSelect: (s) => {
            s.narrative.choices['social-lunch'] = 'casual';
            updateConfidence(5);
          },
          next: 'day1-lunch-social-response'
        },
        {
          id: 'deflect',
          text: '"I\'d rather not talk about it right now."',
          onSelect: (s) => {
            s.narrative.choices['social-lunch'] = 'deflect';
            updateConfidence(5);
          },
          next: 'day1-lunch-social-response'
        }
      ]
    },

    'day1-lunch-social-response': {
      content: (s) => {
        const choice = s.narrative.choices['social-lunch'];
        const responses = {
          explain: '<p><strong>Mia:</strong> "Oh cool! Does it hurt?" She seems genuinely interested, not weird about it. You chat for a bit about how it works. It feels... pretty normal, actually.</p>',
          casual: '<p><strong>Mia:</strong> "No way, that IS cool. Can I see?" She leans in, fascinated. You show her, and she\'s impressed. "It\'s like being a cyborg!"</p>',
          deflect: '<p><strong>Mia:</strong> "Oh, okay! Want some of my chips?" She moves right on. No pressure, no awkwardness. Just... respect.</p>'
        };
        return `
          ${responses[choice]}
          <p><strong>${s.companion.name}</strong> <em>(quietly)</em>: "Talking to people about T1D gets easier with practice. Some days you'll want to share, some days you won't. Both are fine."</p>
        `;
      },
      onEnter: (s) => {
        if (collectBetaCell('talking-to-friends')) {
          setTimeout(() => showBetaCellNotification('Talking to Friends About T1D', 'gold'), 500);
        }
      },
      next: 'day1-afternoon-snack',
      continueText: 'Continue to afternoon'
    },

    // ============ 14:00 — AFTERNOON SNACK ============
    'day1-afternoon-snack': {
      content: (s) => `
        <h2>Afternoon Snack</h2>
        <p class="passage-scene">Early afternoon. Time for a snack before the next activity.</p>
        <p>Your BG is <strong>${s.bg.current.toFixed(1)}</strong>.</p>
      `,
      onEnter: (s) => {
        advanceTime(2.0);
        tick(1.0);
        sayCompanion("Quick snack before the afternoon. What sounds good?");
      },
      choices: [
        {
          text: 'Granola bar (~20g carbs)',
          onSelect: (s) => { eatFood(20, 'slow'); s.score.snacksRemembered++; },
          next: 'day1-hypo-setup'
        },
        {
          text: 'Yogurt (~15g carbs)',
          onSelect: (s) => { eatFood(15, 'fast'); s.score.snacksRemembered++; },
          next: 'day1-hypo-setup'
        },
        {
          text: 'Trail mix (~10g carbs)',
          onSelect: (s) => { eatFood(10, 'slow'); s.score.snacksRemembered++; },
          next: 'day1-hypo-setup'
        }
      ]
    },

    // ============ 14:30 — HYPO RESCUE TUTORIAL ============
    'day1-hypo-setup': {
      content: (s) => `
        <h2>Something Feels Off</h2>
        <p class="passage-scene">Afternoon. You're heading to your activity when something changes.</p>
        <p>Your hands feel a little shaky. There's a slight wobble in your vision. Your heart is beating faster than usual.</p>
        <p>You check your BG: <strong>4.2</strong></p>
        <p>That's below 5. You're going low.</p>
      `,
      onEnter: (s) => {
        // Force the low for the tutorial
        s.bg.current = 4.2;
        s.bg.trend = 'falling';
        advanceTime(0.5);
        notify();
        setMood('alert');
        sayCompanion(`${s.player.name}, you're low. This is the most important skill to learn. Let's handle it.`);
      },
      next: 'day1-hypo-lesson',
      continueText: 'What do I do?'
    },

    'day1-hypo-lesson': {
      content: (s) => `
        <h2>The 15-15 Rule</h2>
        <p><strong>${s.companion.name}</strong> is calm but focused:</p>
        <p><strong>"Here's what you do. Every time. The 15-15 Rule:</strong></p>
        <ol>
          <li>Eat or drink <strong>15 grams</strong> of fast-acting sugar</li>
          <li>Wait <strong>15 minutes</strong></li>
          <li>Check again. If you're still low, repeat.</li>
        </ol>
        <p><strong>"Fast-acting means it gets into your blood quickly. Juice, glucose tabs, regular soda. NOT chocolate — the fat slows it down. NOT diet soda — no sugar in it."</strong></p>
        <p>What do you grab?</p>
      `,
      choices: [
        {
          id: 'juice',
          text: 'Juice box (15g, fast-acting)',
          onSelect: (s) => { s.narrative.choices['hypo-treatment'] = 'perfect'; },
          next: 'day1-hypo-wait'
        },
        {
          id: 'glucose-tabs',
          text: 'Glucose tablets x3 (15g, fast-acting)',
          onSelect: (s) => { s.narrative.choices['hypo-treatment'] = 'perfect'; },
          next: 'day1-hypo-wait'
        },
        {
          id: 'candy-bar',
          text: 'Candy bar (30g, has fat)',
          onSelect: (s) => { s.narrative.choices['hypo-treatment'] = 'toomuch'; },
          next: 'day1-hypo-wait'
        },
        {
          id: 'diet-soda',
          text: 'Diet soda (0g sugar)',
          onSelect: (s) => { s.narrative.choices['hypo-treatment'] = 'nosugsr'; },
          next: 'day1-hypo-wait'
        }
      ]
    },

    'day1-hypo-wait': {
      content: (s) => {
        const treatment = s.narrative.choices['hypo-treatment'];
        if (treatment === 'perfect') {
          return `
            <h2>Good call.</h2>
            <p>You have your 15 grams of fast-acting sugar. Now you wait.</p>
            <p><strong>${s.companion.name}:</strong> "15 minutes. I know it feels long when you're shaky, but the sugar needs time to work. You're doing this right."</p>
            <p><em>15 minutes pass...</em></p>
            <p>You check again: <strong>5.8</strong>. Back in the green.</p>
          `;
        } else if (treatment === 'toomuch') {
          return `
            <h2>That'll work, but...</h2>
            <p>The candy bar has sugar, so it'll help — but 30g is double what you need, and the fat slows down how fast the sugar hits your blood.</p>
            <p><strong>${s.companion.name}:</strong> "You're safe, but you might rebound high later because of the extra sugar. Next time, 15g of something fast-acting is the sweet spot. Literally."</p>
            <p><em>15 minutes pass...</em></p>
            <p>You check again: <strong>8.5</strong>. Safe, but climbing.</p>
          `;
        } else {
          return `
            <h2>That won't help.</h2>
            <p><strong>${s.companion.name}:</strong> "Diet soda has zero sugar — it won't bring your number up. You need actual sugar right now. Let's try again."</p>
            <p>You grab a juice box instead. 15 grams of fast-acting sugar.</p>
            <p><em>15 minutes pass...</em></p>
            <p>You check again: <strong>5.8</strong>. Back in the green.</p>
          `;
        }
      },
      onEnter: (s) => {
        const treatment = s.narrative.choices['hypo-treatment'];
        if (treatment === 'perfect' || treatment === 'nosugar') {
          s.bg.current = 5.8;
          eatFood(15, 'fast');
        } else {
          s.bg.current = 8.5;
          eatFood(30, 'slow');
        }
        s.bg.trend = 'rising';
        notify();
        setMood('proud');
        if (collectBetaCell('fifteen-fifteen-rule')) {
          setTimeout(() => showBetaCellNotification('The 15-15 Rule — Your Emergency Plan', 'red'), 800);
        }
      },
      next: 'day1-late-snack',
      continueText: 'Continue'
    },

    // ============ 16:00 — LATE AFTERNOON SNACK ============
    'day1-late-snack': {
      content: (s) => `
        <h2>Late Afternoon Snack</h2>
        <p class="passage-scene">After that low, a snack is a smart move.</p>
        <p><strong>${s.companion.name}:</strong> "After treating a low and being active, your body needs some fuel. Pick something and let's keep going."</p>
      `,
      onEnter: (s) => {
        advanceTime(1.5);
        tick(0.5);
      },
      choices: [
        {
          text: 'Cheese and crackers (~15g)',
          onSelect: (s) => { eatFood(15, 'slow'); s.score.snacksRemembered++; },
          next: 'day1-dinner-intro'
        },
        {
          text: 'Apple with peanut butter (~20g)',
          onSelect: (s) => { eatFood(20, 'slow'); s.score.snacksRemembered++; },
          next: 'day1-dinner-intro'
        }
      ]
    },

    // ============ 17:30 — DINNER ============
    'day1-dinner-intro': {
      content: (s) => `
        <h2>Dinner</h2>
        <p class="passage-scene">Home. The kitchen smells amazing. Someone made stir-fry with rice, chicken, and veggies.</p>
        <p>There's no nutrition label on a home-cooked meal. This is where <strong>estimation</strong> comes in.</p>
        <p><strong>${s.companion.name}:</strong> "No label this time! But we can break it down:</p>
        <ul>
          <li>Rice — about a cup? That's roughly <strong>45g of carbs</strong></li>
          <li>Chicken — almost <strong>zero carbs</strong></li>
          <li>Veggies — a small amount, maybe <strong>5g</strong></li>
          <li>So the whole plate is roughly <strong>50g</strong>"</li>
        </ul>
        <p>How many carbs do you think are on this plate?</p>
      `,
      onEnter: (s) => {
        advanceTime(1.5);
        tick(1.0);
        sayCompanion("Home cooking means estimating. Let's see how close you get.");
      },
      choices: [
        {
          text: 'About 25g',
          onSelect: (s) => { s.narrative.choices['dinner-estimate'] = 25; },
          next: 'day1-dinner-result'
        },
        {
          text: 'About 50g',
          onSelect: (s) => { s.narrative.choices['dinner-estimate'] = 50; },
          next: 'day1-dinner-result'
        },
        {
          text: 'About 75g',
          onSelect: (s) => { s.narrative.choices['dinner-estimate'] = 75; },
          next: 'day1-dinner-result'
        }
      ]
    },

    'day1-dinner-result': {
      content: (s) => {
        const estimate = s.narrative.choices['dinner-estimate'];
        const diff = Math.abs(estimate - 50);
        let feedback;
        if (diff <= 10) {
          feedback = "About 50g sounds right! Nice estimation.";
        } else if (estimate < 50) {
          feedback = `${estimate}g is a bit low — the rice alone is about 45g. But you're learning, and that's what matters.`;
        } else {
          feedback = `${estimate}g is a bit high — unless you're going back for seconds! But close enough for day one.`;
        }
        const dose = recommendedDose(50, s.bg.current);
        return `
          <h2>Dinner Served</h2>
          <p><strong>${s.companion.name}:</strong> "${feedback}"</p>
          <p>You dose <strong>${dose} units</strong> for the meal and dig in.</p>
          <p><strong>"Estimating carbs in home-cooked food is a skill. It gets easier every time. Close is good enough."</strong></p>
        `;
      },
      onEnter: (s) => {
        eatFood(50, 'slow');
        doseInsulin(recommendedDose(50, s.bg.current), 'meal');
        s.score.mealsManaged++;
        tick(0.5);
        advanceTime(0.5);
        if (collectBetaCell('estimating-carbs')) {
          setTimeout(() => showBetaCellNotification('Estimating Carbs Without Labels', 'green'), 800);
        }
      },
      next: 'day1-dinner-social',
      continueText: 'Continue'
    },

    'day1-dinner-social': {
      content: (s) => `
        <h2>Dinner Conversation</h2>
        <p>During dinner, someone asks how your day went.</p>
      `,
      choices: [
        {
          text: '"Pretty good! I\'m learning a lot."',
          onSelect: (s) => { updateConfidence(3); },
          next: 'day1-evening'
        },
        {
          text: '"It\'s a lot to think about."',
          onSelect: (s) => { updateConfidence(3); },
          next: 'day1-evening'
        },
        {
          text: '"Can we talk about something else?"',
          onSelect: (s) => { updateConfidence(3); },
          next: 'day1-evening'
        }
      ]
    },

    // ============ 19:00 — EVENING ============
    'day1-evening': {
      content: (s) => `
        <h2>Evening</h2>
        <p class="passage-scene">After dinner. The day is winding down.</p>
        <p>Your BG is <strong>${s.bg.current.toFixed(1)}</strong>. ${getBGZone(s.bg.current).label}.</p>
        <p><strong>${s.companion.name}:</strong> "Evenings are a good time to check in with yourself. How's your energy? How's your number? Just a quick peek."</p>
      `,
      onEnter: (s) => {
        advanceTime(1.5);
        tick(1.0);
        setMood('happy');
      },
      choices: [
        {
          text: 'Relax and watch a show',
          next: 'day1-bedtime'
        },
        {
          text: 'Look through your journal',
          next: 'day1-evening-journal'
        }
      ]
    },

    'day1-evening-journal': {
      content: (s) => {
        const count = s.score.collectiblesFound.length;
        return `
          <h2>Your Journal</h2>
          <p>You've collected <strong>${count} Beta Cells</strong> today. Each one represents something you've learned.</p>
          <ul>
            ${s.score.collectiblesFound.map(id => `<li>${betaCellNames[id] || id}</li>`).join('')}
          </ul>
          <p>There are more to find as the week goes on.</p>
        `;
      },
      next: 'day1-bedtime',
      continueText: 'Time for bed'
    },

    // ============ 20:30 — BEDTIME ============
    'day1-bedtime': {
      content: (s) => `
        <h2>Bedtime Snack</h2>
        <p class="passage-scene">Getting ready for bed. One more thing to do.</p>
        <p><strong>${s.companion.name}:</strong> "One more thing — a small bedtime snack helps keep your blood sugar steady overnight. Your body still needs fuel even while you sleep."</p>
        <p><strong>"A snack with some protein alongside the carbs helps your blood sugar stay steady longer. Protein is like slow-burning fuel."</strong></p>
      `,
      onEnter: (s) => {
        advanceTime(1.5);
        tick(0.5);
        setMood('happy');
      },
      choices: [
        {
          text: 'Crackers with cheese (~15g)',
          onSelect: (s) => { eatFood(15, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; },
          next: 'day1-bedtime-check'
        },
        {
          text: 'Glass of milk (~12g)',
          onSelect: (s) => { eatFood(12, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; },
          next: 'day1-bedtime-check'
        },
        {
          text: 'Toast with butter (~15g)',
          onSelect: (s) => { eatFood(15, 'slow'); s.score.snacksRemembered++; s.score.mealsManaged++; },
          next: 'day1-bedtime-check'
        }
      ]
    },

    'day1-bedtime-check': {
      content: (s) => `
        <h2>Final Check</h2>
        <p>Your BG is <strong>${s.bg.current.toFixed(1)}</strong>. ${getBGZone(s.bg.current).label}.</p>
        <p><strong>${s.companion.name}:</strong> "${s.bg.current >= 5 && s.bg.current <= 12 ? 'Looking good for bedtime. You\'re going to sleep well tonight.' : 'Not perfect, but safe. We\'ll keep an eye on things.'}"</p>
        <p>"Your ${s.player.device.bgMonitor === 'cgm' ? 'CGM will watch' : 'number should hold'} through the night. If anything happens, I'll be here."</p>
      `,
      onEnter: (s) => {
        tick(0.5);
        if (collectBetaCell('bedtime-snacks')) {
          setTimeout(() => showBetaCellNotification('Why Bedtime Snacks Matter', 'green'), 500);
        }
        setMood('happy');
      },
      next: 'day1-end',
      continueText: 'Go to sleep'
    },

    // ============ END OF DAY 1 ============
    'day1-end': {
      content: (s) => {
        const betaCells = s.score.collectiblesFound.length;
        // Calculate rough time in range
        const samples = s.score.bgSamples;
        const inRange = samples.filter(s => s.value >= 5.0 && s.value <= 12.0).length;
        const tirPercent = samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 80;

        return `
          <div class="summary-panel">
            <h2>Day 1 — Complete</h2>
            <p style="text-align:center;color:var(--text-secondary);margin-bottom:20px;">You made it through your first day.</p>

            <div class="summary-stat">
              <span class="label">Time in Range</span>
              <span class="value" style="color:var(--zone-green)">${tirPercent}%</span>
            </div>
            <div class="tir-bar"><div class="tir-fill" style="width:${tirPercent}%"></div></div>

            <div class="summary-stat">
              <span class="label">Meals Managed</span>
              <span class="value">${s.score.mealsManaged}/4</span>
            </div>
            <div class="summary-stat">
              <span class="label">Snacks Remembered</span>
              <span class="value">${s.score.snacksRemembered}/3</span>
            </div>
            <div class="summary-stat">
              <span class="label">Beta Cells Collected</span>
              <span class="value" style="color:var(--accent-warm)">${betaCells}/48</span>
            </div>
            <div class="summary-stat">
              <span class="label">Confidence</span>
              <span class="value">${s.confidence}/100</span>
            </div>
          </div>

          <div class="passage">
            <p><strong>${s.companion.name}:</strong> "Day 1 — done. You checked your blood sugar, counted carbs, took your insulin, treated a low, and talked to a friend about T1D. That's a lot. And you handled it."</p>
            <p>"Tomorrow we build on this. Ready?"</p>
          </div>
        `;
      },
      onEnter: (s) => {
        // Store day 1 TIR
        const samples = s.score.bgSamples;
        const inRange = samples.filter(s => s.value >= 5.0 && s.value <= 12.0).length;
        const tirPercent = samples.length > 0 ? Math.round((inRange / samples.length) * 100) : 80;
        s.score.timeInRange.push(tirPercent);
        setMood('proud');
        sayCompanion("Day 1 done. You should be proud.", 5000);
      },
      choices: [
        {
          text: 'Start Day 2 (coming soon)',
          next: 'day2-placeholder'
        }
      ]
    },

    'day2-placeholder': {
      content: (s) => `
        <div class="passage" style="text-align:center;">
          <h2>End of Prototype</h2>
          <p>Day 1 is complete! Days 2-7 are coming soon.</p>
          <p>You collected <strong>${s.score.collectiblesFound.length} Beta Cells</strong> and finished the day with a confidence score of <strong>${s.confidence}</strong>.</p>
          <p style="margin-top:20px;color:var(--text-secondary);">Thanks for playing the Sugar Rush prototype.</p>
        </div>
      `,
      onEnter: () => {
        sayCompanion("That's all we've got for now. But there's a lot more coming.");
      }
    }

  });
}

// Beta Cell display names
const betaCellNames = {
  'what-is-blood-sugar': 'What is Blood Sugar?',
  'what-are-carbs': 'What are Carbs?',
  'carbs-everywhere': 'Carbs Are Everywhere (And That\'s Okay)',
  'talking-to-friends': 'Talking to Friends About T1D',
  'fifteen-fifteen-rule': 'The 15-15 Rule — Your Emergency Plan',
  'estimating-carbs': 'Estimating Carbs Without Labels',
  'bedtime-snacks': 'Why Bedtime Snacks Matter'
};

// Beta Cell notification popup
function showBetaCellNotification(name, color) {
  const existing = document.querySelector('.beta-cell-notification');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'beta-cell-notification';
  div.innerHTML = `<span class="beta-icon ${color}"></span> <strong>Beta Cell collected!</strong><br>${name}`;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 3200);
}
