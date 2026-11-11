# Sugar Rush - Project Handoff

**Last updated:** 2026-11-11
**Version:** v0.3 (touch screens, tablets, phones). v0.1 backup: `backup/v0.1-2026-11-10/`
**Status:** Full 7-day week plays end to end with no crashes (automated playthrough Tue-Sun plus a manual Day 1, 2026-11-10). Mechanics overhaul done. Facts checked against Diabetes Canada and Health Canada (section 8). Layout and touch support for iPad and phones done (section 5b), but **not yet tested on a real iPhone, iPad or Android device**. Movable avatar and overlay/tracking system are NOT started.

## 0. v0.3 (2026-11-11): touch screens, tablets and phones

Tim found the game "almost unplayable" on iPad. Tested in an emulated iPad (768×1024), phone (375×812) and sideways phone (812×375); it has not been tried on real hardware yet.

**Fixed**
- **Top bar:** on tablets and phones the labels turn into icons (⚡ energy, 💪 confidence, 🧬 Beta Cells) and the bar fits in one row (was three rows on a phone). The day shows as "Wed" on phones.
- **Pip covering buttons:** the story area has extra space at the bottom so buttons can scroll clear of Pip. Pip and his bubble are smaller on phones, the bubble disappears faster there, and tapping it dismisses it.
- **Screen height:** uses `100dvh`, so Safari's toolbars can't hide the bottom of the game. Notch and home-bar areas are padded (`viewport-fit=cover` + `safe-area-inset`).
- **Double-tap zoom:** off on every control (`touch-action: manipulation`). On iPad, tapping Up/Down quickly in Glucose Roller or Snack in Exercise Balance zoomed the page instead. This is a likely cause of Tim's "Roller doesn't work at all" note.
- **Sticky hover effects** removed on touch screens and replaced with a short press effect. Long-press no longer selects text on controls.
- **Typing:** inputs use 16 px+ text (iOS zooms in on anything smaller). Answer boxes bring up the number keypad. Label Reader no longer pops the keyboard over the label on touch screens.
- **Phone layouts:** smaller padding and headings, 2-column mini-game grids, stacked device/pace choices, sticky avatar preview during character creation, smaller plates and emoji scenes, Beta Cell pop-ups moved to the bottom.
- **Sideways phones:** compact bar and smaller Pip.
- **Home Screen:** Apple and Android meta tags so "Add to Home Screen" opens the game full screen without Safari's bars. There's no app icon file yet (iOS uses a screenshot of the page).
- Two unsourced Pip lines found while testing were replaced with Health Canada numbers (yogurt, spaghetti).

**How to test on a real device:** the dev server is only on this PC. Either deploy (section 10) or, with the phone or iPad on the same Wi-Fi, run the server and open `http://<this PC's local IP>:3000` (http-server prints the address). Things to try: Glucose Roller rapid taps, Exercise Balance, typing in Label Reader/Carb Counter, rotating the device mid-game, Add to Home Screen, and the Back swipe gesture (it should show the "your game is saved" message).

**Code:** CSS block "v0.3: touch screens, tablets and phones" at the end of the `<style>` in index.html. JS: `updateHUD` (short day name), `initHUD` (bubble tap, resize), `showCompanion` (shorter bubble on phones), `inputmode` on number inputs, Label Reader focus.

---

## 1. What this is

A Type 1 Diabetes education game for ages 5-15, dedicated to Dr. Patricia Riley. A 7-day week (Monday to Sunday) of meals, snacks, conversations and mini-games, with a simple blood sugar (BG) simulation. Vanilla HTML/CSS/JS, emoji for all art, no build step, no network, no monetization.

## 2. How to run it

```bash
cd /d D:\DiabetesGame && npx http-server sugar-rush -p 3000 -c-1
```

Open http://localhost:3000. (`.claude/launch.json` has the same config as `sugar-rush`.) The server stops whenever the Claude session that started it stops; restart it with the command above.

