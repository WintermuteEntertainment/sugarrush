# Mini-Game Specifications

2 mini-games per day, 14 total sessions across the week. Games are drawn from a rotating pool. Each game has a tutorial version (Day 1-2) and full version (Day 3+). All mini-games work identically regardless of pump/injection choice — device differences are purely cosmetic (different sprites/UI skin for the dosing interface).

All mini-games are built in vanilla JS, launched from Twine passages, and return a score that feeds into the BG simulation.

---

## Shared Mini-Game Framework

### Launch Pattern
1. Twine passage sets up the narrative context ("Time for PE!")
2. Passage triggers a JS function: `launchMiniGame('exercise-balance', { difficulty: 2, currentBG: 7.5, ... })`
3. Mini-game runs in a full-screen overlay (or replaces the Twine view)
4. On completion, mini-game returns results: `{ score: 85, bgEffect: -1.5, collectibleEarned: true, ... }`
5. Twine passage resumes with results applied to game state

### Shared Mechanics
- **All mini-games show current BG** in the corner — it's always visible
- **All mini-games are timed** but generously — time pressure adds engagement without panic
- **"Learning the Ropes" mode:** Slower pace, more hints, wider success margins, companion tips visible
- **"I've Got This" mode:** Faster pace, no hints unless asked, tighter success margins
- **All games have a brief companion intro** explaining what to do (skippable after first play)
- **No fail state.** You can do poorly but you can't "lose." Poor performance means a BG consequence that you then manage.

### Scoring
Every mini-game produces a **0-3 star result** (internal, affects BG) and a **fun feedback message**:
- 0 stars: "Tricky one! Your blood sugar might wobble a bit." (BG moves significantly)
- 1 star: "Not bad! Room to improve." (BG moves moderately)
- 2 stars: "Nice work!" (BG moves a little)
- 3 stars: "Nailed it!" (BG stays very stable)

Stars are never displayed as a judgment — they're internal. The player sees the BG consequence and the feedback message.

---

## Game 1: Carb Counter

### Concept
Food items appear. Player builds a plate/meal and estimates total carbs. Closest to the actual total = best score.

### Mechanics
- A **target carb range** is given (e.g., "Build a lunch with 30-45g of carbs")
- Food items are displayed as illustrated cards with names (and carb counts in tutorial mode)
- Player drags items onto a plate
- A running total shows their estimate (in "I've Got This" mode, they input their own estimate)
- Submit when done

### Food Database
Real foods with real carb counts, aligned with **Canada's Food Guide** and Health Canada nutritional data. Examples:
| Food | Carbs | Category |
|---|---|---|
| Slice of bread | 15g | Grain |
| Apple | 15g | Fruit |
| Banana | 27g | Fruit |
| Cup of rice | 45g | Grain |
| Chicken breast | 0g | Protein |
| Slice of pizza | 30g | Mixed |
| Glass of milk | 12g | Dairy |
| Juice box | 15g | Drink |
| Handful of nuts | 5g | Fat/Protein |
| Yogurt cup | 15g | Dairy |
| Pasta (1 cup) | 43g | Grain |
| Tortilla | 20g | Grain |
| Cheese slice | 1g | Dairy/Fat |
| Egg | 1g | Protein |
| Broccoli (1 cup) | 6g | Vegetable |
| Carrot sticks | 6g | Vegetable |
| Potato (medium) | 37g | Vegetable/Starch |
| Candy bar | 35g | Treat |
| Cookie | 20g | Treat |
| Soda can | 39g | Drink |

This list expands as the week progresses — Day 1-2 has ~10 items, Day 7 has 20+.

### Scoring
- Within 5g of target center: 3 stars
- Within 10g: 2 stars
- Within 20g: 1 star
- More than 20g off: 0 stars

### Nutritional Education Hook
After each round, a quick fact: "Did you know? Rice and pasta have similar carbs — about 40-45g per cup." These facts tie into the collectible journal.

### Visual Style
Colorful food illustrations on a checkered tablecloth. Drag-and-drop onto a round plate. Carb counter as a friendly meter on the side.

---

## Game 2: Dose Calculator

### Concept
Given a meal and a current BG reading, calculate the correct insulin dose. Practice the math that becomes second nature.

### Mechanics
- Screen shows: a plate of food with total carbs labeled, current BG reading, and the player's insulin-to-carb ratio (1:10 in early game, can be varied later)
- Player uses a **dial/slider** to set their dose
  - Pump skin: a pump screen with up/down buttons (0.5 unit increments)
  - Injection skin: a pen dial (1 unit increments for standard, 0.5 for half-unit pens)
