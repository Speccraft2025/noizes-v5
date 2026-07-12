const STEPS = [
  { id: "feed", label: "Discover" },
  { id: "deal", label: "Propose" },
  { id: "sign", label: "Sign" },
  { id: "confirm", label: "Project Space" },
];

export default function TopNav({ view }) {
  const activeIdx = STEPS.findIndex((s) => s.id === view);
  return (
    <header className="topnav">
      <div className="logo">
        <span className="dot" />
        beatsunlimited<span className="sub">.shop</span>
      </div>
      <div className="steps">
        {STEPS.map((s, i) => {
          let cls = "step";
          if (i < activeIdx) cls += " done";
          if (i === activeIdx) cls += " active";
          return (
            <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={cls}>{i < activeIdx ? "✓ " : ""}{s.label}</span>
              {i < STEPS.length - 1 && <span className="chev">›</span>}
            </span>
          );
        })}
      </div>
    </header>
  );
}
