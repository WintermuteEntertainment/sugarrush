# Mini-Game Schedule — Full Week

## Games Available (10 total)

| # | Game | Core Skill | Input Type |
|---|---|---|---|
| 1 | **Carb Counter** | Identify carbs in foods, build plates | Drag-and-drop / tap |
| 2 | **Dose Calculator** | Calculate insulin dose from carbs + BG | Number input |
| 3 | **Hypo Rescue** | Treat a low with 15g fast-acting sugar | Grab-the-right-item |
| 4 | **Exercise Balance** | Manage BG during physical activity | Rhythm / timing |
| 5 | **Label Reader** | Read Canadian Nutrition Facts labels (untimed) | Tap correct numbers |
| 6 | **Pack Your Bag** | Pack diabetes supplies for an outing | Drag-and-drop |
| 7 | **Glucose Roller** | Feel BG momentum, use carb/insulin pickups | Tilt / arrow keys |
| 8 | **Sick Day Protocol** | Step through illness management | Decision tree |
| 9 | **Portion Estimator** | Estimate carbs from visual plate | Slider input |
| 10 | **Night Watch** | Manage overnight BG | Monitor + intervene |

---

## Daily Mini-Game Assignments

Each day has exactly **2 mini-game slots**: Morning (9:30) and Afternoon (14:30).
Night Watch appears as an **optional evening event** on Days 3, 5, and 7.

| Day | Morning Game (9:30) | Afternoon Game (14:30) | Evening (optional) |
|---|---|---|---|
| **Day 1** | Carb Counter *(tutorial)* | Hypo Rescue *(tutorial)* | — |
| **Day 2** | Label Reader *(tutorial)* | Exercise Balance *(tutorial)* | — |
| **Day 3** | Dose Calculator | Pack Your Bag *(school)* | Night Watch |
| **Day 4** | Carb Counter *(advanced foods)* | Glucose Roller | — |
| **Day 5** | Portion Estimator | Sick Day Protocol *(curveball)* | Night Watch |
| **Day 6** | Label Reader *(tricky labels)* | Pack Your Bag *(travel)* | — |
| **Day 7** | Dose Calculator *(complex scenario)* | Exercise Balance *(tournament)* | Night Watch |

---

## Mini-Game Variants by Day

### Carb Counter
- **Day 1 (tutorial):** ~10 food items, carb counts visible, generous target range, companion helps
- **Day 4 (advanced):** 20+ food items, carb counts hidden in "I've Got This" mode, tighter target, unfamiliar foods (naan, perogies, smoothies)

### Label Reader
- **Day 2 (tutorial):** Simple label, 3 questions, companion highlights where to look
- **Day 6 (tricky):** Multi-serving packages, fibre deductions, % Daily Value questions, less obvious labels

### Dose Calculator
- **Day 3:** Standard meal + current BG. Player calculates meal dose + correction if needed. Companion available for hints.
- **Day 7 (complex):** Odd carb counts, BG that's slightly low (reduce dose?), active insulin on board to account for. No companion hints.

### Exercise Balance
- **Day 2 (tutorial):** Slow pace, clear BG drop, obvious snack timing, companion narrates
- **Day 7 (tournament):** Fast pace, sustained exercise, pre-exercise snack option, post-exercise delayed low risk, intensity variation

### Pack Your Bag
- **Day 3 (school):** Basic supplies — insulin, meter/CGM, glucose tabs, snacks, water, medical ID. Generous timer.
- **Day 6 (travel):** Everything above plus: extra supplies, backup batteries, keeping insulin cool, TSA considerations, time zone notes. Tighter timer.

### Glucose Roller
- **Day 4:** Abstract marble-run. Carb pickups push ball up, insulin pickups pull down, exercise ramps speed up + trend down. Target: stay in green channel. Teaches BG momentum intuitively.

### Portion Estimator
- **Day 5:** Photos/illustrations of plated food. Estimate total carbs using fist=cup, palm=protein portion references. Real foods, real portions.

### Sick Day Protocol
- **Day 5 (curveball):** Replaces normal afternoon game. BG is 16.5, ketones moderate. Step through: check BG → check ketones → hydrate → correction dose → eat if dosing → call for help threshold → recheck. Branching paths for decisions.

### Night Watch
- **Days 3, 5, 7 (evening):** Set overnight plan, then watch BG drift in fast-forward. Intervene if needed. CGM players get alerts; finger prick players must actively check.

---

## Mini-Games and Scripted Events

### Anchored Mini-Games (always these specific games on these days)
| Day | Slot | Game | Why Anchored |
|---|---|---|---|
| Day 1 AM | Morning | Carb Counter tutorial | First exposure to carb identification |
| Day 1 PM | Afternoon | Hypo Rescue tutorial | Must learn 15-15 rule on Day 1 |
| Day 5 PM | Afternoon | Sick Day Protocol | Anchored to Day 5 illness storyline |

### Pool Mini-Games (assigned by rotation, could be shuffled on replay)
All other mini-game assignments follow the rotation table above on first playthrough. On subsequent weeks, the rotation shuffles (Day 2's games might appear on Day 4, etc.) but tutorial versions never repeat — always the advanced variant.

---

## Mini-Game ↔ Narrative Integration

Each mini-game is framed by narrative passages:

```
[Narrative intro passage] — sets the scene, companion introduces the game
        ↓
[MINI-GAME PLAYS] — returns score (0-3 stars), BG effect, optional collectible
        ↓
[Narrative result passage] — companion reacts, BG consequence applied, collectible notification
```

### How Scores Affect the Game
| Stars | BG Consequence | Companion Reaction |
|---|---|---|
| 0 | BG moves significantly out of range | "Tricky one! Your blood sugar might wobble." |
| 1 | BG moves moderately | "Not bad! Room to improve." |
| 2 | BG moves a little | "Nice work!" |
| 3 | BG stays very stable | "Nailed it!" |

Stars are **never displayed to the player**. They only affect BG outcomes and companion feedback.

---

## Beta Cells Awarded by Mini-Games

| Game | Beta Cell (first play only) | Color |
|---|---|---|
| Carb Counter | "Carbs Are Everywhere" | Green |
| Dose Calculator | "What is a Bolus?" | Blue |
| Hypo Rescue | "The 15-15 Rule" | Red |
| Exercise Balance | "Adjusting for Exercise" | Green |
| Label Reader | "Reading a Nutrition Label" | Green |
| Pack Your Bag | "Packing for a Trip" | Green |
| Glucose Roller | "What is Basal Insulin?" | Blue |
| Sick Day Protocol | "Sick Day Management" | Green |
| Portion Estimator | "Portion Size Estimation" | Green |
| Night Watch | "Overnight Safety" | Red |

---

## Implementation Notes

- All mini-games are currently **placeholder passages** that simulate a 2-star result
- Each placeholder includes a `// TODO: MINI-GAME HOOK` comment with the full spec
- Mini-games should be built as self-contained JS modules with `init()`, `update()`, `finish()`, `destroy()` methods
- The `MiniGameLauncher` will eventually replace the placeholder passages
- Mini-games render in `#minigame-overlay` (canvas + DOM UI)
- HUD remains visible during mini-games
- All mini-games are keyboard+mouse playable (no touch-only mechanics)
- Device differences (pump/injection, CGM/finger prick) are cosmetic skins only within mini-games
