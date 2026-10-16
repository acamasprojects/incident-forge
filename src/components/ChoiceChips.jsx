/** Exclusive single-select chip row — used inside forms (visibility, trigger type). */
export default function ChoiceChips({ values, value, onChange, formatLabel }) {
  return (
    <div className="rb-chip-row">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={`rb-chip rb-choice-chip${value === v ? " rb-chip-active" : ""}`}
          onClick={() => onChange(v)}
        >
          {formatLabel ? formatLabel(v) : v}
        </button>
      ))}
    </div>
  );
}
