import { useState } from "react";
import { useExerciseStore } from "./hooks/useExerciseStore.js";
import ScenarioLibraryPanel from "./components/panels/ScenarioLibraryPanel.jsx";
import RunConsolePanel from "./components/panels/RunConsolePanel.jsx";
import TeamViewPanel from "./components/panels/TeamViewPanel.jsx";

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
  const { loaded, store, update, importRun } = useExerciseStore();
  const [viewMode, setViewMode] = useState("facilitator");
  const [facilitatorTab, setFacilitatorTab] = useState("scenarios");
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const handleImportRun = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        importRun(parsed);
        flash(parsed.scenario ? "Imported run and its scenario" : "Imported run");
      } catch (e) {
        flash("Import failed — invalid file");
        console.error(e);
      }
    };
    reader.readAsText(file);
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
                <RunConsolePanel store={store} update={update} flash={flash} onImportRun={handleImportRun} />
              )}
            </>
          )}

          {viewMode === "red" && <TeamViewPanel team="red" store={store} update={update} />}
          {viewMode === "blue" && <TeamViewPanel team="blue" store={store} update={update} />}
        </main>
      </div>
      {toast && <div className="rb-toast">{toast}</div>}
    </div>
  );
}
