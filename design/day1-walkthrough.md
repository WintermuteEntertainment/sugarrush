# Day 1: Tutorial Day — "Welcome to the Club"

Day 1 is fully guided. The companion walks the player through every system. By the end of the day, the player should understand: checking BG, carb counting basics, insulin dosing, treating a low, and why snacking matters. No curveballs. No failure states. Pure learning.

---

## Pre-Day: Character Setup

Before Day 1 starts:
1. **Name your character** (text input)
2. **Customize appearance** (hat, face, shirt, shoes — simple paper-doll picker)
3. **Choose your gear:**
   - "How do you take your insulin?" → Pump / Injections (with a brief, neutral description of each)
   - "How do you check your blood sugar?" → CGM / Finger Pricks (same neutral framing)
4. **Meet your companion** — A small, friendly robot appears. Player can name it (default suggestion provided). It introduces itself with warmth and a single retired-pancreas quip: "Your pancreas decided to take early retirement. Rude, honestly. That's where I come in." The joke lands once and is never repeated.
5. **Choose difficulty:**
   - "Learning the Ropes" — "I'm new to this and want help along the way"
   - "I've Got This" — "I know some stuff, let me figure things out"

---

## 7:00 — Wake Up

**Mode:** Twine narrative

The alarm goes off. First-person narration sets the scene: your bedroom, morning light, a normal day — except now you've got some new gear to think about.

**Companion says:** "Morning! First things first — let's check in. How's your blood sugar?"

**Tutorial moment:** Player is walked through checking BG.
- CGM players: "See that number on your screen? That's your blood sugar, always updating. Right now you're at **7.2**. The green zone is **5 to 12** — and you're right in it!"
- Finger prick players: "Time to prick your finger and check. Don't worry, it's quick." [Simple tap/click interaction] "**7.2** — right in the green zone! That's **5 to 12**."

**Companion explains the HUD:** "See that bar up top? That's your blood sugar meter. Green means you're in range. It'll move throughout the day based on what you eat, your insulin, and what you do. Our job is to keep it in the green as much as we can."

**Energy meter introduced:** "And that lightning bolt? That's your energy. When your blood sugar is in range, you feel great. When it goes too high or too low... well, you'll see."

**Collectible #1:** (Beta Cell) "Oh! See that glowing thing? That's a **Beta Cell**! Grab it! Each one teaches you something new. Try to find them all this week!" → Journal entry unlocked: "What is Blood Sugar?"

---

## 7:30 — Breakfast

**Mode:** Twine narrative (this is the first full meal scene)

Scene: Kitchen. A parent/guardian has set out options.

**Companion says:** "Time to eat! But here's the thing — different foods affect your blood sugar differently. Foods with more **carbs** raise it more. Let's look at your options."

**Meal choices (simple, guided):**

| Option | Description | Carbs |
|---|---|---|
| A) Cereal with milk | "A bowl of your favourite cereal. Tasty! The box says 45g of carbs." | 45g |
| B) Toast with peanut butter | "Two slices of toast with peanut butter. The bread has carbs, the peanut butter not so much. About 30g total." | 30g |
| C) Scrambled eggs on toast | "Eggs are almost zero carbs, but the toast has some. About 20g total." | 20g |

**Companion walks through the choice:** "None of these are wrong! But the more carbs you eat, the more insulin you'll need. Let's pick one and learn how to match it."

Player picks. No wrong answer — companion adjusts guidance based on choice.

**First insulin dosing tutorial:**

**Companion:** "Okay, you chose [X] — that's [Y]g of carbs. Now we need insulin to help your body use those carbs. Here's how we figure out how much..."

Tutorial overlay explains:
- "Your **insulin-to-carb ratio** is **1 unit for every 10g of carbs**" (simplified for tutorial)
- "So for [Y]g of carbs, you need [Y/10] units"
- Pump players: "Tap your pump and dial in [amount]" [simple dial interaction]
- Injection players: "Dial up your pen to [amount] and click the button" [simple dial interaction]

Both interactions are mechanically identical (dial a number, confirm) with different cosmetic framing.

**Companion:** "Nice! The insulin will start working in about 15 minutes and keep working for a few hours. Let's see how breakfast goes!"

