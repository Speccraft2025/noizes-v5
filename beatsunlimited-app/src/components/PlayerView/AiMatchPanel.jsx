import { useState } from "react";

export default function AiMatchPanel({ moods, beats, onMatch }) {
  const [mood, setMood] = useState("");
  const [artist, setArtist] = useState("");
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");

  function findMatch() {
    let candidates = mood ? beats.filter((b) => b.tags.includes(mood)) : beats;
    if (!candidates.length) candidates = beats;
    const match = candidates[Math.floor(Math.random() * candidates.length)];
    onMatch(match);
    setNote(
      `Matched "${match.title}" by ${match.producer}` +
      (mood ? ` for mood: ${mood}` : "") +
      (artist ? `, inspired by ${artist}` : "") + "."
    );
  }

  return (
    <div className="collapsible">
      <div className="ai-row">
        <div className="ai-field">
          <label>Mood</label>
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">Any</option>
            {moods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="ai-field">
          <label>Artist inspiration</label>
          <input type="text" placeholder="e.g. Central Cee" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div className="ai-field">
          <label>Budget</label>
          <input type="number" placeholder="$30" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <button className="btn btn-accent" onClick={findMatch}>Find Match</button>
      </div>
      {note && <div className="ai-note">{note}</div>}
    </div>
  );
}
