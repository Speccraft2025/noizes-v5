export default function SearchPanel({ chips, activeChip, onSetChip }) {
  return (
    <div className="collapsible">
      <div className="search-inline">
        <input type="text" placeholder='Try: "sad afrobeat" or "dark UK drill"' />
      </div>
      <div className="chips">
        {chips.map((c) => (
          <span
            key={c}
            className={`chip ${c === activeChip ? "on" : ""}`}
            onClick={() => onSetChip(c)}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
