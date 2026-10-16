import { useState } from "react";
import { useExerciseStore } from "./hooks/useExerciseStore.js";
import { emptyScenario } from "./data/model.js";

const VIEW_MODES = [
  { id: "facilitator", label: "Facilitator" },
  { id: "red", label: "Red Team" },
  { id: "blue", label: "Blue Team" },
];

export default function App() {
  const { loaded, store, update } = useExerciseStore();
  const [viewMode, setViewMode] = useState("facilitator");

  if (!loaded) {
    return (
      <div className="rb-page">
        <div className="rb-loading">Loading…</div>
      </div>
    );
  }

  const addTestScenario = () => {
    update((s) => ({
      ...s,
      scenarios: [...s.scenarios, emptyScenario(`Scenario ${s.scenarios.length + 1}`)],
    }));
  };

  return (
    <div className={`rb-page rb-mode-${viewMode}`}>
      <div className="rb-main">
        <header className="rb-topbar">
          <div className="rb-brand">
            <span className="rb-brand-mark">IF</span>
            <div>
              <div className="rb-brand-title">Incident Forge</div>
              <div className="rb-brand-sub">Tabletop Exercise Facilitator</div>
            </div>
          </div>
          <nav className="rb-mode-nav">
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`rb-mode-btn${viewMode === m.id ? " rb-mode-btn-active" : ""}`}
                onClick={() => setViewMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="rb-content">
          {viewMode === "facilitator" && (
            <div className="rb-panel">
              <div className="rb-panel-head-row">
                <h1 className="rb-panel-title">Facilitator Console</h1>
              </div>
              <div className="rb-empty-panel">
                <p>
                  The scenario library, run console, and team views land in later issues. For now,
                  this proves the data model and local save are working.
                </p>
                <button type="button" className="rb-btn rb-btn-primary" onClick={addTestScenario}>
                  + Add test scenario
                </button>
                {store.scenarios.length > 0 && (
                  <ul>
                    {store.scenarios.map((s) => (
                      <li key={s.id}>{s.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {viewMode === "red" && (
            <div className="rb-panel">
              <div className="rb-panel-head-row">
                <h1 className="rb-panel-title">Red Team View</h1>
              </div>
              <p className="rb-panel-note">
                This view only ever shows what's meant for Red Team: "all" and "red" visibility
                injects, plus Red's own log. That comes together in a later issue.
              </p>
              <div className="rb-empty-panel">Nothing to show yet.</div>
            </div>
          )}

          {viewMode === "blue" && (
            <div className="rb-panel">
              <div className="rb-panel-head-row">
                <h1 className="rb-panel-title">Blue Team View</h1>
              </div>
              <p className="rb-panel-note">
                Same idea as Red Team, mirrored: "all" and "blue" visibility injects, plus Blue's
                own log.
              </p>
              <div className="rb-empty-panel">Nothing to show yet.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
