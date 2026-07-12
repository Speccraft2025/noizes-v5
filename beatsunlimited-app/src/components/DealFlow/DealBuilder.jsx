import { dealTypes } from "../../data/beats.js";

export default function DealBuilder({ beat, deal, setDeal, onBack, onContinue }) {
  function applyDealType(id) {
    const dt = dealTypes.find((d) => d.id === id);
    setDeal({ ...deal, type: id, master: dt.master, pub: dt.pub, upfront: dt.upfront });
  }

  const currentType = dealTypes.find((d) => d.id === deal.type);
  const showUpfront = deal.type === "buyout" || deal.type === "hybrid";

  return (
    <section>
      <div className="panel">
        <h3>Propose a deal</h3>
        <div className="sub">
          You're proposing terms to <b>{beat.producer}</b> for "{beat.title}". This generates a
          split sheet both of you e-sign — it's a binding agreement, not a DM.
        </div>

        <div className="deal-type-row">
          {dealTypes.map((d) => (
            <div
              key={d.id}
              className={`deal-type ${d.id === deal.type ? "on" : ""}`}
              onClick={() => applyDealType(d.id)}
            >
              <div className="dt-title">{d.title}</div>
              <div className="dt-desc">{d.desc}</div>
            </div>
          ))}
        </div>

        <div className="slider-block">
          <div className="slider-label">
            <span>Producer's share of master (recording income)</span>
            <span className="val">{deal.master}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={deal.master}
            onChange={(e) => setDeal({ ...deal, master: Number(e.target.value) })}
          />
          <div className="slider-help">Their cut of streaming & sales revenue once the song is released.</div>
        </div>

        <div className="slider-block">
          <div className="slider-label">
            <span>Producer's share of publishing (songwriting credit)</span>
            <span className="val">{deal.pub}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={deal.pub}
            onChange={(e) => setDeal({ ...deal, pub: Number(e.target.value) })}
          />
          <div className="slider-help">Their cut as a credited co-writer of the composition.</div>
        </div>

        {showUpfront && (
          <div className="upfront-row">
            <label style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Upfront fee (recouped before splits kick in)
            </label>
            <input
              type="number" min="0" step="10" value={deal.upfront}
              onChange={(e) => setDeal({ ...deal, upfront: Number(e.target.value) })}
            />
          </div>
        )}

        <div className="summary-box">
          <div className="row"><span>Deal type</span><b>{currentType.title}</b></div>
          <div className="row"><span>Master split to producer</span><b>{deal.master}%</b></div>
          <div className="row"><span>Publishing split to producer</span><b>{deal.pub}%</b></div>
          <div className="row"><span>Upfront payment</span><b>${deal.upfront}</b></div>
          <div className="row total">
            <span>How payout works</span>
            <span>Auto-split at release — routed before it reaches you</span>
          </div>
        </div>

        <button className="btn btn-accent btn-full" onClick={onContinue}>Continue to Sign</button>
      </div>
      <div className="back-link" onClick={onBack}>Back to player</div>
    </section>
  );
}
