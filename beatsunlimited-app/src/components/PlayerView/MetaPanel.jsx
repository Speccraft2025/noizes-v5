export default function MetaPanel({ beat, onPropose, onFreeDownload }) {
  return (
    <aside className="meta-panel">
      <h2>{beat.title}</h2>
      <div className="meta-row">
        <span>Producer</span>
        <span><a href={beat.producerUrl} target="_blank" rel="noopener noreferrer">{beat.producer}</a></span>
      </div>
      <div className="meta-row"><span>Genre</span><span>{beat.genre}</span></div>
      <div className="meta-row"><span>Tempo</span><span>{beat.tempo}</span></div>
      <div className="meta-row" style={{ borderBottom: "none" }}>
        <span>License</span>
        <span><span className="license-pill">{beat.license}</span></span>
      </div>
      <div className="meta-tags">
        {beat.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>
      <div className="meta-source">
        Streaming the producer's actual upload via YouTube's embed player —{" "}
        <a href={beat.watchUrl} target="_blank" rel="noopener noreferrer">open on YouTube ↗</a>. Nothing is rehosted.
      </div>
      <div className="meta-cta">
        <button className="btn btn-accent btn-full" onClick={onPropose}>
          I Want To Use This — Propose a Deal
        </button>
        <button className="btn btn-ghost btn-full" onClick={onFreeDownload}>
          {beat.downloadUrl ? "Free Download (MP3)" : "Free Download (opens YouTube)"}
        </button>
      </div>
      <div className="promo-box">
        <div className="badge-label">Noizes Ecosystem</div>
        <p>Once licensed, this beat can become a Collectible Release — stems, artwork, and producer commentary included.</p>
      </div>
    </aside>
  );
}
