import { useState, useRef, useEffect } from "react";

/**
 * Freeform tag editor: type + Enter/comma to add, click a pill to remove.
 * If `suggestions` (existing tags used elsewhere) is passed, typing shows a
 * matching dropdown — keeps tagging consistent so filters don't fragment
 * over near-duplicate spellings.
 */
export default function TagInput({ tags, onChange, suggestions = [], placeholder = "+ tag" }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commit = (value) => {
    const v = (value ?? draft).trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
    setOpen(false);
  };

  const matches = draft.trim()
    ? suggestions.filter((s) => !tags.includes(s) && s.toLowerCase().includes(draft.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="rb-tag-editor" ref={wrapRef}>
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          className="rb-chip rb-chip-removable"
          onClick={() => onChange(tags.filter((x) => x !== t))}
          title="Remove tag"
        >
          {t} ✕
        </button>
      ))}
      <div className="rb-tag-input-wrap">
        <input
          className="rb-tag-input"
          value={draft}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) {
              commit(v.slice(0, -1));
            } else {
              setDraft(v);
              setOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false;
              return;
            }
            commit();
          }}
        />
        {open && matches.length > 0 && (
          <div className="rb-link-dropdown rb-tag-dropdown">
            {matches.map((s) => (
              <div
                key={s}
                className="rb-link-option"
                onMouseDown={() => {
                  skipBlurRef.current = true;
                  commit(s);
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
