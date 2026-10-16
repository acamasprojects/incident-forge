import { useState, useRef, useEffect } from "react";

/**
 * Searchable picker for linking one entity to another. Type to filter, click
 * an option to pick it.
 *
 * - single mode: `selected` is one id or null, `onChange(id | null)`
 * - multi mode: `selected` is an array of ids, `onChange(idArray)`
 */
export default function LinkPicker({ options, selected, onChange, multiple = false, placeholder = "Search…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedIds = multiple ? selected || [] : selected ? [selected] : [];
  const selectedItems = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean);

  const filtered = options
    .filter((o) => !selectedIds.includes(o.id))
    .filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  const pick = (id) => {
    if (multiple) {
      onChange([...selectedIds, id]);
    } else {
      onChange(id);
      setOpen(false);
    }
    setQuery("");
  };

  const remove = (id) => {
    if (multiple) onChange(selectedIds.filter((x) => x !== id));
    else onChange(null);
  };

  return (
    <div className="rb-link-picker" ref={wrapRef}>
      {selectedItems.length > 0 && (
        <div className="rb-link-chips">
          {selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rb-chip rb-chip-removable"
              onClick={() => remove(item.id)}
              title="Remove"
            >
              {item.label} ✕
            </button>
          ))}
        </div>
      )}
      {(multiple || selectedItems.length === 0) && (
        <div className="rb-link-input-wrap">
          <input
            className="rb-input rb-link-input"
            placeholder={placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
          />
          {open && filtered.length > 0 && (
            <div className="rb-link-dropdown">
              {filtered.map((o) => (
                <div key={o.id} className="rb-link-option" onMouseDown={() => pick(o.id)}>
                  {o.label}
                </div>
              ))}
            </div>
          )}
          {open && query && filtered.length === 0 && (
            <div className="rb-link-dropdown">
              <div className="rb-link-option rb-link-option-empty">No matches</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
