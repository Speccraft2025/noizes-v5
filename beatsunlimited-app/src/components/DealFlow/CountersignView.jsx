import { useEffect, useState } from "react";
import { getDeal, countersignDeal, declineDeal } from "../../lib/deals.js";

const dealTypeTitles = { points: "Free + Points", hybrid: "Upfront + Points", buyout: "Straight License" };

export default function CountersignView({ token }) {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getDeal(token).then((d) => {
      if (alive) { setDeal(d); setLoading(false); }
    });
    return () => { alive = false; };
  }, [token]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      setDeal(await fn());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section><div className="panel"><h3>Loading deal…</h3></div></section>;
  }

  if (!deal) {
    return (
      <section>
        <div className="panel">
          <h3>Deal not found</h3>
          <div className="sub">This countersign link is invalid or the proposal was withdrawn.</div>
        </div>
      </section>
    );
  }

  const canSign = name.trim().length > 1 && agree;

  return (
    <section>
      <div className="panel countersign-panel">
        <h3>Split sheet proposal for you</h3>
        <div className="sub">
          <b>{deal.artist_name}</b> wants to use "{deal.beat_title}" and is proposing these
          terms to you ({deal.producer_name}). Countersigning makes this a binding agreement.
        </div>

        <div className="summary-box">
          <div className="row"><span>Deal type</span><b>{dealTypeTitles[deal.deal_type] ?? deal.deal_type}</b></div>
          <div className="row"><span>Your share of master</span><b>{deal.master_split}%</b></div>
          <div className="row"><span>Your share of publishing</span><b>{deal.publishing_split}%</b></div>
          <div className="row"><span>Upfront fee to you</span><b>${deal.upfront_fee}</b></div>
          <div className="row"><span>Artist signed</span><b>{new Date(deal.artist_signed_at).toLocaleString()}</b></div>
        </div>

        {deal.status === "proposed" && (
          <>
            <input
              type="text" className="sign-input" placeholder="Type your full legal name to countersign"
              value={name} onChange={(e) => setName(e.target.value)}
            />
            <label className="agree-row">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                I agree these terms are binding once I countersign, and that release payouts
                will route through beatsunlimited's split system per the terms above.
              </span>
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="countersign-actions">
              <button className="btn btn-accent" disabled={!canSign || busy}
                onClick={() => act(() => countersignDeal(token, name))}>
                {busy ? "Signing…" : "Countersign Deal"}
              </button>
              <button className="btn btn-ghost" disabled={busy}
                onClick={() => act(() => declineDeal(token))}>
                Decline
              </button>
            </div>
          </>
        )}

        {deal.status === "countersigned" && (
          <div className="status-banner ok">
            ✓ Countersigned by {deal.producer_signed_name} on {new Date(deal.producer_signed_at).toLocaleString()}.
            Both parties have signed — the split sheet is now in force.
          </div>
        )}

        {deal.status === "declined" && (
          <div className="status-banner bad">
            This proposal was declined{deal.decline_reason ? ` — ${deal.decline_reason}` : ""}.
          </div>
        )}
      </div>
    </section>
  );
}
