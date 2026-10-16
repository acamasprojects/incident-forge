// Data model for Incident Forge. Two top-level collections:
// - scenarios: reusable authored templates, each made up of injects
// - runs: one actual playthrough of a scenario, with reveal state and logs
//
// Follows the same emptyX()/normalize pattern as Campaign Forge's
// src/data/model.js — a factory per entity plus a defensive backfill
// function run on every load/import so older saved data never breaks the
// app when a field gets added later.

export const VISIBILITIES = ["all", "red", "blue", "facilitator"];
export const TEAMS = ["red", "blue"];
export const RUN_STATUSES = ["lobby", "running", "paused", "ended"];

// One place for how each visibility reads and is colored, so the Scenario
// Library and Run Console can't drift out of sync with each other.
export const VISIBILITY_LABEL = { all: "All", red: "Red Team", blue: "Blue Team", facilitator: "Facilitator only" };
export const VISIBILITY_COLOR = { all: "#87A29C", red: "#E2492E", blue: "#33C17A", facilitator: "#3FA7D6" };

/** Short random id. Good enough for a local-only store with nothing else to collide with. */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** A reusable, authored template: a title, some context, and a list of injects. */
export function emptyScenario(title = "New Scenario") {
  return {
    id: uid(),
    title,
    summary: "",
    objectives: [],
    tags: [],
    pinned: false,
    injects: [],
    createdAt: Date.now(),
  };
}

/** One event in a scenario's timeline. Visibility controls who it's shown to once revealed. */
export function emptyInject(order = 0) {
  return {
    id: uid(),
    title: "",
    body: "",
    visibility: "all",
    order,
    // Free-text pacing hint for the facilitator, e.g. "~T+15m". Advisory only —
    // v1 always reveals injects manually, there's no real timer behind this.
    triggerNote: "",
    createdAt: Date.now(),
  };
}

/** One actual playthrough of a scenario: what's been revealed, and both teams' logs. */
export function emptyRun(scenario) {
  return {
    id: uid(),
    scenarioId: scenario.id,
    scenarioTitleSnapshot: scenario.title,
    status: "lobby",
    revealedInjectIds: [],
    events: [],
    redLog: [],
    blueLog: [],
    startedAt: null,
    endedAt: null,
    createdAt: Date.now(),
  };
}

export function emptyStore() {
  return { scenarios: [], runs: [] };
}

function normalizeInject(inj, index = 0) {
  return {
    ...inj,
    id: inj.id || uid(),
    title: inj.title || "",
    body: inj.body || "",
    visibility: VISIBILITIES.includes(inj.visibility) ? inj.visibility : "all",
    order: inj.order ?? index,
    triggerNote: inj.triggerNote || "",
    createdAt: inj.createdAt || Date.now(),
  };
}

export function normalizeScenario(s) {
  return {
    ...s,
    id: s.id || uid(),
    title: s.title || "",
    summary: s.summary || "",
    objectives: s.objectives || [],
    tags: s.tags || [],
    pinned: s.pinned || false,
    injects: (s.injects || []).map(normalizeInject),
    createdAt: s.createdAt || Date.now(),
  };
}

export function normalizeRun(r) {
  return {
    ...r,
    id: r.id || uid(),
    scenarioId: r.scenarioId || null,
    scenarioTitleSnapshot: r.scenarioTitleSnapshot || "",
    status: RUN_STATUSES.includes(r.status) ? r.status : "lobby",
    revealedInjectIds: r.revealedInjectIds || [],
    events: r.events || [],
    redLog: r.redLog || [],
    blueLog: r.blueLog || [],
    startedAt: r.startedAt || null,
    endedAt: r.endedAt || null,
    createdAt: r.createdAt || Date.now(),
  };
}

/** Run on every load and import so the store always matches the current shape. */
export function normalizeStore(store) {
  return {
    scenarios: (store?.scenarios || []).map(normalizeScenario),
    runs: (store?.runs || []).map(normalizeRun),
  };
}
