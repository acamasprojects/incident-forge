import { useState, useRef } from "react";
import { emptyScenario, emptyInject, VISIBILITIES, VISIBILITY_LABEL, VISIBILITY_COLOR } from "../../data/model.js";
import { searchAndFilter, suggestClosest, hasAllTags, collectTags } from "../../utils/search.js";
import EntityCard from "../EntityCard.jsx";
import FilterBar from "../FilterBar.jsx";
import ChoiceChips from "../ChoiceChips.jsx";
import TagInput from "../TagInput.jsx";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "title-asc", label: "Title (A–Z)" },
  { value: "title-desc", label: "Title (Z–A)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
const SORT_COMPARATORS = {
  "title-asc": (a, b) => (a.title || "").localeCompare(b.title || ""),
  "title-desc": (a, b) => (b.title || "").localeCompare(a.title || ""),
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
};

/**
 * The scenario library doubles as the editor, same as every Campaign Forge
 * entity panel: one list, inline-editable cards, no separate editor screen.
 * Each scenario's injects are a nested list of the same card component.
 */
export default function ScenarioLibraryPanel({ store, update, flash }) {
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sortMode, setSortMode] = useState("relevance");
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInjectId, setExpandedInjectId] = useState(null);
  const cardRefs = useRef({});

  const allTags = collectTags(store.scenarios);

  const fieldsFor = (s) => [
    { value: s.title, weight: 3, label: "title" },
    { value: s.summary, weight: 1, label: "summary" },
    { value: (s.tags || []).join(" "), weight: 2, label: "tags" },
    { value: (s.objectives || []).join(" "), weight: 1, label: "objectives" },
    { value: (s.injects || []).map((i) => `${i.title} ${i.body}`).join(" "), weight: 1, label: "injects" },
  ];

  const extraFilter = (s) => (!pinnedOnly || s.pinned) && hasAllTags(s.tags, activeTags);

  const results = searchAndFilter(store.scenarios, { search, fieldsFn: fieldsFor, extraFilter });
  const filtered = SORT_COMPARATORS[sortMode]
    ? results.map((r) => r.item).sort(SORT_COMPARATORS[sortMode])
    : results.map((r) => r.item);
  const matchNoteFor = (id) => {
    const r = results.find((x) => x.item.id === id);
    if (!search.trim() || !r || r.matchedFields.length === 0) return null;
    if (r.matchedFields.length === 1 && r.matchedFields[0] === "title") return null;
    return `matched: ${r.matchedFields.join(", ")}`;
  };

  const suggestions =
    filtered.length === 0 && search.trim() && store.scenarios.length > 0
      ? suggestClosest(search, [...store.scenarios.map((s) => s.title), ...allTags])
      : [];

  const addScenario = () => {
    const s = emptyScenario(`Scenario ${store.scenarios.length + 1}`);
    update((st) => ({ ...st, scenarios: [s, ...st.scenarios] }));
    setExpandedId(s.id);
    flash("Scenario added");
  };

  const setField = (id, field, value) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  /** True if some not-yet-ended run is currently using this scenario. */
  const scenarioInUse = (id) => store.runs.some((r) => r.scenarioId === id && r.status !== "ended");

  const removeScenario = (id) => {
    // Defensive check here too, in case this ever gets called from somewhere
    // that skips the confirm-dialog guard below.
    if (scenarioInUse(id)) {
      flash("Can't delete — this scenario is running an active exercise. End the run first.");
      return;
    }
    update((st) => ({ ...st, scenarios: st.scenarios.filter((s) => s.id !== id) }));
  };

  // Objectives are a plain list of short strings, edited by index.
  const addObjective = (scenarioId, text) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, objectives: [...s.objectives, text] } : s
      ),
    }));
  };
  const removeObjective = (scenarioId, index) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, objectives: s.objectives.filter((_, i) => i !== index) } : s
      ),
    }));
  };

  const addInject = (scenarioId) => {
    const inj = emptyInject();
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, injects: [...s.injects, { ...inj, order: s.injects.length }] } : s
      ),
    }));
    setExpandedInjectId(inj.id);
  };

  const setInjectField = (scenarioId, injectId, field, value) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) =>
        s.id !== scenarioId
          ? s
          : { ...s, injects: s.injects.map((i) => (i.id === injectId ? { ...i, [field]: value } : i)) }
      ),
    }));
  };

  const removeInject = (scenarioId, injectId) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) =>
        s.id !== scenarioId ? s : { ...s, injects: s.injects.filter((i) => i.id !== injectId) }
      ),
    }));
  };

  /** Swap this inject's order with its neighbor in the revealed-order list. */
  const moveInject = (scenarioId, injectId, direction) => {
    update((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) => {
        if (s.id !== scenarioId) return s;
        const sorted = [...s.injects].sort((a, b) => a.order - b.order);
        const i = sorted.findIndex((inj) => inj.id === injectId);
        const j = i + direction;
        if (i === -1 || j < 0 || j >= sorted.length) return s;
        const [a, b] = [sorted[i], sorted[j]];
        const injects = s.injects.map((inj) => {
          if (inj.id === a.id) return { ...inj, order: b.order };
          if (inj.id === b.id) return { ...inj, order: a.order };
          return inj;
        });
        return { ...s, injects };
      }),
    }));
  };

  return (
    <div className="rb-panel">
      <div className="rb-panel-head-row">
        <h1 className="rb-panel-title">Scenario Library</h1>
        <button type="button" className="rb-btn rb-btn-primary" onClick={addScenario}>
          + New Scenario
        </button>
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        resultCount={filtered.length}
        sort={{ value: sortMode, options: SORT_OPTIONS, onChange: setSortMode }}
        pinnedOnly={{ active: pinnedOnly, onChange: setPinnedOnly }}
        onClearAll={() => {
          setSearch("");
          setActiveTags([]);
          setPinnedOnly(false);
        }}
        groups={[{ label: "Tags", values: allTags, active: activeTags, setActive: setActiveTags }]}
      />

      {store.scenarios.length === 0 ? (
        <div className="rb-empty-panel">No scenarios yet. Add one to start building out injects for an exercise.</div>
      ) : filtered.length === 0 ? (
        <div className="rb-empty-panel">
          No scenarios match the current filters.
          {suggestions.length > 0 && (
            <div className="rb-suggestions">
              <span className="rb-suggestions-label">Did you mean:</span>
              {suggestions.map((s) => (
                <button key={s} type="button" className="rb-chip rb-chip-link" onClick={() => setSearch(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rb-card-list">
          {filtered.map((s) => {
            const expanded = expandedId === s.id;
            const sortedInjects = [...s.injects].sort((a, b) => a.order - b.order);
            return (
              <EntityCard
                key={s.id}
                cardRef={(el) => (cardRefs.current[s.id] = el)}
                title={s.title}
                expanded={expanded}
                onToggle={() => setExpandedId(expanded ? null : s.id)}
                onDelete={() => {
                  if (scenarioInUse(s.id)) {
                    flash("Can't delete — this scenario is running an active exercise. End the run first.");
                    return;
                  }
                  if (confirm(`Delete scenario "${s.title || "Untitled"}"? This also deletes its injects.`)) removeScenario(s.id);
                }}
                pinned={s.pinned}
                onTogglePin={() => setField(s.id, "pinned", !s.pinned)}
                meta={<span className="rb-card-submeta">{s.injects.length} inject{s.injects.length === 1 ? "" : "s"}</span>}
                matchNote={matchNoteFor(s.id)}
              >
                <div className="rb-form-grid">
                  <label className="rb-field rb-field-wide">
                    <span className="rb-field-label">Title</span>
                    <input
                      className="rb-input"
                      value={s.title}
                      onChange={(e) => setField(s.id, "title", e.target.value)}
                      placeholder="Ransomware on the file server"
                    />
                  </label>
                </div>

                <div className="rb-field">
                  <span className="rb-field-label">Summary</span>
                  <textarea
                    className="rb-textarea"
                    value={s.summary}
                    onChange={(e) => setField(s.id, "summary", e.target.value)}
                    placeholder="What this exercise is about, at a glance…"
                  />
                </div>

                <div className="rb-field">
                  <span className="rb-field-label">Objectives</span>
                  <ObjectiveList
                    objectives={s.objectives}
                    onAdd={(text) => addObjective(s.id, text)}
                    onRemove={(i) => removeObjective(s.id, i)}
                  />
                </div>

                <div className="rb-field">
                  <span className="rb-field-label">Tags</span>
                  <TagInput tags={s.tags} onChange={(tags) => setField(s.id, "tags", tags)} suggestions={allTags} />
                </div>

                <div className="rb-field rb-injects-field">
                  <div className="rb-panel-head-row">
                    <span className="rb-field-label">Injects</span>
                    <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={() => addInject(s.id)}>
                      + Add inject
                    </button>
                  </div>
                  {sortedInjects.length === 0 ? (
                    <div className="rb-empty-panel">No injects yet. An inject is one event you reveal during the exercise.</div>
                  ) : (
                    <div className="rb-card-list rb-inject-list">
                      {sortedInjects.map((inj, index) => {
                        const injExpanded = expandedInjectId === inj.id;
                        return (
                          <EntityCard
                            key={inj.id}
                            title={inj.title}
                            expanded={injExpanded}
                            onToggle={() => setExpandedInjectId(injExpanded ? null : inj.id)}
                            onDelete={() => {
                              if (confirm(`Delete inject "${inj.title || "Untitled"}"?`)) removeInject(s.id, inj.id);
                            }}
                            badges={
                              <span
                                className="rb-badge"
                                style={{ color: VISIBILITY_COLOR[inj.visibility], borderColor: VISIBILITY_COLOR[inj.visibility] }}
                              >
                                {VISIBILITY_LABEL[inj.visibility]}
                              </span>
                            }
                            meta={
                              <div className="rb-inject-order-btns">
                                <button
                                  type="button"
                                  className="rb-btn rb-btn-ghost rb-btn-small"
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveInject(s.id, inj.id, -1);
                                  }}
                                  title="Move earlier"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="rb-btn rb-btn-ghost rb-btn-small"
                                  disabled={index === sortedInjects.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveInject(s.id, inj.id, 1);
                                  }}
                                  title="Move later"
                                >
                                  ▼
                                </button>
                              </div>
                            }
                          >
                            <div className="rb-form-grid">
                              <label className="rb-field rb-field-wide">
                                <span className="rb-field-label">Title</span>
                                <input
                                  className="rb-input"
                                  value={inj.title}
                                  onChange={(e) => setInjectField(s.id, inj.id, "title", e.target.value)}
                                  placeholder="Help desk reports encrypted shares"
                                />
                              </label>
                            </div>
                            <div className="rb-field">
                              <span className="rb-field-label">What happens</span>
                              <textarea
                                className="rb-textarea"
                                value={inj.body}
                                onChange={(e) => setInjectField(s.id, inj.id, "body", e.target.value)}
                                placeholder="What the facilitator reads out or shows when this is revealed…"
                              />
                            </div>
                            <div className="rb-field">
                              <span className="rb-field-label">Visible to</span>
                              <ChoiceChips
                                values={VISIBILITIES}
                                value={inj.visibility}
                                onChange={(v) => setInjectField(s.id, inj.id, "visibility", v)}
                                formatLabel={(v) => VISIBILITY_LABEL[v]}
                              />
                            </div>
                            <div className="rb-field">
                              <span className="rb-field-label">Pacing note (optional)</span>
                              <input
                                className="rb-input"
                                value={inj.triggerNote}
                                onChange={(e) => setInjectField(s.id, inj.id, "triggerNote", e.target.value)}
                                placeholder="~T+15m"
                              />
                            </div>
                          </EntityCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ObjectiveList({ objectives, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (draft.trim()) {
      onAdd(draft.trim());
      setDraft("");
    }
  };
  return (
    <div className="rb-objective-list">
      {objectives.map((o, i) => (
        <div className="rb-objective-row" key={i}>
          <span className="rb-objective-text">{o}</span>
          <button type="button" className="rb-delete-btn" onClick={() => onRemove(i)} title="Remove">
            ✕
          </button>
        </div>
      ))}
      <div className="rb-objective-row">
        <input
          className="rb-input rb-objective-text-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add an objective and press Enter…"
        />
        <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={commit}>
          Add
        </button>
      </div>
    </div>
  );
}