- Player also has a **correction factor** displayed: "1 unit brings BG down by 3 mmol/L"
- If BG is high, they need to add a correction dose on top of the meal dose
- Confirm and see the result

### Tutorial Version
- Companion walks through the math step by step
- "Your meal is 40g of carbs. Your ratio is 1:10. So that's... 4 units!"
- "But your BG is 12.0 — that's 2 above target (10). Your correction factor is 1:3. So 2 ÷ 3 ≈ 0.7 extra. Round to 1 unit. Total: 5 units!"

### Full Version
- Just the numbers, player does the math
- Time pressure (gentle clock)
- Occasionally tricky: odd carb counts, BG already in range (no correction needed), BG slightly low (maybe reduce dose — advanced concept for Day 5+)

### Scoring
- Exact correct dose: 3 stars
- Within 1 unit: 2 stars
- Within 2 units: 1 star
- More than 2 off: 0 stars

### BG Consequence
Overdose → BG will trend low in the next segment (treatable)
Underdose → BG will trend high (correctable)
Correct → smooth sailing

---

## Game 3: Hypo Rescue

### Concept
BG is dropping. Grab the right amount of fast-acting sugar. Treat with 15g. Wait. Recheck. Don't over-treat.

### Mechanics
- Screen: a kitchen/room with items scattered or on shelves
- Items move/appear (speed based on difficulty):
  - Juice box (15g) ✓ ideal
  - 3 glucose tabs (5g each = 15g) ✓ ideal
  - Candy bar (30g) — too much
  - Regular soda (39g) — way too much
  - Diet soda (0g) — useless
  - Apple (15g, but slow-acting) — not ideal for emergency
  - Chocolate (fat slows absorption) — not ideal
  - Milk (12g, moderate speed) — okay but not optimal
- Player grabs items. Running total of fast-acting carbs shown.
- After selecting, a 15-second timer counts down ("waiting 15 minutes...")
- BG is rechecked
- If still low: option to treat again (teaches the repeat cycle)
- If over-treated: BG rebounds high — companion explains why

### Visual Style
Slightly urgent — screen edges pulse yellow/red matching BG severity. Not scary, but energetic. Companion is visibly alert: "Okay, let's handle this. You know what to do."

### Scoring
- Grabbed exactly 15g of fast-acting sugar: 3 stars
- Grabbed 12-20g of fast-acting: 2 stars
- Grabbed the right amount but slow-acting: 1 star
- Way over or way under: 0 stars

### Educational Points
- Fast-acting vs. slow-acting sugar
- Why fat (chocolate) slows absorption
- Why over-treating causes rebound highs
- The 15-15 rule

---

## Game 4: Exercise Balance

### Concept
Physical activity (PE, sports, play). Keep moving for points while monitoring BG dropping. Time your snack break correctly.

### Mechanics
- Side-scrolling or top-down character running/moving
- Simple controls: tap/click/arrow keys to keep moving (rhythm-based or endless-runner style)
- BG meter is prominently displayed and slowly drops during exercise
- Player must decide WHEN to pause and eat a snack
  - Too early: wastes a snack, doesn't get full exercise benefit
  - Just right: BG stays in range, good exercise session
  - Too late: BG goes low, emergency treatment needed (transitions to Hypo Rescue)

### Additional Mechanics (later in week)
- Pre-exercise snack option: eat before starting? (If BG is low-ish, smart move)
- Intensity variation: sprinting drops BG faster than walking
- Pump users: option to reduce basal rate before exercise (a toggle in the HUD — same for both device types as a learning moment, but pump users see it as "your" feature and injection users see it as "this is what pumps can do")
- Post-exercise delayed low: BG continues to drop after stopping (Day 5+ concept)

### Scoring
- Stayed in range entire session + good exercise: 3 stars
- Went slightly low but caught it: 2 stars
- Needed emergency treatment: 1 star
- Went very low or didn't exercise enough: 0 stars

### Visual Style
Bright, active, outdoor setting. Character animates running/jumping/playing. Energy meter syncs with movement. Fun and kinetic.

---

## Game 5: Label Reader

### Concept
Read a real Canadian nutrition facts label carefully and find the key information. An accuracy challenge — no time pressure. Take your time, get it right.

### Mechanics
- A **Canadian Nutrition Facts table** appears (styled to match real Health Canada formatting)
- Questions appear one at a time — player answers at their own pace:
  - "How many total carbohydrates per serving?"
  - "What's the serving size?"
  - "How many servings are in the package?"
  - "How many carbs if you eat the WHOLE package?"
  - "How much fibre? (Fibre can be subtracted from total carbs)"
  - "What's the % Daily Value for sugar?" (Canadian labels show this)
