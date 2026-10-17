// Guards against the same bug class that hit Campaign Forge: a field added
// to an emptyX() factory without a matching backfill in its normalizeX()
// counterpart. This app's backfill is complete today (checked by hand), but
// this test is what stops that from silently regressing as fields get
// added.
//
// Uses Node's built-in test runner (available since Node 18, zero added
// dependencies) — the latest Vitest needs a newer Vite than this project is
// pinned to, and the Vite-5-compatible Vitest major pulls in dependencies
// with known vulnerabilities. One targeted test doesn't need a framework.
//
// Run with: node --test

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  emptyScenario,
  emptyInject,
  emptyRun,
  emptyStore,
  normalizeScenario,
  normalizeRun,
  normalizeStore,
  importRunExport,
} from "./model.js";

/** Every field in `expected` must exist (and not be `undefined`) on `actual`. */
function assertFieldsBackfilled(actual, expected, label) {
  for (const field of Object.keys(expected)) {
    assert.notStrictEqual(actual[field], undefined, `${label} is missing a backfill for "${field}"`);
  }
}

describe("normalize functions backfill every field", () => {
  test("normalizeScenario fills in every emptyScenario() field for a bare scenario", () => {
    const normalized = normalizeScenario({ id: "bare-id" });
    assertFieldsBackfilled(normalized, emptyScenario(), "scenario");
  });

  test("normalizeScenario fills in every emptyInject() field for a bare inject", () => {
    // normalizeInject isn't exported on its own — it's only ever reached
    // through normalizeScenario, same as how Campaign Forge's nested
    // sub-objects (relationships, clues) get tested through their parent.
    const normalized = normalizeScenario({ id: "s1", injects: [{ id: "bare-inject" }] });
    assertFieldsBackfilled(normalized.injects[0], emptyInject(), "inject");
  });

  test("normalizeRun fills in every emptyRun() field for a bare run", () => {
    const normalized = normalizeRun({ id: "bare-id" });
    assertFieldsBackfilled(normalized, emptyRun({ id: "s1", title: "Test Scenario" }), "run");
  });

  test("normalizeStore handles a store missing both arrays entirely", () => {
    const normalized = normalizeStore({});
    assert.deepStrictEqual(normalized.scenarios, []);
    assert.deepStrictEqual(normalized.runs, []);
  });

  test("normalizeStore handles undefined without crashing", () => {
    const normalized = normalizeStore(undefined);
    assert.deepStrictEqual(normalized.scenarios, []);
    assert.deepStrictEqual(normalized.runs, []);
  });
});

describe("importRunExport", () => {
  function buildExport() {
    const scenario = emptyScenario("Imported Scenario");
    scenario.injects = [emptyInject(0), emptyInject(1)];
    const run = emptyRun(scenario);
    run.revealedInjectIds = [scenario.injects[0].id];
    run.events = [{ id: "ev1", type: "inject_revealed", payload: { injectId: scenario.injects[0].id }, at: 1 }];
    run.redLog = [{ id: "r1", injectId: scenario.injects[0].id, body: "red note", at: 2 }];
    run.blueLog = [{ id: "b1", injectId: scenario.injects[1].id, body: "blue note", at: 3 }];
    run.status = "running";
    run.startedAt = 1;
    return { run, scenario, exportedAt: 4 };
  }

  test("rejects a file with no run", () => {
    assert.throws(() => importRunExport(emptyStore(), {}), /recognized/);
    assert.throws(() => importRunExport(emptyStore(), null), /recognized/);
  });

  test("adds the scenario and run with fresh, non-colliding ids", () => {
    const data = buildExport();
    const next = importRunExport(emptyStore(), data);
    assert.equal(next.scenarios.length, 1);
    assert.equal(next.runs.length, 1);
    assert.notEqual(next.scenarios[0].id, data.scenario.id);
    assert.notEqual(next.runs[0].id, data.run.id);
    assert.equal(next.runs[0].scenarioId, next.scenarios[0].id);
  });

  test("remaps every inject reference (revealed list, events, both logs) to the new inject ids", () => {
    const data = buildExport();
    const next = importRunExport(emptyStore(), data);
    const [newInjectA, newInjectB] = next.scenarios[0].injects;
    assert.deepEqual(next.runs[0].revealedInjectIds, [newInjectA.id]);
    assert.equal(next.runs[0].events[0].payload.injectId, newInjectA.id);
    assert.equal(next.runs[0].redLog[0].injectId, newInjectA.id);
    assert.equal(next.runs[0].blueLog[0].injectId, newInjectB.id);
  });

  test("forces the imported run to ended status, even if it was exported mid-run", () => {
    const data = buildExport();
    const next = importRunExport(emptyStore(), data);
    assert.equal(next.runs[0].status, "ended");
    assert.ok(next.runs[0].endedAt);
  });

  test("importing the same file twice never collides — two independent copies result", () => {
    const data = buildExport();
    let store = emptyStore();
    store = importRunExport(store, data);
    store = importRunExport(store, data);
    assert.equal(store.scenarios.length, 2);
    assert.equal(store.runs.length, 2);
    assert.notEqual(store.scenarios[0].id, store.scenarios[1].id);
    assert.notEqual(store.runs[0].id, store.runs[1].id);
  });

  test("keeps the run's original scenarioId when the export has no scenario", () => {
    const data = buildExport();
    delete data.scenario;
    const next = importRunExport(emptyStore(), data);
    assert.equal(next.scenarios.length, 0);
    assert.equal(next.runs[0].scenarioId, data.run.scenarioId);
  });
});
