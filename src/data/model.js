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

/**
 * Merges one run-export file (the shape exportRunJson() produces — { run,
 * scenario }) into an existing store. Never overwrites anything already
 * there: the incoming scenario (if present) and run are always given fresh
 * ids, and every inject reference inside the run (revealedInjectIds, the
 * events log, both team logs) is remapped to match, so importing the exact
 * same file twice just creates two independent copies instead of colliding
 * with — or silently overwriting — whatever's already in the store.
 *
 * The run is always forced to "ended" on the way in. It's historical data
 * coming from a file, not a live exercise, and the rest of the app assumes
 * at most one non-ended run exists at a time (see startNewRun in
 * RunConsolePanel) — importing a "running" run from a file would violate
 * that invariant.
 */
export function importRunExport(store, data) {
  if (!data || typeof data !== "object" || !data.run) {
    throw new Error("Not a recognized Incident Forge run export");
  }

  const injectIdMap = new Map();
  let scenario = null;
  if (data.scenario) {
    const normalized = normalizeScenario(data.scenario);
    scenario = {
      ...normalized,
      id: uid(),
      injects: normalized.injects.map((inj) => {
        const newId = uid();
        injectIdMap.set(inj.id, newId);
        return { ...inj, id: newId };
      }),
    };
  }

  const remapInjectId = (id) => (id ? injectIdMap.get(id) || id : id);

  const normalizedRun = normalizeRun(data.run);
  const run = {
    ...normalizedRun,
    id: uid(),
    scenarioId: scenario ? scenario.id : normalizedRun.scenarioId,
    revealedInjectIds: normalizedRun.revealedInjectIds.map(remapInjectId),
    events: normalizedRun.events.map((e) => ({
      ...e,
      id: uid(),
      payload: e.payload?.injectId ? { ...e.payload, injectId: remapInjectId(e.payload.injectId) } : e.payload,
    })),
    redLog: normalizedRun.redLog.map((e) => ({ ...e, id: uid(), injectId: remapInjectId(e.injectId) })),
    blueLog: normalizedRun.blueLog.map((e) => ({ ...e, id: uid(), injectId: remapInjectId(e.injectId) })),
    status: "ended",
    endedAt: normalizedRun.endedAt || normalizedRun.startedAt || normalizedRun.createdAt,
  };

  return {
    ...store,
    scenarios: scenario ? [scenario, ...store.scenarios] : store.scenarios,
    runs: [...store.runs, run],
  };
}
