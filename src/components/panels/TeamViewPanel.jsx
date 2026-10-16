import { useState } from "react";
import { uid } from "../../data/model.js";

const TEAM_LABEL = { red: "Red Team", blue: "Blue Team" };

/**
 * One component for both teams, picked by the `team` prop ("red" or "blue").
 * Shows only injects visible to that team (visibility "all" or a match), and
 * a log that's this team's own — it never reads the other team's log.
 */
export default function TeamViewPanel({ team, store, update }) {
  const [draft, setDraft] = useState("");
  const [linkedInjectId, setLinkedInjectId] = useState("");

  const currentRun = [...store.runs].reverse().find((r) => r.status === "running" || r.status === "paused");
  const scenario = currentRun ? store.scenarios.find((s) => s.id === currentRun.scenarioId) : null;

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

  const visibleInjects = scenario.injects
    .filter((i) => currentRun.revealedInjectIds.includes(i.id))
    .filter((i) => i.visibility === "all" || i.visibility === team)
    .sort((a, b) => a.order - b.order);

  const logKey = team === "red" ? "redLog" : "blueLog";
  const log = currentRun[logKey];
  const injectTitle = (id) => scenario.injects.find((i) => i.id === id)?.title || "Untitled";

  const submitDecision = () => {
    if (!draft.trim()) return;
    const entry = { id: uid(), injectId: linkedInjectId || null, body: draft.trim(), at: Date.now() };
    update((st) => ({
      ...st,
      runs: st.runs.map((r) => (r.id === currentRun.id ? { ...r, [logKey]: [...r[logKey], entry] } : r)),
    }));
    setDraft("");
  };

  return (
    <div className="rb-panel">
      <div className="rb-panel-head-row">
        <h1 className="rb-panel-title">{TEAM_LABEL[team]} View</h1>
        <span className="rb-badge">{scenario.title}</span>
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