## 3. Where things are

| Path | What |
|---|---|
| `sugar-rush/index.html` | Page, all CSS (inline `<style>`), HUD and Pip markup |
| `sugar-rush/js/game.js` | The entire game (~3,500 lines, one IIFE `SugarRush`) |
| `design/` | 8 original design docs (partly outdated by v0.2, see section 9), plus `fact-sources.md` (the source reference for every fact) |
| `backup/v0.1-2026-11-10/` | game.js + index.html before the v0.2 overhaul |
| `D:/Repos/sugarrush/` | Git repo copy, remote `github.com/WintermuteEntertainment/sugarrush` (private) |
| Orphaned, not loaded | `js/app.js`, `js/engine/`, `js/hud/`, `js/passages/`, `js/companion/`, `css/style.css`, `data/food-database.json` |

**Two copies warning:** development happens in `D:\DiabetesGame`. The repo is a separate copy at `D:\Repos\sugarrush`; changes must be copied over before committing (see section 10).

### game.js sections (search for the `// N.` headers)

1. Game state (`state` object) · 2. State helpers · 3. BG simulation · 4. Narrative engine (`renderPassage`, `sceneArt`, `choiceQuiz`) + Low BG rescue flow · 5. HUD · 6. Pip (companion), tutorial spotlights, modals, menu · 7. Beta Cell catalog (50) · 8. Journal · 9. Save slots · 10. Event pools (meals, social, emotional, practical) · 11. Mini-games · 12. Snacks · 13. Day builder · 14. Wakeup/bedtime/night/day-end · 15. Scripted anchors · 16. Weekly summary · 17. Setup (dedication, title, slots, character, devices, pace, Pip) · 18. Day 1 tutorial · 19. Init + navigation guard

## 4. v0.2 design rules (from Tim, 2026-11-10)

- **Green zone is 5 to 10 mmol/L.** Under 4.0 = low (hypo). 4.0-4.9 = "a bit low". 10-14 = high. Over 14 = very high.
- **Never prescribe insulin or medication doses.** No units, ratios, correction factors anywhere the player can see. Insulin is always "following the plan from your diabetes team". Nutrition numbers (carbs, labels) are fine and encouraged.
- **No failing.** Choice questions can be re-picked until right; Next only appears on the right answer. No stars or ❌ shown. Every mini-game has a start screen explaining it.
- **Don't prescribe feelings** ("the sadness washes over you" was removed). Let kids feel their own emotions.
- **Avoid over-narration and over-explanation.** Short tips, one idea at a time.
- **Lows:** realistic, not punishing, not repetitive, not caused by eating carbs.
- **Less cola/juice.** Glucose tabs are always available for treating lows.
- **Facts only from Diabetes Canada (Canadian Diabetes Association) and Canada's Food Guide.** Nothing from general knowledge. (Not yet verified, see section 8.)
- Readability first: no blur or screen shake.

## 5. What changed in v0.2 (2026-11-10)

**BG simulation (section 3)**
- Root cause of the frequent lows fixed: v0.1 meal insulin covered about 3x the carbs eaten. Insulin is now stored internally as "how much BG it will lower" and matched to the meal (`eatMeal`, `takeMealInsulin`, `takeCorrection`, `eatSnack`). Corrections subtract insulin already working, so nothing stacks.
- Insulin and carbs age by simulated time, not wall-clock passage order. New `setClock(h)` runs the sim forward to fixed times of day (breakfast 7:30, snack 10:00, game 10:30, lunch 12:00, snack 14:30, game 15:00, snack 16:30, dinner 18:00, bedtime 21:00). v0.1 reached bedtime at 3 PM.
- Typical day now stays 6-10 with normal bumps to 11-14 after fast-carb meals.