BG starts rising gently from carbs, then insulin kicks in and brings it back down. The player watches the meter move — companion narrates: "See it going up a bit? That's the carbs. And... there, the insulin is kicking in. Coming back down. Nice and smooth!"

**Collectible #2:** Journal entry unlocked: "What are Carbs?"

---

## 9:00 — Morning Snack

**Mode:** Twine narrative (light/quick)

Scene: It's been a couple of hours. Companion checks in.

**Companion:** "It's been a while since breakfast. A small snack keeps your energy steady and your blood sugar from dipping too low. What do you fancy?"

**Snack choices:**
| Option | Carbs |
|---|---|
| Apple slices | ~15g |
| Cheese and crackers | ~15g |
| Handful of nuts | ~5g |

**Companion:** "For a small snack like this, you [might need a tiny bit of insulin / might not need any insulin depending on your current BG]. Let's check your number first."

Player checks BG. Companion advises based on the reading:
- If in range (5-12): "You're looking good. A small snack with just a little insulin, or something low-carb with none."
- Tutorial always puts them in range here — no surprises on Day 1.

No collectible here — keeps the snack scenes quick.

---

## 9:30 — Morning Mini-Game: "Carb Counter"

**Mode:** Vanilla JS mini-game

**Companion intro:** "Pop quiz! Not really, it's more of a game. Let's see how well you can spot carbs!"

### Tutorial version of Carb Counter:
- Food items slide across the screen one at a time (not fast)
- Each item has its name and carb count visible (training wheels)
- Player drags items onto a plate to build a meal
- A carb counter tallies up as items are added
- Goal: build a meal that hits a target carb range (e.g., "make a lunch with 30-45g of carbs")
- Companion gives real-time feedback: "Bread — that's got carbs! Rice — more carbs! Chicken — almost none! You're getting it!"

**Scoring:**
- Within target range: "Great job! You nailed it!"
- Over target: "A bit high on carbs — that would need more insulin. But now you know!"
- Under target: "A bit low — you might get hungry later. Good to know for next time!"

Score contributes to daily Time in Range via the BG simulation (closer to target = better BG outcome for the next segment).

**Collectible #3:** Always awarded on Day 1 tutorial. Journal entry: "Carbs Are Everywhere (And That's Okay)"

---

## 11:30 — Lunch

**Mode:** Twine narrative (major scene — first social interaction)

Scene: School cafeteria (or home/park depending on narrative — cafeteria for Day 1).

**Part 1: The Meal**

**Narrative:** You get to the cafeteria. Today's options are on the board.

| Option | Description | Carbs |
|---|---|---|
| A) Cheese pizza (1 slice) | The classic. Doughy and delicious. | ~30g |
| B) Chicken wrap | Comes with a nutrition label on the packaging. | ~25g |
| C) Pasta with tomato sauce | A big bowl. Pasta is carb-heavy. | ~50g |

This time, the companion is less hand-holdy than breakfast:
- "Learning the Ropes": Companion still shows carb counts and suggests insulin dose
- "I've Got This": Companion shows carb counts but asks "How much insulin do you think?" — player inputs, companion confirms or gently corrects

**Part 2: The Social Beat**

A friend (NPC) sits down next to you.

**Friend:** "Hey, what's that thing? [pointing at pump/CGM/injection pen — adapts to player's gear choice]"

**Dialogue options:**
- A) "It's my insulin pump/CGM. It helps me manage my diabetes." (Straightforward)
- B) "It's basically a tiny computer that gives me medicine. Pretty cool actually." (Casual/positive)
- C) "I'd rather not talk about it right now." (Valid boundary-setting)

All options are valid. Each gets a slightly different response from the friend:
- A) Friend: "Oh cool, does it hurt?" → leads to a brief, warm exchange
- B) Friend: "No way, that IS cool. Can I see?" → leads to a brief, warm exchange  
- C) Friend: "Oh, okay! Want some of my chips?" → friend is respectful, moves on

**Companion (privately):** "Nice. Talking to people about T1D gets easier with practice. Some days you'll want to share, some days you won't. Both are fine."

**Confidence Score:** +5 for any choice (Day 1 is gentle — all choices build confidence). The companion notes: "Your confidence is building! Check the meter — you're at 55 now."

