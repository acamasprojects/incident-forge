import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { elapsedMs, formatDuration } from "./elapsedTime.js";

describe("elapsedMs", () => {
  test("returns 0 for a run that hasn't started", () => {
    assert.equal(elapsedMs({ startedAt: null, status: "lobby" }, 100000), 0);
  });

  test("counts straight through for a running exercise with no pauses", () => {
    const run = { startedAt: 1000, status: "running", pausedMs: 0, pausedAt: null };
    assert.equal(elapsedMs(run, 5000), 4000);
  });

  test("freezes at the moment it was paused, ignoring how long ago that was", () => {
    const run = { startedAt: 1000, status: "paused", pausedAt: 3000, pausedMs: 0 };
    assert.equal(elapsedMs(run, 999999), 2000);
  });

  test("excludes a completed pause once running again", () => {
    // started at 0, ran for 2000ms, paused for 5000ms (folded into pausedMs
    // on resume, same as resumeExercise does), now 1000ms further along
    const run = { startedAt: 0, status: "running", pausedMs: 5000, pausedAt: null };
    assert.equal(elapsedMs(run, 8000), 3000); // 8000 - 0 - 5000
  });

  test("freezes at endedAt for an ended run, excluding total paused time", () => {
    const run = { startedAt: 0, status: "ended", endedAt: 10000, pausedMs: 2000, pausedAt: null };
    assert.equal(elapsedMs(run, 999999), 8000);
  });

  test("never goes negative even with an inconsistent timestamp", () => {
    const run = { startedAt: 5000, status: "running", pausedMs: 10000, pausedAt: null };
    assert.equal(elapsedMs(run, 6000), 0);
  });
});

describe("formatDuration", () => {
  test("formats under a minute as M:SS", () => {
    assert.equal(formatDuration(45000), "0:45");
  });

  test("formats under an hour as M:SS without a leading zero on minutes", () => {
    assert.equal(formatDuration(5 * 60000 + 7000), "5:07");
  });

  test("formats an hour or more as H:MM:SS", () => {
    assert.equal(formatDuration(3661000), "1:01:01");
  });

  test("formats exactly zero", () => {
    assert.equal(formatDuration(0), "0:00");
  });
});
