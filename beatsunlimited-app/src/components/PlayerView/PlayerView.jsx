import { useMemo, useState } from "react";
import MetaPanel from "./MetaPanel.jsx";
import VideoFrame from "./VideoFrame.jsx";
import ControlBar from "./ControlBar.jsx";
import SearchPanel from "./SearchPanel.jsx";
import AiMatchPanel from "./AiMatchPanel.jsx";
import CommentsBlock from "./CommentsBlock.jsx";
import QueuePanel from "./QueuePanel.jsx";

export default function PlayerView({ beats, currentBeat, setCurrentBeat, onPropose }) {
  const [activeChip, setActiveChip] = useState("All");

  // Chips follow whatever is actually in the catalog (genres first, then the
  // most common moods/tags) so API-ingested beats stay filterable.
  const chipOptions = useMemo(() => {
    const genres = Array.from(new Set(beats.map((b) => b.genre).filter(Boolean)));
    const tagCounts = new Map();
    for (const b of beats) for (const t of b.tags) {
      if (!genres.includes(t)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, z) => z[1] - a[1])
      .slice(0, Math.max(0, 8 - genres.length))
      .map(([t]) => t);
    return ["All", ...genres, ...topTags];
  }, [beats]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const allMoods = useMemo(
    () => Array.from(new Set(beats.reduce((acc, b) => acc.concat(b.tags), []))),
    [beats]
  );

  // If the catalog refreshes and the selected chip disappears, fall back to All
  const effectiveChip = chipOptions.includes(activeChip) ? activeChip : "All";

  const pool = useMemo(() => {
    if (effectiveChip === "All") return beats;
    return beats.filter((b) => b.genre === effectiveChip || b.tags.includes(effectiveChip));
  }, [beats, effectiveChip]);

  const queue = useMemo(() => {
    const others = pool.filter((b) => b.id !== currentBeat.id);
    return others.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, currentBeat.id]);

  function shuffleNext() {
    const others = pool.filter((b) => b.id !== currentBeat.id);
    const source = others.length ? others : beats;
    setCurrentBeat(source[Math.floor(Math.random() * source.length)]);
  }

  function freeDownload() {
    // Real MP3 only when the producer supplied a file we may serve; otherwise
    // send the artist to the producer's own upload on YouTube.
    if (currentBeat.downloadUrl) {
      let href = currentBeat.downloadUrl;
      // Supabase public storage supports ?download=<filename> to force
      // a Content-Disposition: attachment response
      if (href.includes("/storage/v1/object/public/")) {
        const name = `${currentBeat.title}.mp3`.replace(/[\\/:*?"<>|]/g, "").trim();
        href += (href.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(name);
      }
      const a = document.createElement("a");
      a.href = href;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.open(currentBeat.watchUrl, "_blank", "noopener");
  }

  return (
    <section>
      <div className="player-grid">
        <MetaPanel beat={currentBeat} onPropose={onPropose} onFreeDownload={freeDownload} />

        <div className="video-col">
          <VideoFrame beat={currentBeat} />

          <ControlBar
            searchOpen={searchOpen}
            aiOpen={aiOpen}
            saved={saved}
            onToggleSearch={() => { setAiOpen(false); setSearchOpen((v) => !v); }}
            onToggleAi={() => { setSearchOpen(false); setAiOpen((v) => !v); }}
            onToggleSave={() => setSaved((v) => !v)}
            onShuffle={shuffleNext}
          />

          {searchOpen && (
            <SearchPanel chips={chipOptions} activeChip={effectiveChip} onSetChip={setActiveChip} />
          )}
          {aiOpen && (
            <AiMatchPanel moods={allMoods} beats={beats} onMatch={setCurrentBeat} />
          )}

          <CommentsBlock />
        </div>

        <QueuePanel queue={queue} onSelect={setCurrentBeat} />
      </div>
    </section>
  );
}
