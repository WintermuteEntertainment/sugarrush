# Technical Architecture

Twine (SugarCube 2) for narrative + Vanilla JS for mini-games and simulation. Fully offline, single-folder deployment, zero server dependencies.

---

## Why SugarCube 2

SugarCube is a Twine story format specifically built for deep JS integration:
- Full JavaScript API — can call external functions from any passage
- `State.variables` object is accessible from JS (and vice versa)
- Built-in save/load system (localStorage)
- Supports HTML/CSS/JS widgets embedded in passages
- Macro system for reusable narrative components
- Active community, well-documented
- Harlowe (the other popular format) is much harder to extend with custom JS

---

## High-Level Architecture

```
┌─────────────────────────────────────────────┐
│                    HUD OVERLAY               │
│  [BG Meter] [Time] [Energy] [Confidence]    │
│  [Collectible Counter] [Companion Avatar]    │
├─────────────────────────────────────────────┤
│                                              │
│          ACTIVE VIEW (one at a time)         │
│                                              │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │  TWINE STORY     │  │  JS MINI-GAME    │  │
│  │  (narrative mode) │  │  (action mode)   │  │
│  │                   │  │                  │  │
│  │  Passages, meals, │  │  Canvas-based    │  │
│  │  social events,   │  │  or DOM-based    │  │
│  │  dialogue choices │  │  game modules    │  │
│  └─────────────────┘  └──────────────────┘  │
│                                              │
├─────────────────────────────────────────────┤
│               GAME ENGINE (JS)               │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ BG Sim   │ │ State    │ │ Save/Load   │  │
│  │ Engine   │ │ Manager  │ │ System      │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Event    │ │ Score    │ │ Collectible │  │
│  │ Scheduler│ │ Tracker  │ │ Tracker     │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
└─────────────────────────────────────────────┘
```

---

## State Management

A single `GameState` object is the source of truth. SugarCube's `State.variables` syncs with it.

```
GameState = {
  // Player identity
  player: {
    name: "Alex",
    appearance: { hat: 2, face: 1, shirt: 3, shoes: 0 },
    device: { insulin: "pump", bgMonitor: "cgm" },
    difficulty: "learning"  // or "gotthis"
  },

  // Core meters (always visible in HUD)
  bg: {
    current: 7.2,        // mmol/L
    trend: "stable",     // rising, falling, stable, rising_fast, falling_fast
    history: [],         // array of {time, value} for graphing
    unit: "mmol"         // or "mgdl" — display preference only, internal is always mmol
  },
  energy: 85,            // 0-100
  confidence: 50,        // 0-100

  // Insulin tracking
  insulin: {
    onBoard: 0,          // units of active insulin (decays over time)
    lastDose: null,      // { time, units, type: "meal"|"correction" }
    basalActive: true    // pump users only — can be reduced for exercise
  },

  // Time and schedule
  time: {
    day: 1,              // 1-7
    hour: 7.0,           // 7.0 = 7:00, 7.5 = 7:30, etc.
    week: 1              // increments on replay
  },

  // Progress tracking
  score: {
    timeInRange: [],     // per-day percentages
    dailyStars: [],      // per-day mini-game performance
    collectibles: {
      found: [],         // IDs of found collectibles
      total: 48          // total available
    },
    weeklyScore: 0       // calculated at end of week
  },

  // Narrative state
  narrative: {
    eventsCompleted: [],  // IDs of completed events
    choices: {},          // key-value of choice IDs and selected options
    companionMood: "happy" // affects companion dialogue flavor
  },

  // Inventory (for Pack Your Bag and similar)
  inventory: {
    glucoseTabs: 6,
    snacks: 3,
    extraInsulin: true,
    medicalID: true,
    // etc.
  }
}
```

### State Sync Between Twine and JS

```javascript
// From Twine passage (SugarCube macro):
// <<run GameEngine.advanceTime(0.5)>>
// <<run GameEngine.eatMeal({ carbs: 45, protein: 20, fat: 10 })>>
// <<run GameEngine.doseInsulin(4.5)>>

// From JS mini-game (returning results):
// GameEngine.completeMiniGame({ score: 2, bgEffect: -1.5, collectible: "carbs-everywhere" })

// Twine reads state:
// <<if $bg.current < 5>>You're feeling shaky...<<endif>>
// (SugarCube auto-maps State.variables to $ prefix in passages)
```

The key insight: **Twine handles narrative flow and player choices. JS handles simulation, calculations, and action sequences. They share one state object.**

---

## BG Simulation Engine

### Design Goal
Simple, predictable, learnable. NOT a medical simulator. A game physics engine where cause and effect are clear.

### Core Model

