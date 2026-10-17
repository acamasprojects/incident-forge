import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildAfterActionHtml } from "./exportAfterAction.js";

function baseRun(overrides = {}) {
  return {
    status: "ended",
    scenarioTitleSnapshot: "Test Scenario",
    startedAt: 1000,
    endedAt: 2000,
    events: [],
    redLog: [],
    blueLog: [],
    objectiveOutcomes: [],
    ...overrides,
  };
}

describe("buildAfterActionHtml objectives section", () => {
  test("omits the Objectives section entirely when there are none", () => {
    const html = buildAfterActionHtml(baseRun(), null);
    assert.ok(!html.includes("<h2>Objectives</h2>"));
  });

  test("renders the run's own objectiveOutcomes with their outcome labels", () => {
    const run = baseRun({
      objectiveOutcomes: [
        { text: "Contain the ransomware", outcome: "met" },
        { text: "Notify leadership within 30 minutes", outcome: "missed" },
      ],
    });
    const html = buildAfterActionHtml(run, null);
    assert.ok(html.includes("<h2>Objectives</h2>"));
    assert.ok(html.includes("Contain the ransomware"));
    assert.ok(html.includes(">Met<"));
    assert.ok(html.includes("Notify leadership within 30 minutes"));
    assert.ok(html.includes(">Missed<"));
  });

  test("falls back to the scenario's live objectives (unassessed) for a run from before this field existed", () => {
    const run = baseRun({ objectiveOutcomes: [] });
    const scenario = { objectives: ["Detect the intrusion"], injects: [] };
    const html = buildAfterActionHtml(run, scenario);
    assert.ok(html.includes("Detect the intrusion"));
    assert.ok(html.includes(">Not yet assessed<"));
  });

  test("prefers the run's snapshot over the scenario's current objectives even if they've since changed", () => {
    const run = baseRun({ objectiveOutcomes: [{ text: "Original objective", outcome: "partial" }] });
    const scenario = { objectives: ["Edited objective, added after the run"], injects: [] };
    const html = buildAfterActionHtml(run, scenario);
    assert.ok(html.includes("Original objective"));
    assert.ok(!html.includes("Edited objective"));
  });
});
