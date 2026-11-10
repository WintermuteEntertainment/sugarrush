# Sugar Rush - Project Handoff

**Last updated:** 2026-11-10
**Version:** v0.2 (in progress). v0.1 backup: `backup/v0.1-2026-11-10/`
**Status:** Full 7-day week plays end to end with no crashes (automated playthrough Tue-Sun plus a manual Day 1, 2026-11-10). Mechanics overhaul done. Movable avatar, overlay/tracking system, and a fact-verification pass are NOT started.

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
| `design/` | 8 original design docs (partly outdated by v0.2, see section 9) |
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
3. **Fact verification pass** (section 8).

**Bugs / content gaps found 2026-11-10**
- Random meals ignore time of day (e.g. "Movie Theater" or "Smoothie" as breakfast, "Bagel Morning" at lunch). Fix: tag meals with `slot: 'breakfast' | 'lunch' | 'dinner' | 'any'` and filter in `choosePicks`.
- Sick Friday can still draw "The Buffet" or other big meals for lunch. Day 5 should use gentle sick-day foods.
- Friday's sick morning text says "No school today", but Friday's AM mini-game and school-only filter still treat it as a school day (harmless, but inconsistent).
- Evening events don't set the clock (time jumps from dinner straight to 21:00 at bedtime). Fine, but could show ~19:30.
- `Week 2+` Day 1 uses the generated day (no tutorial) with mini-games Carb Counter / Exercise Balance. Not play-tested.
- 70 em-dashes remain in older event text (Tim said to leave them for now).
- Mobile layout: HUD wraps below 640 px, not tuned. Spotlight tips not tested on phone sizes.
- The `beforeunload` "leave site?" prompt also appears when a developer reloads; use the Back-button guard or menu instead.
- Old v0.1 saves load (migrated), but their in-flight insulin/carbs are dropped and they restart at the start of their saved day.

**Unverified numbers (Claude's estimates, not from an approved source)**
- All carb counts in meals, snacks, mini-games, and the Carb Counter reference chart.
- Treat-the-Low amounts: "¾ cup juice/pop", "1 tbsp sugar/honey", "~15g glucose tabs". Claude recalls these from Diabetes Canada guidance but did not check a source.
- "Fast sugar, wait 15 minutes, recheck; snack with carbs + protein if the next meal is over an hour away" (same caveat).
- Simulation constants (absorption times, insulin timing) are game tuning, not medical claims, but should never be presented as facts.

## 8. Fact sources rule

Every "Did you know?" / Beta Cell / tip must trace to **Diabetes Canada** (diabetes.ca, formerly the Canadian Diabetes Association) or **Canada's Food Guide** (food-guide.canada.ca). Nothing from general knowledge. None of the 50 Beta Cells have been verified yet. Suggested process: one pass per category, recording the source URL next to each entry (a `src` field in `betaCells`), and flagging anything with no source for Tim.

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
