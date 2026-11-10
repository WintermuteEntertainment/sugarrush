// ============================================
// NARRATIVE ENGINE — Lightweight passage system
// Passages are JS objects. Branching choices.
// Renders to DOM. Supports companion dialogue,
// conditional text, and mini-game hooks.
// ============================================

import { state, notify } from './game-state.js';

// Passage registry
const passages = {};

// Register a passage
export function addPassage(id, passage) {
  passages[id] = passage;
}

// Register multiple passages at once
export function addPassages(passageMap) {
  for (const [id, passage] of Object.entries(passageMap)) {
    passages[id] = passage;
  }
}

// Get a passage by ID
export function getPassage(id) {
  return passages[id] || null;
}

// Render a passage into the narrative container
export function renderPassage(id) {
  const passage = passages[id];
  if (!passage) {
    console.error(`Passage not found: ${id}`);
    return;
  }

  state.narrative.currentPassage = id;

  const container = document.getElementById('passage-container');
  container.innerHTML = '';
  container.scrollTop = 0;

  // Scroll the narrative area to top
  const narrativeEl = document.getElementById('narrative');
  narrativeEl.scrollTop = 0;

  // Run onEnter hook if defined
  if (passage.onEnter) {
    passage.onEnter(state);
  }

  // Build passage HTML
  const div = document.createElement('div');
  div.className = 'passage';

  // Get content — can be a string or a function of state
  const content = typeof passage.content === 'function'
    ? passage.content(state)
    : passage.content;

  div.innerHTML = content;
  container.appendChild(div);

  // Render choices if any
  const choices = typeof passage.choices === 'function'
    ? passage.choices(state)
    : passage.choices;

  if (choices && choices.length > 0) {
    const choicesDiv = document.createElement('div');
    choicesDiv.className = 'choices';

    for (const choice of choices) {
      // Skip choices whose condition is false
      if (choice.condition && !choice.condition(state)) continue;

      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = typeof choice.text === 'function' ? choice.text(state) : choice.text;

      btn.addEventListener('click', () => {
        // Run choice effect
        if (choice.onSelect) choice.onSelect(state);

        // Record choice
        state.narrative.choices[id] = choice.id || choice.text;

        // Navigate to next passage
        const nextId = typeof choice.next === 'function' ? choice.next(state) : choice.next;
        if (nextId) {
          notify();
          renderPassage(nextId);
        }
      });

      choicesDiv.appendChild(btn);
    }

    container.appendChild(choicesDiv);
  }

  // Render continue button if specified (single next, no branching)
  if (passage.next && (!choices || choices.length === 0)) {
    const nextId = typeof passage.next === 'function' ? passage.next(state) : passage.next;
    const btn = document.createElement('button');
    btn.className = 'continue-btn';
    btn.textContent = passage.continueText || 'Continue';

    btn.addEventListener('click', () => {
      if (passage.onExit) passage.onExit(state);
      notify();
      renderPassage(nextId);
    });

    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '20px';
    wrapper.appendChild(btn);
    container.appendChild(wrapper);
  }

  notify();
}

// Utility: render raw HTML into the passage container (for special screens)
export function renderScreen(html) {
  const container = document.getElementById('passage-container');
  container.innerHTML = html;

  const narrativeEl = document.getElementById('narrative');
  narrativeEl.scrollTop = 0;
}
