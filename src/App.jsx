import { useState } from "react";
import { useExerciseStore } from "./hooks/useExerciseStore.js";
import ScenarioLibraryPanel from "./components/panels/ScenarioLibraryPanel.jsx";

const VIEW_MODES = [
  { id: "facilitator", label: "Facilitator" },
  { id: "red", label: "Red Team" },
  { id: "blue", label: "Blue Team" },
];

const FACILITATOR_TABS = [
  { id: "scenarios", label: "Scenarios" },
  { id: "run", label: "Run Console" },
];

export default function App() {
  const { loaded, store, update } = useExerciseStore();
  const [viewMode, setViewMode] = useState("facilitator");
  const [facilitatorTab, setFacilitatorTab] = useState("scenarios");
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  if (!loaded) {
    return (
      <div className="rb-page">
        <div className="rb-loading">Loading…</div>
      </div>
    );
  }

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
            <>
              <nav className="rb-subtab-nav">
                {FACILITATOR_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`rb-subtab-btn${facilitatorTab === t.id ? " rb-subtab-btn-active" : ""}`}
                    onClick={() => setFacilitatorTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              {facilitatorTab === "scenarios" && (
                <ScenarioLibraryPanel store={store} update={update} flash={flash} />
              )}
              {facilitatorTab === "run" && (
                <div className="rb-panel">
                  <div className="rb-panel-head-row">
                    <h1 className="rb-panel-title">Run Console</h1>
                  </div>
                  <div className="rb-empty-panel">Starting and running an exercise comes in a later issue.</div>
                </div>
              )}
            </>
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
      {toast && <div className="rb-toast">{toast}</div>}
    </div>
  );
}
