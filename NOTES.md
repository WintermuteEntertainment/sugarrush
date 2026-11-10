# Sugar Rush - Development Notes

**Last updated:** 2026-11-06

## Session Log (2026-11-06)

### Bug Fix: Device-adaptive dialogue in Day 1 lunch social
- **File:** `sugar-rush/js/game.js` ~line 2760
- **Issue:** When player chose injections, Mia asks "What's that pen you just used?" but the second response option said "Basically a tiny computer that gives me medicine" (only makes sense for pump).
- **Fix:** Made the second choice text conditional on `s.player.device.insulin`:
  - Pump: "Basically a tiny computer that gives me medicine."
  - Injections: "It's like a needle, but for medicine I need every day."
- The first choice was already device-adaptive. This fix completes the set.

### Codebase Audit
- Full read of all 2943 lines of game.js, index.html, app.js, style.css
- Confirmed orphaned modular files (js/engine/, js/hud/, js/passages/, app.js, style.css) are NOT loaded
- Created HANDOFF.md with full project status

## Open Questions

- Should the orphaned modular files be deleted or should the monolith eventually be split into them?
- Should `data/food-database.json` be integrated into the mini-games or removed?
- The `site-change` practical event has a device-reference bug (reads state at registration time, not render time). Similar pattern may exist in other events -- needs audit.
- Day 1 morning Carb Counter is still a placeholder. Should it use the real mini-game implementation?
- Difficulty modes don't meaningfully differ yet. Is that intentional for now?

## Next Steps (Priority Order)

1. Audit all event pool registrations for device-reference bugs like `site-change`
2. Wire Day 1 morning Carb Counter to the real mini-game implementation
3. Implement remaining 6 mini-games (Label Reader, Exercise Balance, Pack Your Bag, Glucose Roller, Portion Estimator, Sick Day Protocol)
4. Art and audio asset integration
5. Decide on orphaned files / modular architecture