**Lows (section 4, "Low BG")**
- Flow: alert (symptoms vary) → Treat-the-Low mini-game → "Wait 15 minutes" (timer bar, button unlocks after 3.5 s) → recheck (treat again if still under 4) → snack with carbs + protein if the next meal is a while away → resume.
- Fast sugar absorbs over ~20 minutes, so recovery is gradual (example from a real run: 3.7 → 4.9 after 15 minutes → 5.8 at dinner).
- Second low in a day gets a shorter flow (no explainer box, Treat-the-Low intro skipped).
- Surprise lows: 35% of days (not Thursday or Friday) get one afternoon dip with a stated cause (gym, recess, biking), only if BG is under 9; it clears insulin on board first so it can't cascade.
- Monday's tutorial low (after gym class) uses the real rescue flow.

**Pip and HUD (sections 5-6)**
- Pip stays on screen; the speech bubble comes and goes. Tap Pip for a context hint.
- Alarm states: amber ring + bouncing ⬆/⬇ badge when outside 5-10; red background, wobble and pulsing ring when under 4 or over 14. BG number pulses when red.
- Screen effects are edge glows only (no blur, no tremor). Sick day is fully readable.
- HUD shows weekday ("Mon · Day 1"), avatar, and a ☰ menu (explains autosave, journal, tips on/off, title screen).

**Tutorial (section 18)**
- Day 1 introduces one thing at a time with a spotlight tip: BG meter, avatar, Pip, (breakfast) mealtime routine, Beta Cells, Energy, mini-games, day/time, Confidence, the low flow. Tips show once per save; "Skip all tips" and the menu toggle turn them off. "I've Got This" pace starts with tips off.

**Saves and navigation (sections 9, 19)**
- 3 save slots on a slot screen (avatar, name, weekday, last played). Delete needs an in-page confirm. New Game only on empty slots (no overwriting).
- Autosave after every passage, including the day's random event picks, so a refresh resumes on the exact screen.
- Back button opens an in-page "your game is saved" message instead of leaving. Refresh/close triggers the browser's own "leave site?" box (browsers don't allow custom text there).
- Finishing Sunday marks the week complete; Continue goes to the weekly summary, not back to Sunday morning (v0.1 bug).
- The old single save (`sugarrush-save`) migrates into the first empty slot.

**Mini-games (section 11)** - all have a start screen; none can be failed
| Game | v0.2 notes |
|---|---|
| Carb Counter | Plate + reference chart, encouraging result. Day 1 morning now uses the real game. |
| Mealtime Routine | Replaces "Dose Calculator". Steps (check, count, follow your plan, give it time; tier 3: estimating, fatty foods, not stacking, plans change). No numbers. |
| Treat-the-Low | Glucose tabs always offered + one other good option (sugar in water, honey, ¾ cup juice, pop only 15% of the time) + 2 not-ideal. Wrong picks explain and dim. |
| Label Reader | Wrong answers get a hint and up to 3 tries. "Dosing" wording removed. |
| Exercise Balance | Rewritten: 60 game-minutes in ~24 s, warm-up/main/cool-down. One snack at a time with digestion delay (no spamming). Under 4 pauses for a treatment instead of ending. Result coaches balance (ending high after many snacks is called out). BG now carries back to the main game. Also used as Thursday's soccer practice. |
| Pack Your Bag | Done only finishes when essentials are packed; otherwise a hint. Fun items are fine. |
| Glucose Roller | Explained on its start screen, green band 5-10, keyboard listener cleaned up. |
| Portion Estimator | More plates, no pop. |
| Sick Day Protocol | Re-pickable steps. Insulin is "your sick day plan"; focus on telling a grown-up, ketones, fluids, when to get help. |

