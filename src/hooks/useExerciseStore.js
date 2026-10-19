import { useState, useEffect, useCallback, useRef } from "react";
import { emptyStore, emptyRun, normalizeStore, importRunExport, foldOpenPause, uid } from "../data/model.js";

const STORE_KEY = "incident-forge-data";

/**
 * Owns the full { scenarios, runs } store, loads it from localStorage on
 * mount and debounce-persists it on every change. Same shape as Campaign
 * Forge's useCampaignStore: one hook, one mutation primitive, components
 * stay dumb.
 */
export function useExerciseStore() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState(() => emptyStore());
  const saveTimer = useRef(null);
  // Mirrors the latest store so the exit-flush listener (set up once, below)
  // always sees current data instead of whatever was in scope when it was
  // registered.
  const latest = useRef(store);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setStore(normalizeStore(JSON.parse(raw)));
    } catch {
      // first run, or corrupt data — start fresh
    }
    setLoaded(true);
  }, []);

  const writeNow = useCallback((next) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Incident Forge: failed to save", e);
    }
  }, []);

  const persist = useCallback(
    (next) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => writeNow(next), 300);
    },
    [writeNow]
  );

  useEffect(() => {
    latest.current = store;
  }, [store]);

  useEffect(() => {
    if (!loaded) return;
    persist(store);
  }, [store, loaded, persist]);

  // The debounce above means an edit (authoring a scenario, logging a
  // decision) can sit unsaved for up to 300ms, and typing continuously keeps
  // pushing that window back. Closing the tab inside that window loses
  // whatever hasn't saved yet. Flush immediately once the tab is actually
  // going away: 'pagehide' covers navigation/close, 'visibilitychange'
  // covers backgrounding (tab switch, app switch, phone lock) — together
  // they catch far more exit paths than 'beforeunload' alone, which mobile
  // Safari doesn't fire reliably. Only flushes if a save was actually
  // pending, so this can't overwrite real data with the empty initial state
  // before the load effect above has run.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      writeNow(latest.current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [writeNow]);

  // A facilitator console, a Red Team view, and a Blue Team view are often
  // open as separate tabs on the same device at the same time — that's the
  // whole point of the view-mode split. Without this, a decision logged in
  // one tab just sits in that tab's localStorage write until someone
  // manually reloads the others. The browser's 'storage' event only ever
  // fires in *other* tabs, never the one that made the write, so there's no
  // feedback loop to guard against here.
  //
  // If this tab has an edit of its own queued up (saveTimer.current is set),
  // the incoming update is skipped so it can't stomp on something the user
  // just typed here before it's had a chance to save — the next 'storage'
  // event, right after this tab's own pending write lands, picks up
  // wherever the other tab left off.
  useEffect(() => {
    const onStorage = (e) => {
      if (!loaded || e.key !== STORE_KEY || !e.newValue || saveTimer.current) return;
      try {
        setStore(normalizeStore(JSON.parse(e.newValue)));
      } catch {
        // corrupt write from the other tab — ignore, keep what we have
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loaded]);

  /** Apply fn to a shallow copy of the store and commit what it returns. */
  const update = useCallback((fn) => {
    setStore((prev) => fn({ ...prev }));
  }, []);

  /** Swap out the whole store at once, e.g. after a JSON import. */
  const replaceStore = useCallback((next) => {
    setStore(normalizeStore(next));
  }, []);

  /** Merge one exported run (+ its scenario, if included) into the store. Throws on an unrecognized file — the caller decides how to report that. */
  const importRun = useCallback((data) => {
    setStore((prev) => importRunExport(prev, data));
  }, []);

  // --- Run-mutation actions ---
  // Every mutation that happens during a live run lives here instead of in
  // the components that trigger it. A future multi-device backend would
  // swap what's inside these (a local update(...) becomes an awaited
  // network write), without the UI layer needing to change at all — see
  // docs/multi-device-sync-plan.md. Scenario authoring (outside the
  // RunConsolePanel/TeamViewPanel UI) stays simple inline update() calls in
  // ScenarioLibraryPanel, since that only ever happens locally before or
  // between live runs, not during one.

  const logEvent = (run, type, payload = {}) => ({
    ...run,
    events: [...run.events, { id: uid(), type, payload, at: Date.now() }],
  });

  const updateRun = useCallback(
    (runId, fn) => {
      update((st) => ({ ...st, runs: st.runs.map((r) => (r.id === runId ? fn(r) : r)) }));
    },
    [update]
  );

  /** Starts a new run, unless one is already live. Returns nothing — the caller re-renders off the updated store. */
  const createRun = useCallback(
    (scenario) => {
      // The check happens inside the updater, not against a snapshot closed
      // over from the last render — a rapid double-click fires this twice
      // before React re-renders to hide the button, and only the updater
      // sees the true latest state in time for the second call to catch it.
      update((st) => {
        const alreadyLive = st.runs.some((r) => r.status !== "ended");
        if (alreadyLive) return st;
        return { ...st, runs: [...st.runs, emptyRun(scenario)] };
      });
    },
    [update]
  );

  const cancelRun = useCallback(
    (runId) => {
      update((st) => ({ ...st, runs: st.runs.filter((r) => r.id !== runId) }));
    },
    [update]
  );

  const startExercise = useCallback(
    (runId) => {
      updateRun(runId, (r) => logEvent({ ...r, status: "running", startedAt: Date.now() }, "status_changed", { status: "running" }));
    },
    [updateRun]
  );

  const pauseExercise = useCallback(
    (runId) => {
      updateRun(runId, (r) => logEvent({ ...r, status: "paused", pausedAt: Date.now() }, "status_changed", { status: "paused" }));
    },
    [updateRun]
  );

  const resumeExercise = useCallback(
    (runId) => {
      updateRun(runId, (r) =>
        logEvent({ ...r, status: "running", pausedMs: foldOpenPause(r), pausedAt: null }, "status_changed", { status: "running" })
      );
    },
    [updateRun]
  );

  const endExercise = useCallback(
    (runId) => {
      updateRun(runId, (r) =>
        logEvent(
          { ...r, status: "ended", endedAt: Date.now(), pausedMs: foldOpenPause(r), pausedAt: null },
          "status_changed",
          { status: "ended" }
        )
      );
    },
    [updateRun]
  );

  const revealInject = useCallback(
    (runId, injectId) => {
      updateRun(runId, (r) => {
        if (r.revealedInjectIds.includes(injectId)) return r;
        return logEvent({ ...r, revealedInjectIds: [...r.revealedInjectIds, injectId] }, "inject_revealed", { injectId });
      });
    },
    [updateRun]
  );

  // Editable at any point in the run's life, including after it's ended —
  // assessing whether an objective was met is often easiest in hindsight,
  // and the facilitator shouldn't lose that ability just because the
  // exercise is over.
  const setObjectiveOutcome = useCallback(
    (runId, index, outcome) => {
      updateRun(runId, (r) => ({
        ...r,
        objectiveOutcomes: r.objectiveOutcomes.map((o, i) => (i === index ? { ...o, outcome } : o)),
      }));
    },
    [updateRun]
  );

  const setDebriefNotes = useCallback(
    (runId, text) => {
      updateRun(runId, (r) => ({ ...r, debriefNotes: text }));
    },
    [updateRun]
  );

  /** Logs a decision for one team. injectId should already be validated against that team's currently-visible injects by the caller. */
  const logDecision = useCallback(
    (runId, team, body, injectId) => {
      const logKey = team === "red" ? "redLog" : "blueLog";
      const entry = { id: uid(), injectId: injectId || null, body, at: Date.now() };
      updateRun(runId, (r) => ({ ...r, [logKey]: [...r[logKey], entry] }));
    },
    [updateRun]
  );

  return {
    loaded,
    store,
    update,
    replaceStore,
    importRun,
    createRun,
    cancelRun,
    startExercise,
    pauseExercise,
    resumeExercise,
    endExercise,
    revealInject,
    setObjectiveOutcome,
    setDebriefNotes,
    logDecision,
  };
}
