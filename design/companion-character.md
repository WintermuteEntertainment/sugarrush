# Companion Character: The Robot

## Identity

A small, friendly robot. Not sleek/futuristic — more handmade, warm, slightly clunky. Think Wall-E energy, not Siri energy. Fits naturally alongside pumps and CGMs as another piece of helpful tech in the player's life.

**Name:** Player-nameable, with a default suggestion. Needs a good default — something short, friendly, slightly techy but not cold. Candidates:
- Bolus (Bo for short)
- Pip
- Byte
- Lumen
- Ohm
- Glitch (endearing, implies imperfection is okay)

(TBD — worth playtesting which name kids gravitate toward)

## Visual Design

- Small enough to sit on the player's shoulder or float beside them in scenes
- Rounded/soft edges, not angular or intimidating
- Expressive "face" — a simple screen/display that shows emotions (happy eyes, concerned eyes, celebratory sparkles, thinking dots)
- Has a small antenna or sensor — visual tie to CGMs/pumps
- Color: friendly and warm. Maybe teal/mint, or a soft orange. Should contrast well against both light and dark backgrounds.
- Animates simply: bobs when idle, bounces when excited, droops when the player is having a tough moment (empathy, not sadness)

## Personality

- **Warm but not saccharine.** Genuine care, not forced cheerfulness.
- **Gently funny.** Dry observations, not slapstick. Occasional light jokes that land naturally, never forced.
- **Retired pancreas joke:** Used exactly once — during the companion's introduction on Day 1. "Your pancreas decided to take early retirement. Rude, honestly. That's where I come in." Then never repeated. One-time bit, not a running gag.
- **Never condescending.** Treats the player as capable, even in "Learning the Ropes" mode. Offers help, doesn't assume incompetence.
- **Honest about hard things.** Doesn't sugarcoat (pun acknowledged) the reality of T1D. "Yeah, this part is annoying. But you've got it."
- **Celebrates without overdoing it.** A good BG reading gets a genuine "Nice!" not a parade of confetti. Saves the big celebrations for genuinely big moments.

## Behaviour by Difficulty Mode

### "Learning the Ropes"
- Proactively offers tips before each new situation
- Explains the HUD elements as they become relevant
- Gives step-by-step guidance during first encounters (first meal, first dose, first low)
- Gently reminds if the player hasn't checked BG in a while
- Offers encouragement after every meal/mini-game, even if it went poorly
- Shows thought process: "Okay, that's 30g of carbs. Your ratio is 1:10. So we need... 3 units!"

### "I've Got This"
- Stays quiet unless the situation is new or the player asks for help
- Reacts to events (expressions change, short comments) but doesn't lecture
- If BG is drifting dangerously, gives a gentle nudge: "Hey, might want to check in."
- Available on demand — player can "ask" the companion at any time for a hint or explanation
- Respects the player's autonomy. No unsolicited step-by-step guidance.

## Companion in Specific Contexts

### During Meals (Narrative)
- Appears in the scene, sitting on the table or hovering nearby
- In "Learning the Ropes": helps identify carbs, suggests dose, reminds about timing
- In "I've Got This": quiet unless asked, reacts with expressions (nods at good choices, tilts head at risky ones)
- After the meal: brief comment on how it went, tied to BG outcome

### During Mini-Games (JS)
- Appears in a corner of the mini-game screen
- Animated reactions to player actions (cheers on good moves, winces at mistakes)
- In "Learning the Ropes": tooltip hints pop up from the companion
- In "I've Got This": just reactive expressions, no text unless critical

### During Social Events
- Visible only to the player (it's "their" companion — NPCs don't interact with it)
- Whispers encouragement before tough conversations: "You've got this."
- After social events, reflects: "That was a good call" or "That was tough. You handled it."
- Never tells the player what to say — just supports whatever they choose

### During Emotional Events
- Most important context. The companion's role here is to **validate, not fix.**
- If the player is frustrated: "Yeah. It's a lot." (Not "But look on the bright side!")
- If the player is proud: "You should be. That was all you."
- If the player is burned out: "Makes total sense. Everyone needs a break sometimes."
- Matches the player's energy. Doesn't force positivity. Sits with hard feelings.

### During Emergencies (Hypo, DKA)
- Tone shifts to calm and focused (not panicked)
- Clear, direct language: "Okay, you're low. Let's treat it. You know the steps."
- In "Learning the Ropes": walks through each step
- In "I've Got This": trusts the player but stays alert. Steps in if the situation worsens.
- After resolution: "Good work. That's handled. You're okay."

### During Night Events
- Soft glow in the dark bedroom scene
- Gentle voice: "Hey. Wake up for a sec. Let's check your number."
- Reassuring: "Everything's fine, just a quick check. Back to sleep."

## Companion and Confidence Score

The companion doesn't explicitly reference the confidence number, but its behaviour subtly reflects it:
- Low confidence (0-30): More proactive support, more encouragement, checks in more often
- Mid confidence (30-70): Balanced — supportive but gives space
- High confidence (70-100): Mostly steps back, celebrates milestones, treats player as a peer

This creates a natural progression where the companion "trusts you more" as your confidence grows — without ever gating content or dialogue options behind the number.

## Companion Lines — Tone Examples

**Morning check-in:**
- "Morning! Let's see where we're at." (neutral)
- "New day, fresh start. How's the number?" (after a rough yesterday)
- "Day 5 already. You're getting good at this." (mid-week)

**Good BG reading:**
- "Right in the green. Nice."
- "Look at that number. Solid."

**Bad BG reading (high):**
- "Running a bit high. No big deal — let's bring it down."
- "Okay, 14.5. Not ideal, but we've handled this before."

**Bad BG reading (low):**
- "Little low. Let's grab something quick."
- "4.2 — you know the drill. 15 grams, 15 minutes."

**After a tough social moment:**
- "That wasn't easy. But you said what you needed to say."
- "Not everyone's going to get it right away. That's on them, not you."

**After a mistake:**
- "Happens. Even people who've done this for years miscalculate sometimes."
- "Not the result we wanted, but now you know for next time."

**Burnout/frustration:**
- "I hear you. This is a lot."
- "Wanna take a minute? The game's not going anywhere."

**Pride moment:**
- "You handled that whole day. No help needed. That's real."
