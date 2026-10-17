import { useState } from "react";
import { emptyRun, uid, VISIBILITY_LABEL, VISIBILITY_COLOR } from "../../data/model.js";
import { printAfterActionReport, exportRunJson } from "../../utils/exportAfterAction.js";

const STATUS_LABEL = { lobby: "Ready to start", running: "Running", paused: "Paused", ended: "Ended" };

/**
 * Runs one scenario at a time. "Most recent run" is shown whether it's
 * still live (lobby/running/paused) or already ended — an ended run stays
 * visible with its full timeline and export buttons instead of vanishing
 * the moment it's over. Starting another run is only offered once the last
 * one has ended, so there's never more than one exercise live at a time.
 *
 * Older ended runs stay in the store (nothing is deleted) and show up below
 * as a Past Runs list, each with its own report/export buttons.
 */
export default function RunConsolePanel({ store, update, flash }) {
  const [pickedScenarioId, setPickedScenarioId] = useState(store.scenarios[0]?.id || "");

  const runsNewestFirst = [...store.runs].reverse();
  const mostRecentRun = runsNewestFirst[0] || null;
  const pastRuns = runsNewestFirst.slice(1);
  const isLive = mostRecentRun && mostRecentRun.status !== "ended";
  const scenario = mostRecentRun ? store.scenarios.find((s) => s.id === mostRecentRun.scenarioId) : null;

  const logEvent = (run, type, payload = {}) => ({
    ...run,
    events: [...run.events, { id: uid(), type, payload, at: Date.now() }],
  });

  const updateRun = (runId, fn) => {
    update((st) => ({ ...st, runs: st.runs.map((r) => (r.id === runId ? fn(r) : r)) }));
  };

  const startNewRun = () => {
    const picked = store.scenarios.find((s) => s.id === pickedScenarioId);
    if (!picked) return;
    // The check happens inside the updater, not against the `isLive` closed
    // over from the last render — a rapid double-click fires this twice
    // before React re-renders to hide the button, and only the updater sees
    // the true latest state in time for the second call to catch it.
    update((st) => {
      const alreadyLive = st.runs.some((r) => r.status !== "ended");
      if (alreadyLive) return st;
      return { ...st, runs: [...st.runs, emptyRun(picked)] };
    });
    flash("Run created");
  };

  const cancelRun = (runId) => {
    if (!confirm("Cancel this run before it's started?")) return;
    update((st) => ({ ...st, runs: st.runs.filter((r) => r.id !== runId) }));
  };

  const startExercise = (runId) => {
    updateRun(runId, (r) => logEvent({ ...r, status: "running", startedAt: Date.now() }, "status_changed", { status: "running" }));
  };
  const pauseExercise = (runId) => {
    updateRun(runId, (r) => logEvent({ ...r, status: "paused" }, "status_changed", { status: "paused" }));
  };
  const resumeExercise = (runId) => {
    updateRun(runId, (r) => logEvent({ ...r, status: "running" }, "status_changed", { status: "running" }));
  };
  const endExercise = (runId) => {
    if (!confirm("End this exercise? The logs stick around, but no more injects can be revealed.")) return;
    updateRun(runId, (r) => logEvent({ ...r, status: "ended", endedAt: Date.now() }, "status_changed", { status: "ended" }));
  };

  const revealInject = (runId, injectId) => {
    updateRun(runId, (r) => {
      if (r.revealedInjectIds.includes(injectId)) return r;
      return logEvent({ ...r, revealedInjectIds: [...r.revealedInjectIds, injectId] }, "inject_revealed", { injectId });
    });
  };

  const scenarioPicker = (
    <div className="rb-empty-panel">
      <p>Pick a scenario to start a new run.</p>
      <div className="rb-run-picker">
        <select className="rb-input" value={pickedScenarioId} onChange={(e) => setPickedScenarioId(e.target.value)}>
          {store.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || "Untitled"}
            </option>
          ))}
        </select>
        <button type="button" className="rb-btn rb-btn-primary" onClick={startNewRun}>
          Start Run
        </button>
      </div>
    </div>
  );

  if (!mostRecentRun) {
    return (
      <div className="rb-panel">
        <div className="rb-panel-head-row">
          <h1 className="rb-panel-title">Run Console</h1>
        </div>
        {store.scenarios.length === 0 ? (
          <div className="rb-empty-panel">No scenarios yet. Add one in the Scenarios tab first.</div>
        ) : (
          scenarioPicker
        )}
      </div>
    );
  }

  const sortedInjects = scenario ? [...scenario.injects].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="rb-panel">
      <div className="rb-panel-head-row">
        <h1 className="rb-panel-title">Run Console</h1>
      </div>

      <div className="rb-run-header">
        <div>
          <div className="rb-run-scenario-title">
            {scenario?.title || mostRecentRun.scenarioTitleSnapshot || "Untitled scenario"}
          </div>
          <span className="rb-badge">{STATUS_LABEL[mostRecentRun.status]}</span>
        </div>
        <div className="rb-run-controls">
          {mostRecentRun.status === "lobby" && (
            <>
              <button type="button" className="rb-btn rb-btn-primary" onClick={() => startExercise(mostRecentRun.id)}>
                Start Exercise
              </button>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => cancelRun(mostRecentRun.id)}>
                Cancel
              </button>
            </>
          )}
          {mostRecentRun.status === "running" && (
            <>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => pauseExercise(mostRecentRun.id)}>
                Pause
              </button>
              <button type="button" className="rb-btn rb-btn-danger" onClick={() => endExercise(mostRecentRun.id)}>
                End Exercise
              </button>
            </>
          )}
          {mostRecentRun.status === "paused" && (
            <>
              <button type="button" className="rb-btn rb-btn-primary" onClick={() => resumeExercise(mostRecentRun.id)}>
                Resume
              </button>
              <button type="button" className="rb-btn rb-btn-danger" onClick={() => endExercise(mostRecentRun.id)}>
                End Exercise
              </button>
            </>
          )}
          {mostRecentRun.status === "ended" && (
            <>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => printAfterActionReport(mostRecentRun, scenario)}>
                Print Report
              </button>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => exportRunJson(mostRecentRun, scenario)}>
                Download JSON
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rb-field">
        <span className="rb-field-label">Injects</span>
        {sortedInjects.length === 0 ? (
          <div className="rb-empty-panel">This scenario has no injects yet.</div>
        ) : (
          <div className="rb-inject-timeline">
            {sortedInjects.map((inj) => {
              const revealed = mostRecentRun.revealedInjectIds.includes(inj.id);
              return (
                <div key={inj.id} className={`rb-inject-timeline-row${revealed ? " rb-inject-timeline-row-revealed" : ""}`}>
                  <div className="rb-inject-timeline-main">
                    <span
                      className="rb-badge"
                      style={{ color: VISIBILITY_COLOR[inj.visibility], borderColor: VISIBILITY_COLOR[inj.visibility] }}
                    >
                      {VISIBILITY_LABEL[inj.visibility]}
                    </span>
                    <span className="rb-inject-timeline-title">{inj.title || "Untitled"}</span>
                    {inj.triggerNote && <span className="rb-inject-timeline-note">{inj.triggerNote}</span>}
                  </div>
                  {revealed ? (
                    <span className="rb-inject-timeline-status">Revealed</span>
                  ) : isLive ? (
                    <button
                      type="button"
                      className="rb-btn rb-btn-ghost rb-btn-small"
                      disabled={mostRecentRun.status !== "running"}
                      onClick={() => revealInject(mostRecentRun.id, inj.id)}
                      title={mostRecentRun.status !== "running" ? "Start the exercise to reveal injects" : "Reveal to the teams"}
                    >
                      Reveal
                    </button>
                  ) : (
                    <span className="rb-inject-timeline-status rb-inject-timeline-status-muted">Not revealed</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rb-field">
        <span className="rb-field-label">Team logs</span>
        <div className="rb-logs-columns">
          <LogColumn title="Red Team" entries={mostRecentRun.redLog} injects={scenario?.injects || []} />
          <LogColumn title="Blue Team" entries={mostRecentRun.blueLog} injects={scenario?.injects || []} />
        </div>
      </div>

      {!isLive && (
        <div className="rb-field rb-injects-field">
          <span className="rb-field-label">Start another run</span>
          {store.scenarios.length === 0 ? (
            <div className="rb-empty-panel">No scenarios yet. Add one in the Scenarios tab first.</div>
          ) : (
            scenarioPicker
          )}
        </div>
      )}

      {pastRuns.length > 0 && (
        <div className="rb-field rb-injects-field">
          <span className="rb-field-label">Past runs</span>
          <div className="rb-past-runs-list">
            {pastRuns.map((r) => {
              const rScenario = store.scenarios.find((s) => s.id === r.scenarioId);
              return (
                <div key={r.id} className="rb-past-run-row">
                  <div className="rb-past-run-main">
                    <span className="rb-past-run-title">{rScenario?.title || r.scenarioTitleSnapshot || "Untitled scenario"}</span>
                    <span className="rb-badge">{STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="rb-past-run-dates">
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : "Never started"}
                    {r.endedAt ? ` – ${new Date(r.endedAt).toLocaleString()}` : ""}
                  </div>
                  <div className="rb-past-run-actions">
                    <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={() => printAfterActionReport(r, rScenario)}>
                      Print Report
                    </button>
                    <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={() => exportRunJson(r, rScenario)}>
                      Download JSON
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LogColumn({ title, entries, injects }) {
  const injectTitle = (id) => injects.find((i) => i.id === id)?.title || "Untitled";
  return (
    <div className="rb-log-column">
      <div className="rb-log-column-title">{title}</div>
      {entries.length === 0 ? (
        <div className="rb-empty-panel">No decisions logged yet.</div>
      ) : (
        [...entries].reverse().map((entry) => (
          <div key={entry.id} className="rb-log-entry">
            <div className="rb-log-entry-meta">
              {entry.injectId && <span className="rb-badge">{injectTitle(entry.injectId)}</span>}
              <span className="rb-log-entry-time">{new Date(entry.at).toLocaleTimeString()}</span>
            </div>
            <div className="rb-log-entry-body">{entry.body}</div>
          </div>
        ))
      )}
    </div>
  );
}
