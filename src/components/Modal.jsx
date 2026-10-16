import { useEffect } from "react";

/** Simple centered overlay dialog: click the backdrop or press Escape to close. */
export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="rb-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`rb-modal${wide ? " rb-modal-wide" : ""}`}>
        <div className="rb-modal-head">
          <h2 className="rb-modal-title">{title}</h2>
          <button type="button" className="rb-delete-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="rb-modal-body">{children}</div>
      </div>
    </div>
  );
}