```javascript
BGSimEngine = {
  // Tick runs every time game advances (passage change or mini-game frame)
  tick(deltaHours) {
    // 1. Carb absorption: raises BG
    this.processCarbs(deltaHours);

    // 2. Insulin action: lowers BG
    this.processInsulin(deltaHours);

    // 3. Exercise: lowers BG
    this.processExercise(deltaHours);

    // 4. Stress/illness modifiers
    this.processModifiers(deltaHours);

    // 5. Basal metabolism (very slow drift toward high without insulin)
    this.processBasal(deltaHours);

    // 6. Clamp to realistic range (2.0 - 30.0)
    this.clamp();

    // 7. Update energy based on BG
    this.updateEnergy();

    // 8. Record history
    this.recordHistory();
  }
}
```

### Tunable Parameters (kept in a config object for easy adjustment)

```javascript
BGConfig = {
  // Carb impact
  carbRatio: 0.1,          // 1g carbs raises BG by 0.1 mmol/L (so 10g = 1.0)
  carbAbsorptionRate: 0.5, // hours for carbs to fully absorb (fast-acting)
  carbAbsorptionSlow: 2.0, // hours for slow carbs (protein, fat, fibre)

  // Insulin impact
  insulinRatio: 3.0,       // 1 unit lowers BG by 3.0 mmol/L
  insulinOnsetDelay: 0.25, // hours before insulin starts working
  insulinPeakTime: 1.0,    // hours to peak effect
  insulinDuration: 4.0,    // hours of total action

  // Exercise impact
  exerciseDrop: 1.0,       // mmol/L drop per hour of moderate exercise
  postExerciseDrop: 0.5,   // continues dropping for this many hours after

  // Basal drift
  basalDrift: 0.3,         // mmol/L per hour BG rises without any insulin
  basalInsulinRate: 0.3,   // mmol/L per hour basal insulin counteracts

  // Stress/illness
  stressRise: 0.5,         // mmol/L per hour during stress
  illnessRise: 1.0,        // mmol/L per hour during illness

  // Target range
  targetLow: 5.0,
  targetHigh: 12.0,

  // Energy mapping
  energyMap: {
    // BG range → energy drain per hour
    optimal: { range: [5, 12], drain: 0 },
    mildHigh: { range: [12, 15], drain: 5 },
    veryHigh: { range: [15, 30], drain: 15 },
    mildLow: { range: [3, 5], drain: 10 },
    veryLow: { range: [2, 3], drain: 25 }
  }
}
```

**This entire config is a single object that can be tweaked during playtesting without touching game logic.** This is what we mean by keeping BG simulation modular and adjustable.

### Difficulty Scaling
"Learning the Ropes" uses a gentler version of these numbers:
- Wider target range (4-13 instead of 5-12)
- Slower carb absorption (more forgiving timing)
- Slower BG drift (more time to react)
- Energy drains slower outside range

---

## Mini-Game Module Pattern

Each mini-game is a self-contained JS module:

```javascript
// Example: carb-counter.js
const CarbCounter = {
  config: {
    name: "Carb Counter",
    duration: 60,          // seconds
    targetRange: [30, 45], // carbs
  },

  // Called by the game engine to start
  init(container, params) {
    // params: { difficulty, currentBG, companionHints }
    // container: DOM element to render into
    // Sets up the game UI, loads food items, starts timer
  },

  // Called every frame
  update(dt) {
    // Game logic, rendering, input handling
  },

  // Called when game ends (timer or player submits)
  finish() {
    return {
      score: 2,                    // 0-3 stars
      bgEffect: +2.5,             // net carb effect on BG (from the "meal" they built)
      insulinNeeded: 4,           // suggested dose based on their plate
      collectible: "carbs-101",   // collectible ID (or null)
      feedback: "Nice plate! About 42g of carbs — you were right in the zone."
    };
  },

  // Cleanup
  destroy() {
    // Remove event listeners, clear canvas, etc.
  }
};
```

### Mini-Game Launcher

```javascript
MiniGameLauncher = {
  games: {
    'carb-counter': CarbCounter,
    'dose-calculator': DoseCalculator,
    'hypo-rescue': HypoRescue,
    'exercise-balance': ExerciseBalance,
    // ... etc
  },

  launch(gameId, params) {
    // 1. Fade out Twine view
    // 2. Show mini-game container
    // 3. Init the game module
    // 4. Run game loop
    // 5. On finish: collect results, fade back to Twine
    // 6. Apply results to GameState
    // 7. Navigate to the next Twine passage
  }
};
```

---

## HUD Overlay

Always visible, regardless of whether Twine or a mini-game is active.

```
┌──────────────────────────────────────────────────────┐
│ ❤ BG: 7.2 →  │ ⚡ Energy: 85  │ Day 3 · 11:30am │
│ ████████░░░░  │ █████████░░░  │                   │
│ [5───●──10]   │               │ 🏆 12/48          │
└──────────────────────────────────────────────────────┘
```

