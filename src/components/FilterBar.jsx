import { toggleValue } from "../utils/search.js";

/**
 * Shared search + filter toolbar. `groups` is a list of independent toggle-chip
 * rows (e.g. visibility, tags) — each entry needs a label, all its possible
 * values, the currently active subset, and a setter.
 */
export default function FilterBar({ search, onSearch, groups, onClearAll, resultCount, sort, pinnedOnly }) {
  const anyActive = search.trim() !== "" || groups.some((g) => g.active.length > 0) || (pinnedOnly && pinnedOnly.active);

  return (
    <div className="rb-filter-bar">
      <div className="rb-filter-search-row">
        <input
          className="rb-input rb-search-input"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="rb-result-count">{resultCount} result{resultCount === 1 ? "" : "s"}</span>
        {pinnedOnly && (
          <button
            type="button"
            className={`rb-chip rb-pinned-toggle${pinnedOnly.active ? " rb-chip-active" : ""}`}
            onClick={() => pinnedOnly.onChange(!pinnedOnly.active)}
          >
            ★ Pinned only
          </button>
        )}
        {sort && (
          <select className="rb-input rb-sort-select" value={sort.value} onChange={(e) => sort.onChange(e.target.value)}>
            {sort.options.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        )}
        {anyActive && (
          <button type="button" className="rb-btn rb-btn-ghost rb-btn-small" onClick={onClearAll}>
            Clear filters
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div className="rb-filter-group" key={g.label}>
          <span className="rb-filter-group-label">{g.label}</span>
          <div className="rb-chip-row">
            {g.values.map((v) => (
              <button
                key={v}
                type="button"
                className={`rb-chip rb-filter-chip${g.active.includes(v) ? " rb-chip-active" : ""}`}
                onClick={() => g.setActive(toggleValue(g.active, v))}
              >
                {g.formatLabel ? g.formatLabel(v) : v}
              </button>
            ))}
            {g.values.length === 0 && <span className="rb-filter-group-empty">none yet</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
