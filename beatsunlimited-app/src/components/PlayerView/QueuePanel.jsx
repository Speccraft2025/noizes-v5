export default function QueuePanel({ queue, onSelect }) {
  return (
    <aside className="queue-panel">
      <div className="queue-list">
        <div className="queue-head">Up Next</div>
        {queue.map((b) => (
          <div className="qitem" key={b.id} onClick={() => onSelect(b)}>
            <img className="qthumb" src={b.thumb} alt="" />
            <div className="qinfo">
              <div className="qtitle">{b.title.length > 44 ? b.title.slice(0, 44) + "…" : b.title}</div>
              <div className="qsub">{b.producer} · {b.genre}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="promo-box" style={{ marginTop: 0 }}>
        <div className="badge-label">Verified Payout</div>
        <p>Every deal here is a signed split sheet, not a DM. Payouts route automatically at release.</p>
      </div>
    </aside>
  );
}