- Player taps/clicks the correct number on the label
- **No timer.** Accuracy is everything. The game rewards careful reading, not speed.
- After each answer, brief feedback explains why that number matters

### Tutorial Version
- Companion highlights where to look: "The carb count is right here... and the serving size is up here..."
- Fewer questions, more explanation per answer

### Scoring
- All correct: 3 stars
- One mistake: 2 stars
- Two mistakes: 1 star
- Three+ mistakes: 0 stars

### Educational Points (aligned with Canada's Food Guide)
- Serving size vs. package size (a classic trap)
- Total carbs vs. sugar vs. fibre
- "Net carbs" concept (total carbs - fibre)
- % Daily Value and what it means
- Reading labels is a superpower, not a chore
- Canadian Nutrition Facts tables follow a specific Health Canada format — learning to read one means you can read them all

### Nutritional Framework Note
All food data, label formatting, and dietary guidance throughout the game follows **Canada's Food Guide** and Health Canada nutritional labelling standards. This means:
- The plate model: half vegetables/fruits, quarter protein, quarter whole grains
- Water as the drink of choice
- Emphasis on whole foods over processed
- Canadian Nutrition Facts table format (bilingual, % DV, specific nutrients listed)

---

## Game 6: Pack Your Bag

### Concept
Going somewhere (school, trip, friend's house). Pack everything you need before the timer runs out.

### Mechanics
- A bag/backpack in the center
- Items scattered around a room:
  - ESSENTIAL: Insulin (pen/pump supplies), blood sugar checker (meter/CGM receiver), glucose tabs/fast sugar, snacks, water, medical ID
  - GOOD TO HAVE: Extra supplies, backup batteries, emergency contact card
  - NOT NEEDED: Random items (toys, random foods, sunscreen) — not wrong, just not diabetes-specific
  - WRONG: Things that shouldn't come (expired insulin, someone else's medication)
- Drag items into the bag. Timer is generous but present.
- After packing, a "trip" plays out and any missing item is noticed:
  - Forgot glucose tabs → can't treat a low properly later
  - Forgot snacks → no mid-trip fuel
  - Forgot insulin → can't dose for meals (big problem)
  - Forgot meter → can't check BG (consequence depends on CGM/finger prick choice)

### Scoring
- All essentials + some extras: 3 stars
- All essentials: 2 stars
- Missing one non-critical item: 1 star
- Missing a critical item: 0 stars (and a narrative consequence later that day)

### Variations
- **School bag** (Day 2-3): simple, few items
- **Sleepover bag** (Day 4): more items, overnight supplies
- **Day trip bag** (Day 5): need to keep insulin cool, more snacks
- **Travel bag** (Day 6-7): TSA/security considerations, time zone planning, extra supplies

---

## Game 7: Glucose Roller

### Concept
A marble-run / tilt-maze game. Guide a ball (representing BG) through a course, avoiding high and low zones. Teaches the "feel" of BG momentum — it doesn't stop on a dime.

### Mechanics
- Tilt controls (arrow keys, mouse movement, or device tilt on tablets)
- Ball rolls through a course with:
  - Green zones (target range) — stay here for points
  - Yellow zones (mildly high/low) — lose points slowly
  - Red zones (very high/very low) — lose points fast
  - Boost pads (carbs) — push the ball up
  - Brake pads (insulin) — pull the ball down
  - Speed ramps (exercise) — ball moves faster and trends down
- Player uses carb/insulin pickups to navigate the course and keep the ball in the green channel

### Purpose
This is more abstract than the other mini-games. It's about **intuition** — feeling how BG has momentum, how insulin and carbs don't act instantly, how corrections take time. It's the "fun one" that teaches a deep concept through mechanics rather than information.

### Scoring
- Time in green zone: 3 stars if >80%, 2 if >60%, 1 if >40%, 0 if <40%

### Visual Style
Abstract, colorful, satisfying physics. Think a simplified Marble Blast or a tilt-sensor game. Nice sound design — chimes in green, dull tones in yellow, alarm in red.

---

## Game 8: Sick Day Protocol

### Concept
You're sick. BG is running high. Everything is harder. Step through the management protocol correctly.

