import { useEffect, useState } from "react";
import { dealTypes } from "../../data/beats.js";
import { getDeal, countersignUrl } from "../../lib/deals.js";

const POLL_MS = 8000;

export default function ProjectSpace({ beat, deal, dealRecord, setDealRecord, onRestart }) {
  const dealTitle = dealTypes.find((d) => d.id === deal.type)?.title ?? deal.type;
  const [copied, setCopied] = useState(false);

  const status = dealRecord?.status ?? "proposed";
  const countersigned = status === "countersigned";
  const declined = status === "declined";

  // Poll for the producer's countersignature while the deal is still open
  useEffect(() => {
    if (!dealRecord || status !== "proposed") return;
    const t = setInterval(async () => {
      const fresh = await getDeal(dealRecord.deal_token);
      if (fresh && fresh.status !== "proposed") setDealRecord(fresh);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [dealRecord, status, setDealRecord]);

  async function copyLink() {
    await navigator.clipboard.writeText(countersignUrl(dealRecord));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const studioBase = import.meta.env.VITE_NOIZES_STUDIO_URL;
  const studioUrl = studioBase && dealRecord
    ? `${studioBase.replace(/\/$/, "")}/studio?source=beatsunlimited&deal=${dealRecord.deal_token}` +
      `&title=${encodeURIComponent(dealRecord.beat_title)}&producer=${encodeURIComponent(dealRecord.producer_name)}` +
      `&master=${dealRecord.master_split}&pub=${dealRecord.publishing_split}`
    : null;

  return (
    <section>
      <div className="confirm-head">
        <div className={`check-circle ${declined ? "bad" : ""}`}>{declined ? "✕" : "OK"}</div>
        <div>
          <h2>
            {declined ? "Proposal declined" : countersigned ? "Deal fully signed" : "Proposal sent & split sheet signed"}
          </h2>
          <p>
            {declined
              ? `${beat.producer} declined this proposal. You can start a new one with different terms.`
              : countersigned
                ? `${dealRecord.producer_signed_name} countersigned — the split sheet is now in force.`
                : `Sent to ${beat.producer} for "${beat.title}". Share the countersign link below with them.`}
          </p>
        </div>
      </div>

      {dealRecord && !declined && status === "proposed" && (
        <div className="link-card">
          <div className="link-card-label">
            Producer countersign link {dealRecord.local && <span className="local-badge">saved locally — backend offline</span>}
          </div>
          <div className="link-row">
            <code className="link-code">{countersignUrl(dealRecord)}</code>
            <button className="btn btn-ghost" onClick={copyLink}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <div className="link-help">
            In production this goes out automatically (email / YouTube comment / DM). For now,
            send it to the producer yourself — this page updates live once they sign.
          </div>
        </div>
      )}

      <div className="space-grid">
        <div className="space-card">
          <h4>Project Space</h4>
          <div className="checklist">
            <div className="cl-item"><div className="cl-dot done" /><div>Beat selected & split sheet signed by you</div></div>
            <div className={`cl-item ${countersigned ? "" : "dim"}`}>
              <div className={`cl-dot ${countersigned ? "done" : ""}`} />
              <div>{declined ? "Producer declined the proposal" : countersigned ? "Producer countersigned" : "Waiting on producer's countersignature"}</div>
            </div>
            <div className="cl-item dim"><div className="cl-dot" /><div>Finish the song</div></div>
            <div className="cl-item dim"><div className="cl-dot" /><div>Register release & credits</div></div>
            <div className="cl-item dim"><div className="cl-dot" /><div>Release — payout splits automatically</div></div>
          </div>

          {countersigned && studioUrl && (
            <div className="noizes-handoff">
              <div className="nh-title">Noizes ecosystem</div>
              <div className="nh-desc">
                This beat is now cleared for release. Continue in Noizes Studio to turn the
                finished song into a Collectible Release with the split terms attached.
              </div>
              <a className="btn btn-accent" href={studioUrl} target="_blank" rel="noreferrer">
                Continue in Noizes Studio →
              </a>
            </div>
          )}
        </div>
        <div className="space-card">
          <h4>Split Terms</h4>
          <div className="split-line"><span>Deal type</span><b>{dealTitle}</b></div>
          <div className="split-line"><span>Master split to producer</span><b>{deal.master}%</b></div>
          <div className="split-line"><span>Publishing split to producer</span><b>{deal.pub}%</b></div>
          <div className="split-line"><span>Upfront paid</span><b>${deal.upfront}</b></div>
          <div className="split-line"><span>Signed by</span><b>{dealRecord?.artist_name || "You"}</b></div>
          <div className="split-line">
            <span>Status</span>
            <b className={`status-pill ${status}`}>
              {declined ? "Declined" : countersigned ? "Fully signed" : "Awaiting countersign"}
            </b>
          </div>
          {countersigned && (
            <div className="split-line"><span>Countersigned by</span><b>{dealRecord.producer_signed_name}</b></div>
          )}
          <div className="enforce-note">
            This agreement stays valid even if you release elsewhere — but releasing through
            beatsunlimited's connected distribution means the producer's cut pays out
            automatically, with nothing for either of you to track manually.
          </div>
        </div>
      </div>

      <div className="back-link" onClick={onRestart}>Start another deal</div>
    </section>
  );
}
