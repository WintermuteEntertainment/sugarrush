# Sugar Rush - Development Notes

**Last updated:** 2026-11-10 (see HANDOFF.md for full status)

## Session Log (2026-11-11): Carb Catcher

- Tim: the Roller "doesn't actually teach much... isn't actually very fun". Replaced with Carb Catcher: catch falling foods (Health Canada carb values) to keep BG in range while activity lowers it. Drag, buttons or arrow keys. Balance-tested with an auto-player (93% in range catching 10 of ~27 foods).

## Session Log (2026-11-11): v0.3 touch/mobile

- Tim: "On the iPad right now it's almost unplayable"; phones expected similar. Optimize for iOS and Android.
- Emulated iPad, phone and sideways phone. Found: 3-row top bar on phones, Pip covering choices, cramped padding.
- Added a responsive + touch CSS layer, 100dvh, safe areas, no double-tap zoom, no sticky hover, 16 px inputs, numeric keypads, Home Screen meta tags. Details in HANDOFF.md section 0.
- Not yet tested on real devices. Glucose Roller "doesn't work" may have been iPad double-tap zoom.

## Session Log (2026-11-10, part 3): fact check + meal slots

- Tim: meals ignoring time of day "not acceptable"; all facts must come from Diabetes Canada or Health Canada, and should have been gathered first as a reference.
- Read Diabetes Canada guideline chapters 9, 10, 12, 14 (+2023 update), 15, 34 and patient pages (Type 1, insulin, air travel, carb counting, Handy Portion Guide), plus Canada's Food Guide pages and Health Canada's Nutrient Value of Some Common Foods (2008). Reference: `design/fact-sources.md`.
- Rewrote all 50 Beta Cells (with `src` tags), every food carb value, Label Reader (real values, subtract-fibre), Treat-the-Low (sourced list, no amounts), Mealtime Routine and Sick Day steps, Pip hints.
- Meals tagged breakfast/lunch/dinner; weekend-only lunches; gentle sick-day meals.
- Exercise Balance made a bit harder (Tim: "a tad harder").
- Open source questions are in HANDOFF.md section 8.

## Session Log (2026-11-10, part 2): v0.2 overhaul

Driven by Tim's v0.2 critique (saved in Claude memory as `feedback_v02.md`). Summary of what changed is in HANDOFF.md section 5. Highlights:

- Green zone 5-10. All dose prescriptions removed; insulin = "your diabetes team's plan".
- Fixed the BG sim overdosing meals 3x (cause of constant lows) and the clock reaching bedtime at 3 PM.
- Realistic, non-punishing low recovery (treat, wait 15, recheck, snack).
- No-fail mini-games with start screens and re-pickable answers; Exercise Balance rewritten; Dose Calculator replaced by Mealtime Routine.
- Pip always on screen with loud alarm states; no blur/shake effects.
- Progressive Day 1 spotlight tutorial.
- 3 save slots, autosave every step, mid-day resume, Back-button guard, week-complete fix.
- Weekend content fixed (no classmates on Saturday, Sunday outing replaces the field trip).
- 11 new meals, 20 snacks, emoji scenes, day BG chart, weekly bar chart.

Testing: manual Day 1 (injections + finger pokes), save/resume after reload, Back button, and an automated playthrough of Tuesday to Sunday with no console errors. Lows observed over the week: Monday's scripted lesson and one surprise afternoon dip.

How it was built: new sections were written as separate files and spliced into game.js with a small Python script. Gotcha: Git Bash rewrites command-line arguments that start with `//`, which ate a slash at each splice seam; fixed afterwards.

## Session Log (2026-11-10, part 1)

- Device-reference audit (4 fixes), 6 mini-games built (alpha), dedication screen ("For Dr. Patricia Riley"), avatar in HUD, animated Pip, first process-based dose game.
- Git repo created at D:/Repos/sugarrush and pushed to GitHub (private).

## Session Log (2026-11-06)

- Day 1 lunch dialogue device fix; codebase audit; first HANDOFF.md.

## Open Questions for Tim

- Glucose Roller "doesn't work at all": what happened when you played it (no ball movement, buttons dead, or just not fun)? It runs in Claude's test of the current build.
- Exercise/snack game: what feels wrong (too fast, unclear goal, snack doesn't do enough)?
- Should meals be locked to time of day (breakfast foods only at breakfast)? Claude recommends yes.
- Delete the orphaned modular files and `data/food-database.json`, or keep for later?
- BBB deployment details (tunnel config location, web server).

## Next Steps (Priority Order)

1. Tim plays v0.2 and answers the open questions.
2. Fact verification pass against Diabetes Canada / Canada's Food Guide (Beta Cells, low treatment amounts, carb values).
3. Movable avatar + scene navigation.
4. Overlay / tracking system for choices and consequences.
5. Meal time-of-day tags; gentle sick-day meals.
6. Deploy to sugarrush.timcase.ca.
