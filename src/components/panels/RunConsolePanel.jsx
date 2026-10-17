import { useState, useRef, useEffect } from "react";
import { VISIBILITY_LABEL, VISIBILITY_COLOR, OBJECTIVE_OUTCOMES, OBJECTIVE_OUTCOME_LABEL } from "../../data/model.js";
import { printAfterActionReport, exportRunJson } from "../../utils/exportAfterAction.js";
import { elapsedMs, formatDuration } from "../../utils/elapsedTime.js";
import ChoiceChips from "../ChoiceChips.jsx";

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
export default function RunConsolePanel({
  store,
  update,
  flash,
  onImportRun,
  createRun,
  cancelRun,
  startExercise,
  pauseExercise,
  resumeExercise,
  endExercise,
  revealInject,
  setObjectiveOutcome,
  setDebriefNotes,
}) {
  const [pickedScenarioId, setPickedScenarioId] = useState(store.scenarios[0]?.id || "");
  const importInputRef = useRef(null);

  const importButton = (
    <>
      <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={() => importInputRef.current?.click()}>
        Import Run
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportRun(file);
          e.target.value = "";
        }}
      />
    </>
  );

  const runsNewestFirst = [...store.runs].reverse();
  const mostRecentRun = runsNewestFirst[0] || null;
  const pastRuns = runsNewestFirst.slice(1);
  const isLive = mostRecentRun && mostRecentRun.status !== "ended";
  const scenario = mostRecentRun ? store.scenarios.find((s) => s.id === mostRecentRun.scenarioId) : null;

  // Live clock: only ticks while the exercise is actually running, so a
  // paused or ended run just shows its frozen elapsedMs() value without a
  // timer running in the background for no reason.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mostRecentRun || mostRecentRun.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mostRecentRun?.id, mostRecentRun?.status]);

  // The actual mutations (createRun, cancelRun, startExercise, etc.) live in
  // useExerciseStore now, not here — this component's job is just the UI
  // concerns around them: confirm dialogs, undo snapshots, toasts.

  const startNewRun = () => {
    const picked = store.scenarios.find((s) => s.id === pickedScenarioId);
    if (!picked) return;
    createRun(picked);
    flash("Run created");
  };

  const handleCancelRun = (runId) => {
    if (!confirm("Cancel this run before it's started?")) return;
    const snapshot = store;
    cancelRun(runId);
    flash("Run cancelled", { onUndo: () => update(() => snapshot) });
  };

  const handleEndExercise = (runId) => {
    if (!confirm("End this exercise? The logs stick around, but no more injects can be revealed.")) return;
    endExercise(runId);
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
          {importButton}
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
        {importButton}
      </div>

      <div className="rb-run-header">
        <div>
          <div className="rb-run-scenario-title">
            {scenario?.title || mostRecentRun.scenarioTitleSnapshot || "Untitled scenario"}
          </div>
          <span className="rb-badge">{STATUS_LABEL[mostRecentRun.status]}</span>
          {mostRecentRun.startedAt != null && (
            <span className="rb-run-elapsed" title="Time elapsed, excluding any time spent paused">
              {formatDuration(elapsedMs(mostRecentRun, now))}
            </span>
          )}
        </div>
        <div className="rb-run-controls">
          {mostRecentRun.status === "lobby" && (
            <>
              <button type="button" className="rb-btn rb-btn-primary" onClick={() => startExercise(mostRecentRun.id)}>
                Start Exercise
              </button>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => handleCancelRun(mostRecentRun.id)}>
                Cancel
              </button>
            </>
          )}
          {mostRecentRun.status === "running" && (
            <>
              <button type="button" className="rb-btn rb-btn-ghost" onClick={() => pauseExercise(mostRecentRun.id)}>
                Pause
              </button>
              <button type="button" className="rb-btn rb-btn-danger" onClick={() => handleEndExercise(mostRecentRun.id)}>
                End Exercise
              </button>
            </>
          )}
          {mostRecentRun.status === "paused" && (
            <>
              <button type="button" className="rb-btn rb-btn-primary" onClick={() => resumeExercise(mostRecentRun.id)}>
                Resume
              </button>
              <button type="button" className="rb-btn rb-btn-danger" onClick={() => handleEndExercise(mostRecentRun.id)}>
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

      {mostRecentRun.objectiveOutcomes.length > 0 && (
        <div className="rb-field">
          <span className="rb-field-label">Objectives</span>
          <div className="rb-objective-outcomes-list">
            {mostRecentRun.objectiveOutcomes.map((o, index) => (
              <div key={index} className="rb-objective-outcome-row">
                <span className="rb-objective-outcome-text">{o.text}</span>
                <ChoiceChips
                  values={OBJECTIVE_OUTCOMES}
                  value={o.outcome}
                  onChange={(outcome) => setObjectiveOutcome(mostRecentRun.id, index, outcome)}
                  formatLabel={(v) => OBJECTIVE_OUTCOME_LABEL[v]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="rb-field">
        <span className="rb-field-label">Debrief notes</span>
        <textarea
          className="rb-textarea"
          value={mostRecentRun.debriefNotes}
          onChange={(e) => setDebriefNotes(mostRecentRun.id, e.target.value)}
          placeholder="What went well, what to change next time…"
        />
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