**Collectible #4:** Journal entry: "Talking to Friends About T1D"

---

## 14:00 — Afternoon Snack

**Mode:** Twine narrative (quick)

Player's BG is checked. Companion suggests a snack before the afternoon activity.

**Choices:**
| Option | Carbs |
|---|---|
| Granola bar | ~20g |
| Yogurt | ~15g |
| Trail mix | ~10g |

Quick dose decision. On Day 1 tutorial, companion guides if needed.

---

## 14:30 — Afternoon Mini-Game: "Hypo Rescue" (Tutorial Version)

**Mode:** Vanilla JS mini-game

**Setup:** The game deliberately triggers a mild low blood sugar here so the player can learn to treat it in a safe, guided context.

**Companion:** "Uh oh — feeling a bit shaky? Let's check... **4.2**. That's getting low. Time to learn the most important skill: the **15-15 Rule!**"

**Tutorial overlay:**
1. "When you're low (under 5), eat or drink **15 grams** of fast-acting sugar"
2. "Wait **15 minutes**"
3. "Check again. If you're still low, repeat."

### Mini-game mechanics:
- Screen shows a pantry/fridge with options
- Items fly/slide across or are arranged to grab:
  - Juice box (15g) ✓
  - Glucose tabs x3 (5g each = 15g) ✓
  - Candy bar (30g) — too much, will cause a rebound spike
  - Apple (15g but slow-acting) — not ideal for treating a low
  - Soda can (40g) — way too much
  - Diet soda (0g) — won't help at all

- Player grabs items. Target: get close to 15g of fast-acting sugar.
- A timer counts 15 game-minutes (a few real seconds)
- BG is rechecked. If player chose well: "**5.8** — back in the green! Nice work!"
- If player over-treated: "**12.3** — you're safe but a bit high now. That's because you had more sugar than needed. Next time, try to stick closer to 15g."
- If player under-treated: "**4.5** — still a bit low. Let's have a bit more." (Second chance)

**Companion:** "The 15-15 rule is your best friend. You'll get faster at this."

**Collectible #5:** Journal entry: "The 15-15 Rule — Your Emergency Plan"

**Energy meter dip and recovery:** During the low, the screen trembles slightly and energy meter drops. After treatment, both recover. This connects the "feel" to the numbers.

---

## 16:00 — Late Afternoon Snack

**Mode:** Twine narrative (quick)

Post-activity snack. Player chooses, doses if needed. Companion is brief.

**Companion:** "After being active and treating that low, a snack is a smart move. What sounds good?"

Choices are simple. No complications on Day 1.

---

## 17:30 — Dinner

**Mode:** Twine narrative (major scene — family/home setting)

Scene: Home kitchen. A family member has cooked dinner.

**The challenge:** Home-cooked food doesn't have nutrition labels. This introduces **estimation**.

**Family member:** "Dinner's ready! I made stir-fry with rice, chicken, and veggies."

**Companion:** "No label this time! But we can estimate. Let's break it down:
- Rice: about a cup? That's roughly **45g of carbs**
- Chicken: almost no carbs
- Veggies: a small amount, maybe **5g**
- So the whole plate is roughly **50g**"

**Player interaction:** A simple slider or multiple choice: "How many carbs do you think are on this plate?"
- Options: 25g / 50g / 75g
- Companion confirms: "About 50g sounds right! You're getting good at this."

**Insulin dosing:** Player calculates and doses (with companion help if in "Learning the Ropes" mode).

**Narrative beat:** During dinner, family member asks how the day went. Dialogue options:
- A) "Pretty good! I'm learning a lot." (Positive)
- B) "It's a lot to think about." (Honest)
- C) "Can we talk about something else?" (Boundary)

**Family member responds warmly to all options.** No wrong answer.

**Companion (after dinner):** "Estimating carbs in home-cooked food is a skill. It gets easier every time. Don't worry about being perfect — close is good enough."

**Collectible #6:** Journal entry: "Estimating Carbs Without Labels"

---

## 19:00 — Evening Activity

**Mode:** Twine narrative (relaxed/reflective)

Scene: Evening at home. Player is winding down.