**Content**
- Weekend fixed: school-only events (classmates, substitute teacher, cafeteria, recess, show-and-tell, new kid, school nurse, bento lunch) never appear Saturday/Sunday. Sunday is a family bike ride + picnic (was a school field trip).
- 11 new meals (bagel, oatmeal bar, breakfast wraps, pita/falafel, dumplings, bento, chili, roti & curry, community potluck with bannock, hockey-arena poutine, pho). 20 snacks with carb + protein tags; nut snacks hidden on school days (nut-free schools). 6 bedtime snacks.
- Emoji scene panels (`sceneArt`) on most screens, colour-coded by time of day; food rows and choices show emoji.
- Day summary has a BG line chart for the day; weekly summary has a bar per weekday.
- Character creation has a live paper-doll preview; more hats/faces/colours.
- Dose/correction language removed from Beta Cells, events, night events, Day 2 (timing is "ask your team"), Day 4 (no "reduce insulin"), Day 5.

## 6. Tim's open notes (verbatim, 2026-11-10)

- "Glucose Roller" game doesn't work at all.
  - *Claude, same day:* in the current build the Roller starts, the ball moves, buttons and arrow keys respond, and it finishes (tested via `SugarRush.playMiniGame('Glucose Roller', {tier:2}, 'title')`). Tim may have played the v0.1 build or hit it mid-edit. **Needs Tim's repro steps.** It may also mean "doesn't work as a game" (the nudges are subtle and it isn't much fun); if so, it needs a redesign.
- Snack/Exercise game still needs work too.
  - *Claude:* the Exercise Balance rewrite landed after Tim's test, but treat this as open. Ideas: snack choices with different speeds (fast vs slow carbs), a visible "digesting" bar, clearer goal line.

## 7. Known issues / next work

**Not started (the "broader scope" for the next session)**
1. **Movable avatar.** Tap/click to move your avatar around a scene (house, school, park) to reach meals, games, Pip, the journal. Also metaphorical maps (e.g. walking along a BG timeline).
2. **Overlay / tracking system.** Tap places or HUD items to open overlays explaining what they are, where you are, and the consequences of your choices across the day, week, and saves. The day sparkline and weekly bars are a start.
3. Answer the source questions in section 8.

**Fixed later on 2026-11-10 (fact pass)**
- Meals are locked to time of day (`MEAL_SLOTS` + `pickMeal` in section 10). Weekend-only lunches (movies, party, arena, potluck) never show on school days. The ice cream trip is a treat outing, so it's never drawn as a meal.
- Sick Friday uses two gentle meals (`sick-lunch`, `sick-dinner`).
- Every fact and food number now comes from Diabetes Canada or Health Canada. See `design/fact-sources.md` and section 8.
- Exercise Balance is a bit harder: faster drops, surprise sprints, snacks a little slower to kick in.

**Bugs / content gaps found 2026-11-10**
- Friday's sick morning text says "No school today", but Friday's AM mini-game and school-only filter still treat it as a school day (harmless, but inconsistent).
- Evening events don't set the clock (time jumps from dinner straight to 21:00 at bedtime). Fine, but could show ~19:30.
- `Week 2+` Day 1 uses the generated day (no tutorial) with mini-games Carb Counter / Exercise Balance. Not play-tested.
- 70 em-dashes remain in older event text (Tim said to leave them for now).
- Mobile layout: HUD wraps below 640 px, not tuned. Spotlight tips not tested on phone sizes.
- The `beforeunload` "leave site?" prompt also appears when a developer reloads; use the Back-button guard or menu instead.
- Old v0.1 saves load (migrated), but their in-flight insulin/carbs are dropped and they restart at the start of their saved day.

## 8. Facts and sources (done 2026-11-10)

**Read `design/fact-sources.md` before adding or changing any fact.** It lists every source page (Diabetes Canada and Health Canada), the statements taken from each, and Health Canada's carbohydrate table.

