import { useState } from "react";

export default function SignSheet({ onBack, onSign, signing }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const canSign = name.trim().length > 1 && agree && !signing;

  return (
    <section>
      <div className="panel">
        <h3>Sign the split sheet</h3>
        <div className="sub">This is a timestamped, identity-verified agreement. Type your full name to sign.</div>
        <input
          type="text" className="sign-input" placeholder="Type your full legal name"
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <label className="agree-row">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree these terms are binding once both parties sign, and that release payouts
            will route through beatsunlimited's split system per the terms above.
          </span>
        </label>
        <button className="btn btn-accent btn-full" disabled={!canSign} onClick={() => onSign(name)}>
          {signing ? "Signing & sending…" : "Sign & Send Proposal"}
        </button>
      </div>
      <div className="back-link" onClick={onBack}>Back to deal terms</div>
    </section>
  );
}