**Narrative options (player picks an activity):**
- A) Watch a show (relaxed, no BG impact)
- B) Play a board game with family (light engagement)
- C) Read about T1D in your journal (reviews collected entries)

This is a low-stakes, low-pressure moment. The purpose is pacing — a breather after the denser meal/mini-game segments. Option C lets the player review what they've learned so far.

**Companion:** "Evenings are a good time to check in with yourself. How's your energy? How's your number? Just a quick peek."

Player checks BG. Should be in range if they managed dinner well. Companion affirms: "Looking good heading into bedtime."

---

## 20:30 — Bedtime Snack & Routine

**Mode:** Twine narrative (closing scene)

**Companion:** "One more thing before bed — a small bedtime snack helps keep your blood sugar steady overnight. Your body still needs fuel even while you sleep!"

**Snack choices:**
| Option | Carbs | Notes |
|---|---|---|
| Crackers with cheese | ~15g | Good mix of carbs + protein |
| Glass of milk | ~12g | Simple, quick |
| Toast with butter | ~15g | Familiar comfort |

**Companion explains:** "A bedtime snack with some **protein** alongside the carbs helps your blood sugar stay steady longer. Protein is like a slow-burning fuel — it doesn't spike you but keeps things level through the night."

**Collectible #7:** Journal entry: "Why Bedtime Snacks Matter"

**Final BG check:**
- Companion walks through the evening routine: check BG, make sure it's in a safe range for sleep
- If everything was managed well: "**7.5** — perfect for bedtime. You're going to sleep well tonight."
- Companion mentions overnight briefly: "Your [CGM will watch / you'll be okay] through the night. If anything happens, I'll be here."

**Day 1 end narration:**
"You made it through your first day. You checked your blood sugar, counted carbs, took your insulin, treated a low, and explained your T1D to a friend. That's... honestly a lot. And you handled it."

---

## 21:00 — Night (No Event on Day 1)

Day 1 is kind. The player sleeps through the night.

A brief dream-sequence transition with soft visuals plays, then...

---

## Day 1 Summary Screen

**Daily Score Panel:**
- **Time in Range:** Shows a simplified line graph of the day's BG. "You spent 82% of your day in the green zone!"
- **Meals managed:** 4/4
- **Snacks remembered:** 3/3
- **Collectibles found:** 7 (out of maybe 8 possible on Day 1 — one is hidden in an optional dialogue path)
- **Confidence Score:** Shows the number (e.g., 60/100) with a gentle label: "Growing!"
- **Companion says:** "Day 1 — done! You learned a LOT today. Tomorrow we'll build on this. Ready?" 

**Transition:** "Start Day 2" button.

---

## Day 1 Design Notes

### What Day 1 teaches:
1. How to read your BG and what the zones mean
2. What carbs are and which foods have more/less
3. How to calculate an insulin dose (simplified ratio)
4. The 15-15 rule for treating a low
5. Estimating carbs without a label
6. That it's okay to talk (or not talk) about T1D
7. Why bedtime snacks matter

### What Day 1 does NOT include (saved for later):
- Night events
- Curveball complications
- Complex carb/protein/fat interactions
- Device failures
- Heavy social pressure
- Emotional difficulty moments

### Mini-games used:
- Carb Counter (tutorial version) — morning
- Hypo Rescue (tutorial version) — afternoon

### Narrative events:
- Friend asks about your device (lunch)
- Family check-in at dinner
- Evening wind-down

### BG trajectory (approximate, assuming decent choices):
```
7:00  7.2  (wake up, in range)
7:30  7.2→9.0→7.5  (breakfast carbs, then insulin kicks in)
9:00  6.8  (pre-snack)
9:30  7.5  (post-snack, during mini-game)
11:30 6.5  (pre-lunch)
12:00 6.5→10.0→8.0  (lunch carbs, then insulin)
14:00 6.0  (pre-snack, drifting toward low)
14:30 4.2  (TRIGGERED LOW for tutorial)
15:00 5.8  (after hypo rescue)
16:00 6.5  (post-snack)
17:30 6.5→10.5→8.0  (dinner carbs, then insulin)
20:30 7.5  (bedtime, stable)
```

This trajectory is scripted for Day 1 to ensure the player hits every learning moment. From Day 2 onward, BG responds to actual player choices.