- **BG display:** Number + trend arrow (↑ ↗ → ↘ ↓) + color-coded bar
  - CGM players: always visible, updates continuously
  - Finger prick players: shows "???" until they check, then shows last reading with a timestamp ("7.2 checked 30min ago"). Trend arrows not available.
- **Energy bar:** Color-coded, drains when BG is out of range
- **Confidence score:** Simple number, updates after social events
- **Day and time:** Current position in the day
- **Collectible counter:** X/48 with a small icon

### Screen Effects (Energy Meter Driven)

When BG is out of range, the game world reflects it:

**Low BG effects (progressive):**
- 3.0-5.0: Slight screen tremor, edges slightly dim
- Below 3.0: Screen shakes, tunnel vision, colors desaturate, UI elements wobble. Audio: heartbeat sound effect.

**High BG effects (progressive):**
- 10.0-15.0: Slight blur/haze, character moves a touch slower in mini-games
- Above 15.0: Heavy fog/blur, sluggish controls, muted colors. Audio: low droning hum.

These effects are subtle in "Learning the Ropes" mode and more pronounced in "I've Got This" mode.

---

## Event Scheduler

Manages the daily timeline and triggers events at the right times.

```javascript
EventScheduler = {
  // Day template — defines time slots and what can fill them
  dayTemplate: [
    { time: 7.0,  type: "wakeup",     required: true },
    { time: 7.5,  type: "meal",       slot: "breakfast" },
    { time: 9.0,  type: "snack",      slot: "morning-snack" },
    { time: 9.5,  type: "minigame",   slot: "morning-game" },
    { time: 11.0, type: "social",     slot: "morning-social" },    // optional
    { time: 11.5, type: "meal",       slot: "lunch" },
    { time: 14.0, type: "snack",      slot: "afternoon-snack-1" },
    { time: 14.5, type: "minigame",   slot: "afternoon-game" },
    { time: 16.0, type: "snack",      slot: "afternoon-snack-2" },
    { time: 17.5, type: "meal",       slot: "dinner" },
    { time: 19.0, type: "social",     slot: "evening-activity" },
    { time: 20.5, type: "meal",       slot: "bedtime-snack" },
    { time: 21.0, type: "night",      slot: "night-event" }        // optional/random
  ],

  // For each day, fill the slots from the event pool based on:
  // - Day number (difficulty tier)
  // - Events not yet seen this week
  // - Ensuring variety (no two meals with same theme, etc.)
  generateDay(dayNumber, seenEvents) {
    // Returns a filled schedule for the day
  }
};
```

---

## Save/Load System

Uses localStorage. SugarCube has built-in save/load, but we extend it to include our custom GameState.

```javascript
SaveSystem = {
  // Auto-save at every time slot transition
  autoSave() {
    const saveData = {
      gameState: GameState,
      twineState: State.variables,  // SugarCube state
      timestamp: Date.now(),
      version: GAME_VERSION
    };
    localStorage.setItem('sugarrush-autosave', JSON.stringify(saveData));
  },

  // Manual save slots (3 slots)
  save(slot) { ... },
  load(slot) { ... },

  // Weekly high scores
  saveWeeklyScore(score) {
    const scores = this.getWeeklyScores();
    scores.push({ score, week: GameState.time.week, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('sugarrush-scores', JSON.stringify(scores.slice(0, 10)));
  }
};
```

### Offline Guarantee
- Zero network requests. Ever.
- All assets bundled locally (images, sounds, fonts)
- All game logic client-side
- Save data in localStorage only
- Could optionally support file export/import for backup ("Save to File" / "Load from File" using download/upload)

---

## File Structure

