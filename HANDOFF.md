# Sugar Rush - Project Handoff

**Last updated:** 2026-11-06
**Status:** Playable prototype, Day 1-7 loop complete, art/audio placeholder phase

## What This Is

A Type 1 Diabetes education game for ages 5-15. 7-day week structure, narrative choices + mini-games + BG simulation. Vanilla JS, no framework, runs as static files from localhost or any web server. No online dependency, no monetization.

## Architecture

**Single-file engine:** `sugar-rush/js/game.js` (~2943 lines) contains everything: state, BG simulation, narrative engine, HUD, companion, mini-games, all passages, event pools, save/load, and init.

**NOT used:** The modular files (`js/engine/`, `js/hud/`, `js/passages/`, `js/app.js`, `css/style.css`) are orphaned stubs from an earlier plan. The game loads only `game.js` via a `<script>` tag in `index.html`. All CSS is inline in `index.html`.

**Design docs:** `design/` folder has 8 spec documents covering mini-games, tech architecture, narrative events, companion character, day 1 walkthrough, art direction, scripted anchors, and mini-game schedule.

**Food database:** `data/food-database.json` exists but is NOT used. Food data is hardcoded in the event pool registrations and mini-game implementations.

## What Works

- **Full 7-day game loop.** Day 1 is a scripted tutorial. Days 2-7 are generated from event pools with difficulty scaling (tier 1-3).
- **BG simulation.** Carb absorption (fast/slow), insulin action (onset delay, duration, IOB), basal drift, exercise drop, energy drain from out-of-range BG.
- **3 mini-games implemented:** Carb Counter, Dose Calculator, Treat-the-Low. All render inline in the passage area. Each awards stars (0-3) and a Beta Cell on first play.
- **50 Beta Cell collectibles** across 4 categories (Facts/Skills/Life Wisdom/Emergency). Knowledge Journal viewer with category filtering and detail view.
- **Event pools:** 20+ meal events, 15+ social events, 8+ emotional events, 10+ practical events. Tiered by difficulty, drawn without repeats.
- **Scripted anchors:** Day 2 pre-bolusing, Day 3 estimation challenge, Day 4 soccer practice, Day 5 sick day, Day 6 Saturday brunch, Day 7 field trip.
- **Device-adaptive:** Pump vs. injections and CGM vs. finger pricks affect dialogue, Mia's question text, HUD trend arrows, and narrative framing. Same mini-games either way.
- **Low BG interrupt system.** If BG drops below 4.0 during any non-exempt passage, a rescue chain fires: companion alert, Treat-the-Low mini-game, recovery passage, then resume.
- **Night events** on Days 3, 5, 7 (random: low alarm, high correction, or peaceful sleep).
- **Save/load** via localStorage. Auto-saves at day transitions. Title screen offers Continue/New Game.
- **Weekly summary** with stars, average TIR, best/toughest day, replay option.
- **Screen effects** for BG zones: mild/severe tremor (low), mild/severe blur (high).
- **Companion** with contextual lines (BG-aware: won't congratulate during a low) and timed speech bubble.

## What's NOT Built Yet

### Must-have before release
- **6 mini-games not implemented:** Label Reader, Exercise Balance, Pack Your Bag, Glucose Roller, Portion Estimator, Sick Day Protocol. The schedule references them (days 2-7) but they fall through to a "simulated" placeholder.
- **Day 1 morning Carb Counter** is still a placeholder passage, not the actual implemented mini-game.
- **Unit toggle UI.** `bgDisplay()` supports mmol/L and mg/dL conversion but there's no settings screen or toggle to switch.

### Art (all placeholder)
Every passage tagged with `// ART:` comments needs visual assets:
- Scene backgrounds (bedroom, kitchen, cafeteria, soccer field, etc.)
- Character paper-doll preview in creation screen
- Companion robot: floating entrance animation, expression states
- Food illustrations for mini-games
- Mini-game preview illustrations
- Title screen background

### Audio (all placeholder)
Every passage tagged with `// AUDIO:` comments needs sound:
- Morning/night/day ambient tracks
- Mini-game start jingle, result fanfare (per star rating)
- Companion dialogue blip
- UI click sounds
- Beta Cell collection chime
- Low BG alarm tone
- End-of-day summary fanfare
- Title screen music

### Nice-to-have
- The orphaned modular files should either be deleted or the monolith should be split into them.
- `data/food-database.json` should either be integrated or removed.
- Difficulty modes ("Learning the Ropes" vs. "I've Got This") are stored but don't meaningfully change gameplay beyond some extra companion hints on Day 1.

## Known Bugs / Issues

1. **`site-change` practical event** (line ~1215): reads `state.player.device?.insulin` at REGISTRATION time (module load), not at render time. The scene text is frozen to whatever the default device value is (`'pump'`), regardless of what the player chose in setup.

2. **Beta Cell count mismatch:** `state.score.totalCollectibles` is set to 50, but the HUD element `#hud-beta-cells` shows the collected count against this total. The actual `betaCells` array has 50 entries, so this is correct -- but the HUD initially showed "/ 48" in earlier screenshots, suggesting `totalCollectibles` may have been 48 at some point. Currently reads 50.

3. **Day end transition:** `registerDayEnd()` creates the passage and then immediately overwrites `origPassage.choices` (lines 2024-2033) to fix a rendering issue. This works but is fragile.

4. **CSS duplication:** `index.html` has all styles inline. `css/style.css` has an expanded version with extra selectors that aren't loaded. They will diverge further with changes.

## Dev Server

`.claude/launch.json` is configured. Run via the preview system or:
```
npx http-server sugar-rush -p 3000
```

## Design Principles (from memory)

- No speed pressure in educational content. Accuracy over speed.
- No surveillance/parent mode. Stats screen is open to everyone.
- No monetization, no lootboxes, no online dependency.
- Pump vs. injections: same games, cosmetic/narrative differences. No "have vs. have not."
- CGM vs. finger pricks: framed as equally valid.
- Canada's Food Guide for all nutritional data.
- No shame mechanics. Constant support/encouragement even at low scores.
- BG units: mmol/L primary, mg/dL toggle option.