- All 50 Beta Cells were rewritten to say only what the sources say. Each has a `src` field (37 cite sources; 13 gold "life wisdom" cells are marked `encouragement`, meaning no medical claim).
- Every food carb number (meals, snacks, bedtime and recovery snacks, Carb Counter, Portion Estimator, scripted days) comes from Health Canada's *Nutrient Value of Some Common Foods* (2008). Mixed meals show their parts, e.g. "3 pancakes (33 g) + syrup (28 g)".
- Label Reader no longer uses made-up products. It shows real Health Canada values (carbohydrate and fibre only, rounded to whole grams like a label) and teaches Diabetes Canada's "subtract fibre" rule.
- Treat-the-Low only offers items on Diabetes Canada's fast-sugar list, shows no amounts, and says the amount depends on age and comes from the diabetes team.

**What the check changed (my v0.2 text was wrong or unsourced):**
- Juice for a low: Diabetes Canada says 150 mL for adults (I had ¾ cup = 175 mL). For **children it depends on age**: about 5 g under 5 years, 10 g at 5-10, 15 g over 10 (CPG ch. 34). The game now shows no amount.
- "Fat or chocolate slows sugar" is not in any source; removed. Milk being slower *is* sourced.
- Diabetes Canada says to **subtract fibre** from total carbohydrate (I had said "ask your team").
- Many carb values changed, e.g. plain bagel 38 g (was 48), baked potato 37 g (was 26), 2 cookies 13 g (was 20).
- Removed as unsourced: "not caused by diet", "stress hormones raise BG", "thumb = 1 tbsp", "bedtime snack keeps BG steady", "protein raises BG slowly", "insulin stacking", "fist = 1 cup" as a firm rule.

**Open questions on sources (for Tim):**
- Diabetes Canada's 2023 update uses **3.9** mmol/L as the low alert value; the 2018 chapter and the game use **4.0**. The children's chapter gives no number. Keep 4.0?
- "Wait 15 minutes, then recheck" and "snack with carbs + protein if the next meal is over an hour away" come from the **adult** hypoglycemia chapter. The children's chapter doesn't say. OK to use for kids?
- Some statements are marked **[partial]** in fact-sources.md: the reading tool only summarized those parts of long pages. Worth a human read of CPG ch. 9, 10, 12 and 14.
- Roti and perogies aren't in Health Canada's table, so they were replaced with naan and dumplings.
- Health Canada's nutrient table is from 2008. It's the newest version I found on canada.ca.

The Canada's Food Guide site (food-guide.canada.ca) currently shows a "page moved" notice; the same content was read on canada.ca.

## 9. Design docs status

`design/*.md` describe v0.1 plans (5-12 range, dose calculator, field trip on Day 7, scoring). Treat sections 4-5 of this file as overriding them until they're updated.

## 10. Git / deploy

- Repo: `D:/Repos/sugarrush`, remote `https://github.com/WintermuteEntertainment/sugarrush` (private), branch `master`.
- Sync dev → repo, then commit (Tim pushes):
  ```bash
  cp -r D:/DiabetesGame/sugar-rush D:/DiabetesGame/HANDOFF.md D:/DiabetesGame/NOTES.md D:/Repos/sugarrush/
  ```
- Deployment to BBB (`A:/sugarrush`, `sugarrush.timcase.ca` via the existing cloudflared tunnel) is still pending. Needed from Tim: where the tunnel config lives on BBB (`find / -name "config.yml" -path "*cloudflare*" 2>/dev/null`) and whether a web server (Caddy?) is already running. Cloudflared can point straight at a tiny static server, e.g. `python3 -m http.server 8787` in the `sugar-rush` folder.
- Future domain idea: sugarrush.ca (check availability).

## 11. Testing tips

- `SugarRush.state` is exposed for inspection; `SugarRush.playMiniGame(name, {tier}, nextPassageId)` launches any mini-game; `SugarRush.startDay(n)` jumps to a day (after loading a slot).
- Saves live in `localStorage` keys `sugarrush-slot-1..3`.
- An automated click-through bot was used on 2026-11-10 (not saved to the repo); it clicks the first choice, solves quizzes by trial, snacks in Exercise Balance under 6.2, and waits out timers. Worth turning into a dev-only test page.