```
sugar-rush/
├── index.html                    # Entry point — loads Twine story + all JS
├── style/
│   ├── main.css                  # Core layout, HUD, transitions
│   ├── hud.css                   # HUD-specific styles
│   ├── effects.css               # BG screen effects (blur, tremor, fog)
│   └── minigames.css             # Mini-game specific styles
├── js/
│   ├── engine/
│   │   ├── game-state.js         # GameState object and accessors
│   │   ├── bg-simulation.js      # BG physics engine + config
│   │   ├── event-scheduler.js    # Daily schedule generation
│   │   ├── score-tracker.js      # Scoring and time-in-range calculation
│   │   ├── collectible-tracker.js # Collectible discovery and journal
│   │   └── save-system.js        # Save/load/autosave
│   ├── hud/
│   │   ├── hud.js                # HUD rendering and updates
│   │   ├── bg-meter.js           # BG display component
│   │   ├── energy-bar.js         # Energy bar component
│   │   └── effects.js            # Screen effects (tremor, blur, fog)
│   ├── minigames/
│   │   ├── launcher.js           # Mini-game lifecycle manager
│   │   ├── carb-counter.js
│   │   ├── dose-calculator.js
│   │   ├── hypo-rescue.js
│   │   ├── exercise-balance.js
│   │   ├── label-reader.js
│   │   ├── pack-your-bag.js
│   │   ├── glucose-roller.js
│   │   ├── sick-day.js
│   │   ├── portion-estimator.js
│   │   └── night-watch.js
│   ├── companion/
│   │   ├── companion.js          # Companion dialogue system
│   │   └── dialogue-pool.js      # Companion lines organized by context
│   └── bridge.js                 # Twine ↔ JS bridge (SugarCube API hooks)
├── story/
│   ├── sugar-rush.twee           # Main Twine story file (all passages)
│   │   (or split into multiple .twee files per day)
│   ├── day1.twee
│   ├── day2.twee
│   ├── ...
│   ├── day7.twee
│   ├── menus.twee                # Start screen, settings, character creation
│   └── summary.twee              # Daily and weekly summary screens
├── assets/
│   ├── images/
│   │   ├── characters/           # Player avatar pieces (hats, faces, shirts, shoes)
│   │   ├── companion/            # Companion expressions and poses
│   │   ├── food/                 # Food illustrations for mini-games
│   │   ├── ui/                   # HUD icons, buttons, frames
│   │   ├── backgrounds/          # Scene backgrounds (kitchen, school, park, etc.)
│   │   └── collectibles/         # Collectible icons
│   ├── audio/
│   │   ├── music/                # Background tracks (calm, active, night, urgent)
│   │   ├── sfx/                  # Sound effects (ding, alarm, chime, heartbeat)
│   │   └── companion/            # Companion voice clips (optional, could be text-only)
│   └── fonts/                    # Game fonts (kid-friendly, readable)
├── data/
│   ├── food-database.json        # All foods with real carb/protein/fat values (Canada Food Guide / Health Canada)
│   ├── events.json               # Narrative event definitions
│   ├── collectibles.json         # Collectible metadata and journal entries
│   ├── companion-lines.json      # All companion dialogue
│   └── bg-config.json            # BG simulation tuning parameters
└── tools/
    └── build.js                  # Simple build script to compile .twee → HTML
                                  # (or use Tweego CLI for this)
```

---

## Build and Distribution

### Development
- Author Twine passages in `.twee` files (plain text format, version-controllable)
- Use **Tweego** (command-line Twine compiler) to compile `.twee` → HTML with SugarCube
- Mini-game JS developed and tested independently, integrated via the bridge
- Hot-reload during development with a simple local server

### Distribution
- **Tweego compiles everything into a single HTML file** (or a small set of files)
- Can be distributed as:
  - A folder with index.html + assets (open in any browser)
  - Packaged with Electron for a desktop app experience (Windows/Mac/Linux)
  - Hosted on any static file server (GitHub Pages, itch.io, etc.)
  - Burned to a USB drive and handed out at diabetes clinics
- Zero install required if browser-based
- Total size estimate: 5-15MB depending on art/audio assets

### Tweego Compilation
```bash
# Compile all .twee files with SugarCube format
tweego -f sugarcube-2 -o dist/index.html story/*.twee --head=head-content.html

# head-content.html includes:
# <script src="js/..."></script> tags for all JS modules
# <link rel="stylesheet" href="style/..."> for all CSS
# Or bundle everything into the HTML for single-file distribution
```

---

## Technical Risks and Mitigations

| Risk | Mitigation |
|---|---|
| SugarCube state and custom JS state getting out of sync | Single source of truth (GameState), synced at every passage transition via bridge.js |
| Mini-games feeling disconnected from narrative | Consistent HUD overlay, smooth transitions, narrative intro/outro for each game |
| Save corruption | Version-tagged saves, validation on load, "start fresh" option always available |
| Performance on older machines | Keep mini-games simple (2D, no heavy physics), test on low-spec hardware |
| Accessibility | Keyboard navigation, screen reader support for narrative passages, colorblind-safe BG indicators, adjustable text size |
| Twine passage sprawl | Split by day into separate .twee files, use naming conventions (D1_breakfast, D3_social_sleepover, etc.) |
| BG simulation feeling unfair | Extensive playtesting of the BGConfig values, easy to tune without code changes |

---

## Accessibility Notes

- **Text size:** Adjustable in settings (small/medium/large)
- **Color:** BG zones use color + pattern + text label (not color alone)
- **Audio:** All audio information also conveyed visually (screen effects for BG, visual companion reactions)
- **Input:** All mini-games playable with keyboard OR mouse. No mouse-only requirements.
- **Reading level:** "Learning the Ropes" mode uses shorter sentences and simpler words
- **Screen reader:** Twine narrative passages are inherently text-based and screen-reader friendly. Mini-games need ARIA labels on interactive elements.
