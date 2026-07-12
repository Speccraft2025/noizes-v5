export default function ControlBar({
  searchOpen, aiOpen, saved,
  onToggleSearch, onToggleAi, onToggleSave, onShuffle,
}) {
  return (
    <div className="control-bar">
      <div className={`icon-btn ${searchOpen ? "on" : ""}`} title="Search / filter" onClick={onToggleSearch}>🔍</div>
      <div className={`icon-btn ${aiOpen ? "on" : ""}`} title="AI Match" onClick={onToggleAi}>✨</div>
      <button className="shuffle-btn" onClick={onShuffle}>⟲ Shuffle — Discover</button>
      <select className="mode-select" defaultValue="random">
        <option value="random">Random</option>
        <option value="mood">By Mood</option>
        <option value="genre">By Genre</option>
      </select>
      <div className={`icon-btn ${saved ? "on" : ""}`} title="Save" onClick={onToggleSave}>★</div>
    </div>
  );
}