### Mechanics (more puzzle/decision than action)
- A checklist-style interface with a timeline
- Steps appear as decisions:
  - Check BG → reading is 16.5 (very high)
  - Check ketones → moderate ketones detected
  - Drink water? → Yes (always yes when high + ketones)
  - Correction dose? → Calculate and administer
  - Eat something? → May not want to, but need some carbs if taking insulin
  - Call someone? → At what ketone level do you call the doctor?
  - Recheck in 1-2 hours → Are things improving?
- Branching paths depending on choices
- If ketones worsen → DKA protocol (more urgent, companion walks through emergency steps)

### Scoring
- Correct protocol followed: 3 stars
- Minor misstep (e.g., forgot to recheck): 2 stars
- Significant error (e.g., no correction dose): 1 star
- Dangerous error (e.g., ignored high ketones): 0 stars + companion intervenes with "IMPORTANT" lesson

### When It Appears
Day 5-6 only. Not a common mini-game — it's a curveball event that replaces the normal mini-game for that slot.

---

## Game 9: Portion Estimator

### Concept
Visual portion estimation. Photos or illustrations of food on plates — guess the amount and therefore the carbs.

### Mechanics
- A plate of food is shown (illustrated to match game art style)
- Player estimates: "How many grams of carbs on this plate?"
- Slider from 0g to 100g
- After guessing, the breakdown is shown:
  - "That was about 1.5 cups of rice (67g) + chicken (0g) + sauce (8g) = 75g total"
- Common reference tools taught:
  - "Your fist ≈ 1 cup"
  - "Your palm ≈ 3oz of protein"
  - "Your thumb ≈ 1 tablespoon"

### Scoring
- Within 10g: 3 stars
- Within 20g: 2 stars
- Within 30g: 1 star
- More than 30g off: 0 stars

### Educational Points
- Portion size estimation is a real-world skill
- Visual reference tricks (fist = cup, etc.)
- Common portion sizes for common foods
- "Close enough" is often good enough in real life too

---

## Game 10: Night Watch

### Concept
Overnight BG management. A slower, atmospheric mini-game. Set up your overnight plan, then monitor.

### Mechanics
- Before bed: set your overnight plan
  - What was your bedtime BG?
  - Did you have a bedtime snack?
  - (Pump users) Set overnight basal rate
  - Set an alarm to check? (Optional but smart)
- Night plays out in fast-forward with a moving BG line graph
- Player can intervene at any point by "waking up" (tap/click)
- Random events:
  - BG drifting low → need a snack
  - BG drifting high → need a correction
  - CGM alarm goes off (CGM players only)
  - Nothing happens (sometimes nights are fine!)
- Goal: wake up with BG in range (5-12)

### Visual Style
Dark, cozy bedroom setting. Stars outside the window. Calm music. The BG line graph glows softly. Peaceful until/unless something needs attention.

### When It Appears
Day 3+ as an evening mini-game replacement. Teaches overnight management, which is a real concern for T1D families.

---

## MINI-GAME WEEKLY ROTATION

| Day | Morning Game | Afternoon Game |
|---|---|---|
| 1 | Carb Counter (tutorial) | Hypo Rescue (tutorial) |
| 2 | Label Reader (tutorial) | Exercise Balance (tutorial) |
| 3 | Dose Calculator | Pack Your Bag (school) |
| 4 | Carb Counter (advanced foods) | Glucose Roller |
| 5 | Portion Estimator | Sick Day Protocol (curveball) |
| 6 | Label Reader (tricky labels) | Pack Your Bag (travel) |
| 7 | Dose Calculator (complex scenario) | Exercise Balance (sports tournament) |

Night Watch appears as an optional evening event on Days 3, 5, and 7.

**Second week** reshuffles the rotation and introduces harder variants of each game.

---

## DEVICE-AGNOSTIC DESIGN NOTES

All mini-games work the same regardless of pump/injection or CGM/finger prick choice. Differences are:

**Cosmetic/UI differences:**
- Dose Calculator: pump UI has a screen with buttons, injection UI has a pen dial. Same math.
- Pack Your Bag: different items to pack (pump supplies vs. injection supplies), same mechanic.

**Minor mechanical differences (narrative consequences, not separate games):**
- CGM players see trend arrows in mini-games (extra info)
- Finger prick players must actively check BG (costs a moment of game time but gives them a skill advantage — they learn to "feel" when to check)
- These differences are framed as "different tools, same goal" — never as one being better

**Cross-education moments:**
- Regardless of player's device choice, the Knowledge Journal includes entries about ALL devices
- Some [TEACH] moments involve explaining the other type of device to an NPC
- A collectible specifically rewards learning about the device you DIDN'T choose
