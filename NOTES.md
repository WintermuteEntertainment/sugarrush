# Sugar Rush - Development Notes

**Last updated:** 2026-11-10

## Session Log (2026-11-10)

### All 9 mini-games implemented
Built 6 new mini-games in alpha form (emoji art, HTML/JS/CSS only):
- **Label Reader** -- Canadian Nutrition Facts label, tier-scaled questions (basic carbs to net carbs)
- **Exercise Balance** -- real-time BG simulation during exercise, click to snack
- **Pack Your Bag** -- device-adaptive supply checklist (pump vs pen supplies, CGM vs meter)
- **Glucose Roller** -- abstract BG control with arrow keys/buttons, velocity-based ball physics
- **Portion Estimator** -- emoji food plates, slider to estimate carbs, hand-size references
- **Sick Day Protocol** -- 5-step decision sequence (ketones, hydration, correction, monitoring, escalation)

### Device-reference bug audit (4 fixes)
1. `site-change` practical event -- converted to inline push with device-adaptive callback
2. Meal-done very-high text -- CGM vs meter conditional
3. Sleepover wing-it response -- removed CGM-specific reference
4. `low-supplies` practical event -- converted to inline push with pump vs pen supply names

### Deployment setup
- Git repo initialized at D:/Repos/sugarrush
- Pushed to https://github.com/WintermuteEntertainment/sugarrush (private)
- BBB deployment pending (need tunnel config details)

## Session Log (2026-11-06)

### Bug Fix: Device-adaptive dialogue in Day 1 lunch social
- **File:** `sugar-rush/js/game.js` ~line 2760
- **Issue:** When player chose injections, Mia asks "What's that pen you just used?" but the second response option said "Basically a tiny computer that gives me medicine" (only makes sense for pump).
- **Fix:** Made the second choice text conditional on `s.player.device.insulin`:
  - Pump: "Basically a tiny computer that gives me medicine."
  - Injections: "It's like a needle, but for medicine I need every day."

### Codebase Audit
- Full read of all ~2943 lines of game.js, index.html, app.js, style.css
- Confirmed orphaned modular files (js/engine/, js/hud/, js/passages/, app.js, style.css) are NOT loaded
- Created HANDOFF.md with full project status

## Open Questions

- Should the orphaned modular files be deleted or should the monolith eventually be split into them?
- Should `data/food-database.json` be integrated into the mini-games or removed?
- Day 1 morning Carb Counter is still a placeholder. Should it use the real mini-game implementation?
- Difficulty modes don't meaningfully differ yet. Is that intentional for now?

## Next Steps (Priority Order)

1. Deploy to sugarrush.timcase.ca via cloudflared on BBB
2. Wire Day 1 morning Carb Counter to the real mini-game implementation
3. Art and audio asset integration
4. Decide on orphaned files / modular architecture
