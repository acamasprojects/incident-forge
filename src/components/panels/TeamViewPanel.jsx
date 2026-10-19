import { useState, useEffect } from "react";
import { visibleInjectsForTeam } from "../../data/model.js";
import { elapsedMs, formatDuration } from "../../utils/elapsedTime.js";

const TEAM_LABEL = { red: "Red Team", blue: "Blue Team" };

/**
 * One component for both teams, picked by the `team` prop ("red" or "blue").
 * Shows only injects visible to that team (visibility "all" or a match), and
 * a log that's this team's own — it never reads the other team's log.
 */
export default function TeamViewPanel({ team, store, logDecision }) {
  const [draft, setDraft] = useState("");
  const [linkedInjectId, setLinkedInjectId] = useState("");

  const currentRun = [...store.runs].reverse().find((r) => r.status === "running" || r.status === "paused");
  const scenario = currentRun ? store.scenarios.find((s) => s.id === currentRun.scenarioId) : null;

  // Computed before the early return below (with a null-safe fallback built
  // into visibleInjectsForTeam) since hooks must run unconditionally on
  // every render — the useEffect right after needs this list regardless of
  // whether there's a live run.
  const visibleInjects = visibleInjectsForTeam(currentRun, scenario, team);

  // If the inject this team had selected to comment on stops being visible
  // to them (the facilitator can change an inject's visibility at any time,
  // including mid-run), drop the stale selection instead of leaving it
  // sitting in state ready to be submitted against something they can no
  // longer see.
  useEffect(() => {
    if (linkedInjectId && !visibleInjects.some((i) => i.id === linkedInjectId)) {
      setLinkedInjectId("");
    }
  });

  // Live clock, same as the Run Console: only ticks while actually running,
  // so it doesn't need to care whether currentRun exists yet — the effect
  // body just bails out when there's nothing to tick for.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!currentRun || currentRun.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentRun?.id, currentRun?.status]);

  if (!currentRun || !scenario) {
    return (
      <div className="rb-panel">
        <div className="rb-panel-head-row">
          <h1 className="rb-panel-title">{TEAM_LABEL[team]} View</h1>
        </div>
        <div className="rb-empty-panel">No exercise running right now.</div>
      </div>
    );
  }

  const logKey = team === "red" ? "redLog" : "blueLog";
  const log = currentRun[logKey];
  // Only ever resolves a title from what this team can currently see — never
  // the full scenario.injects list, which would leak a hidden inject's title
  // into this team's own log if its visibility got corrected after the fact.
  const injectTitle = (id) => visibleInjects.find((i) => i.id === id)?.title || "an inject you can no longer see";

  const submitDecision = () => {
    if (!draft.trim()) return;
    // Defensive check even though the <select> below only ever lists
    // visibleInjects — belt and suspenders against any stale state slipping
    // through before the effect above has a chance to clear it.
    const safeInjectId = visibleInjects.some((i) => i.id === linkedInjectId) ? linkedInjectId : null;
    logDecision(currentRun.id, team, draft.trim(), safeInjectId);
    setDraft("");
  };

  return (
    <div className="rb-panel">
      <div className="rb-panel-head-row">
        <h1 className="rb-panel-title">{TEAM_LABEL[team]} View</h1>
        <span className="rb-badge">{scenario.title}</span>
        {currentRun.startedAt != null && (
          <span className="rb-run-elapsed" title="Time elapsed, excluding any time spent paused">
            {formatDuration(elapsedMs(currentRun, now))}
          </span>
        )}
      </div>

      {currentRun.status === "paused" && <p className="rb-panel-note">The exercise is paused right now.</p>}

      <div className="rb-field">
        <span className="rb-field-label">Revealed so far</span>
        {visibleInjects.length === 0 ? (
          <div className="rb-empty-panel">Nothing's been revealed yet. Hang tight.</div>
        ) : (
          visibleInjects.map((i) => (
            <div key={i.id} className="rb-inject-reveal">
              <div className="rb-inject-reveal-title">{i.title || "Untitled"}</div>
              <div className="rb-inject-reveal-body">{i.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="rb-field">
        <span className="rb-field-label">Log a decision</span>
        {visibleInjects.length > 0 && (
          <select className="rb-input" value={linkedInjectId} onChange={(e) => setLinkedInjectId(e.target.value)}>
            <option value="">General note</option>
            {visibleInjects.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title || "Untitled"}
              </option>
            ))}
          </select>
        )}
        <textarea
          className="rb-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What is the team doing in response?"
        />
        <button
          type="button"
          className="rb-btn rb-btn-primary"
          onClick={submitDecision}
          disabled={currentRun.status !== "running"}
        >
          Log decision
        </button>
        {currentRun.status !== "running" && <p className="rb-panel-note">Logging picks back up once the exercise resumes.</p>}
      </div>

      <div className="rb-field">
        <span className="rb-field-label">{TEAM_LABEL[team]} log</span>
        {log.length === 0 ? (
          <div className="rb-empty-panel">No decisions logged yet.</div>
        ) : (
          [...log].reverse().map((entry) => (
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
    </div>
  );
}
