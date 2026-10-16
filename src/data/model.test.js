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
import { emptyScenario, emptyInject, emptyRun, normalizeScenario, normalizeRun, normalizeStore } from "./model.js";

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
