/** Shared collapsible card shell used by scenario and inject cards. */
export default function EntityCard({ title, meta, badges, matchNote, pinned, onTogglePin, expanded, onToggle, onDelete, children, cardRef }) {
  return (
    <div className={`rb-card${expanded ? " rb-card-expanded" : ""}${pinned ? " rb-card-pinned" : ""}`} ref={cardRef}>
      <div className="rb-card-head" onClick={onToggle}>
        <div className="rb-card-head-main">
          <span className="rb-card-chevron">{expanded ? "▾" : "▸"}</span>
          {onTogglePin && (
            <button
              type="button"
              className={`rb-pin-btn${pinned ? " rb-pin-btn-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={pinned ? "Unpin" : "Pin"}
            >
              {pinned ? "★" : "☆"}
            </button>
          )}
          <span className="rb-card-title">{title || "Untitled"}</span>
          {badges}
          {matchNote && <span className="rb-match-note">{matchNote}</span>}
        </div>
        <div className="rb-card-head-actions">
          {meta}
          <button
            type="button"
            className="rb-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
      {expanded && <div className="rb-card-body">{children}</div>}
    </div>
  );
}
